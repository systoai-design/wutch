import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trophy, Medal, Award } from "lucide-react";
import type { TopSharer } from "@/hooks/useTopSharers";
import { formatDistanceToNow } from "date-fns";

interface TopSharersLeaderboardProps {
  sharers: TopSharer[];
}

export const TopSharersLeaderboard = ({ sharers }: TopSharersLeaderboardProps) => {
  const getRankIcon = (index: number) => {
    switch (index) {
      case 0:
        return <Trophy className="h-5 w-5 text-yellow-500" />;
      case 1:
        return <Medal className="h-5 w-5 text-gray-400" />;
      case 2:
        return <Award className="h-5 w-5 text-amber-600" />;
      default:
        return <span className="text-muted-foreground font-semibold">#{index + 1}</span>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Sharers</CardTitle>
      </CardHeader>
      <CardContent>
        {sharers.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No shares yet
          </p>
        ) : (
          <div className="space-y-4">
            {sharers.map((sharer, index) => (
              <div
                key={sharer.user_id}
                className="flex items-center gap-4 p-3 rounded-lg hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center justify-center w-10">
                  {getRankIcon(index)}
                </div>
                
                <Avatar className="h-12 w-12">
                  <AvatarImage src={sharer.avatar_url || undefined} />
                  <AvatarFallback>
                    {sharer.display_name?.charAt(0) || sharer.username?.charAt(0) || '?'}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">
                    {sharer.display_name || sharer.username}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    @{sharer.username}
                  </p>
                </div>

                <div className="text-right">
                  <p className="font-semibold">{sharer.total_shares} shares</p>
                  <p className="text-sm text-muted-foreground">
                    {sharer.total_earned.toFixed(4)} SOL
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(sharer.last_share_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
