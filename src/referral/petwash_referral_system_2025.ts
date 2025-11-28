/**
 * PetWash Referral System 2025 - 2026 ready
 *
 * Single giant file for your dev team.
 * Tech stack:
 * - TypeScript
 * - Express style HTTP API
 * - Firebase Admin SDK (Firestore)
 * - Can be wrapped inside Firebase Functions v2 onRequest handler
 *
 * Main features:
 * - Per user referral code + link
 * - Track invite -> signup -> first paid transaction
 * - Give credits only after first successful payment
 * - Simple level system (Bronze / Silver / Gold / Diamond)
 * - Basic anti abuse checks
 * - Example React components for front end
 */

// ========================
// 1. TYPES AND CONFIG
// ========================

import express, { Request, Response, NextFunction } from "express";
import * as admin from "firebase-admin";

// Call admin.initializeApp() once in your functions entry file.
// If this file is the entry file - uncomment:
// admin.initializeApp();

const db = admin.firestore();

// For production - store in env vars or Firebase config
const REFERRAL_CONFIG = {
  referralCodeLength: 8,
  baseReferralUrl: "https://petwash.co.il/ref", // your real domain
  creditAmountILS: 25, // credit per successful referral, both sides
  minTransactionAmountILS: 20, // minimum payment that counts as "real" transaction
  maxCreditsPerUserILS: 1000, // hard cap per user
  maxCreditsPerDayILS: 200, // soft daily cap
  levels: [
    { id: "BRONZE", minSuccessful: 0, label: "Bronze" },
    { id: "SILVER", minSuccessful: 5, label: "Silver" },
    { id: "GOLD", minSuccessful: 10, label: "Gold" },
    { id: "DIAMOND", minSuccessful: 25, label: "Diamond" },
  ] as const,
} as const;

type ReferralLevelId = (typeof REFERRAL_CONFIG.levels)[number]["id"];

interface PetWashUser {
  id: string;
  email?: string;
  phone?: string;
  displayName?: string;
  createdAt: FirebaseFirestore.Timestamp;
  referralCode?: string;
  referralStats?: {
    totalInvites: number;
    successfulInvites: number;
    pendingInvites: number;
    totalCreditsGrantedILS: number;
    lastCreditAt?: FirebaseFirestore.Timestamp | null;
    levelId: ReferralLevelId;
  };
  creditsBalanceILS?: number;
}

type ReferralStatus =
  | "PENDING_SIGNUP"
  | "SIGNED_UP"
  | "WAITING_FIRST_PAYMENT"
  | "COMPLETED"
  | "REJECTED";

interface Referral {
  id: string;
  fromUserId: string;
  fromReferralCode: string;
  toUserId?: string;
  toEmail?: string;
  toPhone?: string;
  status: ReferralStatus;
  createdAt: FirebaseFirestore.Timestamp;
  signedUpAt?: FirebaseFirestore.Timestamp;
  firstPaymentAt?: FirebaseFirestore.Timestamp;
  firstPaymentTransactionId?: string;
  firstPaymentAmountILS?: number;
  creditsGrantedAt?: FirebaseFirestore.Timestamp;
  referrerCreditILS?: number;
  refereeCreditILS?: number;
  reasonRejected?: string;
}

interface TransactionEvent {
  id: string;
  userId: string;
  amountILS: number;
  createdAt: FirebaseFirestore.Timestamp;
  source: "NAYAX" | "APP" | "WEB";
  rawPayload?: any;
}

// Express app
const app = express();
app.use(express.json());

// ========================
// 2. UTILS
// ========================

function generateReferralCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < REFERRAL_CONFIG.referralCodeLength; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

function buildReferralLink(referralCode: string): string {
  return `${REFERRAL_CONFIG.baseReferralUrl}?code=${encodeURIComponent(
    referralCode
  )}`;
}

function computeLevel(successfulInvites: number): ReferralLevelId {
  let level: ReferralLevelId = "BRONZE";
  for (const l of REFERRAL_CONFIG.levels) {
    if (successfulInvites >= l.minSuccessful) {
      level = l.id as ReferralLevelId;
    }
  }
  return level;
}

async function getUserById(userId: string): Promise<PetWashUser | null> {
  const doc = await db.collection("users").doc(userId).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...(doc.data() as any) } as PetWashUser;
}

