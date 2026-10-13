# Agent 3 — Make every decision calculable, explainable, and visible

You are the third agent working on **Alem / «Аким на 5 часов»**, a pixel-styled city-management simulator set in Astana.

Two other agents are developing the experience:

**Agent 1:** the guided player journey, Aya—the Akim’s assistant—and encounters with residents.

**Agent 2:** the Alem sphere, city rendering, controlled exploration, lighting, and the visual passage into the future.

**Your responsibility is the authoritative scenario underneath both: the technical specification, decision lifecycle, calculation, evidence, and the connection between a decision and its consequences.**

The foundation already exists. Inspect, retain, correct, and connect it. Do not create another application or rewrite working logic for stylistic reasons.

Your outcome is:

> **Every commitment produces the correct scenario state. Every result follows the supplied model. Every visible consequence and explanation can point to the evidence behind it. The player can complete, understand, revise, and replay a plan without the world, assistant, or calculations disagreeing.**

Work autonomously in goal mode. Complete implementation and verification—not merely an audit or architectural proposal.

---

## 1. Your source of truth and the task boundary

The attached **“Mayor for 5 Hours” technical specification** defines the scenario, data, rules, calculation, and AI responsibilities. Preserve it in the repository at an identifiable canonical path if it is not already present.

Its required outcome is five budget-constrained management decisions, an Astana Quality of Life Score, and explanations of strengths, risks, trade-offs, and consequences. The explanations must remain grounded in the scenario. Pasted text

Use the attached document—not old screenshots, illustrative dialogue, approximate example scores, or a previous agent’s completion report—to establish what must work.

The numerical contract is reproduced later in this prompt for execution convenience. The original attachment must remain available so normalization of its formatting does not erase its wording or reported examples.

### Own these responsibilities

- Canonical scenario data and runtime validation.
- Correct draft operations and complete-plan validation.
- Deterministic calculation and independently checked expected results.
- Structured evidence for explanations, residents, and visual outcomes.
- Correct result invalidation, revision, comparison, and restart.
- Specification-focused integration tests and reproducible verification.
- The smallest necessary implementation of the specified explanation capability.

### Do not take over

- Aya’s character design, voice, or onboarding choreography.
- The sphere’s geometry, camera implementation, materials, or lighting.
- Resident sprite production or wholesale rewriting of their dialogue.
- Geographic-data acquisition, district-boundary research, or renderer selection.
- A new backend platform, account system, multiplayer, or deployment.
- Optional disasters, leaderboards, presentation export, or additional simulation models.

The original evaluation emphasizes functional alignment, implementation, and reproducibility. Make those qualities demonstrable through a working application and verifiable artifacts—not through a large volume of documentation. Pasted text

---

## 2. Start with the existing implementation and establish ownership

Read applicable repository instructions and inspect the actual Git structure before editing. Previous work may exist in a nested `foundation/` repository, a parent geographic project, or worktrees.

Useful reported starting points include:
```bash
foundation/README.md
foundation/src/world/contract.ts
foundation/src/world/WorldHost.tsx
foundation/docs/map-integration.md
foundation/docs/residents/README.md
```

These are discovery leads, not proof of current paths or architecture.

Find the actual:

**Scenario data → validator → draft reducer/actions → calculator → result state → explanation interface → world/resident adapters**

Run the existing relevant checks and record the starting failures. Do not assume reported test counts establish current correctness.

### Parallel-agent safety

Use the existing coordination mechanism. If none exists, write one short ownership and handoff note in a shared, discoverable location.

Own the domain/evidence modules and their tests. Avoid editing the other agents’ active files without coordinating a narrow integration change.

If worktrees are being used, document the branch, contract path, and changes that need integration. Do not assume another agent can see files that only exist in your working directory.

Do not change shared branches, force-push, reset unrelated work, move active files into Trash, or regenerate a shared lockfile casually.

Define the smallest useful contract early. Prefer additive changes compatible with current consumers. Do not let an elegant new type system strand the working application.

**One plan state, one evaluator, one result identity.** The assistant, residents, and sphere consume these; they do not maintain independent scenario truth.

---

## 3. Build the work around one traceable scenario

Treat each evaluated scenario as a coherent, immutable result that belongs to one exact plan and one model/data version.

Use existing types and identifiers where they already solve this. Do not create a new framework around the concept.

A sufficient evaluation result should make these facts available:

| Part                | Required information                                                               |
| ------------------- | ---------------------------------------------------------------------------------- |
| Identity            | Model/data version and the evaluated plan or stable plan fingerprint               |
| Selection           | Five initiatives, actual scopes, total cost, unspent budget                        |
| Indicators          | Baseline, updated value, and actual change for every district–indicator pair       |
| Effect ledger       | Applicable measure effects after lag, fixed synergies, and clipping where relevant |
| District assessment | Baseline and resulting district scores                                             |
| City assessment     | Population-weighted average and weakest-district value                             |
| Critical conditions | Exact district–indicator pairs below 40 before and after                           |
| Final assessment    | Score, baseline reference, change, and the arithmetic components                   |
| Evidence references | Stable references that explanations and visual scenes can cite internally          |

