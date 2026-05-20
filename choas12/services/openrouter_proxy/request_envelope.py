"""Governed request envelope for OpenRouter dispatch."""

from __future__ import annotations

import hashlib
import json
from dataclasses import asdict, dataclass, field
from typing import Any


Message = dict[str, str]


@dataclass
class RequestEnvelope:
    phase_id: str
    task_id: str
    agent_role: str
    model: str
    prompt_hash: str
    request_purpose: str
    allowed_tool_scope: list[str]
    mutation_intent: str
    deployment_impact: str
    memory_impact: str
    risk_level: str
    approval_state: str
    messages: list[Message]
    temperature: float | None = None
    max_tokens: int | None = None
    metadata: dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> "RequestEnvelope":
        return cls(
            phase_id=str(payload.get("phase_id", "")),
            task_id=str(payload.get("task_id", "")),
            agent_role=str(payload.get("agent_role", "")),
            model=str(payload.get("model", "")),
            prompt_hash=str(payload.get("prompt_hash", "")),
            request_purpose=str(payload.get("request_purpose", "")),
            allowed_tool_scope=list(payload.get("allowed_tool_scope", [])),
            mutation_intent=str(payload.get("mutation_intent", "")),
            deployment_impact=str(payload.get("deployment_impact", "")),
            memory_impact=str(payload.get("memory_impact", "")),
            risk_level=str(payload.get("risk_level", "")),
            approval_state=str(payload.get("approval_state", "")),
            messages=list(payload.get("messages", [])),
            temperature=payload.get("temperature"),
            max_tokens=payload.get("max_tokens"),
            metadata=dict(payload.get("metadata", {})),
        )

    def to_openrouter_payload(self) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "model": self.model,
            "messages": self.messages,
            "metadata": {
                **self.metadata,
                "phase_id": self.phase_id,
                "task_id": self.task_id,
                "agent_role": self.agent_role,
                "prompt_hash": self.prompt_hash,
                "request_purpose": self.request_purpose,
                "approval_state": self.approval_state,
            },
        }
        if self.temperature is not None:
            payload["temperature"] = self.temperature
        if self.max_tokens is not None:
            payload["max_tokens"] = self.max_tokens
        return payload

    def to_safe_dict(self) -> dict[str, Any]:
        data = asdict(self)
        data["messages"] = [
            {"role": message.get("role", ""), "content_hash": hash_text(message.get("content", ""))}
            for message in self.messages
        ]
        return data


def hash_text(text: str) -> str:
    return "sha256:" + hashlib.sha256(text.encode("utf-8")).hexdigest()


def canonical_prompt_hash(messages: list[Message]) -> str:
    canonical = json.dumps(messages, sort_keys=True, separators=(",", ":"))
    return hash_text(canonical)
