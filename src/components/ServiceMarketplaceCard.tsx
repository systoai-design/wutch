import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Star, Package, Clock, User } from "lucide-react";
import { X402Badge } from "@/components/X402Badge";
import { VerificationBadge } from "@/components/VerificationBadge";
import { useNavigate } from "react-router-dom";

interface ServiceMarketplaceCardProps {
  service: {
    id: string;
    title?: string;
    content?: string;
    service_description?: string;
    x402_price: number;
    delivery_time?: string;
    media_urls?: string[];
    user: {
      id: string;
      username: string;
      display_name: string;
      avatar_url?: string;
      service_rating_avg?: number;
      service_rating_count?: number;
      service_orders_completed?: number;
      is_verified?: boolean;
    };
  };
}

export const ServiceMarketplaceCard = ({ service }: ServiceMarketplaceCardProps) => {
  const navigate = useNavigate();
  
  const rating = service.user.service_rating_avg || 0;
  const ratingCount = service.user.service_rating_count || 0;
  const ordersCompleted = service.user.service_orders_completed || 0;
  const thumbnailUrl = service.media_urls?.[0];
  
  const title = service.title || service.content?.split('\n')[0]?.substring(0, 60) || 'Service';
  const description = service.service_description || service.content?.substring(0, 100) || '';

  return (
    <Card 
      className="group overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer border-border/50 bg-card"
      onClick={() => navigate(`/community/post/${service.id}`)}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video bg-gradient-to-br from-purple-500/10 to-pink-500/10 overflow-hidden">
        {thumbnailUrl ? (
          <img 
            src={thumbnailUrl} 
            alt={title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="h-16 w-16 text-muted-foreground/20" />
          </div>
        )}
        <div className="absolute top-3 right-3">
          <X402Badge size="sm" />
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Title */}
        <h3 className="font-semibold text-lg line-clamp-2 group-hover:text-primary transition-colors">
          {title}
        </h3>

        {/* Description */}
        {description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {description}
          </p>
        )}

        {/* Creator Info */}
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarImage src={service.user.avatar_url} />
            <AvatarFallback>
              <User className="h-4 w-4" />
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <span className="text-sm font-medium truncate">
                {service.user.display_name}
              </span>
              {service.user.is_verified && <VerificationBadge verificationType="red" />}
            </div>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {rating > 0 && (
            <div className="flex items-center gap-1">
              <Star className="h-3.5 w-3.5 fill-yellow-500 text-yellow-500" />
              <span className="font-medium">{rating.toFixed(1)}</span>
              {ratingCount > 0 && <span>({ratingCount})</span>}
            </div>
          )}
          {ordersCompleted > 0 && (
            <div className="flex items-center gap-1">
              <Package className="h-3.5 w-3.5" />
              <span>{ordersCompleted} orders</span>
            </div>
          )}
          {service.delivery_time && (
            <div className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              <span>{service.delivery_time}</span>
            </div>
          )}
        </div>

        {/* Price & CTA */}
        <div className="pt-3 border-t border-border/50 flex items-center justify-between">
          <div className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            {service.x402_price} SOL
          </div>
          <Button 
            size="sm"
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white border-0"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/community/post/${service.id}`);
            }}
          >
            Order Now
          </Button>
        </div>
      </div>
    </Card>
  );
};
