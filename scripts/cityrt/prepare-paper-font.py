#!/usr/bin/env python3
"""Regenerate the committed full-repertoire Shantell UI font, outside builds.

Requires fontTools 4.66.1 and Brotli 1.2.0 in an optional development environment.
It never installs dependencies. Ordinary builds use the committed WOFF2 asset.
The official original and OFL are never modified. No characters are subsetted.
"""
from argparse import ArgumentParser
from copy import deepcopy
from hashlib import sha256
import json
from pathlib import Path
from tempfile import TemporaryDirectory

ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / "src/design/assets"
SOURCE_SHA = "1473f076cf7ab16865ba2337841776cd67db4744f7bac3b4c36508a0a083dfa7"
UI_SHA = "3f8ec5de47e2434963564d87ffe873e3e2620707409ad11253894d098f4f7bfc"
WEIGHTS = [300, 500, 550, 650, 800]
INFORMALITIES = [0, 8]
KAZAKH = "ӘәҒғҚқҢңӨөҰұҮүҺһІі"

parser = ArgumentParser(description=__doc__)
parser.add_argument("--source", type=Path, default=ASSETS / "shantell-sans-variable.woff2")
parser.add_argument("--output", type=Path, default=ASSETS / "shantell-sans-ui-variable.woff2")
parser.add_argument("--provenance", type=Path)
args = parser.parse_args()
source = args.source.resolve()
output = args.output.resolve()
provenance_path = (args.provenance or output.with_suffix(".provenance.json")).resolve()
if source in {output, provenance_path} or output == provenance_path:
    raise SystemExit("The original, UI font and provenance must have separate paths")

try:
    import brotli
    import fontTools
    from fontTools.pens.recordingPen import DecomposingRecordingPen
    from fontTools.ttLib import TTFont
    from fontTools.varLib.instancer import instantiateVariableFont
    from fontTools.varLib.models import supportScalar
except ImportError as error:
    raise SystemExit("Optional regeneration requires fontTools 4.66.1 and Brotli 1.2.0; builds do not. " + str(error))

if fontTools.__version__ != "4.66.1" or brotli.__version__ != "1.2.0":
    raise SystemExit("Use pinned fontTools 4.66.1 and Brotli 1.2.0 for exact WOFF2 regeneration")


def digest(data):
    return sha256(data).hexdigest()


def unicode_maps(font):
    return sorted([(table.platformID, table.platEncID, table.language, sorted(table.cmap.items()))
                   for table in font["cmap"].tables if table.isUnicode()], key=repr)


def compiled_tables(font, names):
    return {name: digest(font[name].compile(font)) for name in names if name in font}


def numeric_diff(left, right):
    if isinstance(left, (int, float)) and isinstance(right, (int, float)):
        return abs(left - right)
    if isinstance(left, (list, tuple)) and isinstance(right, (list, tuple)) and len(left) == len(right):
        return max((numeric_diff(a, b) for a, b in zip(left, right)), default=0)
    return 0 if left == right else float("inf")


source_bytes = source.read_bytes()
assert digest(source_bytes) == SOURCE_SHA, "Official original checksum changed"
original = TTFont(source, recalcTimestamp=False)
axes = {axis.axisTag: {"min": axis.minValue, "default": axis.defaultValue, "max": axis.maxValue}
        for axis in original["fvar"].axes}
assert set(axes) == {"wght", "ital", "INFM", "BNCE", "SPAC"}, axes
pins = {axis: axes[axis]["default"] for axis in ["ital", "BNCE", "SPAC"]}
assert pins == {"ital": 0, "BNCE": 0, "SPAC": 0}, pins
candidate = instantiateVariableFont(original, pins, inplace=False, optimize=False)

# At these default pins, all removed supports evaluate to zero. The ordinary
# instancer expands sparse IUP deltas and rounds on save, altering interpolation.
# Preserve the source sparse tuples to keep the retained subspace exact instead.
removed, retained = 0, 0
variations = {}
for glyph, tuples in original["gvar"].variations.items():
    variations[glyph] = []
    for variation in tuples:
        pinned_support = {axis: support for axis, support in variation.axes.items() if axis in pins}
        if pinned_support:
            assert supportScalar({axis: 0 for axis in pins}, pinned_support) == 0, (glyph, pinned_support)
            removed += 1
        else:
            variations[glyph].append(deepcopy(variation))
            retained += 1
candidate["gvar"].variations = variations
candidate.flavor = "woff2"
glyph_order = original.getGlyphOrder()
tests = []

