# Exact educational scenario

`docs/scenario/source/goal-objective.md` is the supplied specification.
`src/domain/scenario.ts` contains the executable five districts, ten indicators
and fourteen initiatives. `src/domain/evaluate.ts` owns their exact eight-quarter
calculation. Presentation, geography and resident animation cannot alter it.

A plan has exactly five distinct initiatives, costs at most 100 units, uses no
more than two per policy area and respects all scoped conflicts. District projects
require a valid district; citywide projects cannot silently become district-scoped.
Partial drafts remain usable but cannot be scored as complete results. Replacement
is atomic: rejected proposals preserve the previous decisions and treasury.

The evaluator applies the supplied delays, positive/negative effects, population
weights, once-only clipping, fixed synergies and strict critical thresholds.
The exact rational source oracle independently produces baseline 52.55768 and the
supplied example 56.54307; [calculation audit](calculation-audit.md) records its
formulas and all values. Reproduce it with `python3 scripts/scenario/oracle.py`.

Result identity includes the canonical scoped plan and model version. Explanations,
resident evidence, alternatives and council records must resolve to that result.
The server recomputes connected requests; it does not trust browser totals.
Local/static services use the same model. Optional AI selects or explains validated
facts; it cannot invent quantities or commit a plan without an explicit action.

Storage restores validated decisions and compatible construction receipts, then
recomputes derived results. A damaged draft or unavailable storage produces a
usable recovery path. Legacy fixture saves are bundled with the tests, preserving
real synthetic decisions and receipt clocks without old server records.

[Contract and checks](requirements.md) names the numerical and integration gates.
[Current release evidence](../release.md) records actual outcomes and build identity.
