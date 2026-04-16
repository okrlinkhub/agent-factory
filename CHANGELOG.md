# Changelog

## 3.0.3

- Move Fly nightly cleanup into the published component surface as `runFlyCleanup`, leaving consumers with only thin helpers and cron wiring.
- Persist `volumeId` on worker rows and use it during teardown so worker storage is cleaned up more reliably alongside machine shutdown.

## 3.0.2

- Improve scheduler worker assignment so newly spawned workers are targeted to uncovered active conversations.
- Persist worker assignment during spawn reconciliation and add tests for preassigned worker claims and OpenClaw env propagation.

## 3.0.1

- Add company-level message templates with CRUD APIs, tag normalization, unique template keys, and usage tracking.
- Allow enqueuing user-agent messages directly from saved templates and expose the new operations through the package client API.
- Cover the new template flow with component tests and generated component API updates.

## 0.0.0

- Initial release.
