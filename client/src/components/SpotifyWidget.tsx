/**
 * Spotify Widget - Pet Wash™
 * Shows Spotify connection status and now playing
 */

import { useState, useEffect } from 'react';
import { SiSpotify } from 'react-icons/si';
import { Music, User, ExternalLink } from 'lucide-react';

interface SpotifyProfile {
  id: string;
  displayName: string;
  email: string;
  images: { url: string }[];
  followers: number;
  country: string;
  product: string;
}

interface NowPlaying {
  isPlaying: boolean;
  track: {
    name: string;
    artists: string;
    album: string;
    image: string;
  };
  progress: number;
  duration: number;
}

interface SpotifyWidgetProps {
  variant?: 'compact' | 'full';
  language?: 'en' | 'he';
}

export function SpotifyWidget({ variant = 'compact', language = 'en' }: SpotifyWidgetProps) {
  const [profile, setProfile] = useState<SpotifyProfile | null>(null);
  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSpotifyStatus() {
      try {
        const res = await fetch('/api/spotify/status');
        const data = await res.json();
        
        if (data.success && data.connected) {
          setConnected(true);
          
          const profileRes = await fetch('/api/spotify/profile');
          const profileData = await profileRes.json();
          if (profileData.success) {
            setProfile(profileData.profile);
          }
          
          const nowPlayingRes = await fetch('/api/spotify/now-playing');
          const nowPlayingData = await nowPlayingRes.json();
          if (nowPlayingData.success && nowPlayingData.nowPlaying) {
            setNowPlaying(nowPlayingData.nowPlaying);
          }
        } else {
          setConnected(false);
        }
      } catch (err) {
        setError('Failed to connect to Spotify');
        setConnected(false);
      } finally {
        setLoading(false);
      }
    }

    fetchSpotifyStatus();
    
    const interval = setInterval(fetchSpotifyStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-3 bg-black rounded-xl" data-testid="spotify-widget-loading">
        <div className="animate-pulse w-8 h-8 bg-[#1DB954] rounded-full"></div>
        <span className="text-white text-sm">
          {language === 'he' ? 'מתחבר ל-Spotify...' : 'Connecting to Spotify...'}
        </span>
      </div>
    );
  }

  if (!connected) {
    return (
      <a
        href="https://open.spotify.com/user/31ff52czgq4ezgui5ufyplo5mrbq"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 p-4 bg-black hover:bg-zinc-900 rounded-xl transition-all duration-300 group"
        data-testid="spotify-widget-disconnected"
      >
        <div className="w-10 h-10 bg-[#1DB954] rounded-full flex items-center justify-center">
          <SiSpotify className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1">
          <p className="text-white font-semibold text-sm">
            {language === 'he' ? 'האזינו ל-Pet Wash™' : 'Listen to Pet Wash™'}
          </p>
          <p className="text-zinc-400 text-xs">
            {language === 'he' ? 'עקבו אחרינו ב-Spotify' : 'Follow us on Spotify'}
          </p>
        </div>
        <ExternalLink className="w-4 h-4 text-zinc-500 group-hover:text-[#1DB954] transition-colors" />
      </a>
    );
  }

  if (variant === 'compact') {
    return (
      <div 
        className="flex items-center gap-3 p-3 bg-black rounded-xl"
        data-testid="spotify-widget-compact"
      >
        <div className="w-10 h-10 bg-[#1DB954] rounded-full flex items-center justify-center">
          <SiSpotify className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          {nowPlaying ? (
            <>
              <div className="flex items-center gap-2">
                {nowPlaying.isPlaying && (
                  <div className="flex gap-0.5">
                    <span className="w-0.5 h-3 bg-[#1DB954] animate-pulse"></span>
                    <span className="w-0.5 h-2 bg-[#1DB954] animate-pulse delay-75"></span>
                    <span className="w-0.5 h-4 bg-[#1DB954] animate-pulse delay-150"></span>
                  </div>
                )}
                <p className="text-white font-medium text-sm truncate">
                  {nowPlaying.track.name}
                </p>
              </div>
              <p className="text-zinc-400 text-xs truncate">
                {nowPlaying.track.artists}
              </p>
            </>
          ) : (
            <>
              <p className="text-white font-medium text-sm">
                {profile?.displayName || 'Pet Wash™'}
              </p>
              <p className="text-zinc-400 text-xs">
                {language === 'he' ? 'מחובר' : 'Connected'}
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div 
      className="p-4 bg-black rounded-2xl space-y-4"
      data-testid="spotify-widget-full"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SiSpotify className="w-6 h-6 text-[#1DB954]" />
          <span className="text-white font-bold">Spotify</span>
        </div>
        <span className="text-xs text-[#1DB954] font-medium">
          {language === 'he' ? 'מחובר' : 'Connected'}
        </span>
      </div>

      {profile && (
        <div className="flex items-center gap-3 p-3 bg-zinc-900 rounded-xl">
          {profile.images?.[0] ? (
            <img 
              src={profile.images[0].url} 
              alt={profile.displayName}
              className="w-12 h-12 rounded-full"
            />
          ) : (
            <div className="w-12 h-12 bg-zinc-800 rounded-full flex items-center justify-center">
              <User className="w-6 h-6 text-zinc-500" />
            </div>
          )}
          <div>
            <p className="text-white font-semibold">{profile.displayName}</p>
            <p className="text-zinc-400 text-sm">
              {profile.followers?.toLocaleString()} {language === 'he' ? 'עוקבים' : 'followers'}
            </p>
          </div>
        </div>
      )}

      {nowPlaying && (
        <div className="p-3 bg-zinc-900 rounded-xl">
          <div className="flex items-center gap-3">
            {nowPlaying.track.image ? (
              <img 
                src={nowPlaying.track.image} 
                alt={nowPlaying.track.album}
                className="w-14 h-14 rounded-lg"
              />
            ) : (
              <div className="w-14 h-14 bg-zinc-800 rounded-lg flex items-center justify-center">
                <Music className="w-6 h-6 text-zinc-500" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                {nowPlaying.isPlaying && (
                  <div className="flex gap-0.5">
                    <span className="w-0.5 h-3 bg-[#1DB954] animate-pulse"></span>
                    <span className="w-0.5 h-2 bg-[#1DB954] animate-pulse delay-75"></span>
                    <span className="w-0.5 h-4 bg-[#1DB954] animate-pulse delay-150"></span>
                  </div>
                )}
                <span className="text-xs text-[#1DB954] font-medium">
                  {nowPlaying.isPlaying 
                    ? (language === 'he' ? 'מתנגן עכשיו' : 'Now Playing')
                    : (language === 'he' ? 'מושהה' : 'Paused')
                  }
                </span>
              </div>
              <p className="text-white font-semibold truncate">{nowPlaying.track.name}</p>
              <p className="text-zinc-400 text-sm truncate">{nowPlaying.track.artists}</p>
            </div>
          </div>
          
          <div className="mt-3 h-1 bg-zinc-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-[#1DB954] transition-all duration-1000"
              style={{ width: `${(nowPlaying.progress / nowPlaying.duration) * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default SpotifyWidget;
