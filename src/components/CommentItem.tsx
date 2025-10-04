import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";

interface CommentItemProps {
  comment: {
    id: string;
    text: string;
    created_at: string;
    profiles?: {
      username: string;
      display_name: string;
      avatar_url: string;
    };
  };
}

export default function CommentItem({ comment }: CommentItemProps) {
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
    </div>
  );
}
