import { describe, it, expect, beforeEach, afterEach } from "vitest";
import express from "express";
import request from "supertest";
import { providerAppRouter } from "../routes/provider-app";

function app() {
  const a = express();
  a.use(express.json());
  a.use(providerAppRouter);
  return a;
}

describe("provider-app API", () => {
  const prev = process.env.PROVIDER_APP_API_ENABLED;
  afterEach(() => { process.env.PROVIDER_APP_API_ENABLED = prev; });

  describe("kill-switch OFF (default / production)", () => {
    beforeEach(() => { delete process.env.PROVIDER_APP_API_ENABLED; });

    it("returns 503 for every provider-app route when disabled", async () => {
      const res = await request(app()).get("/api/provider-app/onboarding/jurisdictions");
      expect(res.status).toBe(503);
      expect(res.body.error).toBe("provider_app_api_disabled");
    });
  });

  describe("enabled (dev)", () => {
    beforeEach(() => { process.env.PROVIDER_APP_API_ENABLED = "true"; });

    it("issues a base64 passkey challenge", async () => {
      const res = await request(app()).post("/api/provider-app/auth/passkey/challenge");
      expect(res.status).toBe(200);
      expect(Buffer.from(res.body.challenge, "base64").length).toBe(32);
    });

    it("returns the jurisdiction list", async () => {
      const res = await request(app()).get("/api/provider-app/onboarding/jurisdictions");
      expect(res.status).toBe(200);
      expect(res.body.map((j: { id: string }) => j.id)).toContain("il");
    });

    it("returns declarations with wording withheld pending counsel", async () => {
      const res = await request(app()).get("/api/provider-app/onboarding/declarations?jurisdiction=il");
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThan(0);
      // No real legal text ships before counsel sign-off.
      for (const d of res.body) expect(d.body).toBe("PENDING_COUNSEL");
    });

    it("returns an activation status", async () => {
      const res = await request(app()).get("/api/provider-app/onboarding/activation");
      expect(res.status).toBe(200);
      expect(["notStarted", "inReview", "activated", "rejected"]).toContain(res.body.state);
    });

    it("refuses the sensitive endpoints with 501 (pending security review + counsel)", async () => {
      for (const path of [
        "/api/provider-app/auth/passkey/verify",
        "/api/provider-app/documents",
        "/api/provider-app/signature",
      ]) {
        const res = await request(app()).post(path).send({});
        expect(res.status).toBe(501);
        expect(res.body.error).toBe("not_implemented");
      }
    });
  });
});
