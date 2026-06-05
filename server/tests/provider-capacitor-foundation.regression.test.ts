import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("provider Capacitor foundation", () => {
  it("keeps the provider wrapper pointed at the local production bundle", () => {
    const config = read("capacitor.config.ts");

    expect(config).toContain('appId: "il.co.petwash.provider"');
    expect(config).toContain('appName: "PetWash Provider"');
    expect(config).toContain('webDir: "dist/public"');
    expect(config).not.toContain("server: { url:");
    expect(config).not.toContain("https://petwash");
  });

  it("pins official Capacitor v8 packages and scripts", () => {
    const pkg = JSON.parse(read("package.json"));

    expect(pkg.scripts["cap:provider:sync"]).toBe(
      "node scripts/mobile/run-capacitor-app.mjs provider sync",
    );
    expect(pkg.scripts["cap:clean-sourcemaps"]).toBe("node scripts/mobile/prune-capacitor-sourcemaps.mjs");
    expect(pkg.scripts["cap:provider:open:ios"]).toBe(
      "node scripts/mobile/run-capacitor-app.mjs provider open:ios",
    );
    expect(pkg.scripts["cap:provider:open:android"]).toBe(
      "node scripts/mobile/run-capacitor-app.mjs provider open:android",
    );

    for (const dependency of [
      "@capacitor/core",
      "@capacitor/ios",
      "@capacitor/android",
      "@capacitor/app",
      "@capacitor/camera",
      "@capacitor/push-notifications",
      "@capacitor/splash-screen",
      "@capacitor/status-bar",
    ]) {
      expect(pkg.dependencies[dependency]).toMatch(/^\^8\./);
    }

    expect(pkg.devDependencies["@capacitor/cli"]).toMatch(/^\^8\./);
  });

  it("generates native app projects without signing material or live server shortcuts", () => {
    const xcodeProject = read("ios/App/App.xcodeproj/project.pbxproj");
    const iosPackage = read("ios/App/CapApp-SPM/Package.swift");
    const androidGradle = read("android/app/build.gradle");
    const androidManifest = read("android/app/src/main/AndroidManifest.xml");
    const iosConfig = read("ios/App/App/capacitor.config.json");
    const androidConfig = read("android/app/src/main/assets/capacitor.config.json");

    expect(xcodeProject).toContain("PRODUCT_BUNDLE_IDENTIFIER = il.co.petwash.provider");
    expect(xcodeProject).not.toContain("DEVELOPMENT_TEAM =");
    expect(iosPackage).toContain('exact: "8.4.0"');

    expect(androidGradle).toContain('namespace = "il.co.petwash.provider"');
    expect(androidGradle).toContain('applicationId "il.co.petwash.provider"');
    expect(androidManifest).toContain('android:allowBackup="false"');
    expect(androidManifest).toContain('android:fullBackupContent="false"');
    expect(androidManifest).toContain("android.permission.POST_NOTIFICATIONS");
    expect(androidManifest).toContain("android.permission.CAMERA");

    for (const generatedConfig of [iosConfig, androidConfig]) {
      expect(generatedConfig).toContain('"appId": "il.co.petwash.provider"');
      expect(generatedConfig).toContain('"appName": "PetWash Provider"');
      expect(generatedConfig).toContain('"webDir": "dist/public"');
      expect(generatedConfig).not.toContain('"url"');
    }
  });

  it("documents iOS camera/photo privacy and keeps copied web assets out of git", () => {
    const infoPlist = read("ios/App/App/Info.plist");
    const iosGitignore = read("ios/.gitignore");
    const androidGitignore = read("android/.gitignore");

    expect(infoPlist).toContain("NSCameraUsageDescription");
    expect(infoPlist).toContain("NSPhotoLibraryUsageDescription");
    expect(iosGitignore).toContain("App/App/public");
    expect(androidGitignore).toContain("app/src/main/assets/public");
  });
});
