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
    options = parser.parse_args()
    target = urlsplit(options.url)
    assert target.scheme == "http" and target.hostname, "Supply the HTTP upstream URL"
    cookies = {}

    def request(path, method="GET", forwarded=False, origin=None):
        headers = {}
        if forwarded:
            headers.update({"Host": "pallets.cmp3.es", "X-Forwarded-Proto": "https"})
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
        assert not redirect.netloc or redirect.netloc == "pallets.cmp3.es", "Unexpected session redirect"
        path = redirect.path + ("?" + redirect.query if redirect.query else "")
    assert status == 200 and cookies, "Anonymous database session could not be prepared"
    for path in ("/api/cmp_pallets/access/bootstrap", "/api/cmp_pallets/lookup", "/api/cmp_pallets/associate", "/api/cmp_pallets/move", "/api/cmp_pallets/create", "/api/cmp_pallets/label", "/api/cmp_pallets/locations"):
        status, headers, body = request(path, "POST", forwarded=True, origin="https://pallets.cmp3.es")
        data = json.loads(body)
        name = data.get("error", {}).get("data", {}).get("name", "")
        assert status == 200 and name.endswith("SessionExpiredException"), "Anonymous request reached an unexpected response"
        assert headers.get("Cache-Control") == "no-store" and "Content-Security-Policy" in headers
    print("PALLETS_SERVICE_OK: compiled frontend, limited routes, HTTPS origin, secure anonymous cookie and Odoo authentication")


if __name__ == "__main__":
    main()