with TemporaryDirectory(prefix="alem-paper-font-") as temporary:
    candidate_path = Path(temporary) / "shantell-sans-ui-variable.woff2"
    candidate.save(candidate_path, reorderTables=False)
    candidate = TTFont(candidate_path, recalcTimestamp=False)
    candidate_bytes = candidate_path.read_bytes()
    candidate_axes = {axis.axisTag: {"min": axis.minValue, "default": axis.defaultValue, "max": axis.maxValue}
                      for axis in candidate["fvar"].axes}
    assert candidate_axes == {axis: axes[axis] for axis in ["wght", "INFM"]}
    assert glyph_order == candidate.getGlyphOrder()
    assert unicode_maps(original) == unicode_maps(candidate)
    assert all(ord(character) in candidate.getBestCmap() for character in KAZAKH)
    assert original["head"].unitsPerEm == candidate["head"].unitsPerEm
    assert original["glyf"].compile(original) == candidate["glyf"].compile(candidate)
    assert all(variations[glyph] == candidate["gvar"].variations[glyph] for glyph in glyph_order)
    assert all(original["avar"].segments[axis] == candidate["avar"].segments[axis] for axis in candidate_axes)

    for weight in WEIGHTS:
        for informality in INFORMALITIES:
            left = instantiateVariableFont(TTFont(source, recalcTimestamp=False),
                                           {**pins, "wght": weight, "INFM": informality}, inplace=False, optimize=False)
            right = instantiateVariableFont(TTFont(candidate_path, recalcTimestamp=False),
                                            {"wght": weight, "INFM": informality}, inplace=False, optimize=False)
            left_set, right_set = left.getGlyphSet(), right.getGlyphSet()
            for glyph in glyph_order:
                a, b = DecomposingRecordingPen(left_set), DecomposingRecordingPen(right_set)
                left_set[glyph].draw(a)
                right_set[glyph].draw(b)
                assert numeric_diff(a.value, b.value) == 0, (weight, informality, glyph, "outline")
                left_program = getattr(left["glyf"][glyph], "program", None)
                right_program = getattr(right["glyf"][glyph], "program", None)
                assert (left_program.getBytecode() if left_program else b"") == (right_program.getBytecode() if right_program else b""), (weight, informality, glyph, "hints")
            for names in [["hmtx", "vmtx", "hhea", "vhea", "OS/2"], ["cvt ", "fpgm", "prep", "gasp"], ["GSUB", "GPOS", "GDEF", "kern"]]:
                assert compiled_tables(left, names) == compiled_tables(right, names), (weight, informality, names)
            tests.append({"weight": weight, "INFM": informality, "glyphs": len(glyph_order),
                          "outlineDifferenceFontUnits": 0, "metricsHintsAndLayoutIdentical": True})
            print(f"PASS {len(glyph_order)} glyphs at wght={weight}, INFM={informality}", flush=True)

assert digest(candidate_bytes) == UI_SHA, "Regenerated UI bytes differ from the approved exact candidate"
assert digest(source.read_bytes()) == SOURCE_SHA, "Original font was modified during regeneration"
provenance = {
    "schema": 1,
    "source": {"file": "shantell-sans-variable.woff2", "url": "https://raw.githubusercontent.com/arrowtype/shantell-sans/1.011/fonts/Shantell%20Sans/Web/ShantellSans%5BBNCE%2CINFM%2CSPAC%2Cital%2Cwght%5D.woff2", "version": "1.011", "bytes": len(source_bytes), "sha256": SOURCE_SHA, "axes": axes},
    "ui": {"file": "shantell-sans-ui-variable.woff2", "bytes": len(candidate_bytes), "sha256": UI_SHA, "axes": candidate_axes},
    "generator": {"file": "scripts/cityrt/prepare-paper-font.py", "sha256": digest(Path(__file__).read_bytes()), "fontTools": fontTools.__version__, "Brotli": brotli.__version__},
    "transformation": {"pinnedAxes": pins, "characterSubset": False, "removedZeroSupportTuples": removed, "retainedExactSparseTuples": retained},
    "verification": {"glyphCount": len(glyph_order), "unicodeCodepoints": len(original.getBestCmap()), "cmapAndGlyphOrderIdentical": True, "baseGlyfBytesIdentical": True, "retainedGvarAndAvarIdentical": True, "unitsPerEmIdentical": True, "requiredKazakh": KAZAKH, "instances": tests},
}
output.parent.mkdir(parents=True, exist_ok=True)
provenance_path.parent.mkdir(parents=True, exist_ok=True)
output.write_bytes(candidate_bytes)
provenance_path.write_text(json.dumps(provenance, indent=2) + "\n", encoding="utf8")
print(json.dumps({"output": str(output), "bytes": len(candidate_bytes), "sha256": UI_SHA,
                  "savingsBytes": len(source_bytes) - len(candidate_bytes), "provenance": str(provenance_path)}, indent=2))
