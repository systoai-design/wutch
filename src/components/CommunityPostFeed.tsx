import { CommunityPostCard } from "./CommunityPostCard";
import { SkeletonStreamCard } from "./SkeletonCard";
import { useNavigate } from "react-router-dom";

interface CommunityPostFeedProps {
  posts?: any[];
  isLoading?: boolean;
  onLike?: (postId: string) => void;
  onDelete?: (postId: string) => void;
  currentUserId?: string;
  filterByType?: 'all' | 'service' | 'regular';
}

export const CommunityPostFeed = ({
  posts = [],
  isLoading = false,
  onLike,
  onDelete,
  currentUserId,
  filterByType = 'all',
}: CommunityPostFeedProps) => {
  const navigate = useNavigate();
  
  // Filter posts by type
  const filteredPosts = posts.filter(post => {
    if (filterByType === 'all') return true;
    if (filterByType === 'service') return post.post_type === 'service';
    if (filterByType === 'regular') return post.post_type !== 'service';
    return true;
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map((i) => (
          <SkeletonStreamCard key={i} />
        ))}
      </div>
    );
  }

  if (filteredPosts.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground text-lg">
          {filterByType === 'service' 
            ? 'No service posts yet. Be the first to offer a service!' 
            : filterByType === 'regular'
            ? 'No posts yet. Be the first to share something!'
            : 'No posts yet. Be the first to share something!'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {filteredPosts.map((post) => (
        <CommunityPostCard
          key={post.id}
          post={post}
          isLiked={post.isLiked}
          onLike={() => onLike?.(post.id)}
          onDelete={() => onDelete?.(post.id)}
          onOrderService={() => navigate(`/community/post/${post.id}`)}
          isOwner={currentUserId === post.user.id}
        />
      ))}
    </div>
  );
};
