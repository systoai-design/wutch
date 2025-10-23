import { CommunityPostCard } from "./CommunityPostCard";
import { SkeletonStreamCard } from "./SkeletonCard";

interface CommunityPostFeedProps {
  posts?: any[];
  isLoading?: boolean;
  onLike?: (postId: string) => void;
  onDelete?: (postId: string) => void;
  currentUserId?: string;
}

export const CommunityPostFeed = ({
  posts = [],
  isLoading = false,
  onLike,
  onDelete,
  currentUserId,
}: CommunityPostFeedProps) => {
  if (isLoading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map((i) => (
          <SkeletonStreamCard key={i} />
        ))}
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground text-lg">No posts yet. Be the first to share something!</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {posts.map((post) => (
        <CommunityPostCard
          key={post.id}
          post={post}
          isLiked={post.isLiked}
          onLike={() => onLike?.(post.id)}
          onDelete={() => onDelete?.(post.id)}
          isOwner={currentUserId === post.user.id}
        />
      ))}
    </div>
  );
};
