# Changelog

## 3.1.2

- Allow Telegram token import during fresh user-agent onboarding before pairing exists, so the intended flow remains `create agent -> import token -> configure webhook -> pair`.
- Keep onboarding stable for consumers by letting local user-agent ownership drive the first token import instead of requiring a preexisting binding.

## 3.1.1

- Fix Telegram webhook `secret_token` generation to use a Telegram-safe format while keeping ingress parsing backward compatible with the earlier legacy prefix.
- Keep consumer rollouts stable by preserving `botIdentity`-based routing and reconciliation behavior after the webhook token format change.

## 3.1.0

- Introduce a stable Telegram `botIdentity` derived from `getMe`, persist it on agent profiles, pairings, and identity bindings, and scope Telegram resolution by `botIdentity + telegram ids`.
- Configure Telegram webhooks with `secret_token`, validate it on ingress, and route incoming updates to the correct `agentKey` before enqueue/bridge hydration.
- Add migration helpers for legacy Telegram bindings without `botIdentity` and expose reconciliation paths so consumer apps can roll out the new bot-scoped model safely.

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

