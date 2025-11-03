import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Edit2, Users, DollarSign } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface SubscriptionTier {
  id: string;
  tier_name: string;
  tier_description: string | null;
  price_monthly: number;
  access_level: string;
  is_active: boolean;
  created_at: string;
  subscriber_count?: number;
}

export function SubscriptionTierManager() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tiers, setTiers] = useState<SubscriptionTier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTier, setEditingTier] = useState<SubscriptionTier | null>(null);

  const [formData, setFormData] = useState({
    tier_name: '',
    tier_description: '',
    price_monthly: '',
    access_level: 'all_content',
    is_active: true,
  });

  useEffect(() => {
    if (user) {
      fetchTiers();
    }
  }, [user]);

  const fetchTiers = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('creator_subscriptions')
        .select('*')
        .eq('creator_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch subscriber counts for each tier
      const tiersWithCounts = await Promise.all(
        (data || []).map(async (tier) => {
          const { count } = await supabase
            .from('user_subscriptions')
            .select('*', { count: 'exact', head: true })
            .eq('subscription_id', tier.id)
            .eq('is_active', true)
            .gt('expires_at', new Date().toISOString());

          return { ...tier, subscriber_count: count || 0 };
        })
      );

      setTiers(tiersWithCounts);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to load subscription tiers',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) return;

    try {
      const tierData = {
        creator_id: user.id,
        tier_name: formData.tier_name,
        tier_description: formData.tier_description || null,
        price_monthly: parseFloat(formData.price_monthly),
        access_level: formData.access_level,
        is_active: formData.is_active,
      };

      if (editingTier) {
        const { error } = await supabase
          .from('creator_subscriptions')
          .update(tierData)
          .eq('id', editingTier.id);

        if (error) throw error;

        toast({
          title: 'Success',
          description: 'Subscription tier updated successfully',
        });
      } else {
        const { error } = await supabase
          .from('creator_subscriptions')
          .insert([tierData]);

        if (error) throw error;

        toast({
          title: 'Success',
          description: 'Subscription tier created successfully',
        });
      }

      setDialogOpen(false);
      resetForm();
      fetchTiers();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save subscription tier',
        variant: 'destructive',
      });
    }
  };

  const handleEdit = (tier: SubscriptionTier) => {
    setEditingTier(tier);
    setFormData({
      tier_name: tier.tier_name,
      tier_description: tier.tier_description || '',
      price_monthly: tier.price_monthly.toString(),
      access_level: tier.access_level,
      is_active: tier.is_active,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (tierId: string) => {
    if (!confirm('Are you sure you want to delete this tier? Current subscribers will keep their access until expiration.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('creator_subscriptions')
        .delete()
        .eq('id', tierId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Subscription tier deleted',
      });

      fetchTiers();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete tier',
        variant: 'destructive',
      });
    }
  };

  const resetForm = () => {
    setFormData({
      tier_name: '',
      tier_description: '',
      price_monthly: '',
      access_level: 'all_content',
      is_active: true,
    });
    setEditingTier(null);
  };

  const getAccessLevelLabel = (level: string) => {
    const labels: Record<string, string> = {
      all_content: 'All Content',
      streams_only: 'Livestreams Only',
      videos_only: 'Videos Only',
      shorts_only: 'Shorts Only',
    };
    return labels[level] || level;
  };

  if (isLoading) {
    return <div className="animate-pulse space-y-4">Loading subscription tiers...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Subscription Tiers</h2>
          <p className="text-muted-foreground">
            Offer monthly subscriptions for fans to access your premium content
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create Tier
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingTier ? 'Edit' : 'Create'} Subscription Tier</DialogTitle>
              <DialogDescription>
                Set up a monthly subscription tier for your fans
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="tier_name">Tier Name</Label>
                <Input
                  id="tier_name"
                  value={formData.tier_name}
                  onChange={(e) => setFormData({ ...formData, tier_name: e.target.value })}
                  placeholder="e.g., Basic, Premium, VIP"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tier_description">Description</Label>
                <Textarea
                  id="tier_description"
                  value={formData.tier_description}
                  onChange={(e) => setFormData({ ...formData, tier_description: e.target.value })}
                  placeholder="Describe what subscribers get..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="price_monthly">Monthly Price (SOL)</Label>
                <Input
                  id="price_monthly"
                  type="number"
                  step="0.0001"
                  min="0.0001"
                  value={formData.price_monthly}
                  onChange={(e) => setFormData({ ...formData, price_monthly: e.target.value })}
                  placeholder="0.1"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="access_level">Content Access</Label>
                <Select
                  value={formData.access_level}
                  onValueChange={(value) => setFormData({ ...formData, access_level: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all_content">All Premium Content</SelectItem>
                    <SelectItem value="streams_only">Livestreams Only</SelectItem>
                    <SelectItem value="videos_only">Videos Only</SelectItem>
                    <SelectItem value="shorts_only">Shorts Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="is_active">Active</Label>
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
              </div>

              <div className="flex gap-2">
                <Button type="submit" className="flex-1">
                  {editingTier ? 'Update' : 'Create'} Tier
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setDialogOpen(false);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {tiers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <DollarSign className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              No subscription tiers yet. Create your first tier to start earning recurring revenue!
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {tiers.map((tier) => (
            <Card key={tier.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {tier.tier_name}
                      {!tier.is_active && (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </CardTitle>
                    <CardDescription className="mt-2">
                      {tier.tier_description || 'No description'}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(tier)}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(tier.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold">{tier.price_monthly} SOL</span>
                  <span className="text-sm text-muted-foreground">/month</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Badge variant="outline">{getAccessLevelLabel(tier.access_level)}</Badge>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Users className="w-4 h-4" />
                  <span>{tier.subscriber_count || 0} active subscribers</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
