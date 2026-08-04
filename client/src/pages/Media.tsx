import { useLocation } from "wouter";
import { Camera, Video, FileText, Download, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSEO, pageSEO } from '@/lib/seo';
import { useLanguage } from '@/lib/languageStore';

// Full multi-language copy (was hard-coded English — showed English even when the
// site language was Hebrew). CEO 2026-08-04.
type Lang = 'he' | 'en' | 'ar' | 'ru' | 'fr' | 'es';
const COPY: Record<Lang, Record<string, string>> = {
  he: {
    title: 'מדיה, תמונות וסרטונים',
    subtitle: 'נכסי מותג, חומרים לעיתונות ומשאבי מדיה',
    videoTitle: 'איך משתמשים בעמדת ⁦PetWash™⁩',
    videoSubtitle: 'מדריך קצר, צעד אחר צעד, לעמדת הרחיצה העצמית החכמה שלנו',
    clickToPlay: 'לחצו להפעלה',
    galleryTitle: 'גלריית תמונות',
    galleryDesc: 'תמונות ברזולוציה גבוהה של העמדות, השירותים וחיות מרוצות',
    galleryBtn: 'לגלריה',
    videoResTitle: 'סרטונים ומדריכים',
    videoResDesc: 'מדריכים, הדגמות עמדה וסיפורי מותג',
    videoResBtn: 'לצפייה במדריך',
    pressTitle: 'ערכת עיתונות',
    pressDesc: 'לוגואים, הנחיות מותג והודעות לעיתונות',
    pressBtn: 'הורדת ערכה',
    inqTitle: 'פניות מדיה',
    inqDesc: 'לפניות עיתונות, ראיונות או שיתופי פעולה עם המותג',
    inqBtn: 'צרו קשר עם צוות המדיה',
  },
  en: {
    title: 'Media, Photos and Videos',
    subtitle: 'Brand assets, press materials, and media resources',
    videoTitle: 'How to Use a PetWash™ Station',
    videoSubtitle: 'A quick, step-by-step guide to our smart self-service dog-wash hub',
    clickToPlay: 'Click to Play',
    galleryTitle: 'Photo Gallery',
    galleryDesc: 'High-resolution photos of our stations, services, and happy pets',
    galleryBtn: 'View Gallery',
    videoResTitle: 'Video Resources',
    videoResDesc: 'Tutorials, station demos, and brand stories',
    videoResBtn: 'Watch the Guide',
    pressTitle: 'Press Kit',
    pressDesc: 'Logos, brand guidelines, and press releases',
    pressBtn: 'Download Kit',
    inqTitle: 'Media Inquiries',
    inqDesc: 'For press inquiries, interviews, or media partnerships',
    inqBtn: 'Contact Media Team',
  },
  ar: {
    title: 'الوسائط والصور والفيديو',
    subtitle: 'أصول العلامة التجارية والمواد الصحفية وموارد الوسائط',
    videoTitle: 'كيفية استخدام محطة ⁦PetWash™⁩',
    videoSubtitle: 'دليل سريع خطوة بخطوة لمحطة الغسيل الذاتي الذكية لدينا',
    clickToPlay: 'اضغط للتشغيل',
    galleryTitle: 'معرض الصور',
    galleryDesc: 'صور عالية الدقة لمحطاتنا وخدماتنا وحيوانات سعيدة',
    galleryBtn: 'عرض المعرض',
    videoResTitle: 'مصادر الفيديو',
    videoResDesc: 'دروس تعليمية وعروض للمحطة وقصص العلامة التجارية',
    videoResBtn: 'شاهد الدليل',
    pressTitle: 'المواد الصحفية',
    pressDesc: 'الشعارات وإرشادات العلامة التجارية والبيانات الصحفية',
    pressBtn: 'تنزيل المجموعة',
    inqTitle: 'استفسارات الإعلام',
    inqDesc: 'للاستفسارات الصحفية أو المقابلات أو الشراكات الإعلامية',
    inqBtn: 'اتصل بفريق الإعلام',
  },
  ru: {
    title: 'Медиа, фото и видео',
    subtitle: 'Фирменные материалы, пресс-материалы и медиаресурсы',
    videoTitle: 'Как пользоваться станцией PetWash™',
    videoSubtitle: 'Краткое пошаговое руководство по нашей умной станции самообслуживания',
    clickToPlay: 'Нажмите для воспроизведения',
    galleryTitle: 'Фотогалерея',
    galleryDesc: 'Фото высокого разрешения наших станций, услуг и счастливых питомцев',
    galleryBtn: 'Открыть галерею',
    videoResTitle: 'Видеоматериалы',
    videoResDesc: 'Руководства, демонстрации станций и истории бренда',
    videoResBtn: 'Смотреть руководство',
    pressTitle: 'Пресс-кит',
    pressDesc: 'Логотипы, гайдлайны бренда и пресс-релизы',
    pressBtn: 'Скачать пресс-кит',
    inqTitle: 'Запросы для прессы',
    inqDesc: 'По вопросам прессы, интервью или медиапартнёрства',
    inqBtn: 'Связаться с медиакомандой',
  },
  fr: {
    title: 'Médias, photos et vidéos',
    subtitle: 'Ressources de marque, matériel de presse et médias',
    videoTitle: 'Comment utiliser une borne PetWash™',
    videoSubtitle: 'Un guide rapide, étape par étape, de notre borne intelligente en libre-service',
    clickToPlay: 'Cliquez pour lire',
    galleryTitle: 'Galerie photos',
    galleryDesc: 'Photos haute résolution de nos bornes, services et animaux heureux',
    galleryBtn: 'Voir la galerie',
    videoResTitle: 'Ressources vidéo',
    videoResDesc: 'Tutoriels, démos de bornes et histoires de marque',
    videoResBtn: 'Voir le guide',
    pressTitle: 'Kit de presse',
    pressDesc: 'Logos, chartes de marque et communiqués de presse',
    pressBtn: 'Télécharger le kit',
    inqTitle: 'Demandes presse',
    inqDesc: 'Pour la presse, les interviews ou les partenariats médias',
    inqBtn: 'Contacter l’équipe médias',
  },
  es: {
    title: 'Medios, fotos y videos',
    subtitle: 'Recursos de marca, material de prensa y medios',
    videoTitle: 'Cómo usar una estación PetWash™',
    videoSubtitle: 'Una guía rápida, paso a paso, de nuestra estación inteligente de autoservicio',
    clickToPlay: 'Haz clic para reproducir',
    galleryTitle: 'Galería de fotos',
    galleryDesc: 'Fotos en alta resolución de nuestras estaciones, servicios y mascotas felices',
    galleryBtn: 'Ver galería',
    videoResTitle: 'Recursos de video',
    videoResDesc: 'Tutoriales, demostraciones de estaciones e historias de marca',
    videoResBtn: 'Ver la guía',
    pressTitle: 'Kit de prensa',
    pressDesc: 'Logotipos, guías de marca y comunicados de prensa',
    pressBtn: 'Descargar kit',
    inqTitle: 'Consultas de prensa',
    inqDesc: 'Para prensa, entrevistas o colaboraciones con medios',
    inqBtn: 'Contactar al equipo de medios',
  },
};

