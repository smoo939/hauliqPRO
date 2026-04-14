import { useTheme } from '@/hooks/useTheme';

const LOCATIONIQ_KEY = 'pk.79ff1b13183afa6fe0469c3585a467c6';

export function useMapTiles() {
  const { resolvedTheme } = useTheme();

  const tileUrl =
    resolvedTheme === 'dark'
      ? `https://{s}.locationiq.com/v3/streets/dark/256/{z}/{x}/{y}.png?key=${LOCATIONIQ_KEY}`
      : `https://{s}.locationiq.com/v3/streets/256/{z}/{x}/{y}.png?key=${LOCATIONIQ_KEY}`;

  const attribution = '&copy; <a href="https://locationiq.com">LocationIQ</a> &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>';

  return { tileUrl, attribution, resolvedTheme };
}

export const ORS_API_KEY = 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImFmMjM2MjMyYWE2NDQ2ZjdhNGE2ZDA4NTgwNzFmOTBjIiwiaCI6Im11cm11cjY0In0=';

export async function getORSRoute(
  fromLng: number, fromLat: number,
  toLng: number, toLat: number
): Promise<{ distanceKm: number; durationHours: number; coords: [number, number][] } | null> {
  try {
    const res = await fetch('https://api.openrouteservice.org/v2/directions/driving-hgv/geojson', {
      method: 'POST',
      headers: {
        'Authorization': ORS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        coordinates: [[fromLng, fromLat], [toLng, toLat]],
      }),
    });
    const data = await res.json();
    if (data.features?.length) {
      const route = data.features[0];
      const distanceKm = Math.round(route.properties.summary.distance / 1000);
      const durationHours = Math.round((route.properties.summary.duration / 3600) * 10) / 10;
      const coords: [number, number][] = route.geometry.coordinates.map(
        (c: [number, number]) => [c[1], c[0]]
      );
      return { distanceKm, durationHours, coords };
    }
    return null;
  } catch {
    return null;
  }
}
