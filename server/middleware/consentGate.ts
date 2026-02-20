import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { userConsents } from "@shared/schema";
import { eq, and } from "drizzle-orm";

export function requireConsent(...consentTypes: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId =
      (req as any).userId ||
      (req as any).user?.id ||
      (req.session as any)?.userId;

    if (!userId) {
      return res.status(401).json({ error: "AUTH_REQUIRED" });
    }

    const missing: string[] = [];

    for (const consentType of consentTypes) {
      const [record] = await db
        .select()
        .from(userConsents)
        .where(
          and(
            eq(userConsents.userId, userId),
            eq(userConsents.consentType, consentType),
            eq(userConsents.accepted, true)
          )
        )
        .limit(1);

      if (!record) {
        missing.push(consentType);
      }
    }

    if (missing.length > 0) {
      return res
        .status(403)
        .json({ error: "CONSENT_REQUIRED", missing });
    }

    next();
  };
}
