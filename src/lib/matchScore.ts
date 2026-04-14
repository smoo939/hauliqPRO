// Client-side AI Match Score algorithm
// Scores loads 0-100 based on truck compatibility, proximity, price, recency

interface MatchInput {
  load: {
    price: number | null;
    equipment_type: string | null;
    weight_lbs: number | null;
    urgent: boolean | null;
    created_at: string;
    pickup_location: string;
    lat?: number;
    lng?: number;
  };
  driverTruck?: string | null;
  driverLat?: number | null;
  driverLng?: number | null;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function calculateMatchScore({ load, driverTruck, driverLat, driverLng }: MatchInput): number {
  let score = 0;

  // Price attractiveness (0-30 points)
  const price = load.price || 0;
  if (price >= 2000) score += 30;
  else if (price >= 1000) score += 25;
  else if (price >= 500) score += 20;
  else if (price >= 200) score += 12;
  else score += 5;

  // Recency (0-25 points) - newer = better
  const hoursOld = (Date.now() - new Date(load.created_at).getTime()) / (1000 * 60 * 60);
  if (hoursOld < 1) score += 25;
  else if (hoursOld < 6) score += 20;
  else if (hoursOld < 24) score += 15;
  else if (hoursOld < 72) score += 8;
  else score += 3;

  // Proximity (0-25 points) - closer = better
  if (driverLat != null && driverLng != null && load.lat != null && load.lng != null) {
    const dist = haversineKm(driverLat, driverLng, load.lat, load.lng);
    if (dist < 50) score += 25;
    else if (dist < 100) score += 20;
    else if (dist < 200) score += 15;
    else if (dist < 500) score += 8;
    else score += 3;
  } else {
    score += 10; // neutral if no GPS
  }

  // Truck compatibility (0-15 points)
  if (driverTruck && load.equipment_type) {
    const truckLower = driverTruck.toLowerCase();
    const loadEquip = load.equipment_type.toLowerCase();
    if (truckLower.includes(loadEquip) || loadEquip.includes(truckLower)) {
      score += 15;
    } else {
      score += 5; // partial match
    }
  } else {
    score += 8; // neutral
  }

  // Urgent bonus (0-5)
  if (load.urgent) score += 5;

  return Math.min(100, Math.max(0, score));
}

export function getMatchLabel(score: number): string {
  if (score >= 90) return 'Perfect Match';
  if (score >= 75) return 'Great Match';
  if (score >= 60) return 'Good Match';
  if (score >= 40) return 'Fair Match';
  return '';
}
