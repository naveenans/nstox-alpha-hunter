#!/usr/bin/env python3
"""NSTOX ALPHA HUNTER — static files + FYERS OAuth / data proxy."""
from __future__ import annotations

import hashlib
import json
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent
FYERS = "https://api-t1.fyers.in"
PORT = 8080


def sha256hex(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def fyers_call(method: str, path: str, *, headers=None, body: bytes | None = None):
    req = Request(FYERS + path, data=body, method=method)
    req.add_header("Accept", "application/json")
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    try:
        with urlopen(req, timeout=20) as res:
            raw = res.read()
            return res.status, raw
    except HTTPError as e:
        return e.code, e.read()
    except URLError as e:
        return 502, json.dumps({"s": "error", "message": str(e.reason)}).encode()


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, fmt, *args):
        if "/api/fyers" in (args[0] if args else ""):
            super().log_message("%s", args[0].split("?")[0] if args else fmt)
            return
        super().log_message(fmt, *args)

    def _json(self, status: int, payload):
        data = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _body(self) -> dict:
        n = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(n) if n else b"{}"
        try:
            return json.loads(raw.decode() or "{}")
        except json.JSONDecodeError:
            return {}

    def do_OPTIONS(self):
        if self.path.startswith("/api/fyers"):
            self.send_response(204)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Headers", "authorization, content-type")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.end_headers()
            return
        self.send_error(404)

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/fyers/token":
            p = self._body()
            app_id, secret, code = p.get("appId", "").strip(), p.get("secretId", "").strip(), (p.get("authCode") or p.get("code") or "").strip()
            if not app_id or not secret or not code:
                return self._json(400, {"s": "error", "message": "App ID, Secret ID and auth code are required"})
            body = json.dumps({
                "grant_type": "authorization_code",
                "appIdHash": sha256hex(f"{app_id}:{secret}"),
                "code": code,
            }).encode()
            status, raw = fyers_call("POST", "/api/v3/validate-authcode", headers={"Content-Type": "application/json"}, body=body)
            try:
                return self._json(status, json.loads(raw.decode() or "{}"))
            except json.JSONDecodeError:
                return self._json(status, {"s": "error", "message": raw.decode()[:400]})
        if parsed.path == "/api/fyers/refresh":
            p = self._body()
            app_id, secret, refresh, pin = p.get("appId", "").strip(), p.get("secretId", "").strip(), p.get("refreshToken", "").strip(), p.get("pin", "").strip()
            if not all([app_id, secret, refresh, pin]):
                return self._json(400, {"s": "error", "message": "App ID, Secret ID, refresh token and PIN are required"})
            body = json.dumps({
                "grant_type": "refresh_token",
                "appIdHash": sha256hex(f"{app_id}:{secret}"),
                "refresh_token": refresh,
                "pin": pin,
            }).encode()
            status, raw = fyers_call("POST", "/api/v3/validate-refresh-token", headers={"Content-Type": "application/json"}, body=body)
            try:
                return self._json(status, json.loads(raw.decode() or "{}"))
            except json.JSONDecodeError:
                return self._json(status, {"s": "error", "message": raw.decode()[:400]})
        return self.send_error(404)

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/fyers/health":
            return self._json(200, {"ok": True, "proxy": True, "service": "NSTOX ALPHA HUNTER"})
        routes = {
            "/api/fyers/profile": "/api/v3/profile",
            "/api/fyers/quotes": "/data/quotes",
            "/api/fyers/history": "/data/history",
            "/api/fyers/depth": "/data/depth",
            "/api/fyers/option-chain": "/data/options-chain-v3",
            "/api/fyers/market-status": "/data/marketStatus",
        }
        if parsed.path in routes:
            auth = self.headers.get("Authorization", "")
            if not auth:
                return self._json(401, {"s": "error", "message": "Missing Authorization"})
            path = routes[parsed.path]
            if parsed.query:
                path = f"{path}?{parsed.query}"
            status, raw = fyers_call("GET", path, headers={"Authorization": auth})
            try:
                return self._json(status, json.loads(raw.decode() or "{}"))
            except json.JSONDecodeError:
                return self._json(status, {"s": "error", "message": raw.decode()[:400]})
        return super().do_GET()


if __name__ == "__main__":
    httpd = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print(f"NSTOX ALPHA HUNTER at http://127.0.0.1:{PORT}")
    httpd.serve_forever()
