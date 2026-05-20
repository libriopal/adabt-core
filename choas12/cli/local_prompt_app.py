"""Local-only prompt-to-app fallback.

This tool creates a governed request envelope and manifest for audit. By default it
uses dry-run mode and does not call OpenRouter, push GitHub, or deploy Railway.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PROXY_PATH = ROOT / "services" / "openrouter_proxy"
sys.path.insert(0, str(PROXY_PATH))

from audit_log import AuditLog  # noqa: E402
from config import ProxyConfig  # noqa: E402
from governance_guard import GovernanceGuard  # noqa: E402
from request_envelope import RequestEnvelope, canonical_prompt_hash  # noqa: E402


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Governed local prompt-to-app fallback")
    parser.add_argument("--prompt", required=True, help="Path to prompt file")
    parser.add_argument("--phase-id", required=True)
    parser.add_argument("--task-id", required=True)
    parser.add_argument("--agent-role", required=True)
    parser.add_argument("--model", default="openrouter/auto")
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--dry-run", action="store_true", default=True)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    prompt_path = Path(args.prompt)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    prompt = prompt_path.read_text(encoding="utf-8")
    messages = [{"role": "user", "content": prompt}]
    envelope = RequestEnvelope(
        phase_id=args.phase_id,
        task_id=args.task_id,
        agent_role=args.agent_role,
        model=args.model,
        prompt_hash=canonical_prompt_hash(messages),
        request_purpose="local-only prompt-to-app fallback",
        allowed_tool_scope=["local_files"],
        mutation_intent="local_files",
        deployment_impact="none",
        memory_impact="local_ledger_only",
        risk_level="medium",
        approval_state="PENDING_AUDIT",
        messages=messages,
        metadata={"source_prompt": str(prompt_path)},
    )

    config = ProxyConfig.from_env()
    guard = GovernanceGuard(config)
    decision = guard.evaluate(envelope)
    audit = AuditLog(output_dir / "audit.jsonl")
    status = "dry_run" if decision.allowed else "rejected"
    event = audit.record(envelope, status, decision.reasons)

    envelope_path = output_dir / "request-envelope.json"
    manifest_path = output_dir / "manifest.json"
    envelope_path.write_text(json.dumps(envelope.to_safe_dict(), indent=2, sort_keys=True), encoding="utf-8")
    manifest = {
        "id": str(uuid.uuid4()),
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "status": "PENDING_AUDIT",
        "phase_id": args.phase_id,
        "task_id": args.task_id,
        "prompt_file": str(prompt_path),
        "envelope_file": str(envelope_path),
        "audit_id": event["audit_id"],
        "dry_run": True,
        "github_push_performed": False,
        "railway_deploy_performed": False,
        "coderabbit_pass_required": True,
    }
    manifest_path.write_text(json.dumps(manifest, indent=2, sort_keys=True), encoding="utf-8")
    print(json.dumps({"status": status, "manifest": str(manifest_path), "audit_id": event["audit_id"]}, indent=2))
    return 0 if decision.allowed else 2


if __name__ == "__main__":
    raise SystemExit(main())