Do not store redundant mutable counters or partially updated result fragments.

A plan edit must not leave the budget from one state, the sphere from another, and Aya’s explanation from a third.

### Distinguish three states clearly

**Candidate proposal:** being inspected; no funds committed.

**Committed draft:** accepted selections; editable, but not necessarily complete.

**Evaluated scenario:** a valid complete plan and its calculated outcome.

Previewing, hovering, or talking to a resident is not a commitment. A commitment is not a new simulated quarter.

---

## 4. Make planning correct before adding explanation

Verify and complete the existing edit operations:

**Add · Move scope where applicable · Remove · Replace · Cancel proposal · Evaluate · Revise · Restart**

### Required behaviour

A valid partial draft may contain fewer than five decisions. It should report what remains to finish without being treated as an error.

A complete plan must satisfy every rule before calculation is published.

An invalid edit preserves the previous draft and budget. Return a stable validation code, relevant IDs, and enough context for a specific Russian explanation.

Replacement must be atomic. Validate the resulting set before accepting it; do not temporarily add a sixth initiative or charge for both the old and new selection.

Changing a district must recheck district-scoped incompatibilities. Moving a prop inside the same district cannot bypass them.

Citywide decisions must not retain a stale district field. Enforce this in runtime validation, not only TypeScript.

Derive budget, count, category coverage, and evaluation eligibility from the accepted draft.

### Result freshness

An accepted plan change makes the old result non-current. A cancelled or rejected edit does not invalidate an otherwise current result.

Guard asynchronous explanations and visual transitions against stale responses. A late result for an earlier revision must not overwrite the current state.

Restart returns to the original dataset and budget. A second run must not accumulate the first run’s improvements.

If draft persistence exists, validate restored IDs, scope, schema/model version, and partial-plan rules. Do not trust stored budget or score fields.

---

## 5. Use the specification exactly—and preserve discrepancies honestly

The attachment includes raw values, explicit equations, and reported summary/example values.

**Do not silently reconcile disagreements by changing inputs, coefficients, or outputs.**

For the executable model, implement the supplied raw inputs and explicit equations as written. Independently check the reported summaries against that implementation.

If a discrepancy appears:

1. Preserve the source-reported value as a source claim.
2. Record the independently calculated value and the exact inputs/equation used.
3. Distinguish a software defect from an inconsistency in the supplied document.
4. Keep the application’s displayed results internally consistent with its documented calculation.
5. Mark any unresolved source discrepancy explicitly rather than claiming complete agreement.

Do not patch the calculator to hit an approximate example score. Do not silently “repair” the dataset.

The source explicitly asks for the example calculation to be double-checked in code. Pasted text

---

## 6. Numerical contract

### 6.1 Indicator definitions

All ten indicators use a **0–100 scale, higher is better**. Congestion and air-quality problems have already been reverse-coded. Preserve this orientation in calculations and explanatory language. Pasted text

| Code | Meaning                        | Reference meaning of 100                                                |
| ---- | ------------------------------ | ----------------------------------------------------------------------- |
| T1   | Road congestion relief         | No peak-hour congestion                                                 |
| T2   | Public transport accessibility | All residents within 500 m of a stop with service intervals ≤10 minutes |
| E1   | Green-space provision          | At least 20 m² per resident                                             |
| E2   | Air quality                    | Winter AQI ≤50                                                          |
| S1   | Schools and kindergartens      | Provision demand met; no second-shift classes                           |
| S2   | Primary healthcare             | Per-capita provision standards met                                      |
| B1   | Street safety                  | Comprehensive lighting/cameras and minimal incidents                    |
| B2   | Road safety                    | Minimal casualty-causing road crashes                                   |
| C1   | Utility reliability            | No heating or water failures over the year                              |
| C2   | Request-resolution speed       | All requests closed within the required timeframe                       |

These are definitions of a synthetic model, not verified descriptions of present-day Astana.

### 6.2 Baseline district data

Retain the five scenario districts regardless of the renderer’s geographic representation.

| District | Population share | T1 | T2 | E1 | E2 | S1 | S2 | B1 | B2 | C1 | C2 | Source-reported D |
| -------- | ---------------- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | ----------------- |
| Esil     | 0.27             | 45 | 62 | 68 | 72 | 48 | 55 | 78 | 60 | 75 | 70 | 62.99             |
| Almaty   | 0.24             | 40 | 75 | 50 | 55 | 60 | 65 | 62 | 52 | 50 | 60 | 57.06             |
| Saryarka | 0.20             | 50 | 70 | 42 | 40 | 62 | 68 | 58 | 55 | 45 | 55 | 54.65             |
| Baikonur | 0.13             | 52 | 68 | 55 | 50 | 58 | 60 | 52 | 58 | 55 | 58 | 56.63             |
| Nura     | 0.16             | 55 | 40 | 45 | 65 | 38 | 35 | 55 | 50 | 60 | 50 | 49.18             |

