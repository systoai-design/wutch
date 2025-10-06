import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Send } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import CommentItem from "@/components/CommentItem";
import GuestPromptDialog from "@/components/GuestPromptDialog";

interface Comment {
  id: string;
  user_id: string;
  text: string;
  created_at: string;
  profiles?: {
    username: string;
    display_name: string;
    avatar_url: string;
  };
}

interface CommentsSectionProps {
  contentId: string;
  contentType: "livestream" | "shortvideo" | "wutch_video";
}

export default function CommentsSection({ contentId, contentType }: CommentsSectionProps) {
  const { user, isGuest } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showGuestPrompt, setShowGuestPrompt] = useState(false);

  useEffect(() => {
    fetchComments();
    subscribeToComments();
  }, [contentId, contentType]);

  const fetchComments = async () => {
    try {
      const { data, error } = await supabase
        .from("comments")
        .select(`
          *,
          profiles:user_id (
            username,
            display_name,
            avatar_url
          )
        `)
        .eq("content_id", contentId)
        .eq("content_type", contentType)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setComments(data || []);
    } catch (error) {
      console.error("Error fetching comments:", error);
    } finally {
      setLoading(false);
    }
  };

  const subscribeToComments = () => {
    const channel = supabase
      .channel(`comments:${contentId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "comments",
          filter: `content_id=eq.${contentId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            fetchComments(); // Refetch to get profile data
          } else if (payload.eventType === "DELETE") {
            setComments((prev) =>
              prev.filter((comment) => comment.id !== payload.old.id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      setShowGuestPrompt(true);
      return;
    }

    if (!newComment.trim()) return;

    setSubmitting(true);
    try {
      const { error } = await supabase.from("comments").insert({
        user_id: user.id,
        content_id: contentId,
        content_type: contentType,
        text: newComment.trim(),
      });

      if (error) throw error;

      setNewComment("");
      toast({
        title: "Comment posted",
        description: "Your comment has been added",
      });
    } catch (error) {
      console.error("Error posting comment:", error);
      toast({
        title: "Error",
        description: "Failed to post comment",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <GuestPromptDialog
        open={showGuestPrompt}
        onOpenChange={setShowGuestPrompt}
        action="comment"
      />
      <div className="flex flex-col h-full">
      {/* Comments List */}
      <ScrollArea className="flex-1 px-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : comments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No comments yet. Be the first to comment!</p>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {comments.map((comment) => (
              <CommentItem key={comment.id} comment={comment} onDelete={fetchComments} />
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Comment Input */}
      <div className="border-t p-4 bg-background">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder={user ? "Write a comment..." : "Sign in to comment"}
            disabled={!user || submitting}
            className="min-h-[60px] max-h-[120px] resize-none"
            maxLength={500}
          />
          <Button
            type="submit"
            disabled={!user || submitting || !newComment.trim()}
            size="icon"
            className="shrink-0"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
        {newComment.length > 400 && (
          <p className="text-xs text-muted-foreground mt-1">
            {500 - newComment.length} characters remaining
          </p>
        )}
      </div>
    </div>
    </>
  );
}
