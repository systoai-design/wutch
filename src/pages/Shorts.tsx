import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Heart, MessageCircle, Share2, Wallet } from 'lucide-react';
import DonationModal from '@/components/DonationModal';

const mockShorts = [
  {
    id: '1',
    videoUrl: 'https://example.com/short1.mp4',
    title: 'Quick crypto tip! 🚀',
    creator: 'CryptoKing',
    creatorAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop',
    walletAddress: 'CryptoKing1234567890abcdef',
    likes: 1234,
    comments: 89,
  },
  {
    id: '2',
    videoUrl: 'https://example.com/short2.mp4',
    title: 'NFT alpha drop 👀',
    creator: 'NFTQueen',
    creatorAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop',
    walletAddress: 'NFTQueen1234567890abcdef',
    likes: 2341,
    comments: 156,
  },
];

const Shorts = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDonationModalOpen, setIsDonationModalOpen] = useState(false);
  const currentShort = mockShorts[currentIndex];

  return (
    <div className="h-[calc(100vh-4rem)] bg-background overflow-hidden">
      <div className="relative h-full max-w-md mx-auto">
        {/* Video Container */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-background flex items-center justify-center">
          <div className="text-center">
            <p className="text-muted-foreground mb-2">Short video player</p>
            <p className="text-xs text-muted-foreground">Swipe/scroll for next</p>
          </div>
        </div>

        {/* Overlay Controls */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background to-transparent">
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-2">{currentShort.title}</h3>
                <div className="flex items-center gap-2">
                  <img
                    src={currentShort.creatorAvatar}
                    alt={currentShort.creator}
                    className="w-8 h-8 rounded-full"
                  />
                  <span className="font-medium">{currentShort.creator}</span>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <Button variant="ghost" size="icon" className="rounded-full h-12 w-12">
                  <Heart className="h-6 w-6" />
                  <span className="sr-only">Like</span>
                </Button>
                <span className="text-xs text-center">{currentShort.likes}</span>

                <Button variant="ghost" size="icon" className="rounded-full h-12 w-12">
                  <MessageCircle className="h-6 w-6" />
                  <span className="sr-only">Comment</span>
                </Button>
                <span className="text-xs text-center">{currentShort.comments}</span>

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
          {mockShorts.map((_, index) => (
            <div
              key={index}
              className={`h-1 flex-1 rounded-full transition-colors ${
                index === currentIndex ? 'bg-primary' : 'bg-muted'
              }`}
            />
          ))}
        </div>
      </div>

      <DonationModal
        isOpen={isDonationModalOpen}
        onClose={() => setIsDonationModalOpen(false)}
        streamerName={currentShort.creator}
        walletAddress={currentShort.walletAddress}
      />
    </div>
  );
};

export default Shorts;