The last column is a reported summary to verify, not an independent input that overrides the indicator calculation. These values are reproduced from the supplied dataset. Pasted text

Russian display names remain:

**Есиль · Алматы · Сарыарка · Байконур · Нура**

Do not change internal identifiers unnecessarily.

The supplied profiles describe Esil’s bridge congestion and school pressure; Almaty’s ageing utilities and congestion; Saryarka’s air and greenery needs; Baikonur’s less pronounced imbalances; and Nura’s social-service and transport gaps. Preserve their status as synthetic scenario context. Pasted text

### 6.3 Initiative catalogue

The simulation horizon is **H = 8 quarters**.

For lag `L`, the realized fraction is:
```
(8 − L) / 8
```

“District” means one selected district. “Citywide” means all five districts, without a district assignment.

| ID  | Area               | Initiative                               | Scope    | Cost | Lag | Full effects before lag adjustment |
| --- | ------------------ | ---------------------------------------- | -------- | ---- | --- | ---------------------------------- |
| M1  | Transport          | Dedicated bus lanes                      | District | 18   | 2   | T1 +6, T2 +9                       |
| M2  | Transport          | Adaptive traffic lights                  | Citywide | 22   | 2   | T1 +4, B2 +3                       |
| M3  | Transport          | LRT line / expansion                     | District | 30   | 4   | T1 +16, T2 +20, E2 +4              |
| M4  | Environment        | Park / public garden                     | District | 15   | 2   | E1 +12, E2 +3, B1 +2               |
| M5  | Environment        | Private homes switching to clean fuel    | District | 25   | 3   | E2 +14, C1 +4                      |
| M6  | Environment        | Citywide greening and windbreak planting | Citywide | 20   | 4   | E1 +5, E2 +3                       |
| M7  | Social services    | Modular school + kindergarten            | District | 24   | 3   | S1 +16                             |
| M8  | Social services    | Family health centre / polyclinic        | District | 20   | 3   | S2 +14                             |
| M9  | Social services    | Courtyard sports hubs                    | District | 10   | 1   | S1 +3, S2 +3, B1 +3                |
| M10 | Safety             | Lighting and cameras                     | District | 12   | 1   | B1 +12, B2 +2                      |
| M11 | Safety             | Safe crossings and school zones          | District | 10   | 1   | B2 +12, T1 −2                      |
| M12 | Municipal services | Unified residents’ request platform      | Citywide | 14   | 1   | C2 +5                              |
| M13 | Municipal services | Heating and water network modernization  | District | 28   | 4   | C1 +18, E2 +2                      |
| M14 | Municipal services | Emergency crews and early warning        | Citywide | 16   | 1   | C1 +5, C2 +2                       |

Preserve catalogue effects even when a narrative interpretation might seem counterintuitive. Interpretation must not rewrite the model. Pasted text

### 6.4 Synergies and incompatibilities

Fixed synergies, **not scaled by lag**:

| Pair      | Bonus                            |
| --------- | -------------------------------- |
| M1 + M2   | T1 +2 in M1’s selected district  |
| M10 + M12 | B1 +2 in M10’s selected district |
| M5 + M6   | E2 +2 in M5’s selected district  |

The named first measure identifies the district. Player selection order does not.

Incompatibilities:

**M1 and M3:** prohibited together anywhere in the plan.

**M4 and M7:** prohibited together in the same district.

**M5 and M13:** prohibited together in the same district. Pasted text

### 6.5 Calculation
```
updated[d,k] = clip(
    baseline[d,k]
    + sum(applicable_effect[m,k] × (8 − lag[m]) / 8)
    + applicable_fixed_synergies[d,k],
    0,
    100
)
```

Indicator weights:

| Code   | T1  | T2  | E1  | E2  | S1  | S2  | B1  | B2  | C1  | C2  |
| ------ | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Weight | .10 | .10 | .09 | .11 | .11 | .11 | .09 | .09 | .10 | .10 |
```sql
district_score[d] =
    sum(weight[k] × updated[d,k])

city_average =
    sum(population_share[d] × district_score[d])

critical_count =
    count of district–indicator pairs with updated[d,k] < 40

final_score =
    0.7 × city_average
    + 0.3 × min(district_score[d])
    − critical_count
```

A value of exactly 40 is not critical. Count individual district–indicator pairs, not districts.

Apply the critical test to the unrounded model value. Preserve calculation precision and round for display. Do not introduce a final-score clamp that the source does not specify.

