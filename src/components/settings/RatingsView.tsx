import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Star } from 'lucide-react';

export default function RatingsView({ onBack, role }: { onBack?: () => void; role: 'shipper' | 'driver' }) {
  const { user } = useAuth();
  const field = role === 'driver' ? 'reviewed_id' : 'reviewer_id';

  const { data: reviews, isLoading } = useQuery({
    queryKey: ['my-reviews', user?.id, role],
    queryFn: async () => {
      const { data, error } = await supabase.from('reviews').select('*').eq(field, user!.id).order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const avgRating = reviews?.length ? (reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / reviews.length).toFixed(1) : '—';

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">{role === 'driver' ? 'My Ratings' : 'Shipper Ratings'}</h2>
      <Card>
        <CardContent className="p-5 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Star className="h-6 w-6 fill-primary text-primary" />
            <span className="text-3xl font-bold">{avgRating}</span>
          </div>
          <p className="text-sm text-muted-foreground">{reviews?.length || 0} reviews</p>
        </CardContent>
      </Card>
      {isLoading ? (
        <div className="flex justify-center py-8"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
      ) : !reviews?.length ? (
        <p className="text-center text-sm text-muted-foreground py-6">No reviews yet</p>
      ) : (
        reviews.map((r: any) => (
          <Card key={r.id}>
            <CardContent className="p-4">
              <div className="flex items-center gap-1 mb-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className={`h-3.5 w-3.5 ${i < r.rating ? 'fill-primary text-primary' : 'text-muted-foreground/30'}`} />
                ))}
              </div>
              {r.comment && <p className="text-sm text-muted-foreground">{r.comment}</p>}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
