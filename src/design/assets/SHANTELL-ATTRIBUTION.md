# Shantell Sans

The official Shantell Sans 1.011 variable WOFF2 web build is preserved locally
as `shantell-sans-variable.woff2`, unchanged, with all five variation axes.
The application loads the separate `shantell-sans-ui-variable.woff2` version.
Both contain the full original Latin, Cyrillic and extended Cyrillic repertoire;
no characters are subsetted. These assets are not loaded from a CDN.

The UI version retains variable `wght` 300–800 and `INFM` 0–100. It pins the unused
`ital`, `BNCE` and `SPAC` axes to their original default zero. The original sparse
variation tuples for retained axes are preserved exactly: ordinary axis
instancing would expand and round IUP deltas. All removed tuples have zero support
at those defaults. The base glyph bytes, retained tuples and cmap are unchanged.
All 1,728 native glyph outlines match at weights 300, 500, 550, 650 and 800, each
at INFM 0 and 8, with identical metrics, hints and shaping tables. The verified
INFM=8 variation remains available for the handwritten time annotations.

- Project conception and creative direction: Shantell Martin.
- Type design and development: Arrow Type / Stephen Nixon.
- Cyrillic type design: Anya Danilova.
- Additional support: Google Fonts.
- License: SIL Open Font License 1.1, preserved in `SHANTELL-OFL.txt`.
- Official source: https://github.com/arrowtype/shantell-sans/tree/1.011
- Download: https://raw.githubusercontent.com/arrowtype/shantell-sans/1.011/fonts/Shantell%20Sans/Web/ShantellSans%5BBNCE%2CINFM%2CSPAC%2Cital%2Cwght%5D.woff2

Original: 726,944 bytes, SHA256
`1473f076cf7ab16865ba2337841776cd67db4744f7bac3b4c36508a0a083dfa7`.
UI version: 355,796 bytes, SHA256
`3f8ec5de47e2434963564d87ffe873e3e2620707409ad11253894d098f4f7bfc`.
The adjacent `shantell-sans-ui-variable.provenance.json` records both files,
the exact axis projection, generation script checksum and verification samples.

The reproducible development-only generator uses fontTools 4.66.1 and
Brotli 1.2.0 (verified with Python 3.12.14). With those optional tools available,
run from the repository root:

```sh
python3 scripts/cityrt/prepare-paper-font.py
```

The generator verifies the official original checksum, all glyph comparisons,
and the approved UI checksum before writing the separate UI asset/provenance.
The committed UI asset is used by ordinary builds; they require no Python or
font tooling dependencies. The unmodified original font and `SHANTELL-OFL.txt`
are retained as source and license evidence.

Recheck authored Cyrillic and Kazakh character coverage with
`npm run test:fonts`. The checker reads the local WOFF2 cmap,
not a remote font or a claimed language list. The audit also verifies both font
hashes, full cmap equality, retained axes and regeneration provenance. Both release builds copy this
attribution and the unmodified license into their `licenses/` directory.
