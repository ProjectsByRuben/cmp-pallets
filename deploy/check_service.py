"""Smoke-test a Pallets upstream without credentials, PINs or business writes.

The HTTPS forwarding headers simulate the trusted entry proxy while connecting
to its LAN HTTP upstream. Only an anonymous session cookie is held in memory.
"""

import argparse
import http.client
import json
import re
from http.cookies import SimpleCookie
from urllib.parse import urlsplit


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://127.0.0.1:4180")
    parser.add_argument("--legacy-config", action="store_true", help="Only for rollback to the previous compiled-DB image")
    parser.add_argument("--legacy-environment", action="store_true", help="Only for rollback to a runtime-config image predating environment fingerprints")
    options = parser.parse_args()
    target = urlsplit(options.url)
    assert target.scheme == "http" and target.hostname, "Supply the HTTP upstream URL"
    cookies = {}
    app_origin = "https://pallets.cmp3.es"
    app_host = "pallets.cmp3.es"
    environment = ""

    def request(path, method="GET", forwarded=False, origin=None):
        headers = {}
        if forwarded:
            headers.update({"Host": app_host, "X-Forwarded-Proto": "https"})
            if environment:
                headers["X-CMP-Environment"] = environment
            if cookies:
                headers["Cookie"] = "; ".join(f"{key}={value}" for key, value in cookies.items())
        if origin:
            headers["Origin"] = origin
        body = None
        if method == "POST":
            headers["Content-Type"] = "application/json"
            body = json.dumps({"jsonrpc": "2.0", "id": 1, "method": "call", "params": {}})
        connection = http.client.HTTPConnection(target.hostname, target.port or 80, timeout=20)
        try:
            connection.request(method, path, body=body, headers=headers)
            response = connection.getresponse()
            data = response.read()
            response_headers = dict(response.getheaders())
            for raw in response.headers.get_all("Set-Cookie", []):
                parsed = SimpleCookie(raw)
                for key, item in parsed.items():
                    if key == "session_id":
                        assert item["secure"] and item["httponly"], "Session cookie must be Secure and HttpOnly"
                        cookies[key] = item.value
            return response.status, response_headers, data
        finally:
            connection.close()

    if not options.legacy_config:
        status, headers, body = request("/runtime-config.js")
        assert status == 200 and headers.get("Cache-Control") == "no-store", "Runtime config unavailable or cached"
        prefix = b"window.CMP_CONFIG = "
        assert body.startswith(prefix), "Invalid runtime config"
        config = json.loads(body[len(prefix):].strip().removesuffix(b";"))
        assert re.fullmatch(r"[a-zA-Z0-9_-]+", config["database"]), "Invalid database config"
        environment = config.get("environment", "")
        assert (options.legacy_environment and not environment) or re.fullmatch(r"[a-f0-9]{64}", environment), "Invalid environment identity"
        app_origin = config["appOrigin"]
        public = urlsplit(app_origin)
        assert public.scheme == "https" and public.hostname
        app_host = public.netloc
    status, _, body = request("/healthz")
    assert status == 200 and body.strip() == b"ok", "Health endpoint failed"
    status, headers, body = request("/")
    assert status == 200 and b"/assets/" in body and b"/@vite/client" not in body, "Compiled frontend unavailable"
    assert "Content-Security-Policy" in headers and headers.get("X-Content-Type-Options") == "nosniff"
    asset = re.search(rb'src="(/assets/[^\"]+\.js)"', body).group(1).decode()
    status, headers, _ = request(asset)
    assert status == 200 and "immutable" in headers.get("Cache-Control", "") and "Content-Security-Policy" in headers
    assert request("/api/cmp_pallets/access/bootstrap", "POST")[0] == 403, "Direct HTTP API must be blocked"
    assert request("/api/web/dataset/call_kw", "POST", forwarded=True)[0] == 404, "Generic Odoo RPC must not be exposed"
    assert request("/api/cmp_pallets/access/bootstrap", "POST", forwarded=True, origin="https://untrusted.invalid")[0] == 403, "Foreign origin must be blocked"
    assert request("/.git/config")[0] == 404, "Private paths must not be served"
    path = "/api/session/prepare"
    for attempt in range(6):
        status, headers, _ = request(path, forwarded=True)
        if status not in (301, 302, 303, 307, 308):
            break
        redirect = urlsplit(headers["Location"])
        assert not redirect.netloc or redirect.netloc == app_host, "Unexpected session redirect"
        path = redirect.path + ("?" + redirect.query if redirect.query else "")
    assert status == 200 and cookies, "Anonymous database session could not be prepared"
    for path in ("/api/cmp_pallets/access/bootstrap", "/api/cmp_pallets/lookup", "/api/cmp_pallets/associate", "/api/cmp_pallets/move", "/api/cmp_pallets/create", "/api/cmp_pallets/label", "/api/cmp_pallets/locations"):
        status, headers, body = request(path, "POST", forwarded=True, origin=app_origin)
        data = json.loads(body)
        name = data.get("error", {}).get("data", {}).get("name", "")
        assert status == 200 and name.endswith("SessionExpiredException"), "Anonymous request reached an unexpected response"
        assert headers.get("Cache-Control") == "no-store" and "Content-Security-Policy" in headers
    print("PALLETS_SERVICE_OK: compiled frontend, limited routes, HTTPS origin, secure anonymous cookie and Odoo authentication")


if __name__ == "__main__":
    main()
