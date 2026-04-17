import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Send, Sparkles, Truck, Package, HelpCircle, TrendingUp, Search, DollarSign, MessageCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import ReactMarkdown from 'react-markdown';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Suggestion {
  label: string;
  icon: React.ElementType;
  message: string;
}

const SHIPPER_SUGGESTIONS: Suggestion[] = [
  { label: 'Post a load', icon: Package, message: 'Help me post a new load. What details do I need?' },
  { label: 'Check my bids', icon: TrendingUp, message: 'Show me the status of bids on my loads' },
  { label: 'Pricing advice', icon: DollarSign, message: 'What are current rates for the Harare to Beira corridor?' },
  { label: 'How bidding works', icon: HelpCircle, message: 'How does the bidding system work on HaulIQ?' },
];

const DRIVER_SUGGESTIONS: Suggestion[] = [
  { label: 'Find loads', icon: Search, message: 'What loads are available right now that I can bid on?' },
  { label: 'Bidding tips', icon: TrendingUp, message: 'How should I price my bids to win more loads?' },
  { label: 'My active jobs', icon: Truck, message: 'What\'s the status of my current deliveries and bids?' },
  { label: 'Route advice', icon: MessageCircle, message: 'Which freight corridors have the most demand right now?' },
];

const CHAT_URL = '/api/functions/ai-chatbot';

async function streamChat({
  messages,
  userContext,
  onDelta,
  onDone,
  onError,
}: {
  messages: Message[];
  userContext: any;
  onDelta: (text: string) => void;
  onDone: () => void;
  onError: (msg: string) => void;
}) {
  const resp = await fetch(CHAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messages, userContext }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: 'Connection failed' }));
    onError(err.error || 'Something went wrong');
    return;
  }

  if (!resp.body) {
    onError('No response body');
    return;
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let textBuffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    textBuffer += decoder.decode(value, { stream: true });

    let newlineIndex: number;
    while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
      let line = textBuffer.slice(0, newlineIndex);
      textBuffer = textBuffer.slice(newlineIndex + 1);

      if (line.endsWith('\r')) line = line.slice(0, -1);
      if (line.startsWith(':') || line.trim() === '') continue;
      if (!line.startsWith('data: ')) continue;

      const jsonStr = line.slice(6).trim();
      if (jsonStr === '[DONE]') { onDone(); return; }

      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) onDelta(content);
      } catch {
        textBuffer = line + '\n' + textBuffer;
        break;
      }
    }
  }

  // Final flush
  if (textBuffer.trim()) {
    for (let raw of textBuffer.split('\n')) {
      if (!raw) continue;
      if (raw.endsWith('\r')) raw = raw.slice(0, -1);
      if (raw.startsWith(':') || raw.trim() === '') continue;
      if (!raw.startsWith('data: ')) continue;
      const jsonStr = raw.slice(6).trim();
      if (jsonStr === '[DONE]') continue;
      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) onDelta(content);
      } catch { /* ignore */ }
    }
  }

  onDone();
}

