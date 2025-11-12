import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { auth, db } from '@/lib/firebase';
import { collection, query as firestoreQuery, where, getDocs } from 'firebase/firestore';
import { useLanguage } from '@/lib/languageStore';
import { trackInboxOpened, trackMessageRead } from '@/lib/analytics';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Mail, 
  MailOpen, 
  Gift, 
  Sparkles, 
  Receipt, 
  Calendar, 
  AlertCircle,
  Filter,
  ArrowLeft,
  Dog,
  Syringe,
  PartyPopper,
  Heart,
  CheckCircle2,
  XCircle,
  Clock
} from 'lucide-react';
import { format, differenceInDays, parseISO, isPast, isFuture } from 'date-fns';
import { he, enUS } from 'date-fns/locale';

interface InboxMessage {
  id: string;
  type: 'receipt' | 'voucher' | 'promo' | 'system' | 'reminder';
  subject: string;
  body: string;
  isRead: boolean;
  attachments?: string[];
  metadata?: Record<string, any>;
  createdAt: string;
}

interface Pet {
  id: string;
  name: string;
  species: string;
  breed?: string;
  birthday?: string;
  photoUrl?: string;
  vaccineDates?: {
    rabies?: string;
    dhpp?: string;
    lepto?: string;
  };
  reminderEnabled: boolean;
  birthdayVoucherCode?: string; // Added for birthday voucher display
}

