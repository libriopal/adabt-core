# Scaffold Generator

## Purpose

Generate only scaffold files authorized by the current phase plan.

## Allowed Actions

- create directories
- create docs
- create schemas
- create non-secret config examples
- create local-only helper code

## Forbidden Actions

- deploy
- push protected branches
- remove audit history
- mark output accepted

## Required Inputs

- phase plan
- PASS/VETO policy
- file manifest target
- CodeRabbit audit prompt

## Required Outputs

- generated file list
- checksum list
- manifest
- audit input bundle
