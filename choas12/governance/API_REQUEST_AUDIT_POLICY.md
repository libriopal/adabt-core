# API Request Audit Policy

## Principle

An LLM request is a system action. It must be governed, attributable, replayable, and auditable.

## Before Dispatch

The proxy must verify:

- phase id exists
- task id exists
- agent role is known
- model is allowlisted
- prompt hash matches the request body
- request purpose is explicit
- mutation intent is declared
- deployment impact is declared
- memory impact is declared
- approval state is not falsely elevated

## After Dispatch

The proxy must record:

- audit id
- timestamp
- phase id
- task id
- agent role
- model
- prompt hash
- dispatch mode
- response status
- scrubbed error details if any

## Forbidden

- storing raw API keys
- logging authorization headers
- logging full secrets from prompts
- forwarding ungoverned requests
- allowing deployment-impacting requests with `approval_state=PASS` unless CodeRabbit actually passed the phase
