/**
 * Firebase Client SDK for Server-Side Authentication
 * Used for password verification in Identity Service V2
 */

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// Get Firebase config from environment
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: "signinpetwash.firebaseapp.com",
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || "signinpetwash",
  appId: process.env.VITE_FIREBASE_APP_ID,
};

// Initialize Firebase Client App (for authentication)
const app = initializeApp(firebaseConfig, "server-client");

// Export auth instance
export const auth = getAuth(app);
