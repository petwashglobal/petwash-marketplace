import { Layout } from '@/components/Layout';
import { WashPackages } from '@/components/WashPackages';
import { LoyaltyProgram } from '@/components/LoyaltyProgram';
import { type Language, t } from '@/lib/i18n';
import { useState } from 'react';
import petwashStationPhoto from '@assets/petwash-station-real.png';

const MetallicIcon = ({ children, size = 28 }: { children: React.ReactNode; size?: number }) => (
  <div className="metallic-icon-wrapper">
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="metalGold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f5e6b8" />
          <stop offset="25%" stopColor="#d4af37" />
          <stop offset="50%" stopColor="#f5e6b8" />
          <stop offset="75%" stopColor="#c9a96e" />
          <stop offset="100%" stopColor="#d4af37" />
        </linearGradient>
        <linearGradient id="metalShine" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.4)" />
          <stop offset="50%" stopColor="rgba(255,255,255,0)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.1)" />
        </linearGradient>
        <filter id="goldGlow">
          <feGaussianBlur stdDeviation="1" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
      {children}
    </svg>
  </div>
);

const BoltIcon = () => (
  <MetallicIcon size={22}>
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="url(#metalGold)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" filter="url(#goldGlow)" />
  </MetallicIcon>
);

const LeafIcon = () => (
  <MetallicIcon size={22}>
    <path d="M17 8C8 10 5.9 16.17 3.82 21.34l1.89.66.95-2.3c.48.17.98.3 1.34.3C19 20 22 3 22 3c-1 2-8 2.25-13 3.25S2 11.5 2 13.5s1.75 3.75 1.75 3.75" stroke="url(#metalGold)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" filter="url(#goldGlow)" />
  </MetallicIcon>
);

const DiamondIcon = () => (
  <MetallicIcon size={22}>
    <path d="M2.7 10.3a2.41 2.41 0 0 0 0 3.41l7.59 7.59a2.41 2.41 0 0 0 3.41 0l7.59-7.59a2.41 2.41 0 0 0 0-3.41l-7.59-7.59a2.41 2.41 0 0 0-3.41 0L2.7 10.3z" stroke="url(#metalGold)" strokeWidth="1.5" fill="none" filter="url(#goldGlow)" />
  </MetallicIcon>
);

