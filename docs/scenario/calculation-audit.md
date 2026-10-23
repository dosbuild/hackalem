# Calculation audit

Generated independently with Python `fractions.Fraction` from the original technical specification tables. No production calculator is imported.

| Claim | Source reports | Exact equation / data result | Status |
| --- | ---: | ---: | --- |
| esil baseline district score | 62.99 | 62.99 | Agrees |
| almaty baseline district score | 57.06 | 57.06 | Agrees |
| saryarka baseline district score | 54.65 | 54.65 | Agrees |
| baikonur baseline district score | 56.63 | 56.63 | Agrees |
| nura baseline district score | 49.18 | 49.18 | Agrees |
| Baseline city average | 56.86 | 56.8624 | Agrees after display rounding |
| Baseline final score | 52.56 | 52.55768 | Agrees after display rounding |
| Example cost | 95 | 95 | Agrees |
| Example score | ≈56.5 | 56.54307 | Source approximation; correct to 1 decimal |
| Example improvement | ≈4.0 | 3.98539 | Source approximation; correct to 1 decimal |

Equation: `0.7 × population-weighted district scores + 0.3 × minimum district score − count(values < 40)`. District scores use all ten supplied weights; each measure is multiplied by `(8 − lag) / 8`, then fixed synergies are added, then indicators clipped once.

Example: average **58.0776**, weakest value **52.9625**, critical pairs **0**. The M10 + M12 bonus is +2 B1 in Nura.

No inputs or coefficients were changed to fit source headlines. Unrounded values drive scoring and the strict threshold. The source example is a verification fixture, never a default or recommended plan.

The source calls the 61-unit set “cheapest”. This work verifies its cost and validity with explicit districts; it does not conduct or claim an optimization proof.

Reproduce: `python3 scripts/scenario/oracle.py`, then `npm test`. The generated fixture checks all 50 values and all assessment components for each case.
