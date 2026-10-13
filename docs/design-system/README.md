# Alem interface design package

Alem is an illustrated city game. The map, landmarks, people, project illustrations,
and geographic colours carry its identity. The interface helps people understand
that world and act with confidence. Its platform-inspired conventions are implemented
for the web; this is not a claim of native platform rendering or Apple endorsement.

## Visual hierarchy

Use a quiet navigation layer, a clear reading surface, and one prominent action in
each decision. Keep geographic context visible around the active sheet. Treat an
open sheet as one task, rather than opening several competing cards over the map.

The interface system is implemented in `src/ui/finish.css`. Responsive placement and
occlusion remain in `src/ui/city-shell.css`. Renderer colours remain in
`src/design/palette.js`; interface tokens must not recolour the city.

| Role | Value | Reason |
| --- | --- | --- |
| Interface type | `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, Noto Sans fallback | Familiar controls with Cyrillic and Kazakh coverage |
| Wordmark | Existing bold Noto Sans | Retains the game's authored identity |
| Main heading | Existing 25–28 px responsive size, weight 650, line-height 1.2 | Strong orientation without decorative display typography |
| Reading text | 14–15 px, line-height 1.55–1.6 | Comfortable reading within map overlays |
| Supporting labels | 12–13 px | Detail remains legible and subordinate |
| Financial values | Tabular lining numerals | Stable width when budget values change |
| Reading surface | `#f7f9f8` | Slight separation from pure-white cards |
| Card surface | `#ffffff` | Clear grouping without paper texture |
| Primary text | `#20332d` | A dark, warm green tied to the city palette |
| Secondary text | `#586b63` | Readable hierarchy against light surfaces |
| Action | `#256b5b` | One consistent semantic colour for consequential actions |
| Group tint | `#edf3ef` | Soft secondary controls and grouped data |
| Separator | `#e0e7e2` | Division without a heavy box around every detail |
| Control radius | 12 px | Compact, approachable controls |
| Card radius | 16 px | Distinct internal grouping |
| Sheet radius | 24 px | A coherent outer container with smaller nested shapes |
| Icon dismiss controls | Circle | Familiar close affordance, visually secondary |

Spacing follows 4, 8, 12, 16, and 24 px increments wherever the component layout
allows. Content-rich panels use 20–24 px insets on desktop and 16–18 px on phones.
Primary actions and icon controls retain a minimum 44 px touch area; the compact
phone epoch selector uses 40 px segments within its grouped control. Responsive dimensions are
content constraints rather than an instruction to shrink labels until they fit.

## Component decisions

- **Navigation:** A lightly translucent floating surface separates app commands from
  the map. Selected destinations use a teal tint; the primary project action owns
  the strongest solid colour. Do not use selected-navigation styling for actions.
- **Segmented controls:** Mode, time, and analytical views sit on one quiet track.
  Their white selected segment is identified by a slight shadow and stronger label.
- **Sheets and dialogs:** Reading surfaces are opaque. Text should not compete with
  roads or buildings visible beneath it. Dialogs keep native dialog keyboard and
  focus behaviour. A scrim and limited blur distinguish modal interruption.
- **Resident choices:** Preserve portraits and first-person needs. White cards,
  steady spacing, and a secondary project row connect the person to the action.
- **Budget:** A tinted balance block makes available funds scannable; tabular numbers
  prevent visual shifts. Costs are informational badges, not primary buttons.
- **Catalogue:** One illustrated row per project replaces cramped paired cards in
  the narrow side sheet. Title and fixed price share the first line; benefit and
  availability follow. Full names stay readable, with all fourteen choices scrollable.
- **Analysis and residents:** Group related information on white panels. Use
  separators for repeated rows; avoid multiple heavy frames inside one surface.
- **Aya:** Use the same type, controls, and materials as the game. Conversation
  direction is communicated by bubble shape and colour, while the mascot retains
  the emotional character of the assistant.
- **Map commands:** Authored SVG symbols share a 24-point grid and 1.7 px round
  strokes. Camera rotation and tilt use simpler shapes legible at 20–22 px.
  `ControlIcon.tsx` owns command icons; project illustrations remain separate.

## Motion and accessibility

| Interaction | Duration | Behaviour |
| --- | --- | --- |
| Press feedback | 120 ms | Selected buttons gently scale to .98 |
| Hover / selection | 180 ms | Colour, border, and elevation respond |
| Surface arrival | 260 ms | Opacity reveal, avoiding movement of map occluders |
| New Aya message | 180 ms | Opacity and 4 px upward arrival |

The settling curve is `cubic-bezier(.2,.8,.2,1)`. Hover does not lift or rotate the
map, its labels, or its residents. World-space anchors must follow only the renderer's
shared camera projection. Reduced motion disables these interface transitions and
animations. Keyboard focus remains clearly outlined; forced-colour mode restores
explicit surface boundaries and selected-state outlines. Native buttons, selects,
dialogs and the existing keyboard interactions remain the interaction foundation.

## Acceptance evidence

Inspect the actual game at desktop and phone widths, including short windows and
long labels. Check city and historical modes; projects, proposal, budget, help,
residents, analysis, map controls and Aya; selection, disabled, focus, hover, and
expanded states. Verify that active panels and fixed controls do not overlap, content
scrolls within its intended surface, and actions remain reachable. Run the existing
production verification and relevant browser journeys before committing.

## Responsive and interaction details

Phone proposals anchor above bottom navigation and size to their content. Expanded
details use the available height. On short phones, the resident story and project
action precede the roster; this keeps the quote readable without a sticky button
covering it. Resident topic controls divide the available width. Landscape panels
scroll internally rather than shrinking text or overflowing the viewport.

Camera settings expose named zoom, rotation and tilt controls. Tab moves from the
settings trigger into the palette; Escape closes it and restores that trigger.
Dialogs open on their heading and restore the opener after closing. Archive return
waits for its trigger to render before restoring focus. Aya begins a new conversation
at the start of the greeting and removes empty control space on short screens.

Run `npm run test:design` against the built application for both eras at 1440×900,
390×844, 360×640 and 832×390. It checks native hit targets, readable resident stories,
chat history, labelled camera controls, focus restoration and complete result actions.
Evidence is written to `artifacts/design/`; `RELEASE_OUTPUT` overrides that location.
