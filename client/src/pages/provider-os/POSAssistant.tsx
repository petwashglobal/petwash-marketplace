import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { getApiUrl } from '@/lib/apiConfig';
import {
  Bot, Send, Loader2, Sparkles, RefreshCw,
  TrendingUp, Briefcase, Wallet, FileText,
  MessageSquare, Calendar, Star,
} from 'lucide-react';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  ts: number;
}

const SUGGESTION_CHIPS = [
  { label: 'Summarize my day', icon: Calendar, prompt: 'Summarize my day as a provider — jobs today, earnings, and any important alerts.' },
  { label: 'Which job to accept?', icon: Briefcase, prompt: 'Based on my current schedule and recent performance, which type of job should I prioritize accepting?' },
  { label: 'Explain my payout', icon: Wallet, prompt: 'Explain how the payout system works — escrow, platform fee, VAT, and when I receive my money.' },
  { label: 'Draft client reply', icon: MessageSquare, prompt: 'Help me write a professional reply to a client who asked if I have availability next weekend for a pet sitting session.' },
  { label: 'Check my documents', icon: FileText, prompt: 'What documents should I have in order as a PetWash provider? What expires regularly and needs renewal?' },
  { label: 'Pricing advice', icon: TrendingUp, prompt: 'Give me advice on how to price my pet care services competitively in the Israeli market. What factors should I consider?' },
  { label: 'Improve my bio', icon: Star, prompt: 'Help me write an engaging provider bio that will attract more clients on the PetWash platform.' },
  { label: 'Handle cancellation', icon: RefreshCw, prompt: 'A client just cancelled 2 hours before the appointment. What should I do and what is my cancellation policy?' },
];

function fetchWithAuth(url: string) {
  return fetch(url, { credentials: 'include' }).then(r => r.json());
}

export default function POSAssistant() {
  const { user } = useFirebaseAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: `Shalom! 👋 I'm your PetWash AI Assistant, powered by Gemini.\n\nI'm here to help you manage your provider business — from understanding payouts, to drafting client messages, to optimizing your schedule.\n\nHow can I help you today?`,
      ts: Date.now(),
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { data: stats } = useQuery({
    queryKey: ['/api/provider-dashboard/stats'],
    queryFn: () => fetchWithAuth('/api/provider-dashboard/stats'),
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const buildSystemContext = () => {
    const providerName = user?.displayName || 'Provider';
    const rating = (stats as any)?.averageRating || 'N/A';
    const completed = (stats as any)?.completedBookings || 0;
    const active = (stats as any)?.activeBookings || 0;
    const pending = (stats as any)?.pendingPayouts || 0;
    return `You are the PetWash™ Provider AI Assistant. You help ${providerName}, a pet care provider on PetWash.co.il.

Provider context:
- Rating: ${rating} ⭐
- Completed bookings: ${completed}
- Active bookings: ${active}
- Pending payout: ₪${(pending / 100).toFixed(2)}
- Platform: PetWash™ Israel (Hebrew/RTL market, ILS currency, VAT 18%)
- Services: PetSitter, Walk My Pet, PetWash, Academy

Be helpful, concise, and practical. Answer in English unless the user writes in Hebrew. Focus on actionable advice for Israeli pet care providers.`;
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: ChatMessage = { role: 'user', content: text.trim(), ts: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch(getApiUrl('/api/ai/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          message: text.trim(),
          systemPrompt: buildSystemContext(),
          history: messages.slice(-6).map(m => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      const reply = data?.response || data?.message || data?.text || "I couldn't generate a response. Please try again.";
      setMessages(prev => [...prev, { role: 'assistant', content: reply, ts: Date.now() }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: "I'm having trouble connecting right now. Please try again in a moment.", ts: Date.now() }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const clearChat = () => {
    setMessages([{
      role: 'assistant',
      content: "Chat cleared. How can I help you today?",
      ts: Date.now(),
    }]);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-11rem)] lg:h-[calc(100vh-8rem)] min-h-[500px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-md">
            <Sparkles className="w-4.5 h-4.5 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">AI Assistant</p>
            <p className="text-xs text-gray-500">Powered by Gemini</p>
          </div>
        </div>
        <button onClick={clearChat} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors py-1.5 px-2.5 rounded-lg hover:bg-gray-100">
          <RefreshCw className="w-3.5 h-3.5" /> Clear
        </button>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 mb-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
              msg.role === 'assistant' ? 'bg-gradient-to-br from-indigo-500 to-purple-600' : 'bg-amber-500'
            }`}>
              {msg.role === 'assistant' ? <Bot className="w-3.5 h-3.5 text-white" /> : <span className="text-white text-[10px] font-bold">You</span>}
            </div>
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
              msg.role === 'user'
                ? 'bg-amber-500 text-white rounded-tr-sm'
                : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm shadow-sm'
            }`}
              style={{ whiteSpace: 'pre-wrap' }}>
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-3">
            <div className="w-7 h-7 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shrink-0">
              <Bot className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm flex items-center gap-2">
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <span key={i} className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Suggestion chips — show only in empty/initial state */}
        {messages.length <= 1 && !loading && (
          <div className="mt-4">
            <p className="text-xs text-gray-500 mb-3 text-center">Quick prompts to get started:</p>
            <div className="grid grid-cols-2 gap-2">
              {SUGGESTION_CHIPS.map(chip => {
                const Icon = chip.icon;
                return (
                  <button key={chip.label} onClick={() => sendMessage(chip.prompt)}
                    className="flex items-center gap-2 p-3 bg-white border border-gray-200 rounded-xl text-start hover:border-indigo-300 hover:bg-indigo-50 transition-all group">
                    <Icon className="w-4 h-4 text-indigo-500 shrink-0" />
                    <span className="text-xs font-medium text-gray-700 group-hover:text-indigo-700 leading-tight">{chip.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask me anything about your business..."
          rows={2}
          className="w-full px-4 py-3 text-sm text-gray-900 resize-none focus:outline-none placeholder-gray-400"
          style={{ fontSize: '16px' }}
        />
        <div className="flex items-center justify-between px-4 pb-3">
          <p className="text-[10px] text-gray-400">Press Enter to send · Shift+Enter for new line</p>
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            className="w-8 h-8 bg-indigo-600 text-white rounded-xl flex items-center justify-center hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
