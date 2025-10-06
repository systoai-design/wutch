import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { ShortCard } from '@/components/ShortCard';
import { ShortVideoModal } from '@/components/ShortVideoModal';
import { Skeleton } from '@/components/ui/skeleton';

type ShortVideo = Database['public']['Tables']['short_videos']['Row'] & {
  profiles?: Pick<Database['public']['Tables']['profiles']['Row'], 
    'username' | 'display_name' | 'avatar_url' | 'public_wallet_address'>;
};

const Shorts = () => {
  const [shorts, setShorts] = useState<ShortVideo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDonationModalOpen, setIsDonationModalOpen] = useState(false);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedShort, setSelectedShort] = useState<ShortVideo | null>(null);
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    document.title = 'Shorts | Wutch';
    fetchShorts();
  }, []);

  useEffect(() => {
    if (shorts.length > 0) {
      fetchCommentCounts();
    }
  }, [shorts]);

  const fetchShorts = async () => {
    try {
      const { data, error } = await supabase
        .from('short_videos')
        .select(`
          *,
          profiles!short_videos_user_id_fkey (username, display_name, avatar_url, public_wallet_address)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setShorts(data || []);
    } catch (error) {
      console.error('Error fetching shorts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCommentCounts = async () => {
    try {
      const counts: Record<string, number> = {};
      for (const short of shorts) {
        const { count } = await supabase
          .from('comments')
          .select('*', { count: 'exact', head: true })
          .eq('content_id', short.id)
          .eq('content_type', 'shortvideo');
        
        counts[short.id] = count || 0;
      }
      setCommentCounts(counts);
    } catch (error) {
      console.error('Error fetching comment counts:', error);
    }
  };

  const handleShortClick = (shortId: string) => {
    const short = shorts.find(s => s.id === shortId);
    if (short) {
      setSelectedShort(short);
      setIsModalOpen(true);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen pb-20 lg:pb-6">
        <div className="p-4">
          <Skeleton className="h-10 w-48 mb-6" />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 md:gap-4">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="aspect-[9/16] w-full rounded-lg" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (shorts.length === 0) {
    return (
      <div className="min-h-screen pb-20 lg:pb-6 flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-muted-foreground">No shorts available</p>
          <p className="text-sm text-muted-foreground mt-2">Be the first to upload!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 lg:pb-6">
      <div className="p-4">
        <h1 className="text-3xl font-bold mb-6">Shorts</h1>
        
        {/* 2-column grid on mobile, 3+ on desktop */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 md:gap-4">
          {shorts.map((short) => (
            <ShortCard 
              key={short.id} 
              short={short} 
              onClick={() => handleShortClick(short.id)}
            />
          ))}
        </div>
      </div>

      {/* Modal for fullscreen playback */}
      {selectedShort && (
        <ShortVideoModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedShort(null);
          }}
          short={selectedShort}
          onOpenDonation={() => setIsDonationModalOpen(true)}
          onOpenComments={() => setIsCommentsOpen(true)}
          commentCount={commentCounts[selectedShort.id] || 0}
          canDelete={false}
        />
      )}
    </div>
  );
};

export default Shorts;
