import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { getApiUrl } from '@/lib/apiConfig';
import { queryClient } from '@/lib/queryClient';
import { auth, db } from '@/lib/firebase';
import { collection, query as firestoreQuery, where, getDocs } from 'firebase/firestore';
import { useLanguage } from '@/lib/languageStore';
import { trackInboxOpened, trackMessageRead } from '@/lib/analytics';
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
  ArrowLeft,
  Dog,
  Syringe,
  PartyPopper,
  Heart,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2
} from 'lucide-react';
import { format, differenceInDays, parseISO } from 'date-fns';
import { he, enUS } from 'date-fns/locale';
import sanitizeHtml from 'sanitize-html';
import { cn } from '@/lib/utils';

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
  birthdayVoucherCode?: string;
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
      const response = await fetch(getApiUrl('/api/inbox/user'), {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch messages');
      const data = await response.json();
      
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
      const response = await fetch(getApiUrl(`/api/inbox/user/${messageId}/read`), {
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
    const iconClass = 'w-5 h-5';
    switch (type) {
      case 'receipt': return <Receipt className={cn(iconClass, 'text-cyan-400')} />;
      case 'voucher': return <Gift className={cn(iconClass, 'text-pink-400')} />;
      case 'promo': return <Sparkles className={cn(iconClass, 'text-amber-400')} />;
      case 'reminder': return <Syringe className={cn(iconClass, 'text-blue-400')} />;
      case 'system': return <Heart className={cn(iconClass, 'text-rose-400')} />;
      default: return <AlertCircle className={cn(iconClass, 'text-[#8A8078]')} />;
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

  const getVaccineStatus = (vaccineDate?: string) => {
    if (!vaccineDate) return { 
      status: 'unknown', 
      days: null, 
      bgClass: 'bg-[#F0EBE0]',
      textClass: 'text-[#7A7068]',
      icon: <Syringe className="h-4 w-4 text-[#8A8078]" />
    };
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const vDate = parseISO(vaccineDate);
    vDate.setHours(0, 0, 0, 0);
    const days = differenceInDays(vDate, today);
    
    if (days < 0) {
      return { 
        status: 'overdue', 
        days, 
        bgClass: 'bg-red-500/15',
        textClass: 'text-red-400',
        icon: <XCircle className="h-4 w-4 text-red-400" />
      };
    } else if (days === 0) {
      return { 
        status: 'today', 
        days, 
        bgClass: 'bg-amber-500/15',
        textClass: 'text-amber-400',
        icon: <Clock className="h-4 w-4 text-amber-400" />
      };
    } else if (days <= 7) {
      return { 
        status: 'soon', 
        days, 
        bgClass: 'bg-yellow-500/15',
        textClass: 'text-yellow-400',
        icon: <Clock className="h-4 w-4 text-yellow-400" />
      };
    } else if (days <= 30) {
      return { 
        status: 'upcoming', 
        days, 
        bgClass: 'bg-blue-500/15',
        textClass: 'text-blue-400',
        icon: <Clock className="h-4 w-4 text-blue-400" />
      };
    } else {
      return { 
        status: 'current', 
        days, 
        bgClass: 'bg-emerald-500/15',
        textClass: 'text-emerald-400',
        icon: <CheckCircle2 className="h-4 w-4 text-emerald-400" />
      };
    }
  };

  const isBirthday = (birthday?: string) => {
    if (!birthday) return false;
    const today = new Date();
    const bday = parseISO(birthday);
    return today.getMonth() === bday.getMonth() && today.getDate() === bday.getDate();
  };

  const getPetAge = (birthday?: string) => {
    if (!birthday) return null;
    const today = new Date();
    const bday = parseISO(birthday);
    const years = differenceInDays(today, bday) / 365;
    return Math.floor(years);
  };

  return (
    <div className="luxury-dark-mesh min-h-screen" dir={dir}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
        
        <div className="text-center space-y-3 luxury-animate-fade-in">
          <h1 className="luxury-dark-heading-xl">
            {t('inbox.title', language)}
          </h1>
          <p className="luxury-dark-text-body">
            {t('inbox.subtitle', language)}
          </p>
          {unreadCount > 0 && (
            <span className="inline-flex items-center justify-center luxury-dark-badge-gold px-4 py-1.5">
              {unreadCount} {language === 'he' ? 'הודעות חדשות' : 'new messages'}
            </span>
          )}
        </div>

        {pets.length > 0 && (
          <div className="luxury-dark-grid-3 luxury-animate-slide-up">
            {pets.map((pet) => (
              <div key={pet.id} className="luxury-dark-card overflow-hidden">
                <div className="h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-cyan-500" />
                <div className="p-5">
                  <div className="flex items-center gap-4 mb-4">
                    <Avatar className="h-14 w-14 border-2 border-[#E8E3D9]">
                      <AvatarImage src={pet.photoUrl} alt={pet.name} />
                      <AvatarFallback className="bg-gradient-to-br from-[rgba(212,175,55,0.3)] to-[rgba(212,175,55,0.1)] text-[#d4af37]">
                        <Dog className="h-7 w-7" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="luxury-dark-heading-sm text-lg">{pet.name}</h3>
                        {isBirthday(pet.birthday) && (
                          <PartyPopper className="h-5 w-5 text-amber-400 animate-bounce" />
                        )}
                      </div>
                      <p className="luxury-dark-text-small text-xs">
                        {pet.breed || pet.species}
                        {pet.birthday && getPetAge(pet.birthday) !== null && (
                          <span className="ml-2">• {getPetAge(pet.birthday)} {t('inbox.years', language)}</span>
                        )}
                      </p>
                    </div>
                  </div>

                  {pet.vaccineDates && pet.reminderEnabled && (
                    <div className="space-y-2">
                      <p className="luxury-dark-text-small text-[10px] mb-2">
                        {t('inbox.vaccineStatus', language)}
                      </p>
                      {pet.vaccineDates.rabies && (() => {
                        const status = getVaccineStatus(pet.vaccineDates.rabies);
                        return (
                          <div className={cn('flex items-center justify-between py-2 px-3 rounded-lg', status.bgClass)}>
                            <div className="flex items-center gap-2">
                              <Syringe className={status.textClass} />
                              <span className="text-sm text-[#1A1A1A]">{t('inbox.rabies', language)}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {status.icon}
                              <span className={cn('text-xs font-medium', status.textClass)}>
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
                          <div className={cn('flex items-center justify-between py-2 px-3 rounded-lg', status.bgClass)}>
                            <div className="flex items-center gap-2">
                              <Syringe className={status.textClass} />
                              <span className="text-sm text-[#1A1A1A]">DHPP</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {status.icon}
                              <span className={cn('text-xs font-medium', status.textClass)}>
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
                  )}

                  {isBirthday(pet.birthday) && (
                    <div className="mt-4 rounded-xl p-4 bg-gradient-to-br from-amber-500/20 to-pink-500/15 border border-amber-500/20">
                      <div className="flex items-center gap-2 mb-2">
                        <PartyPopper className="h-5 w-5 text-amber-400" />
                        <p className="luxury-dark-heading-sm text-base text-amber-300">
                          {t('inbox.happyBirthday', language).replace('{name}', pet.name)}
                        </p>
                      </div>
                      <p className="luxury-dark-text-small text-xs text-amber-200/70 mb-2">
                        {t('inbox.birthdayDiscount', language)}
                      </p>
                      {pet.birthdayVoucherCode && (
                        <div className="bg-[#F0EBE0] rounded-lg px-4 py-2.5 flex items-center justify-between">
                          <span className="luxury-dark-text-small text-xs">{t('inbox.voucherCode', language)}</span>
                          <code className="text-base font-mono font-semibold tracking-wider text-amber-300">
                            {pet.birthdayVoucherCode}
                          </code>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        
        {!selectedMessage ? (
          <div className="luxury-dark-card luxury-animate-slide-up luxury-delay-1 overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-[#d4af37] via-[#e8e6f0] to-[#d4af37]" />
            <div className="p-6 sm:p-7 border-b border-[#E8E3D9]">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[rgba(212,175,55,0.25)] to-[rgba(212,175,55,0.1)] flex items-center justify-center">
                  <Mail className="w-6 h-6 text-[#d4af37]" />
                </div>
                <div className="flex-1">
                  <h2 className="luxury-dark-heading-md">{t('inbox.title', language)}</h2>
                  <p className="luxury-dark-text-small text-xs mt-0.5">{t('inbox.subtitle', language)}</p>
                </div>
              </div>
            </div>

            <Tabs defaultValue="all" className="w-full" onValueChange={setFilterType}>
              <div className="border-b border-[#E8E3D9] px-6 py-2">
                <TabsList className="bg-transparent h-11 p-0 gap-1">
                  {['all', 'receipt', 'voucher', 'promo', 'reminder'].map((tab) => (
                    <TabsTrigger 
                      key={tab}
                      value={tab} 
                      className="luxury-dark-text-small text-xs px-4 py-2 rounded-lg data-[state=active]:bg-[#F0EBE0] data-[state=active]:text-[#1A1A1A] transition-all"
                    >
                      {tab === 'all' ? t('inbox.all', language) :
                       tab === 'receipt' ? t('inbox.receipts', language) :
                       tab === 'voucher' ? t('inbox.vouchers', language) :
                       tab === 'promo' ? t('inbox.promotions', language) :
                       t('inbox.reminders', language)}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>

              <TabsContent value={filterType} className="m-0">
                <ScrollArea className="h-[500px] luxury-dark-scroll">
                  {isLoading ? (
                    <div className="flex items-center justify-center h-96">
                      <Loader2 className="w-10 h-10 animate-spin text-[#d4af37]" />
                    </div>
                  ) : filteredMessages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-96">
                      <Mail className="h-16 w-16 mb-4 text-[#CCCCCC]" />
                      <p className="luxury-dark-text-body">{t('inbox.noMessages', language)}</p>
                    </div>
                  ) : (
                    <div className="p-4 space-y-2">
                      {filteredMessages.map((message) => (
                        <button
                          key={message.id}
                          onClick={() => handleMessageClick(message)}
                          data-testid={`message-item-${message.id}`}
                          className={cn(
                            'luxury-credit-item w-full transition-all duration-300 hover:scale-[1.01]',
                            !message.isRead && 'border-l-2 border-l-[#d4af37] bg-[rgba(212,175,55,0.03)]',
                            dir === 'rtl' ? 'text-right' : 'text-left'
                          )}
                        >
                          <div className="flex items-start gap-4">
                            <div className={cn('flex-shrink-0 mt-0.5', !message.isRead ? 'text-[#d4af37]' : 'text-[#8A8078]')}>
                              {message.isRead ? <MailOpen className="h-5 w-5" /> : <Mail className="h-5 w-5" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1.5">
                                <h3 className={cn('luxury-dark-heading-sm text-base truncate', !message.isRead && 'text-[#1A1A1A]')}>
                                  {message.subject}
                                </h3>
                                <span className="luxury-dark-badge text-[10px] flex-shrink-0">
                                  {getTypeLabel(message.type)}
                                </span>
                              </div>
                              <p className="luxury-dark-text-body text-sm line-clamp-2 opacity-75">
                                {message.body}
                              </p>
                              <p className="luxury-dark-text-small text-xs mt-2 opacity-60">
                                {format(new Date(message.createdAt), 'PPp', {
                                  locale: language === 'he' ? he : enUS,
                                })}
                              </p>
                            </div>
                            <div className="flex-shrink-0">
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
          </div>
        ) : (
          <div className="luxury-dark-card luxury-animate-scale-in overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-[#d4af37] via-[#e8e6f0] to-[#d4af37]" />
            <div className="p-6 sm:p-7 border-b border-[#E8E3D9]">
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedMessage(null)}
                  data-testid="button-back-to-inbox"
                  className="luxury-dark-btn-ghost h-10 w-10 rounded-xl"
                >
                  <ArrowLeft className="h-5 w-5 text-[#1A1A1A]" />
                </Button>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="luxury-dark-heading-md">{selectedMessage.subject}</h2>
                    <span className="luxury-dark-badge">{getTypeLabel(selectedMessage.type)}</span>
                  </div>
                  <p className="luxury-dark-text-small text-xs">
                    {format(new Date(selectedMessage.createdAt), 'PPp', {
                      locale: language === 'he' ? he : enUS,
                    })}
                  </p>
                </div>
              </div>
            </div>
            <div className="p-6 sm:p-7">
              <ScrollArea className="h-[450px] luxury-dark-scroll">
                <div 
                  className="prose prose-invert max-w-none luxury-dark-text-body"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(selectedMessage.body, {
                    allowedTags: ['p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'a', 'img'],
                    allowedAttributes: { 'a': ['href', 'target'], 'img': ['src', 'alt'] }
                  }) }}
                />
                
                {selectedMessage.attachments && selectedMessage.attachments.length > 0 && (
                  <div className="mt-6 pt-6 border-t border-[#E8E3D9]">
                    <h4 className="luxury-dark-heading-sm mb-4">{t('inbox.attachments', language)}</h4>
                    <div className="space-y-2">
                      {selectedMessage.attachments.map((url, index) => (
                        <Button
                          key={index}
                          variant="outline"
                          className="luxury-dark-btn-ghost w-full justify-start border border-[#E8E3D9] h-12"
                          onClick={() => window.open(url, '_blank')}
                          data-testid={`button-attachment-${index}`}
                        >
                          <Receipt className="h-4 w-4 mr-3 text-cyan-400" />
                          {t('inbox.attachment', language).replace('{index}', (index + 1).toString())}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
