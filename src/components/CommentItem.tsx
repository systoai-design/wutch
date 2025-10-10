import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useModerator } from '@/hooks/useModerator';
import { toast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { VerificationBadge } from '@/components/VerificationBadge';
import ReportButton from './ReportButton';
import { UserBadges } from '@/components/UserBadges';
import { useUserRoles } from '@/hooks/useUserRoles';

interface CommentItemProps {
  comment: {
    id: string;
    text: string;
    created_at: string;
    user_id: string;
    profiles?: {
      username: string;
      display_name: string;
      avatar_url: string;
      verification_type?: string | null;
    };
  };
  onDelete?: () => void;
}

export default function CommentItem({ comment, onDelete }: CommentItemProps) {
  const { user } = useAuth();
  const { isModerator } = useModerator();
  const { isAdmin, isModerator: isCommentUserModerator } = useUserRoles(comment.user_id);
  const isOwner = user?.id === comment.user_id;
  const canDelete = isOwner || isModerator;

  const handleDelete = async () => {
    try {
      const { error } = await supabase
        .from('comments')
        .delete()
        .eq('id', comment.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Comment deleted successfully",
      });

      onDelete?.();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to delete comment: " + error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex gap-3">
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarImage src={comment.profiles?.avatar_url} />
        <AvatarFallback>
          {comment.profiles?.display_name?.[0] || "U"}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-1">
          <span className="font-semibold text-sm truncate flex items-center gap-1">
            {comment.profiles?.display_name || "Unknown User"}
            <UserBadges
              userId={comment.user_id}
              verificationType={comment.profiles?.verification_type as 'blue' | 'red' | 'none' | null}
              isAdmin={isAdmin}
              isModerator={isCommentUserModerator}
              size="sm"
            />
          </span>
          <span className="text-xs text-muted-foreground shrink-0">
            {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
          </span>
        </div>
        <p className="text-sm break-words">{comment.text}</p>
      </div>
      
      <div className="flex items-center gap-2">
        {!isOwner && user && (
          <ReportButton
            contentType="comment"
            contentId={comment.id}
            variant="ghost"
            size="icon"
          />
        )}
        
        {canDelete && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Comment</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this comment? This action cannot be undone.
                {isModerator && !isOwner && " (Moderator delete)"}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        )}
      </div>
    </div>
  );
}
