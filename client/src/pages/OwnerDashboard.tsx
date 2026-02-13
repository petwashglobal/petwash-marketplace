import { useLanguage } from "@/lib/languageStore";
import { useFirebaseAuth } from "@/auth/AuthProvider";
import { useQuery } from "@tanstack/react-query";
import { MessageSquare, Calendar, Heart, Settings, LogOut, PawPrint, Shield, Bell, Star, Search, Sparkles, Gift, TrendingUp, Wallet, Award } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { WorldClock } from "@/components/WorldClock";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export default function OwnerDashboard() {
  const { language } = useLanguage();
  const { user, signOut } = useFirebaseAuth();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<'bookings' | 'inbox' | 'pets' | 'favorites' | 'pawfinder'>('bookings');
  const isHebrew = language === 'he';

  const { data: bookings, isLoading: loadingBookings } = useQuery<any[]>({
    queryKey: ['/api/sitter-suite/owner/bookings'],
    enabled: !!user,
  });

  const { data: messages, isLoading: loadingMessages } = useQuery<any[]>({
    queryKey: ['/api/sitter-suite/owner/messages'],
    enabled: !!user && activeTab === 'inbox',
  });

  const handleLogout = async () => {
    await signOut();
    setLocation('/');
  };

  const unreadCount = messages?.filter((m: any) => !m.isRead).length || 0;

  const mockLoyaltyData = {
    points: 2450,
    tier: 'Gold',
    nextTier: 'Platinum',
    pointsToNext: 550,
    totalWashes: 24,
    totalBookings: 18,
    totalSpend: 3200
  };

  return (
    <div className={`min-h-screen luxury-bg-mesh ${isHebrew ? 'rtl' : 'ltr'}`}>
      <header className="sticky top-0 z-50 luxury-glass-panel luxury-shadow-lg">
        <div className="luxury-container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-gradient-to-br from-[#000000] via-[#333333] to-[#555555] p-3 rounded-2xl luxury-shadow-md">
                <PawPrint className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="luxury-heading-sm luxury-text-gradient">
                  {isHebrew ? 'Pet Wash Stay™' : 'Pet Wash Stay™'}
                </h1>
                <p className="luxury-text-small">
                  {isHebrew ? 'ידיים מקצועיות מהימנות לחיית המחמד שלך' : 'Trusted professional hands for your pet'}
                </p>
              </div>
            </div>

            <div className="flex items-center luxury-gap-sm">
              <LanguageSwitcher compact={true} showFlag={true} />
              
              <button className="relative p-3 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-all" data-testid="button-notifications">
                <Bell className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                <span className="absolute top-2 right-2 h-2 w-2 bg-red-500 rounded-full"></span>
              </button>
              
              <div className="flex items-center gap-3 luxury-glass-minimal px-4 py-2">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#000000] to-[#333333] flex items-center justify-center text-white font-bold">
                  {user?.email?.charAt(0).toUpperCase()}
                </div>
                <div className="text-sm">
                  <p className="font-semibold text-gray-900 dark:text-white">{user?.displayName || user?.email}</p>
                  <p className="luxury-text-small">{isHebrew ? 'בעל חיית מחמד' : 'Pet Owner'}</p>
                </div>
              </div>

              <button 
                onClick={handleLogout}
                className="p-3 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all text-red-600"
                data-testid="button-logout"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="flex gap-2 mt-6 border-b border-gray-200/50 dark:border-gray-700/50">
            <TabButton
              active={activeTab === 'bookings'}
              onClick={() => setActiveTab('bookings')}
              icon={<Calendar className="h-5 w-5" />}
              label={isHebrew ? 'ההזמנות שלי' : 'My Bookings'}
            />
            <TabButton
              active={activeTab === 'inbox'}
              onClick={() => setActiveTab('inbox')}
              icon={<MessageSquare className="h-5 w-5" />}
              label={isHebrew ? 'תיבת דואר' : 'Inbox'}
              badge={unreadCount}
            />
            <TabButton
              active={activeTab === 'pets'}
              onClick={() => setActiveTab('pets')}
              icon={<PawPrint className="h-5 w-5" />}
              label={isHebrew ? 'חיות המחמד שלי' : 'My Pets'}
            />
            <TabButton
              active={activeTab === 'favorites'}
              onClick={() => setActiveTab('favorites')}
              icon={<Heart className="h-5 w-5" />}
              label={isHebrew ? 'שמרטפים מועדפים' : 'Favorite Sitters'}
            />
            <TabButton
              active={activeTab === 'pawfinder'}
              onClick={() => setActiveTab('pawfinder')}
              icon={<Search className="h-5 w-5" />}
              label={isHebrew ? '⁦Paw Finder™⁩ חינם!' : '⁦Paw Finder™⁩ FREE!'}
              badge={<Sparkles className="h-3 w-3 text-yellow-400" />}
            />
          </div>
        </div>
      </header>

      <main className="luxury-container luxury-section">
        <div className="flex justify-end mb-6">
          <WorldClock compact={true} />
        </div>

        <div className="luxury-glass-card luxury-shadow-xl p-8 mb-8 luxury-animate-fade-in">
          <h2 className="luxury-heading-lg luxury-text-gradient mb-2">
            {isHebrew ? `ברוך הבא, ${user?.displayName || 'Pet Owner'}!` : `Welcome back, ${user?.displayName || 'Pet Owner'}!`}
          </h2>
          <p className="luxury-text-body mb-6">
            {isHebrew ? 'נהל את ההזמנות שלך, עקוב אחר חיות המחמד שלך, והישאר מחובר לשמרטפים המועדפים עליך' : 'Manage your bookings, track your pets, and stay connected with your favorite sitters'}
          </p>
          <div className="flex flex-wrap luxury-gap-sm">
            <Link href="/sitter-suite">
              <button className="luxury-btn-primary" data-testid="button-new-booking">
                {isHebrew ? '+ הזמנה חדשה' : '+ New Booking'}
              </button>
            </Link>
            <Link href="/pets">
              <button className="luxury-btn-secondary" data-testid="button-manage-pets">
                {isHebrew ? 'נהל חיות מחמד' : 'Manage Pets'}
              </button>
            </Link>
          </div>
        </div>

        <div className="luxury-grid-3 mb-8">
          <div className="luxury-glass-minimal luxury-hover-lift p-6 luxury-animate-fade-in luxury-delay-1">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-[#000000] to-[#333333] luxury-shadow-md">
                <PawPrint className="h-6 w-6 text-white" />
              </div>
            </div>
            <p className="luxury-heading-lg luxury-text-gradient">{mockLoyaltyData.totalWashes}</p>
            <p className="luxury-text-small">{isHebrew ? 'סך הכל שטיפות' : 'Total Washes'}</p>
          </div>

          <div className="luxury-glass-minimal luxury-hover-lift p-6 luxury-animate-fade-in luxury-delay-2">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-[#333333] to-[#555555] luxury-shadow-md">
                <Calendar className="h-6 w-6 text-white" />
              </div>
            </div>
            <p className="luxury-heading-lg luxury-text-gradient">{mockLoyaltyData.totalBookings}</p>
            <p className="luxury-text-small">{isHebrew ? 'סך הכל הזמנות' : 'Total Bookings'}</p>
          </div>

          <div className="luxury-glass-minimal luxury-hover-lift p-6 luxury-animate-fade-in luxury-delay-3">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-[#444444] to-[#666666] luxury-shadow-md">
                <Wallet className="h-6 w-6 text-white" />
              </div>
            </div>
            <p className="luxury-heading-lg luxury-text-gradient">₪{mockLoyaltyData.totalSpend}</p>
            <p className="luxury-text-small">{isHebrew ? 'סך הכל הוצאות' : 'Total Spend'}</p>
          </div>
        </div>

        <div className="luxury-glass-card luxury-hover-glow luxury-shadow-lg p-8 mb-8 luxury-animate-fade-in luxury-delay-4">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center luxury-gap-md">
              <div className="p-4 rounded-2xl bg-gradient-to-br from-yellow-400 to-orange-500 luxury-shadow-md">
                <Award className="h-8 w-8 text-white" />
              </div>
              <div>
                <h3 className="luxury-heading-md">{isHebrew ? 'נקודות נאמנות' : 'Loyalty Points'}</h3>
                <p className="luxury-text-small">{isHebrew ? 'צבור נקודות עם כל הזמנה' : 'Earn points with every booking'}</p>
              </div>
            </div>
            <span className="luxury-badge-gold">
              <Star className="h-4 w-4 fill-current" />
              {mockLoyaltyData.tier}
            </span>
          </div>
          
          <div className="mb-6">
            <p className="luxury-heading-lg luxury-text-gradient text-center mb-2">{mockLoyaltyData.points.toLocaleString()}</p>
            <p className="luxury-text-small text-center">{isHebrew ? 'נקודות זמינות' : 'Available Points'}</p>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between luxury-text-small">
              <span>{isHebrew ? `עד ${mockLoyaltyData.nextTier}` : `To ${mockLoyaltyData.nextTier}`}</span>
              <span>{mockLoyaltyData.pointsToNext} {isHebrew ? 'נקודות נותרו' : 'points to go'}</span>
            </div>
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-[#000000] to-[#333333] rounded-full transition-all duration-500"
                style={{ width: `${(mockLoyaltyData.points / (mockLoyaltyData.points + mockLoyaltyData.pointsToNext)) * 100}%` }}
              ></div>
            </div>
          </div>
        </div>

        {activeTab === 'bookings' && (
          <div className="luxury-animate-fade-in luxury-delay-5">
            <div className="flex items-center justify-between mb-6">
              <h2 className="luxury-heading-md">
                {isHebrew ? 'ההזמנות שלי' : 'My Bookings'}
              </h2>
              <Link href="/sitter-suite">
                <button className="luxury-btn-primary" data-testid="button-new-booking-inline">
                  {isHebrew ? '+ הזמנה חדשה' : '+ New Booking'}
                </button>
              </Link>
            </div>

            {loadingBookings ? (
              <div className="luxury-grid-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="luxury-skeleton h-64"></div>
                ))}
              </div>
            ) : bookings && bookings.length > 0 ? (
              <div className="luxury-grid-3">
                {bookings.map((booking: any) => (
                  <BookingCard key={booking.id} booking={booking} isHebrew={isHebrew} />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<Calendar className="h-16 w-16" />}
                title={isHebrew ? 'אין הזמנות עדיין' : 'No bookings yet'}
                description={isHebrew ? 'מצא שמרטף מקצועי לחיית המחמד שלך' : 'Find a trusted professional sitter for your pet'}
                actionLabel={isHebrew ? 'עיין בשמרטפים' : 'Browse Sitters'}
                actionLink="/sitter-suite"
              />
            )}
          </div>
        )}

        {activeTab === 'inbox' && (
          <div className="luxury-animate-fade-in luxury-delay-5">
            <h2 className="luxury-heading-md mb-6">
              {isHebrew ? 'תיבת הדואר שלי' : 'My Inbox'}
            </h2>
            
            {loadingMessages ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="luxury-skeleton h-24"></div>
                ))}
              </div>
            ) : messages && messages.length > 0 ? (
              <div className="luxury-glass-card luxury-shadow-md p-6">
                {messages.map((message: any) => (
                  <MessagePreview key={message.id} message={message} isHebrew={isHebrew} />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<MessageSquare className="h-16 w-16" />}
                title={isHebrew ? 'אין הודעות' : 'No messages'}
                description={isHebrew ? 'ההודעות שלך עם שמרטפים יופיעו כאן' : 'Your conversations with sitters will appear here'}
              />
            )}
          </div>
        )}

        {activeTab === 'pets' && (
          <div className="luxury-animate-fade-in luxury-delay-5">
            <div className="flex items-center justify-between mb-6">
              <h2 className="luxury-heading-md">
                {isHebrew ? 'חיות המחמד שלי' : 'My Pets'}
              </h2>
              <button className="luxury-btn-primary" data-testid="button-add-pet">
                {isHebrew ? '+ הוסף חיית מחמד' : '+ Add Pet'}
              </button>
            </div>
            
            <div className="luxury-grid-3">
              <PetProfileCard 
                name="Max"
                type="Dog"
                breed="Golden Retriever"
                age="3 years"
                isHebrew={isHebrew}
              />
              <PetProfileCard 
                name="Luna"
                type="Cat"
                breed="Persian"
                age="2 years"
                isHebrew={isHebrew}
              />
              <div className="luxury-glass-card luxury-hover-lift luxury-shadow-md p-8 flex flex-col items-center justify-center text-center min-h-[300px] cursor-pointer">
                <PawPrint className="h-12 w-12 text-gray-400 dark:text-gray-600 mb-4" />
                <h3 className="luxury-heading-sm mb-2">{isHebrew ? 'הוסף חיית מחמד' : 'Add Pet'}</h3>
                <p className="luxury-text-small">{isHebrew ? 'צור פרופיל חדש' : 'Create new profile'}</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'favorites' && (
          <EmptyState
            icon={<Heart className="h-16 w-16" />}
            title={isHebrew ? 'שמרטפים מועדפים' : 'Favorite Sitters'}
            description={isHebrew ? 'שמור שמרטפים מועדפים לגישה מהירה' : 'Save your favorite sitters for quick access'}
          />
        )}

        {activeTab === 'pawfinder' && (
          <div className="luxury-animate-fade-in luxury-delay-5">
            <div className="luxury-glass-card luxury-shadow-xl p-8 mb-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-4 rounded-2xl luxury-icon-gold luxury-shadow-md">
                  <Search className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h2 className="luxury-heading-md flex items-center gap-2">
                    ⁦Paw Finder™⁩
                    <Sparkles className="h-6 w-6 text-yellow-400" />
                  </h2>
                  <p className="luxury-text-body">
                    {isHebrew 
                      ? 'שירות קהילתי חינמי - עזור לאחד חיות מחמד אבודות עם הבעלים שלהם' 
                      : 'FREE Community Service - Help Reunite Lost Pets with Their Owners'}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap luxury-gap-sm">
                <span className="luxury-badge">
                  <Heart className="h-4 w-4" />
                  {isHebrew ? 'ללא עמלות' : 'No Fees'}
                </span>
                <span className="luxury-badge">
                  <Shield className="h-4 w-4" />
                  {isHebrew ? 'בטוח ומאובטח' : 'Safe & Secure'}
                </span>
                <span className="luxury-badge-gold">
                  <Star className="h-4 w-4 fill-current" />
                  {isHebrew ? 'זמין לחברי נאמנות' : 'Loyalty Member Exclusive'}
                </span>
              </div>
            </div>

            <div className="luxury-grid-2 mb-6">
              <Link href="/paw-finder">
                <button className="w-full luxury-glass-card luxury-hover-lift luxury-shadow-md p-6 text-left">
                  <div className="flex items-center gap-4">
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-red-500 to-pink-600 luxury-shadow-md">
                      <Search className="h-8 w-8 text-white" />
                    </div>
                    <div>
                      <h3 className="luxury-heading-sm mb-1">
                        {isHebrew ? 'דווח על חיית מחמד אבודה' : 'Report Lost Pet'}
                      </h3>
                      <p className="luxury-text-small">
                        {isHebrew 
                          ? 'שלח התראה לכל האזור - קבל עזרה מיד' 
                          : 'Alert the entire area - Get help immediately'}
                      </p>
                    </div>
                  </div>
                </button>
              </Link>

              <Link href="/paw-finder">
                <button className="w-full luxury-glass-card luxury-hover-lift luxury-shadow-md p-6 text-left">
                  <div className="flex items-center gap-4">
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 luxury-shadow-md">
                      <PawPrint className="h-8 w-8 text-white" />
                    </div>
                    <div>
                      <h3 className="luxury-heading-sm mb-1">
                        {isHebrew ? 'מצאתי חיית מחמד' : 'Found a Pet'}
                      </h3>
                      <p className="luxury-text-small">
                        {isHebrew 
                          ? 'עזור לחבר חיית מחמד אבודה עם הבעלים' 
                          : 'Help reunite a lost pet with their family'}
                      </p>
                    </div>
                  </div>
                </button>
              </Link>
            </div>

            <div className="luxury-glass-card luxury-shadow-md p-6">
              <h3 className="luxury-heading-sm mb-4 flex items-center gap-2">
                <Heart className="h-6 w-6 text-pink-500 fill-pink-500" />
                {isHebrew ? 'סיפורי הצלחה' : 'Success Stories'}
              </h3>
              <div className="space-y-4">
                <div className="border-l-4 border-green-500 pl-4 py-2">
                  <p className="luxury-text-body font-semibold">
                    {isHebrew 
                      ? '"נעלם במשך 3 ימים - נמצא בזכות ⁦Paw Finder™⁩!"' 
                      : '"Lost for 3 days - Found thanks to ⁦Paw Finder™⁩!"'}
                  </p>
                  <p className="luxury-text-small">
                    - {isHebrew ? 'שרה, תל אביב' : 'Sarah, Tel Aviv'}
                  </p>
                </div>
                <div className="border-l-4 border-amber-500 pl-4 py-2">
                  <p className="luxury-text-body font-semibold">
                    {isHebrew 
                      ? '"הקהילה עזרה למצוא את הכלב שלי תוך שעתיים"' 
                      : '"Community helped find my dog in 2 hours"'}
                  </p>
                  <p className="luxury-text-small">
                    - {isHebrew ? 'דוד, ירושלים' : 'David, Jerusalem'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function TabButton({ active, onClick, icon, label, badge }: any) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-6 py-3 border-b-2 transition-all ${
        active
          ? 'border-[#000000] text-[#000000] dark:text-[#FFFFFF] font-semibold'
          : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
      }`}
      data-testid={`tab-${label.toLowerCase().replace(/\s+/g, '-')}`}
    >
      {icon}
      <span>{label}</span>
      {typeof badge === 'number' && badge > 0 && (
        <span className="ml-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
          {badge}
        </span>
      )}
      {typeof badge !== 'number' && badge}
    </button>
  );
}

function BookingCard({ booking, isHebrew }: any) {
  const getStatusBadge = (status: string) => {
    if (status === 'confirmed') return 'luxury-badge-success';
    if (status === 'pending') return 'luxury-badge';
    if (status === 'completed') return 'luxury-badge-gold';
    return 'luxury-badge';
  };

  return (
    <div className="luxury-glass-card luxury-hover-lift luxury-shadow-md p-6" data-testid={`card-booking-${booking.id}`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl luxury-icon-gold flex items-center justify-center luxury-shadow-md">
            <PawPrint className="h-6 w-6 text-white" />
          </div>
          <div>
            <h3 className="luxury-heading-sm">{booking.sitterName}</h3>
            <p className="luxury-text-small">
              {new Date(booking.startDate).toLocaleDateString()} - {new Date(booking.endDate).toLocaleDateString()}
            </p>
          </div>
        </div>
        <span className={getStatusBadge(booking.status)}>
          {booking.status}
        </span>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
        <span className="text-sm font-semibold">{booking.sitterRating || '5.0'}</span>
        <span className="luxury-text-small">({booking.sitterReviews || '0'} {isHebrew ? 'ביקורות' : 'reviews'})</span>
      </div>

      <div className="luxury-divider"></div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="luxury-text-small">
            {isHebrew ? 'סכום כולל:' : 'Total:'}
          </span>
          <span className="luxury-heading-sm luxury-text-gradient">
            ₪{(booking.totalChargeCents / 100).toFixed(2)}
          </span>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="luxury-text-small">
            {isHebrew ? 'תשלום לשמרטף:' : 'Sitter receives:'}
          </span>
          <span className="text-green-600 font-semibold text-sm">
            ₪{(booking.totalChargeCents * 0.85 / 100).toFixed(2)}
          </span>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="luxury-text-small">
            {isHebrew ? 'עמלת פלטפורמה (15%):' : 'Platform fee (15%):'}
          </span>
          <span className="text-[#333333] dark:text-[#CCCCCC] font-semibold text-sm">
            ₪{(booking.totalChargeCents * 0.15 / 100).toFixed(2)}
          </span>
        </div>
        
        <button className="w-full luxury-btn-ghost mt-2" data-testid={`button-view-details-${booking.id}`}>
          {isHebrew ? 'צפה בפרטים' : 'View Details'}
        </button>
      </div>
    </div>
  );
}

function PetProfileCard({ name, type, breed, age, isHebrew }: any) {
  return (
    <div className="luxury-glass-card luxury-hover-lift luxury-shadow-md p-6" data-testid={`card-pet-${name.toLowerCase()}`}>
      <div className="flex flex-col items-center text-center mb-4">
        <div className="relative mb-4">
          <div className="h-24 w-24 rounded-full luxury-gradient-gold p-1 luxury-shadow-md">
            <div className="h-full w-full rounded-full bg-white dark:bg-gray-900 flex items-center justify-center">
              <PawPrint className="h-12 w-12 text-[#333333] dark:text-[#FFFFFF]" />
            </div>
          </div>
        </div>
        <h3 className="luxury-heading-sm mb-1">{name}</h3>
        <p className="luxury-text-small">{type} • {breed}</p>
        <p className="luxury-text-small">{age}</p>
      </div>
      
      <div className="luxury-divider"></div>
      
      <button className="w-full luxury-btn-ghost" data-testid={`button-edit-pet-${name.toLowerCase()}`}>
        {isHebrew ? 'ערוך פרופיל' : 'Edit Profile'}
      </button>
    </div>
  );
}

function MessagePreview({ message, isHebrew }: any) {
  return (
    <div 
      className={`flex items-center gap-4 p-4 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl cursor-pointer transition-all ${!message.isRead ? 'bg-amber-50 dark:bg-amber-900/20' : ''}`}
      data-testid={`message-${message.id}`}
    >
      <div className="h-12 w-12 rounded-full luxury-gradient-gold flex items-center justify-center text-white font-bold luxury-shadow-md">
        {message.senderName?.charAt(0) || 'S'}
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <h4 className="luxury-heading-sm">{message.senderName}</h4>
          <span className="luxury-text-small">{new Date(message.createdAt).toLocaleTimeString()}</span>
        </div>
        <p className="luxury-text-small truncate">{message.messageText}</p>
      </div>
      {!message.isRead && (
        <div className="h-3 w-3 bg-[#333333] dark:bg-[#FFFFFF] rounded-full"></div>
      )}
    </div>
  );
}

function EmptyState({ icon, title, description, actionLabel, actionLink }: any) {
  return (
    <div className="luxury-glass-card luxury-shadow-md p-20 flex flex-col items-center justify-center text-center">
      <div className="text-gray-400 dark:text-gray-600 mb-4">{icon}</div>
      <h3 className="luxury-heading-md mb-2">{title}</h3>
      <p className="luxury-text-body mb-6 max-w-md">{description}</p>
      {actionLabel && (
        <Link href={actionLink || '#'}>
          <button className="luxury-btn-primary" data-testid="button-empty-state-action">
            {actionLabel}
          </button>
        </Link>
      )}
    </div>
  );
}