export default function HauliqAIChatbot() {
  const { user, profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const role = profile?.role as string | undefined;
  const suggestions = role === 'driver' ? DRIVER_SUGGESTIONS : SHIPPER_SUGGESTIONS;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const greeting = role === 'driver'
    ? `Hey ${profile?.full_name?.split(' ')[0] || 'driver'}! I can help you find loads, bid smarter, and navigate freight corridors. What do you need?`
    : `Hi ${profile?.full_name?.split(' ')[0] || 'there'}! I can help you post loads, review bids, and get market pricing. How can I help?`;

  const handleSend = useCallback(async (text?: string) => {
    const msgText = text || input.trim();
    if (!msgText || loading) return;

    const userMsg: Message = { role: 'user', content: msgText };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);
    setShowSuggestions(false);

    let assistantSoFar = '';
    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant') {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
        }
        return [...prev, { role: 'assistant', content: assistantSoFar }];
      });
    };

    try {
      await streamChat({
        messages: newMessages,
        userContext: {
          role: profile?.role,
          userId: user?.id,
          fullName: profile?.full_name,
        },
        onDelta: (chunk) => {
          upsertAssistant(chunk);
        },
        onDone: () => {
          // If no content was received, show fallback
          if (!assistantSoFar.trim()) {
            setMessages(prev => {
              const last = prev[prev.length - 1];
              if (last?.role === 'assistant' && !last.content.trim()) {
                return prev.slice(0, -1).concat({ role: 'assistant', content: '⚠️ No response received. Please try again.' });
              }
              if (last?.role !== 'assistant') {
                return [...prev, { role: 'assistant', content: '⚠️ No response received. Please try again.' }];
              }
              return prev;
            });
          }
          setLoading(false);
        },
        onError: (errMsg) => {
          setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ ${errMsg}` }]);
          setLoading(false);
        },
      });
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ Connection error. Please try again.' }]);
      setLoading(false);
    }
  }, [input, loading, messages, profile, user]);

  if (!user) return null;


  return (
    <>
      {/* Floating button */}
      <AnimatePresence>
        {!open && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="fixed bottom-24 right-4 z-[2500]"
          >
            <div className="relative">
              {/* Outer amber pulse ring */}
              <span className="absolute inset-0 rounded-full bg-primary animate-ping opacity-40 pointer-events-none" />
              {/* Secondary slower ring */}
              <span className="absolute -inset-1 rounded-full bg-primary/20 animate-pulse pointer-events-none" />
              <Button
                onClick={() => setOpen(true)}
                className="h-14 w-14 rounded-full shadow-xl bg-primary hover:bg-primary/90 text-primary-foreground relative z-10 border-2 border-primary/50"
                style={{ boxShadow: '0 0 20px rgba(255,191,0,0.45), 0 4px 16px rgba(0,0,0,0.4)' }}
                size="icon"
              >
                <Sparkles className="h-6 w-6" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="fixed bottom-24 right-4 z-50 w-[360px] max-h-[520px] rounded-2xl overflow-hidden glass-strong flex flex-col shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-background/80">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setOpen(false)}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                  <Sparkles className="h-4 w-4 text-primary-foreground" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Hauliq AI</p>
                  <p className="text-[10px] text-muted-foreground">
                    {role === 'driver' ? 'Driver Assistant' : role === 'shipper' ? 'Shipper Assistant' : 'Logistics Assistant'}
                  </p>
                </div>
              </div>
              <div className="w-8" />
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[300px]">
              {/* Greeting */}
              {messages.length === 0 && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start">
                  <div className="max-w-[90%] rounded-2xl rounded-bl-md px-3.5 py-2.5 text-sm bg-muted text-foreground">
                    {greeting}
                  </div>
                </motion.div>
              )}

              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[90%] rounded-2xl px-3.5 py-2.5 text-sm ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-br-md'
                      : 'bg-muted text-foreground rounded-bl-md'
                  }`}>
                    {msg.role === 'assistant' ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:mb-1.5 [&>ul]:mb-1.5 [&>ul]:pl-4 [&>ol]:pl-4">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : msg.content}
                  </div>
                </motion.div>
              ))}

              {loading && messages[messages.length - 1]?.role !== 'assistant' && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3 flex items-center">
                    <span className="flex gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-primary animate-bounce [animation-delay:0ms]" />
                      <span className="h-2 w-2 rounded-full bg-primary animate-bounce [animation-delay:150ms]" />
                      <span className="h-2 w-2 rounded-full bg-primary animate-bounce [animation-delay:300ms]" />
                    </span>
                  </div>
                </div>
              )}

              {/* Auto-suggestions */}
              {showSuggestions && messages.length === 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="grid grid-cols-2 gap-2 pt-2"
                >
                  {suggestions.map((s) => (
                    <button
                      key={s.label}
                      onClick={() => handleSend(s.message)}
                      className="flex items-center gap-2 rounded-xl border border-border/60 bg-background/60 px-3 py-2.5 text-xs text-foreground hover:bg-muted/80 transition-colors text-left"
                    >
                      <s.icon className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span>{s.label}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </div>

            {/* Input */}
            <div className="p-3 border-t border-border/50 bg-background/80">
              <div className="flex gap-2">
                <Input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder={role === 'driver' ? 'Find loads, bid advice...' : 'Post loads, check bids...'}
                  onKeyDown={e => e.key === 'Enter' && handleSend()}
                  className="text-sm bg-muted/50 border-border/50"
                />
                <Button size="icon" onClick={() => handleSend()} disabled={loading || !input.trim()} className="shrink-0">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
