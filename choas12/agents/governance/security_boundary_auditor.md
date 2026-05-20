# Security Boundary Auditor

## Purpose

Protect secrets, auth boundaries, and external mutation surfaces.

## Allowed Actions

- inspect code for secret handling
- inspect logs for scrubbing
- inspect environment variable names
- issue VETO for boundary violations

## Forbidden Actions

- request real credentials
- print environment secret values
- persist secrets

## PASS Criteria

- secrets are read only from environment
- audit logs scrub auth headers
- examples use placeholders only
- mutation intent is explicit

## VETO Criteria

- real secret value appears
- auth header is logged
- model request bypasses policy
- CLI defaults to mutating behavior
