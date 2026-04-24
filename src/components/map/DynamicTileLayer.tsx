import { TileLayer } from 'react-leaflet';
import { useTheme } from '@/hooks/useTheme';

const LOCATIONIQ_KEY = 'pk.79ff1b13183afa6fe0469c3585a467c6';
// Use light-only tiles. CSS desaturates them to grayscale base map.
const LIGHT_URL = `https://{s}-tiles.locationiq.com/v3/streets/r/{z}/{x}/{y}.png?key=${LOCATIONIQ_KEY}`;
const DARK_URL = `https://{s}-tiles.locationiq.com/v3/streets/dark/r/{z}/{x}/{y}.png?key=${LOCATIONIQ_KEY}`;
const ATTRIBUTION = '&copy; <a href="https://locationiq.com">LocationIQ</a> &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>';

export default function DynamicTileLayer() {
  const { resolvedTheme } = useTheme();
  const url = resolvedTheme === 'dark' ? DARK_URL : LIGHT_URL;
  return (
    <TileLayer
      key={resolvedTheme}
      url={url}
      attribution={ATTRIBUTION}
      subdomains="abc"
    />
  );
}
