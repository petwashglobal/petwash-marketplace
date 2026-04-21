/**
 * AdminLogin — thin wrapper around AdminLoginV2.
 *
 * This legacy entry point is kept for any routes/imports that reference AdminLogin
 * directly. All real auth logic lives in AdminLoginV2 (the canonical implementation).
 * No duplicate auth code or inline role lists here.
 */
export { default } from "./admin/AdminLoginV2";
