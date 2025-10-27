import { Star, ThumbsUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";

interface ServiceReviewCardProps {
  review: {
    id: string;
    rating: number;
    review_text?: string;
    created_at: string;
    is_verified_purchase: boolean;
    helpful_count: number;
    response_text?: string;
    response_at?: string;
    buyer?: {
      username: string;
      display_name: string;
      avatar_url?: string;
    };
    seller?: {
      username: string;
      display_name: string;
    };
  };
  compact?: boolean;
}

export const ServiceReviewCard = ({
  review,
  compact = false,
}: ServiceReviewCardProps) => {
  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`h-4 w-4 ${
          i < rating
            ? "fill-yellow-400 text-yellow-400"
            : "text-muted"
        }`}
      />
    ));
  };

  if (compact) {
    return (
      <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
        <div className="flex gap-1">{renderStars(review.rating)}</div>
        <p className="text-sm text-muted-foreground line-clamp-2">
          {review.review_text}
        </p>
      </div>
    );
  }

  return (
    <Card className="p-4">
      <div className="space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={review.buyer?.avatar_url} />
              <AvatarFallback>
                {review.buyer?.display_name?.[0] || "U"}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="font-semibold">{review.buyer?.display_name}</div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>
                  {formatDistanceToNow(new Date(review.created_at))} ago
                </span>
                {review.is_verified_purchase && (
                  <Badge variant="secondary" className="text-xs">
                    Verified Purchase
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-1">{renderStars(review.rating)}</div>
        </div>

        {review.review_text && (
          <p className="text-sm leading-relaxed">{review.review_text}</p>
        )}

        {review.response_text && (
          <div className="ml-8 mt-3 p-3 bg-muted/50 rounded-lg border-l-2 border-primary">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-semibold">
                Seller Response:
              </span>
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(review.response_at!))} ago
              </span>
            </div>
            <p className="text-sm">{review.response_text}</p>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="gap-2">
            <ThumbsUp className="h-4 w-4" />
            Helpful ({review.helpful_count})
          </Button>
        </div>
      </div>
    </Card>
  );
};
