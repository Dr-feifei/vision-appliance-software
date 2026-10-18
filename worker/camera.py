"""RTSP control-plane connectivity checks with pinned IPs and no redirect following."""
import base64
import hashlib
import re
import secrets
import socket
import ssl
import time
from urllib.parse import urlsplit
from app.shared.security import camera_address
from app.shared.errors import Error
from .media import MediaFailure

def describe(address,credentials,networks,timeout):
    deadline = time.monotonic()+timeout
    def remaining():
        duration = deadline-time.monotonic()
        if duration<=0:
            raise socket.timeout()
        return duration
    try:
        address,_,ip = camera_address(address,networks)
    except Error:
        raise MediaFailure('camera_address_forbidden','摄像头地址已不在允许网段内，请检查安全设置。')
    parts = urlsplit(address)
    port = parts.port or (322 if parts.scheme=='rtsps' else 554)
    def request(authorization=None):
        sock = socket.create_connection((ip,port),timeout=remaining())
        try:
            if parts.scheme=='rtsps':
                sock.settimeout(remaining())
                sock = ssl.create_default_context().wrap_socket(sock,server_hostname=parts.hostname)
            lines = [f'DESCRIBE {address} RTSP/1.0','CSeq: 1','Accept: application/sdp','User-Agent: VisionAppliance/0.1']
            if authorization:
                lines.append('Authorization: '+authorization)
            sock.settimeout(remaining())
            sock.sendall(('\r\n'.join(lines)+'\r\n\r\n').encode())
            response = bytearray()
            while b'\r\n\r\n' not in response:
                sock.settimeout(remaining())
                chunk = sock.recv(4096)
                if not chunk or len(response)>65536:
                    raise ValueError()
                response.extend(chunk)
            header,body = bytes(response).split(b'\r\n\r\n',1)
            rows = header.decode('iso-8859-1').split('\r\n')
            match = re.match(r'RTSP/1\.[01] (\d{3})',rows[0])
            if not match:
                raise ValueError()
            headers = dict(row.split(':',1) for row in rows[1:] if ':' in row)
            headers = {k.lower().strip():v.strip() for k,v in headers.items()}
            length = int(headers.get('content-length','0'))
            if length<0 or length>1024*1024:
                raise ValueError()
            while len(body)<length:
                sock.settimeout(remaining())
                chunk = sock.recv(min(8192,length-len(body)))
                if not chunk:
                    raise ValueError()
                body += chunk
            return int(match.group(1)),headers,body
        finally:
            sock.close()
    try:
        status,headers,body = request()
        if status==401 and credentials.get('username'):
            challenge = headers.get('www-authenticate','')
            username,password = credentials['username'],credentials.get('password','')
            if challenge.lower().startswith('basic'):
                authorization = 'Basic '+base64.b64encode(f'{username}:{password}'.encode()).decode()
            elif challenge.lower().startswith('digest'):
                params = {m[0]:m[1] or m[2] for m in re.findall(r'(\w+)=(?:"([^"]*)"|([^,\s]+))',challenge[6:])}
                realm,nonce = params.get('realm',''),params.get('nonce','')
                algorithm = params.get('algorithm','MD5').upper()
                if algorithm not in ('MD5','SHA-256'):
                    raise MediaFailure('camera_auth_unsupported','摄像头认证算法暂不支持，请通过媒体网关接入。')
                hashfn = lambda value: hashlib.new('md5' if algorithm=='MD5' else 'sha256',value.encode()).hexdigest()
                a1,a2 = hashfn(f'{username}:{realm}:{password}'),hashfn('DESCRIBE:'+address)
                qop = 'auth' if 'auth' in [item.strip() for item in params.get('qop','').split(',')] else None
                cnonce,nc = secrets.token_hex(8),'00000001'
                response_hash = hashfn(f'{a1}:{nonce}:{nc}:{cnonce}:auth:{a2}') if qop else hashfn(f'{a1}:{nonce}:{a2}')
                safe = lambda v: v.replace('\\','\\\\').replace('"','\\"').replace('\r','').replace('\n','')
                authorization = f'Digest username="{safe(username)}", realm="{safe(realm)}", nonce="{safe(nonce)}", uri="{safe(address)}", response="{response_hash}", algorithm={algorithm}'
                if qop:
                    authorization += f', qop=auth, nc={nc}, cnonce="{cnonce}"'
                if 'opaque' in params:
                    authorization += ', opaque="'+safe(params['opaque'])+'"'
            else:
                raise MediaFailure('camera_auth_unsupported','摄像头认证方式暂不支持，请通过媒体网关接入。')
            status,headers,body = request(authorization)
        if status==401:
            raise MediaFailure('camera_authentication_required','摄像头明确返回 RTSP 401，请检查认证信息及访问权限。')
        if 300<=status<400:
            raise MediaFailure('camera_redirect_blocked','摄像头返回重定向；为保持网段限制，请使用最终摄像头地址。')
        if status!=200 or b'm=video' not in body:
            raise MediaFailure('camera_protocol_error','摄像头未返回可用的视频会话描述，请检查地址与 RTSP 服务。')
    except (OSError,ValueError,UnicodeError):
        raise MediaFailure('camera_connection_failed','摄像头连接失败或响应超时，请检查网络、端口和 RTSP 服务；尚不能判断认证原因。')
