import { useEffect, useRef } from 'react';

const PUBLISH_INTERVAL_MS = 8000;

export function useDriverTracking(activeLoadId: string | null, driverId: string | null) {
  const watchRef = useRef<number | null>(null);
  const lastPublishRef = useRef(0);
  const lastPosRef = useRef<{ lat: number; lng: number; speed?: number; heading?: number } | null>(null);

  useEffect(() => {
    if (!activeLoadId || !driverId || !navigator.geolocation) return;

    const publish = async () => {
      const pos = lastPosRef.current;
      if (!pos) return;
      try {
        await fetch('/api/driver/location', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            load_id: activeLoadId,
            driver_id: driverId,
            lat: pos.lat,
            lng: pos.lng,
            speed: pos.speed ?? null,
            heading: pos.heading ?? null,
          }),
        });
      } catch {
        // silent — will retry on next interval
      }
    };

    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        lastPosRef.current = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          speed: pos.coords.speed ?? undefined,
          heading: pos.coords.heading ?? undefined,
        };
        const now = Date.now();
        if (now - lastPublishRef.current >= PUBLISH_INTERVAL_MS) {
          lastPublishRef.current = now;
          publish();
        }
      },
      (err) => console.warn('GPS error:', err.message),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );

    // Heartbeat to keep publishing even if no movement
    const interval = setInterval(() => {
      if (lastPosRef.current) {
        lastPublishRef.current = Date.now();
        publish();
      }
    }, PUBLISH_INTERVAL_MS);

    return () => {
      if (watchRef.current != null) {
        navigator.geolocation.clearWatch(watchRef.current);
        watchRef.current = null;
      }
      clearInterval(interval);
    };
  }, [activeLoadId, driverId]);
}
