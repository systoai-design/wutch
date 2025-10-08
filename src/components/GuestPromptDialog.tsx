import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuthDialog } from "@/store/authDialogStore";

interface GuestPromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: "like" | "comment" | "donate" | "submit" | "claim" | "earn" | "follow";
}

const GuestPromptDialog = ({ open, onOpenChange, action }: GuestPromptDialogProps) => {
  const { open: openAuthDialog } = useAuthDialog();

  const actionMessages = {
    like: {
      title: "Sign up to like content",
      description: "Create an account to like streams and videos, and earn rewards for engagement!",
    },
    comment: {
      title: "Sign up to comment",
      description: "Join the conversation! Sign up to comment and interact with creators.",
    },
    donate: {
      title: "Sign up to support creators",
      description: "Create an account to donate to your favorite creators and earn rewards!",
    },
    submit: {
      title: "Sign up to submit content",
      description: "Join Wutch as a creator! Sign up to submit your own streams and videos.",
    },
    claim: {
      title: "Sign up to claim rewards",
      description: "Create an account to claim bounties and earn crypto rewards!",
    },
    earn: {
      title: "Sign up to earn by sharing",
      description: "Create an account to earn SOL by sharing streams with your network!",
    },
    follow: {
      title: "Sign up to follow creators",
      description: "Create an account to follow your favorite creators and stay updated!",
    },
  };

  const message = actionMessages[action];

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{message.title}</AlertDialogTitle>
          <AlertDialogDescription>
            {message.description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => {
            onOpenChange(false);
            openAuthDialog('signup');
          }}>
            Sign Up
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default GuestPromptDialog;
