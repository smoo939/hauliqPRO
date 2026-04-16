import { TileLayer } from 'react-leaflet';

const LOCATIONIQ_KEY = 'pk.79ff1b13183afa6fe0469c3585a467c6';
const DARK_URL = `https://{s}-tiles.locationiq.com/v3/streets/dark/r/{z}/{x}/{y}.png?key=${LOCATIONIQ_KEY}`;
const ATTRIBUTION = '&copy; <a href="https://locationiq.com">LocationIQ</a> &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>';

export default function DynamicTileLayer() {
  return (
    <TileLayer
      url={DARK_URL}
      attribution={ATTRIBUTION}
      subdomains="abc"
    />
  );
}
