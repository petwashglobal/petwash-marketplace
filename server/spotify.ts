/**
 * Spotify Integration - Pet Wash™
 * Uses Replit Spotify connector for OAuth
 */

import { SpotifyApi } from "@spotify/web-api-ts-sdk";

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=spotify',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const refreshToken = connectionSettings?.settings?.oauth?.credentials?.refresh_token;
  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;
  const clientId = connectionSettings?.settings?.oauth?.credentials?.client_id;
  const expiresIn = connectionSettings.settings?.oauth?.credentials?.expires_in;
  
  if (!connectionSettings || (!accessToken || !clientId || !refreshToken)) {
    throw new Error('Spotify not connected');
  }
  
  return { accessToken, clientId, refreshToken, expiresIn };
}

export async function getSpotifyClient() {
  const { accessToken, clientId, refreshToken, expiresIn } = await getAccessToken();

  const spotify = SpotifyApi.withAccessToken(clientId, {
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: expiresIn || 3600,
    refresh_token: refreshToken,
  });

  return spotify;
}

export async function getSpotifyUserProfile() {
  try {
    const spotify = await getSpotifyClient();
    const profile = await spotify.currentUser.profile();
    return {
      id: profile.id,
      displayName: profile.display_name,
      email: profile.email,
      images: profile.images,
      followers: profile.followers?.total,
      country: profile.country,
      product: profile.product,
    };
  } catch (error) {
    console.error('Error fetching Spotify profile:', error);
    throw error;
  }
}

export async function getSpotifyNowPlaying() {
  try {
    const spotify = await getSpotifyClient();
    const playback = await spotify.player.getCurrentlyPlayingTrack();
    if (!playback || !playback.item) {
      return null;
    }
    return {
      isPlaying: playback.is_playing,
      track: {
        name: playback.item.name,
        artists: 'artists' in playback.item ? playback.item.artists.map((a: any) => a.name).join(', ') : '',
        album: 'album' in playback.item ? playback.item.album.name : '',
        image: 'album' in playback.item && playback.item.album.images[0]?.url,
      },
      progress: playback.progress_ms,
      duration: 'duration_ms' in playback.item ? playback.item.duration_ms : 0,
    };
  } catch (error) {
    console.error('Error fetching now playing:', error);
    return null;
  }
}
