import { Link } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Users, UserPlus, UserCheck, Coins } from "lucide-react";
import { formatFollowerCount } from "@/utils/formatters";
import { useFollow } from "@/hooks/useFollow";
import DonationModal from "@/components/DonationModal";
import GuestPromptDialog from "@/components/GuestPromptDialog";
import { useState } from "react";
import { VerificationBadge } from "@/components/VerificationBadge";
import { UserBadges } from '@/components/UserBadges';
import { useUserRoles } from '@/hooks/useUserRoles';

interface CreatorCardProps {
  profile: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    banner_url: string | null;
    bio: string | null;
    follower_count: number;
    is_verified: boolean;
    verification_type?: string | null;
    public_wallet_address: string | null;
  };
}

export function CreatorCard({ profile }: CreatorCardProps) {
  const displayName = profile.display_name || profile.username;
  const bannerStyle = profile.banner_url
    ? { backgroundImage: `url(${profile.banner_url})` }
    : { background: 'linear-gradient(135deg, hsl(var(--primary) / 0.3), hsl(var(--accent) / 0.3))' };
  
  const { isFollowing, isLoading: followLoading, toggleFollow, showGuestDialog, setShowGuestDialog } = useFollow(profile.id);
  const [showDonation, setShowDonation] = useState(false);
  const { isAdmin, isModerator } = useUserRoles(profile.id);

  return (
    <>
      <Card className="overflow-hidden hover:shadow-lg transition-all duration-300 group">
        <Link to={`/profile/${profile.username}`}>
          {/* Banner Background */}
          <div
            className="relative h-32 bg-cover bg-center"
            style={bannerStyle}
          >
            {/* Gradient Overlay for text readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/50 to-transparent" />
            
            {/* Avatar positioned at bottom */}
            <div className="absolute -bottom-8 left-4">
              <Avatar className="h-16 w-16 border-4 border-background ring-2 ring-primary/20 group-hover:ring-primary/40 transition-all">
                <AvatarImage src={profile.avatar_url || undefined} alt={displayName} />
                <AvatarFallback className="bg-primary text-primary-foreground font-semibold text-lg">
                  {displayName.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </div>
          </div>
        </Link>

        {/* Content */}
        <div className="pt-10 px-4 pb-4">
          <Link to={`/profile/${profile.username}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-lg truncate group-hover:text-primary transition-colors">
                    {displayName}
                  </h3>
                  <UserBadges
                    userId={profile.id}
                    verificationType={profile.verification_type as 'blue' | 'red' | 'none' | null}
                    isAdmin={isAdmin}
                    isModerator={isModerator}
                    size="md"
                  />
                </div>
                <p className="text-sm text-muted-foreground truncate">
                  @{profile.username}
                </p>
              </div>
            </div>

            {/* Bio */}
            {profile.bio && (
              <p className="text-sm text-muted-foreground line-clamp-2 mt-2">
                {profile.bio}
              </p>
            )}

            {/* Follower Count */}
            <div className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span className="font-medium">{formatFollowerCount(profile.follower_count)}</span>
              <span>followers</span>
            </div>
          </Link>

          {/* Action Buttons */}
          <div className="mt-4 flex gap-2">
            <Button
              onClick={(e) => {
                e.preventDefault();
                toggleFollow();
              }}
              disabled={followLoading}
              variant={isFollowing ? "outline" : "default"}
              size="sm"
              className="flex-1"
            >
              {isFollowing ? (
                <>
                  <UserCheck className="h-4 w-4 mr-2" />
                  Following
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Follow
                </>
              )}
            </Button>
            <Button
              onClick={(e) => {
                e.preventDefault();
                setShowDonation(true);
              }}
              variant="outline"
              size="sm"
              className="flex-1"
              disabled={!profile.public_wallet_address}
              title={!profile.public_wallet_address ? "Creator hasn't set up donations" : ""}
            >
              <Coins className="h-4 w-4 mr-2" />
              Donate SOL
            </Button>
          </div>
        </div>
      </Card>

      <GuestPromptDialog 
        open={showGuestDialog} 
        onOpenChange={setShowGuestDialog}
        action="follow"
      />

      {profile.public_wallet_address && (
        <DonationModal
          isOpen={showDonation}
          onClose={() => setShowDonation(false)}
          streamerName={displayName}
          walletAddress={profile.public_wallet_address}
          contentId={profile.id}
          contentType="livestream"
          recipientUserId={profile.id}
        />
      )}
    </>
  );
}
