import { Star, CheckCircle, Clock, Package } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface SellerStatsCardProps {
  rating?: number;
  reviewCount?: number;
  ordersCompleted?: number;
  completionRate?: number;
  responseTime?: number;
  compact?: boolean;
}

export const SellerStatsCard = ({
  rating = 0,
  reviewCount = 0,
  ordersCompleted = 0,
  completionRate = 0,
  responseTime,
  compact = false,
}: SellerStatsCardProps) => {
  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`h-4 w-4 ${
          i < Math.floor(rating)
            ? "fill-yellow-400 text-yellow-400"
            : "text-muted"
        }`}
      />
    ));
  };

  if (compact) {
    return (
      <div className="flex items-center gap-3 text-sm">
        {rating > 0 && (
          <div className="flex items-center gap-1">
            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
            <span className="font-semibold">{rating.toFixed(1)}</span>
            <span className="text-muted-foreground">({reviewCount})</span>
          </div>
        )}
        {ordersCompleted > 0 && (
          <div className="flex items-center gap-1 text-muted-foreground">
            <Package className="h-4 w-4" />
            <span>{ordersCompleted} orders</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <Card className="p-4 bg-muted/30">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex">{renderStars(rating)}</div>
            {rating > 0 && (
              <span className="font-bold text-lg">{rating.toFixed(1)}</span>
            )}
          </div>
          {reviewCount > 0 && (
            <span className="text-sm text-muted-foreground">
              {reviewCount} {reviewCount === 1 ? "review" : "reviews"}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          {ordersCompleted > 0 && (
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              <div>
                <div className="font-semibold">{ordersCompleted}</div>
                <div className="text-xs text-muted-foreground">Orders</div>
              </div>
            </div>
          )}

          {completionRate > 0 && (
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <div>
                <div className="font-semibold">{completionRate}%</div>
                <div className="text-xs text-muted-foreground">Success</div>
              </div>
            </div>
          )}

          {responseTime && (
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-500" />
              <div>
                <div className="font-semibold">{responseTime}h</div>
                <div className="text-xs text-muted-foreground">Response</div>
              </div>
            </div>
          )}
        </div>

        {ordersCompleted >= 50 && rating >= 4.5 && (
          <Badge className="bg-gradient-to-r from-yellow-500 to-orange-500">
            ⭐ Pro Seller
          </Badge>
        )}
      </div>
    </Card>
  );
};
