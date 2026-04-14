import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, DollarSign, MapPin, TrendingUp, Truck, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import SubHeader from '@/components/SubHeader';

export default function AdminDashboard() {
  const { user } = useAuth();

  const { data: routeAnalytics } = useQuery({
    queryKey: ['admin-route-analytics'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('loads')
        .select('pickup_location, delivery_location, price, status, created_at');
      if (error) throw error;
      const routeMap: Record<string, { prices: number[]; count: number }> = {};
      data?.forEach((load: any) => {
        const route = `${load.pickup_location} → ${load.delivery_location}`;
        if (!routeMap[route]) routeMap[route] = { prices: [], count: 0 };
        routeMap[route].prices.push(Number(load.price));
        routeMap[route].count++;
      });
      return Object.entries(routeMap)
        .map(([route, stats]) => ({
          route,
          avgPrice: stats.prices.reduce((a, b) => a + b, 0) / stats.prices.length,
          count: stats.count,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
    },
  });

  const { data: stats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const { count: totalLoads } = await supabase.from('loads').select('*', { count: 'exact', head: true });
      const { count: activeLoads } = await supabase.from('loads').select('*', { count: 'exact', head: true }).in('status', ['posted', 'accepted', 'in_transit']);
      const { count: totalUsers } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
      const { data: revenue } = await supabase.from('loads').select('platform_fee').eq('status', 'delivered');
      const totalRevenue = revenue?.reduce((sum: number, l: any) => sum + (Number(l.platform_fee) || 0), 0) || 0;
      return { totalLoads: totalLoads || 0, activeLoads: activeLoads || 0, totalUsers: totalUsers || 0, totalRevenue };
    },
  });

  const statCards = [
    { label: 'Total Loads', value: stats?.totalLoads ?? '—', icon: Truck, color: 'text-primary' },
    { label: 'Active Loads', value: stats?.activeLoads ?? '—', icon: BarChart3, color: 'text-warning' },
    { label: 'Users', value: stats?.totalUsers ?? '—', icon: Users, color: 'text-success' },
    { label: 'Revenue', value: stats ? `$${stats.totalRevenue.toFixed(2)}` : '—', icon: DollarSign, color: 'text-primary' },
  ];

  return (
    <div className="min-h-screen bg-background">
      <SubHeader title="Hauliq Admin" backTo="/" />
      <main className="container py-6 space-y-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {statCards.map((stat, i) => (
            <motion.div key={stat.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: i * 0.08 }}>
              <Card>
                <CardContent className="flex items-center gap-3 p-4">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-muted ${stat.color}`}>
                    <stat.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold tabular-nums">{stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-primary" /> Top Routes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {routeAnalytics?.length ? routeAnalytics.map((route, i) => (
              <motion.div key={route.route} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.06 }}
                className="flex items-center justify-between rounded-lg border border-border p-3">
                <div className="flex items-center gap-2 min-w-0">
                  <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium truncate">{route.route}</span>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground shrink-0">
                  <span className="tabular-nums">{route.count} loads</span>
                  <span className="tabular-nums font-medium text-foreground">${route.avgPrice.toFixed(0)} avg</span>
                </div>
              </motion.div>
            )) : (
              <p className="text-sm text-muted-foreground text-center py-8">No route data yet</p>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
