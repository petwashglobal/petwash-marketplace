#!/usr/bin/env python3
"""
CEO BRAND RULE (2026-09-10): the trademark mark must ALWAYS sit to the RIGHT
of the word it belongs to, in EVERY language — Hebrew and Arabic included.

WHY THIS NEEDS A GUARD AND NOT JUST A CONVENTION
------------------------------------------------
U+2122 (TM) is a bidi-NEUTRAL character. In an RTL paragraph a trailing
neutral resolves to the PARAGRAPH direction, not to the direction of the Latin
run it was typed next to. So `PetWash<TM>` typed in a Hebrew screen renders
with the mark flipped to the LEFT of the word.

Measured in a Hebrew (dir=rtl) paragraph, glyph positions:

    bare      PetWash<TM>            mark 93px to the LEFT of the word   WRONG
    anchored  PetWash<TM><LRM>       mark exactly at the word's right    RIGHT
    isolated  <LRI>PetWash<TM><PDI>  mark exactly at the word's right    RIGHT

Both anchored forms are correct; this guard accepts either, because the
codebase already contains ~1330 of the isolate form and there is no reason to
churn them.

THE FAILURE MODE THIS CATCHES
-----------------------------
Nothing about a bare TM looks wrong in an English screen, in a code review, or
in a diff — it is only wrong once a Hebrew visitor loads the page. That is
precisely the kind of defect that comes back silently, which is why it is
pinned in CI rather than written in a style doc.

Two files are exempt, deliberately:
  client/src/lib/i18n.ts  - t() appends the LRM at RUNTIME to every string it
                            returns, so anchoring the source too would emit a
                            doubled mark.
  client/src/lib/seo.ts   - emits <title>/<meta>/JSON-LD, i.e. machine-read
                            output. A bidi control character does not belong
                            in structured data.
"""
import os
import sys

TM = '™'
LRM = '‎'
PDI = '⁩'
ESCAPED_PDI = '\\u2069'

ROOT = os.path.join('client', 'src')
EXEMPT = {
    os.path.join('client', 'src', 'lib', 'i18n.ts'),
    os.path.join('client', 'src', 'lib', 'seo.ts'),
}


def is_anchored(text: str, end: int) -> bool:
    """True when the mark at [end-1] is pinned to the run on its left."""
    if text[end:end + 1] in (LRM, PDI):
        return True
    # The isolate may be written as a JS escape rather than a literal.
    return text[end:end + len(ESCAPED_PDI)] == ESCAPED_PDI


def main() -> int:
    offenders = []
    for dirpath, _dirnames, filenames in os.walk(ROOT):
        for name in filenames:
            if not name.endswith(('.ts', '.tsx')):
                continue
            path = os.path.join(dirpath, name)
            if path in EXEMPT:
                continue
            try:
                with open(path, encoding='utf-8') as handle:
                    source = handle.read()
            except (OSError, UnicodeDecodeError):
                continue
            if TM not in source:
                continue
            for lineno, line in enumerate(source.splitlines(), start=1):
                start = 0
                while True:
                    idx = line.find(TM, start)
                    if idx == -1:
                        break
                    if not is_anchored(line, idx + 1):
                        offenders.append((path, lineno, line.strip()[:100]))
                    start = idx + 1

    if not offenders:
        print('OK: every trademark mark is anchored to the word on its left.')
        return 0

    print('BARE TRADEMARK MARK - would flip to the LEFT of the word in Hebrew/Arabic')
    print()
    for path, lineno, snippet in offenders:
        print(f'  {path}:{lineno}')
        print(f'      {snippet}')
    print()
    print(f'{len(offenders)} occurrence(s).')
    print()
    print('FIX: put a U+200E LEFT-TO-RIGHT MARK immediately after the mark')
    print('     ("...<TM>" -> "...<TM><LRM>"), or wrap the whole product name')
    print('     in U+2066 ... U+2069 as most of this codebase already does.')
    return 1


if __name__ == '__main__':
    # `--fail` is accepted for symmetry with the other guards in
    # petwash-ci.yml. This guard has no advisory mode: a bare mark is wrong in
    # Hebrew every time, so it always exits non-zero on a finding.
    sys.exit(main())
