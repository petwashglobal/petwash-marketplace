/**
 * Google Dialogflow CX AI Chat Widget
 * Production-grade Gemini-powered chatbot for ⁦Pet Wash™⁩
 * 
 * Features:
 * - Bilingual Hebrew/English support
 * - Accessibility compliant (WCAG 2.1 AA)
 * - Mobile-responsive design
 * - Session persistence
 * - Luxury ⁦Pet Wash™⁩ branding
 */

import { useState, useEffect, useRef } from 'react';
import { nanoid } from 'nanoid';
import { MessageCircle, X, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getApiUrl } from '@/lib/apiConfig';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
}

interface AiChatWidgetProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const AI_CONSENT_KEY = 'aiChatConsentV1';
const AI_CONSENT_VERSION = '1.0';

function getStoredConsent(): { acceptedAt: string; consentVersion: string; sessionId: string } | null {
  try {
    const raw = localStorage.getItem(AI_CONSENT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function AiChatWidget({ isOpen: externalIsOpen, onClose }: AiChatWidgetProps = {}) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  
  // Use external control if provided, otherwise use internal state
  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;
  const setIsOpen = onClose ? (value: boolean) => {
    if (!value) onClose();
  } : setInternalIsOpen;
  const [messages, setMessages] = useState<Message[]>([]);
  const [userInput, setUserInput] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [language, setLanguage] = useState<'he' | 'en'>('he'); // Default Hebrew for Israeli market
  // Item 4: Consent gate — true if user has previously accepted
  const [consentGiven, setConsentGiven] = useState<boolean>(() => !!getStoredConsent());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Generate unique session ID when component mounts
  useEffect(() => {
    const newSessionId = `session-${nanoid(16)}`;
    setSessionId(newSessionId);
    
    // Welcome message in Hebrew
    setMessages([
      {
        id: 'welcome',
        text: '👋 שלום! אני קנזו, העוזר החכם של ⁦Pet Wash™⁩. איך אוכל לעזור לך היום?',
        sender: 'bot',
        timestamp: new Date(),
      }
    ]);
  }, []);

  // Item 4: Accept consent and store in localStorage
  const handleConsentAccept = () => {
    const sessionRef = `session-${nanoid(8)}`;
    localStorage.setItem(AI_CONSENT_KEY, JSON.stringify({
      acceptedAt: new Date().toISOString(),
      consentVersion: AI_CONSENT_VERSION,
      sessionId: sessionRef,
    }));
    setConsentGiven(true);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  // Handle sending message to backend
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim() || isLoading) return;

    const userMessage: Message = {
      id: nanoid(),
      text: userInput,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setUserInput('');
    setIsLoading(true);

    try {
      const response = await fetch(getApiUrl('/api/ai/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userInput,
          language: language,
          sessionId: sessionId,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const botMessage: Message = {
        id: nanoid(),
        text: data.response || data.reply || 'מצטער, לא הבנתי. אנא נסה שוב.',
        sender: 'bot',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, botMessage]);

    } catch (error) {
      console.error('[AI Chat] Failed to send message:', error);
      const errorMessage: Message = {
        id: nanoid(),
        text: 'מצטערים, אנחנו חווים בעיה טכנית. נסה שוב בעוד רגע.',
        sender: 'bot',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Format timestamp for display
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('he-IL', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Don't render anything if not open (controlled by FloatingStack)
  if (!isOpen) return null;

  // FAB stack clearance: 3 buttons (56px each) + spacing + safe margin ≈ 240px
  const FAB_STACK_CLEARANCE = '240px';

  return (
    <>
      {/* Responsive bottom positioning via CSS */}
      <style>{`
        .chat-widget-mobile {
          bottom: calc(env(safe-area-inset-bottom, 0px) + ${FAB_STACK_CLEARANCE});
        }
        @media (min-width: 768px) {
          .chat-widget-mobile {
            bottom: calc(env(safe-area-inset-bottom, 0px) + 1.5rem);
          }
        }
      `}</style>

      {/* Main Chat Window - Safe-area aware positioning */}
      {isOpen && (
        <div 
          className="chat-widget-mobile fixed left-4 right-4 md:right-6 md:left-auto md:w-[420px] z-50 flex flex-col rounded-2xl shadow-2xl overflow-hidden"
          data-theme="dark"
          style={{
            maxHeight: 'min(80dvh, 600px)',
            background: '#0D0D14',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
          data-testid="chat-window"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative h-12 w-12 rounded-full bg-white/20 flex items-center justify-center overflow-hidden ring-2 ring-white/30">
                <img 
                  src="/brand/kenzo-avatar.jpeg" 
                  alt="Kenzo - Pet Wash AI Assistant" 
                  className={`h-full w-full object-cover transition-transform duration-200 ${
                    isLoading ? 'scale-110 animate-pulse' : 'scale-100'
                  }`}
                  style={{
                    transform: isLoading ? 'scale(1.1)' : 'scale(1)'
                  }}
                />
                {isLoading && (
                  <div className="absolute inset-0 bg-blue-500/20 animate-pulse" />
                )}
              </div>
              <div>
                <h3 className="text-white font-semibold text-base">קנזו - העוזר החכם</h3>
                <p className="text-white/80 text-xs flex items-center gap-1">
                  <span className={`inline-block w-2 h-2 rounded-full ${isLoading ? 'bg-green-400 animate-pulse' : 'bg-green-300'}`} />
                  {isLoading ? 'מדבר...' : 'מוכן לעזור'}
                </p>
              </div>
            </div>
            <Button
              onClick={() => setIsOpen(false)}
              variant="ghost"
              size="sm"
              className="text-white hover:bg-white/20 h-8 w-8 p-0"
              data-testid="chat-close-button"
              aria-label="סגור צ'אט"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Item 4: Consent Notice — shown once, stored in localStorage */}
          {!consentGiven && (
            <div
              className="flex flex-col items-center justify-center gap-4 p-6 text-center"
              style={{ background: '#12121F', flex: 1 }}
              dir="rtl"
            >
              <div className="rounded-full bg-blue-600/20 p-4">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-blue-400">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 11c0-1.657 1.343-3 3-3s3 1.343 3 3-1.343 3-3 3-3-1.343-3-3z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 16v-4" />
                </svg>
              </div>
              <div>
                <h4 className="text-white font-semibold text-base mb-2">לפני שנתחיל 🐾</h4>
                <p className="text-white/70 text-sm leading-relaxed">
                  שיחות עם קנזו עוברות עיבוד על-ידי{' '}
                  <span className="text-white/90">Google Gemini AI</span>{' '}
                  לצורך מתן תשובות. ייתכן שמידע זה יישמר עד{' '}
                  <span className="text-white/90">90 יום</span>{' '}
                  לצורכי אבטחה ושיפור השירות בלבד — לא מועבר לצדדים שלישיים.
                </p>
                <p className="text-white/40 text-xs mt-3">
                  אל תשתף פרטים אישיים מזהים (שם, מספר ת"ז, פרטי כרטיס אשראי).
                </p>
              </div>
              <Button
                onClick={handleConsentAccept}
                className="w-full max-w-xs rounded-xl font-medium"
                style={{
                  background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
                  color: '#fff',
                }}
              >
                הבנתי, בואו נתחיל
              </Button>
            </div>
          )}

          {/* Messages Area — hidden until consent given */}
          {consentGiven && <ScrollArea className="flex-1 p-4" style={{ background: '#0D0D14' }}>
            <div 
              className="space-y-4"
              role="log"
              aria-live="polite"
              aria-atomic="false"
              aria-relevant="additions"
            >
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                  data-testid={`message-${msg.sender}`}
                >
                  <div
                    className="max-w-[75%] rounded-2xl px-4 py-2.5"
                    style={{
                      background: msg.sender === 'user'
                        ? 'linear-gradient(135deg, #4F46E5, #7C3AED)'
                        : 'rgba(255,255,255,0.08)',
                      border: msg.sender === 'user'
                        ? 'none'
                        : '1px solid rgba(255,255,255,0.12)',
                      color: msg.sender === 'user' ? '#FFFFFF' : 'rgba(255,255,255,0.92)',
                    }}
                  >
                    <p className="text-sm whitespace-pre-wrap break-words">{msg.text}</p>
                    <span className="text-[10px] mt-1 block" style={{
                      color: msg.sender === 'user' ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.4)'
                    }}>
                      {formatTime(msg.timestamp)}
                    </span>
                  </div>
                </div>
              ))}

              {/* Typing Indicator */}
              {isLoading && (
                <div className="flex justify-start" data-testid="typing-indicator">
                  <div className="rounded-2xl px-4 py-2.5" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>
                    <div className="flex gap-1.5">
                      <div className="h-2 w-2 rounded-full animate-bounce" style={{ background: '#C9A96E', animationDelay: '0ms' }} />
                      <div className="h-2 w-2 rounded-full animate-bounce" style={{ background: '#C9A96E', animationDelay: '150ms' }} />
                      <div className="h-2 w-2 rounded-full animate-bounce" style={{ background: '#C9A96E', animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>}

          {/* Input Area — only shown after consent */}
          {consentGiven && <form
            onSubmit={handleSubmit}
            className="p-3 border-t"
            style={{ background: '#111118', borderColor: 'rgba(255,255,255,0.1)' }}
          >
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                type="text"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                placeholder="הקלד/י הודעה..."
                disabled={isLoading}
                className="flex-1 border"
                style={{ background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.9)' }}
                data-testid="chat-input"
                aria-label="הקלד הודעה"
              />
              <Button
                type="submit"
                disabled={isLoading || !userInput.trim()}
                className="bg-gradient-to-br from-blue-600 to-purple-600 hover:opacity-90 text-white"
                data-testid="chat-send-button"
                aria-label="שלח הודעה"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Language Toggle */}
            <div className="flex gap-2 mt-2 justify-center">
              <button
                type="button"
                onClick={() => setLanguage('he')}
                className="text-xs px-3 py-1 rounded-full transition-colors"
                style={{
                  background: language === 'he' ? '#4F46E5' : 'rgba(255,255,255,0.08)',
                  color: language === 'he' ? '#FFFFFF' : 'rgba(255,255,255,0.5)',
                  border: `1px solid ${language === 'he' ? '#4F46E5' : 'rgba(255,255,255,0.12)'}`,
                }}
                data-testid="lang-toggle-he"
              >
                עברית
              </button>
              <button
                type="button"
                onClick={() => setLanguage('en')}
                className="text-xs px-3 py-1 rounded-full transition-colors"
                style={{
                  background: language === 'en' ? '#4F46E5' : 'rgba(255,255,255,0.08)',
                  color: language === 'en' ? '#FFFFFF' : 'rgba(255,255,255,0.5)',
                  border: `1px solid ${language === 'en' ? '#4F46E5' : 'rgba(255,255,255,0.12)'}`,
                }}
                data-testid="lang-toggle-en"
              >
                English
              </button>
            </div>
          </form>}
        </div>
      )}
    </>
  );
}
