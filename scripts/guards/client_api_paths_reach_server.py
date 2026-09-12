#!/usr/bin/env python3
"""
A CLIENT PATH THAT ISN'T FORWARDED GETS THE SPA, NOT THE SERVER.

Firebase Hosting forwards only a short list of prefixes to Cloud Run
(firebase.json rewrites: /api/**, /auth/**, /uploads/**, plus a few exact
files). EVERY other path falls through to the `**` rewrite and is answered
with index.html — status 200, content-type text/html.

So a client call to a non-forwarded path does not 404. It gets a page.
`res.json()` throws, TanStack Query stores `undefined`, and the component
silently takes its fallback branch. Nothing is logged. Nothing looks broken.

That is not theory. Found on production 2026-09-13:

  usePaymentStatus()  queryKey ['/payment-status']
      → GET https://petwash.co.il/payment-status  → 200 text/html
      → SyntaxError: Unexpected token '<'
      → data undefined → `paymentsEnabled = data?.nayax?.enabled ?? false`
      → /buy-gift-card rendered "Gift Cards — Coming Soon!" FOREVER,

while all four Nayax secrets were live in Cloud Run and the server would have
answered `{"nayax":{"enabled":true}}`. The till was closed by a URL prefix.

This guard fails when a NEW client path is added that Hosting will not forward.
Today's known-bad set is frozen in the baseline beside this file, each with a
reason, exactly like scripts/guards/no_new_unreachable_route.py.

TO ADD A PATH DELIBERATELY (a Hosting-served asset, an external URL): put it in
the baseline with a one-line reason. That is a thirty-second edit and it forces
the question to be answered out loud.
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FIREBASE = os.path.join(ROOT, 'firebase.json')
CLIENT = os.path.join(ROOT, 'client', 'src')
BASELINE = os.path.join(ROOT, 'scripts', 'guards', 'client_api_paths_baseline.txt')

# queryKey: ['/foo/bar', …]  ·  getApiUrl('/foo')  ·  apiRequest('GET', '/foo')
PATTERNS = [
    re.compile(r"""queryKey:\s*\[\s*['"](/[^'"]*)['"]"""),
    re.compile(r"""getApiUrl\(\s*['"](/[^'"]*)['"]"""),
    re.compile(r"""apiRequest\(\s*['"](?:GET|POST|PUT|PATCH|DELETE)['"]\s*,\s*['"](/[^'"]*)['"]"""),
]


def forwarded_prefixes() -> tuple[list[str], set[str]]:
    """(glob prefixes like '/api/', exact paths like '/robots.txt') from firebase.json."""
    with open(FIREBASE, encoding='utf-8') as fh:
        cfg = json.load(fh)
    hosting = cfg.get('hosting')
    hosting = hosting[0] if isinstance(hosting, list) else hosting
    prefixes, exact = [], set()
    for rw in hosting.get('rewrites', []):
        src = rw.get('source', '')
        if not rw.get('run') and not rw.get('function'):
            continue  # the catch-all '**' → SPA is exactly what we are guarding against
        if src.endswith('/**'):
            prefixes.append(src[:-2])       # '/api/**' → '/api/'
        elif '*' not in src:
            exact.add(src)
    return prefixes, exact


def read_baseline() -> set[str]:
    if not os.path.exists(BASELINE):
        return set()
    out = set()
    with open(BASELINE, encoding='utf-8') as fh:
        for line in fh:
            line = line.strip()
            if line and not line.startswith('#'):
                out.add(line.split('#')[0].strip())
    return out


def main() -> int:
    fail = '--fail' in sys.argv
    prefixes, exact = forwarded_prefixes()
    baseline = read_baseline()

    found: dict[str, set[str]] = {}
    for dirpath, _dirs, files in os.walk(CLIENT):
        for name in files:
            if not name.endswith(('.ts', '.tsx')):
                continue
            if name.endswith(('.test.ts', '.test.tsx')):
                continue
            path = os.path.join(dirpath, name)
            with open(path, encoding='utf-8', errors='replace') as fh:
                src = fh.read()
            for pat in PATTERNS:
                for m in pat.finditer(src):
                    p = m.group(1)
                    # A key that is not a URL (a cache namespace) is fine.
                    if p in exact or any(p.startswith(pre) for pre in prefixes):
                        continue
                    found.setdefault(p, set()).add(os.path.relpath(path, ROOT))

    offenders = {p: f for p, f in found.items() if p not in baseline}
    healed = sorted(b for b in baseline if b not in found)

    print(f'client-api-paths: hosting forwards {prefixes + sorted(exact)}')
    print(f'client-api-paths: {len(found)} non-forwarded path(s) in client/src, {len(baseline)} baselined')
    if healed:
        print('client-api-paths: baselined path(s) no longer used — remove them:\n  ' + '\n  '.join(healed))

    if offenders:
        print('\nclient-api-paths: these client calls will receive the SPA (index.html), not JSON:')
        for p in sorted(offenders):
            print(f'  {p}\n      used by: ' + ', '.join(sorted(offenders[p])))
        print('\nMove the server route under /api/ and point the client at it '
              '(or add the path to scripts/guards/client_api_paths_baseline.txt with a reason).')
        return 1 if fail else 0

    print('OK: every client API path is one Firebase Hosting forwards.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
