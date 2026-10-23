# Assignment requirements and implementation evidence

The [original assignment](source/goal-objective.md) defines a synthetic city model:
five decisions, a shared 100-unit budget, and an explained Astana Quality of Life
Score. Its [verbatim source](source/mayor-for-5-hours.original.txt) is retained
separately from the implementation. The table below connects required behavior
to executable evidence; it is not a claim that every optional feature was built.

| Assignment requirement | Implementation and verification |
| --- | --- |
| A shared 100-unit budget; exactly five distinct initiatives; at most two per policy area; valid district/city scopes and all incompatibilities | The [plan validator](../../src/domain/plan.ts) rejects invalid sets and explains why. [Domain tests](../../tests/domain.test.ts) cover the rules; [state and storage tests](../../tests/state-storage.test.ts) check that rejected changes preserve the plan. |
| The supplied five districts, ten indicators, population shares, fourteen initiatives, costs and effects | [Executable scenario data](../../src/domain/scenario.ts) is checked against the [independent source oracle](../../scripts/scenario/oracle.py) by [scenario contract tests](../../tests/scenario-contract.test.ts). Display names may be translated; numerical inputs remain unchanged. |
| Eight-quarter effects, delays, fixed synergies, clipping, indicator weights, weakest-district weighting and the strict below-40 penalty | The [evaluator](../../src/domain/evaluate.ts) applies the supplied formula. The [calculation audit](calculation-audit.md) records baseline **52.55768**, example cost **95**, and example score **56.54307**, distinguishing exact results from the source's display rounding. [Contract tests](../../tests/scenario-contract.test.ts) compare all fifty indicator values and each score component with the independent oracle. |
| Invalid sets receive reasons and no final score; order of decisions does not matter | The [validator](../../src/domain/plan.ts) and [evaluator](../../src/domain/evaluate.ts) distinguish partial drafts from complete valid plans. [Domain](../../tests/domain.test.ts) and [contract](../../tests/scenario-contract.test.ts) tests cover invalid input and all permutations of the supplied example. |
| AI analysis explains calculated results rather than calculating or inventing numbers | The [dashboard analysis adapter](../../server/dashboard/analysis.ts) receives a computed plan review and validates provider prose. [Aya's service](../../server/assistant/service.ts) selects canonical facts and validates proposed actions. [Analysis](../../tests/dashboard/review-council.test.ts) and [assistant tests](../../tests/assistant/assistant.test.ts) check provider boundaries and local fallbacks. See [provider setup](../development.md). |
| Explain strengths, risks, trade-offs and potential consequences | The [outcome sheet](../../src/play/OutcomeSheet.tsx) connects the score to improved and unresolved resident needs. The [detailed review](../../src/dashboard/Review.tsx) shows strengths, risks, recommendations and decision contributions. [Resident evidence tests](../../tests/scenario-contract.test.ts) and [review tests](../../tests/dashboard/review-council.test.ts) check these against the same calculated plan. |
| A reproducible working simulator using synthetic, unrestricted scenario data | The [development guide](../development.md) documents installation, local startup and checks. The [runtime smoke test](../../scripts/release/runtime-smoke.mjs) exercises an isolated production package; the [browser smoke test](../../scripts/release/browser-smoke.mjs) checks the running interface. The supplied indicator dataset is synthetic; geography has separate [attribution](../../ATTRIBUTION.md). |

## Required model, additional experience

The geographic city, construction scenes, authored residents, treasury gestures,
and fictional Khanate world are presentation and interaction additions. They do
not change costs, effects, delays, constraints or the final score. Both worlds
use the same calculator. [Mode tests](../../tests/khanate-core.test.ts),
[construction tests](../../tests/construction-activities.test.ts) and the
[both-world browser journeys](../../scripts/khanate/static-journey.mjs) check
these boundaries and completion paths.

Local analysis and resident outcomes use authored text populated with calculated
facts; they work without an API key. A configured provider adds qualitative
dashboard analysis and Aya dialogue. Unavailable or invalid responses fall back
locally. The separate [explanation API](../../server/explanation.ts) supports
selection of validated statement IDs; it is an integration endpoint, not the
current result panel. Provider tests use controlled responses. The opt-in
live-provider check is separate from the ordinary test suite.

## Reproduce the numerical check

```sh
python3 scripts/scenario/oracle.py
npm run verify
npm run test:runtime
```

The oracle reads the preserved specification tables and uses Python rational
arithmetic; it does not import the production calculator. Its generated fixture
checks the supplied example and three additional cases. The calculation audit
retains source approximations rather than changing inputs to fit them. Production browser checks and their setup are documented in the
[development guide](../development.md).
