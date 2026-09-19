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

TWO ROOTS, TWO REGIMES (2026-09-19)
-----------------------------------
  client/src  — strict: any bare mark fails (as since 2026-09-10).
  server      — the same rule, but the 2026-09-19 Hebrew audit found ~700 bare
                marks already in customer SMS / push / email / SEO strings
                (259 on lines that also carry Hebrew). They are recorded in
                scripts/guards/trademark_bidi_server_baseline.txt as
                path<TAB>count. A file may not grow its count and no new file
                may appear; fixing a file and running --update-baseline
                shrinks the list. Only lines that also contain Hebrew or
                Arabic letters are counted on the server side — a mark in an
                English-only log line is not a customer-facing defect.

Two client files are exempt, deliberately:
  client/src/lib/i18n.ts  - t() appends the LRM at RUNTIME to every string it
                            returns, so anchoring the source too would emit a
                            doubled mark.
  client/src/lib/seo.ts   - emits <title>/<meta>/JSON-LD, i.e. machine-read
                            output. A bidi control character does not belong
                            in structured data.
"""
import os
import re
import sys

TM = '™'
LRM = '‎'
PDI = '⁩'
ESCAPED_PDI = '\\u2069'
RTL_LETTERS = re.compile(r'[֐-׿؀-ۿ]')

CLIENT_ROOT = os.path.join('client', 'src')
SERVER_ROOT = 'server'
SERVER_BASELINE = os.path.join('scripts', 'guards', 'trademark_bidi_server_baseline.txt')
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


def bare_marks(line: str):
    start = 0
    while True:
        idx = line.find(TM, start)
        if idx == -1:
            return
        if not is_anchored(line, idx + 1):
            yield idx
        start = idx + 1


def walk(root: str):
    for dirpath, _dirnames, filenames in os.walk(root):
        if 'node_modules' in dirpath:
            continue
        for name in filenames:
            if not name.endswith(('.ts', '.tsx')):
                continue
            yield os.path.join(dirpath, name)


def scan_client():
    offenders = []
    for path in walk(CLIENT_ROOT):
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
            for _ in bare_marks(line):
                offenders.append((path, lineno, line.strip()[:100]))
    return offenders


def scan_server() -> dict:
    """path -> count of bare marks on lines that also carry Hebrew/Arabic."""
    counts = {}
    for path in walk(SERVER_ROOT):
        if os.sep + 'tests' + os.sep in path or path.endswith(('.test.ts', '.test.tsx')):
            continue
        try:
            with open(path, encoding='utf-8') as handle:
                source = handle.read()
        except (OSError, UnicodeDecodeError):
            continue
        if TM not in source:
            continue
        n = 0
        for line in source.splitlines():
            if not RTL_LETTERS.search(line):
                continue
            n += sum(1 for _ in bare_marks(line))
        if n:
            counts[path] = n
    return counts


def read_baseline() -> dict:
    base = {}
    if not os.path.exists(SERVER_BASELINE):
        return base
    with open(SERVER_BASELINE, encoding='utf-8') as fh:
        for raw in fh:
            raw = raw.strip()
            if not raw or raw.startswith('#'):
                continue
            path, _, cnt = raw.rpartition('\t')
            base[path] = int(cnt)
    return base


def main() -> int:
    server = scan_server()
    if '--update-baseline' in sys.argv:
        with open(SERVER_BASELINE, 'w', encoding='utf-8') as fh:
            fh.write('# trademark_bidi_anchored.py — server files with bare ™ on Hebrew/Arabic lines (path<TAB>count). Shrink it, never grow it.\n')
            for path in sorted(server):
                fh.write(f'{path}\t{server[path]}\n')
        print(f'server baseline written: {len(server)} files, {sum(server.values())} bare marks on RTL lines')
        return 0

    offenders = scan_client()
    base = read_baseline()
    server_bad = [(p, c, base.get(p, 0)) for p, c in sorted(server.items()) if c > base.get(p, 0)]

    if not offenders and not server_bad:
        print('OK: every trademark mark is anchored to the word on its left.')
        print(f'    (server: {sum(server.values())} known bare mark(s) on RTL lines in {len(server)} file(s), none new)')
        return 0

    if offenders:
        print('BARE TRADEMARK MARK - would flip to the LEFT of the word in Hebrew/Arabic')
        print()
        for path, lineno, snippet in offenders:
            print(f'  {path}:{lineno}')
            print(f'      {snippet}')
        print()
        print(f'{len(offenders)} occurrence(s) in client/src.')
    if server_bad:
        print('BARE TRADEMARK MARK on a Hebrew/Arabic line in server/ — above the baseline')
        for path, c, allowed in server_bad:
            print(f'  {path}: {c} (baseline {allowed})')
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
