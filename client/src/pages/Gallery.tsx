import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { t, type Language } from '@/lib/i18n';
import { X, Play } from 'lucide-react';

// Gallery images
const galleryImages = [
  {
    src: '/gallery/C4EFE9DA-C7A6-4252-AB3F-7ED77BAC1A9B_1761100129902.png',
    alt: 'PetWash Station Signage',
    category: 'branding',
    featured: true
  },
  {
    src: '/gallery/D8595123-1F98-4FC8-BE89-7D609439F334_1761100129902.png',
    alt: 'PetWash Logo',
    category: 'branding',
    featured: false
  },
  {
    src: '/gallery/IMG_8664_1761100129901.jpeg',
    alt: 'Pet Wash Station',
    category: 'station',
    featured: true
  },
  {
    src: '/gallery/IMG_8665_1761100129901.jpeg',
    alt: 'Pet Wash Station Interior',
    category: 'station',
    featured: false
  },
  {
    src: '/gallery/IMG_8666_1761100129901.jpeg',
    alt: 'Pet Wash Equipment',
    category: 'station',
    featured: false
  },
  {
    src: '/gallery/IMG_8667_1761100129901.jpeg',
    alt: 'Pet Wash Station Setup',
    category: 'station',
    featured: true
  },
  {
    src: '/gallery/IMG_8668_1761100129901.jpeg',
    alt: 'Pet Wash Station Details',
    category: 'station',
    featured: false
  },
  {
    src: '/gallery/IMG_8435_1761100129902.jpeg',
    alt: 'Pet Wash Station',
    category: 'station',
    featured: false
  },
  {
    src: '/gallery/IMG_9080_1761100129901.jpeg',
    alt: 'Pet Wash Station',
    category: 'station',
    featured: true
  },
  {
    src: '/gallery/35f36f7e-65cb-4c8c-8b8e-0207879dcc16_1761100129902.jpeg',
    alt: 'Pet Wash Station',
    category: 'station',
    featured: false
  },
  {
    src: '/gallery/IMG_8935_1761100227728.jpeg',
    alt: 'Pet Wash Station',
    category: 'station',
    featured: false
  }
];

interface GalleryProps {
  language: Language;
  onLanguageChange: (language: Language) => void;
}

