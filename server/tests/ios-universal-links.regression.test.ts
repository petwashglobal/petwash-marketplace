import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("iOS Universal Links", () => {
  it("serves Apple App Site Association from Cloud Run instead of the SPA", () => {
    const firebase = read("firebase.json");
    const seoRoutes = read("server/routes/seo.ts");

    expect(firebase).toContain('"source": "/.well-known/apple-app-site-association"');
    expect(firebase).toContain('"source": "/apple-app-site-association"');
    expect(seoRoutes).toContain("apple-app-site-association");
    expect(seoRoutes).toContain("il.co.petwash.provider");
    expect(seoRoutes).toContain("com.petwash.il");
    expect(seoRoutes).toContain("APPLE_WALLET_TEAM_ID");
  });

  it("enables associated domains in both native iOS wrappers", () => {
    const providerProject = read("ios/App/App.xcodeproj/project.pbxproj");
    const customerProject = read("ios-customer/App/App.xcodeproj/project.pbxproj");
    const providerEntitlements = read("ios/App/App/App.entitlements");
    const customerEntitlements = read("ios-customer/App/App/App.entitlements");

    for (const project of [providerProject, customerProject]) {
      expect(project).toContain("CODE_SIGN_ENTITLEMENTS = App/App.entitlements;");
    }

    for (const entitlements of [providerEntitlements, customerEntitlements]) {
      expect(entitlements).toContain("com.apple.developer.associated-domains");
      expect(entitlements).toContain("applinks:petwash.co.il");
      expect(entitlements).toContain("webcredentials:petwash.co.il");
    }
  });
});
