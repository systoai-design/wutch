export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      bounty_claims: {
        Row: {
          bounty_id: string
          claimed_at: string
          id: string
          is_correct: boolean
          meets_watch_requirement: boolean | null
          reward_amount: number | null
          submitted_word: string
          transaction_signature: string | null
          user_id: string
          wallet_address: string
          watch_time_seconds: number | null
        }
        Insert: {
          bounty_id: string
          claimed_at?: string
          id?: string
          is_correct?: boolean
          meets_watch_requirement?: boolean | null
          reward_amount?: number | null
          submitted_word: string
          transaction_signature?: string | null
          user_id: string
          wallet_address: string
          watch_time_seconds?: number | null
        }
        Update: {
          bounty_id?: string
          claimed_at?: string
          id?: string
          is_correct?: boolean
          meets_watch_requirement?: boolean | null
          reward_amount?: number | null
          submitted_word?: string
          transaction_signature?: string | null
          user_id?: string
          wallet_address?: string
          watch_time_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bounty_claims_bounty_id_fkey"
            columns: ["bounty_id"]
            isOneToOne: false
            referencedRelation: "stream_bounties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bounty_claims_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          content_id: string
          content_type: Database["public"]["Enums"]["content_type"]
          created_at: string | null
          id: string
          parent_comment_id: string | null
          text: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content_id: string
          content_type: Database["public"]["Enums"]["content_type"]
          created_at?: string | null
          id?: string
          parent_comment_id?: string | null
          text: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content_id?: string
          content_type?: Database["public"]["Enums"]["content_type"]
          created_at?: string | null
          id?: string
          parent_comment_id?: string | null
          text?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      donations: {
        Row: {
          amount: number
          content_id: string
          content_type: Database["public"]["Enums"]["content_type"]
          created_at: string | null
          donor_wallet_address: string
          id: string
          message: string | null
          recipient_user_id: string
          status: Database["public"]["Enums"]["donation_status"] | null
          transaction_signature: string
        }
        Insert: {
          amount: number
          content_id: string
          content_type: Database["public"]["Enums"]["content_type"]
          created_at?: string | null
          donor_wallet_address: string
          id?: string
          message?: string | null
          recipient_user_id: string
          status?: Database["public"]["Enums"]["donation_status"] | null
          transaction_signature: string
        }
        Update: {
          amount?: number
          content_id?: string
          content_type?: Database["public"]["Enums"]["content_type"]
          created_at?: string | null
          donor_wallet_address?: string
          id?: string
          message?: string | null
          recipient_user_id?: string
          status?: Database["public"]["Enums"]["donation_status"] | null
          transaction_signature?: string
        }
        Relationships: [
          {
            foreignKeyName: "donations_recipient_user_id_fkey"
            columns: ["recipient_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          created_at: string | null
          follower_id: string
          following_id: string
        }
        Insert: {
          created_at?: string | null
          follower_id: string
          following_id: string
        }
        Update: {
          created_at?: string | null
          follower_id?: string
          following_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      livestreams: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          ended_at: string | null
          id: string
          is_live: boolean | null
          pump_fun_url: string
          started_at: string | null
          status: Database["public"]["Enums"]["livestream_status"] | null
          tags: string[] | null
          thumbnail_url: string | null
          title: string
          total_donations: number | null
          updated_at: string | null
          user_id: string
          viewer_count: number | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          ended_at?: string | null
          id?: string
          is_live?: boolean | null
          pump_fun_url: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["livestream_status"] | null
          tags?: string[] | null
          thumbnail_url?: string | null
          title: string
          total_donations?: number | null
          updated_at?: string | null
          user_id: string
          viewer_count?: number | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          ended_at?: string | null
          id?: string
          is_live?: boolean | null
          pump_fun_url?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["livestream_status"] | null
          tags?: string[] | null
          thumbnail_url?: string | null
          title?: string
          total_donations?: number | null
          updated_at?: string | null
          user_id?: string
          viewer_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "livestreams_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          banner_url: string | null
          bio: string | null
          created_at: string | null
          display_name: string | null
          follower_count: number | null
          id: string
          is_verified: boolean | null
          social_links: Json | null
          total_donations_received: number | null
          updated_at: string | null
          username: string
          wallet_address: string | null
        }
        Insert: {
          avatar_url?: string | null
          banner_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          follower_count?: number | null
          id: string
          is_verified?: boolean | null
          social_links?: Json | null
          total_donations_received?: number | null
          updated_at?: string | null
          username: string
          wallet_address?: string | null
        }
        Update: {
          avatar_url?: string | null
          banner_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          follower_count?: number | null
          id?: string
          is_verified?: boolean | null
          social_links?: Json | null
          total_donations_received?: number | null
          updated_at?: string | null
          username?: string
          wallet_address?: string | null
        }
        Relationships: []
      }
      sharing_campaigns: {
        Row: {
          created_at: string
          creator_id: string
          id: string
          is_active: boolean
          livestream_id: string
          max_shares_per_user: number | null
          reward_per_share: number
          spent_budget: number
          total_budget: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          creator_id: string
          id?: string
          is_active?: boolean
          livestream_id: string
          max_shares_per_user?: number | null
          reward_per_share?: number
          spent_budget?: number
          total_budget: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          creator_id?: string
          id?: string
          is_active?: boolean
          livestream_id?: string
          max_shares_per_user?: number | null
          reward_per_share?: number
          spent_budget?: number
          total_budget?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sharing_campaigns_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sharing_campaigns_livestream_id_fkey"
            columns: ["livestream_id"]
            isOneToOne: false
            referencedRelation: "livestreams"
            referencedColumns: ["id"]
          },
        ]
      }
      short_video_likes: {
        Row: {
          created_at: string | null
          short_video_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          short_video_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          short_video_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "short_video_likes_short_video_id_fkey"
            columns: ["short_video_id"]
            isOneToOne: false
            referencedRelation: "short_videos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "short_video_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      short_videos: {
        Row: {
          created_at: string | null
          description: string | null
          duration: number | null
          id: string
          like_count: number | null
          thumbnail_url: string | null
          title: string
          total_donations: number | null
          updated_at: string | null
          user_id: string
          video_url: string
          view_count: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          duration?: number | null
          id?: string
          like_count?: number | null
          thumbnail_url?: string | null
          title: string
          total_donations?: number | null
          updated_at?: string | null
          user_id: string
          video_url: string
          view_count?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          duration?: number | null
          id?: string
          like_count?: number | null
          thumbnail_url?: string | null
          title?: string
          total_donations?: number | null
          updated_at?: string | null
          user_id?: string
          video_url?: string
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "short_videos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stream_bounties: {
        Row: {
          claimed_count: number
          created_at: string
          creator_id: string
          expires_at: string | null
          id: string
          is_active: boolean
          livestream_id: string
          participant_limit: number
          reward_per_participant: number
          secret_word: string
          total_deposit: number
          updated_at: string
        }
        Insert: {
          claimed_count?: number
          created_at?: string
          creator_id: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          livestream_id: string
          participant_limit: number
          reward_per_participant: number
          secret_word: string
          total_deposit: number
          updated_at?: string
        }
        Update: {
          claimed_count?: number
          created_at?: string
          creator_id?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          livestream_id?: string
          participant_limit?: number
          reward_per_participant?: number
          secret_word?: string
          total_deposit?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stream_bounties_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stream_bounties_livestream_id_fkey"
            columns: ["livestream_id"]
            isOneToOne: false
            referencedRelation: "livestreams"
            referencedColumns: ["id"]
          },
        ]
      }
      user_shares: {
        Row: {
          campaign_id: string
          id: string
          paid_at: string | null
          reward_amount: number
          share_platform: string
          share_url: string
          shared_at: string
          status: string
          transaction_signature: string | null
          user_id: string
        }
        Insert: {
          campaign_id: string
          id?: string
          paid_at?: string | null
          reward_amount: number
          share_platform?: string
          share_url: string
          shared_at?: string
          status?: string
          transaction_signature?: string | null
          user_id: string
        }
        Update: {
          campaign_id?: string
          id?: string
          paid_at?: string | null
          reward_amount?: number
          share_platform?: string
          share_url?: string
          shared_at?: string
          status?: string
          transaction_signature?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_shares_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "sharing_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_shares_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      viewing_sessions: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          last_active_at: string
          livestream_id: string
          started_at: string
          tab_visible: boolean
          total_watch_time: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          last_active_at?: string
          livestream_id: string
          started_at?: string
          tab_visible?: boolean
          total_watch_time?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          last_active_at?: string
          livestream_id?: string
          started_at?: string
          tab_visible?: boolean
          total_watch_time?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "viewing_sessions_livestream_id_fkey"
            columns: ["livestream_id"]
            isOneToOne: false
            referencedRelation: "livestreams"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      deactivate_stale_sessions: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      get_user_watch_time: {
        Args: { p_livestream_id: string; p_user_id: string }
        Returns: number
      }
      increment_user_donations: {
        Args: { donation_amount: number; user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      content_type: "livestream" | "shortvideo"
      donation_status: "pending" | "confirmed" | "failed"
      livestream_status: "pending" | "approved" | "live" | "ended" | "removed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      content_type: ["livestream", "shortvideo"],
      donation_status: ["pending", "confirmed", "failed"],
      livestream_status: ["pending", "approved", "live", "ended", "removed"],
    },
  },
} as const
