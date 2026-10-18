import base64
import json
import os
from pathlib import Path
import shutil
import socketserver
import subprocess
import threading
import time
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

API='/api/v1'

def test_auth_password_whitespace_is_preserved(client):
    credentials={'username':'admin','password':'   password has spaces   '}
    assert client.post(API+'/auth/setup',json=credentials).status_code==200
    client.headers['X-CSRF-Token']=client.cookies['vision_csrf']
    assert client.post(API+'/auth/logout').status_code==204
    assert client.post(API+'/auth/login',json={**credentials,'password':credentials['password'].strip()}).status_code==401
    assert client.post(API+'/auth/login',json=credentials).status_code==200

def test_camera_secret_patch_preserve_clear_and_spaces(admin,app):
    from app.shared.models import Source
    created=admin.post(API+'/sources',json={'name':'camera','kind':'camera','address':'rtsp://embedded:embedded-password@127.0.0.1:8554/live','username':' operator ','password':' pass with spaces '}).json()
    source_id=created['id']
    def stored():
        with app.state.sessions() as db:
            return app.state.vault.decrypt(db.get(Source,source_id).credentials)
    assert stored()=={'username':' operator ','password':' pass with spaces '}
    changed=admin.patch(API+'/sources/'+source_id,json={'name':'renamed','row_version':created['row_version']}).json()
    assert stored()['password']==' pass with spaces '
    changed=admin.patch(API+'/sources/'+source_id,json={'address':'rtsp://127.0.0.1:8554/other','row_version':changed['row_version']}).json()
    assert stored()['password']==' pass with spaces '
    changed=admin.patch(API+'/sources/'+source_id,json={'password':'','row_version':changed['row_version']}).json()
    assert stored()=={'username':' operator ','password':''}
    assert 'pass with spaces' not in admin.get(API+'/logs').text

@pytest.mark.parametrize('role',['viewer','operator'])
def test_role_boundaries_and_media_auth(admin,app,role):
    from app.shared.models import User
    with app.state.sessions() as db:
        user=db.scalar(select(User))
        user.role=role
        db.commit()
    settings=admin.get(API+'/settings/general').json()
    assert admin.patch(API+'/settings/general',json={'values':{'system_name':'forbidden'},'row_version':settings['row_version']}).status_code==403
    created=admin.post(API+'/sources',json={'name':'test','kind':'camera','address':'rtsp://127.0.0.1/live'})
    assert created.status_code==(403 if role=='viewer' else 200)


def test_database_and_session_survive_app_restart(admin,app):
    from app.main import create_app
    source=admin.post(API+'/sources',json={'name':'persistent','kind':'camera','address':'rtsp://127.0.0.1/live'}).json()
    other=create_app(var_root=app.state.config.var_root,testing=True)
    with TestClient(other) as restarted:
        restarted.cookies.update(admin.cookies)
        assert restarted.get(API+'/auth/setup-status').json()['initialized'] is True
        assert restarted.get(API+'/auth/me').json()['username']=='admin'
        assert restarted.get(API+'/sources/'+source['id']).json()['name']=='persistent'


def test_expired_session_denies_api_and_websocket(admin,app):
    from app.shared.models import Session
    from starlette.websockets import WebSocketDisconnect
    with app.state.sessions() as db:
        session=db.scalar(select(Session))
        session.expires_at='2000-01-01T00:00:00Z'
        db.commit()
    assert admin.get(API+'/auth/me').status_code==401
    with pytest.raises(WebSocketDisconnect):
        with admin.websocket_connect(API+'/ws'):
            pass


def test_unauthenticated_and_foreign_origin_websockets_are_denied(admin,app):
    from starlette.websockets import WebSocketDisconnect
    with TestClient(app) as anonymous:
        with pytest.raises(WebSocketDisconnect):
            with anonymous.websocket_connect(API+'/ws'):
                pass
    with pytest.raises(WebSocketDisconnect):
        with admin.websocket_connect(API+'/ws',headers={'origin':'https://attacker.invalid'}):
            pass


def test_worker_claim_enforces_global_concurrency_and_recovers_lease(admin,app):
    from app.shared.models import Job
    from worker.supervisor import Supervisor
    source=admin.post(API+'/sources',json={'name':'one','kind':'camera','address':'rtsp://127.0.0.1:1/live'}).json()
    first=admin.post(API+'/sources/'+source['id']+'/tests').json()
    source2=admin.post(API+'/sources',json={'name':'two','kind':'camera','address':'rtsp://127.0.0.1:1/live'}).json()
    second=admin.post(API+'/sources/'+source2['id']+'/tests').json()
    a,b=Supervisor(app.state.config),Supervisor(app.state.config)
    assert a.claim()==first['id']
    assert b.claim() is None
    with app.state.sessions() as db:
        job=db.get(Job,first['id'])
        job.lease_until=time.time()-1
        db.commit()
    assert b.claim()==first['id']
    with app.state.sessions() as db:
        job=db.get(Job,first['id'])
        assert job.attempts==2
        assert job.lease_owner==b.id
    a.engine.dispose()
    b.engine.dispose()


