/**
 * Google Dialogflow CX AI Chat Widget
 * Production-grade Gemini-powered chatbot for Pet Wash™
 * 
 * Features:
 * - Bilingual Hebrew/English support
 * - Accessibility compliant (WCAG 2.1 AA)
 * - Mobile-responsive design
 * - Session persistence
 * - Luxury Pet Wash™ branding
 */

import { useState, useEffect, useRef } from 'react';
import { nanoid } from 'nanoid';
import { MessageCircle, X, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
}

export function AiChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [userInput, setUserInput] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [language, setLanguage] = useState<'he' | 'en'>('he'); // Default Hebrew for Israeli market
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
        text: '👋 שלום! אני קנזו, העוזר החכם של Pet Wash™. איך אוכל לעזור לך היום?',
        sender: 'bot',
        timestamp: new Date(),
      }
    ]);
  }, []);

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
      const response = await fetch('/api/v1/chat/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: userInput,
          sessionId: sessionId,
          languageCode: language,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const botMessage: Message = {
        id: nanoid(),
        text: data.reply || 'מצטער, לא הבנתי. אנא נסה שוב.',
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

  return (
    <>
      {/* Floating Chat Bubble Button */}
      {!isOpen && (
        <Button
          onClick={() => setIsOpen(true)}
          data-testid="chat-bubble-button"
          className="fixed bottom-6 right-6 z-[9998] h-16 w-16 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 shadow-xl hover:shadow-2xl hover:scale-110 transition-all duration-300"
          aria-label="פתח צ'אט AI"
        >
          <MessageCircle className="h-7 w-7 text-white" />
        </Button>
      )}

      {/* Main Chat Window */}
      {isOpen && (
        <div 
          className="fixed bottom-6 right-6 z-[9999] w-[380px] h-[600px] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700"
          data-testid="chat-window"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center">
                <span className="text-2xl">🐕</span>
              </div>
              <div>
                <h3 className="text-white font-semibold text-base">קנזו - העוזר החכם</h3>
                <p className="text-white/80 text-xs">Pet Wash™ AI Assistant</p>
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

          {/* Messages Area */}
          <ScrollArea className="flex-1 p-4 bg-gray-50 dark:bg-gray-950">
            <div className="space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                  data-testid={`message-${msg.sender}`}
                >
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                      msg.sender === 'user'
                        ? 'bg-gradient-to-br from-blue-600 to-purple-600 text-white'
                        : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap break-words">{msg.text}</p>
                    <span className={`text-[10px] mt-1 block ${
                      msg.sender === 'user' ? 'text-white/70' : 'text-gray-500 dark:text-gray-400'
                    }`}>
                      {formatTime(msg.timestamp)}
                    </span>
                  </div>
                </div>
              ))}

              {/* Typing Indicator */}
              {isLoading && (
                <div className="flex justify-start" data-testid="typing-indicator">
                  <div className="bg-white dark:bg-gray-800 rounded-2xl px-4 py-2.5 border border-gray-200 dark:border-gray-700">
                    <div className="flex gap-1.5">
                      <div className="h-2 w-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="h-2 w-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="h-2 w-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Input Area */}
          <form
            onSubmit={handleSubmit}
            className="p-3 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700"
          >
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                type="text"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                placeholder="הקלד/י הודעה..."
                disabled={isLoading}
                className="flex-1 bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                data-testid="chat-input"
                aria-label="הקלד הודעה"
              />
              <Button
                type="submit"
                disabled={isLoading || !userInput.trim()}
                className="bg-gradient-to-br from-blue-600 to-purple-600 hover:opacity-90"
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
                className={`text-xs px-3 py-1 rounded-full transition-colors ${
                  language === 'he'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                }`}
                data-testid="lang-toggle-he"
              >
                עברית
              </button>
              <button
                type="button"
                onClick={() => setLanguage('en')}
                className={`text-xs px-3 py-1 rounded-full transition-colors ${
                  language === 'en'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                }`}
                data-testid="lang-toggle-en"
              >
                English
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
