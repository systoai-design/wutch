import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { BountyCard } from '@/components/BountyCard';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Filter } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function Bounties() {
  const navigate = useNavigate();
  const [bounties, setBounties] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortBy, setSortBy] = useState('highest_reward');

  useEffect(() => {
    document.title = 'Browse All Bounties | Wutch';
    fetchBounties();
  }, [sortBy]);

  const fetchBounties = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('stream_bounties')
        .select(`
          *,
          livestream:livestreams(title, thumbnail_url),
          creator:profiles!stream_bounties_creator_id_fkey(username, display_name, avatar_url)
        `)
        .eq('is_active', true);

      // Apply sorting
      switch (sortBy) {
        case 'highest_reward':
          query = query.order('reward_per_participant', { ascending: false });
          break;
        case 'ending_soon':
          query = query.order('expires_at', { ascending: true, nullsFirst: false });
          break;
        case 'newest':
          query = query.order('created_at', { ascending: false });
          break;
        case 'most_spots':
          query = query.order('participant_limit', { ascending: false });
          break;
      }

      const { data, error } = await query;

      if (error) throw error;
      setBounties(data || []);
    } catch (error) {
      console.error('Error fetching bounties:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => navigate('/')}
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-3xl font-bold">Browse All Bounties</h1>
                <p className="text-muted-foreground">
                  Watch streams, earn crypto rewards
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="highest_reward">Highest Reward</SelectItem>
                  <SelectItem value="ending_soon">Ending Soon</SelectItem>
                  <SelectItem value="newest">Newest</SelectItem>
                  <SelectItem value="most_spots">Most Spots</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-64 bg-accent/20 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : bounties.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-xl text-muted-foreground">No active bounties at the moment</p>
            <p className="text-sm text-muted-foreground mt-2">Check back later for new opportunities!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {bounties.map((bounty) => (
              <BountyCard key={bounty.id} bounty={bounty} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
