import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, MapPin, Sparkles, Wand2, Truck, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import RouteMap from '@/components/RouteMap';
import CargoPhotoUpload from '@/components/CargoPhotoUpload';
import AddressAutocomplete from '@/components/AddressAutocomplete';
import { useLoadDraft } from '@/hooks/useLoadDraft';

// AI truck recommendation based on cargo type and weight
function recommendTruck(weight: number | null, description: string): string | null {
  const desc = description.toLowerCase();
  if (desc.includes('fuel') || desc.includes('petrol') || desc.includes('diesel') || desc.includes('liquid')) return 'Tanker';
  if (desc.includes('car') || desc.includes('vehicle') || desc.includes('auto')) return 'Car Carrier';
  if (desc.includes('livestock') || desc.includes('cattle') || desc.includes('animal')) return 'Livestock';
  if (desc.includes('log') || desc.includes('timber') || desc.includes('wood')) return 'Logging';
  if (desc.includes('cold') || desc.includes('frozen') || desc.includes('perishable') || desc.includes('food')) return 'Refrigerated';
  if (desc.includes('container') || desc.includes('shipping')) return 'Container';
  if (desc.includes('sand') || desc.includes('gravel') || desc.includes('stone') || desc.includes('mining')) return 'Tipper';
  if (desc.includes('machine') || desc.includes('heavy') || desc.includes('crane') || desc.includes('excavator')) return 'Lowbed';
  if (weight && weight > 20000) return 'Flatbed';
  if (weight && weight > 5000) return 'Enclosed';
  return null;
}

