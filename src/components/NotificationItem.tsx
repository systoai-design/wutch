import { Notification } from '@/types/notification';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDistanceToNow } from 'date-fns';
import { useNotifications } from '@/hooks/useNotifications';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { 
  Heart, 
  MessageCircle, 
  DollarSign, 
  UserPlus, 
  Share2, 
  Target,
  X 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { VerificationBadge } from '@/components/VerificationBadge';

interface NotificationItemProps {
  notification: Notification;
}

export function NotificationItem({ notification }: NotificationItemProps) {
  const { markAsRead, deleteNotification } = useNotifications();
  const navigate = useNavigate();

  const getIcon = () => {
    switch (notification.type) {
      case 'follow':
        return <UserPlus className="h-4 w-4 text-blue-500" />;
      case 'donation':
        return <DollarSign className="h-4 w-4 text-green-500" />;
      case 'like':
        return <Heart className="h-4 w-4 text-red-500" />;
      case 'comment':
        return <MessageCircle className="h-4 w-4 text-purple-500" />;
      case 'share':
        return <Share2 className="h-4 w-4 text-cyan-500" />;
      case 'bounty_claim':
        return <Target className="h-4 w-4 text-orange-500" />;
      default:
        return null;
    }
  };

  const handleClick = async () => {
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }

    // Navigate based on notification type
    if (notification.type === 'follow' && notification.actor_id) {
      navigate(`/profile/${notification.actor?.username}`);
    } else if (notification.content_id && notification.content_type) {
      if (notification.content_type === 'livestream') {
        navigate(`/stream/${notification.content_id}`);
      } else if (notification.content_type === 'shortvideo' || notification.content_type === 'short_video') {
        navigate(`/shorts?video=${notification.content_id}`);
      } else if (notification.content_type === 'wutch_video') {
        navigate(`/wutch/${notification.content_id}`);
      }
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteNotification(notification.id);
  };

  return (
    <div
      className={cn(
        "flex items-start gap-3 p-4 hover:bg-muted/50 cursor-pointer transition-colors relative group",
        !notification.is_read && "bg-primary/5"
      )}
      onClick={handleClick}
    >
      {/* Avatar or Icon */}
      <div className="relative">
        {notification.actor?.avatar_url ? (
          <Avatar className="h-10 w-10">
            <AvatarImage src={notification.actor.avatar_url} />
            <AvatarFallback>
              {notification.actor.display_name?.[0] || notification.actor.username?.[0] || 'U'}
            </AvatarFallback>
          </Avatar>
        ) : (
          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
            {getIcon()}
          </div>
        )}
        {!notification.is_read && (
          <div className="absolute -top-1 -right-1 h-3 w-3 bg-primary rounded-full border-2 border-background" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">{notification.title}</p>
        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
          {notification.message}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
        </p>
      </div>

      {/* Delete Button */}
      <Button
        variant="ghost"
        size="icon"
        className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
        onClick={handleDelete}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
