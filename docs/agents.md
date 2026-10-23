# Working with agents and AI providers

Alem can be developed with any coding assistant, and its optional in-game AI can
be adapted to another provider. These are separate roles: a coding assistant edits
the project; Aya and the analysis services run inside the application. No coding
assistant account or integration is required to play or build the game.

## Start locally

Use Node.js 24:

```sh
npm ci --include=dev --ignore-scripts
npm run dev
```

The development server serves the interface and its APIs on the same origin. No
API key is needed for the deterministic game, local dialogue or local analysis.
For the existing OpenAI adapter, copy `.env.example` to `.env`, set the server-only
`OPENAI_API_KEY`, and optionally change `OPENAI_MODEL`. Restart the server after
changing environment variables. Never prefix secrets with `VITE_` or put them in
a browser request.

The current adapter calls OpenAI's Responses endpoint. There is no configurable
provider base URL, generic agent plug-in protocol, or automatic compatibility with
other vendors. Using another provider requires a server-side adapter change.
See [development](development.md) for production and static builds.

## Integration points and contracts

[server/api.ts](../server/api.ts) routes the same HTTP API in development and
production. Both endpoints below accept same-origin `POST` requests with
`Content-Type: application/json`. The router checks request size and origin;
invalid input is rejected instead of being passed unchecked to a model.

| Capability | Application request and response | Implementation |
| --- | --- | --- |
| Explain a completed plan | Request: `{plan, modelVersion}` using the current scenario version. Success: `{resultId, statementIds, evidence}`. Local fallback: `{resultId, mode: 'local', reason}`. | [server/explanation.ts](../server/explanation.ts), `POST /api/explanation` |
| Aya conversation | `AssistantRequest` contains `text`, `history` and `context`; `AssistantReply` contains qualitative text, canonical facts, an optional intent, plan fingerprint and revision. | [assistant types](../src/assistant/types.ts), [service and validators](../server/assistant/service.ts), `POST /api/assistant` |
| Dashboard analysis | Receives an already computed `PlanReview`; returns an `Analysis` with strengths, risks and recommendations. This is an internal service used by the dashboard handler, not a separate public endpoint. | [analysis adapter](../server/dashboard/analysis.ts), [dashboard types](../src/dashboard/types.ts) |

### Explanation adapter

`calculateRequest` recomputes the result from the plan and rejects extra fields or
an incorrect model version. The provider selects and orders existing statement
IDs; it does not generate authoritative numbers. The application reconstructs
exact evidence and requires all four explanation sections, critical conditions
and negative effects.

For a custom adapter, retain that calculation and the validation in
[requestExplanation](../src/explanations/explain.ts). Its `ExplanationProvider`
receives the calculated scenario, evidence and statements plus an abort signal.
Return the documented `{resultId, statementIds, evidence}` shape and let the
existing validator accept it or fall back locally. `createApiHandler` supports an
`explain` service override; preserve the existing HTTP response shape when using
that hook. The current server adapter also provides caching and usage limits.

### Aya and dashboard adapters

Change provider transport and response extraction in
`server/assistant/service.ts` to connect an agent or another model. Keep
`readAssistantRequest`, `readProviderReply`, canonical `contextFacts`, deadlines,
limits and local fallbacks. The provider JSON is `{reply, factIds, intent}`; it is
not the browser's `AssistantReply`. Its intent schema supports `none`, `add`,
`complete` and `navigate`. Copy the actual schema from the service when adapting
it; the broader application intent union also contains internally authored actions.

The API handler currently constructs Aya's service directly; there is no public
assistant-injection option. A transport replacement belongs in that service, or
requires an explicit, tested change to server composition. An external agent
should return a bounded suggestion, not call application mutation endpoints or
write plans and scores itself.

Dashboard provider changes belong in `server/dashboard/analysis.ts`. Preserve its
validated prose arrays, canonical plan fingerprint and local analysis fallback.
Keep client context, requests and conversation as data rather than instructions.

## Preserve the game's authority

The domain model owns arithmetic, budget, compatibility and completion rules.
Provider prose is qualitative; facts and displayed numbers come from the model.
The UI validates action authorization and checks current plan identity before
executing suggestions through normal application commands. Preserve those checks:
a question is not authorization to spend, and an outdated reply must not change
a newer plan. No provider should claim it already executed an action or resolved
a fictional resident's need.

Both worlds use the supplied numerical specification. A provider must not alter
scenario data, bypass validation, introduce live-city statistics, or replace local
recovery with a failure screen.

## Verify a change

Run focused contract tests first:

```sh
npm test -- tests/server.test.ts tests/explanations.test.ts tests/assistant/assistant.test.ts
npm run verify
npm run test:runtime
npm run test:browser
```

Test successful responses, unknown statement/fact IDs, malformed output, invented
numbers, invalid plans, stale replies, timeouts, cancellation and missing keys.
Use mocked provider responses for routine checks. A real-provider test requires
your own credentials and may incur provider charges; it is not needed for the
local build. Follow [AGENTS.md](../AGENTS.md) for repository contribution rules.
