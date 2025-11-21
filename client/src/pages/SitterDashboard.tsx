import { useLanguage } from "@/lib/languageStore";
import { useFirebaseAuth } from "@/auth/AuthProvider";
import { useQuery } from "@tanstack/react-query";
import { MessageSquare, Calendar, DollarSign, Settings, LogOut, PawPrint, Shield, Bell, Star, TrendingUp, Users } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { WorldClock } from "@/components/WorldClock";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export default function SitterDashboard() {
  const { language } = useLanguage();
  const { user, signOut } = useFirebaseAuth();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<'bookings' | 'inbox' | 'earnings' | 'profile'>('bookings');
  const isHebrew = language === 'he';

  // Fetch sitter's bookings
  const { data: bookings, isLoading: loadingBookings } = useQuery<any[]>({
    queryKey: ['/api/sitter-suite/sitter/bookings'],
    enabled: !!user,
  });

  // Fetch inbox messages
  const { data: messages, isLoading: loadingMessages } = useQuery<any[]>({
    queryKey: ['/api/sitter-suite/sitter/messages'],
    enabled: !!user && activeTab === 'inbox',
  });

  // Fetch earnings
  const { data: earnings, isLoading: loadingEarnings } = useQuery<any>({
    queryKey: ['/api/sitter-suite/sitter/earnings'],
    enabled: !!user && activeTab === 'earnings',
  });

  // Fetch sitter profile
  const { data: profile } = useQuery<any>({
    queryKey: ['/api/sitter-suite/sitter/profile'],
    enabled: !!user,
  });

  const handleLogout = async () => {
    await signOut();
    setLocation('/');
  };

  const unreadCount = messages?.filter((m: any) => !m.isRead).length || 0;
  const upcomingBookings = bookings?.filter((b: any) => b.status === 'confirmed').length || 0;

  return (
    <div className={`min-h-screen luxury-bg-mesh ${isHebrew ? 'rtl' : 'ltr'}`}>
      {/* 7-STAR LUXURY HEADER */}
      <header className="sticky top-0 z-50 luxury-glass-panel luxury-shadow-lg">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo & Branding */}
            <div className="flex items-center gap-4">
              <div className="bg-gradient-to-br from-purple-600 via-pink-600 to-orange-600 p-3 rounded-2xl shadow-2xl">
                <Shield className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="luxury-heading-md luxury-text-gradient">
                  Pet Wash Stay™
                </h1>
                <p className="luxury-text-small">
                  {isHebrew ? 'לוח שמרטפים מקצועי' : 'Professional Sitter Portal'}
                </p>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="hidden lg:flex items-center gap-6">
              <StatCard
                icon={<Calendar className="h-5 w-5" />}
                label={isHebrew ? 'הזמנות קרובות' : 'Upcoming'}
                value={upcomingBookings}
                color="blue"
              />
              <StatCard
                icon={<Star className="h-5 w-5" />}
                label={isHebrew ? 'דירוג' : 'Rating'}
                value={profile?.averageRating?.toFixed(1) || '5.0'}
                color="yellow"
              />
              <StatCard
                icon={<TrendingUp className="h-5 w-5" />}
                label={isHebrew ? 'החודש' : 'This Month'}
                value={`₪${earnings?.currentMonthTotal || 0}`}
                color="green"
              />
            </div>

            {/* User Menu */}
            <div className="flex items-center gap-4">
              {/* Language Switcher */}
              <LanguageSwitcher compact={true} showFlag={true} />
              
              <button className="relative p-3 luxury-glass-minimal luxury-hover-lift rounded-xl transition-all">
                <Bell className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                {unreadCount > 0 && (
                  <span className="absolute top-2 right-2 h-2 w-2 bg-red-500 rounded-full"></span>
                )}
              </button>
              
              <div className="flex items-center gap-3 luxury-glass-minimal px-4 py-2 rounded-xl">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
                  {user?.email?.charAt(0).toUpperCase()}
                </div>
                <div className="text-sm">
                  <p className="font-semibold text-gray-900 dark:text-white">{profile?.fullName || user?.email}</p>
                  <div className="flex items-center gap-1">
                    {profile?.biometricMatchStatus === 'matched' && (
                      <Shield className="h-3 w-3 text-green-600" />
                    )}
                    <p className="text-gray-600 dark:text-gray-400">
                      {isHebrew ? 'שמרטף מאושר' : 'Verified Sitter'}
                    </p>
                  </div>
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
              active={activeTab === 'earnings'}
              onClick={() => setActiveTab('earnings')}
              icon={<DollarSign className="h-5 w-5" />}
              label={isHebrew ? 'רווחים' : 'Earnings'}
            />
            <TabButton
              active={activeTab === 'profile'}
              onClick={() => setActiveTab('profile')}
              icon={<Settings className="h-5 w-5" />}
              label={isHebrew ? 'פרופיל' : 'Profile'}
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
            <div className="flex items-center justify-between mb-6 luxury-animate-fade-in">
              <h2 className="luxury-heading-lg">
                {isHebrew ? 'ההזמנות שלי' : 'My Bookings'}
              </h2>
              <div className="flex items-center gap-3">
                <select className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl">
                  <option>{isHebrew ? 'הכל' : 'All'}</option>
                  <option>{isHebrew ? 'ממתינים' : 'Pending'}</option>
                  <option>{isHebrew ? 'מאושרים' : 'Confirmed'}</option>
                  <option>{isHebrew ? 'הושלמו' : 'Completed'}</option>
                </select>
              </div>
            </div>

            {loadingBookings ? (
              <div className="luxury-grid-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-64 luxury-skeleton"></div>
                ))}
              </div>
            ) : bookings && bookings.length > 0 ? (
              <div className="luxury-grid-2">
                {bookings.map((booking: any, index: number) => (
                  <div key={booking.id} className={`luxury-animate-fade-in luxury-delay-${Math.min(index + 1, 5)}`}>
                    <SitterBookingCard booking={booking} isHebrew={isHebrew} />
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<Calendar className="h-16 w-16" />}
                title={isHebrew ? 'אין הזמנות עדיין' : 'No bookings yet'}
                description={isHebrew ? 'ההזמנות שלך יופיעו כאן' : 'Your bookings will appear here'}
              />
            )}
          </div>
        )}

        {activeTab === 'inbox' && (
          <div className="luxury-animate-fade-in">
            <h2 className="luxury-heading-lg mb-6">
              {isHebrew ? 'תיבת הדואר שלי' : 'My Inbox'}
            </h2>
            
            {loadingMessages ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-24 luxury-skeleton"></div>
                ))}
              </div>
            ) : messages && messages.length > 0 ? (
              <div className="luxury-glass-card luxury-shadow-xl p-6">
                {messages.map((message: any) => (
                  <MessagePreview key={message.id} message={message} isHebrew={isHebrew} />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<MessageSquare className="h-16 w-16" />}
                title={isHebrew ? 'אין הודעות' : 'No messages'}
                description={isHebrew ? 'ההודעות שלך עם בעלי חיות מחמד יופיעו כאן' : 'Your conversations with pet owners will appear here'}
              />
            )}
          </div>
        )}

        {activeTab === 'earnings' && (
          <div className="luxury-animate-fade-in">
            <h2 className="luxury-heading-lg mb-6">
              {isHebrew ? 'סיכום רווחים' : 'Earnings Summary'}
            </h2>

            {loadingEarnings ? (
              <div className="luxury-grid-3 mb-8">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-32 luxury-skeleton"></div>
                ))}
              </div>
            ) : (
              <>
                <div className="luxury-grid-3 mb-8">
                  <div className="luxury-animate-fade-in luxury-delay-1">
                    <EarningsCard
                      title={isHebrew ? 'סך הכל הרוויח' : 'Total Earned'}
                      amount={earnings?.totalEarned || 0}
                      icon={<TrendingUp className="h-8 w-8" />}
                      color="green"
                    />
                  </div>
                  <div className="luxury-animate-fade-in luxury-delay-2">
                    <EarningsCard
                      title={isHebrew ? 'החודש' : 'This Month'}
                      amount={earnings?.currentMonthTotal || 0}
                      icon={<DollarSign className="h-8 w-8" />}
                      color="blue"
                    />
                  </div>
                  <div className="luxury-animate-fade-in luxury-delay-3">
                    <EarningsCard
                      title={isHebrew ? 'ממתין לתשלום' : 'Pending Payout'}
                      amount={earnings?.pendingPayout || 0}
                      icon={<Calendar className="h-8 w-8" />}
                      color="purple"
                    />
                  </div>
                </div>

                <div className="luxury-glass-card luxury-shadow-xl luxury-hover-glow p-6 luxury-animate-fade-in luxury-delay-4">
                  <h3 className="luxury-heading-sm mb-4">
                    {isHebrew ? 'היסטוריית תשלומים' : 'Payment History'}
                  </h3>
                  <p className="luxury-text-body">
                    {isHebrew ? 'היסטוריית תשלומים תופיע כאן' : 'Payment history will appear here'}
                  </p>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="luxury-animate-fade-in">
            <h2 className="luxury-heading-lg mb-6">
              {isHebrew ? 'הפרופיל שלי' : 'My Profile'}
            </h2>
            <div className="luxury-glass-card luxury-shadow-xl luxury-hover-glow p-8">
              <div className="flex items-center gap-6 mb-8">
                <div className="h-24 w-24 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-4xl font-bold">
                  {profile?.fullName?.charAt(0) || 'S'}
                </div>
                <div>
                  <h3 className="luxury-heading-md">{profile?.fullName}</h3>
                  <p className="luxury-text-body">{profile?.email}</p>
                  <div className="flex items-center gap-2 mt-2">
                    {profile?.biometricMatchStatus === 'matched' ? (
                      <div className="flex items-center gap-2 text-green-600">
                        <Shield className="h-4 w-4" />
                        <span className="text-sm font-semibold">
                          {isHebrew ? 'מאומת ביומטרית' : 'Biometrically Verified'}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-yellow-600">
                        <Shield className="h-4 w-4" />
                        <span className="text-sm font-semibold">
                          {isHebrew ? 'ממתין לאימות' : 'Pending Verification'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <Link href="/sitter-suite/sitter/edit-profile">
                <button className="w-full luxury-btn-primary">
                  {isHebrew ? 'ערוך פרופיל' : 'Edit Profile'}
                </button>
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// Stat Card Component
function StatCard({ icon, label, value, color }: any) {
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    yellow: 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400',
    green: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
  };

  return (
    <div className="flex items-center gap-3 luxury-glass-minimal luxury-hover-lift px-4 py-2 rounded-xl">
      <div className={`p-2 rounded-lg ${colorClasses[color as keyof typeof colorClasses]}`}>
        {icon}
      </div>
      <div>
        <p className="luxury-text-small">{label}</p>
        <p className="luxury-heading-sm luxury-text-gradient">{value}</p>
      </div>
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
          ? 'border-purple-600 text-purple-600 dark:text-purple-400 font-semibold'
          : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
      }`}
    >
      {icon}
      <span>{label}</span>
      {badge > 0 && (
        <span className="ml-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
          {badge}
        </span>
      )}
    </button>
  );
}

// Sitter Booking Card Component
function SitterBookingCard({ booking, isHebrew }: any) {
  const getStatusBadge = (status: string) => {
    if (status === 'confirmed') return 'luxury-badge-success';
    if (status === 'pending') return 'luxury-badge-gold';
    if (status === 'completed') return 'luxury-badge';
    return 'luxury-badge';
  };

  return (
    <div className="luxury-glass-card luxury-shadow-lg luxury-hover-lift p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <PawPrint className="h-6 w-6 text-white" />
          </div>
          <div>
            <h3 className="luxury-heading-sm">{booking.ownerName}</h3>
            <p className="luxury-text-small">{booking.petName} • {booking.petType}</p>
          </div>
        </div>
        <span className={`${getStatusBadge(booking.status)}`}>
          {booking.status}
        </span>
      </div>

      <div className="space-y-2 mb-4 luxury-glass-minimal p-4 rounded-xl">
        <div className="flex items-center justify-between">
          <span className="luxury-text-small">{isHebrew ? 'תאריכים' : 'Dates'}</span>
          <span className="luxury-text-body font-semibold">
            {new Date(booking.startDate).toLocaleDateString()} - {new Date(booking.endDate).toLocaleDateString()}
          </span>
        </div>
        
        {/* COMMISSION BREAKDOWN - Show net earnings after 7% */}
        <div className="flex items-center justify-between">
          <span className="luxury-text-small">{isHebrew ? 'סכום ההזמנה:' : 'Booking amount:'}</span>
          <span className="luxury-text-body">₪{((booking.sitterPayoutCents / 0.93) / 100).toFixed(2)}</span>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="luxury-text-small">{isHebrew ? 'עמלת פלטפורמה (7%):' : 'Platform fee (7%):'}</span>
          <span className="luxury-text-body text-blue-600">-₪{((booking.sitterPayoutCents / 0.93) * 0.07 / 100).toFixed(2)}</span>
        </div>
        
        <div className="luxury-divider"></div>
        
        <div className="flex items-center justify-between">
          <span className="luxury-heading-sm">{isHebrew ? 'הרווח שלך (93%):' : 'Your earnings (93%):'}</span>
          <span className="luxury-heading-lg luxury-text-gradient">₪{(booking.sitterPayoutCents / 100).toFixed(2)}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-4">
        <button className="flex-1 luxury-btn-primary">
          {isHebrew ? 'צפה בפרטים' : 'View Details'}
        </button>
        <button className="luxury-btn-secondary px-4 py-2">
          <MessageSquare className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

// Message Preview Component
function MessagePreview({ message, isHebrew }: any) {
  return (
    <div className={`flex items-center gap-4 p-4 luxury-glass-minimal luxury-hover-lift rounded-xl cursor-pointer transition-all mb-2 ${!message.isRead ? 'bg-purple-50 dark:bg-purple-900/20' : ''}`}>
      <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold">
        {message.senderName?.charAt(0) || 'O'}
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <h4 className="luxury-heading-sm">{message.senderName}</h4>
          <span className="luxury-text-small">{new Date(message.createdAt).toLocaleTimeString()}</span>
        </div>
        <p className="luxury-text-body truncate">{message.messageText}</p>
      </div>
      {!message.isRead && (
        <div className="h-3 w-3 bg-purple-600 rounded-full"></div>
      )}
    </div>
  );
}

// Earnings Card Component
function EarningsCard({ title, amount, icon, color }: any) {
  const colorClasses = {
    green: 'from-green-500 to-emerald-500',
    blue: 'from-blue-500 to-cyan-500',
    purple: 'from-purple-500 to-pink-500',
  };

  return (
    <div className="luxury-glass-card luxury-shadow-xl luxury-hover-glow p-6">
      <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${colorClasses[color as keyof typeof colorClasses]} text-white mb-4 luxury-shadow-md`}>
        {icon}
      </div>
      <p className="luxury-text-small mb-2">{title}</p>
      <p className="luxury-heading-lg luxury-text-gradient">₪{amount.toFixed(2)}</p>
    </div>
  );
}

// Empty State Component
function EmptyState({ icon, title, description, actionLabel, actionLink }: any) {
  return (
    <div className="luxury-glass-card luxury-shadow-lg p-12 flex flex-col items-center justify-center text-center luxury-animate-fade-in">
      <div className="text-gray-400 dark:text-gray-600 mb-4">{icon}</div>
      <h3 className="luxury-heading-md mb-2">{title}</h3>
      <p className="luxury-text-body mb-6 max-w-md">{description}</p>
      {actionLabel && (
        <Link href={actionLink || '#'}>
          <button className="luxury-btn-primary">
            {actionLabel}
          </button>
        </Link>
      )}
    </div>
  );
}
