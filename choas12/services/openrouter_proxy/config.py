"""Configuration for the governed OpenRouter proxy bridge."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class ProxyConfig:
    api_key: str
    base_url: str
    allowed_models: tuple[str, ...]
    audit_log_path: Path
    dry_run_default: bool

    @classmethod
    def from_env(cls) -> "ProxyConfig":
        allowed = tuple(
            model.strip()
            for model in os.getenv("OPENROUTER_ALLOWED_MODELS", "openrouter/auto").split(",")
            if model.strip()
        )
        return cls(
            api_key=os.getenv("OPENROUTER_API_KEY", ""),
            base_url=os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1"),
            allowed_models=allowed,
            audit_log_path=Path(os.getenv("OPENROUTER_AUDIT_LOG", ".openrouter-audit.jsonl")),
            dry_run_default=os.getenv("OPENROUTER_PROXY_DRY_RUN", "true").lower()
            in {"1", "true", "yes", "on"},
        )


def public_config(config: ProxyConfig) -> dict[str, object]:
    """Return config that is safe to expose in healthchecks and audit manifests."""

    return {
        "base_url": config.base_url,
        "allowed_models": list(config.allowed_models),
        "audit_log_path": str(config.audit_log_path),
        "dry_run_default": config.dry_run_default,
        "api_key_present": bool(config.api_key),
    }
