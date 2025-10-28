import { Heart, MessageCircle, MoreVertical, Briefcase, Lock, Clock, ShoppingCart, ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { Link } from "react-router-dom";
import { SellerStatsCard } from "@/components/SellerStatsCard";
import { X402Badge } from "@/components/X402Badge";
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
    post_type?: string;
    is_premium?: boolean;
    x402_price?: number;
    service_description?: string;
    delivery_time?: string;
    user: {
      id: string;
      username: string;
      display_name: string;
      avatar_url?: string;
      service_rating_avg?: number;
      service_rating_count?: number;
      service_orders_completed?: number;
      service_completion_rate?: number;
      service_response_time_hours?: number;
    };
  };
  isLiked?: boolean;
  onLike?: () => void;
  onDelete?: () => void;
  onOrderService?: () => void;
  isOwner?: boolean;
  hasAccess?: boolean;
}

export const CommunityPostCard = ({
  post,
  isLiked = false,
  onLike,
  onDelete,
  onOrderService,
  isOwner = false,
  hasAccess = false,
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

        <div className="flex items-center gap-2">
          {/* Post Type Badge */}
          {post.post_type === 'service' && post.is_premium && (
            <X402Badge size="sm" />
          )}
          {post.post_type === 'service' && !post.is_premium && (
            <Badge variant="outline" className="gap-1">
              <Briefcase className="h-3 w-3" />
              Service
            </Badge>
          )}
          {post.post_type === 'meme' && (
            <Badge variant="outline">😄 Meme</Badge>
          )}

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
      </div>

      {/* Service Description with Seller Stats */}
      {post.post_type === 'service' && post.service_description && (
        <div className="space-y-3 mb-4">
          {/* Seller Stats */}
          {(post.user.service_rating_avg || post.user.service_orders_completed) && (
            <SellerStatsCard
              rating={post.user.service_rating_avg}
              reviewCount={post.user.service_rating_count}
              ordersCompleted={post.user.service_orders_completed}
              completionRate={post.user.service_completion_rate}
              responseTime={post.user.service_response_time_hours}
              compact
            />
          )}
          
          <div className="bg-muted/50 rounded-lg p-4 border border-border/50">
            <div className="flex items-start gap-2">
              <Briefcase className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-medium text-foreground">
                  I will <span className="text-primary">{post.service_description}</span>
                </p>
                {post.delivery_time && (
                  <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    Delivery: {post.delivery_time}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="mb-4">
        <p className="text-foreground whitespace-pre-wrap break-words">{post.content}</p>
      </div>

      {/* Media - Only show if not premium or user has access or service post */}
      {post.media_url && (!post.is_premium || hasAccess || post.post_type === 'service') && (
        <div className="mb-4 rounded-lg overflow-hidden">
          {post.media_url.match(/\.(mp4|webm|mov)$/i) ? (
            <video
              src={post.media_url}
              controls
              className="w-full rounded-lg max-h-96 object-contain"
            />
          ) : (
            <img 
              src={post.media_url} 
              alt="Post media" 
              className="w-full h-auto object-cover max-h-96"
            />
          )}
        </div>
      )}
      
      {/* Premium media placeholder when locked (but not for services) */}
      {post.media_url && post.is_premium && !hasAccess && post.post_type !== 'service' && (
        <div className="mb-4 aspect-video bg-gradient-to-br from-purple-900/20 to-pink-900/20 rounded-lg flex items-center justify-center border border-purple-500/20">
          <div className="text-center p-6">
            <Lock className="h-12 w-12 text-purple-500 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Premium media locked</p>
          </div>
        </div>
      )}

      {/* Premium Price Badge */}
      {post.is_premium && post.x402_price && (
        <div className="flex items-center gap-2 mb-4 p-3 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-lg border border-purple-500/20">
          <Lock className="h-4 w-4 text-purple-500" />
          <span className="font-semibold text-purple-500">{post.x402_price} SOL</span>
          <span className="text-sm text-muted-foreground">One-time payment</span>
        </div>
      )}

      {/* Order Button for Service Posts */}
      {post.is_premium && post.post_type === 'service' && !isOwner && (
        onOrderService ? (
          <Button 
            className="w-full gap-2 mb-4 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600" 
            onClick={onOrderService}
          >
            <ShoppingCart className="h-4 w-4" />
            Order Service - {post.x402_price} SOL
          </Button>
        ) : (
          <Button 
            asChild
            className="w-full gap-2 mb-4 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
          >
            <Link to={`/community/post/${post.id}`}>
              <ShoppingCart className="h-4 w-4" />
              Order Service - {post.x402_price} SOL
            </Link>
          </Button>
        )
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