def test_source_connection_edit_cancels_queued_old_configuration(admin):
    source=admin.post(API+'/sources',json={'name':'camera','kind':'camera','address':'rtsp://127.0.0.1:1/live'}).json()
    job=admin.post(API+'/sources/'+source['id']+'/tests').json()
    latest=admin.get(API+'/sources/'+source['id']).json()
    changed=admin.patch(API+'/sources/'+source['id'],json={'address':'rtsp://127.0.0.1:2/live','row_version':latest['row_version']}).json()
    assert changed['status']=='unverified'
    assert admin.get(API+'/source-tests/'+job['id']).json()['state']=='canceled'

class RTSPServer(socketserver.ThreadingTCPServer):
    allow_reuse_address=True
    daemon_threads=True
    def __exit__(self, *args):
        self.shutdown()
        return super().__exit__(*args)

class SDPHandler(socketserver.BaseRequestHandler):
    def handle(self):
        self.request.recv(65536)
        body=b'v=0\r\nm=video 0 RTP/AVP 96\r\na=rtpmap:96 H264/90000\r\n'
        self.request.sendall(b'RTSP/1.0 200 OK\r\nContent-Type: application/sdp\r\nContent-Length: '+str(len(body)).encode()+b'\r\n\r\n'+body)


def test_rtsp_reachability_never_claims_decoded_or_online_media(admin,app):
    from worker.supervisor import Supervisor
    with RTSPServer(('127.0.0.1',0),SDPHandler) as server:
        thread=threading.Thread(target=server.serve_forever,daemon=True)
        thread.start()
        source=admin.post(API+'/sources',json={'name':'RTSP fixture','kind':'camera','address':f'rtsp://127.0.0.1:{server.server_address[1]}/stream'}).json()
        job=admin.post(API+'/sources/'+source['id']+'/tests').json()
        supervisor=Supervisor(app.state.config)
        assert supervisor.run_once()
        result=admin.get(API+'/sources/'+source['id']).json()
        assert result['status']=='unverified'
        assert result['error_code']=='media_gateway_unavailable'
        test=admin.get(API+'/source-tests/'+job['id']).json()
        assert test['state']=='completed'
        assert 'RTSP' in test['message']
        assert admin.post(API+'/sources/'+source['id']+'/preview-sessions').status_code==503
        server.shutdown()
        supervisor.engine.dispose()


def test_rtsp_401_and_redirect_are_distinguished_without_credentials_in_logs(admin,app):
    from worker.supervisor import Supervisor
    class Handler(socketserver.BaseRequestHandler):
        def handle(self):
            self.request.recv(65536)
            self.request.sendall(self.server.response)
    for response,code in [(b'RTSP/1.0 401 Unauthorized\r\nContent-Length: 0\r\n\r\n','camera_authentication_required'),(b'RTSP/1.0 302 Redirect\r\nLocation: rtsp://8.8.8.8/forbidden\r\nContent-Length: 0\r\n\r\n','camera_redirect_blocked')]:
        with RTSPServer(('127.0.0.1',0),Handler) as server:
            server.response=response
            threading.Thread(target=server.serve_forever,daemon=True).start()
            source=admin.post(API+'/sources',json={'name':'camera','kind':'camera','address':f'rtsp://127.0.0.1:{server.server_address[1]}/live'}).json()
            job=admin.post(API+'/sources/'+source['id']+'/tests').json()
            supervisor=Supervisor(app.state.config)
            assert supervisor.run_once()
            assert admin.get(API+'/source-tests/'+job['id']).json()['error_code']==code
            server.shutdown()
            supervisor.engine.dispose()


def tools():
    root=Path(__file__).resolve().parents[2]
    ffmpeg=os.environ.get('VISION_FFMPEG') or shutil.which('ffmpeg') or str(root/'var/tools/ffmpeg/bin/ffmpeg.exe')
    ffprobe=os.environ.get('VISION_FFPROBE') or shutil.which('ffprobe') or str(root/'var/tools/ffmpeg/bin/ffprobe.exe')
    if not Path(ffmpeg).is_file() or not Path(ffprobe).is_file():
        pytest.skip('Real FFmpeg/FFprobe not installed; set VISION_FFMPEG and VISION_FFPROBE')
    return ffmpeg,ffprobe


