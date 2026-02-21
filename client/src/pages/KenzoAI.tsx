import { useState, useRef, useEffect } from 'react';
import { getApiUrl } from '@/lib/apiConfig';
import { Kenzo3DRealistic } from '@/components/Kenzo3DRealistic';
import { Send, ArrowLeft, Globe, Sparkles, Loader2 } from 'lucide-react';
import { Link } from 'wouter';

type Language = 'he' | 'en' | 'ar' | 'ru' | 'fr' | 'es';

interface ChatMessage {
  id: string;
  role: 'user' | 'kenzo';
  text: string;
  timestamp: number;
}

interface ConversationEntry {
  role: 'user' | 'model';
  text: string;
}

const languages: { code: Language; label: string; flag: string }[] = [
  { code: 'he', label: 'עברית', flag: '🇮🇱' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'ar', label: 'العربية', flag: '🇸🇦' },
  { code: 'ru', label: 'Русский', flag: '🇷🇺' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
];

const suggestions: Record<Language, string[]> = {
  he: ['איפה התחנה הקרובה?', 'מה המחירים?', 'איך עובדת תכנית הנאמנות?', 'ספר לי על K9000', 'שמפו אורגני?'],
  en: ['Where is nearest station?', 'What are the prices?', 'How does loyalty program work?', 'Tell me about K9000', 'Is the shampoo organic?'],
  ar: ['أين أقرب محطة؟', 'ما هي الأسعار؟', 'كيف يعمل برنامج الولاء؟', 'أخبرني عن K9000', 'هل الشامبو عضوي؟'],
  ru: ['Где ближайшая станция?', 'Какие цены?', 'Как работает программа лояльности?', 'Расскажи о K9000', 'Шампунь органический?'],
  fr: ['Où est la station la plus proche?', 'Quels sont les prix?', 'Comment fonctionne le programme de fidélité?', 'Parlez-moi du K9000', 'Le shampooing est-il bio?'],
  es: ['¿Dónde está la estación más cercana?', '¿Cuáles son los precios?', '¿Cómo funciona el programa de lealtad?', 'Cuéntame sobre K9000', '¿El champú es orgánico?'],
};

const uiLabels: Record<Language, { title: string; subtitle: string; placeholder: string; back: string; thinking: string; welcome: string }> = {
  he: { title: '🐾 Kenzo AI', subtitle: 'העוזר החכם של ⁦Pet Wash™⁩', placeholder: 'שאל את קנזו...', back: 'חזרה', thinking: 'קנזו חושב...', welcome: 'שלום! 🐾 אני קנזו, הגולדן רטריבר הלבן של ⁦Pet Wash™⁩. איך אוכל לעזור לך היום?' },
  en: { title: '🐾 Kenzo AI', subtitle: '⁦Pet Wash™⁩ Smart Assistant', placeholder: 'Ask Kenzo...', back: 'Back', thinking: 'Kenzo is thinking...', welcome: 'Hello! 🐾 I\'m Kenzo, the white Golden Retriever of ⁦Pet Wash™⁩. How can I help you today?' },
  ar: { title: '🐾 Kenzo AI', subtitle: 'المساعد الذكي لـ ⁦Pet Wash™⁩', placeholder: 'اسأل كنزو...', back: 'رجوع', thinking: 'كنزو يفكر...', welcome: 'مرحباً! 🐾 أنا كنزو، كلب الغولدن ريتريفر الأبيض من ⁦Pet Wash™⁩. كيف يمكنني مساعدتك اليوم؟' },
  ru: { title: '🐾 Kenzo AI', subtitle: 'Умный помощник ⁦Pet Wash™⁩', placeholder: 'Спросите Кензо...', back: 'Назад', thinking: 'Кензо думает...', welcome: 'Привет! 🐾 Я Кензо, белый Голден Ретривер из ⁦Pet Wash™⁩. Чем могу помочь сегодня?' },
  fr: { title: '🐾 Kenzo AI', subtitle: 'Assistant intelligent ⁦Pet Wash™⁩', placeholder: 'Demandez à Kenzo...', back: 'Retour', thinking: 'Kenzo réfléchit...', welcome: 'Bonjour! 🐾 Je suis Kenzo, le Golden Retriever blanc de ⁦Pet Wash™⁩. Comment puis-je vous aider aujourd\'hui?' },
  es: { title: '🐾 Kenzo AI', subtitle: 'Asistente inteligente ⁦Pet Wash™⁩', placeholder: 'Pregunta a Kenzo...', back: 'Volver', thinking: 'Kenzo está pensando...', welcome: '¡Hola! 🐾 Soy Kenzo, el Golden Retriever blanco de ⁦Pet Wash™⁩. ¿Cómo puedo ayudarte hoy?' },
};

export default function KenzoAI() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [language, setLanguage] = useState<Language>('he');
  const [sessionId, setSessionId] = useState<string>(`kenzo_${Date.now()}`);
  const [conversationHistory, setConversationHistory] = useState<ConversationEntry[]>([]);
  const [emotion, setEmotion] = useState<'happy' | 'thinking' | 'excited' | 'helpful' | 'playful'>('happy');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isRTL = language === 'he' || language === 'ar';
  const labels = uiLabels[language];

  useEffect(() => {
    setMessages([{
      id: 'welcome',
      role: 'kenzo',
      text: labels.welcome,
      timestamp: Date.now(),
    }]);
    setConversationHistory([]);
  }, [language]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMessage: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      text: text.trim(),
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    setEmotion('thinking');

    const historyToSend = [...conversationHistory];
    const newHistory = [...conversationHistory, { role: 'user' as const, text: text.trim() }];

    try {
      const res = await fetch(getApiUrl('/api/ai/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text.trim(),
          language,
          sessionId,
          conversationHistory: historyToSend,
        }),
      });

      const data = await res.json();

      if (data.success) {
        if (data.sessionId) setSessionId(data.sessionId);

        const kenzoMessage: ChatMessage = {
          id: `kenzo_${Date.now()}`,
          role: 'kenzo',
          text: data.response,
          timestamp: Date.now(),
        };

        setMessages(prev => [...prev, kenzoMessage]);
        setConversationHistory([...newHistory, { role: 'model', text: data.response }]);
        setEmotion('happy');
      } else {
        throw new Error(data.error || 'Failed');
      }
    } catch {
      const fallback: Record<Language, string> = {
        he: 'סליחה, משהו השתבש. אפשר לנסות שוב? 🐾',
        en: 'Sorry, something went wrong. Can you try again? 🐾',
        ar: 'عذراً، حدث خطأ. هل يمكنك المحاولة مرة أخرى؟ 🐾',
        ru: 'Извините, что-то пошло не так. Попробуете ещё раз? 🐾',
        fr: 'Désolé, quelque chose a mal tourné. Pouvez-vous réessayer? 🐾',
        es: 'Lo siento, algo salió mal. ¿Puedes intentar de nuevo? 🐾',
      };
      setMessages(prev => [...prev, {
        id: `error_${Date.now()}`,
        role: 'kenzo',
        text: fallback[language],
        timestamp: Date.now(),
      }]);
      setConversationHistory(newHistory);
      setEmotion('helpful');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      className="min-h-screen flex flex-col"
      style={{ background: '#0A0A0F', color: '#FFFFFF' }}
    >
      <div className="w-full max-w-3xl mx-auto flex flex-col h-screen px-3 sm:px-4">
        {/* Header */}
        <div className="flex items-center justify-between py-3 shrink-0">
          <Link href="/">
            <button
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-all hover:opacity-80"
              style={{ background: 'rgba(201,169,110,0.15)', color: '#C9A96E', border: '1px solid rgba(201,169,110,0.3)' }}
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{labels.back}</span>
            </button>
          </Link>
          <img src="/brand/petwash-logo-black-bg.png" alt="⁦Pet Wash™⁩" className="h-8 opacity-90" />
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4" style={{ color: '#C9A96E' }} />
            <Sparkles className="w-4 h-4" style={{ color: '#C9A96E' }} />
          </div>
        </div>

        {/* Language Selector */}
        <div className="flex flex-wrap gap-1.5 justify-center py-2 shrink-0">
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => setLanguage(lang.code)}
              className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
              style={{
                background: language === lang.code ? 'rgba(201,169,110,0.25)' : 'rgba(255,255,255,0.05)',
                color: language === lang.code ? '#C9A96E' : 'rgba(255,255,255,0.6)',
                border: language === lang.code ? '1px solid rgba(201,169,110,0.5)' : '1px solid rgba(255,255,255,0.1)',
              }}
            >
              {lang.flag} {lang.label}
            </button>
          ))}
        </div>

        {/* Kenzo Avatar + Title */}
        <div className="flex flex-col items-center py-3 shrink-0">
          <Kenzo3DRealistic
            isVisible={true}
            isSpeaking={loading}
            emotion={emotion}
            size="md"
          />
          <h1 className="text-xl font-bold mt-2" style={{ color: '#C9A96E' }}>{labels.title}</h1>
          <p className="text-xs opacity-60">{labels.subtitle}</p>
        </div>

        {/* Chat Messages */}
        <div
          className="flex-1 overflow-y-auto space-y-3 pb-2 min-h-0"
          style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(201,169,110,0.3) transparent' }}
        >
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex items-end gap-2 ${msg.role === 'user' ? (isRTL ? 'flex-row-reverse justify-start' : 'flex-row justify-end') : (isRTL ? 'flex-row-reverse justify-end' : 'flex-row justify-start')}`}
            >
              {msg.role === 'kenzo' && (
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-base"
                  style={{ background: 'rgba(201,169,110,0.2)', border: '1px solid rgba(201,169,110,0.3)' }}
                >
                  🐾
                </div>
              )}
              <div
                className="max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap"
                style={{
                  background: msg.role === 'user'
                    ? 'rgba(201,169,110,0.2)'
                    : 'rgba(255,255,255,0.07)',
                  border: msg.role === 'user'
                    ? '1px solid rgba(201,169,110,0.3)'
                    : '1px solid rgba(255,255,255,0.1)',
                  backdropFilter: 'blur(12px)',
                  borderRadius: msg.role === 'user'
                    ? (isRTL ? '20px 20px 20px 4px' : '20px 20px 4px 20px')
                    : (isRTL ? '20px 20px 4px 20px' : '20px 20px 20px 4px'),
                  color: msg.role === 'user' ? '#C9A96E' : 'rgba(255,255,255,0.9)',
                }}
              >
                {msg.text}
              </div>
            </div>
          ))}

          {loading && (
            <div className={`flex items-end gap-2 ${isRTL ? 'flex-row-reverse justify-end' : 'flex-row justify-start'}`}>
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-base"
                style={{ background: 'rgba(201,169,110,0.2)', border: '1px solid rgba(201,169,110,0.3)' }}
              >
                🐾
              </div>
              <div
                className="px-4 py-3 rounded-2xl flex items-center gap-1"
                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(12px)' }}
              >
                <span className="text-xs opacity-50">{labels.thinking}</span>
                <span className="flex gap-0.5">
                  <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: '#C9A96E', animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: '#C9A96E', animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: '#C9A96E', animationDelay: '300ms' }} />
                </span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggestion Chips */}
        {messages.length <= 1 && !loading && (
          <div className="flex flex-wrap gap-2 justify-center py-2 shrink-0">
            {suggestions[language].map((s) => (
              <button
                key={s}
                onClick={() => sendMessage(s)}
                className="px-3 py-1.5 rounded-full text-xs transition-all hover:scale-105"
                style={{
                  background: 'rgba(201,169,110,0.1)',
                  color: '#C9A96E',
                  border: '1px solid rgba(201,169,110,0.25)',
                }}
              >
                <Sparkles className="w-3 h-3 inline-block mr-1 opacity-60" />
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Input Area */}
        <form
          onSubmit={handleSubmit}
          className="flex items-center gap-2 py-3 shrink-0"
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={labels.placeholder}
            disabled={loading}
            className="flex-1 px-4 py-3 rounded-2xl text-sm outline-none transition-all placeholder:opacity-40"
            style={{
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: '#FFFFFF',
              backdropFilter: 'blur(12px)',
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(201,169,110,0.5)'; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; }}
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="w-11 h-11 rounded-full flex items-center justify-center transition-all hover:scale-105 disabled:opacity-30 shrink-0"
            style={{
              background: input.trim() ? 'rgba(201,169,110,0.3)' : 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(201,169,110,0.4)',
              color: '#C9A96E',
            }}
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </form>
      </div>
    </div>
  );
}