async function getUserByReferralCode(
  code: string
): Promise<PetWashUser | null> {
  const snap = await db
    .collection("users")
    .where("referralCode", "==", code)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, ...(doc.data() as any) } as PetWashUser;
}

async function ensureReferralCode(userId: string): Promise<string> {
  const userRef = db.collection("users").doc(userId);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists) throw new Error("User not found");
    const data = snap.data() || {};
    if (data.referralCode) return data.referralCode as string;

    // generate unique code
    let code: string;
    while (true) {
      code = generateReferralCode();
      const existing = await db
        .collection("users")
        .where("referralCode", "==", code)
        .limit(1)
        .get();
      if (existing.empty) break;
    }

    const stats: PetWashUser["referralStats"] = {
      totalInvites: 0,
      successfulInvites: 0,
      pendingInvites: 0,
      totalCreditsGrantedILS: 0,
      lastCreditAt: null,
      levelId: "BRONZE",
    };

    tx.update(userRef, {
      referralCode: code,
      referralStats: stats,
      creditsBalanceILS: data.creditsBalanceILS || 0,
    });

    return code;
  });
}

async function updateUserLevelAndStats(
  userId: string,
  deltaSuccessful: number,
  deltaCreditsILS: number
) {
  const userRef = db.collection("users").doc(userId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists) throw new Error("User not found");
    const data = snap.data() as any;

    const stats: PetWashUser["referralStats"] = {
      totalInvites: data.referralStats?.totalInvites || 0,
      successfulInvites: data.referralStats?.successfulInvites || 0,
      pendingInvites: data.referralStats?.pendingInvites || 0,
      totalCreditsGrantedILS: data.referralStats?.totalCreditsGrantedILS || 0,
      lastCreditAt: data.referralStats?.lastCreditAt || null,
      levelId: (data.referralStats?.levelId as ReferralLevelId) || "BRONZE",
    };

    stats.successfulInvites += deltaSuccessful;
    stats.totalCreditsGrantedILS += deltaCreditsILS;
    stats.lastCreditAt = admin.firestore.Timestamp.now();
    stats.levelId = computeLevel(stats.successfulInvites);

    const currentBalance = data.creditsBalanceILS || 0;
    const newBalance = currentBalance + deltaCreditsILS;

    tx.update(userRef, {
      referralStats: stats,
      creditsBalanceILS: newBalance,
    });
  });
}

async function checkCreditLimits(
  userId: string,
  creditToAddILS: number
): Promise<boolean> {
  const user = await getUserById(userId);
  if (!user) return false;

  const total = user.referralStats?.totalCreditsGrantedILS || 0;
  if (total + creditToAddILS > REFERRAL_CONFIG.maxCreditsPerUserILS) {
    return false;
  }

  // simple daily cap
  const since = admin.firestore.Timestamp.fromMillis(
    Date.now() - 24 * 60 * 60 * 1000
  );
  const creditsSnap = await db
    .collection("referralCredits")
    .where("userId", "==", userId)
    .where("createdAt", ">", since)
    .get();

  const daySum = creditsSnap.docs.reduce(
    (sum, doc) => sum + (doc.data().amountILS || 0),
    0
  );

  if (daySum + creditToAddILS > REFERRAL_CONFIG.maxCreditsPerDayILS) {
    return false;
  }

  return true;
}

async function grantCredit(
  userId: string,
  amountILS: number,
  source: "REFERRAL_REFERRER" | "REFERRAL_REFEREE",
  referralId: string
) {
  const ok = await checkCreditLimits(userId, amountILS);
  if (!ok) {
    console.log(
      `Credit limit reached for user ${userId}, skipping credit for referral ${referralId}`
    );
    return;
  }

  const ref = db.collection("referralCredits").doc();
  await db.runTransaction(async (tx) => {
    const userRef = db.collection("users").doc(userId);
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists) throw new Error("User not found");

    const userData = userSnap.data() as any;
    const currentBalance = userData.creditsBalanceILS || 0;

    tx.set(ref, {
      id: ref.id,
      userId,
      amountILS,
      source,
      referralId,
      createdAt: admin.firestore.Timestamp.now(),
    });

    tx.update(userRef, {
      creditsBalanceILS: currentBalance + amountILS,
    });
  });
}

// ========================
// 3. MIDDLEWARE - SIMPLE AUTH
// ========================