export default function ShipperCreateLoad() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { draft, updateField, clearDraft, hasDraft } = useLoadDraft();
  const [cargoPhotos, setCargoPhotos] = useState<string[]>([]);
  const [routeInfo, setRouteInfo] = useState<{ distanceKm: number; durationHours: number; suggestedPrice: number } | null>(null);
  const [aiDescLoading, setAiDescLoading] = useState(false);
  const [truckSuggestion, setTruckSuggestion] = useState<string | null>(null);

  const createLoad = useMutation({
    mutationFn: async (form: any) => {
      const { error } = await supabase.from('loads').insert({
        shipper_id: user!.id, title: form.title, description: form.description || null,
        pickup_location: form.pickup_location, delivery_location: form.delivery_location,
        pickup_date: new Date(form.pickup_date).toISOString(), price: parseFloat(form.price),
        weight_lbs: form.weight_lbs ? parseFloat(form.weight_lbs) : null,
        equipment_type: form.equipment_type || null, load_type: form.load_type, payment_method: form.payment_method,
        urgent: form.urgent || false, pickup_time: form.pickup_time || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipper-loads'] });
      toast.success('Load posted successfully!');
      clearDraft();
      setCargoPhotos([]);
      setRouteInfo(null);
      setTruckSuggestion(null);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    createLoad.mutate({
      ...draft,
      urgent: draft.urgent === 'true',
      pickup_time: draft.pickup_time || null,
      cargo_photos: cargoPhotos.length > 0 ? cargoPhotos : undefined,
    });
  };

  // AI Description generator
  const generateDescription = async () => {
    if (!draft.title && !draft.pickup_location) {
      toast.error('Add a title and route first');
      return;
    }
    setAiDescLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-chatbot', {
        body: {
          messages: [
            {
              role: 'user',
              content: `Write a short, professional freight load description (2-3 sentences max) for: Title: "${draft.title}", Route: ${draft.pickup_location} to ${draft.delivery_location}, Weight: ${draft.weight_lbs || 'not specified'} kg, Equipment: ${draft.equipment_type || 'general'}. Be concise and professional. No markdown.`,
            },
          ],
          userContext: { role: 'shipper' },
        },
      });

      // Handle streaming or direct response
      if (typeof data === 'string') {
        // Parse SSE response
        const lines = data.split('\n');
        let content = '';
        for (const line of lines) {
          if (line.startsWith('data: ') && line !== 'data: [DONE]') {
            try {
              const parsed = JSON.parse(line.slice(6));
              const c = parsed.choices?.[0]?.delta?.content;
              if (c) content += c;
            } catch {}
          }
        }
        if (content) updateField('description', content.trim());
        else toast.error('Failed to generate description');
      } else if (data?.choices?.[0]?.message?.content) {
        updateField('description', data.choices[0].message.content.trim());
      }
    } catch (err: any) {
      toast.error('AI generation failed');
    } finally {
      setAiDescLoading(false);
    }
  };

  // Truck recommendation when description/weight changes
  const handleDescriptionChange = (val: string) => {
    updateField('description', val);
    const weight = draft.weight_lbs ? parseFloat(draft.weight_lbs) : null;
    const suggestion = recommendTruck(weight, val);
    setTruckSuggestion(suggestion);
  };

  // AI price suggestion based on distance, weight, and equipment
  const aiPriceSuggestion = routeInfo ? (() => {
    let base = routeInfo.suggestedPrice;
    const weight = draft.weight_lbs ? parseFloat(draft.weight_lbs) : 0;
    if (weight > 20000) base *= 1.3;
    else if (weight > 10000) base *= 1.15;
    if (['Refrigerated', 'Tanker', 'Lowbed'].includes(draft.equipment_type)) base *= 1.2;
    if (draft.urgent === 'true') base *= 1.15;
    return Math.round(base);
  })() : null;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Create Load</h2>
          <p className="text-xs text-muted-foreground">Post a shipment for carriers to bid on</p>
        </div>
        {hasDraft && (
          <Badge variant="outline" className="text-[10px] bg-warning/10 text-warning border-warning/30">
            Draft saved
          </Badge>
        )}
      </div>

      <form onSubmit={handleCreate} className="space-y-4">
        {/* Title */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="space-y-2">
              <Label htmlFor="title">Shipment Title</Label>
              <Input id="title" placeholder="e.g. Harare to Bulawayo - 20t" required value={draft.title} onChange={(e) => updateField('title', e.target.value)} />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="description">Description</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1 text-primary"
                  onClick={generateDescription}
                  disabled={aiDescLoading}
                >
                  {aiDescLoading ? (
                    <><Loader2 className="h-3 w-3 animate-spin" /> Generating...</>
                  ) : (
                    <><Wand2 className="h-3 w-3" /> ✨ AI Write</>
                  )}
                </Button>
              </div>
              <Textarea
                id="description"
                placeholder="Load details, special handling..."
                rows={2}
                value={draft.description}
                onChange={(e) => handleDescriptionChange(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Route with embedded map */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <MapPin className="h-4 w-4 text-primary" />
              <Label className="text-sm font-semibold">Route</Label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs" htmlFor="pickup_location">Pickup</Label>
                <AddressAutocomplete id="pickup_location" placeholder="Start typing..." required value={draft.pickup_location} onChange={(v) => updateField('pickup_location', v)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs" htmlFor="delivery_location">Delivery</Label>
                <AddressAutocomplete id="delivery_location" placeholder="Start typing..." required value={draft.delivery_location} onChange={(v) => updateField('delivery_location', v)} />
              </div>
            </div>

            {draft.pickup_location && draft.delivery_location && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} transition={{ duration: 0.3 }}>
                <RouteMap
                  pickup={draft.pickup_location}
                  delivery={draft.delivery_location}
                  onRouteCalculated={(info) => {
                    setRouteInfo(info);
                    if (!draft.price) updateField('price', String(info.suggestedPrice));
                  }}
                />
              </motion.div>
            )}

            {/* AI Price Suggestion */}
            {aiPriceSuggestion && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                <Sparkles className="h-4 w-4 text-primary shrink-0" />
                <div className="flex-1 text-xs">
                  <p className="font-medium text-foreground">
                    AI Suggested: <span className="text-primary font-bold">${aiPriceSuggestion}</span>
                  </p>
                  <p className="text-muted-foreground">
                    {routeInfo!.distanceKm} km · {routeInfo!.durationHours}h · Based on route, weight & equipment
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-[10px] h-6 px-2"
                  onClick={() => updateField('price', String(aiPriceSuggestion))}
                >
                  Apply
                </Button>
              </motion.div>
            )}
          </CardContent>
        </Card>

        {/* Schedule & Price */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs" htmlFor="pickup_date">Pickup Date</Label>
                <Input id="pickup_date" type="date" required value={draft.pickup_date} onChange={(e) => updateField('pickup_date', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs" htmlFor="pickup_time">Pickup Time</Label>
                <Input id="pickup_time" type="time" value={draft.pickup_time || ''} onChange={(e) => updateField('pickup_time', e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs" htmlFor="price">Budget (USD)</Label>
                <Input id="price" type="number" step="0.01" placeholder="Auto-calculated" required value={draft.price} onChange={(e) => updateField('price', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs" htmlFor="weight_lbs">Weight (kg)</Label>
                <Input id="weight_lbs" type="number" placeholder="Optional" value={draft.weight_lbs} onChange={(e) => updateField('weight_lbs', e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Equipment & Options */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Equipment / Truck Type</Label>
                {truckSuggestion && truckSuggestion !== draft.equipment_type && (
                  <button
                    type="button"
                    className="flex items-center gap-1 text-[10px] text-primary font-medium hover:underline"
                    onClick={() => updateField('equipment_type', truckSuggestion)}
                  >
                    <Truck className="h-3 w-3" /> AI suggests: {truckSuggestion}
                  </button>
                )}
              </div>
              <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={draft.equipment_type} onChange={(e) => updateField('equipment_type', e.target.value)}>
                <option value="">Select truck type</option>
                <option value="Flatbed">Flatbed</option>
                <option value="Enclosed">Enclosed / Box Body</option>
                <option value="Refrigerated">Refrigerated (Reefer)</option>
                <option value="Tanker">Tanker</option>
                <option value="Lowbed">Lowbed / Low Loader</option>
                <option value="Tipper">Tipper / Dump Truck</option>
                <option value="Curtain-side">Curtain-side</option>
                <option value="Container">Container Carrier</option>
                <option value="Car Carrier">Car Carrier</option>
                <option value="Livestock">Livestock Carrier</option>
                <option value="Logging">Logging Truck</option>
                <option value="Side Loader">Side Loader</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Load Type</Label>
                <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={draft.load_type} onChange={(e) => updateField('load_type', e.target.value)}>
                  <option value="FTL">Full Truck Load</option>
                  <option value="LTL">Less Than Truckload</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Payment</Label>
                <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={draft.payment_method} onChange={(e) => updateField('payment_method', e.target.value)}>
                  <option value="cash">Cash</option>
                  <option value="transfer">Bank Transfer</option>
                  <option value="ecocash">EcoCash</option>
                </select>
              </div>
            </div>

            {/* Urgent toggle */}
            <div className="flex items-center justify-between rounded-lg border border-input p-3">
              <div>
                <p className="text-sm font-medium">🚨 Urgent Shipment</p>
                <p className="text-xs text-muted-foreground">Priority handling needed</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={draft.urgent === 'true'} onChange={(e) => updateField('urgent', e.target.checked ? 'true' : 'false')} />
                <div className="w-11 h-6 bg-muted rounded-full peer peer-checked:bg-destructive after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-background after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Cargo Photos */}
        <Card>
          <CardContent className="p-4">
            <CargoPhotoUpload photos={cargoPhotos} onPhotosChange={setCargoPhotos} />
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex gap-2 pb-4">
          <Button type="submit" className="flex-1" disabled={createLoad.isPending}>
            <Plus className="mr-1.5 h-4 w-4" />
            {createLoad.isPending ? 'Posting...' : 'Post Load'}
          </Button>
          {hasDraft && (
            <Button type="button" variant="outline" size="sm" onClick={clearDraft}>
              Clear Draft
            </Button>
          )}
        </div>
      </form>
    </motion.div>
  );
}
