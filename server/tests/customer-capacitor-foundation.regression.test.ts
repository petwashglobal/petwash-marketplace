import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("customer Capacitor foundation", () => {
  it("keeps provider as the default root config and stores customer as a separate template", () => {
    const rootConfig = read("capacitor.config.ts");
    const customerConfig = read("config/capacitor/customer.config.ts");

    expect(rootConfig).toContain('appId: "il.co.petwash.provider"');
    expect(rootConfig).not.toContain("il.co.petwash.customer");

    expect(customerConfig).toContain('appId: "il.co.petwash.customer"');
    expect(customerConfig).toContain('appName: "PetWash Customer"');
    expect(customerConfig).toContain('webDir: "dist/public"');
    expect(customerConfig).toContain('path: "ios-customer"');
    expect(customerConfig).toContain('path: "android-customer"');
    expect(customerConfig).not.toContain("server: { url:");
    expect(customerConfig).not.toContain("https://petwash");
  });

  it("adds safe customer scripts that restore provider config after app-specific commands", () => {
    const pkg = JSON.parse(read("package.json"));
    const runner = read("scripts/mobile/run-capacitor-app.mjs");
    const selector = read("scripts/mobile/select-capacitor-config.mjs");
    const prune = read("scripts/mobile/prune-capacitor-sourcemaps.mjs");

    expect(pkg.scripts["cap:customer:sync"]).toBe(
      "node scripts/mobile/run-capacitor-app.mjs customer sync",
    );
    expect(pkg.scripts["cap:customer:open:ios"]).toBe(
      "node scripts/mobile/run-capacitor-app.mjs customer open:ios",
    );
    expect(pkg.scripts["cap:customer:open:android"]).toBe(
      "node scripts/mobile/run-capacitor-app.mjs customer open:android",
    );

    expect(runner).toContain('await selectConfig("provider")');
    expect(selector).toContain('"customer", "customer.config.ts"');
    expect(prune).toContain("ios-customer/App/App/public");
    expect(prune).toContain("android-customer/app/src/main/assets/public");
  });

  it("generates customer native projects without signing material or live server shortcuts", () => {
    const xcodeProject = read("ios-customer/App/App.xcodeproj/project.pbxproj");
    const iosPackage = read("ios-customer/App/CapApp-SPM/Package.swift");
    const androidGradle = read("android-customer/app/build.gradle");
    const androidManifest = read("android-customer/app/src/main/AndroidManifest.xml");
    const iosConfig = read("ios-customer/App/App/capacitor.config.json");
    const androidConfig = read("android-customer/app/src/main/assets/capacitor.config.json");

    expect(xcodeProject).toContain("PRODUCT_BUNDLE_IDENTIFIER = il.co.petwash.customer");
    expect(xcodeProject).not.toContain("DEVELOPMENT_TEAM =");
    expect(iosPackage).toContain('exact: "8.4.0"');

    expect(androidGradle).toContain('namespace = "il.co.petwash.customer"');
    expect(androidGradle).toContain('applicationId "il.co.petwash.customer"');
    expect(androidManifest).toContain('android:allowBackup="false"');
    expect(androidManifest).toContain('android:fullBackupContent="false"');
    expect(androidManifest).toContain("android.permission.POST_NOTIFICATIONS");
    expect(androidManifest).toContain("android.permission.CAMERA");

    const androidTest = read(
      "android-customer/app/src/androidTest/java/il/co/petwash/customer/ExampleInstrumentedTest.java",
    );
    expect(androidTest).toContain("package il.co.petwash.customer;");
    expect(androidTest).toContain('"il.co.petwash.customer"');
    expect(androidTest).not.toContain("com.getcapacitor.myapp");

    for (const generatedConfig of [iosConfig, androidConfig]) {
      expect(generatedConfig).toContain('"appId": "il.co.petwash.customer"');
      expect(generatedConfig).toContain('"appName": "PetWash Customer"');
      expect(generatedConfig).toContain('"webDir": "dist/public"');
      expect(generatedConfig).not.toContain('"url"');
    }
  });

  it("documents customer iOS privacy and keeps copied web assets out of git", () => {
    const infoPlist = read("ios-customer/App/App/Info.plist");
    const iosGitignore = read("ios-customer/.gitignore");
    const androidGitignore = read("android-customer/.gitignore");

    expect(infoPlist).toContain("NSCameraUsageDescription");
    expect(infoPlist).toContain("NSPhotoLibraryUsageDescription");
    expect(iosGitignore).toContain("App/App/public");
    expect(androidGitignore).toContain("app/src/main/assets/public");
  });
});