def test_real_video_import_sha256_range_thumbnail_and_private_media(admin,app,tmp_path):
    import hashlib
    from worker.supervisor import Supervisor
    ffmpeg,ffprobe=tools()
    app.state.config.ffmpeg,app.state.config.ffprobe=ffmpeg,ffprobe
    fixture=tmp_path/'fixture.mp4'
    subprocess.run([ffmpeg,'-v','error','-y','-f','lavfi','-i','color=c=blue:s=160x120:r=10','-t','0.5','-c:v','libx264','-pix_fmt','yuv420p',str(fixture)],check=True,capture_output=True,timeout=30)
    data=fixture.read_bytes()
    ids=[]
    for _ in range(2):
        upload=admin.post(API+'/uploads',json={'filename':'same.mp4','size_bytes':len(data)}).json()
        assert admin.put(API+'/uploads/'+upload['id']+'/chunks/0',content=data).status_code==200
        queued=admin.post(API+'/uploads/'+upload['id']+'/complete',json={}).json()
        supervisor=Supervisor(app.state.config)
        assert supervisor.run_once()
        supervisor.engine.dispose()
        imported=admin.get(API+'/uploads/'+upload['id']).json()
        assert imported['state']=='ready',imported
        source=admin.get(API+'/sources/'+queued['source_id']).json()
        ids.append(source['id'])
        assert source['sha256']==hashlib.sha256(data).hexdigest()
        assert source['width']==160 and source['height']==120
        assert source['duration_ms']==500
        assert source['preview_url']==API+'/sources/'+source['id']+'/media'
        assert 'media_key' not in source
        ranged=admin.get(source['preview_url'],headers={'Range':'bytes=0-31'})
        assert ranged.status_code==206
        assert len(ranged.content)==32
        assert ranged.headers['content-range'].startswith('bytes 0-31/')
        assert admin.get(source['thumbnail_url']).headers['content-type']=='image/jpeg'
        with TestClient(app) as anonymous:
            assert anonymous.get(source['preview_url']).status_code==401
            assert anonymous.get(source['thumbnail_url']).status_code==401
    assert ids[0]!=ids[1]

def test_rtsp_basic_auth_preserves_exact_credential_bytes(admin,app):
    from worker.supervisor import Supervisor
    expected='Basic '+base64.b64encode('operator: spaced password '.encode()).decode()
    class Handler(socketserver.BaseRequestHandler):
        def handle(self):
            request=self.request.recv(65536).decode()
            if 'Authorization: '+expected+'\r\n' not in request:
                self.request.sendall(b'RTSP/1.0 401 Unauthorized\r\nWWW-Authenticate: Basic realm="camera"\r\nContent-Length: 0\r\n\r\n')
            else:
                body=b'v=0\r\nm=video 0 RTP/AVP 96\r\n'
                self.request.sendall(b'RTSP/1.0 200 OK\r\nContent-Length: '+str(len(body)).encode()+b'\r\n\r\n'+body)
    with RTSPServer(('127.0.0.1',0),Handler) as server:
        threading.Thread(target=server.serve_forever,daemon=True).start()
        source=admin.post(API+'/sources',json={'name':'auth camera','kind':'camera','address':f'rtsp://127.0.0.1:{server.server_address[1]}/live','username':'operator','password':' spaced password '}).json()
        job=admin.post(API+'/sources/'+source['id']+'/tests').json()
        supervisor=Supervisor(app.state.config)
        assert supervisor.run_once()
        assert admin.get(API+'/source-tests/'+job['id']).json()['state']=='completed'
        assert admin.get(API+'/sources/'+source['id']).json()['status']=='unverified'
        supervisor.engine.dispose()


def test_rtsp_timeout_is_a_total_deadline_not_reset_by_each_byte():
    from worker.camera import describe
    from worker.media import MediaFailure
    class SlowHandler(socketserver.BaseRequestHandler):
        def handle(self):
            self.request.recv(65536)
            response=b'RTSP/1.0 200 OK\r\nContent-Length: 29\r\n\r\nv=0\r\nm=video 0 RTP/AVP 96\r\n'
            try:
                for position in range(0,len(response),4):
                    self.request.sendall(response[position:position+4])
                    time.sleep(0.04)
            except OSError:
                pass
    with RTSPServer(('127.0.0.1',0),SlowHandler) as server:
        threading.Thread(target=server.serve_forever,daemon=True).start()
        started=time.monotonic()
        with pytest.raises(MediaFailure) as caught:
            describe(f'rtsp://127.0.0.1:{server.server_address[1]}/live',{},['127.0.0.0/8'],0.1)
        assert caught.value.code=='camera_connection_failed'
        assert time.monotonic()-started<0.4


