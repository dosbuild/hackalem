# “Mayor for 5 Hours” — AI City Management Simulator

Formatted transcription of the task brief supplied to this project. The [verbatim task text](mayor-for-5-hours.original.txt) preserves the original wording and pasted notation. This version normalizes spacing and duplicated equation notation only. It contains the assignment, not later implementation decisions; see the [requirements mapping](../requirements.md) and [calculation audit](../calculation-audit.md) for those.

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

|Criterion|Evaluation Focus|Points|
|---|---|---|
|Alignment with the task and functionality|Evaluates how well the solution matches the stated objective and enables the core scenario described in the task.|25|
|Technical implementation|Evaluates the quality of the technical implementation: chosen approach, architecture, component interaction, and the use of AI/agentic AI and other technologies. The actual implementation should align with the project logic and concept.|25|
|README and reproducibility|Evaluates whether the documentation clearly explains the project structure, technologies used, setup instructions, and main workflow. Also considers whether the solution can be reproduced and validated based on the repository materials.|25|
|Solution value and applicability|Evaluates how effectively the solution addresses the stated problem and considers the practical applicability of the proposed approach.|15|
|Scalability potential and originality of approach|Evaluates the potential for further development, broader application, and the presence of well-grounded innovative or unconventional approaches to solving the task.|10|
|**Total**|—|**100**|

## 1. District Dataset

**All indicators use a 0–100 scale, where higher is better.** All indicators are oriented in the same direction, so problems such as congestion or smog have already been reverse-coded (100 = no problem).

|Code|Policy Area|Indicator|What 100 / 0 Means|
|---|---|---|---|
|T1|Transport|Road congestion relief|100 = no congestion during peak hours; 0 = complete gridlock|
|T2|Transport|Public transport accessibility|100 = all residents are within 500 m of a stop with service intervals of ≤10 minutes|
|E1|Environment|Green space provision|100 = ≥20 m² of green space per resident|
|E2|Environment|Air quality|100 = winter AQI ≤50; 0 = chronic smog|
|S1|Social Services|Schools and kindergartens|100 = 100% of demand under the applicable provision standards is met, with no second-shift classes|
|S2|Social Services|Polyclinics and primary healthcare|100 = per-capita provision standards are fully met|
|B1|Safety|Street safety|100 = lighting and cameras everywhere, with a minimal number of incidents|
|B2|Safety|Road safety|100 = a minimal number of road crashes involving casualties|
|C1|Municipal Services|Reliability of housing and utility services|100 = no heating or water system failures over the year|
|C2|Municipal Services|Speed of resolving residents’ requests|100 = all requests are closed within the required timeframe|

**Baseline values:**

|District|Population Share|T1|T2|E1|E2|S1|S2|B1|B2|C1|C2|Overall D|
|---|---|---|---|---|---|---|---|---|---|---|---|---|
|Esil|0.27|45|62|68|72|48|55|78|60|75|70|62.99|
|Almaty|0.24|40|75|50|55|60|65|62|52|50|60|57.06|
|Saryarka|0.20|50|70|42|40|62|68|58|55|45|55|54.65|
|Baikonur|0.13|52|68|55|50|58|60|52|58|55|58|56.63|
|Nura|0.16|55|40|45|65|38|35|55|50|60|50|49.18|

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

|ID|Policy Area|Measure|Type|Cost|Lag|Full Effects Before Lag Adjustment|
|---|---|---|---|---|---|---|
|M1|Transport|Dedicated bus lanes|District|18|2|T1 +6, T2 +9|
|M2|Transport|Smart traffic lights (adaptive control)|City|22|2|T1 +4, B2 +3|
|M3|Transport|LRT line / expansion|District|30|4|T1 +16, T2 +20, E2 +4|
|M4|Environment|Park / small public garden|District|15|2|E1 +12, E2 +3, B1 +2|
|M5|Environment|Switching private homes to clean fuel|District|25|3|E2 +14, C1 +4|
|M6|Environment|Citywide greening and windbreak planting programme|City|20|4|E1 +5, E2 +3|
|M7|Social Services|School + kindergarten (modular construction)|District|24|3|S1 +16|
|M8|Social Services|Family health centre / polyclinic|District|20|3|S2 +14|
|M9|Social Services|Sports hubs in residential courtyards|District|10|1|S1 +3, S2 +3, B1 +3|
|M10|Safety|Lighting and cameras (Safe City expansion)|District|12|1|B1 +12, B2 +2|
|M11|Safety|Safe crossings and school zones|District|10|1|B2 +12, T1 −2|
|M12|Municipal Services|Unified digital platform for residents’ requests|City|14|1|C2 +5|
|M13|Municipal Services|Modernisation of heating and water networks|District|28|4|C1 +18, E2 +2|
|M14|Municipal Services|Utility emergency response crews + early warning|City|16|1|C1 +5, C2 +2|

**Synergies.** A bonus applies when both measures are selected. For “District”-type measures, the bonus is applied in the district selected for the first measure in the pair. The bonus is fixed and is not scaled by the lag.

|Pair|Bonus|
|---|---|
|M1 + M2|T1 +2 in the district selected for M1|
|M10 + M12|B1 +2 in the district selected for M10|
|M5 + M6|E2 +2 in the district selected for M5|

**Incompatibilities:**

- **M1 and M3:** Either BRT or LRT; the two cannot be selected together, regardless of district.
- **M4 and M7:** Cannot be implemented in the same district because they compete for the same site.
- **M5 and M13:** Cannot be implemented in the same district because the programmes overlap.

---

## 3. Score Formula

The calculation proceeds in the following steps.

### 1. Updated indicator value

For each district $d$ and indicator $k$:

$$
I'_{dk} = \operatorname{clip} \left( I_{dk} + \sum_m \mathrm{effect}_{m,k}\times\frac{8-L_m}{8} + \mathrm{synergies}, \ 0,\ 100 \right)
$$

### 2. District score

$$
D_d = \sum_k w_k \times I'_{dk}
$$

Indicator weights:

|Indicator|T1|T2|E1|E2|S1|S2|B1|B2|C1|C2|
|---|---|---|---|---|---|---|---|---|---|---|
|w_k|0.10|0.10|0.09|0.11|0.11|0.11|0.09|0.09|0.10|0.10|

The weights sum to 1. By policy area, the weights are: transport 0.20, environment 0.20, social services 0.22, safety 0.18, and municipal services 0.20.

### 3. Citywide score

$$
D_{\mathrm{avg}} = \sum_d \mathrm{pop}_d \times D_d
$$

This is the population-weighted average.

### 4. Final Score

$$
\mathrm{Score} = 0.7 \times D_{\mathrm{avg}} + 0.3 \times \min(D_d) - 1.0 \times N_{\mathrm{crit}}
$$

Here, $N_{\mathrm{crit}}$ is the number of **“district × indicator” pairs with a value strictly below 40** after all effects have been applied. Each such pair incurs a 1-point penalty.

The rationale behind the formula is that 70% of the weight goes to the overall citywide result and 30% to the weakest district, so that it is not possible to “polish up” one district and forget about Nura. The penalty for critical values prevents severe shortfalls from being left unaddressed.

**Baseline Score with no measures implemented: 52.56**

$$
0.7 \times 56.86 + 0.3 \times 49.18 - 2
$$

The two critical values are S1 and S2 in Nura.

**Example of a valid set:**

|#|Measure|District|
|---|---|---|
|1|M7|Nura|
|2|M8|Nura|
|3|M10|Nura|
|4|M12|Citywide|
|5|M5|Saryarka|

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