export default function Inbox() {
  const { t, language, dir } = useLanguage();
  const [selectedMessage, setSelectedMessage] = useState<InboxMessage | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [pets, setPets] = useState<Pet[]>([]);

  useEffect(() => {
    const getToken = async () => {
      const user = auth.currentUser;
      if (user) {
        const token = await user.getIdToken();
        setAuthToken(token);
      }
    };
    getToken();
  }, []);

  // Fetch user's pets for profile display
  useEffect(() => {
    const fetchPets = async () => {
      const user = auth.currentUser;
      if (!user) return;

      try {
        const petsRef = collection(db, 'users', user.uid, 'pets');
        const q = firestoreQuery(petsRef, where('deletedAt', '==', null));
        const snapshot = await getDocs(q);
        const petsData = await Promise.all(snapshot.docs.map(async (doc) => {
          const petData = {
            id: doc.id,
            ...doc.data()
          } as Pet;
          
          // If it's the pet's birthday, fetch the voucher code
          if (isBirthday(petData.birthday)) {
            try {
              const year = new Date().getFullYear();
              const vouchersRef = collection(db, 'birthday_vouchers');
              const voucherQuery = firestoreQuery(
                vouchersRef,
                where('uid', '==', user.uid),
                where('birthdayYear', '==', year),
                where('dogName', '==', petData.name)
              );
              const voucherSnapshot = await getDocs(voucherQuery);
              if (!voucherSnapshot.empty) {
                const voucherData = voucherSnapshot.docs[0].data();
                petData.birthdayVoucherCode = voucherData.code;
              }
            } catch (voucherError) {
              console.error('Failed to fetch birthday voucher:', voucherError);
            }
          }
          
          return petData;
        }));
        setPets(petsData);
      } catch (error) {
        console.error('Failed to fetch pets:', error);
      }
    };
    fetchPets();
  }, []);

  const { data: messages = [], isLoading } = useQuery<InboxMessage[]>({
    queryKey: ['/api/inbox/user'],
    enabled: !!authToken,
    queryFn: async () => {
      const response = await fetch('/api/inbox/user', {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch messages');
      const data = await response.json();
      
      // Track inbox opened with unread count
      const user = auth.currentUser;
      if (user && data.messages) {
        const unreadCount = data.messages.filter((m: InboxMessage) => !m.isRead).length;
        trackInboxOpened(user.uid, unreadCount);
      }
      
      return data.messages || [];
    },
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (messageId: string) => {
      if (!authToken) throw new Error('Not authenticated');
      const response = await fetch(`/api/inbox/user/${messageId}/read`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });
      if (!response.ok) throw new Error('Failed to mark message as read');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inbox/user'] });
    },
  });

  const handleMessageClick = (message: InboxMessage) => {
    setSelectedMessage(message);
    if (!message.isRead) {
      markAsReadMutation.mutate(message.id);
      // Track message read
      const user = auth.currentUser;
      if (user) {
        trackMessageRead(user.uid, message.id, message.type);
      }
    }
  };

  const filteredMessages = filterType === 'all' 
    ? messages 
    : messages.filter(m => m.type === filterType);

  const unreadCount = messages.filter(m => !m.isRead).length;

  const getMessageIcon = (type: string) => {
    const iconStyle = { color: '#d4af37' };
    switch (type) {
      case 'receipt': return <Receipt className="h-5 w-5" style={iconStyle} />;
      case 'voucher': return <Gift className="h-5 w-5" style={iconStyle} />;
      case 'promo': return <Sparkles className="h-5 w-5" style={iconStyle} />;
      case 'reminder': return <Syringe className="h-5 w-5" style={iconStyle} />;
      case 'system': return <Heart className="h-5 w-5" style={iconStyle} />;
      default: return <AlertCircle className="h-5 w-5 text-gray-400" />;
    }
  };

  const getTypeLabel = (type: string) => {
    const labels = {
      he: {
        receipt: 'קבלה',
        voucher: 'שובר',
        promo: 'מבצע',
        system: 'מערכת',
        reminder: 'תזכורת',
      },
      en: {
        receipt: 'Receipt',
        voucher: 'Voucher',
        promo: 'Promotion',
        system: 'System',
        reminder: 'Reminder',
      },
    };
    return labels[language as 'he' | 'en'][type as keyof typeof labels.he] || type;
  };

  // Helper function to get vaccine status
  const getVaccineStatus = (vaccineDate?: string) => {
    if (!vaccineDate) return { 
      status: 'unknown', 
      days: null, 
      iconClass: 'text-gray-400',
      textClass: 'text-gray-600',
      icon: <Syringe className="h-4 w-4 text-gray-400" />
    };
    
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset to start of day for accurate comparison
    const vDate = parseISO(vaccineDate);
    vDate.setHours(0, 0, 0, 0); // Reset to start of day for accurate comparison
    const days = differenceInDays(vDate, today);
    
    if (days < 0) {
      // Vaccine date is in the past (overdue)
      return { 
        status: 'overdue', 
        days, 
        iconClass: 'text-red-600',
        textClass: 'text-red-600',
        icon: <XCircle className="h-4 w-4 text-red-600" />
      };
    } else if (days === 0) {
      // Vaccine due today
      return { 
        status: 'today', 
        days, 
        iconClass: 'text-amber-600',
        textClass: 'text-amber-600',
        icon: <Clock className="h-4 w-4 text-amber-600" />
      };
    } else if (days <= 7) {
      // Vaccine due soon (within 7 days)
      return { 
        status: 'soon', 
        days, 
        iconClass: 'text-yellow-600',
        textClass: 'text-yellow-600',
        icon: <Clock className="h-4 w-4 text-yellow-600" />
      };
    } else if (days <= 30) {
      // Vaccine upcoming (within 30 days)
      return { 
        status: 'upcoming', 
        days, 
        iconClass: 'text-blue-600',
        textClass: 'text-blue-600',
        icon: <Clock className="h-4 w-4 text-blue-600" />
      };
    } else {
      // Vaccine current (more than 30 days away)
      return { 
        status: 'current', 
        days, 
        iconClass: 'text-green-600',
        textClass: 'text-green-600',
        icon: <CheckCircle2 className="h-4 w-4 text-green-600" />
      };
    }
  };

  // Helper function to check if today is pet's birthday
  const isBirthday = (birthday?: string) => {
    if (!birthday) return false;
    const today = new Date();
    const bday = parseISO(birthday);
    return today.getMonth() === bday.getMonth() && today.getDate() === bday.getDate();
  };

  // Helper function to get pet age
  const getPetAge = (birthday?: string) => {
    if (!birthday) return null;
    const today = new Date();
    const bday = parseISO(birthday);
    const years = differenceInDays(today, bday) / 365;
    return Math.floor(years);
  };

  return (
    <div className="min-h-screen p-4 md:p-6" dir={dir} style={{
      background: 'linear-gradient(135deg, #ffffff 0%, #f8f8f8 50%, #fff9f0 100%)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    }}>
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Luxury Pet Profile Cards */}
        {pets.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pets.map((pet) => (
              <Card key={pet.id} className="bg-white/80 backdrop-blur-sm shadow-lg" style={{
                border: '1px solid rgba(212, 175, 55, 0.2)',
                boxShadow: '0 10px 40px rgba(212, 175, 55, 0.1)',
              }}>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-16 w-16 border-2" style={{
                      borderColor: 'rgba(212, 175, 55, 0.4)',
                    }}>
                      <AvatarImage src={pet.photoUrl} alt={pet.name} />
                      <AvatarFallback className="text-white text-xl" style={{
                        background: 'linear-gradient(135deg, #d4af37 0%, #f4d03f 100%)',
                      }}>
                        <Dog className="h-8 w-8" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg font-light" style={{
                          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                        }}>{pet.name}</CardTitle>
                        {isBirthday(pet.birthday) && (
                          <PartyPopper className="h-5 w-5 animate-bounce" style={{ color: '#d4af37' }} />
                        )}
                      </div>
                      <CardDescription className="text-sm font-light" style={{
                        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                      }}>
                        {pet.breed || pet.species}
                        {pet.birthday && getPetAge(pet.birthday) !== null && (
                          <span className="ml-2">• {getPetAge(pet.birthday)} {t('inbox.years', language)}</span>
                        )}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                
                {/* Vaccine Status Indicators */}
                {pet.vaccineDates && pet.reminderEnabled && (
                  <CardContent className="pt-0">
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                        {t('inbox.vaccineStatus', language)}
                      </p>
                      {pet.vaccineDates.rabies && (() => {
                        const status = getVaccineStatus(pet.vaccineDates.rabies);
                        return (
                          <div className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-white/50 dark:bg-gray-700/50">
                            <div className="flex items-center gap-2">
                              <Syringe className={status.iconClass} />
                              <span className="text-sm">{t('inbox.rabies', language)}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              {status.icon}
                              <span className={`text-xs font-medium ${status.textClass}`}>
                                {status.days !== null && (
                                  status.days > 0 
                                    ? t('inbox.inDays', language).replace('{days}', status.days.toString())
                                    : status.days === 0
                                      ? t('inbox.today', language)
                                      : t('inbox.overdue', language)
                                )}
                              </span>
                            </div>
                          </div>
                        );
                      })()}
                      
                      {pet.vaccineDates.dhpp && (() => {
                        const status = getVaccineStatus(pet.vaccineDates.dhpp);
                        return (
                          <div className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-white/50 dark:bg-gray-700/50">
                            <div className="flex items-center gap-2">
                              <Syringe className={status.iconClass} />
                              <span className="text-sm">DHPP</span>
                            </div>
                            <div className="flex items-center gap-1">
                              {status.icon}
                              <span className={`text-xs font-medium ${status.textClass}`}>
                                {status.days !== null && (
                                  status.days > 0 
                                    ? t('inbox.inDays', language).replace('{days}', status.days.toString())
                                    : status.days === 0
                                      ? t('inbox.today', language)
                                      : t('inbox.overdue', language)
                                )}
                              </span>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </CardContent>
                )}
                
                {/* Birthday Message */}
                {isBirthday(pet.birthday) && (
                  <CardContent className="pt-0 pb-3">
                    <div className="text-white rounded-lg p-3 animate-pulse" style={{
                      background: 'linear-gradient(135deg, #d4af37 0%, #f4d03f 100%)',
                    }}>
                      <div className="flex items-center gap-2 mb-2">
                        <PartyPopper className="h-5 w-5" />
                        <p className="text-sm font-light" style={{
                          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                        }}>
                          {t('inbox.happyBirthday', language).replace('{name}', pet.name)}
                        </p>
                      </div>
                      <p className="text-xs opacity-90 mb-1 font-light" style={{
                        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                      }}>
                        {t('inbox.birthdayDiscount', language)}
                      </p>
                      {pet.birthdayVoucherCode && (
                        <div className="mt-2 bg-white/20 backdrop-blur-sm rounded px-3 py-2 flex items-center justify-between">
                          <span className="text-xs font-light opacity-80" style={{
                            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                          }}>
                            {t('inbox.voucherCode', language)}
                          </span>
                          <code className="text-sm font-medium tracking-wider bg-white/30 px-2 py-1 rounded" style={{
                            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                          }}>
                            {pet.birthdayVoucherCode}
                          </code>
                        </div>
                      )}
                    </div>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        )}
        
        {!selectedMessage ? (
          <Card className="backdrop-blur-sm bg-white/80 shadow-xl" style={{
            border: '1px solid rgba(212, 175, 55, 0.2)',
          }}>
            <CardHeader className="border-b" style={{
              borderColor: 'rgba(212, 175, 55, 0.2)',
              background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(255, 249, 240, 0.95) 100%)',
            }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg shadow-lg" style={{
                    background: 'linear-gradient(135deg, #d4af37 0%, #f4d03f 100%)',
                  }}>
                    <Mail className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl font-light tracking-tight" style={{
                      background: 'linear-gradient(135deg, #d4af37 0%, #f4d03f 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                    }}>
                      {t('inbox.title', language)}
                    </CardTitle>
                    <CardDescription className="text-sm font-light" style={{
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                    }}>
                      {t('inbox.subtitle', language)}
                    </CardDescription>
                  </div>
                  {unreadCount > 0 && (
                    <Badge className="text-white border-0 rounded-full animate-pulse" style={{
                      background: 'linear-gradient(135deg, #d4af37 0%, #f4d03f 100%)',
                    }}>
                      {unreadCount}
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Tabs defaultValue="all" className="w-full" onValueChange={setFilterType}>
                <div className="border-b border-gray-200 dark:border-gray-700 px-6">
                  <TabsList className="bg-transparent h-12" style={{
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                    fontWeight: 300,
                  }}>
                    <TabsTrigger value="all" className="data-[state=active]:border-b-2" style={{
                      borderColor: '#d4af37',
                    }}>
                      {t('inbox.all', language)}
                    </TabsTrigger>
                    <TabsTrigger value="receipt" className="data-[state=active]:border-b-2" style={{
                      borderColor: '#d4af37',
                    }}>
                      {t('inbox.receipts', language)}
                    </TabsTrigger>
                    <TabsTrigger value="voucher" className="data-[state=active]:border-b-2" style={{
                      borderColor: '#d4af37',
                    }}>
                      {t('inbox.vouchers', language)}
                    </TabsTrigger>
                    <TabsTrigger value="promo" className="data-[state=active]:border-b-2" style={{
                      borderColor: '#d4af37',
                    }}>
                      {t('inbox.promotions', language)}
                    </TabsTrigger>
                    <TabsTrigger value="reminder" className="data-[state=active]:border-b-2" style={{
                      borderColor: '#d4af37',
                    }}>
                      {t('inbox.reminders', language)}
                    </TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value={filterType} className="m-0">
                  <ScrollArea className="h-[600px]">
                    {isLoading ? (
                      <div className="flex items-center justify-center h-96">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{
                          borderColor: '#d4af37',
                        }}></div>
                      </div>
                    ) : filteredMessages.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-96 text-gray-500">
                        <Mail className="h-16 w-16 mb-4 opacity-20" />
                        <p className="text-lg font-light" style={{
                          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                        }}>
                          {t('inbox.noMessages', language)}
                        </p>
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-200 dark:divide-gray-700">
                        {filteredMessages.map((message) => (
                          <button
                            key={message.id}
                            onClick={() => handleMessageClick(message)}
                            data-testid={`message-item-${message.id}`}
                            className={`w-full px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-${dir === 'rtl' ? 'right' : 'left'} ${
                              !message.isRead ? 'bg-amber-50/50 dark:bg-amber-900/10' : ''
                            }`}
                            style={{
                              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                            }}
                          >
                            <div className="flex items-start gap-4">
                              <div className={`flex-shrink-0`} style={{
                                color: !message.isRead ? '#d4af37' : '#9ca3af',
                              }}>
                                {message.isRead ? <MailOpen className="h-5 w-5" /> : <Mail className="h-5 w-5" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className={`text-gray-900 dark:text-white truncate ${!message.isRead ? 'font-medium' : 'font-light'}`} style={{
                                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                                  }}>
                                    {message.subject}
                                  </h3>
                                  <Badge variant="outline" className="flex-shrink-0 text-xs" style={{
                                    borderColor: 'rgba(212, 175, 55, 0.3)',
                                    color: '#d4af37',
                                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                                  }}>
                                    {getTypeLabel(message.type)}
                                  </Badge>
                                </div>
                                <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 font-light" style={{
                                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                                }}>
                                  {message.body}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-500 mt-2 font-light" style={{
                                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                                }}>
                                  {format(new Date(message.createdAt), 'PPp', {
                                    locale: language === 'he' ? he : enUS,
                                  })}
                                </p>
                              </div>
                              <div className="flex-shrink-0 text-gray-400">
                                {getMessageIcon(message.type)}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        ) : (
          <Card className="backdrop-blur-sm bg-white/80 shadow-xl" style={{
            border: '1px solid rgba(212, 175, 55, 0.2)',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
          }}>
            <CardHeader className="border-b" style={{
              borderColor: 'rgba(212, 175, 55, 0.2)',
            }}>
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedMessage(null)}
                  data-testid="button-back-to-inbox"
                  className="hover:bg-amber-50"
                >
                  <ArrowLeft className="h-5 w-5" style={{ color: '#d4af37' }} />
                </Button>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <CardTitle className="font-light" style={{
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                    }}>{selectedMessage.subject}</CardTitle>
                    <Badge variant="outline" style={{
                      borderColor: 'rgba(212, 175, 55, 0.3)',
                      color: '#d4af37',
                    }}>{getTypeLabel(selectedMessage.type)}</Badge>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 font-light" style={{
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                  }}>
                    {format(new Date(selectedMessage.createdAt), 'PPp', {
                      locale: language === 'he' ? he : enUS,
                    })}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <ScrollArea className="h-[500px]">
                <div 
                  className="prose dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: selectedMessage.body }}
                />
                
                {selectedMessage.attachments && selectedMessage.attachments.length > 0 && (
                  <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                    <h4 className="font-semibold mb-3">
                      {t('inbox.attachments', language)}
                    </h4>
                    <div className="space-y-2">
                      {selectedMessage.attachments.map((url, index) => (
                        <Button
                          key={index}
                          variant="outline"
                          className="w-full justify-start"
                          onClick={() => window.open(url, '_blank')}
                          data-testid={`button-attachment-${index}`}
                        >
                          <Receipt className="h-4 w-4 mr-2" />
                          {t('inbox.attachment', language).replace('{index}', (index + 1).toString())}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