def test_missing_media_tools_produces_actionable_dependency_error(admin,app):
    from worker.supervisor import Supervisor
    app.state.config.ffprobe='vision-nonexistent-ffprobe-binary'
    upload=admin.post(API+'/uploads',json={'filename':'clip.mp4','size_bytes':3}).json()
    admin.put(API+'/uploads/'+upload['id']+'/chunks/0',content=b'abc')
    admin.post(API+'/uploads/'+upload['id']+'/complete',json={})
    supervisor=Supervisor(app.state.config)
    assert supervisor.run_once()
    result=admin.get(API+'/uploads/'+upload['id']).json()
    assert result['state']=='failed' and result['error_code']=='dependency_unavailable'
    assert admin.get(API+'/health/ready').json()['status']=='ready'
    supervisor.engine.dispose()

def test_archiving_submitted_file_terminalizes_upload_and_job(admin,app):
    from app.shared.models import Job
    upload=admin.post(API+'/uploads',json={'filename':'pending.mp4','size_bytes':3}).json()
    admin.put(API+'/uploads/'+upload['id']+'/chunks/0',content=b'abc')
    submitted=admin.post(API+'/uploads/'+upload['id']+'/complete',json={}).json()
    assert admin.post(API+'/sources/'+submitted['source_id']+'/archive').status_code==204
    assert admin.get(API+'/uploads/'+upload['id']).json()['state']=='canceled'
    with app.state.sessions() as db:
        assert db.scalar(select(Job).where(Job.upload_id==upload['id'])).state=='canceled'


def test_expired_lease_cannot_be_revived_by_stale_owner_heartbeat(admin,app):
    from app.shared.models import Job
    from worker.supervisor import Supervisor
    source=admin.post(API+'/sources',json={'name':'camera','kind':'camera','address':'rtsp://127.0.0.1:1/live'}).json()
    job=admin.post(API+'/sources/'+source['id']+'/tests').json()
    supervisor=Supervisor(app.state.config)
    assert supervisor.claim()==job['id']
    with app.state.sessions() as db:
        db.get(Job,job['id']).lease_until=time.time()-1
        db.commit()
    supervisor.heartbeat()
    with app.state.sessions() as db:
        assert supervisor.owned(db,job['id']) is None
        assert db.get(Job,job['id']).lease_until<time.time()
    supervisor.engine.dispose()


def test_corrupted_camera_ciphertext_fails_actionably_without_crashing_worker(admin,app):
    from app.shared.models import Source
    from worker.supervisor import Supervisor
    source=admin.post(API+'/sources',json={'name':'camera','kind':'camera','address':'rtsp://127.0.0.1:1/live'}).json()
    with app.state.sessions() as db:
        db.get(Source,source['id']).credentials='corrupted-ciphertext'
        db.commit()
    job=admin.post(API+'/sources/'+source['id']+'/tests').json()
    supervisor=Supervisor(app.state.config)
    assert supervisor.run_once()
    result=admin.get(API+'/source-tests/'+job['id']).json()
    assert result['state']=='failed' and result['error_code']=='credentials_unavailable'
    assert 'corrupted-ciphertext' not in admin.get(API+'/logs').text
    supervisor.engine.dispose()

def test_corrupted_camera_credentials_can_be_replaced_without_old_key(admin,app):
    from app.shared.models import Source
    source=admin.post(API+'/sources',json={'name':'camera','kind':'camera','address':'rtsp://127.0.0.1:1/live'}).json()
    with app.state.sessions() as db:
        db.get(Source,source['id']).credentials='invalid-ciphertext'
        db.commit()
    response=admin.patch(API+'/sources/'+source['id'],json={'username':'new-user','password':' new-password ','row_version':source['row_version']})
    assert response.status_code==200,response.text
    with app.state.sessions() as db:
        assert app.state.vault.decrypt(db.get(Source,source['id']).credentials)=={'username':'new-user','password':' new-password '}

def test_source_query_matches_name_or_redacted_camera_address(admin):
    first=admin.post(API+'/sources',json={'name':'north entrance','kind':'camera','address':'rtsp://secret-user:secret-password@127.0.0.1:8554/loading-bay'}).json()
    second=admin.post(API+'/sources',json={'name':'loading-bay recorder','kind':'camera','address':'rtsp://127.0.0.1:8554/other'}).json()
    result=admin.get(API+'/sources',params={'q':'loading-bay'}).json()
    assert {source['id'] for source in result['items']}=={first['id'],second['id']}
    assert admin.get(API+'/sources',params={'q':'secret-password'}).json()['items']==[]
    assert admin.get(API+'/sources',params={'q':'secret-user'}).json()['items']==[]
