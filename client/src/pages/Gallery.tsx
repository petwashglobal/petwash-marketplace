import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { t, type Language } from '@/lib/i18n';
import { X, Play } from 'lucide-react';
import galleryVideoSrc from '@assets/petwash-gallery-video.mp4';
import galleryVideo2Src from '@assets/petwash-video-2.mp4';

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
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [video2Playing, setVideo2Playing] = useState(false);

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

          {/* Featured Video Section */}
          <div className="mb-16">
            <div className="relative rounded-3xl overflow-hidden shadow-2xl group max-w-5xl mx-auto">
              <video
                src={galleryVideoSrc}
                className="w-full h-auto"
                controls={videoPlaying}
                playsInline
                onPlay={() => setVideoPlaying(true)}
                onPause={() => setVideoPlaying(false)}
                data-testid="gallery-video"
              />
              {!videoPlaying && (
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30 flex items-center justify-center cursor-pointer"
                     onClick={() => {
                       const video = document.querySelector('video');
                       video?.play();
                     }}>
                  <div className="bg-white/20 backdrop-blur-md rounded-full p-8 group-hover:scale-110 group-hover:bg-white/30 transition-all duration-300">
                    <Play size={64} className="text-white" />
                  </div>
                  <div className="absolute top-6 left-6 bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-6 py-3 rounded-full text-sm font-semibold shadow-lg backdrop-blur-sm">
                    ✨ Featured Video
                  </div>
                </div>
              )}
            </div>
            <p className="text-center text-gray-600 mt-6 text-lg font-medium">
              {t('gallery.videoCaption', language)}
            </p>
          </div>

          {/* Second Featured Video */}
          <div className="mb-16">
            <div className="relative rounded-3xl overflow-hidden shadow-2xl group max-w-5xl mx-auto">
              <video
                src={galleryVideo2Src}
                className="w-full h-auto"
                controls={video2Playing}
                playsInline
                onPlay={() => setVideo2Playing(true)}
                onPause={() => setVideo2Playing(false)}
                data-testid="gallery-video-2"
              />
              {!video2Playing && (
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30 flex items-center justify-center cursor-pointer"
                     onClick={() => {
                       const videos = document.querySelectorAll('video');
                       videos[1]?.play();
                     }}>
                  <div className="bg-white/20 backdrop-blur-md rounded-full p-8 group-hover:scale-110 group-hover:bg-white/30 transition-all duration-300">
                    <Play size={64} className="text-white" />
                  </div>
                  <div className="absolute top-6 left-6 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-3 rounded-full text-sm font-semibold shadow-lg backdrop-blur-sm">
                    🎬 Latest Video
                  </div>
                </div>
              )}
            </div>
            <p className="text-center text-gray-600 mt-6 text-lg font-medium">
              {t('gallery.latestVideoCaption', language)}
            </p>
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
