/**
 * Kenzo AI Chat Widget — Pet Wash™
 * Mobile: full-width bottom sheet (slides up from bottom)
 * Desktop ≥768px: right-side popup, 420px wide
 */

import { useState, useEffect, useRef } from 'react';
import { nanoid } from 'nanoid';
import { X, Send, ChevronDown } from 'lucide-react';
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

  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;
  const setIsOpen = onClose
    ? (value: boolean) => { if (!value) onClose(); }
    : setInternalIsOpen;

  const [messages, setMessages] = useState<Message[]>([]);
  const [userInput, setUserInput] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [language, setLanguage] = useState<'he' | 'en'>('he');
  const [consentGiven, setConsentGiven] = useState<boolean>(() => !!getStoredConsent());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSessionId(`session-${nanoid(16)}`);
    setMessages([{
      id: 'welcome',
      text: '👋 שלום! אני קנזו, העוזר החכם של ⁦Pet Wash™⁩. איך אוכל לעזור לך היום?',
      sender: 'bot',
      timestamp: new Date(),
    }]);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isOpen && consentGiven) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, consentGiven]);

  // Prevent body scroll when chat is open on mobile
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isMobile = window.innerWidth < 768;
    if (isOpen && isMobile) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const handleConsentAccept = () => {
    localStorage.setItem(AI_CONSENT_KEY, JSON.stringify({
      acceptedAt: new Date().toISOString(),
      consentVersion: AI_CONSENT_VERSION,
      sessionId: `session-${nanoid(8)}`,
    }));
    setConsentGiven(true);
    setTimeout(() => inputRef.current?.focus(), 150);
  };

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
        body: JSON.stringify({ message: userInput, language, sessionId }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setMessages(prev => [...prev, {
        id: nanoid(),
        text: data.response || data.reply || 'מצטער, לא הבנתי. אנא נסה שוב.',
        sender: 'bot',
        timestamp: new Date(),
      }]);
    } catch {
      setMessages(prev => [...prev, {
        id: nanoid(),
        text: 'מצטערים, אנחנו חווים בעיה טכנית. נסה שוב בעוד רגע.',
        sender: 'bot',
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (date: Date) =>
    date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });

  if (!isOpen) return null;

  return (
    <>
      {/* ─── Mobile backdrop ─────────────────────────────────────── */}
      <div
        className="fixed inset-0 bg-black/40 md:hidden"
        style={{ zIndex: 9090 }}
        onClick={() => setIsOpen(false)}
        aria-hidden="true"
      />

      {/* ─── Chat window ─────────────────────────────────────────── */}
      {/*
          Mobile  (<768px): full-width bottom sheet anchored to bottom-0.
                            Height = 62dvh so the header + FABs stay visible.
          Desktop (≥768px): right-side popup, 420px wide, 24px from edges.
      */}
      <div
        className={[
          'fixed flex flex-col overflow-hidden shadow-2xl',
          // Mobile: full-width bottom sheet, top-rounded corners only
          'inset-x-0 bottom-0 rounded-t-2xl',
          // Mobile height: 62dvh — leaves room for site header + FAB buttons above
          'max-h-[62dvh]',
          // Desktop (≥768px): right-side popup, fully rounded, fixed width + height
          'md:inset-x-auto md:right-6 md:bottom-6 md:w-[420px] md:max-h-[600px] md:rounded-2xl',
        ].join(' ')}
        style={{
          zIndex: 9100,
          background: '#0D0D14',
          border: '1px solid rgba(255,255,255,0.1)',
        }}
        data-testid="chat-window"
      >
        {/* ── Drag handle (mobile only) ───────────────────────────── */}
        <div className="md:hidden flex justify-center pt-2.5 pb-1 flex-shrink-0" style={{ background: '#0D0D14' }}>
          <div className="w-10 h-1 rounded-full bg-white/25" />
        </div>

        {/* ── Header ─────────────────────────────────────────────── */}
        <div
          className="flex items-center justify-between gap-3 px-4 py-3 flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #1a47b8 0%, #7c3aed 100%)' }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative h-10 w-10 flex-shrink-0 rounded-full bg-white/20 flex items-center justify-center overflow-hidden ring-2 ring-white/30">
              <img
                src="/brand/kenzo-avatar.jpeg"
                alt="Kenzo"
                className={`h-full w-full object-cover transition-transform duration-200 ${isLoading ? 'scale-110' : 'scale-100'}`}
              />
              {isLoading && <div className="absolute inset-0 bg-blue-500/30 animate-pulse" />}
            </div>
            <div className="min-w-0">
              <h3 className="text-white font-semibold text-sm leading-tight truncate">קנזו - העוזר החכם</h3>
              <p className="text-white/75 text-xs flex items-center gap-1">
                <span className={`inline-block w-1.5 h-1.5 rounded-full ${isLoading ? 'bg-yellow-300 animate-pulse' : 'bg-green-300'}`} />
                {isLoading ? 'מדבר...' : 'מוכן לעזור'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-full text-white/80 hover:text-white hover:bg-white/20 transition-colors"
            aria-label="סגור צ'אט"
            data-testid="chat-close-button"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ── Consent gate ────────────────────────────────────────── */}
        {!consentGiven && (
          <div
            className="flex flex-col items-center justify-center gap-4 p-5 text-center flex-1 overflow-y-auto"
            style={{ background: '#12121F' }}
            dir="rtl"
          >
            <div className="rounded-full bg-blue-600/20 p-3">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-blue-400">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <div>
              <h4 className="text-white font-semibold text-base mb-2">לפני שנתחיל 🐾</h4>
              <p className="text-white/70 text-sm leading-relaxed">
                שיחות עם קנזו עוברות עיבוד על-ידי{' '}
                <span className="text-white/90">Google Gemini AI</span>. ייתכן שמידע זה יישמר עד{' '}
                <span className="text-white/90">90 יום</span>{' '}
                לצורכי אבטחה ושיפור השירות בלבד — לא מועבר לצדדים שלישיים.
              </p>
              <p className="text-white/40 text-xs mt-2">
                אל תשתף פרטים אישיים מזהים (שם, מספר ת"ז, פרטי כרטיס אשראי).
              </p>
            </div>
            <button
              onClick={handleConsentAccept}
              className="w-full max-w-xs rounded-xl font-medium py-3 text-sm text-white transition-opacity hover:opacity-90 active:opacity-80"
              style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED)' }}
            >
              הבנתי, בואו נתחיל
            </button>
          </div>
        )}

        {/* ── Messages ─────────────────────────────────────────────── */}
        {consentGiven && (
          <ScrollArea className="flex-1 min-h-0" style={{ background: '#0D0D14' }}>
            <div className="p-4 space-y-3" role="log" aria-live="polite" aria-atomic="false">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                  data-testid={`message-${msg.sender}`}
                >
                  <div
                    className="max-w-[78%] rounded-2xl px-3.5 py-2.5"
                    style={{
                      background: msg.sender === 'user'
                        ? 'linear-gradient(135deg, #4F46E5, #7C3AED)'
                        : 'rgba(255,255,255,0.08)',
                      border: msg.sender === 'user' ? 'none' : '1px solid rgba(255,255,255,0.12)',
                      color: msg.sender === 'user' ? '#fff' : 'rgba(255,255,255,0.92)',
                    }}
                  >
                    <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{msg.text}</p>
                    <span className="text-[10px] mt-1 block opacity-50">{formatTime(msg.timestamp)}</span>
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start" data-testid="typing-indicator">
                  <div className="rounded-2xl px-4 py-3" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>
                    <div className="flex gap-1.5 items-center">
                      {[0, 150, 300].map((delay) => (
                        <div
                          key={delay}
                          className="h-2 w-2 rounded-full animate-bounce"
                          style={{ background: '#C9A96E', animationDelay: `${delay}ms` }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>
        )}

        {/* ── Input area ─────────────────────────────────────────── */}
        {consentGiven && (
          <form
            onSubmit={handleSubmit}
            className="flex-shrink-0 px-3 pt-2.5 pb-3 border-t"
            style={{
              background: '#111118',
              borderColor: 'rgba(255,255,255,0.1)',
              paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))',
            }}
          >
            <div className="flex gap-2 mb-2">
              <Input
                ref={inputRef}
                type="text"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                placeholder="הקלד/י הודעה..."
                disabled={isLoading}
                className="flex-1 text-sm border"
                style={{
                  background: 'rgba(255,255,255,0.07)',
                  borderColor: 'rgba(255,255,255,0.15)',
                  color: 'rgba(255,255,255,0.9)',
                  height: '40px',
                }}
                data-testid="chat-input"
                aria-label="הקלד הודעה"
                dir="rtl"
              />
              <button
                type="submit"
                disabled={isLoading || !userInput.trim()}
                className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-lg text-white transition-opacity disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED)' }}
                aria-label="שלח הודעה"
                data-testid="chat-send-button"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>

            {/* Language toggle */}
            <div className="flex gap-2 justify-center">
              {(['he', 'en'] as const).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setLanguage(lang)}
                  className="text-xs px-4 py-1 rounded-full transition-colors"
                  style={{
                    background: language === lang ? '#4F46E5' : 'rgba(255,255,255,0.08)',
                    color: language === lang ? '#fff' : 'rgba(255,255,255,0.5)',
                    border: `1px solid ${language === lang ? '#4F46E5' : 'rgba(255,255,255,0.15)'}`,
                  }}
                  data-testid={`lang-toggle-${lang}`}
                >
                  {lang === 'he' ? 'עברית' : 'English'}
                </button>
              ))}
            </div>
          </form>
        )}
      </div>
    </>
  );
}