Do not hardcode Nura as the weakest district. Determine the weakest value from the resulting scenario and handle ties honestly. These are the supplied calculation steps. Pasted text

### 6.6 Selection rules

The budget is **100 units**. Unspent funds earn no bonus.

Select **exactly five distinct initiatives**. No initiative may be repeated, including in a different district.

Select **no more than two initiatives from one policy area**. This implies at least three areas; it does not require one initiative from each area.

District measures require a district. Citywide measures must not specify one.

Invalid plans receive no score and return the reason. Decision order does not matter. Pasted text

### 6.7 Source examples

The attachment reports a no-measures baseline score of **52.56**, using a city average of **56.86**, weakest-district value **49.18**, and two critical pairs: Nura S1 and S2. Treat these as reported values to verify. Pasted text

The supplied complete example is:

**M7/Nura · M8/Nura · M10/Nura · M12/Citywide · M5/Saryarka**

The source reports cost **95**, approximate score **56.5**, approximate improvement **4.0**, and the M10 + M12 synergy. It asks for a code check. Do not turn this example into the player’s default or recommended plan. Pasted text

The source also identifies **M9 + M11 + M10 + M12 + M4** as a valid low-cost measure set costing **61**. A runtime fixture still needs explicit valid districts for its district measures. Preserve the source’s statement without launching an optimization search. Pasted text

---

## 7. Build evidence that the other agents can use safely

The most important integration artifact is not another results component. It is a small, reliable answer to:

> **What changed, where, because of what, and what are we entitled to show or say?**

Provide the information through the existing contract or a narrow adjacent adapter. Do not expose renderer-specific geometry or dialogue strings from the domain calculator.

### Support these distinctions

**Catalogue fact:** the specified cost, scope, lag, or effect.

**Calculated outcome:** the returned indicator change, score component, or critical condition.

**Authored illustration:** a resident routine, project prop, or environmental treatment used to express that outcome.

**Unsupported claim:** something the model does not calculate and that must not be stated as a prediction.

Avoid invented confidence percentages.

### Contributions must be accurately labelled

The model provides measure effects on indicators. That does not automatically provide an additive decomposition of the final score by project.

Record lag-adjusted effects and synergies before clipping, then the actual indicator changes after clipping. Do not present their uncapped sum as the realized change when clipping occurred.

If explaining the change in final score, use the actual change in its specified components:
```
score_change =
    0.7 × change_in_city_average
    + 0.3 × change_in_weakest_district_value
    − change_in_critical_count
```

Do not label the weakest-value change as the change of one fixed district if the weakest district changes.

Do not build a Shapley-value system or another attribution framework for this task.

### World-facing integration

The sphere agent needs scoped proposals and supported result changes—not a duplicated calculation.

Provide district IDs and relevant indicator effects. Let the renderer resolve geometry and scene anchors.

For a citywide initiative, provide five-district applicability without creating five commitments.

For clean fuel, provide an area-level scope and supported air/utility effects—not an instruction to spawn an unrelated building at the district centre.

For request handling, do not emit pipe replacement. For a school, do not assert guaranteed admission for an individual child.

### Resident-facing integration

A resident’s count, animation, happiness, or home location must not become a new model weight.

Tie reactions to the relevant scenario, district, activity location, and evidence. A resident visiting another district may discuss that location without transporting its model effects elsewhere.

Keep identity and baseline staging stable across scenarios. Changing a plan should not randomly change which person the result appears to affect.

Give the assistant and resident layers an inspectable explanation such as **«Почему это показано?»** without designing their conversation UI yourself.

---

## 8. Keep visual time separate from simulation time

The sphere agent is developing daylight, sunset, night, and dawn as the visible passage of time.

Support that artistic language without allowing it to change the mathematics.

There are three separate concepts:

**Five-hour appointment fiction · Eight-quarter evaluation horizon · Visual transition clock**

A camera flight, a sunset, or the player’s fifth click does not create a newly simulated quarter.

The before/after handle changes what is displayed. It must not recalculate intermediate states, interpolate the score, or imply that the model predicts every stage of construction.

A valid evaluation starts one identifiable result transition. Revising or restarting must cancel or invalidate any pending transition to an old scenario.

Keep the previous and future states aligned for comparison. Illumination can change during the presentation, but the result evidence must remain independent of lighting.

You own the event and result semantics. The sphere agent owns the visual execution.

---

## 9. Fulfil the AI explanation requirement without disguising a fallback

The source assigns the LLM a specific role: it receives calculated changes and contribution information, then explains, compares, and makes recommendations. It does not calculate or invent numerical outcomes. Pasted text

Inspect the existing explanation interface. Complete the smallest appropriate implementation through the existing secure boundary.

Do not expose provider credentials in the frontend, introduce an orchestration platform, or require an account merely to complete the local simulator.

### Explanations should cover

**What improved · What remains problematic · Relevant trade-offs · Why the model produced this result**

