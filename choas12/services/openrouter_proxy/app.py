"""Governed stdlib OpenRouter proxy bridge.

Run locally:
    python choas12/services/openrouter_proxy/app.py

Environment:
    OPENROUTER_API_KEY: required only when dry_run=false
    OPENROUTER_ALLOWED_MODELS: comma-separated allowlist, defaults to openrouter/auto
    OPENROUTER_PROXY_DRY_RUN: true by default
"""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any

from audit_log import AuditLog
from config import ProxyConfig, public_config
from governance_guard import GovernanceGuard
from model_policy import model_policy_report
from request_envelope import RequestEnvelope


def json_response(handler: BaseHTTPRequestHandler, status: int, payload: dict[str, Any]) -> None:
    body = json.dumps(payload, sort_keys=True).encode("utf-8")
    handler.send_response(status)
    handler.send_header("content-type", "application/json")
    handler.send_header("content-length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


class ProxyHandler(BaseHTTPRequestHandler):
    config = ProxyConfig.from_env()
    guard = GovernanceGuard(config)
    audit = AuditLog(config.audit_log_path)

    def do_GET(self) -> None:
        if self.path == "/health":
            json_response(self, 200, {"ok": True, "config": public_config(self.config)})
            return
        if self.path == "/model-policy":
            json_response(self, 200, model_policy_report(self.config))
            return
        json_response(self, 404, {"error": "not found"})

    def do_POST(self) -> None:
        if self.path != "/v1/governed-chat":
            json_response(self, 404, {"error": "not found"})
            return

        try:
            length = int(self.headers.get("content-length", "0"))
            payload = json.loads(self.rfile.read(length) or b"{}")
            dry_run = bool(payload.pop("dry_run", self.config.dry_run_default))
            envelope = RequestEnvelope.from_dict(payload)
            decision = self.guard.evaluate(envelope)
            if not decision.allowed:
                event = self.audit.record(envelope, "rejected", decision.reasons)
                json_response(self, 400, {"status": "rejected", "audit": event})
                return

            if dry_run:
                event = self.audit.record(envelope, "dry_run")
                json_response(self, 200, {"status": "dry_run", "audit": event})
                return

            response = dispatch_openrouter(self.config, envelope)
            preview = json.dumps(response)[:500]
            event = self.audit.record(envelope, "dispatched", response_preview=preview)
            json_response(self, 200, {"status": "dispatched", "audit": event, "response": response})
        except Exception as exc:
            json_response(self, 500, {"status": "error", "error": str(exc)[:500]})


def dispatch_openrouter(config: ProxyConfig, envelope: RequestEnvelope) -> dict[str, Any]:
    if not config.api_key:
        raise RuntimeError("OPENROUTER_API_KEY is required when dry_run is false")
    body = json.dumps(envelope.to_openrouter_payload()).encode("utf-8")
    request = urllib.request.Request(
        url=f"{config.base_url.rstrip('/')}/chat/completions",
        data=body,
        headers={
            "content-type": "application/json",
            "authorization": f"Bearer {config.api_key}",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:500]
        raise RuntimeError(f"OpenRouter HTTP {exc.code}: {detail}") from exc


def main() -> None:
    port = int(os.getenv("PORT", "8080"))
    server = ThreadingHTTPServer(("0.0.0.0", port), ProxyHandler)
    print(f"governed OpenRouter proxy listening on :{port}")
    server.serve_forever()


if __name__ == "__main__":
    main()