/**
 * Very simple auth placeholder.
 * In production you will verify Firebase ID token or custom JWT.
 *
 * For now we expect header:
 *   x-user-id: <uid>
 */
function requireUser(
  req: Request,
  res: Response,
  next: NextFunction
): void | Response {
  const userId = req.header("x-user-id");
  if (!userId) {
    return res.status(401).json({ error: "Missing x-user-id header" });
  }
  (req as any).userId = userId;
  next();
}

// ========================
// 4. API - REFERRAL LINK
// ========================

/**
 * GET /api/referral/link
 * Returns referral code and full link for the current user.
 */
app.get("/api/referral/link", requireUser, async (req, res) => {
  try {
    const userId = (req as any).userId as string;
    const code = await ensureReferralCode(userId);
    const link = buildReferralLink(code);

    const user = await getUserById(userId);

    res.json({
      userId,
      referralCode: code,
      referralLink: link,
      stats: user?.referralStats || null,
    });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message || "Unknown error" });
  }
});

// ========================
// 5. API - REGISTER REFERRAL CLICK / SIGNUP
// ========================

/**
 * POST /api/referral/register-click
 * Body: { referralCode, toEmail?, toPhone?, deviceId? }
 *
 * Used when someone clicks the referral link before signup.
 * Creates a "PENDING_SIGNUP" referral.
 */
app.post("/api/referral/register-click", async (req, res) => {
  try {
    const { referralCode, toEmail, toPhone, deviceId } = req.body || {};

    if (!referralCode) {
      return res.status(400).json({ error: "Missing referralCode" });
    }

    const referrer = await getUserByReferralCode(referralCode);
    if (!referrer) {
      return res.status(404).json({ error: "Invalid referral code" });
    }

    // basic anti abuse: block if same email or phone as referrer
    if (
      (toEmail && toEmail === referrer.email) ||
      (toPhone && toPhone === referrer.phone)
    ) {
      return res.status(400).json({ error: "Self referral not allowed" });
    }

    const refDoc = db.collection("referrals").doc();
    const now = admin.firestore.Timestamp.now();

    const referral: Referral = {
      id: refDoc.id,
      fromUserId: referrer.id,
      fromReferralCode: referralCode,
      toEmail: toEmail || null,
      toPhone: toPhone || null,
      status: "PENDING_SIGNUP",
      createdAt: now,
    } as any;

    await db.runTransaction(async (tx) => {
      tx.set(refDoc, referral);

      const userRef = db.collection("users").doc(referrer.id);
      const userSnap = await tx.get(userRef);
      if (userSnap.exists) {
        const data = userSnap.data() as any;
        const stats: PetWashUser["referralStats"] = {
          totalInvites: data.referralStats?.totalInvites || 0,
          successfulInvites: data.referralStats?.successfulInvites || 0,
          pendingInvites: data.referralStats?.pendingInvites || 0,
          totalCreditsGrantedILS: data.referralStats?.totalCreditsGrantedILS || 0,
          lastCreditAt: data.referralStats?.lastCreditAt || null,
          levelId: (data.referralStats?.levelId as ReferralLevelId) || "BRONZE",
        };

        stats.totalInvites += 1;
        stats.pendingInvites += 1;

        tx.update(userRef, { referralStats: stats });
      }
    });

    res.json({ ok: true, referralId: refDoc.id });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message || "Unknown error" });
  }
});

/**
 * POST /api/referral/link-signup
 * Called after the new user completes signup.
 * Body: { referralCode, newUserId }
 *
 * This binds the referral to the user and moves status forward.
 */
