import { Link } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { CheckCircle2, Users } from "lucide-react";
import { formatFollowerCount } from "@/utils/formatters";

interface CreatorCardProps {
  profile: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    banner_url: string | null;
    follower_count: number;
    is_verified: boolean;
  };
}

export function CreatorCard({ profile }: CreatorCardProps) {
  const displayName = profile.display_name || profile.username;
  const bannerStyle = profile.banner_url
    ? { backgroundImage: `url(${profile.banner_url})` }
    : { background: 'linear-gradient(135deg, hsl(var(--primary) / 0.3), hsl(var(--accent) / 0.3))' };

  return (
    <Link to={`/profile/${profile.username}`}>
      <Card className="overflow-hidden hover:shadow-lg transition-all duration-300 hover:scale-[1.02] group">
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

        {/* Content */}
        <div className="pt-10 px-4 pb-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-lg truncate group-hover:text-primary transition-colors">
                  {displayName}
                </h3>
                {profile.is_verified && (
                  <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                )}
              </div>
              <p className="text-sm text-muted-foreground truncate">
                @{profile.username}
              </p>
            </div>
          </div>

          {/* Follower Count */}
          <div className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            <span className="font-medium">{formatFollowerCount(profile.follower_count)}</span>
            <span>followers</span>
          </div>
        </div>
      </Card>
    </Link>
  );
}
