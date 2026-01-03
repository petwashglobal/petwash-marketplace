import { Link } from "wouter";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { 
  Car, 
  Calendar, 
  Shield,
  Sparkles,
  ArrowRight,
  MapPin,
  Clock,
  Heart,
  Star,
  CheckCircle,
  Users,
  Award,
  Thermometer,
  Video,
  Phone,
  CreditCard,
  Plane,
  Activity
} from "lucide-react";
import { useSEO, pageSEO } from "@/lib/seo";
import { useLanguage } from "@/lib/languageStore";

export default function PetTrekOverview() {
  useSEO(pageSEO.petTrek);
  const { t } = useLanguage();
  
  const serviceTypes = [
    {
      icon: <Activity className="h-8 w-8" />,
      name: t('pettrek.vetTransport'),
      description: t('pettrek.vetTransportDesc'),
      priceFrom: "₪89",
      link: "/pettrek/book?service=vet"
    },
    {
      icon: <Sparkles className="h-8 w-8" />,
      name: t('k9000.products'),
      description: t('k9000.productsDesc'),
      priceFrom: "₪79",
      link: "/pettrek/book?service=grooming"
    },
    {
      icon: <Plane className="h-8 w-8" />,
      name: "Airport Transfer",
      description: "Premium pet transport to and from airports",
      priceFrom: "₪249",
      link: "/pettrek/book?service=airport"
    },
    {
      icon: <MapPin className="h-8 w-8" />,
      name: "Day Care",
      description: "Daily transport to your pet's daycare facility",
      priceFrom: "₪69",
      link: "/pettrek/book?service=daycare"
    },
    {
      icon: <Heart className="h-8 w-8" />,
      name: "Emergency Transport",
      description: "24/7 urgent pet transportation services",
      priceFrom: "₪199",
      link: "/pettrek/book?service=emergency"
    },
    {
      icon: <Calendar className="h-8 w-8" />,
      name: "Custom Trips",
      description: "Any destination, any time - we've got you covered",
      priceFrom: "₪99",
      link: "/pettrek/book?service=custom"
    }
  ];

  const featuredDrivers = [
    {
      name: "Sarah Cohen",
      rating: 4.9,
      trips: 2847,
      photo: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop",
      pricePerKm: "₪8",
      specialty: "Large Breeds"
    },
    {
      name: "David Levi",
      rating: 5.0,
      trips: 3156,
      photo: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop",
      pricePerKm: "₪7",
      specialty: "Senior Pets"
    },
    {
      name: "Maya Rosen",
      rating: 4.8,
      trips: 1923,
      photo: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop",
      pricePerKm: "₪9",
      specialty: "Exotic Pets"
    },
    {
      name: "Avi Klein",
      rating: 4.9,
      trips: 2634,
      photo: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop",
      pricePerKm: "₪8",
      specialty: "Airport Runs"
    }
  ];

  const safetyFeatures = [
    {
      icon: <Shield className="h-10 w-10" />,
      title: t('walkMyPet.verifiedWalkers'),
      description: t('walkMyPet.verifiedWalkersDesc')
    },
    {
      icon: <Video className="h-10 w-10" />,
      title: t('walkMyPet.gpsTracking'),
      description: t('walkMyPet.gpsTrackingDesc')
    },
    {
      icon: <Thermometer className="h-10 w-10" />,
      title: t('pettrek.climateControlled'),
      description: t('pettrek.climateControlledDesc')
    },
    {
      icon: <Phone className="h-10 w-10" />,
      title: "24/7 Support",
      description: "Round-the-clock customer service and emergency assistance"
    }
  ];

  const trustBadges = [
    { icon: <Award />, text: t('sitterSuite.fullyInsured') },
    { icon: <CheckCircle />, text: t('walkMyPet.verifiedWalkers') },
    { icon: <Star />, text: "4.9★" },
    { icon: <Users />, text: "50k+" }
  ];

  return (
    <Layout>
      <div className="min-h-screen">
        {/* 1. HERO SECTION */}
        <section className="luxury-bg-purple-fade py-20 sm:py-32 relative overflow-hidden">
          <div className="luxury-container">
            <div className="text-center max-w-4xl mx-auto luxury-animate-fade-in">
              <div className="inline-flex items-center gap-2 px-6 py-2 luxury-badge luxury-badge-gold mb-8">
                <Sparkles className="h-4 w-4" />
                {t('pettrek.badge')}
              </div>
              
              <h1 className="luxury-heading-xl mb-6">
                {t('pettrek.title')}
              </h1>
              
              <p className="luxury-text-body max-w-2xl mx-auto mb-12">
                {t('pettrek.subtitle')}
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12 luxury-animate-fade-in luxury-delay-1">
                <Link href="/pettrek/book">
                  <button className="luxury-btn-primary" data-testid="button-request-ride">
                    <Car className="h-5 w-5 mr-2 inline" />
                    {t('pettrek.requestRide')}
                  </button>
                </Link>
                <Link href="/pettrek/customer/dashboard">
                  <button className="luxury-btn-secondary" data-testid="button-my-rides">
                    <Calendar className="h-5 w-5 mr-2 inline" />
                    {t('pettrek.myTrips')}
                  </button>
                </Link>
              </div>

              {/* Search/Booking Widget */}
              <div className="luxury-glass-card luxury-shadow-xl p-8 max-w-3xl mx-auto luxury-animate-scale-in luxury-delay-2">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-semibold mb-2 text-gray-700">Pickup Location</label>
                    <div className="flex items-center gap-2 p-3 bg-white rounded-lg border border-gray-200">
                      <MapPin className="h-5 w-5 text-purple-600" />
                      <input 
                        type="text" 
                        placeholder="Enter address"
                        className="flex-1 outline-none text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2 text-gray-700">Destination</label>
                    <div className="flex items-center gap-2 p-3 bg-white rounded-lg border border-gray-200">
                      <MapPin className="h-5 w-5 text-purple-600" />
                      <input 
                        type="text" 
                        placeholder="Where to?"
                        className="flex-1 outline-none text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2 text-gray-700">When</label>
                    <div className="flex items-center gap-2 p-3 bg-white rounded-lg border border-gray-200">
                      <Clock className="h-5 w-5 text-purple-600" />
                      <input 
                        type="text" 
                        placeholder="Now"
                        className="flex-1 outline-none text-sm"
                      />
                    </div>
                  </div>
                </div>
                <Link href="/pettrek/book">
                  <button className="luxury-btn-primary w-full mt-6">
                    Get Price Estimate
                    <ArrowRight className="h-5 w-5 ml-2 inline" />
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* 2. HOW IT WORKS */}
        <section className="luxury-section luxury-bg-soft">
          <div className="luxury-container">
            <div className="text-center mb-16">
              <h2 className="luxury-heading-lg mb-4">How PetTrek Works</h2>
              <p className="luxury-text-body max-w-2xl mx-auto">
                Book professional pet transportation in three simple steps
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
              {/* Step 1 */}
              <div className="luxury-glass-card luxury-hover-lift p-8 text-center luxury-animate-slide-up luxury-delay-1">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 text-white text-3xl font-bold flex items-center justify-center mx-auto mb-6 luxury-shadow-lg">
                  1
                </div>
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-100 to-purple-200 flex items-center justify-center mx-auto mb-4">
                  <MapPin className="h-8 w-8 text-purple-700" />
                </div>
                <h3 className="luxury-heading-sm mb-3">Choose Your Route</h3>
                <p className="luxury-text-body">
                  Enter pickup and drop-off locations, select service type and time
                </p>
              </div>

              {/* Connector */}
              <div className="hidden md:flex items-center justify-center absolute top-24 left-1/3 transform -translate-x-1/2">
                <ArrowRight className="h-8 w-8 text-purple-300" />
              </div>

              {/* Step 2 */}
              <div className="luxury-glass-card luxury-hover-lift p-8 text-center luxury-animate-slide-up luxury-delay-2">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 text-white text-3xl font-bold flex items-center justify-center mx-auto mb-6 luxury-shadow-lg">
                  2
                </div>
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-100 to-purple-200 flex items-center justify-center mx-auto mb-4">
                  <Users className="h-8 w-8 text-purple-700" />
                </div>
                <h3 className="luxury-heading-sm mb-3">Match with Driver</h3>
                <p className="luxury-text-body">
                  Get matched with verified, pet-trained drivers in your area
                </p>
              </div>

              {/* Connector */}
              <div className="hidden md:flex items-center justify-center absolute top-24 right-1/3 transform translate-x-1/2">
                <ArrowRight className="h-8 w-8 text-purple-300" />
              </div>

              {/* Step 3 */}
              <div className="luxury-glass-card luxury-hover-lift p-8 text-center luxury-animate-slide-up luxury-delay-3">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 text-white text-3xl font-bold flex items-center justify-center mx-auto mb-6 luxury-shadow-lg">
                  3
                </div>
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-100 to-purple-200 flex items-center justify-center mx-auto mb-4">
                  <Video className="h-8 w-8 text-purple-700" />
                </div>
                <h3 className="luxury-heading-sm mb-3">Track & Relax</h3>
                <p className="luxury-text-body">
                  Follow your pet's journey in real-time with GPS tracking
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 3. SERVICE TYPES */}
        <section className="luxury-section">
          <div className="luxury-container">
            <div className="text-center mb-16">
              <h2 className="luxury-heading-lg mb-4">Our Services</h2>
              <p className="luxury-text-body max-w-2xl mx-auto">
                Professional pet transportation for every occasion
              </p>
            </div>

            <div className="luxury-grid-3">
              {serviceTypes.map((service, index) => (
                <Link key={index} href={service.link}>
                  <div className="luxury-glass-card luxury-hover-glow luxury-shadow-md p-6 cursor-pointer h-full luxury-animate-fade-in" style={{ animationDelay: `${index * 0.1}s` }}>
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center mb-4 text-white">
                      {service.icon}
                    </div>
                    <h3 className="luxury-heading-md mb-3">{service.name}</h3>
                    <p className="luxury-text-body mb-4">{service.description}</p>
                    <div className="flex items-center justify-between">
                      <div className="luxury-badge luxury-badge-gold">
                        From {service.priceFrom}
                      </div>
                      <ArrowRight className="h-5 w-5 text-purple-600" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* 4. FEATURED DRIVERS */}
        <section className="luxury-section luxury-bg-soft">
          <div className="luxury-container">
            <div className="text-center mb-16">
              <h2 className="luxury-heading-lg mb-4">{t('pettrek.professionalDrivers')}</h2>
              <p className="luxury-text-body max-w-2xl mx-auto">
                {t('pettrek.professionalDriversDesc')}
              </p>
            </div>

            <div className="luxury-grid-4">
              {featuredDrivers.map((driver, index) => (
                <div key={index} className="luxury-glass-card luxury-hover-lift luxury-shadow-lg p-6 text-center luxury-animate-scale-in" style={{ animationDelay: `${index * 0.1}s` }}>
                  <div className="relative inline-block mb-4">
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 p-1">
                      <img 
                        src={driver.photo} 
                        alt={driver.name}
                        className="w-full h-full rounded-full object-cover"
                      />
                    </div>
                    <div className="absolute -bottom-2 -right-2 bg-green-500 w-6 h-6 rounded-full border-4 border-white"></div>
                  </div>
                  
                  <h3 className="luxury-heading-sm mb-2">{driver.name}</h3>
                  
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <div className="luxury-badge-gold">
                      <Star className="h-3 w-3 inline fill-current" />
                      {driver.rating}
                    </div>
                    <span className="luxury-text-small">{driver.trips} trips</span>
                  </div>
                  
                  <p className="luxury-text-small mb-4">{driver.specialty}</p>
                  
                  <div className="luxury-text-gradient text-xl font-bold mb-4">
                    {driver.pricePerKm}/km
                  </div>
                  
                  <Link href={`/pettrek/book?driver=${driver.name.toLowerCase().replace(' ', '-')}`}>
                    <button className="luxury-btn-primary w-full">
                      {t('pettrek.bookNow')}
                    </button>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 5. SAFETY FEATURES */}
        <section className="luxury-section">
          <div className="luxury-container">
            <div className="text-center mb-16">
              <h2 className="luxury-heading-lg mb-4">{t('sitterSuite.safety')}</h2>
              <p className="luxury-text-body max-w-2xl mx-auto">
                {t('sitterSuite.safetyDesc')}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {safetyFeatures.map((feature, index) => (
                <div key={index} className="luxury-glass-minimal luxury-hover-lift p-6 text-center luxury-animate-fade-in" style={{ animationDelay: `${index * 0.1}s` }}>
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center mx-auto mb-4 text-white">
                    {feature.icon}
                  </div>
                  <h3 className="luxury-heading-sm mb-3">{feature.title}</h3>
                  <p className="luxury-text-body">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 6. PRICING TABLE */}
        <section className="luxury-section luxury-bg-soft">
          <div className="luxury-container max-w-4xl">
            <div className="text-center mb-12">
              <h2 className="luxury-heading-lg mb-4">Transparent Pricing</h2>
              <p className="luxury-text-body">Simple, fair rates with no hidden fees</p>
            </div>

            <div className="luxury-glass-card luxury-shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-purple-500 to-purple-700 p-6 text-white text-center">
                <h3 className="text-2xl font-bold">Standard Rates</h3>
              </div>
              
              <div className="p-6">
                <div className="space-y-4">
                  {[
                    { service: "Base Fare", price: "₪49", description: "Includes first 5km" },
                    { service: "Per Kilometer", price: "₪8", description: "After base distance" },
                    { service: "Wait Time", price: "₪2/min", description: "After 5 free minutes" },
                    { service: "Airport Premium", price: "+₪99", description: "Terminal pickup/dropoff" },
                    { service: "After Hours (10PM-6AM)", price: "+30%", description: "Night service surcharge" },
                    { service: "Multiple Pets", price: "+₪29", description: "Per additional pet" }
                  ].map((item, index) => (
                    <div 
                      key={index} 
                      className="flex items-center justify-between p-4 rounded-lg hover:bg-purple-50 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="luxury-heading-sm text-base mb-1">{item.service}</div>
                        <div className="luxury-text-small">{item.description}</div>
                      </div>
                      <div className="luxury-text-gradient text-2xl font-bold">
                        {item.price}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-8 p-6 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="luxury-heading-sm">Example: Vet Visit (15km)</span>
                    <span className="luxury-text-gradient text-3xl font-bold">₪129</span>
                  </div>
                  <p className="luxury-text-small">Base fare ₪49 + 10km × ₪8 = ₪129</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 7. TRUST BADGES */}
        <section className="py-12 border-y border-gray-200">
          <div className="luxury-container">
            <div className="flex flex-wrap items-center justify-center gap-12">
              {trustBadges.map((badge, index) => (
                <div key={index} className="flex items-center gap-3 luxury-animate-fade-in" style={{ animationDelay: `${index * 0.1}s` }}>
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center text-white">
                    {badge.icon}
                  </div>
                  <span className="luxury-text-small font-semibold text-gray-700">
                    {badge.text}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 8. FINAL CTA */}
        <section className="luxury-bg-primary py-20">
          <div className="luxury-container text-center">
            <h2 className="luxury-heading-xl text-white mb-6">
              Ready to Book Your Pet's Ride?
            </h2>
            <p className="text-xl text-white/90 max-w-2xl mx-auto mb-10">
              Join thousands of pet parents who trust PetTrek for safe, 
              comfortable, and reliable pet transportation.
            </p>
            <Link href="/pettrek/book">
              <button className="luxury-btn-primary luxury-shadow-xl bg-white text-purple-700 hover:bg-gray-50">
                <Car className="h-5 w-5 mr-2 inline" />
                {t('pettrek.requestRide')}
                <ArrowRight className="h-5 w-5 ml-2 inline" />
              </button>
            </Link>
          </div>
        </section>
      </div>
    </Layout>
  );
}
