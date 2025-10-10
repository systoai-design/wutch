import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { Trophy, Medal, Award } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import { UserBadges } from '@/components/UserBadges';
import { useUserRoles } from '@/hooks/useUserRoles';

interface LeaderboardEntry {
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  verification_type: 'blue' | 'red' | 'none' | null;
  is_verified: boolean;
  rank: number;
  primaryValue: number;
  primaryLabel: string;
  secondaryText?: string;
}

interface LeaderboardCardProps {
  entry: LeaderboardEntry;
}

export function LeaderboardCard({ entry }: LeaderboardCardProps) {
  const isMobile = useIsMobile();
  const { isAdmin, isModerator } = useUserRoles(entry.user_id);

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="h-5 w-5 text-yellow-500" />;
    if (rank === 2) return <Medal className="h-5 w-5 text-gray-400" />;
    if (rank === 3) return <Award className="h-5 w-5 text-amber-600" />;
    return <span className="text-sm font-semibold text-muted-foreground">#{rank}</span>;
  };

  const formatSOL = (amount: number) => {
    return `${amount.toFixed(3)} SOL`;
  };

  // Mobile Layout
  if (isMobile) {
    return (
      <Card className="p-3 hover:shadow-md transition-shadow">
        <Link to={`/profile/${entry.username}`} className="block">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 flex justify-center flex-shrink-0">
              {getRankIcon(entry.rank)}
            </div>
            <Avatar className="h-10 w-10 flex-shrink-0">
              <AvatarImage src={entry.avatar_url || undefined} />
              <AvatarFallback>
                {entry.username.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="font-semibold truncate text-sm">{entry.display_name}</h3>
                <UserBadges 
                  userId={entry.user_id}
                  verificationType={entry.verification_type}
                  isAdmin={isAdmin}
                  isModerator={isModerator}
                  size="sm"
                  showTooltip={false}
                />
              </div>
              <p className="text-xs text-muted-foreground truncate">@{entry.username}</p>
            </div>
          </div>
          
          <div className="flex items-center justify-between ml-11 pt-1 border-t border-border/50">
            <span className="text-xs font-bold text-primary">{formatSOL(entry.primaryValue)}</span>
            {entry.secondaryText && (
              <span className="text-xs text-muted-foreground truncate ml-2">{entry.secondaryText}</span>
            )}
          </div>
        </Link>
      </Card>
    );
  }

  // Desktop/Tablet Layout
  return (
    <Card className="p-4 hover:shadow-lg transition-all hover:scale-[1.02]">
      <Link to={`/profile/${entry.username}`} className="flex items-center gap-4">
        <div className="flex items-center justify-center w-12">
          {getRankIcon(entry.rank)}
        </div>
        
        <Avatar className="h-12 w-12">
          <AvatarImage src={entry.avatar_url || undefined} />
          <AvatarFallback>
            {entry.username.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold truncate">{entry.display_name}</h3>
            <UserBadges 
              userId={entry.user_id}
              verificationType={entry.verification_type}
              isAdmin={isAdmin}
              isModerator={isModerator}
              size="md"
              showTooltip={true}
            />
          </div>
          <p className="text-sm text-muted-foreground truncate">@{entry.username}</p>
          {entry.secondaryText && (
            <p className="text-xs text-muted-foreground truncate">{entry.secondaryText}</p>
          )}
        </div>

        <div className="text-right flex-shrink-0">
          <p className="text-xs text-muted-foreground">{entry.primaryLabel}</p>
          <p className="text-lg font-bold text-primary">{formatSOL(entry.primaryValue)}</p>
        </div>
      </Link>
    </Card>
  );
}
