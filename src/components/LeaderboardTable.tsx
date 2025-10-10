import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Trophy, Medal, Award } from 'lucide-react';
import { UserBadges } from '@/components/UserBadges';
import { useUserRoles } from '@/hooks/useUserRoles';

interface LeaderboardEntry {
  user_id: string;
  verification_type?: 'blue' | 'red' | 'none' | null;
  is_verified?: boolean;
  total_earned: number;
  claims_count: number;
  profile?: {
    username: string;
    display_name: string;
    avatar_url: string | null;
  };
}

interface LeaderboardTableProps {
  entries: LeaderboardEntry[];
}

function LeaderboardRow({ entry, index }: { entry: LeaderboardEntry; index: number }) {
  const { isAdmin, isModerator } = useUserRoles(entry.user_id);
  
  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="w-5 h-5 text-yellow-500" />;
      case 2:
        return <Medal className="w-5 h-5 text-gray-400" />;
      case 3:
        return <Award className="w-5 h-5 text-amber-600" />;
      default:
        return <span className="text-muted-foreground font-semibold w-5 text-center">#{rank}</span>;
    }
  };

  return (
    <div className="flex items-center gap-4 p-3 rounded-lg hover:bg-accent/50 transition-colors">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="flex-shrink-0 w-8 flex justify-center">
          {getRankIcon(index + 1)}
        </div>
        <Avatar className="h-10 w-10 flex-shrink-0">
          <AvatarImage src={entry.profile?.avatar_url || ''} />
          <AvatarFallback>{entry.profile?.display_name?.[0] || 'U'}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 flex items-center gap-2">
          <div>
            <p className="font-medium truncate">{entry.profile?.display_name || 'User'}</p>
            <p className="text-sm text-muted-foreground truncate">
              @{entry.profile?.username || 'unknown'}
            </p>
          </div>
          <UserBadges
            userId={entry.user_id}
            verificationType={entry.verification_type}
            isAdmin={isAdmin}
            isModerator={isModerator}
            size="sm"
          />
        </div>
      </div>
      
      <div className="flex items-center gap-3 flex-shrink-0">
        <Badge variant="secondary" className="font-mono">
          {entry.total_earned.toFixed(2)} SOL
        </Badge>
        <span className="text-sm text-muted-foreground">
          {entry.claims_count} {entry.claims_count === 1 ? 'claim' : 'claims'}
        </span>
      </div>
    </div>
  );
}

export function LeaderboardTable({ entries }: LeaderboardTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="w-5 h-5" />
          Top Earners
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {entries.map((entry, index) => (
            <LeaderboardRow key={entry.user_id} entry={entry} index={index} />
          ))}
          
          {entries.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No claims yet. Be the first to earn!
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
