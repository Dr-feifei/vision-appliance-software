"""Run the same-origin application and its independent local media worker."""
import argparse
import os
from pathlib import Path
import signal
import socket
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[2]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--host', default='127.0.0.1')
    parser.add_argument('--port', type=int, default=8000)
    args = parser.parse_args()
    if not 1 <= args.port <= 65535:
        raise RuntimeError('Port must be between 1 and 65535.')
    if not (ROOT / 'frontend/dist/index.html').is_file():
        raise RuntimeError('Frontend build is missing; run setup.cmd first.')
    # Check before launching any child; never terminate an unrelated listener.
    with socket.socket() as sock:
        try:
            sock.bind((args.host, args.port))
        except OSError as error:
            raise RuntimeError(f'Port {args.port} is unavailable. Choose --port 8002 or inspect the existing service.') from error
    environment = dict(os.environ, PYTHONUTF8='1')
    environment['PYTHONPATH'] = os.pathsep.join([str(ROOT / 'backend'), str(ROOT)])
    environment.setdefault('VISION_VAR_ROOT', str(ROOT / 'var'))
    environment.setdefault('VISION_FRONTEND_DIST', str(ROOT / 'frontend/dist'))
    tools = ROOT / 'var/tools/ffmpeg/bin'
    suffix = '.exe' if os.name == 'nt' else ''
    for name in ('ffmpeg', 'ffprobe'):
        binary = tools / (name + suffix)
        if binary.is_file():
            environment.setdefault('VISION_' + name.upper(), str(binary))
    logs = Path(environment['VISION_VAR_ROOT']) / 'logs'
    logs.mkdir(parents=True, exist_ok=True)
    subprocess.run([sys.executable, '-m', 'alembic', '-c', 'backend/alembic.ini', 'upgrade', 'head'],
                   cwd=ROOT, env=environment, check=True)
    children = []
    handles = []
    flags = subprocess.CREATE_NEW_PROCESS_GROUP if os.name == 'nt' else 0
    try:
        for name, command in [
            ('worker', [sys.executable, '-m', 'worker.supervisor']),
            ('api', [sys.executable, '-m', 'uvicorn', 'app.main:create_app', '--factory', '--app-dir', 'backend',
                     '--host', args.host, '--port', str(args.port)]),
        ]:
            handle = (logs / f'{name}.log').open('a', encoding='utf-8')
            handles.append(handle)
            process = subprocess.Popen(command, cwd=ROOT, env=environment, stdout=handle,
                                       stderr=subprocess.STDOUT, creationflags=flags)
            children.append((name, process))
        print(f'Application: http://{args.host}:{args.port}\nLogs: {logs}\nPress Ctrl+C to stop.', flush=True)
        warned = False
        while children[-1][1].poll() is None:
            if children[0][1].poll() is not None and not warned:
                print('Media worker stopped; see worker.log. API remains available for diagnostics.', flush=True)
                warned = True
            time.sleep(.5)
        if children[-1][1].returncode:
            raise RuntimeError('API stopped unexpectedly; check api.log.')
    except KeyboardInterrupt:
        print('\nStopping application ...', flush=True)
    finally:
        for _, process in reversed(children):
            if process.poll() is None:
                try:
                    if os.name == 'nt':
                        process.send_signal(signal.CTRL_BREAK_EVENT)
                    else:
                        process.terminate()
                    process.wait(timeout=8)
                except (OSError, subprocess.TimeoutExpired):
                    if os.name == 'nt' and process.poll() is None:
                        # Windows venv launchers can have a child interpreter;
                        # terminate only the process tree we started ourselves.
                        subprocess.run(['taskkill', '/PID', str(process.pid), '/T', '/F'],
                                       capture_output=True, check=False)
                    elif process.poll() is None:
                        process.kill()
                    process.wait(timeout=5)
        for handle in handles:
            handle.close()


if __name__ == '__main__':
    try:
        main()
    except (OSError, RuntimeError, subprocess.CalledProcessError) as error:
        print(f'Start failed: {error}', file=sys.stderr)
        raise SystemExit(1)
