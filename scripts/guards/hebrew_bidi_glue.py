#!/usr/bin/env python3
"""
HEBREW BIDI GLUE GUARD (2026-09-19) — the two patterns that render wrong for
every Hebrew customer and are invisible in an English code review.

1. A Hebrew prefix letter glued straight onto an interpolation:
       `תזכורת ל${petName}`   `שטיפה ב${station.city}`
   A Latin name after ל/ב/כ/מ/ו/ה/ש with no maqaf and no bidi isolate makes
   the prefix letter jump to the other side of the name. Write it
   `ל-⁦${petName}⁩` (maqaf + isolate) — or, when the value is
   known to be Hebrew, `ל${name}` is still wrong for a Latin-named pet.

2. A "+972…" phone example inside a Hebrew string with no isolation:
       'בפורמט בינלאומי (+972-50-123-4567)'
   The "+" is not part of the number run under the bidi algorithm, so it is
   placed by the Hebrew paragraph and lands at the far end. Wrap the whole
   example in U+2066 … U+2069 (or put U+200E before the "+"), as
   client/src/lib/identityChangeErrors.ts already does.

Numeric-only ranges ("24-48", "22:00-06:00", "₪30-80") are NOT flagged: the
bidi algorithm keeps digit-separator-digit runs left-to-right on its own.

Baseline: scripts/guards/hebrew_bidi_glue_baseline.txt lists the files that
were already wrong when this guard landed (path<TAB>count). A file may not
grow its count; a new offending file fails. `--update-baseline` rewrites the
file after you fix or add strings deliberately.
"""
import os
import re
import sys

ROOTS = [os.path.join('client', 'src'), 'server', 'shared']
BASELINE = os.path.join('scripts', 'guards', 'hebrew_bidi_glue_baseline.txt')
HEBREW = re.compile(r'[֐-׿]')
ISOLATE_OR_LRM_BEFORE = ('⁦', '⁧', '⁨', '‎', '‏')

# Prefix letter directly followed by a template interpolation.
GLUE = re.compile(r'[לבכמוהש]\$\{')
# "+972" with no LRM / isolate immediately before the "+".
PHONE = re.compile(r'(?<![⁦⁧⁨‎‏\w])\+972')


def count_line(line: str) -> int:
    if not HEBREW.search(line):
        return 0
    stripped = line.lstrip()
    if stripped.startswith(('//', '*', '/*')):
        return 0
    n = len(GLUE.findall(line))
    for m in PHONE.finditer(line):
        # A "+972" inside an isolate opened earlier on the line is fine.
        before = line[:m.start()]
        if before.count('⁦') > before.count('⁩'):
            continue
        n += 1
    return n


def scan() -> dict:
    found = {}
    for root in ROOTS:
        for dirpath, _d, filenames in os.walk(root):
            if 'node_modules' in dirpath or os.sep + 'tests' in dirpath or '__tests__' in dirpath:
                continue
            for name in filenames:
                if not name.endswith(('.ts', '.tsx')) or name.endswith(('.test.ts', '.test.tsx')):
                    continue
                path = os.path.join(dirpath, name)
                try:
                    with open(path, encoding='utf-8') as fh:
                        lines = fh.read().splitlines()
                except (OSError, UnicodeDecodeError):
                    continue
                c = sum(count_line(l) for l in lines)
                if c:
                    found[path] = c
    return found


def read_baseline() -> dict:
    base = {}
    if not os.path.exists(BASELINE):
        return base
    with open(BASELINE, encoding='utf-8') as fh:
        for raw in fh:
            raw = raw.strip()
            if not raw or raw.startswith('#'):
                continue
            path, _, cnt = raw.rpartition('\t')
            base[path] = int(cnt)
    return base


def main() -> int:
    found = scan()
    if '--update-baseline' in sys.argv:
        with open(BASELINE, 'w', encoding='utf-8') as fh:
            fh.write('# hebrew_bidi_glue.py baseline — path<TAB>count of known offenders. Shrink it, never grow it.\n')
            for path in sorted(found):
                fh.write(f'{path}\t{found[path]}\n')
        print(f'baseline written: {len(found)} files, {sum(found.values())} occurrences')
        return 0
    base = read_baseline()
    bad = []
    for path, c in sorted(found.items()):
        allowed = base.get(path, 0)
        if c > allowed:
            bad.append((path, c, allowed))
    total = sum(found.values())
    if not bad:
        print(f'OK: Hebrew bidi glue — {total} known occurrence(s) in {len(found)} file(s), none new.')
        return 0
    print('HEBREW BIDI GLUE — a prefix letter glued to ${…} or a bare +972 inside Hebrew (renders reversed for every Hebrew customer)')
    for path, c, allowed in bad:
        print(f'  {path}: {c} (baseline {allowed})')
    print()
    print('FIX: ל-\\u2066${name}\\u2069 (maqaf + isolate) and \\u2066+972…\\u2069. See .claude/skills/petwash-hebrew-rtl/SKILL.md.')
    return 1


if __name__ == '__main__':
    sys.exit(main())