export default function Gallery({ language, onLanguageChange }: GalleryProps) {
  const [selectedImage, setSelectedImage] = useState<number | null>(null);
  const [filter, setFilter] = useState<'all' | 'branding' | 'station'>('all');

  const filteredImages = filter === 'all' 
    ? galleryImages 
    : galleryImages.filter(img => img.category === filter);

  return (
    <Layout language={language} onLanguageChange={onLanguageChange}>
      <div className="min-h-screen bg-white py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center mb-16">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-6 bg-gradient-to-r from-blue-600 via-cyan-600 to-blue-600 bg-clip-text text-transparent">
              {t('gallery.title', language)}
            </h1>
            <p className="text-lg text-gray-700 max-w-3xl mx-auto">
              {t('gallery.subtitle', language)}
            </p>
          </div>

          {/* Featured YouTube Video Section */}
          <div className="mb-16">
            <div className="max-w-5xl mx-auto">
              <div className="text-center mb-8">
                <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4 bg-gradient-to-r from-red-600 via-pink-600 to-red-600 bg-clip-text text-transparent">
                  {language === 'he' ? 'צפו בסרטון שלנו' : language === 'ar' ? 'شاهد الفيديو الخاص بنا' : language === 'ru' ? 'Посмотрите наше видео' : language === 'fr' ? 'Regardez notre vidéo' : language === 'es' ? 'Mira nuestro video' : 'Watch Our Video'}
                </h2>
                <p className="text-lg text-gray-700">
                  {language === 'he' ? 'גלה את חווית הכביסה האורגנית הפרימיום שלנו לחיות מחמד' : language === 'ar' ? 'اكتشف تجربة الغسيل العضوية الفاخرة لحيواناتك الأليفة' : language === 'ru' ? 'Откройте для себя наш премиум органический опыт мытья домашних животных' : language === 'fr' ? 'Découvrez notre expérience de lavage bio premium pour animaux' : language === 'es' ? 'Descubre nuestra experiencia premium de lavado orgánico para mascotas' : 'Discover our premium organic pet wash experience'}
                </p>
              </div>
              
              <div className="relative rounded-3xl overflow-hidden shadow-2xl bg-gradient-to-br from-gray-900 to-gray-800 p-1">
                <div className="relative rounded-3xl overflow-hidden bg-black" style={{ paddingBottom: '56.25%' }}>
                  <iframe
                    className="absolute inset-0 w-full h-full"
                    src="https://www.youtube.com/embed/Om-iwY_vt5M?si=vGYJEwYMFyYRSoow"
                    title="Pet Wash™ - Premium Organic Pet Care Experience"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    data-testid="youtube-video"
                  />
                </div>
                
                {/* Video Stats Bar */}
                <div className="bg-gradient-to-r from-red-600/10 via-pink-600/10 to-red-600/10 backdrop-blur-sm p-4 text-center">
                  <div className="flex items-center justify-center gap-3 text-gray-700">
                    <Play className="w-5 h-5 text-red-600" />
                    <span className="text-sm font-medium">
                      {language === 'he' ? 'לחץ להפעלה' : language === 'ar' ? 'انقر للتشغيل' : language === 'ru' ? 'Нажмите для воспроизведения' : language === 'fr' ? 'Cliquez pour jouer' : language === 'es' ? 'Haz clic para reproducir' : 'Click to Play'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Filter Buttons */}
          <div className="flex justify-center gap-4 mb-12 flex-wrap">
            <button
              onClick={() => setFilter('all')}
              className={`px-6 py-3 rounded-full font-medium transition-all duration-300 ${
                filter === 'all'
                  ? 'bg-gradient-to-r from-blue-600 via-cyan-600 to-blue-600 text-white shadow-lg hover:shadow-2xl hover:scale-105'
                  : 'bg-white/50 backdrop-blur-sm text-gray-700 border border-gray-300 hover:border-blue-300 hover:shadow-xl hover:scale-105'
              }`}
              data-testid="filter-all"
            >
              {t('gallery.all', language)}
            </button>
            <button
              onClick={() => setFilter('branding')}
              className={`px-6 py-3 rounded-full font-medium transition-all duration-300 ${
                filter === 'branding'
                  ? 'bg-gradient-to-r from-blue-600 via-cyan-600 to-blue-600 text-white shadow-lg hover:shadow-2xl hover:scale-105'
                  : 'bg-white/50 backdrop-blur-sm text-gray-700 border border-gray-300 hover:border-blue-300 hover:shadow-xl hover:scale-105'
              }`}
              data-testid="filter-branding"
            >
              {t('gallery.branding', language)}
            </button>
            <button
              onClick={() => setFilter('station')}
              className={`px-6 py-3 rounded-full font-medium transition-all duration-300 ${
                filter === 'station'
                  ? 'bg-gradient-to-r from-blue-600 via-cyan-600 to-blue-600 text-white shadow-lg hover:shadow-2xl hover:scale-105'
                  : 'bg-white/50 backdrop-blur-sm text-gray-700 border border-gray-300 hover:border-blue-300 hover:shadow-xl hover:scale-105'
              }`}
              data-testid="filter-stations"
            >
              {t('gallery.stations', language)}
            </button>
          </div>

          {/* Masonry Grid - Fashion Brand Style */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredImages.map((image, index) => (
              <div
                key={index}
                className={`group relative overflow-hidden rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-500 cursor-pointer ${
                  image.featured ? 'md:col-span-2 lg:row-span-2' : ''
                }`}
                onClick={() => setSelectedImage(index)}
                data-testid={`gallery-image-${index}`}
              >
                {/* Image */}
                <div className="relative overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200">
                  <img
                    src={image.src}
                    alt={image.alt}
                    className="w-full h-full object-cover transition-all duration-700 group-hover:scale-110 group-hover:rotate-1"
                    style={{
                      minHeight: image.featured ? '500px' : '300px',
                      maxHeight: image.featured ? '700px' : '400px'
                    }}
                    loading="lazy"
                  />
                  
                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  
                  {/* Hover Info */}
                  <div className="absolute bottom-0 left-0 right-0 p-6 text-white transform translate-y-full group-hover:translate-y-0 transition-transform duration-500">
                    <p className="text-sm font-medium opacity-90">{image.alt}</p>
                  </div>

                  {/* Featured Badge */}
                  {image.featured && (
                    <div className="absolute top-4 right-4">
                      <div className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-4 py-2 rounded-full text-xs font-semibold shadow-lg backdrop-blur-sm">
                        {t('gallery.featured', language)}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Empty State */}
          {filteredImages.length === 0 && (
            <div className="text-center py-20">
              <p className="text-gray-500 text-lg">{t('gallery.noImages', language)}</p>
            </div>
          )}
        </div>
      </div>

      {/* Lightbox Modal */}
      {selectedImage !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in duration-300"
          onClick={() => setSelectedImage(null)}
          data-testid="lightbox-modal"
        >
          <button
            onClick={() => setSelectedImage(null)}
            className="absolute top-4 right-4 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all duration-300 hover:scale-110 hover:rotate-90"
            data-testid="close-lightbox"
          >
            <X size={24} />
          </button>
          
          <div
            className="max-w-6xl max-h-[90vh] relative"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={filteredImages[selectedImage].src}
              alt={filteredImages[selectedImage].alt}
              className="w-full h-full object-contain rounded-xl shadow-2xl"
            />
            
            {/* Image Counter */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/10 backdrop-blur-md text-white px-6 py-3 rounded-full text-sm font-medium">
              {selectedImage + 1} / {filteredImages.length}
            </div>
          </div>

          {/* Navigation Arrows */}
          {selectedImage > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSelectedImage(selectedImage - 1);
              }}
              className="absolute left-4 p-4 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all duration-300 hover:scale-110"
              data-testid="prev-image"
            >
              ←
            </button>
          )}
          {selectedImage < filteredImages.length - 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSelectedImage(selectedImage + 1);
              }}
              className="absolute right-4 p-4 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all duration-300 hover:scale-110"
              data-testid="next-image"
            >
              →
            </button>
          )}
        </div>
      )}
    </Layout>
  );
}
