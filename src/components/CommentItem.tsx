import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { toast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

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
    };
  };
  onDelete?: () => void;
}

export default function CommentItem({ comment, onDelete }: CommentItemProps) {
  const { user } = useAuth();
  const { isAdmin } = useAdmin();
  const isOwner = user?.id === comment.user_id;
  const canDelete = isOwner || isAdmin;

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
          <span className="font-semibold text-sm truncate">
            {comment.profiles?.display_name || "Unknown User"}
          </span>
          <span className="text-xs text-muted-foreground shrink-0">
            {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
          </span>
        </div>
        <p className="text-sm break-words">{comment.text}</p>
      </div>
      
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
                {isAdmin && !isOwner && " (Admin delete)"}
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
  );
}
