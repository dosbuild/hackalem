# Five fixed-price decisions

The player chooses a need, visits its place and confirms the displayed project
price. The remaining budget and five independent plan slots stay above the city.
The full fourteen-project catalogue is secondary. No money gesture or hidden
allocation is required to play.

The earlier fluid-budget accounting remains in the reducer for compatible saved
drafts and meaningful invariant tests. The current player flow uses exact fixed
prices and one authoritative plan.

## Contract

- Exactly five distinct initiatives, at most two per policy area, 100 units and
  all scoped incompatibilities come from `src/domain/scenario.ts`.
- Choosing a card allocates its exact proposal price without spending it.
  Only confirmation commits a decision. Preview, camera movement, conversations,
  the optional demonstration and help do not spend.
- Every offered story leaves at least one valid five-decision completion. The
  catalogue explains blocked choices before they can strand the plan.
- Replacement keeps the original project and its budget until confirmation.
  Confirmation refunds the old cost and charges the new cost exactly. Cancellation
  preserves the original plan. Removal returns the full fixed price.
- The existing accounting invariant remains **free + fluid + locked = 100**.
  Visual state never scales numerical effects or edits committed decisions.
- Five visible slots represent decisions, independently of policy area. Clicking a
  filled slot opens its price, scope, consequences and edit/remove actions.
- Only actual decisions and construction receipts are persisted. Aya uses the
  same reducer, validation, exact prices and eight-quarter evaluator.

## Verification

Run `npm run verify`, then use an isolated production test server for browser
checks. `npm run test:budget` exercises actual pointer and touch choices, priced
previews, scoped conflicts, replacement, cancellation, refund and all fourteen
catalogue entries. `npm run test:fullscreen` covers camera and resident continuity.
`test:refinement` and `test:integration` cover alternative plans, assistant actions,
restore, storage/provider failures, council and the registry.

Set `APP_URL` and `ALEM_URL` to the isolated server, and `RELEASE_OUTPUT` to a
separate artifact folder per script. Do not write registry test entries into a
user's real data directory. No physical-phone or new-player study is claimed.
