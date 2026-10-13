# Scenario contract and verification

| Required behavior | Authoritative source and check |
| --- | --- |
| Preserve all supplied districts, indicators, initiatives, prices and conflicts | `goal-objective.md`, `src/domain/scenario.ts`, `tests/scenario-contract.test.ts` |
| Exact eight-quarter effects, delays, negatives, synergy, clipping and weights | `src/domain/evaluate.ts`, independent Fraction oracle, domain fixtures |
| Five distinct choices, valid scopes, budget and policy-area limits | `src/domain/plan.ts`, plan/domain tests and all-initiative completion audit |
| Valid partial drafts; score complete plans only | Draft validator, reducer and completion tests |
| Atomic commitment/replacement/removal and exact remaining treasury | App reducer, state/storage tests, `npm run test:budget` |
| Result belongs to the exact scoped plan and model | Result identity, scenario contract and alternative checks |
| One evaluator for local/static/connected play | Shared core, server recomputation and isolated runtime checks |
| Visual clocks and camera never change numerical results | Construction/state tests and complete browser journeys |
| Explanations only use validated facts and quantities | Provider adapter tests, local fallback and optional real-provider gate |
| Damaged/legacy saves and unavailable storage recover | Storage tests, bundled legacy browser fixtures, recovery journeys |
| Both worlds remain independently completable | Same numerical model, mode/storage tests, 140 scoped completion cases and both static journeys |

Run the original source oracle and `npm run verify` first. Browser journeys then
exercise the final production package’s priced proposals, fifth-decision result,
return, alternatives, amendments, reload and restart. A test count alone does not
establish playability or visual quality. Actual current outcomes, source identity
and limits belong to [release verification](../release.md).
