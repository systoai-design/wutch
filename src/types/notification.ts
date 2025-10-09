export interface Notification {
  id: string;
  user_id: string;
  type: 'follow' | 'donation' | 'like' | 'comment' | 'share' | 'bounty_claim' | 'red_badge_eligible';
  title: string;
  message: string;
  actor_id: string | null;
  content_type: 'livestream' | 'short_video' | 'wutch_video' | null;
  content_id: string | null;
  metadata: Record<string, any> | null;
  is_read: boolean;
  created_at: string;
  actor?: {
    avatar_url: string | null;
    username: string;
    display_name: string | null;
  };
}
