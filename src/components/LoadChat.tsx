import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send, Lock } from 'lucide-react';

interface Props {
  loadId: string;
  loadStatus?: string;
}

export default function LoadChat({ loadId, loadStatus }: Props) {
  const { user } = useAuth();
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  // Chat is locked unless bid is accepted (load status: accepted, in_transit, delivered)
  const chatEnabled = !loadStatus || ['accepted', 'in_transit', 'delivered'].includes(loadStatus);

  const { data: messages, refetch } = useQuery({
    queryKey: ['load-messages', loadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*, profiles:sender_id(full_name)')
        .eq('load_id', loadId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    },
    refetchInterval: chatEnabled ? 5000 : false,
    enabled: chatEnabled,
  });

  const handleSend = async () => {
    if (!message.trim() || !user || !chatEnabled) return;
    setSending(true);
    try {
      const { error } = await supabase.from('messages').insert({
        load_id: loadId,
        sender_id: user.id,
        content: message.trim(),
      });
      if (error) throw error;
      setMessage('');
      refetch();
    } finally {
      setSending(false);
    }
  };

  if (!chatEnabled) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/40 border border-border/40">
        <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
        <div>
          <p className="text-sm font-semibold">Chat locked</p>
          <p className="text-xs text-muted-foreground">Available once a bid is accepted and carrier is assigned</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="max-h-48 overflow-y-auto space-y-2">
        {messages?.length ? messages.map((msg: any) => (
          <div key={msg.id} className={`flex ${msg.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
              msg.sender_id === user?.id
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted'
            }`}>
              {msg.sender_id !== user?.id && (
                <p className="text-xs font-semibold mb-0.5 opacity-70">{msg.profiles?.full_name || 'User'}</p>
              )}
              <p>{msg.content}</p>
            </div>
          </div>
        )) : (
          <p className="text-xs text-muted-foreground text-center py-3">No messages yet — start the conversation</p>
        )}
      </div>
      <div className="flex gap-2">
        <Input
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="Type a message..."
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          className="text-sm"
        />
        <Button size="icon" onClick={handleSend} disabled={sending || !message.trim()} className="bg-primary text-primary-foreground">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