Comparison should use two complete, valid evaluated plans with the same baseline/model version, or clearly explain that they are not directly comparable.

A proposed revision must remain the player’s choice. Never apply it automatically. Show its actual scope and consequences; do not introduce an optimization contest.

Any quantified claim about an alternative requires a valid evaluated alternative. Do not remove one project, calculate an invalid four-project plan, and present that as a playable comparison.

### Reliability

Publish the deterministic numerical result as soon as it is ready. A slow explanation must not block the ending.

Use bounded requests, stale-response protection, and a concise deterministic explanation if the provider is unavailable.

Keep generated narrative separate from authoritative numerical fields. Validate structured references and values where the interface supports them; reject or replace unsupported output.

If no secure provider connection or credentials exist, complete and test the adapter and local fallback, but explicitly record **live AI explanation as unverified or unavailable**. A authored fallback is useful; it is not evidence that the AI requirement has been met.

Do not create a new backend solely to hide this limitation from the completion report.

---

## 10. Verify with an independent oracle, not self-confirming tests

Use the existing test stack. Add only what provides material confidence.

Expected values must not be generated by importing the same production calculator under test. Independently work through a small set of fixtures or use a separate transparent reference calculation.

Do not build a second production engine.

### Required test families

| Family                    | What the tests must prove                                                                         |
| ------------------------- | ------------------------------------------------------------------------------------------------- |
| Source data               | Complete IDs, valid ranges, population shares and weights, exact catalogue values                 |
| Partial/complete validity | Fewer than five is a normal draft; only exactly five valid decisions can publish a scenario score |
| Budget and identity       | Budget 100 accepted; overruns rejected; duplicates rejected even across districts                 |
| Scope                     | Local measures require a district; citywide measures reject a district                            |
| Category limits           | Two allowed, three rejected; no requirement to cover all five areas                               |
| Conflicts                 | Each incompatibility, including same/different-district cases and global M1/M3                    |
| Editing                   | Atomic replacement and unchanged state after rejection                                            |
| Effects                   | Lag, negative effects, correct geographic scope, fixed synergy, clipping                          |
| Assessment                | Weights, population average, weakest value, strict critical threshold, final components           |
| Invariants                | Selection-order independence, immutable baseline, stable replay                                   |
| Freshness                 | Edited plans cannot receive old results or late explanations                                      |
| Persistence               | Invalid or obsolete saved drafts recover without trusting stored totals                           |

Where legal scenarios cannot exercise a numerical edge such as clipping, test the relevant pure calculation primitive with a clearly isolated test input. Do not modify the real dataset just to increase coverage.

Design fixtures that would catch representative faults: `< 40` becoming `<= 40`, lag applied twice, synergy scaled by lag, citywide effects applied once, a negative effect dropped, or Nura hardcoded as the weakest district.

Use bounded generated/permutation tests if helpful. Do not exhaustively search for a best plan.

### Integration journeys

Verify against the actual application when the other agents’ work is available:

**A — Ordinary completion:** fresh plan → district proposal → citywide proposal → five valid commitments → calculation → sphere reveal → grounded resident/assistant explanation.

**B — Recovery:** invalid combination → unchanged budget → atomic replacement → completion.

**C — Revision:** evaluate → revise → old future becomes non-current → reevaluate → changed evidence and appropriate return visit.

**D — Resilience:** explanation service unavailable → correct numerical result and honest fallback → restart.

**E — Nonlinear result:** a fixture that exercises a critical-threshold or weakest-district change, with a correct explanation.

Do not fabricate a capture by connecting one visible plan to an unrelated stored result.

If another agent has not yet delivered the consumer, test the contract with a small integration fixture and state that the real combined journey remains pending. A contract test is not evidence of a finished sphere or companion flow.

---

## 11. Keep the scope disciplined and make progress visible

Work in five practical gates:

### Gate 1 — Establish truth

Locate the implementation, preserve the attached source, reproduce the main calculations independently, and identify actual mismatches.

### Gate 2 — Close the domain

Fix the draft lifecycle, validation, calculation, and result freshness. Keep the existing application runnable.

### Gate 3 — Connect evidence

Expose the minimal result/evidence contract to the assistant, residents, and sphere. Exercise it with concrete scenarios.

### Gate 4 — Verify the player’s loop

Test the real integrated flow and repair state or explanation inconsistencies. Do not “fix” another agent’s visual concept unless a narrow correction is necessary for correctness and coordinated.

### Gate 5 — Finish reproducibility

Run a clean documented startup and production build, relevant tests, and the final scenario journeys. Consolidate only the documentation needed to maintain this work.

Do not inflate the assignment with optional features or a general repository cleanup.

Historical research about geographic providers is background, not a reason to change the current locally sourced map or require new mapping accounts.

---

## 12. Deliverables and completion standard

Leave:

**The working implementation** in the existing application.

