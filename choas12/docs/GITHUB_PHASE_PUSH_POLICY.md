# GitHub Phase Push Policy

## Purpose

Define how phase completion prepares GitHub changes while preserving strict governance.

## Branches

- Work branch for this packet: `coderabbit/slack/order66`.
- Requested lane name: `order66`.
- Packet root: `choas12/`.

## Allowed Before CodeRabbit PASS

- Create local branch.
- Commit pre-generation packet.
- Push review branch.
- Prepare PR proposal.
- Emit manifest and audit bundle.

## Forbidden Before CodeRabbit PASS

- Merge to default branch.
- Tag release.
- Mark phase complete.
- Deploy to Railway.
- Push generated application code to a protected branch.
- Remove VETO repair history.

## Required Commit Metadata

Each phase commit must include:

- phase id
- manifest path
- audit record path
- generated file count
- checksum file path
- current verdict

## Phase Completion Rule

Phase completion is a governance state, not a git event. A commit alone never means phase completion.
