import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, TrendingUp, TrendingDown, Minus, Truck, DollarSign, MapPin, Fuel, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

interface Load {
  id: string;
  title: string;
  pickup_location: string;
  delivery_location: string;
  price: number;
  weight_lbs: number | null;
  equipment_type: string | null;
  load_type: string | null;
  pickup_date: string | null;
}

interface CarrierMatch {
  rank: number;
  carrier_type: string;
  equipment_match: string;
  estimated_rate_usd: number;
  confidence_pct: number;
  reasoning: string;
  route_notes: string;
}

interface PricingResult {
  recommended_rate_usd: number;
  rate_range_low_usd: number;
  rate_range_high_usd: number;
  rate_per_km_usd: number;
  estimated_distance_km: number;
  fuel_cost_estimate_usd: number;
  platform_fee_usd: number;
  driver_payout_usd: number;
  price_factors: { factor: string; impact: 'increases' | 'decreases' | 'neutral'; detail: string }[];
  market_comparison: string;
}

const impactIcons = {
  increases: TrendingUp,
  decreases: TrendingDown,
  neutral: Minus,
};

const impactColors = {
  increases: 'text-destructive',
  decreases: 'text-green-600',
  neutral: 'text-muted-foreground',
};

export function AICarrierMatch({ load }: { load: Load }) {
  const [result, setResult] = useState<{ carriers: CarrierMatch[]; market_insight: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchMatches = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-load-matching', {
        body: { action: 'match-carriers', load },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      setResult(data.result);
    } catch (err: any) {
      toast.error(err.message || 'Failed to get AI suggestions');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      {!result ? (
        <Button
          variant="outline"
          size="sm"
          onClick={fetchMatches}
          disabled={loading}
          className="gap-2"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {loading ? 'Analyzing...' : 'AI Carrier Match'}
        </Button>
      ) : (
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="space-y-3"
          >
            <div className="flex items-center gap-2 text-sm font-medium text-primary">
              <Sparkles className="h-4 w-4" />
              AI Carrier Suggestions
            </div>

            {result.carriers.map((c, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <Card className="border-primary/10">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                          #{c.rank}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{c.carrier_type}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Truck className="h-3 w-3" /> {c.equipment_match}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-sm">${c.estimated_rate_usd.toFixed(0)}</p>
                        <Badge variant="outline" className="text-xs">
                          {c.confidence_pct}% match
                        </Badge>
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">{c.reasoning}</p>
                    <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> {c.route_notes}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}

            <p className="text-xs text-muted-foreground italic px-1">{result.market_insight}</p>

            <Button variant="ghost" size="sm" onClick={() => setResult(null)} className="text-xs">
              Refresh
            </Button>
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}

export function AIDynamicPricing({ load }: { load: Load }) {
  const [result, setResult] = useState<PricingResult | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchPricing = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-load-matching', {
        body: { action: 'dynamic-pricing', load },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      setResult(data.result);
    } catch (err: any) {
      toast.error(err.message || 'Failed to get pricing');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      {!result ? (
        <Button
          variant="outline"
          size="sm"
          onClick={fetchPricing}
          disabled={loading}
          className="gap-2"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <DollarSign className="h-4 w-4" />}
          {loading ? 'Calculating...' : 'AI Price Analysis'}
        </Button>
      ) : (
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="space-y-3"
          >
            <div className="flex items-center gap-2 text-sm font-medium text-primary">
              <DollarSign className="h-4 w-4" />
              AI Pricing Analysis
            </div>

            <Card className="border-primary/10">
              <CardContent className="p-4 space-y-3">
                {/* Main price */}
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Recommended Rate</p>
                  <p className="text-2xl font-bold text-primary">${result.recommended_rate_usd.toFixed(0)}</p>
                  <p className="text-xs text-muted-foreground">
                    Range: ${result.rate_range_low_usd.toFixed(0)} – ${result.rate_range_high_usd.toFixed(0)}
                  </p>
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-muted/50 p-2 text-center">
                    <p className="text-xs text-muted-foreground">Distance</p>
                    <p className="text-sm font-semibold">{result.estimated_distance_km.toFixed(0)} km</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-2 text-center">
                    <p className="text-xs text-muted-foreground">Rate/km</p>
                    <p className="text-sm font-semibold">${result.rate_per_km_usd.toFixed(2)}</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-2 text-center">
                    <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                      <Fuel className="h-3 w-3" /> Fuel Est.
                    </p>
                    <p className="text-sm font-semibold">${result.fuel_cost_estimate_usd.toFixed(0)}</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-2 text-center">
                    <p className="text-xs text-muted-foreground">Driver Payout</p>
                    <p className="text-sm font-semibold text-green-600">${result.driver_payout_usd.toFixed(0)}</p>
                  </div>
                </div>

                {/* Price factors */}
                <div className="space-y-1.5">
                  <p className="text-xs font-medium">Price Factors</p>
                  {result.price_factors.map((pf, i) => {
                    const Icon = impactIcons[pf.impact];
                    return (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <Icon className={`h-3 w-3 shrink-0 ${impactColors[pf.impact]}`} />
                        <span className="font-medium">{pf.factor}:</span>
                        <span className="text-muted-foreground">{pf.detail}</span>
                      </div>
                    );
                  })}
                </div>

                <p className="text-xs text-muted-foreground italic">{result.market_comparison}</p>
              </CardContent>
            </Card>

            <Button variant="ghost" size="sm" onClick={() => setResult(null)} className="text-xs">
              Refresh
            </Button>
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}
