import { useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { CommunityPostCard } from "@/components/CommunityPostCard";
import CommentsSection from "@/components/CommentsSection";
import { SkeletonStreamCard } from "@/components/SkeletonCard";
import { useCommunityPostQuery } from "@/hooks/useCommunityPostQuery";
import { useCommunityPostLike } from "@/hooks/useCommunityPostLike";
import { useAuth } from "@/hooks/useAuth";

export default function CommunityPostDetail() {
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { post, isLoading } = useCommunityPostQuery(postId!);
  const { toggleLike } = useCommunityPostLike();

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
        <CommunityPostCard
          post={post}
          isLiked={post.isLiked}
          onLike={() => toggleLike(postId!)}
          isOwner={user?.id === post.user.id}
        />

        <CommentsSection
          contentId={postId!}
          contentType="community_post"
        />
      </div>
    </div>
  );
}
