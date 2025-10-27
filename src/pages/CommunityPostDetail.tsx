import { useState } from "react";
import { useParams } from "react-router-dom";
import { ArrowLeft, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { CommunityPostCard } from "@/components/CommunityPostCard";
import { ServiceOrderModal } from "@/components/ServiceOrderModal";
import CommentsSection from "@/components/CommentsSection";
import { SkeletonStreamCard } from "@/components/SkeletonCard";
import { useCommunityPostQuery } from "@/hooks/useCommunityPostQuery";
import { useCommunityPostLike } from "@/hooks/useCommunityPostLike";
import { usePremiumCommunityPost } from "@/hooks/usePremiumCommunityPost";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";

export default function CommunityPostDetail() {
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { post, isLoading } = useCommunityPostQuery(postId!);
  const { toggleLike } = useCommunityPostLike();
  const { hasAccess, isPremium, isOwner, price } = usePremiumCommunityPost({ postId: postId! });
  const [showOrderModal, setShowOrderModal] = useState(false);

  const showPaywall = isPremium && !hasAccess && !isOwner;

  if (isLoading) {
    return (
      <div className="container max-w-4xl mx-auto px-4 py-8">
        <SkeletonStreamCard />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="container max-w-4xl mx-auto px-4 py-8 text-center">
        <p className="text-muted-foreground">Post not found</p>
        <Button onClick={() => navigate("/community")} className="mt-4">
          Back to Community
        </Button>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto px-4 py-8">
      <Button
        variant="ghost"
        className="mb-6 gap-2"
        onClick={() => navigate("/community")}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Community
      </Button>

      <div className="space-y-6">
        {showPaywall ? (
          <Card className="p-8 text-center bg-gradient-to-br from-purple-900/20 to-pink-900/20 border-purple-500/20">
            <Lock className="h-16 w-16 text-purple-500 mx-auto mb-4" />
            <h3 className="text-2xl font-bold mb-2">Premium Service</h3>
            <p className="text-muted-foreground mb-6">Order this service to see full details</p>
            <Button onClick={() => setShowOrderModal(true)} size="lg">
              Order for {price} SOL
            </Button>
          </Card>
        ) : (
          <CommunityPostCard
            post={post}
            isLiked={post.isLiked}
            onLike={() => toggleLike(postId!)}
            onOrderService={post.is_premium && post.post_type === 'service' && !isOwner ? () => setShowOrderModal(true) : undefined}
            isOwner={user?.id === post.user.id}
            hasAccess={hasAccess}
          />
        )}

        {!showPaywall && (
          <CommentsSection
            contentId={postId!}
            contentType="community_post"
          />
        )}
      </div>

      {post && showOrderModal && (
        <ServiceOrderModal
          isOpen={showOrderModal}
          onClose={() => setShowOrderModal(false)}
          postId={post.id}
          serviceDescription={post.service_description || ''}
          deliveryTime={post.delivery_time}
          price={price || post.x402_price || 0}
          creatorWallet={(post.user as any).wallet_address || ''}
          creatorName={post.user.display_name}
          hasAccess={hasAccess}
          onSuccess={() => {
            setShowOrderModal(false);
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}
