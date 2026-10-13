# Art for the five-decision redesign

Created 3 October 2026 for the existing Alem game. The final runtime assets are:

- `public/aya/guide-atlas.png`: 1536 × 1024 PNG, transparent alpha, six 512 × 512
  cells. Generated with the built-in ImageGen tool in one generation call, with
  `transparent_background: true`. No CLI fallback or external API credential used.
- `public/aya/guide-idle.webp`: lossless 512 × 512 copy of the atlas's top-left idle cell. The full atlas is unchanged; this transmission asset retains exact decoded RGBA pixels and loads for the idle state. Other expressions request the original atlas when needed.
- `public/alem/brand.svg`: code-native city, river and sun mark. The header uses
  the corresponding SVG in `src/ui/Brand.tsx` and the Әлем wordmark.
- `src/ui/ResidentPortrait.tsx`: code-native SVG portraits derived from the existing
  resident identity registry, also used on need cards, proposals and results.
- `src/world/resident-models.js`: the corresponding native world people retain
  their identities and geography, with clearer heads, eyes, cheeks and clothing.

The six former plush-cloud images and winter illustration remain authoring
history; the release allowlist no longer ships them. The new guide is decorative:
all assistant states and controls retain readable text if its image fails.

## Exact final generation prompt

Create a polished game UI character sprite sheet, transparent background, 3 columns by 2 rows, six equal square cells, each containing the SAME original friendly tiny cloud city-guide character with six different expressions. This is ONE functional sprite atlas for a thoughtful city planning game set in Astana. Art style: clean contemporary hand-drawn vector-like illustration, flat warm cream body, thin dark deep teal outlines, tiny charcoal oval eyes, subtly rosy cheeks, small expressive hands; a small ochre scarf tied on its left side and a single mint green leaf-shaped tuft make it recognizable. Character is a soft compact asymmetrical cloud with only three rounded lobes, NOT a plush toy, NOT a 3D render, NOT a ghost. Broad simple shapes, limited cream/teal/ochre palette, readable at 56 pixels. Full body centered consistently in every cell, generous equal empty transparent margins, no overlap, no frames, no lettering, no text, no shadow outside the character. Top row left to right: welcoming neutral smile with one hand raised; thinking with hand at chin and upward glance; attentive concerned expression with small raised hand. Bottom row left to right: explaining with open hand gently pointing right; quiet pleased celebratory expression with both hands up; sympathetic apologetic expression, gently lowered hands. Keep outline weight, proportions and accessories identical across all six poses. Front/three-quarter face view. The six characters each fill about 72 percent of their square cell. Transparent alpha outside all six characters.

## Atlas mapping

Top row: idle, thought, attention. Bottom row: explanation, success, error.
CSS background-size is `300% 200%`. The control-size montage and in-product
screenshots are in the isolated `artifacts/play-redesign/assistant-*` test folders.
