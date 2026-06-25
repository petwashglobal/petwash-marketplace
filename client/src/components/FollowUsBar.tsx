/**
 * FollowUsBar — "Follow / Join us" social row for the app home screens.
 * Reuses the canonical PetWash™ handles (all @petwashltd, #PetWashLtd) already
 * used in PetWashHeader. Drop into the Prestige (customer) home + Provider home
 * above the tab bar. Brand: gold accent on white (customer) — neutral, theme-safe.
 */
import { SiInstagram, SiFacebook, SiTiktok, SiSpotify } from 'react-icons/si';

const LINKS = [
  { key: 'instagram', href: 'https://www.instagram.com/petwashltd', label: 'Pet Wash on Instagram', Icon: SiInstagram },
  { key: 'tiktok',    href: 'https://www.tiktok.com/@petwashltd',     label: 'Pet Wash on TikTok',     Icon: SiTiktok },
  { key: 'facebook',  href: 'https://www.facebook.com/petwashltd',    label: 'Pet Wash on Facebook',   Icon: SiFacebook },
  { key: 'spotify',   href: 'https://open.spotify.com/user/31ff52czgq4ezgui5ufyplo5mrbq', label: 'Pet Wash on Spotify', Icon: SiSpotify },
];

export function FollowUsBar({ className = '' }: { className?: string }) {
  return (
    <div className={`flex flex-col items-center gap-2 py-4 ${className}`} data-testid="follow-us-bar">
      <span className="text-xs font-medium tracking-wide" style={{ color: '#6b7280' }}>
        Follow us · #PetWashLtd
      </span>
      <div className="flex items-center gap-4">
        {LINKS.map(({ key, href, label, Icon }) => (
          <a
            key={key}
            href={href}
            target="_blank"
            rel="noreferrer"
            aria-label={label}
            data-testid={`follow-${key}`}
            className="flex items-center justify-center transition-transform hover:scale-110"
            style={{ width: 38, height: 38, borderRadius: 12, background: 'rgba(212,175,55,0.10)', color: '#B8860B' }}
          >
            <Icon size={18} />
          </a>
        ))}
      </div>
    </div>
  );
}

export default FollowUsBar;
