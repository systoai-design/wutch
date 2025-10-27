import { useState } from "react";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ServiceReviewFormProps {
  orderId: string;
  postId: string;
  sellerId: string;
  onSuccess?: () => void;
}

export const ServiceReviewForm = ({
  orderId,
  postId,
  sellerId,
  onSuccess,
}: ServiceReviewFormProps) => {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error("Please select a rating");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("service_reviews").insert({
        order_id: orderId,
        post_id: postId,
        buyer_id: user.id,
        seller_id: sellerId,
        rating,
        review_text: reviewText || null,
      });

      if (error) throw error;

      toast.success("Review submitted successfully!");
      onSuccess?.();
    } catch (error: any) {
      console.error("Error submitting review:", error);
      toast.error(error.message || "Failed to submit review");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Leave a Review</h3>
      
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium mb-2 block">
            How would you rate this service?
          </label>
          <div className="flex gap-2">
            {Array.from({ length: 5 }, (_, i) => i + 1).map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                className="transition-transform hover:scale-110"
              >
                <Star
                  className={`h-8 w-8 ${
                    star <= (hoverRating || rating)
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-muted"
                  }`}
                />
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">
            Share your experience (optional)
          </label>
          <Textarea
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value)}
            placeholder="Tell others about your experience with this service..."
            rows={4}
          />
        </div>

        <Button
          onClick={handleSubmit}
          disabled={isSubmitting || rating === 0}
          className="w-full"
        >
          {isSubmitting ? "Submitting..." : "Submit Review"}
        </Button>
      </div>
    </Card>
  );
};
