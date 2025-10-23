import { Heart, MessageCircle, MoreVertical } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { Link } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface CommunityPostCardProps {
  post: {
    id: string;
    content: string;
    media_url?: string;
    like_count: number;
    comment_count: number;
    created_at: string;
    user: {
      id: string;
      username: string;
      display_name: string;
      avatar_url?: string;
    };
  };
  isLiked?: boolean;
  onLike?: () => void;
  onDelete?: () => void;
  isOwner?: boolean;
}

export const CommunityPostCard = ({
  post,
  isLiked = false,
  onLike,
  onDelete,
  isOwner = false,
}: CommunityPostCardProps) => {
  return (
    <Card className="p-6 hover:shadow-lg transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <Link 
          to={`/${post.user.username}`}
          className="flex items-center gap-3 hover:opacity-80 transition-opacity"
        >
          <Avatar className="h-10 w-10">
            <AvatarImage src={post.user.avatar_url} />
            <AvatarFallback>{post.user.display_name[0]}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-semibold text-foreground">{post.user.display_name}</p>
            <p className="text-sm text-muted-foreground">
              @{post.user.username} · {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
            </p>
          </div>
        </Link>

        {isOwner && onDelete && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onDelete} className="text-destructive">
                Delete Post
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Content */}
      <div className="mb-4">
        <p className="text-foreground whitespace-pre-wrap break-words">{post.content}</p>
      </div>

      {/* Media */}
      {post.media_url && (
        <div className="mb-4 rounded-lg overflow-hidden">
          <img 
            src={post.media_url} 
            alt="Post media" 
            className="w-full h-auto object-cover max-h-96"
          />
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-6 pt-4 border-t">
        <Button
          variant="ghost"
          size="sm"
          className={`gap-2 ${isLiked ? 'text-red-500' : 'text-muted-foreground'}`}
          onClick={onLike}
        >
          <Heart className={`h-5 w-5 ${isLiked ? 'fill-current' : ''}`} />
          <span>{post.like_count}</span>
        </Button>

        <Link to={`/community/post/${post.id}`}>
          <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground">
            <MessageCircle className="h-5 w-5" />
            <span>{post.comment_count}</span>
          </Button>
        </Link>
      </div>
    </Card>
  );
};
