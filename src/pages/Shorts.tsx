import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Heart, MessageCircle, Share2, Wallet } from 'lucide-react';
import DonationModal from '@/components/DonationModal';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

type ShortVideo = Database['public']['Tables']['short_videos']['Row'] & {
  profiles?: Pick<Database['public']['Tables']['profiles']['Row'], 
    'username' | 'display_name' | 'avatar_url' | 'wallet_address'>;
};

const Shorts = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDonationModalOpen, setIsDonationModalOpen] = useState(false);
  const [shorts, setShorts] = useState<ShortVideo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const currentShort = shorts[currentIndex];

  useEffect(() => {
    document.title = 'Shorts - Quick Videos | Wutch';
    fetchShorts();
  }, []);

  const fetchShorts = async () => {
    try {
      const { data, error } = await supabase
        .from('short_videos')
        .select(`
          *,
          profiles!short_videos_user_id_fkey(username, display_name, avatar_url, wallet_address)
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

  if (isLoading) {
    return (
      <div className="h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (shorts.length === 0) {
    return (
      <div className="h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-2">No shorts available yet</p>
          <Button onClick={() => window.location.href = '/submit'}>Upload First Short</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] bg-background overflow-hidden">
      <div className="relative h-full max-w-md mx-auto">
        {/* Video Container */}
        <div className="absolute inset-0 bg-black flex items-center justify-center">
          <video
            src={currentShort.video_url}
            className="w-full h-full object-contain"
            controls
            autoPlay
            loop
            playsInline
          />
        </div>

        {/* Overlay Controls */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background to-transparent">
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-2">{currentShort.title}</h3>
                <div className="flex items-center gap-2">
                  {currentShort.profiles?.avatar_url && (
                    <img
                      src={currentShort.profiles.avatar_url}
                      alt={currentShort.profiles.username || 'User'}
                      className="w-8 h-8 rounded-full"
                    />
                  )}
                  <span className="font-medium">
                    {currentShort.profiles?.display_name || currentShort.profiles?.username || 'Anonymous'}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <Button variant="ghost" size="icon" className="rounded-full h-12 w-12">
                  <Heart className="h-6 w-6" />
                  <span className="sr-only">Like</span>
                </Button>
                <span className="text-xs text-center">{currentShort.like_count || 0}</span>

                <Button variant="ghost" size="icon" className="rounded-full h-12 w-12">
                  <MessageCircle className="h-6 w-6" />
                  <span className="sr-only">Comment</span>
                </Button>
                <span className="text-xs text-center">0</span>

                <Button variant="ghost" size="icon" className="rounded-full h-12 w-12">
                  <Share2 className="h-6 w-6" />
                  <span className="sr-only">Share</span>
                </Button>

                <Button
                  variant="donation"
                  size="icon"
                  className="rounded-full h-12 w-12"
                  onClick={() => setIsDonationModalOpen(true)}
                >
                  <Wallet className="h-6 w-6" />
                  <span className="sr-only">Donate</span>
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Indicators */}
        <div className="absolute top-4 left-0 right-0 flex justify-center gap-1 px-4">
          {shorts.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`h-1 flex-1 rounded-full transition-colors ${
                index === currentIndex ? 'bg-primary' : 'bg-muted'
              }`}
            />
          ))}
        </div>
      </div>

      {currentShort.profiles?.wallet_address && (
        <DonationModal
          isOpen={isDonationModalOpen}
          onClose={() => setIsDonationModalOpen(false)}
          streamerName={currentShort.profiles?.display_name || currentShort.profiles?.username || 'Creator'}
          walletAddress={currentShort.profiles.wallet_address}
        />
      )}
    </div>
  );
};

export default Shorts;
