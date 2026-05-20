"""Model policy helpers for the governed OpenRouter proxy."""

from __future__ import annotations

from config import ProxyConfig


def model_policy_report(config: ProxyConfig) -> dict[str, object]:
    return {
        "allowed_models": list(config.allowed_models),
        "default_mode": "dry_run" if config.dry_run_default else "dispatch",
        "policy": "Requests for non-allowlisted models are rejected before dispatch.",
    }
