/**
 * Spotify API Routes - Pet Wash™
 * Provides Spotify profile and now playing endpoints
 */
import { Router } from "express";
import { getSpotifyUserProfile, getSpotifyNowPlaying } from "../spotify";
const router = Router();
router.get("/profile", async (req, res) => {
    try {
        const profile = await getSpotifyUserProfile();
        res.json({ success: true, profile });
    }
    catch (error) {
        console.error("Spotify profile error:", error);
        res.status(500).json({
            success: false,
            error: error.message || "Failed to fetch Spotify profile"
        });
    }
});
router.get("/now-playing", async (req, res) => {
    try {
        const nowPlaying = await getSpotifyNowPlaying();
        res.json({ success: true, nowPlaying });
    }
    catch (error) {
        console.error("Spotify now playing error:", error);
        res.status(500).json({
            success: false,
            error: error.message || "Failed to fetch now playing"
        });
    }
});
router.get("/status", async (req, res) => {
    try {
        const profile = await getSpotifyUserProfile();
        res.json({
            success: true,
            connected: true,
            user: profile.displayName,
            email: profile.email
        });
    }
    catch (error) {
        res.json({
            success: true,
            connected: false,
            error: error.message
        });
    }
});
export default router;
