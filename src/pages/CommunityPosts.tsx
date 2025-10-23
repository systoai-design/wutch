import { useState } from "react";
import { MessageSquare, Plus } from "lucide-react";
import { UpcomingFeatureBanner } from "@/components/UpcomingFeatureBanner";
import { CommunityPostUpload } from "@/components/CommunityPostUpload";
import { CommunityPostFeed } from "@/components/CommunityPostFeed";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { useCommunityPosts } from "@/hooks/useCommunityPosts";
import { useCommunityPostLike } from "@/hooks/useCommunityPostLike";

export default function CommunityPosts() {
  const { user } = useAuth();
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("recent");
  
  const { posts, isLoading, refetch } = useCommunityPosts();
  const { toggleLike } = useCommunityPostLike();

  const handleLike = async (postId: string) => {
    await toggleLike(postId);
    refetch();
  };

  const handleDelete = async (postId: string) => {
    // Delete logic will be added when feature is fully enabled
    console.log("Delete post:", postId);
  };

  return (
    <div className="container max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <MessageSquare className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Community Posts</h1>
        </div>
        
        {user && (
          <Button onClick={() => setIsUploadOpen(true)} className="gap-2">
            <Plus className="h-5 w-5" />
            Create Post
          </Button>
        )}
      </div>

      {/* Coming Soon Banner */}
      <div className="mb-8">
        <UpcomingFeatureBanner
          title="Community Posts - Coming Soon! 🎉"
          description="Share your thoughts, images, and updates with the community. Connect with other creators and viewers in a whole new way. This feature is currently in development and will be available soon!"
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-8">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="recent">Recent</TabsTrigger>
          <TabsTrigger value="following">Following</TabsTrigger>
          <TabsTrigger value="trending">Trending</TabsTrigger>
        </TabsList>

        <TabsContent value="recent" className="mt-6">
          <CommunityPostFeed
            posts={posts}
            isLoading={isLoading}
            onLike={handleLike}
            onDelete={handleDelete}
            currentUserId={user?.id}
          />
        </TabsContent>

        <TabsContent value="following" className="mt-6">
          <CommunityPostFeed
            posts={[]}
            isLoading={false}
            currentUserId={user?.id}
          />
        </TabsContent>

        <TabsContent value="trending" className="mt-6">
          <CommunityPostFeed
            posts={[]}
            isLoading={false}
            currentUserId={user?.id}
          />
        </TabsContent>
      </Tabs>

      {/* Upload Dialog */}
      <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create a Post</DialogTitle>
          </DialogHeader>
          <CommunityPostUpload onSuccess={() => {
            setIsUploadOpen(false);
            refetch();
          }} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