app.post("/api/referral/link-signup", async (req, res) => {
  try {
    const { referralCode, newUserId } = req.body || {};
    if (!referralCode || !newUserId) {
      return res
        .status(400)
        .json({ error: "Missing referralCode or newUserId" });
    }

    const referrer = await getUserByReferralCode(referralCode);
    if (!referrer) {
      return res.status(404).json({ error: "Invalid referral code" });
    }

    if (referrer.id === newUserId) {
      return res.status(400).json({ error: "Self referral not allowed" });
    }

    // Check that this user is not already referred before
    const existingSnap = await db
      .collection("referrals")
      .where("toUserId", "==", newUserId)
      .limit(1)
      .get();

    if (!existingSnap.empty) {
      return res
        .status(200)
        .json({ ok: true, message: "User already has a referral" });
    }

    // Find latest PENDING_SIGNUP for this referrer and maybe email/phone
    const pendingSnap = await db
      .collection("referrals")
      .where("fromUserId", "==", referrer.id)
      .where("fromReferralCode", "==", referralCode)
      .where("status", "==", "PENDING_SIGNUP")
      .orderBy("createdAt", "desc")
      .limit(1)
      .get();

    const now = admin.firestore.Timestamp.now();

    if (pendingSnap.empty) {
      // no pending, create fresh referral as SIGNED_UP
      const newRefDoc = db.collection("referrals").doc();
      const referral: Referral = {
        id: newRefDoc.id,
        fromUserId: referrer.id,
        fromReferralCode: referralCode,
        toUserId: newUserId,
        status: "WAITING_FIRST_PAYMENT",
        createdAt: now,
        signedUpAt: now,
      } as any;
      await newRefDoc.set(referral);
      return res.json({ ok: true, referralId: newRefDoc.id });
    }

    const refDoc = pendingSnap.docs[0].ref;
    await refDoc.update({
      toUserId: newUserId,
      signedUpAt: now,
      status: "WAITING_FIRST_PAYMENT",
    });

    res.json({ ok: true, referralId: refDoc.id });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message || "Unknown error" });
  }
});

// ========================
// 6. WEBHOOK - PAYMENT (NAYAX OR OTHER)
// ========================

/**
 * POST /api/payments/webhook
 * This endpoint is called by Nayax or another PSP when a payment is completed.
 *
 * Expected body (example, adjust to your provider):
 * {
 *   "transactionId": "xxx",
 *   "userId": "user123",
 *   "amountILS": 55.0,
 *   "source": "NAYAX"
 * }
 *
 * On first qualifying payment, we:
 * - Mark referral as COMPLETED
 * - Grant 25 ILS to referrer
 * - Grant 25 ILS to referee
 */
app.post("/api/payments/webhook", async (req, res) => {
  try {
    const { transactionId, userId, amountILS, source } = req.body || {};
    if (!transactionId || !userId || !amountILS) {
      return res.status(400).json({ error: "Missing fields in webhook" });
    }

    // Save transaction event (idempotent)
    const txRef = db.collection("transactions").doc(transactionId);
    const txSnap = await txRef.get();
    if (!txSnap.exists) {
      const tx: TransactionEvent = {
        id: transactionId,
        userId,
        amountILS,
        createdAt: admin.firestore.Timestamp.now(),
        source: source === "NAYAX" ? "NAYAX" : "APP",
        rawPayload: req.body,
      };
      await txRef.set(tx);
    }

    // Ignore small or test transactions
    if (amountILS < REFERRAL_CONFIG.minTransactionAmountILS) {
      return res.json({ ok: true, skipped: "amount too low" });
    }

    // Find referral for this user in WAITING_FIRST_PAYMENT
    const snap = await db
      .collection("referrals")
      .where("toUserId", "==", userId)
      .where("status", "==", "WAITING_FIRST_PAYMENT")
      .orderBy("createdAt", "asc")
      .limit(1)
      .get();

    if (snap.empty) {
      return res.json({ ok: true, info: "No referral waiting for payment" });
    }

    const refDoc = snap.docs[0].ref;

    await db.runTransaction(async (tx) => {
      const rSnap = await tx.get(refDoc);
      if (!rSnap.exists) return;
      const data = rSnap.data() as Referral;

      if (data.status !== "WAITING_FIRST_PAYMENT") return;

      const now = admin.firestore.Timestamp.now();

      // Update referral document
      tx.update(refDoc, {
        status: "COMPLETED",
        firstPaymentAt: now,
        firstPaymentTransactionId: transactionId,
        firstPaymentAmountILS: amountILS,
        creditsGrantedAt: now,
        referrerCreditILS: REFERRAL_CONFIG.creditAmountILS,
        refereeCreditILS: REFERRAL_CONFIG.creditAmountILS,
      });

      // Refs for users
      const referrerUserRef = db.collection("users").doc(data.fromUserId);
      const refereeUserRef = db.collection("users").doc(data.toUserId!);

      const [referrerSnap, refereeSnap] = await Promise.all([
        tx.get(referrerUserRef),
        tx.get(refereeUserRef),
      ]);

      if (!referrerSnap.exists || !refereeSnap.exists) return;

      const referrer = referrerSnap.data() as any;
      const referee = refereeSnap.data() as any;

      const referrerStats: PetWashUser["referralStats"] = {
        totalInvites: referrer.referralStats?.totalInvites || 0,
        successfulInvites: referrer.referralStats?.successfulInvites || 0,
        pendingInvites: referrer.referralStats?.pendingInvites || 0,
        totalCreditsGrantedILS:
          referrer.referralStats?.totalCreditsGrantedILS || 0,
        lastCreditAt: referrer.referralStats?.lastCreditAt || null,
        levelId:
          (referrer.referralStats?.levelId as ReferralLevelId) || "BRONZE",
      };

      referrerStats.successfulInvites += 1;
      referrerStats.pendingInvites =
        Math.max(0, referrerStats.pendingInvites - 1);
      referrerStats.totalCreditsGrantedILS +=
        REFERRAL_CONFIG.creditAmountILS * 2;
      referrerStats.lastCreditAt = now;
      referrerStats.levelId = computeLevel(referrerStats.successfulInvites);

      const referrerBalance =
        (referrer.creditsBalanceILS || 0) +
        REFERRAL_CONFIG.creditAmountILS * 1;

      const refereeBalance =
        (referee.creditsBalanceILS || 0) +
        REFERRAL_CONFIG.creditAmountILS * 1;

      tx.update(referrerUserRef, {
        referralStats: referrerStats,
        creditsBalanceILS: referrerBalance,
      });

      tx.update(refereeUserRef, {
        creditsBalanceILS: refereeBalance,
      });

      // store credit rows for analytics
      const creditRef1 = db.collection("referralCredits").doc();
      tx.set(creditRef1, {
        id: creditRef1.id,
        userId: data.fromUserId,
        referralId: data.id,
        amountILS: REFERRAL_CONFIG.creditAmountILS,
        createdAt: now,
        source: "REFERRAL_REFERRER",
      });

      const creditRef2 = db.collection("referralCredits").doc();
      tx.set(creditRef2, {
        id: creditRef2.id,
        userId: data.toUserId,
        referralId: data.id,
        amountILS: REFERRAL_CONFIG.creditAmountILS,
        createdAt: now,
        source: "REFERRAL_REFEREE",
      });
    });

    res.json({ ok: true });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message || "Unknown error" });
  }
});