**The preserved source specification** and one authoritative executable dataset/catalogue.

**A compact calculation audit** distinguishing verified outputs, source-reported values, and any discrepancies.

**The shared evidence/result contract**, with one complete example for the other agents.

**A requirement-to-evidence matrix** mapping each required capability to implementation, test, and verification status.

**A concise handoff** identifying changed files, integration needs, run commands, and genuine blockers.

Do not create a second large architecture document or repeat the whole research history.

### Completion requires evidence that

- All fourteen initiatives use the supplied costs, scope, lag, and effects.
- Every selection rule works through real application actions.
- A complete valid plan produces the documented deterministic calculation.
- Invalid plans receive no score.
- The result remains tied to its exact plan.
- Proposed effects, evaluated effects, and authored illustrations remain distinguishable.
- The assistant and sphere can consume the same scenario without inventing facts.
- Explanations accurately describe strengths, risks, limitations, and trade-offs.
- Revision, failure, replay, and restart do not leave stale state.
- The implementation is reproducible.
- Missing live services or unfinished parallel integrations are explicitly identified.

Review the diff and commit through the repository’s established local workflow. Preserve unrelated changes. Do not push, deploy, or merge over another agent’s active work without authorization.

In the final report, distinguish:

**Implemented · Independently verified · Integrated with the companion · Integrated with the sphere · Still externally blocked**

Do not equate many passing tests with a completed experience. Do not claim all three agents’ work is integrated unless you ran that application.

**Your job is to make Alem’s beauty and human stories trustworthy: the same five decisions, the same calculated future, and the same evidence everywhere the player looks.**





\<ts>

**Task Title:** “Mayor for 5 Hours” — AI City Management Simulator

## Problem Statement

When making decisions on urban development, city managers must simultaneously consider multiple areas, including transportation, green infrastructure, social infrastructure, public safety, and the quality of municipal services. Limited resources require evaluating different scenarios and understanding how budget allocation decisions may affect the overall quality of the urban environment.

## Target Users

City administrators, urban analysts, or simulator users.

## Objective

Develop an AI-powered simulator where each team receives the same virtual budget and a dataset describing the current state of simulated city districts.

The user must make **five management decisions** across the following areas:

- transportation;

- urban greening;

- social infrastructure;

- public safety;

- municipal services.

The AI system should analyze the selected decisions, their costs, and their expected impact on city indicators. Based on this analysis, it should generate an overall scenario assessment and provide recommendations.

## Input Data

The simulator should use the following inputs:

- a fixed virtual budget;

- a set of indicators describing simulated city districts;

- a list of possible initiatives and their estimated costs;

- performance indicators across the five urban development areas.

For the hackathon, a pre-generated synthetic dataset may be used. It must not contain any personal or restricted data.

## Expected Outcome

A working AI simulator that allows users to allocate a limited budget among urban initiatives, make five strategic decisions, and receive a final **Astana Quality of Life Score** with an explanation of how the selected decisions influenced the result.

## Must Have Features

- a unified virtual budget for all users;

- the ability to make decisions across the five predefined development areas;

- automatic prevention of budget overruns;

- AI-based analysis of selected decisions;

- calculation of the final Astana Quality of Life Score;

- explanation of strengths, risks, trade-offs, and potential consequences of the selected scenario.

## Optional Features

- comparison of results between multiple teams;

- visualization of changes in district-level indicators;

- AI-generated recommendations for improving the selected scenario;

- simulation of unexpected urban events requiring budget reallocation;

- automatic generation of a short presentation summarizing the team’s decisions.

## Data / Access Requirements

A prepared synthetic dataset describing simulated city districts, including:

- transportation load;

- availability of green spaces;

- social infrastructure coverage;

- safety indicators;

- municipal service quality indicators;

- a list of possible initiatives and their estimated costs.

## Evaluation Criteria

| Criterion                                         | Evaluation Focus                                                                                                                                                                                                                             | Points  |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| Alignment with the task and functionality         | Evaluates how well the solution matches the stated objective and enables the core scenario described in the task.                                                                                                                            | 25      |
| Technical implementation                          | Evaluates the quality of the technical implementation: chosen approach, architecture, component interaction, and the use of AI/agentic AI and other technologies. The actual implementation should align with the project logic and concept. | 25      |
| README and reproducibility                        | Evaluates whether the documentation clearly explains the project structure, technologies used, setup instructions, and main workflow. Also considers whether the solution can be reproduced and validated based on the repository materials. | 25      |
| Solution value and applicability                  | Evaluates how effectively the solution addresses the stated problem and considers the practical applicability of the proposed approach.                                                                                                      | 15      |
| Scalability potential and originality of approach | Evaluates the potential for further development, broader application, and the presence of well-grounded innovative or unconventional approaches to solving the task.                                                                         | 10      |
| **Total**                                         | —                                                                                                                                                                                                                                            | **100** |

