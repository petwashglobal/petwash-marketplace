/**
 * Tripwire: no Slack secret may ever be hardcoded in PRODUCTION source.
 *
 * Slack credentials (incoming-webhook URL, bot/app/user tokens) must live ONLY
 * in environment variables / a secrets manager — never committed. A leaked Slack
 * webhook was found in the Replit-era history; this stops it recurring.
 *
 * Scans TRACKED, NON-TEST source under server/, client/src/, shared/ (test files
 * may legitimately contain fake fixture tokens, so they are excluded). Fails CI
 * if a literal hooks.slack.com/services/... URL or an xoxb-/xoxp-/xapp-/xoxs-
 * token appears. If this fails: remove the secret and read it from process.env.
 */
import { describe, it, expect } from "vitest";
import { execSync } from "child_process";
import { readFileSync } from "fs";
import path from "path";

const SECRET = /hooks\.slack\.com\/services\/[A-Z0-9]|xox[bpas]-[A-Za-z0-9-]{12,}/;

describe("no hardcoded Slack secret", () => {
  it("production source has no literal Slack webhook URL or token", () => {
    const root = path.resolve(__dirname, "../..");
    const tracked = execSync("git ls-files server client/src shared", {
      cwd: root,
      encoding: "utf8",
    })
      .split("\n")
      .filter(Boolean);

    const scan = tracked.filter(
      (f) =>
        /\.(ts|tsx|js|jsx|json)$/.test(f) &&
        !/\.test\.|\.spec\.|__tests__|\/tests\//.test(f),
    );

    const offenders = scan.filter((f) => {
      try { return SECRET.test(readFileSync(path.join(root, f), "utf8")); }
      catch { return false; }
    });

    expect(offenders).toEqual([]);
  });
});
