import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook that broadcasts the driver's GPS position via Supabase Realtime
 * when they have an active in_transit load.
 */
export function useDriverTracking(activeLoadId: string | null) {
  const watchRef = useRef<number | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!activeLoadId || !navigator.geolocation) return;

    const channel = supabase.channel(`tracking:${activeLoadId}`, {
      config: { broadcast: { self: false } },
    });
    channelRef.current = channel;

    channel.subscribe((status) => {
      if (status !== 'SUBSCRIBED') return;

      // Start watching position
      watchRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          channel.send({
            type: 'broadcast',
            event: 'location',
            payload: {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              speed: pos.coords.speed,
              heading: pos.coords.heading,
              timestamp: Date.now(),
            },
          });
        },
        (err) => {
          console.warn('GPS error:', err.message);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 5000,
          timeout: 15000,
        }
      );
    });

    return () => {
      if (watchRef.current != null) {
        navigator.geolocation.clearWatch(watchRef.current);
        watchRef.current = null;
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [activeLoadId]);
}
