"""Governance validation for OpenRouter request envelopes."""

from __future__ import annotations

from dataclasses import dataclass

from config import ProxyConfig
from request_envelope import RequestEnvelope, canonical_prompt_hash


ALLOWED_MUTATION_INTENTS = {"none", "local_files", "branch_push", "deployment", "external_system"}
ALLOWED_DEPLOYMENT_IMPACTS = {"none", "readiness_only", "may_change_runtime", "deploy"}
ALLOWED_MEMORY_IMPACTS = {"none", "local_ledger_only", "durable_memory_candidate"}
ALLOWED_RISK_LEVELS = {"low", "medium", "high", "critical"}
ALLOWED_APPROVAL_STATES = {
    "DRAFT",
    "PENDING_AUDIT",
    "VETO",
    "REPAIR_REQUIRED",
    "PASS",
    "GENERATE_AUTHORIZED",
}


@dataclass(frozen=True)
class GovernanceDecision:
    allowed: bool
    reasons: tuple[str, ...]


class GovernanceGuard:
    def __init__(self, config: ProxyConfig) -> None:
        self.config = config

    def evaluate(self, envelope: RequestEnvelope) -> GovernanceDecision:
        reasons: list[str] = []

        required = {
            "phase_id": envelope.phase_id,
            "task_id": envelope.task_id,
            "agent_role": envelope.agent_role,
            "model": envelope.model,
            "prompt_hash": envelope.prompt_hash,
            "request_purpose": envelope.request_purpose,
            "approval_state": envelope.approval_state,
        }
        for field, value in required.items():
            if not value:
                reasons.append(f"missing required field: {field}")

        if envelope.model not in self.config.allowed_models:
            reasons.append(f"model not allowlisted: {envelope.model}")

        expected_hash = canonical_prompt_hash(envelope.messages)
        if envelope.prompt_hash != expected_hash:
            reasons.append("prompt_hash does not match canonical message hash")

        if envelope.mutation_intent not in ALLOWED_MUTATION_INTENTS:
            reasons.append(f"invalid mutation_intent: {envelope.mutation_intent}")
        if envelope.deployment_impact not in ALLOWED_DEPLOYMENT_IMPACTS:
            reasons.append(f"invalid deployment_impact: {envelope.deployment_impact}")
        if envelope.memory_impact not in ALLOWED_MEMORY_IMPACTS:
            reasons.append(f"invalid memory_impact: {envelope.memory_impact}")
        if envelope.risk_level not in ALLOWED_RISK_LEVELS:
            reasons.append(f"invalid risk_level: {envelope.risk_level}")
        if envelope.approval_state not in ALLOWED_APPROVAL_STATES:
            reasons.append(f"invalid approval_state: {envelope.approval_state}")

        if envelope.deployment_impact == "deploy":
            reasons.append("deployment-impacting request is forbidden in pre-generation packet")
        if envelope.mutation_intent in {"deployment", "external_system"}:
            reasons.append("external mutation intent is forbidden in pre-generation packet")
        if envelope.approval_state == "PASS" and envelope.risk_level in {"high", "critical"}:
            reasons.append("high-risk request cannot self-declare PASS")

        return GovernanceDecision(allowed=not reasons, reasons=tuple(reasons))
