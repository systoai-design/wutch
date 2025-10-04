import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Clock, Users, Coins } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';

interface BountyCardProps {
  bounty: {
    id: string;
    livestream_id: string;
    secret_word: string;
    reward_per_participant: number;
    participant_limit: number;
    claimed_count: number;
    expires_at: string | null;
    is_active: boolean;
    livestream?: {
      title: string;
      thumbnail_url: string | null;
    };
    creator?: {
      username: string;
      display_name: string;
      avatar_url: string | null;
    };
  };
}

export function BountyCard({ bounty }: BountyCardProps) {
  const navigate = useNavigate();
  const progressPercentage = (bounty.claimed_count / bounty.participant_limit) * 100;
  const spotsLeft = bounty.participant_limit - bounty.claimed_count;
  const timeLeft = bounty.expires_at 
    ? formatDistanceToNow(new Date(bounty.expires_at), { addSuffix: true })
    : 'No expiry';

  return (
    <Card 
      className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
      onClick={() => navigate(`/stream/${bounty.livestream_id}`)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Avatar className="h-8 w-8 flex-shrink-0">
              <AvatarImage src={bounty.creator?.avatar_url || ''} />
              <AvatarFallback>{bounty.creator?.display_name?.[0] || 'U'}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground truncate">
                by @{bounty.creator?.username || 'Unknown'}
              </p>
            </div>
          </div>
          <Badge variant="secondary" className="flex-shrink-0">
            <Coins className="w-3 h-3 mr-1" />
            {bounty.reward_per_participant} SOL
          </Badge>
        </div>
        <CardTitle className="text-lg line-clamp-2 mt-2">
          {bounty.livestream?.title || 'Livestream Bounty'}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">
              {bounty.claimed_count}/{bounty.participant_limit} claimed
            </span>
          </div>
          <Progress value={progressPercentage} className="h-2" />
        </div>

        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-1 text-muted-foreground">
            <Users className="w-4 h-4" />
            <span>{spotsLeft} spots left</span>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span className="text-xs">{timeLeft}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