## 1. District Dataset

**All indicators use a 0–100 scale, where higher is better.** All indicators are oriented in the same direction, so problems such as congestion or smog have already been reverse-coded (100 = no problem).

| Code | Policy Area        | Indicator                                   | What 100 / 0 Means                                                                                 |
| ---- | ------------------ | ------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| T1   | Transport          | Road congestion relief                      | 100 = no congestion during peak hours; 0 = complete gridlock                                       |
| T2   | Transport          | Public transport accessibility              | 100 = all residents are within 500 m of a stop with service intervals of ≤10 minutes               |
| E1   | Environment        | Green space provision                       | 100 = ≥20 m² of green space per resident                                                           |
| E2   | Environment        | Air quality                                 | 100 = winter AQI ≤50; 0 = chronic smog                                                             |
| S1   | Social Services    | Schools and kindergartens                   | 100 = 100% of demand under the applicable provision standards is met, with no second-shift classes |
| S2   | Social Services    | Polyclinics and primary healthcare          | 100 = per-capita provision standards are fully met                                                 |
| B1   | Safety             | Street safety                               | 100 = lighting and cameras everywhere, with a minimal number of incidents                          |
| B2   | Safety             | Road safety                                 | 100 = a minimal number of road crashes involving casualties                                        |
| C1   | Municipal Services | Reliability of housing and utility services | 100 = no heating or water system failures over the year                                            |
| C2   | Municipal Services | Speed of resolving residents’ requests      | 100 = all requests are closed within the required timeframe                                        |

**Baseline values:**

| District | Population Share | T1 | T2 | E1 | E2 | S1 | S2 | B1 | B2 | C1 | C2 | Overall D |
| -------- | ---------------- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | --------- |
| Esil     | 0.27             | 45 | 62 | 68 | 72 | 48 | 55 | 78 | 60 | 75 | 70 | 62.99     |
| Almaty   | 0.24             | 40 | 75 | 50 | 55 | 60 | 65 | 62 | 52 | 50 | 60 | 57.06     |
| Saryarka | 0.20             | 50 | 70 | 42 | 40 | 62 | 68 | 58 | 55 | 45 | 55 | 54.65     |
| Baikonur | 0.13             | 52 | 68 | 55 | 50 | 58 | 60 | 52 | 58 | 55 | 58 | 56.63     |
| Nura     | 0.16             | 55 | 40 | 45 | 65 | 38 | 35 | 55 | 50 | 60 | 50 | 49.18     |

**District profiles:**

- **Esil:** Affluent, but with congestion on its bridges and overcrowded schools.

- **Almaty:** Ageing housing and utility infrastructure, and traffic congestion.

- **Saryarka:** Smog from private housing areas and limited green space.

- **Baikonur:** A middle-ranking district with no pronounced imbalances.

- **Nura:** The main “laggard” in social services and transport.

---

## 2. Catalogue of Measures (14 Measures)

**Simulation horizon: H = 8 quarters (2 notional years).** The **lag, L**, is the number of quarters before a measure starts taking effect. The realised fraction of the effect is **(8 − L) / 8**.

The **“District”** type means that one district must be selected, and the effect applies only to that district. The **“City”** type means that the effect applies to all 5 districts.

| ID  | Policy Area        | Measure                                            | Type     | Cost | Lag | Full Effects Before Lag Adjustment |
| --- | ------------------ | -------------------------------------------------- | -------- | ---- | --- | ---------------------------------- |
| M1  | Transport          | Dedicated bus lanes                                | District | 18   | 2   | T1 +6, T2 +9                       |
| M2  | Transport          | Smart traffic lights (adaptive control)            | City     | 22   | 2   | T1 +4, B2 +3                       |
| M3  | Transport          | LRT line / expansion                               | District | 30   | 4   | T1 +16, T2 +20, E2 +4              |
| M4  | Environment        | Park / small public garden                         | District | 15   | 2   | E1 +12, E2 +3, B1 +2               |
| M5  | Environment        | Switching private homes to clean fuel              | District | 25   | 3   | E2 +14, C1 +4                      |
| M6  | Environment        | Citywide greening and windbreak planting programme | City     | 20   | 4   | E1 +5, E2 +3                       |
| M7  | Social Services    | School + kindergarten (modular construction)       | District | 24   | 3   | S1 +16                             |
| M8  | Social Services    | Family health centre / polyclinic                  | District | 20   | 3   | S2 +14                             |
| M9  | Social Services    | Sports hubs in residential courtyards              | District | 10   | 1   | S1 +3, S2 +3, B1 +3                |
| M10 | Safety             | Lighting and cameras (Safe City expansion)         | District | 12   | 1   | B1 +12, B2 +2                      |
| M11 | Safety             | Safe crossings and school zones                    | District | 10   | 1   | B2 +12, T1 −2                      |
| M12 | Municipal Services | Unified digital platform for residents’ requests   | City     | 14   | 1   | C2 +5                              |
| M13 | Municipal Services | Modernisation of heating and water networks        | District | 28   | 4   | C1 +18, E2 +2                      |
| M14 | Municipal Services | Utility emergency response crews + early warning   | City     | 16   | 1   | C1 +5, C2 +2                       |

