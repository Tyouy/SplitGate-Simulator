"""Loopback-only static server and hidden launcher; Python standard library only."""
from __future__ import annotations
import argparse, hashlib, http.server, json, os, socket, subprocess, sys, threading, time, urllib.error, urllib.request, webbrowser
from pathlib import Path

ROOT=Path(__file__).resolve().parent
APP_ID=hashlib.sha256(str(ROOT).lower().encode()).hexdigest()[:20]
FIRST_PORT=8765
STATE=ROOT/'.server-state.json'

def health(port):
    try:
        request=urllib.request.Request(f'http://127.0.0.1:{port}/__health')
        opener=urllib.request.build_opener(urllib.request.ProxyHandler({}))
        with opener.open(request,timeout=.3) as response:
            data=json.load(response)
        return data.get('app')=='split-gate-simulator' and data.get('id')==APP_ID
    except (OSError,ValueError,urllib.error.URLError):return False

def existing_port():
    try:
        port=json.loads(STATE.read_text())['port']
        if isinstance(port,int) and health(port):return port
    except (OSError,ValueError,KeyError):pass
    return None

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self,*args,**kwargs):super().__init__(*args,directory=str(ROOT),**kwargs)
    def end_headers(self):
        self.send_header('Cache-Control','no-store')
        self.send_header('X-Content-Type-Options','nosniff')
        super().end_headers()
    def do_GET(self):
        if self.path=='/__health':
            body=json.dumps({'app':'split-gate-simulator','id':APP_ID,'port':self.server.server_port}).encode()
            self.send_response(200);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)
        else:super().do_GET()
    def do_POST(self):
        if self.path!='/__stop' or self.headers.get('X-Split-Gate-ID')!=APP_ID:
            self.send_error(403);return
        self.send_response(200);self.send_header('Content-Length','0');self.end_headers()
        threading.Thread(target=self.server.shutdown,daemon=True).start()

def serve(port):
    server=http.server.ThreadingHTTPServer(('127.0.0.1',port),Handler)
    STATE.write_text(json.dumps({'port':server.server_port,'pid':os.getpid(),'id':APP_ID}))
    try:server.serve_forever()
    finally:
        server.server_close()
        try:
            if json.loads(STATE.read_text()).get('pid')==os.getpid():STATE.unlink()
        except (OSError,ValueError):pass

def launch(open_browser=True):
    port=existing_port()
    if not port:
        for candidate in range(FIRST_PORT,FIRST_PORT+40):
            if health(candidate):port=candidate;break
            try:
                with socket.socket() as sock:sock.bind(('127.0.0.1',candidate))
            except OSError:continue
            port=candidate;break
        if not port:raise RuntimeError('No free local port in 8765-8804.')
        if not health(port):
            logdir=ROOT/'logs';logdir.mkdir(exist_ok=True)
            kwargs={'creationflags':subprocess.CREATE_NO_WINDOW} if os.name=='nt' else {'start_new_session':True}
            with (logdir/'server.log').open('ab') as log:
                process=subprocess.Popen([sys.executable,str(ROOT/'server.py'),'--serve','--port',str(port)],cwd=ROOT,stdin=subprocess.DEVNULL,stdout=log,stderr=subprocess.STDOUT,**kwargs)
            for _ in range(80):
                if health(port):break
                if process.poll() is not None:raise RuntimeError('Local server failed; see logs/server.log.')
                time.sleep(.1)
            else:raise RuntimeError('Local server did not become ready; see logs/server.log.')
    url=f'http://127.0.0.1:{port}/'
    if open_browser:webbrowser.open(url)
    print(url)
    return url

def stop():
    port=existing_port()
    if not port:print('No running server for this folder.');return
    request=urllib.request.Request(f'http://127.0.0.1:{port}/__stop',method='POST',headers={'X-Split-Gate-ID':APP_ID})
    opener=urllib.request.build_opener(urllib.request.ProxyHandler({}))
    with opener.open(request,timeout=3):pass
    print('Local simulator server stopped.')

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--serve',action='store_true');parser.add_argument('--port',type=int,default=FIRST_PORT);parser.add_argument('--no-browser',action='store_true');parser.add_argument('--stop',action='store_true');args=parser.parse_args()
    try:
        if args.serve:serve(args.port)
        elif args.stop:stop()
        else:launch(not args.no_browser)
    except Exception as error:
        print('ERROR:',error,file=sys.stderr);sys.exit(1)