// ========================
// 7. ADMIN API - SIMPLE DASHBOARD DATA
// ========================

/**
 * GET /api/referral/admin/overview
 * header: x-admin-secret: <secret>
 * This is a simple stats endpoint for internal admin dashboard.
 */
const ADMIN_SECRET = process.env.PETWASH_ADMIN_SECRET || "CHANGE_ME";

app.get("/api/referral/admin/overview", async (req, res) => {
  const sec = req.header("x-admin-secret");
  if (sec !== ADMIN_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const [refsSnap, creditsSnap] = await Promise.all([
      db.collection("referrals").get(),
      db.collection("referralCredits").get(),
    ]);

    const totalRefs = refsSnap.size;
    let completed = 0;
    let pending = 0;
    let rejected = 0;

    refsSnap.forEach((doc) => {
      const d = doc.data() as Referral;
      if (d.status === "COMPLETED") completed++;
      else if (d.status === "REJECTED") rejected++;
      else pending++;
    });

    const totalCreditsILS = creditsSnap.docs.reduce(
      (sum, doc) => sum + ((doc.data().amountILS as number) || 0),
      0
    );

    res.json({
      totalRefs,
      completed,
      pending,
      rejected,
      totalCreditsILS,
    });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message || "Unknown error" });
  }
});

// ========================
// 8. FRONTEND EXAMPLE (REACT)
// ========================

/**
 * Example React components.
 * Can be used inside Next.js / React app.
 * They talk with the API above.
 */

/////////////////////////////
// ReferralWidget.tsx
/////////////////////////////

// import React, { useEffect, useState } from "react";
// import axios from "axios";

// type ReferralStatsResponse = {
//   userId: string;
//   referralCode: string;
//   referralLink: string;
//   stats: {
//     totalInvites: number;
//     successfulInvites: number;
//     pendingInvites: number;
//     totalCreditsGrantedILS: number;
//     levelId: ReferralLevelId;
//   } | null;
// };

// export const PetWashReferralWidget: React.FC = () => {
//   const [data, setData] = useState<ReferralStatsResponse | null>(null);
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState<string | null>(null);