export default function Media() {
  useSEO(pageSEO.media);
  const [, setLocation] = useLocation();
  const { language } = useLanguage();
  const c = COPY[(language as Lang)] || COPY.en;
  const isRTL = language === 'he' || language === 'ar';

  const scrollToVideo = () => {
    document.getElementById('media-howto-video')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <div className="min-h-screen luxury-bg-mesh" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="container max-w-6xl mx-auto px-4 py-16">
        <div className="text-center mb-12 luxury-fade-in">
          <div className="inline-block p-4 rounded-full luxury-glass-minimal mb-6 luxury-scale-in">
            <Camera className="w-16 h-16 luxury-gradient-icon" />
          </div>
          <h1 className="luxury-heading-xl mb-6">{c.title}</h1>
          <p className="luxury-subtitle-lg">{c.subtitle}</p>
        </div>

        {/* Featured REAL how-to video (was fake "Available Soon" placeholders) */}
        <div id="media-howto-video" className="mb-16 max-w-4xl mx-auto luxury-slide-up">
          <div className="text-center mb-6">
            <h2 className="text-2xl md:text-3xl font-bold luxury-gradient-text mb-2">{c.videoTitle}</h2>
            <p className="luxury-text-body">{c.videoSubtitle}</p>
          </div>
          <div className="luxury-glass-card luxury-shadow-xl p-1">
            <div className="relative rounded-3xl overflow-hidden bg-black" style={{ paddingBottom: '56.25%' }}>
              <iframe
                className="absolute inset-0 w-full h-full"
                src="https://www.youtube-nocookie.com/embed/UHqb_8gCOag?rel=0"
                title="PetWash™ — How to use the smart self-service station"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                loading="lazy"
                data-testid="media-howto-video"
              />
            </div>
            <div className="bg-[#D4AF37]/10 backdrop-blur-sm p-4 text-center">
              <div className="flex items-center justify-center gap-3 luxury-text-body">
                <Play className="w-5 h-5 text-[#D4AF37]" />
                <span className="text-sm font-medium">{c.clickToPlay}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="luxury-grid-3 mb-16 luxury-stagger-fade-in">
          <div className="luxury-glass-minimal luxury-hover-lift p-8 cursor-pointer" onClick={() => setLocation("/gallery")} style={{ animationDelay: '0.1s' }}>
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#D4AF37] to-[#D4AF37] flex items-center justify-center mb-6 luxury-pulse-glow">
              <Camera className="w-7 h-7 text-white" />
            </div>
            <h3 className="text-xl font-bold mb-3 luxury-gradient-text">{c.galleryTitle}</h3>
            <p className="luxury-text-body mb-6">{c.galleryDesc}</p>
            <Button className="luxury-btn-outline w-full" onClick={(e) => { e.stopPropagation(); setLocation("/gallery"); }} data-testid="button-view-gallery">
              {c.galleryBtn}
            </Button>
          </div>

          <div className="luxury-glass-minimal luxury-hover-lift p-8 cursor-pointer" onClick={scrollToVideo} style={{ animationDelay: '0.2s' }}>
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#D4AF37] to-[#D4AF37] flex items-center justify-center mb-6 luxury-pulse-glow">
              <Video className="w-7 h-7 text-white" />
            </div>
            <h3 className="text-xl font-bold mb-3 luxury-gradient-text">{c.videoResTitle}</h3>
            <p className="luxury-text-body mb-6">{c.videoResDesc}</p>
            <Button className="luxury-btn-outline w-full" onClick={(e) => { e.stopPropagation(); scrollToVideo(); }} data-testid="button-videos">
              <Play className="w-4 h-4 mr-2" />
              {c.videoResBtn}
            </Button>
          </div>

          <div className="luxury-glass-minimal luxury-hover-lift p-8 cursor-pointer" onClick={() => setLocation("/gallery")} style={{ animationDelay: '0.3s' }}>
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center mb-6 luxury-pulse-glow">
              <FileText className="w-7 h-7 text-white" />
            </div>
            <h3 className="text-xl font-bold mb-3 luxury-gradient-text">{c.pressTitle}</h3>
            <p className="luxury-text-body mb-6">{c.pressDesc}</p>
            <Button className="luxury-btn-outline w-full" onClick={(e) => { e.stopPropagation(); setLocation("/gallery"); }} data-testid="button-press-kit">
              <Download className="w-4 h-4 mr-2" />
              {c.pressBtn}
            </Button>
          </div>
        </div>

        <div className="luxury-glass-card luxury-shadow-xl p-12 text-center luxury-bg-primary luxury-slide-up">
          <h2 className="text-3xl font-bold mb-4 text-white">{c.inqTitle}</h2>
          <p className="text-white/90 text-lg mb-8">{c.inqDesc}</p>
          <a href="mailto:info@petwash.co.il">
            <Button className="luxury-btn-white luxury-shadow-xl" data-testid="button-media-contact">
              {c.inqBtn}
            </Button>
          </a>
        </div>
      </div>
    </div>
  );
}
