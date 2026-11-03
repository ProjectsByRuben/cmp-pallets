"""Exercise TLS verification and origin translation with isolated Docker fixtures.

Run after building the web image: python3 deploy/test_https_proxy.py
No requests reach Odoo and no credentials or business records are used.
"""
import json
import os
from pathlib import Path
import subprocess
import tempfile
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from uuid import uuid4


def docker(*args):
    return subprocess.check_output(["docker", *args], text=True, stderr=subprocess.STDOUT).strip()


def main():
    network = "cmp-proxy-fixture-" + uuid4().hex[:10]
    containers = []
    environments = {}
    backend_image = os.environ.get("CMP_PROXY_TEST_BACKEND_IMAGE", "doodba-cmp-odoo")
    web_image = os.environ.get("CMP_PROXY_TEST_IMAGE", "cmp-pallets-web:local")
    with tempfile.TemporaryDirectory(prefix="cmp-proxy-fixture-") as temporary:
        folder = Path(temporary)
        folder.chmod(0o755)
        subprocess.run(["openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1",
                        "-keyout", str(folder / "key.pem"), "-out", str(folder / "cert.pem"),
                        "-subj", "/CN=fixture-odoo", "-addext", "subjectAltName=DNS:fixture-odoo"],
                       check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        (folder / "key.pem").chmod(0o644)  # Disposable test key, never a real credential.
        (folder / "backend.py").write_text('''import json,ssl
from http.server import BaseHTTPRequestHandler,HTTPServer
class Handler(BaseHTTPRequestHandler):
 def log_message(self,*args): pass
 def respond(self):
  length=int(self.headers.get('Content-Length','0'))
  body=self.rfile.read(length).decode() if length else ''
  data={'path':self.path,'host':self.headers.get('Host'),'origin':self.headers.get('Origin'),
        'forwarded_host':self.headers.get('X-Forwarded-Host'),'sni':getattr(self.connection,'fixture_sni',None),'body':body}
  self.send_response(200)
  self.send_header('Content-Type','application/json')
  self.send_header('Set-Cookie','session_id=fixture-only; Path=/')
  self.end_headers();self.wfile.write(json.dumps(data).encode())
 do_GET=respond
 do_POST=respond
server=HTTPServer(('0.0.0.0',8443),Handler)
context=ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
context.load_cert_chain('/fixtures/cert.pem','/fixtures/key.pem')
context.set_servername_callback(lambda sock,name,ctx:setattr(sock,'fixture_sni',name))
server.socket=context.wrap_socket(server.socket,server_side=True)
server.serve_forever()
''')
        docker("network", "create", network)
        try:
            containers.append(docker("run", "-d", "--network", network, "--network-alias", "fixture-odoo", "--network-alias", "wrong-host.invalid",
                                     "-v", f"{folder}:/fixtures:ro", "--entrypoint", "python3", backend_image,
                                     "-u", "/fixtures/backend.py"))

            def launch(trust=True, host="fixture-odoo", database="cmpslu", app_url="https://pallets.cmp3.es"):
                args = ["run", "-d", "--network", network, "-p", "127.0.0.1::8080",
                        "-e", f"CMP_ODOO_URL=https://{host}:8443", "-e", f"CMP_APP_URL={app_url}",
                        "-e", f"CMP_ODOO_DB={database}", "--read-only", "--tmpfs", "/tmp:rw,noexec,nosuid,mode=1777"]
                if trust:
                    args += ["-v", f"{folder / 'cert.pem'}:/etc/ssl/certs/ca-certificates.crt:ro"]
                container = docker(*args, web_image)
                containers.append(container)
                try:
                    address = docker("port", container, "8080/tcp").splitlines()[0]
                except (subprocess.CalledProcessError, IndexError) as error:
                    raise AssertionError("Fixture exited before publishing its port: " + docker("logs", container)) from error
                url = "http://" + address
                for attempt in range(40):
                    try:
                        with urlopen(url + "/healthz", timeout=1) as response:
                            if response.status == 200:
                                with urlopen(url + "/runtime-config.js", timeout=2) as config_response:
                                    payload = config_response.read().decode().removeprefix("window.CMP_CONFIG = ").strip().removesuffix(";")
                                    environments[url] = json.loads(payload)["environment"]
                                return url
                    except (URLError, TimeoutError, ConnectionError):
                        time.sleep(0.25)
                raise AssertionError("Fixture proxy did not start: " + docker("logs", container))

            def request(base, path="/api/cmp_pallets/lookup", forwarded=True, origin="https://pallets.cmp3.es", method="POST", app_host="pallets.cmp3.es", environment=None):
                headers = {"Content-Type": "application/json", "X-CMP-Environment": environment or environments[base]}
                if forwarded:
                    headers.update({"Host": app_host, "X-Forwarded-Proto": "https"})
                if origin is not None:
                    headers["Origin"] = origin
                body = b'{"jsonrpc":"2.0","params":{"code":"fixture"}}' if method == "POST" else None
                try:
                    with urlopen(Request(base + path, body, headers, method=method), timeout=10) as response:
                        return response.status, response.headers, response.read()
                except HTTPError as error:
                    return error.code, error.headers, error.read()

            base = launch()
            status, headers, body = request(base)
            data = json.loads(body)
            assert status == 200 and data["path"] == "/cmp_pallets/lookup"
            assert data["host"] == data["forwarded_host"] == "fixture-odoo:8443" and data["sni"] == "fixture-odoo"
            assert data["origin"] == "https://fixture-odoo:8443"
            assert json.loads(data["body"])["params"]["code"] == "fixture"
            cookie = headers.get("Set-Cookie", "").lower()
            assert "secure" in cookie and "httponly" in cookie and "samesite=lax" in cookie
            assert request(base, environment="0" * 64)[0] == 409, "Stale environment request reached backend"
            assert request(base, origin="https://untrusted.invalid")[0] == 403
            assert request(base, forwarded=False)[0] == 403
            assert request(base, path="/api/web/dataset/call_kw")[0] == 404
            assert json.loads(request(base, origin=None)[2])["origin"] is None
            status, _, body = request(base, path="/api/session/prepare", method="GET")
            assert status == 200 and json.loads(body)["path"] == "/web/login?db=cmpslu"
            second = launch(database="fixture_second", app_url="https://pallets-second.invalid:8444")
            status, headers, body = request(second, path="/runtime-config.js", method="GET")
            config = json.loads(body.decode().removeprefix("window.CMP_CONFIG = ").strip().removesuffix(";"))
            assert config["database"] == "fixture_second" and config["appOrigin"] == "https://pallets-second.invalid:8444"
            assert headers.get("Cache-Control") == "no-store"
            status, _, body = request(second, path="/api/session/prepare", method="GET", app_host="pallets-second.invalid:8444", origin="https://pallets-second.invalid:8444")
            assert status == 200 and json.loads(body)["path"] == "/web/login?db=fixture_second"
            assert request(second, app_host="pallets-second.invalid:8444", origin="https://pallets-second.invalid:8444", environment=environments[base])[0] == 409
            for invalid in ["http://fixture-odoo", "https://user:password@fixture-odoo", "https://fixture-odoo/path", "https://fixture-odoo:99999999999999999999999"]:
                result = subprocess.run(["docker", "run", "--rm", "-e", "CMP_ODOO_URL=" + invalid,
                    "-e", "CMP_APP_URL=https://pallets.cmp3.es", "-e", "CMP_ODOO_DB=cmpslu",
                    "--read-only", "--tmpfs", "/tmp:rw,noexec,nosuid,mode=1777", web_image, "--check"], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                assert result.returncode != 0, "Unsafe Odoo URL accepted"
            assert request(launch(trust=False))[0] == 502, "Untrusted TLS certificate was accepted"
            assert request(launch(host="wrong-host.invalid"))[0] == 502, "TLS hostname mismatch was accepted"
            print("HTTPS_PROXY_TESTS_OK: trusted TLS/SNI/Host, origin translation, foreign origin rejection, cookie flags, allowlist, database prepare, untrusted certificate and hostname rejection")
        finally:
            for container in reversed(containers):
                docker("rm", "-f", container)
            docker("network", "rm", network)


if __name__ == "__main__":
    main()
