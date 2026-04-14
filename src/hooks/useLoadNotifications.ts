import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Subscribes to real-time load status changes and fires
 * browser push notifications + in-app toasts.
 */
export function useLoadNotifications(userId: string | undefined, role: 'shipper' | 'driver') {
  const queryClient = useQueryClient();
  const permissionAsked = useRef(false);

  // Request notification permission once
  useEffect(() => {
    if (permissionAsked.current || !('Notification' in window)) return;
    permissionAsked.current = true;
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`load-notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'loads',
          ...(role === 'shipper'
            ? { filter: `shipper_id=eq.${userId}` }
            : { filter: `driver_id=eq.${userId}` }),
        },
        (payload) => {
          const newStatus = payload.new?.status;
          const oldStatus = payload.old?.status;
          if (newStatus === oldStatus) return;

          const pickup = payload.new?.pickup_location || '';
          const delivery = payload.new?.delivery_location || '';
          const route = `${pickup} → ${delivery}`;

          let title = '';
          let body = '';

          switch (newStatus) {
            case 'accepted':
              if (role === 'shipper') {
                title = '🚛 Bid Accepted';
                body = `A carrier has been assigned to ${route}`;
              } else {
                title = '✅ Load Assigned';
                body = `You've been assigned: ${route}`;
              }
              break;
            case 'in_transit':
              if (role === 'shipper') {
                title = '📍 Driver In Transit';
                body = `Your load is moving: ${route}`;
              } else {
                title = '🛣️ Transit Started';
                body = `You're now in transit: ${route}`;
              }
              break;
            case 'delivered':
              title = '✅ Load Delivered';
              body = `Delivery confirmed: ${route}`;
              break;
            default:
              return;
          }

          // In-app toast
          toast.success(title, { description: body, duration: 6000 });

          // Browser push notification
          if ('Notification' in window && Notification.permission === 'granted') {
            try {
              new Notification(title, {
                body,
                icon: '/placeholder.svg',
                tag: `load-${payload.new?.id}-${newStatus}`,
              });
            } catch {
              // Silent fail on unsupported environments
            }
          }

          // Invalidate queries to refresh UI
          queryClient.invalidateQueries({ queryKey: ['shipper-loads'] });
          queryClient.invalidateQueries({ queryKey: ['driver-loads'] });
          queryClient.invalidateQueries({ queryKey: ['available-loads'] });
          queryClient.invalidateQueries({ queryKey: ['load-history'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, role, queryClient]);
}