//   useEffect(() => {
//     async function load() {
//       try {
//         setLoading(true);
//         const res = await axios.get<ReferralStatsResponse>(
//           "/api/referral/link",
//           {
//             headers: {
//               "x-user-id": "CURRENT_USER_ID", // replace with real auth
//             },
//           }
//         );
//         setData(res.data);
//       } catch (err: any) {
//         setError(err.message || "Error");
//       } finally {
//         setLoading(false);
//       }
//     }
//     load();
//   }, []);

//   if (loading) return <div>טוען תוכנית חבר מביא חבר...</div>;
//   if (error) return <div>שגיאה: {error}</div>;
//   if (!data) return null;

//   const stats = data.stats;

//   return (
//     <div
//       style={{
//         borderRadius: 16,
//         padding: 20,
//         background:
//           "linear-gradient(135deg, #22c55e 0%, #16a34a 40%, #0f766e 100%)",
//         color: "white",
//         boxShadow: "0 16px 40px rgba(0,0,0,0.25)",
//       }}
//     >
//       <h2 style={{ margin: 0, marginBottom: 8 }}>PetWash חבר מביא חבר</h2>
//       <p style={{ marginTop: 0, opacity: 0.9 }}>
//         כל חבר חדש שמשלם על שטיפה ראשונה - אתה והוא מקבלים{" "}
//         {REFERRAL_CONFIG.creditAmountILS} ₪ קרדיט לשטיפות עתידיות.
//       </p>

//       <div
//         style={{
//           marginTop: 16,
//           padding: 12,
//           borderRadius: 12,
//           backgroundColor: "rgba(255,255,255,0.1)",
//           display: "flex",
//           flexDirection: "column",
//           gap: 8,
//         }}
//       >
//         <div>
//           <strong>קוד אישי:</strong> {data.referralCode}
//         </div>
//         <div>
//           <strong>קישור לשיתוף:</strong>
//           <br />
//           <code
//             style={{
//               display: "inline-block",
//               marginTop: 4,
//               backgroundColor: "rgba(0,0,0,0.15)",
//               padding: "4px 8px",
//               borderRadius: 6,
//               direction: "ltr",
//             }}
//           >
//             {data.referralLink}
//           </code>
//         </div>
//       </div>

//       {stats && (
//         <div
//           style={{
//             marginTop: 16,
//             display: "grid",
//             gridTemplateColumns: "1fr 1fr",
//             gap: 12,
//           }}
//         >
//           <div
//             style={{
//               borderRadius: 12,
//               backgroundColor: "rgba(0,0,0,0.12)",
//               padding: 10,
//             }}
//           >
//             <div style={{ fontSize: 12, opacity: 0.85 }}>הפניות מוצלחות</div>
//             <div style={{ fontSize: 22, fontWeight: 600 }}>
//               {stats.successfulInvites}
//             </div>
//           </div>
//           <div
//             style={{
//               borderRadius: 12,
//               backgroundColor: "rgba(0,0,0,0.12)",
//               padding: 10,
//             }}
//           >
//             <div style={{ fontSize: 12, opacity: 0.85 }}>קרדיט מצטבר</div>
//             <div style={{ fontSize: 22, fontWeight: 600 }}>
//               {stats.totalCreditsGrantedILS} ₪
//             </div>
//           </div>
//           <div
//             style={{
//               borderRadius: 12,
//               backgroundColor: "rgba(0,0,0,0.12)",
//               padding: 10,
//             }}
//           >
//             <div style={{ fontSize: 12, opacity: 0.85 }}>הזמנות פתוחות</div>
//             <div style={{ fontSize: 22, fontWeight: 600 }}>
//               {stats.pendingInvites}
//             </div>
//           </div>
//           <div
//             style={{
//               borderRadius: 12,
//               backgroundColor: "rgba(0,0,0,0.12)",
//               padding: 10,
//             }}
//           >
//             <div style={{ fontSize: 12, opacity: 0.85 }}>רמת מועדון</div>
//             <div style={{ fontSize: 18, fontWeight: 600 }}>
//               {stats.levelId}
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// };

// ========================
// 9. EXPORT APP
// ========================

// For Firebase Functions v2:
// import { onRequest } from "firebase-functions/v2/https";
// export const referralApi = onRequest(app);

// For plain Node server:
// app.listen(3000, () => {
//   console.log("Referral API listening on :3000");
// });

export default app;