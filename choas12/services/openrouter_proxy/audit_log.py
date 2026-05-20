"""Scrubbed JSONL audit logging for governed OpenRouter requests."""

from __future__ import annotations

import json
import time
import uuid
from pathlib import Path
from typing import Any

from request_envelope import RequestEnvelope


SECRET_MARKERS = ("api_key", "authorization", "anthropic_auth_token", "openrouter_api_key", "token")


def scrub(value: Any) -> Any:
    if isinstance(value, dict):
        safe: dict[str, Any] = {}
        for key, item in value.items():
            if any(marker in key.lower() for marker in SECRET_MARKERS):
                safe[key] = "[REDACTED]"
            else:
                safe[key] = scrub(item)
        return safe
    if isinstance(value, list):
        return [scrub(item) for item in value]
    if isinstance(value, str) and ("or-" in value or "sk-" in value):
        return "[REDACTED]"
    return value


class AuditLog:
    def __init__(self, path: Path) -> None:
        self.path = path

    def record(
        self,
        envelope: RequestEnvelope,
        status: str,
        decision_reasons: tuple[str, ...] = (),
        response_preview: str = "",
        error: str = "",
    ) -> dict[str, Any]:
        event = {
            "audit_id": str(uuid.uuid4()),
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "status": status,
            "decision_reasons": list(decision_reasons),
            "request": envelope.to_safe_dict(),
            "response_preview": response_preview[:500],
            "error": error[:500],
        }
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.path.open("a", encoding="utf-8") as stream:
            stream.write(json.dumps(scrub(event), sort_keys=True) + "\n")
        return event
