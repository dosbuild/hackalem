# Interface review — 13 October 2026

Three native specialist agents contributed a visual-system pass, an interaction and
content pass, and an independent review of the running application. No Apple
employment, endorsement or native-platform implementation is claimed.

The initial review found dense catalogue cards, inconsistent type and corners,
unlabelled camera adjustments, phone proposal positioning, and short-screen reading
problems. The independent reviewer rechecked the resident quote, topic controls and
Aya at 360×640 after corrections and found the reported obstructions resolved.

## Verification

| Check | Result |
| --- | --- |
| `npm run verify` | 74 test files, 631 tests passed; font, preview, world, landmark, historical-mode, production-build and geometry checks passed |
| `scripts/integration/layout.mjs` | 171 checks passed at 1440×900, 1280×720, 775×803, 390×844 and 360×640 |
| `npm run test:fullscreen` | Complete five-decision journey, persistence, reduced motion and shared-camera anchor audit passed |
| `scripts/assistant/verify.mjs` | 15 checks passed, including undo, persistence, focus restoration and rendered contrast of 6.30:1 for user messages |
| `npm run test:design` | 99 checks passed across both eras, four viewport sizes, and completed result sheets at three sizes |
| Focus review | Camera Tab/Escape, native guide and comparison dialogs, archive return and complete results navigation passed |
| Final source checks | TypeScript and `git diff --check` passed |

The layout audit scrolls to every catalogue choice and checks native pointer hits;
it does not treat a present DOM node as proof that an action is usable. The design
regression checks complete quote visibility, internal scroll access, camera palette
reachability, composer exposure, focus return and result-card overflow. The final
material pass also aligns loading, recovery and result-card corners with the shared
system; it changes no game calculations.

Evidence for this work is stored locally under `artifacts/apple-design/`:

- `before/` and `final/`: real application captures.
- `review.html`: before-and-after gallery.
- `layout/report.json`, `final/report.json`, `fullscreen/`, `assistant/report.json`:
  browser evidence.
- `verify.log`, `final-build.log`: required source and build checks.

The first sandboxed verification attempt could not bind the test HTTP servers. It
was rerun with local-server permission and all 631 tests passed. A layout run during
hot reload timed out without a browser exception; the settled build was rechecked.
The landscape design audit initially caught off-screen resident topic controls;
the labels now fit and remain accessible by the sheet's native scroll.

No browser exceptions remained in the passing runs. Browser screenshots and touch
emulation do not establish physical-handset or software-keyboard compatibility.
No deployment or production user data was changed.
