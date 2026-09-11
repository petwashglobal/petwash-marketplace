#!/usr/bin/env python3
"""
A ROUTE IS NOT A DOOR.

Six times in two days a screen was found that was fully built, correctly
routed in App.tsx, and reachable by nothing — no link, no redirect. Each was
invisible in review, because a `<Route path="/x">` reads as proof that a user
can get to /x. It is not.

What was found this way:

  client/src/lib/brand.ts            RTL-safe brand constants, 0 importers
  client/src/styles/responsive-tokens.css   36 tokens, 1 ever consumed
  PetPassportHome.tsx                the canonical passport screen (#2382)
  /admin/wash-packages               the screen that fills the EMPTY shop page (#2389)
  /staff/scan                        the counter till staff land next to (#2392)
  /franchise/{inbox,reports,support,marketing}   557 lines (#2394)

The last three were user-visible business impact: an empty shop page, staff who
could not open their own till, and a franchisee who could not open their
reports.

WHY A BASELINE AND NOT A HARD FAIL. 159 of 453 static routes currently have no
link. Many are legitimate — Firebase callbacks like /__/auth/action, admin
surfaces reached through hubs that build hrefs at runtime, deep links. Failing
on all 159 would be switched off within a day, and a guard that cries wolf is
worse than no guard. So today's set is frozen. This fails only when a NEW
unreachable route appears — the seventh instance, caught at PR time instead of
by accident.

TO ADD A ROUTE THAT IS DELIBERATELY UNLINKED (a redirect target, a deep link,
an email-only destination): add it to the baseline file with a one-line reason.
That is a thirty-second edit and it forces the question to be answered out loud.
"""
import os
import re
import sys

APP = os.path.join('client', 'src', 'App.tsx')
BASELINE = os.path.join('scripts', 'guards', 'unreachable_routes_baseline.txt')

# Shapes that actually route a user. Deliberately NOT the bare path: a path
# appearing in prose, in a comment, or in an active-state prefix list routes
# nobody. MobileBottomNav's ACCOUNT_HOME_PREFIXES is exactly that trap — it
# contains '/franchise/dashboard' and merely highlights a tab.
LINK = re.compile(
    r"""(?:to:\s*|href\s*[:=]\s*|navigate\(\s*|setLocation\(\s*|push\(\s*|Redirect\s+to=)"""
    r"""["'`](/[^"'`]*)["'`]"""
)
SERVER_TARGET = re.compile(r"""["'`](/[a-z0-9][a-z0-9/_-]*)["'`]""")


def read(path):
    try:
        with open(path, encoding='utf-8') as handle:
            return handle.read()
    except (OSError, UnicodeDecodeError):
        return ''


def walk(root, exts):
    for dirpath, _dirs, files in os.walk(root):
        for name in files:
            if name.endswith(exts):
                yield os.path.join(dirpath, name)


def main():
    app = read(APP)
    if not app:
        print(f'ERROR: could not read {APP}')
        return 1

    routes = sorted(set(re.findall(r'path="(/[^"]*)"', app)))
    # Parameterised and wildcard routes are reached through a built href, so a
    # literal-string scan can never see them. Out of scope by construction.
    static = [r for r in routes if ':' not in r and '*' not in r]

    targets = set()
    for path in walk(os.path.join('client', 'src'), ('.ts', '.tsx')):
        if os.path.normpath(path) == os.path.normpath(APP):
            continue
        targets.update(LINK.findall(read(path)))
    # A server-side redirect is a real way in — post-login.ts sends staff,
    # franchise owners and rejected applicants to their landing pages.
    for path in walk('server', ('.ts',)):
        targets.update(SERVER_TARGET.findall(read(path)))

    unreachable = [r for r in static if r not in targets]

    baseline = set()
    for line in read(BASELINE).splitlines():
        line = line.split('#', 1)[0].strip()
        if line:
            baseline.add(line)

    new = sorted(set(unreachable) - baseline)
    healed = sorted(baseline - set(unreachable))

    if healed:
        print(f'{len(healed)} route(s) became reachable — good. Drop them from the baseline:')
        for route in healed:
            print(f'    {route}')
        print()

    if not new:
        print(f'OK: no new unreachable route. ({len(unreachable)} known, baseline {len(baseline)})')
        return 0

    print('NEW UNREACHABLE ROUTE — registered in App.tsx, linked from nothing')
    print()
    for route in new:
        print(f'    {route}')
    print()
    print('A user cannot get there. Either:')
    print('  1. link it from a surface a user actually sees, or')
    print('  2. if it is deliberately unlinked (redirect target, deep link,')
    print(f'     email destination), add it to {BASELINE} with the reason.')
    return 1


if __name__ == '__main__':
    sys.exit(main())
