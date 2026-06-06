import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("Capacitor native API base URL", () => {
  it("routes native shells to the live API origin before web hostname fallback", () => {
    const src = read("client/src/lib/apiConfig.ts");

    expect(src).toContain("import { Capacitor } from '@capacitor/core';");
    expect(src).toContain("Capacitor.isNativePlatform()");
    expect(src).toContain("VITE_NATIVE_API_URL");
    expect(src).toContain("https://petwash.co.il");
    expect(src.indexOf("Capacitor.isNativePlatform()")).toBeLessThan(
      src.indexOf("const isFirebaseHosting"),
    );
  });

  it("documents the optional native API override without changing web defaults", () => {
    const envExample = read("client/.env.example");
    const src = read("client/src/lib/apiConfig.ts");

    expect(envExample).toContain("VITE_NATIVE_API_URL=https://petwash.co.il");
    expect(src).toContain("return ''; // Relative URLs");
  });
});
