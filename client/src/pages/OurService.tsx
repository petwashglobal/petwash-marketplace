import { Layout } from '@/components/Layout';
import { WashPackages } from '@/components/WashPackages';
import { LoyaltyProgram } from '@/components/LoyaltyProgram';
import { type Language, t } from '@/lib/i18n';
import { useState } from 'react';
import dualWashStationImage from '@assets/d6f7faf6-2f4a-41eb-a35f-fe3b8a99865a_1752051520790.jpeg';

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
      icon: '⚡'
    },
    {
      id: 'products',
      label: t('ourService.products', language),
      icon: '🌿'
    },
    {
      id: 'packages',
      label: t('ourService.packages', language),
      icon: '💎'
    },
    {
      id: 'loyalty',
      label: t('ourService.loyalty', language),
      icon: '🏆'
    }
  ];

  return (
    <Layout language={language} onLanguageChange={onLanguageChange}>
      <div className="min-h-screen bg-white">
        {/* Luxury Hero Section */}
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

        {/* Luxury Tab Navigation */}
        <section className="luxury-tab-navigation">
          <div className="luxury-tab-container">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`luxury-tab-button ${activeTab === tab.id ? 'active' : ''}`}
              >
                <span className="luxury-tab-icon">{tab.icon}</span>
                <span className="luxury-tab-label">{tab.label}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Tab Content */}
        <section className="luxury-tab-content">
          {activeTab === 'technology' && (
            <div className="luxury-content-panel">
              <div className="luxury-content-header">
                <h2 className="luxury-content-title">
                  {t('ourService.advancedTechnology', language)}
                </h2>
                <p className="luxury-content-subtitle">
                  {t('ourService.techSubtitle', language)}
                </p>
              </div>

              <div className="luxury-tech-showcase">
                <div className="luxury-tech-image">
                  <img 
                    src={dualWashStationImage} 
                    alt={t('ourService.k9000SystemAlt', language)}
                    className="luxury-tech-photo"
                  />
                  <div className="luxury-tech-overlay">
                    <span className="luxury-tech-label">
                      {t('ourService.dualWashingStation', language)}
                    </span>
                  </div>
                </div>
                
                <div className="luxury-tech-features">
                  <div className="luxury-feature-card">
                    <div className="luxury-feature-icon">🌡️</div>
                    <h3 className="luxury-feature-title">
                      {t('ourService.temperatureControl', language)}
                    </h3>
                    <p className="luxury-feature-desc">
                      {t('ourService.tempControlDesc', language)}
                    </p>
                  </div>
                  
                  <div className="luxury-feature-card">
                    <div className="luxury-feature-icon">💧</div>
                    <h3 className="luxury-feature-title">
                      {t('ourService.adjustablePressure', language)}
                    </h3>
                    <p className="luxury-feature-desc">
                      {t('ourService.pressureDesc', language)}
                    </p>
                  </div>
                  
                  <div className="luxury-feature-card">
                    <div className="luxury-feature-icon">🔄</div>
                    <h3 className="luxury-feature-title">
                      {t('ourService.autoSanitization', language)}
                    </h3>
                    <p className="luxury-feature-desc">
                      {t('ourService.sanitizationDesc', language)}
                    </p>
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
                <div className="luxury-product-card">
                  <div className="luxury-product-icon">🧴</div>
                  <h3 className="luxury-product-title">100% Organic Shampoo</h3>
                  <p className="luxury-product-desc">
                    {t('ourService.shampooDesc', language)}
                  </p>
                </div>
                
                <div className="luxury-product-card">
                  <div className="luxury-product-icon">🌿</div>
                  <h3 className="luxury-product-title">Organic Conditioner</h3>
                  <p className="luxury-product-desc">
                    {t('ourService.conditionerDesc', language)}
                  </p>
                </div>
                
                <div className="luxury-product-card">
                  <div className="luxury-product-icon">🌱</div>
                  <h3 className="luxury-product-title">Tea Tree Oil Treatment</h3>
                  <p className="luxury-product-desc">
                    {t('ourService.teaTreeDesc', language)}
                  </p>
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