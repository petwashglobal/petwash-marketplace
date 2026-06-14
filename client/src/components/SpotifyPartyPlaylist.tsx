/**
 * SpotifyPartyPlaylist — the "Pet Wash Party" playlist, embedded DIRECTLY from
 * Spotify (public-playlist iframe). NO Replit, NO OAuth, NO connector, NO secrets,
 * NO backend — just Spotify's official embed of a public playlist. This replaces
 * the old SpotifyWidget that fetched tokens through Replit's connector proxy.
 *
 * Playlist: open.spotify.com/playlist/2W961ALkFr7Vt83VCn8Lso  (support@petwash.co.il)
 * To change the playlist, swap PLAYLIST_ID below.
 * NOTE: requires `https://open.spotify.com` in the CSP frame-src (securityHeaders.ts).
 */
import { useLanguage } from '@/lib/languageStore';
import { SiSpotify } from 'react-icons/si';

const PLAYLIST_ID = '2W961ALkFr7Vt83VCn8Lso';

export function SpotifyPartyPlaylist({ compact = false }: { compact?: boolean }) {
  const { language } = useLanguage();
  const he = language === 'he';
  const tr = (en: string, hv: string) => (he ? hv : en);

  return (
    <div className="luxury-glass-card luxury-shadow-lg p-5 sm:p-6" dir={he ? 'rtl' : 'ltr'}>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-[#1DB954] flex items-center justify-center shrink-0">
          <SiSpotify className="w-6 h-6 text-black" />
        </div>
        <div>
          <h3 className="luxury-heading-sm">{tr('Pet Wash Party', '⁦Pet Wash⁩ פּארטי')}</h3>
          <p className="luxury-text-small">{tr('Our playlist — press play 🎶', 'הפלייליסט שלנו — לחצו פליי 🎶')}</p>
        </div>
      </div>
      <iframe
        title="Pet Wash Party — Spotify playlist"
        src={`https://open.spotify.com/embed/playlist/${PLAYLIST_ID}?utm_source=generator&theme=0`}
        width="100%"
        height={compact ? 152 : 352}
        frameBorder="0"
        loading="lazy"
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        style={{ borderRadius: '12px', display: 'block' }}
      />
    </div>
  );
}

export default SpotifyPartyPlaylist;