const TrophyIcon = () => (
  <MetallicIcon size={22}>
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6m12 5h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22h10c0-2-0.85-3.25-2.03-3.79A1.07 1.07 0 0 1 14 17v-2.34" stroke="url(#metalGold)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" filter="url(#goldGlow)" />
    <path d="M18 2H6v7a6 6 0 0 0 12 0V2z" stroke="url(#metalGold)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" filter="url(#goldGlow)" />
  </MetallicIcon>
);

const ThermometerIcon = () => (
  <MetallicIcon size={40}>
    <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" stroke="url(#metalGold)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" filter="url(#goldGlow)" />
    <circle cx="11.5" cy="17.5" r="1.5" fill="url(#metalGold)" />
  </MetallicIcon>
);

const DropletIcon = () => (
  <MetallicIcon size={40}>
    <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" stroke="url(#metalGold)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" filter="url(#goldGlow)" />
  </MetallicIcon>
);

const ShieldCheckIcon = () => (
  <MetallicIcon size={40}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="url(#metalGold)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" filter="url(#goldGlow)" />
    <path d="M9 12l2 2 4-4" stroke="url(#metalGold)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </MetallicIcon>
);

const FlaskIcon = () => (
  <MetallicIcon size={40}>
    <path d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2" stroke="url(#metalGold)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" filter="url(#goldGlow)" />
    <path d="M8.5 2h7" stroke="url(#metalGold)" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M7 16.5h10" stroke="url(#metalGold)" strokeWidth="1" strokeLinecap="round" opacity="0.5" />
  </MetallicIcon>
);

const SprayIcon = () => (
  <MetallicIcon size={40}>
    <path d="M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-3.89 2.5-4.5 1.17-.71 3.5-1.5 5.5-1.5s4.33.79 5.5 1.5C17.51 4.11 18.97 5.28 19 8c.03 2.5-.97 3.5-.97 5.62V16" stroke="url(#metalGold)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" filter="url(#goldGlow)" />
    <path d="M3 16h16v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2z" stroke="url(#metalGold)" strokeWidth="1.5" fill="none" />
    <path d="M7 20v2M15 20v2M11 8v4" stroke="url(#metalGold)" strokeWidth="1.5" strokeLinecap="round" />
  </MetallicIcon>
);

const LeafLargeIcon = () => (
  <MetallicIcon size={40}>
    <path d="M11 20A7 7 0 0 1 9.8 6.9C15.5 4.9 17 3.5 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z" stroke="url(#metalGold)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" filter="url(#goldGlow)" />
    <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" stroke="url(#metalGold)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </MetallicIcon>
);

interface OurServiceProps {
  language: Language;
  onLanguageChange: (language: Language) => void;
}

export default function OurService({ language, onLanguageChange }: OurServiceProps) {
  const [activeTab, setActiveTab] = useState('technology');

  const tabs = [
    {
      id: 'technology',
      label: t('ourService.technology', language),
      iconComponent: <BoltIcon />
    },
    {
      id: 'products',
      label: t('ourService.products', language),
      iconComponent: <LeafIcon />
    },
    {
      id: 'packages',
      label: t('ourService.packages', language),
      iconComponent: <DiamondIcon />
    },
    {
      id: 'loyalty',
      label: t('ourService.loyalty', language),
      iconComponent: <TrophyIcon />
    }
  ];

  return (
    <Layout language={language} onLanguageChange={onLanguageChange}>
      <div className="min-h-screen bg-white">
        <section className="luxury-services-hero">
          <div className="luxury-services-hero-content">
            <div className="luxury-services-badge">
              {t('ourService.title', language)}
            </div>
            <h1 className="luxury-services-title">
              {t('ourService.heroTitle', language)}
            </h1>
            <p className="luxury-services-subtitle">
              {t('ourService.heroSubtitle', language)}
            </p>
          </div>
        </section>

        <section className="luxury-tab-navigation">
          <div className="luxury-tab-container">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`luxury-tab-button ${activeTab === tab.id ? 'active' : ''}`}
              >
                <span className="luxury-tab-icon">{tab.iconComponent}</span>
                <span className="luxury-tab-label">{tab.label}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="luxury-tab-content" style={{ paddingBottom: '6rem' }}>
          {activeTab === 'technology' && (
            <div className="luxury-content-panel">
              {/* ── Header ── */}
              <div className="luxury-content-header">
                <h2 className="luxury-content-title">
                  {t('ourService.advancedTechnology', language)}
                </h2>
                <p className="luxury-content-subtitle">
                  {t('ourService.techSubtitle', language)}
                </p>
              </div>

              {/* ── K9000 Hero: SVG Illustration ── */}
              <div style={{
                background: '#ffffff',
                border: '2px solid rgba(212,175,55,0.25)',
                borderRadius: '1.5rem',
                padding: '2rem 1.5rem 1.5rem',
                marginBottom: '1rem',
                boxShadow: '0 8px 32px rgba(0,0,0,0.06)',
                position: 'relative',
                overflow: 'hidden',
              }}>
                {/* gold shimmer line at top */}
                <div style={{ position:'absolute', top:0, left:0, right:0, height:'3px', background:'linear-gradient(90deg, transparent, #d4af37, #f0d060, #d4af37, transparent)' }} />

                {/* model badge */}
                <div style={{ display:'flex', justifyContent:'center', marginBottom:'1rem' }}>
                  <span style={{ background:'linear-gradient(135deg,#c9a96e,#d4af37)', color:'#fff', fontSize:'0.7rem', fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', padding:'0.35rem 1.1rem', borderRadius:'100px' }}>
                    K9000 · {language === 'he' ? 'מתוצרת אוסטרליה' : 'Australian-Made'}
                  </span>
                </div>

                {/* ── Real Station Photo ── */}
                <div style={{ display:'flex', justifyContent:'center', alignItems:'center' }}>
                  <img
                    src={petwashStationPhoto}
                    alt={language === 'he' ? 'תחנת PetWash K9000 — Quick.Easy.24/7' : 'PetWash K9000 Station — Quick.Easy.24/7'}
                    style={{ width:'100%', maxWidth:'480px', height:'auto', borderRadius:'0.75rem', display:'block' }}
                  />
                </div>

                {/* Product caption */}
                <p style={{ textAlign:'center', color:'#7A7068', fontSize:'0.82rem', marginTop:'0.75rem', fontStyle:'italic' }}>
                  {language === 'he'
                    ? 'עמדת K9000 — שתי תאי שטיפה בו-זמנית, מיוצר באוסטרליה'
                    : 'K9000 Station — Dual simultaneous wash bays, manufactured in Australia'}
                </p>
              </div>

              {/* ── Feature Cards ── */}
              <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
                {/* Card 1: Temperature */}
                <div style={{
                  background:'#ffffff',
                  border:'1px solid rgba(212,175,55,0.2)',
                  borderRadius:'1.25rem',
                  padding:'1.25rem 1.25rem 1.25rem 1rem',
                  display:'flex',
                  alignItems:'flex-start',
                  gap:'1rem',
                  boxShadow:'0 2px 12px rgba(0,0,0,0.05)',
                  position:'relative',
                  overflow:'hidden',
                }}>
                  <div style={{ position:'absolute', top:0, left:0, right:0, height:'2px', background:'linear-gradient(90deg, transparent, rgba(212,175,55,0.35), transparent)' }} />
                  <div style={{ flexShrink:0, width:'52px', height:'52px', display:'flex', alignItems:'center', justifyContent:'center', background:'linear-gradient(145deg, rgba(212,175,55,0.12), rgba(212,175,55,0.05))', border:'1px solid rgba(212,175,55,0.25)', borderRadius:'14px' }}>
                    <ThermometerIcon />
                  </div>
                  <div style={{ flex:1 }}>
                    <h3 style={{ fontSize:'1rem', fontWeight:700, color:'#1A1A1A', marginBottom:'0.35rem' }}>
                      {t('ourService.temperatureControl', language)}
                    </h3>
                    <p style={{ fontSize:'0.875rem', color:'#7A7068', lineHeight:1.6 }}>
                      {t('ourService.tempControlDesc', language)}
                    </p>
                    <div style={{ marginTop:'0.6rem', display:'flex', gap:'0.5rem', flexWrap:'wrap' }}>
                      <span style={{ fontSize:'0.7rem', fontWeight:600, color:'#B8941F', background:'rgba(212,175,55,0.1)', border:'1px solid rgba(212,175,55,0.2)', borderRadius:'100px', padding:'0.2rem 0.6rem' }}>20°C – 45°C</span>
                      <span style={{ fontSize:'0.7rem', fontWeight:600, color:'#B8941F', background:'rgba(212,175,55,0.1)', border:'1px solid rgba(212,175,55,0.2)', borderRadius:'100px', padding:'0.2rem 0.6rem' }}>
                        {language === 'he' ? 'בקרה אוטומטית' : 'Auto-Regulated'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card 2: Pressure */}
                <div style={{
                  background:'#ffffff',
                  border:'1px solid rgba(212,175,55,0.2)',
                  borderRadius:'1.25rem',
                  padding:'1.25rem 1.25rem 1.25rem 1rem',
                  display:'flex',
                  alignItems:'flex-start',
                  gap:'1rem',
                  boxShadow:'0 2px 12px rgba(0,0,0,0.05)',
                  position:'relative',
                  overflow:'hidden',
                }}>
                  <div style={{ position:'absolute', top:0, left:0, right:0, height:'2px', background:'linear-gradient(90deg, transparent, rgba(212,175,55,0.35), transparent)' }} />
                  <div style={{ flexShrink:0, width:'52px', height:'52px', display:'flex', alignItems:'center', justifyContent:'center', background:'linear-gradient(145deg, rgba(212,175,55,0.12), rgba(212,175,55,0.05))', border:'1px solid rgba(212,175,55,0.25)', borderRadius:'14px' }}>
                    <DropletIcon />
                  </div>
                  <div style={{ flex:1 }}>
                    <h3 style={{ fontSize:'1rem', fontWeight:700, color:'#1A1A1A', marginBottom:'0.35rem' }}>
                      {t('ourService.adjustablePressure', language)}
                    </h3>
                    <p style={{ fontSize:'0.875rem', color:'#7A7068', lineHeight:1.6 }}>
                      {t('ourService.pressureDesc', language)}
                    </p>
                    <div style={{ marginTop:'0.6rem', display:'flex', gap:'0.5rem', flexWrap:'wrap' }}>
                      <span style={{ fontSize:'0.7rem', fontWeight:600, color:'#B8941F', background:'rgba(212,175,55,0.1)', border:'1px solid rgba(212,175,55,0.2)', borderRadius:'100px', padding:'0.2rem 0.6rem' }}>
                        {language === 'he' ? 'לחץ מתכוונן' : 'Variable Pressure'}
                      </span>
                      <span style={{ fontSize:'0.7rem', fontWeight:600, color:'#B8941F', background:'rgba(212,175,55,0.1)', border:'1px solid rgba(212,175,55,0.2)', borderRadius:'100px', padding:'0.2rem 0.6rem' }}>
                        {language === 'he' ? 'עדין לחיות' : 'Pet-Safe'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card 3: Sanitization */}
                <div style={{
                  background:'#ffffff',
                  border:'1px solid rgba(212,175,55,0.2)',
                  borderRadius:'1.25rem',
                  padding:'1.25rem 1.25rem 1.25rem 1rem',
                  display:'flex',
                  alignItems:'flex-start',
                  gap:'1rem',
                  boxShadow:'0 2px 12px rgba(0,0,0,0.05)',
                  position:'relative',
                  overflow:'hidden',
                }}>
                  <div style={{ position:'absolute', top:0, left:0, right:0, height:'2px', background:'linear-gradient(90deg, transparent, rgba(212,175,55,0.35), transparent)' }} />
                  <div style={{ flexShrink:0, width:'52px', height:'52px', display:'flex', alignItems:'center', justifyContent:'center', background:'linear-gradient(145deg, rgba(212,175,55,0.12), rgba(212,175,55,0.05))', border:'1px solid rgba(212,175,55,0.25)', borderRadius:'14px' }}>
                    <ShieldCheckIcon />
                  </div>
                  <div style={{ flex:1 }}>
                    <h3 style={{ fontSize:'1rem', fontWeight:700, color:'#1A1A1A', marginBottom:'0.35rem' }}>
                      {t('ourService.autoSanitization', language)}
                    </h3>
                    <p style={{ fontSize:'0.875rem', color:'#7A7068', lineHeight:1.6 }}>
                      {t('ourService.sanitizationDesc', language)}
                    </p>
                    <div style={{ marginTop:'0.6rem', display:'flex', gap:'0.5rem', flexWrap:'wrap' }}>
                      <span style={{ fontSize:'0.7rem', fontWeight:600, color:'#059669', background:'rgba(5,150,105,0.08)', border:'1px solid rgba(5,150,105,0.2)', borderRadius:'100px', padding:'0.2rem 0.6rem' }}>
                        {language === 'he' ? 'חיטוי אוטומטי' : 'Auto-Sanitize'}
                      </span>
                      <span style={{ fontSize:'0.7rem', fontWeight:600, color:'#059669', background:'rgba(5,150,105,0.08)', border:'1px solid rgba(5,150,105,0.2)', borderRadius:'100px', padding:'0.2rem 0.6rem' }}>
                        {language === 'he' ? 'בין כל חיה' : 'Per-Pet Cycle'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'products' && (
            <div className="luxury-content-panel">
              <div className="luxury-content-header">
                <h2 className="luxury-content-title">
                  {t('ourService.organicProducts', language)}
                </h2>
                <p className="luxury-content-subtitle">
                  {t('ourService.productsSubtitle', language)}
                </p>
              </div>

              <div className="luxury-products-grid">
                <div className="luxury-product-card luxury-product-metallic">
                  <div className="luxury-product-icon-metallic">
                    <FlaskIcon />
                  </div>
                  <h3 className="luxury-product-title">Natural Shampoo</h3>
                  <p className="luxury-product-desc">
                    {t('ourService.shampooDesc', language)}
                  </p>
                  <div className="luxury-product-badge">Premium</div>
                </div>
                
                <div className="luxury-product-card luxury-product-metallic">
                  <div className="luxury-product-icon-metallic">
                    <SprayIcon />
                  </div>
                  <h3 className="luxury-product-title">Natural Conditioner</h3>
                  <p className="luxury-product-desc">
                    {t('ourService.conditionerDesc', language)}
                  </p>
                  <div className="luxury-product-badge">Premium</div>
                </div>
                
                <div className="luxury-product-card luxury-product-metallic">
                  <div className="luxury-product-icon-metallic">
                    <LeafLargeIcon />
                  </div>
                  <h3 className="luxury-product-title">Tea Tree Oil Treatment</h3>
                  <p className="luxury-product-desc">
                    {t('ourService.teaTreeDesc', language)}
                  </p>
                  <div className="luxury-product-badge">Signature</div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'packages' && (
            <div className="luxury-content-panel">
              <div className="luxury-content-header">
                <h2 className="luxury-content-title">
                  {t('ourService.washPackages', language)}
                </h2>
                <p className="luxury-content-subtitle">
                  {t('ourService.packagesSubtitle', language)}
                </p>
              </div>
              <WashPackages language={language} />
            </div>
          )}

          {activeTab === 'loyalty' && (
            <div className="luxury-content-panel">
              <div className="luxury-content-header">
                <h2 className="luxury-content-title">
                  {t('ourService.loyaltyProgram', language)}
                </h2>
                <p className="luxury-content-subtitle">
                  {t('ourService.loyaltySubtitle', language)}
                </p>
              </div>
              <LoyaltyProgram language={language} />
            </div>
          )}
        </section>
      </div>
    </Layout>
  );
}