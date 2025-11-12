import { useLanguage } from "@/lib/languageStore";
import { useFirebaseAuth } from "@/auth/AuthProvider";
import { useQuery } from "@tanstack/react-query";
import { MessageSquare, Calendar, Heart, Settings, LogOut, PawPrint, Shield, Bell, Star, Search, Sparkles } from "lucide-react";
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

  // Fetch owner's bookings
  const { data: bookings, isLoading: loadingBookings } = useQuery<any[]>({
    queryKey: ['/api/sitter-suite/owner/bookings'],
    enabled: !!user,
  });

  // Fetch inbox messages
  const { data: messages, isLoading: loadingMessages } = useQuery<any[]>({
    queryKey: ['/api/sitter-suite/owner/messages'],
    enabled: !!user && activeTab === 'inbox',
  });

  const handleLogout = async () => {
    await signOut();
    setLocation('/');
  };

  const unreadCount = messages?.filter((m: any) => !m.isRead).length || 0;

  return (
    <div className={`min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-gray-950 dark:via-gray-900 dark:to-blue-950 ${isHebrew ? 'rtl' : 'ltr'}`}>
      {/* 7-STAR LUXURY HEADER (Burj Al Arab Inspired) */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/70 dark:bg-gray-900/70 border-b border-gray-200/50 dark:border-gray-700/50 shadow-2xl">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo & Branding */}
            <div className="flex items-center gap-4">
              <div className="bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 p-3 rounded-2xl shadow-2xl">
                <PawPrint className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                  {isHebrew ? 'Pet Wash Stay™' : 'Pet Wash Stay™'}
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {isHebrew ? 'ידיים מקצועיות מהימנות לחיית המחמד שלך' : 'Trusted professional hands for your pet'}
                </p>
              </div>
            </div>

            {/* User Menu */}
            <div className="flex items-center gap-4">
              {/* Language Switcher */}
              <LanguageSwitcher compact={true} showFlag={true} />
              
              <button className="relative p-3 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-all">
                <Bell className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                <span className="absolute top-2 right-2 h-2 w-2 bg-red-500 rounded-full"></span>
              </button>
              
              <div className="flex items-center gap-3 bg-gray-100 dark:bg-gray-800 px-4 py-2 rounded-xl">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold">
                  {user?.email?.charAt(0).toUpperCase()}
                </div>
                <div className="text-sm">
                  <p className="font-semibold text-gray-900 dark:text-white">{user?.displayName || user?.email}</p>
                  <p className="text-gray-600 dark:text-gray-400">{isHebrew ? 'בעל חיית מחמד' : 'Pet Owner'}</p>
                </div>
              </div>

              <button 
                onClick={handleLogout}
                className="p-3 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all text-red-600"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
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
              label={isHebrew ? 'Paw Finder™ חינם!' : 'Paw Finder™ FREE!'}
              badge={<Sparkles className="h-3 w-3 text-yellow-400" />}
            />
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* World Clock Widget - Top Right */}
        <div className="flex justify-end mb-6">
          <WorldClock compact={true} />
        </div>
        {activeTab === 'bookings' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
                {isHebrew ? 'ההזמנות שלי' : 'My Bookings'}
              </h2>
              <Link href="/sitter-suite">
                <button className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold hover:shadow-2xl transition-all transform hover:scale-105">
                  {isHebrew ? '+ הזמנה חדשה' : '+ New Booking'}
                </button>
              </Link>
            </div>

            {loadingBookings ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-64 bg-gray-200 dark:bg-gray-800 rounded-2xl animate-pulse"></div>
                ))}
              </div>
            ) : bookings && bookings.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
          <div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
              {isHebrew ? 'תיבת הדואר שלי' : 'My Inbox'}
            </h2>
            
            {loadingMessages ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-24 bg-gray-200 dark:bg-gray-800 rounded-2xl animate-pulse"></div>
                ))}
              </div>
            ) : messages && messages.length > 0 ? (
              <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6">
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
          <EmptyState
            icon={<PawPrint className="h-16 w-16" />}
            title={isHebrew ? 'נהל את חיות המחמד שלך' : 'Manage Your Pets'}
            description={isHebrew ? 'הוסף פרופילי חיות מחמד לשיתוף עם שמרטפים' : 'Add pet profiles to share with sitters'}
            actionLabel={isHebrew ? '+ הוסף חיית מחמד' : '+ Add Pet'}
          />
        )}

        {activeTab === 'favorites' && (
          <EmptyState
            icon={<Heart className="h-16 w-16" />}
            title={isHebrew ? 'שמרטפים מועדפים' : 'Favorite Sitters'}
            description={isHebrew ? 'שמור שמרטפים מועדפים לגישה מהירה' : 'Save your favorite sitters for quick access'}
          />
        )}

        {activeTab === 'pawfinder' && (
          <div>
            {/* LUXURY PAW FINDER™ BANNER */}
            <div className="bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 rounded-3xl p-8 mb-6 shadow-2xl">
              <div className="flex items-center gap-4 mb-4">
                <div className="bg-white/20 backdrop-blur-lg p-4 rounded-2xl">
                  <Search className="h-8 w-8 text-white" />
                </div>
                <div className="text-white">
                  <h2 className="text-3xl font-bold flex items-center gap-2">
                    Paw Finder™
                    <Sparkles className="h-6 w-6 text-yellow-300" />
                  </h2>
                  <p className="text-white/90 text-lg">
                    {isHebrew 
                      ? 'שירות קהילתי חינמי - עזור לאחד חיות מחמד אבודות עם הבעלים שלהם' 
                      : 'FREE Community Service - Help Reunite Lost Pets with Their Owners'}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-4">
                <div className="bg-white/10 backdrop-blur-sm px-4 py-2 rounded-xl text-white flex items-center gap-2">
                  <Heart className="h-4 w-4" />
                  <span className="text-sm font-semibold">
                    {isHebrew ? 'ללא עמלות' : 'No Fees'}
                  </span>
                </div>
                <div className="bg-white/10 backdrop-blur-sm px-4 py-2 rounded-xl text-white flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  <span className="text-sm font-semibold">
                    {isHebrew ? 'בטוח ומאובטח' : 'Safe & Secure'}
                  </span>
                </div>
                <div className="bg-white/10 backdrop-blur-sm px-4 py-2 rounded-xl text-white flex items-center gap-2">
                  <Star className="h-4 w-4 fill-yellow-300 text-yellow-300" />
                  <span className="text-sm font-semibold">
                    {isHebrew ? 'זמין לחברי נאמנות' : 'Loyalty Member Exclusive'}
                  </span>
                </div>
              </div>
            </div>

            {/* PAW FINDER QUICK ACCESS BUTTONS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <Link href="/paw-finder">
                <button className="w-full bg-gradient-to-br from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white p-6 rounded-2xl shadow-2xl hover:shadow-3xl transition-all transform hover:scale-105 text-left">
                  <div className="flex items-center gap-4">
                    <div className="bg-white/20 p-4 rounded-xl">
                      <Search className="h-8 w-8" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold mb-1">
                        {isHebrew ? 'דווח על חיית מחמד אבודה' : 'Report Lost Pet'}
                      </h3>
                      <p className="text-white/80 text-sm">
                        {isHebrew 
                          ? 'שלח התראה לכל האזור - קבל עזרה מיד' 
                          : 'Alert the entire area - Get help immediately'}
                      </p>
                    </div>
                  </div>
                </button>
              </Link>

              <Link href="/paw-finder">
                <button className="w-full bg-gradient-to-br from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white p-6 rounded-2xl shadow-2xl hover:shadow-3xl transition-all transform hover:scale-105 text-left">
                  <div className="flex items-center gap-4">
                    <div className="bg-white/20 p-4 rounded-xl">
                      <PawPrint className="h-8 w-8" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold mb-1">
                        {isHebrew ? 'מצאתי חיית מחמד' : 'Found a Pet'}
                      </h3>
                      <p className="text-white/80 text-sm">
                        {isHebrew 
                          ? 'עזור לחבר חיית מחמד אבודה עם הבעלים' 
                          : 'Help reunite a lost pet with their family'}
                      </p>
                    </div>
                  </div>
                </button>
              </Link>
            </div>

            {/* SUCCESS STORIES */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Heart className="h-6 w-6 text-pink-500 fill-pink-500" />
                {isHebrew ? 'סיפורי הצלחה' : 'Success Stories'}
              </h3>
              <div className="space-y-4">
                <div className="border-l-4 border-green-500 pl-4 py-2">
                  <p className="text-gray-700 dark:text-gray-300 font-semibold">
                    {isHebrew 
                      ? '"נעלם במשך 3 ימים - נמצא בזכות Paw Finder™!"' 
                      : '"Lost for 3 days - Found thanks to Paw Finder™!"'}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    - {isHebrew ? 'שרה, תל אביב' : 'Sarah, Tel Aviv'}
                  </p>
                </div>
                <div className="border-l-4 border-blue-500 pl-4 py-2">
                  <p className="text-gray-700 dark:text-gray-300 font-semibold">
                    {isHebrew 
                      ? '"הקהילה עזרה למצוא את הכלב שלי תוך שעתיים"' 
                      : '"Community helped find my dog in 2 hours"'}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
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

// Tab Button Component
function TabButton({ active, onClick, icon, label, badge }: any) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-6 py-3 border-b-2 transition-all ${
        active
          ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-semibold'
          : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
      }`}
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

// Booking Card Component
function BookingCard({ booking, isHebrew }: any) {
  const getStatusColor = (status: string) => {
    if (status === 'confirmed') return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    if (status === 'pending') return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
    if (status === 'completed') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400';
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6 hover:shadow-3xl transition-all border border-gray-100 dark:border-gray-800">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
            <PawPrint className="h-6 w-6 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white">{booking.sitterName}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {new Date(booking.startDate).toLocaleDateString()} - {new Date(booking.endDate).toLocaleDateString()}
            </p>
          </div>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(booking.status)}`}>
          {booking.status}
        </span>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
        <span className="text-sm font-semibold">{booking.sitterRating || '5.0'}</span>
        <span className="text-sm text-gray-500">({booking.sitterReviews || '0'} {isHebrew ? 'ביקורות' : 'reviews'})</span>
      </div>

      <div className="pt-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
        {/* COMMISSION BREAKDOWN - 7% Broker Fee */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">
            {isHebrew ? 'סכום כולל:' : 'Total:'}
          </span>
          <span className="font-bold text-gray-900 dark:text-white">
            ₪{(booking.totalChargeCents / 100).toFixed(2)}
          </span>
        </div>
        
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">
            {isHebrew ? 'תשלום לשמרטף:' : 'Sitter receives:'}
          </span>
          <span className="text-green-600 font-semibold">
            ₪{(booking.totalChargeCents * 0.93 / 100).toFixed(2)}
          </span>
        </div>
        
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">
            {isHebrew ? 'עמלת פלטפורמה (7%):' : 'Platform fee (7%):'}
          </span>
          <span className="text-blue-600 font-semibold">
            ₪{(booking.totalChargeCents * 0.07 / 100).toFixed(2)}
          </span>
        </div>
        
        <button className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all mt-2">
          {isHebrew ? 'צפה בפרטים' : 'View Details'}
        </button>
      </div>
    </div>
  );
}

// Message Preview Component
function MessagePreview({ message, isHebrew }: any) {
  return (
    <div className={`flex items-center gap-4 p-4 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl cursor-pointer transition-all ${!message.isRead ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
      <div className="h-12 w-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
        {message.senderName?.charAt(0) || 'S'}
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-gray-900 dark:text-white">{message.senderName}</h4>
          <span className="text-xs text-gray-500">{new Date(message.createdAt).toLocaleTimeString()}</span>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{message.messageText}</p>
      </div>
      {!message.isRead && (
        <div className="h-3 w-3 bg-blue-600 rounded-full"></div>
      )}
    </div>
  );
}

// Empty State Component
function EmptyState({ icon, title, description, actionLabel, actionLink }: any) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="text-gray-400 dark:text-gray-600 mb-4">{icon}</div>
      <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{title}</h3>
      <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md">{description}</p>
      {actionLabel && (
        <Link href={actionLink || '#'}>
          <button className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold hover:shadow-2xl transition-all transform hover:scale-105">
            {actionLabel}
          </button>
        </Link>
      )}
    </div>
  );
}
