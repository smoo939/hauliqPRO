import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import { useState } from 'react';
import LoadChat from './LoadChat';
import { format } from 'date-fns';

export default function ChatListView() {
  const { user } = useAuth();
  const [selectedLoadId, setSelectedLoadId] = useState<string | null>(null);

  // Get loads where user is shipper or driver (has chat access)
  const { data: chatLoads, isLoading } = useQuery({
    queryKey: ['chat-loads', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('loads')
        .select('id, title, pickup_location, delivery_location, status, created_at')
        .or(`shipper_id.eq.${user!.id},driver_id.eq.${user!.id}`)
        .in('status', ['accepted', 'in_transit'])
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  if (selectedLoadId) {
    const load = chatLoads?.find((l: any) => l.id === selectedLoadId);
    return (
      <div className="flex flex-col h-full">
        <button
          onClick={() => setSelectedLoadId(null)}
          className="flex items-center gap-2 text-sm text-primary font-medium mb-3 hover:underline"
        >
          ← Back to chats
        </button>
        <p className="text-xs text-muted-foreground mb-2">{load?.title}</p>
        <div className="flex-1">
          <LoadChat loadId={selectedLoadId} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Messages</h2>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : !chatLoads?.length ? (
        <div className="flex flex-col items-center py-16 text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
            <MessageCircle className="h-7 w-7 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">No active conversations</p>
          <p className="text-xs text-muted-foreground mt-1">Chat appears when a load is accepted</p>
        </div>
      ) : (
        chatLoads.map((load: any, i: number) => (
          <motion.div
            key={load.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
          >
            <Card
              className="cursor-pointer transition-shadow hover:shadow-md"
              onClick={() => setSelectedLoadId(load.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                      <MessageCircle className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{load.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {load.pickup_location} → {load.delivery_location}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <Badge variant="outline" className="text-xs">
                      {load.status.replace('_', ' ')}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Clock className="h-2.5 w-2.5" />
                      {format(new Date(load.created_at), 'MMM d')}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))
      )}
    </div>
  );
}
