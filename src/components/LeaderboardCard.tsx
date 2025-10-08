import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { Trophy, Medal, Award } from 'lucide-react';
import { Link } from 'react-router-dom';

interface LeaderboardEntry {
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  rank: number;
  primaryValue: number;
  primaryLabel: string;
  secondaryText?: string;
}

interface LeaderboardCardProps {
  entry: LeaderboardEntry;
}

export function LeaderboardCard({ entry }: LeaderboardCardProps) {
  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="h-5 w-5 text-yellow-500" />;
    if (rank === 2) return <Medal className="h-5 w-5 text-gray-400" />;
    if (rank === 3) return <Award className="h-5 w-5 text-amber-600" />;
    return <span className="text-sm font-semibold text-muted-foreground">#{rank}</span>;
  };

  const formatSOL = (amount: number) => {
    return `${amount.toFixed(3)} SOL`;
  };

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
          <h3 className="font-semibold truncate">{entry.display_name}</h3>
          <p className="text-sm text-muted-foreground truncate">@{entry.username}</p>
          {entry.secondaryText && (
            <p className="text-xs text-muted-foreground">{entry.secondaryText}</p>
          )}
        </div>

        <div className="text-right">
          <p className="text-xs text-muted-foreground">{entry.primaryLabel}</p>
          <p className="text-lg font-bold text-primary">{formatSOL(entry.primaryValue)}</p>
        </div>
      </Link>
    </Card>
  );
}