**Synergies.** A bonus applies when both measures are selected. For “District”-type measures, the bonus is applied in the district selected for the first measure in the pair. The bonus is fixed and is not scaled by the lag.

| Pair      | Bonus                                  |
| --------- | -------------------------------------- |
| M1 + M2   | T1 +2 in the district selected for M1  |
| M10 + M12 | B1 +2 in the district selected for M10 |
| M5 + M6   | E2 +2 in the district selected for M5  |

**Incompatibilities:**

- **M1 and M3:** Either BRT or LRT; the two cannot be selected together, regardless of district.

- **M4 and M7:** Cannot be implemented in the same district because they compete for the same site.

- **M5 and M13:** Cannot be implemented in the same district because the programmes overlap.

---

## 3. Score Formula

The calculation proceeds in the following steps.

### 1. Updated indicator value

For each district dd and indicator kk:

Idk′=clip⁡(Idk+∑meffectm,k×8−Lm8+synergies, 0, 100)I'*{dk} = \operatorname{clip} \left( I*{dk} + \sum\_m \mathrm{effect}\_{m,k}\times\frac{8-L\_m}{8} + \mathrm{synergies}, \ 0,\ 100 \right)

### 2. District score

Dd=∑kwk×Idk′D\_d = \sum\_k w\_k \times I'\_{dk}

Indicator weights:

| Indicator | T1   | T2   | E1   | E2   | S1   | S2   | B1   | B2   | C1   | C2   |
| --------- | ---- | ---- | ---- | ---- | ---- | ---- | ---- | ---- | ---- | ---- |
| wkw\_k    | 0.10 | 0.10 | 0.09 | 0.11 | 0.11 | 0.11 | 0.09 | 0.09 | 0.10 | 0.10 |

The weights sum to 1. By policy area, the weights are: transport 0.20, environment 0.20, social services 0.22, safety 0.18, and municipal services 0.20.

### 3. Citywide score

Davg=∑dpopd×DdD\_{\mathrm{avg}} = \sum\_d \mathrm{pop}\_d \times D\_d

This is the population-weighted average.

### 4. Final Score

Score=0.7×Davg+0.3×min⁡(Dd)−1.0×Ncrit\mathrm{Score} = 0.7 \times D\_{\mathrm{avg}} + 0.3 \times \min(D\_d) - 1.0 \times N\_{\mathrm{crit}}

Here, NcritN\_{\mathrm{crit}} is the number of **“district × indicator” pairs with a value strictly below 40** after all effects have been applied. Each such pair incurs a 1-point penalty.

The rationale behind the formula is that 70% of the weight goes to the overall citywide result and 30% to the weakest district, so that it is not possible to “polish up” one district and forget about Nura. The penalty for critical values prevents severe shortfalls from being left unaddressed.

**Baseline Score with no measures implemented: 52.56**

0.7×56.86+0.3×49.18−20.7 \times 56.86 + 0.3 \times 49.18 - 2

The two critical values are S1 and S2 in Nura.

**Example of a valid set:**

| # | Measure | District |
| - | ------- | -------- |
| 1 | M7      | Nura     |
| 2 | M8      | Nura     |
| 3 | M10     | Nura     |
| 4 | M12     | Citywide |
| 5 | M5      | Saryarka |

Total cost: **95**. Score ≈ **56.5** (**+4.0** relative to the baseline). The M10 + M12 synergy is triggered. Double-check this in code.

**The AI’s role:** The LLM receives the calculation results—changes by district and indicator, and each measure’s contribution—and explains them, compares sets of measures, and makes recommendations. It does not calculate or invent the numbers.

---

## 4. Rules

1. **Budget:** 100 notional units. Any unspent balance is retained but earns no bonus.

2. **Exactly 5 decisions**, not “up to 5”.

3. **No repeats.** Each measure may be selected at most once.

4. **District selection:** A district must be specified for “District”-type measures and must not be specified for “City”-type measures.

5. **No more than 2 measures from the same policy area.** This automatically means that at least 3 policy areas are covered.

6. **The incompatible combinations** listed in Section 2 are prohibited.

7. **Invalid set:** If any rule is violated, **Score = not calculated**, and the validator returns the reason.

8. The order of decisions does not matter.

**Existence of a valid solution:** The example in Section 3 is valid: 95 ≤ 100, 5 measures, no repeats, a 2/1/1/1 distribution across policy areas, and no conflicts. The cheapest set, M9 + M11 + M10 + M12 + M4, costs 61 and is also valid.

\</ts>