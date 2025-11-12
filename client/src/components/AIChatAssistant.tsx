import { useState, useRef, useEffect } from "react";
import { logger } from "@/lib/logger";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, ArrowUp, Loader2 } from "lucide-react";
import { type Language, t } from "@/lib/i18n";
import { useAnalytics } from "@/hooks/useAnalytics";
import { kenzoAvatarService, type AvatarState } from "@/services/KenzoAvatarChatService";
import { MultiAvatarSelector } from "./MultiAvatarSelector";

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface AIChatAssistantProps {
  language: Language;
  isOpen?: boolean;
  onClose?: () => void;
}

export function AIChatAssistant({ language, isOpen: externalIsOpen, onClose }: AIChatAssistantProps) {
  const { trackEvent } = useAnalytics();
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  
  // Use external control if provided, otherwise use internal state
  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;
  const setIsOpen = onClose ? (value: boolean) => {
    if (!value) onClose();
  } : setInternalIsOpen;
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [avatarState, setAvatarState] = useState<AvatarState>(kenzoAvatarService.getAvatarState());
  const [show3DAvatar, setShow3DAvatar] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Listen for avatar state changes
  useEffect(() => {
    const handleAvatarStateChange = (event: CustomEvent<AvatarState>) => {
      setAvatarState(event.detail);
    };

    window.addEventListener('kenzo-avatar-state-change', handleAvatarStateChange as EventListener);

    return () => {
      window.removeEventListener('kenzo-avatar-state-change', handleAvatarStateChange as EventListener);
    };
  }, []);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      // Use Kenzo Avatar Service for AI response
      const response = await kenzoAvatarService.getResponse(input, language);

      const assistantMessage: Message = {
        role: 'assistant',
        content: response,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, assistantMessage]);
      
      trackEvent({
        action: 'ai_message_sent',
        category: 'customer_support',
        label: 'ai_response_received',
        language,
      });
    } catch (error) {
      logger.error('Chat error', error);
      
      trackEvent({
        action: 'ai_error',
        category: 'customer_support',
        label: 'ai_response_failed',
        language,
      });
      
      const errorMessage: Message = {
        role: 'assistant',
        content: t('chat.connectionError', language),
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  const welcomeMessage = t('chat.kenzoWelcome', language);
  const placeholderText = t('chat.placeholder', language);
  const fontFamily = language === 'he' ? 'Alef, sans-serif' : 'Inter, system-ui, sans-serif';

  return (
    <>
      {/* Backdrop blur overlay */}
      <div 
        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[9998] animate-fade-in"
        onClick={() => setIsOpen(false)}
        data-testid="chat-backdrop"
      />
      
      {/* Premium Chat Window */}
      <div 
        className="fixed bottom-6 right-6 w-[90vw] sm:w-[420px] max-h-[70vh] z-[9999] animate-slide-up"
        style={{ fontFamily }}
        dir={language === 'he' ? 'rtl' : 'ltr'}
      >
        {/* Glassmorphism Container */}
        <div className="glass-chat-container rounded-[22px] overflow-hidden shadow-luxury flex flex-col h-full">
          
          {/* Header */}
          <div className="glass-header p-4 flex items-center justify-between border-b border-white/10">
            <div className="flex items-center gap-3">
              {/* Kenzo's Animated Avatar */}
              <div className={`w-12 h-12 rounded-full overflow-hidden shadow-lg ring-2 ring-white/30 transition-all duration-300 ${
                avatarState.animation === 'speaking' ? 'scale-110 ring-4 ring-blue-400/50' : 
                avatarState.animation === 'nodding' ? 'animate-bounce' : ''
              }`}>
                <img 
                  src="/brand/kenzo-avatar.jpeg" 
                  alt="Kenzo - Pet Wash Ambassador" 
                  className={`w-full h-full object-cover transition-all duration-300 ${
                    avatarState.expression === 'happy' ? 'brightness-110' :
                    avatarState.expression === 'thinking' ? 'brightness-90 grayscale-[20%]' : ''
                  }`}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.parentElement!.innerHTML = '<div class="w-full h-full bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center text-2xl">🐕</div>';
                  }}
                />
              </div>
              <div>
                <h3 className="text-white font-semibold text-base flex items-center gap-2">
                  {t('chat.kenzoTitle', language)}
                </h3>
                <p className="text-white/70 text-xs flex items-center gap-2">
                  {t('chat.kenzoSubtitle', language)}
                  <button
                    onClick={() => setShow3DAvatar(!show3DAvatar)}
                    className="px-2 py-0.5 text-[10px] rounded-full bg-white/20 hover:bg-white/30 transition-all font-medium"
                    data-testid="button-toggle-3d-avatar"
                    title={show3DAvatar ? 'Switch to 2D' : 'Switch to 3D'}
                  >
                    {show3DAvatar ? '2D' : '3D'}
                  </button>
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center transition-all"
              data-testid="button-close-chat"
            >
              <X className="h-5 w-5 text-white" />
            </button>
          </div>

          {/* 3D Avatar Display (when enabled) */}
          {show3DAvatar && (
            <div className="p-4 border-b border-white/10">
              <MultiAvatarSelector
                isVisible={show3DAvatar}
                isSpeaking={loading}
                emotion={avatarState.expression}
              />
            </div>
          )}

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ maxHeight: show3DAvatar ? 'calc(70vh - 400px)' : 'calc(70vh - 140px)' }}>
            {messages.length === 0 && (
              <div className="animate-fade-in">
                <div className="bg-[#E8F0FE] rounded-[18px] p-4 text-[15px] leading-[1.6] text-gray-800">
                  {welcomeMessage}
                </div>
              </div>
            )}

            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex animate-fade-in ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                style={{ animationDelay: `${idx * 50}ms` }}
              >
                <div
                  className={`max-w-[85%] rounded-[18px] px-4 py-3 ${
                    msg.role === 'user'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'bg-[#E8F0FE] text-gray-800'
                  }`}
                  data-testid={`message-${msg.role}-${idx}`}
                >
                  <p className="text-[15px] leading-[1.6] whitespace-pre-wrap">{msg.content}</p>
                  <p className={`text-xs mt-1.5 ${msg.role === 'user' ? 'text-gray-400' : 'text-gray-500'}`}>
                    {msg.timestamp.toLocaleTimeString(language === 'he' ? 'he-IL' : 'en-US', { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </p>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start animate-fade-in">
                <div className="bg-[#E8F0FE] rounded-[18px] px-4 py-3">
                  <Loader2 className="h-5 w-5 animate-spin text-[#0B57D0]" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Bar */}
          <div className="glass-footer p-4 border-t border-white/10">
            <div className="flex gap-3 items-center">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                placeholder={placeholderText}
                disabled={loading}
                className="flex-1 bg-white/80 border-0 rounded-full px-4 py-2 text-[15px] leading-[1.6] placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-[#0B57D0]/30"
                data-testid="input-chat-message"
                dir={language === 'he' ? 'rtl' : 'ltr'}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || loading}
                className="w-10 h-10 rounded-full bg-gradient-to-br from-[#0B57D0] to-[#4E8DF7] flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:scale-105 transition-all duration-200"
                data-testid="button-send-message"
              >
                <ArrowUp className="h-5 w-5 text-white" strokeWidth={2.5} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
