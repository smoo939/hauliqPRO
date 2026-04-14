import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send } from 'lucide-react';

interface Props {
  loadId: string;
}

export default function LoadChat({ loadId }: Props) {
  const { user } = useAuth();
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

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
    refetchInterval: 5000,
  });

  const handleSend = async () => {
    if (!message.trim() || !user) return;
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

  return (
    <div className="space-y-3">
      <div className="max-h-48 overflow-y-auto space-y-2">
        {messages?.length ? messages.map((msg: any) => (
          <div key={msg.id} className={`flex ${msg.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${msg.sender_id === user?.id ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
              {msg.sender_id !== user?.id && (
                <p className="text-xs font-medium mb-0.5 opacity-70">{msg.profiles?.full_name || 'User'}</p>
              )}
              <p>{msg.content}</p>
            </div>
          </div>
        )) : (
          <p className="text-xs text-muted-foreground text-center py-2">No messages yet</p>
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
        <Button size="icon" onClick={handleSend} disabled={sending || !message.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
