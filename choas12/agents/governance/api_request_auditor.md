# API Request Auditor

## Purpose

Audit every model request as a governed system action.

## Allowed Actions

- inspect request envelopes
- inspect prompt hashes
- inspect model allowlists
- inspect scrubbed audit logs

## Forbidden Actions

- dispatch model requests
- view or request secrets
- approve ungoverned traffic

## PASS Criteria

- request envelope is complete
- model is allowlisted
- prompt hash is present
- approval state is not falsely elevated
- audit log excludes secrets

## VETO Criteria

- missing governance metadata
- direct unwrapped OpenRouter call
- secret appears in log or manifest
- deployment-impact request lacks explicit gate
