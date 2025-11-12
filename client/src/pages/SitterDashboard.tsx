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
    <div className={`min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50 dark:from-gray-950 dark:via-gray-900 dark:to-purple-950 ${isHebrew ? 'rtl' : 'ltr'}`}>
      {/* 7-STAR LUXURY HEADER */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/70 dark:bg-gray-900/70 border-b border-gray-200/50 dark:border-gray-700/50 shadow-2xl">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo & Branding */}
            <div className="flex items-center gap-4">
              <div className="bg-gradient-to-br from-purple-600 via-pink-600 to-orange-600 p-3 rounded-2xl shadow-2xl">
                <Shield className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-orange-600 bg-clip-text text-transparent">
                  Pet Wash Stay™
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">
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
              
              <button className="relative p-3 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-all">
                <Bell className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                {unreadCount > 0 && (
                  <span className="absolute top-2 right-2 h-2 w-2 bg-red-500 rounded-full"></span>
                )}
              </button>
              
              <div className="flex items-center gap-3 bg-gray-100 dark:bg-gray-800 px-4 py-2 rounded-xl">
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
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-64 bg-gray-200 dark:bg-gray-800 rounded-2xl animate-pulse"></div>
                ))}
              </div>
            ) : bookings && bookings.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {bookings.map((booking: any) => (
                  <SitterBookingCard key={booking.id} booking={booking} isHebrew={isHebrew} />
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
                description={isHebrew ? 'ההודעות שלך עם בעלי חיות מחמד יופיעו כאן' : 'Your conversations with pet owners will appear here'}
              />
            )}
          </div>
        )}

        {activeTab === 'earnings' && (
          <div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
              {isHebrew ? 'סיכום רווחים' : 'Earnings Summary'}
            </h2>

            {loadingEarnings ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-32 bg-gray-200 dark:bg-gray-800 rounded-2xl animate-pulse"></div>
                ))}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  <EarningsCard
                    title={isHebrew ? 'סך הכל הרוויח' : 'Total Earned'}
                    amount={earnings?.totalEarned || 0}
                    icon={<TrendingUp className="h-8 w-8" />}
                    color="green"
                  />
                  <EarningsCard
                    title={isHebrew ? 'החודש' : 'This Month'}
                    amount={earnings?.currentMonthTotal || 0}
                    icon={<DollarSign className="h-8 w-8" />}
                    color="blue"
                  />
                  <EarningsCard
                    title={isHebrew ? 'ממתין לתשלום' : 'Pending Payout'}
                    amount={earnings?.pendingPayout || 0}
                    icon={<Calendar className="h-8 w-8" />}
                    color="purple"
                  />
                </div>

                <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                    {isHebrew ? 'היסטוריית תשלומים' : 'Payment History'}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    {isHebrew ? 'היסטוריית תשלומים תופיע כאן' : 'Payment history will appear here'}
                  </p>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'profile' && (
          <div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
              {isHebrew ? 'הפרופיל שלי' : 'My Profile'}
            </h2>
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-8">
              <div className="flex items-center gap-6 mb-8">
                <div className="h-24 w-24 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-4xl font-bold">
                  {profile?.fullName?.charAt(0) || 'S'}
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{profile?.fullName}</h3>
                  <p className="text-gray-600 dark:text-gray-400">{profile?.email}</p>
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
                <button className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold hover:shadow-2xl transition-all transform hover:scale-105">
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
    <div className="flex items-center gap-3">
      <div className={`p-2 rounded-lg ${colorClasses[color as keyof typeof colorClasses]}`}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-gray-600 dark:text-gray-400">{label}</p>
        <p className="text-lg font-bold text-gray-900 dark:text-white">{value}</p>
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
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <PawPrint className="h-6 w-6 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white">{booking.ownerName}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">{booking.petName} • {booking.petType}</p>
          </div>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(booking.status)}`}>
          {booking.status}
        </span>
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">{isHebrew ? 'תאריכים' : 'Dates'}</span>
          <span className="font-semibold text-gray-900 dark:text-white">
            {new Date(booking.startDate).toLocaleDateString()} - {new Date(booking.endDate).toLocaleDateString()}
          </span>
        </div>
        
        {/* COMMISSION BREAKDOWN - Show net earnings after 7% */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">{isHebrew ? 'סכום ההזמנה:' : 'Booking amount:'}</span>
          <span className="text-gray-900 dark:text-white">₪{((booking.sitterPayoutCents / 0.93) / 100).toFixed(2)}</span>
        </div>
        
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">{isHebrew ? 'עמלת פלטפורמה (7%):' : 'Platform fee (7%):'}</span>
          <span className="text-blue-600">-₪{((booking.sitterPayoutCents / 0.93) * 0.07 / 100).toFixed(2)}</span>
        </div>
        
        <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
          <span className="text-gray-900 dark:text-white font-semibold">{isHebrew ? 'הרווח שלך (93%):' : 'Your earnings (93%):'}</span>
          <span className="font-bold text-green-600 text-lg">₪{(booking.sitterPayoutCents / 100).toFixed(2)}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
        <button className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all">
          {isHebrew ? 'צפה בפרטים' : 'View Details'}
        </button>
        <button className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
          <MessageSquare className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

// Message Preview Component
function MessagePreview({ message, isHebrew }: any) {
  return (
    <div className={`flex items-center gap-4 p-4 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl cursor-pointer transition-all ${!message.isRead ? 'bg-purple-50 dark:bg-purple-900/20' : ''}`}>
      <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold">
        {message.senderName?.charAt(0) || 'O'}
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-gray-900 dark:text-white">{message.senderName}</h4>
          <span className="text-xs text-gray-500">{new Date(message.createdAt).toLocaleTimeString()}</span>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{message.messageText}</p>
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
    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6 border border-gray-100 dark:border-gray-800">
      <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${colorClasses[color as keyof typeof colorClasses]} text-white mb-4`}>
        {icon}
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{title}</p>
      <p className="text-3xl font-bold text-gray-900 dark:text-white">₪{amount.toFixed(2)}</p>
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
          <button className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold hover:shadow-2xl transition-all transform hover:scale-105">
            {actionLabel}
          </button>
        </Link>
      )}
    </div>
  );
}
