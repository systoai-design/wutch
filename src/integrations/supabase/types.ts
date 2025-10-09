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
      bounty_claim_shares: {
        Row: {
          bounty_id: string
          id: string
          livestream_id: string
          share_platform: string
          shared_at: string
          user_id: string
        }
        Insert: {
          bounty_id: string
          id?: string
          livestream_id: string
          share_platform?: string
          shared_at?: string
          user_id: string
        }
        Update: {
          bounty_id?: string
          id?: string
          livestream_id?: string
          share_platform?: string
          shared_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bounty_claim_shares_bounty_id_fkey"
            columns: ["bounty_id"]
            isOneToOne: false
            referencedRelation: "public_stream_bounties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bounty_claim_shares_bounty_id_fkey"
            columns: ["bounty_id"]
            isOneToOne: false
            referencedRelation: "stream_bounties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bounty_claim_shares_livestream_id_fkey"
            columns: ["livestream_id"]
            isOneToOne: false
            referencedRelation: "livestreams"
            referencedColumns: ["id"]
          },
        ]
      }
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
            referencedRelation: "public_stream_bounties"
            referencedColumns: ["id"]
          },
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
          {
            foreignKeyName: "bounty_claims_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
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
          {
            foreignKeyName: "comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
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
          {
            foreignKeyName: "donations_recipient_user_id_fkey"
            columns: ["recipient_user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
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
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      livestream_likes: {
        Row: {
          created_at: string
          id: string
          livestream_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          livestream_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          livestream_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "livestream_likes_livestream_id_fkey"
            columns: ["livestream_id"]
            isOneToOne: false
            referencedRelation: "livestreams"
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
          like_count: number | null
          promotional_link: string | null
          promotional_link_text: string | null
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
          like_count?: number | null
          promotional_link?: string | null
          promotional_link_text?: string | null
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
          like_count?: number | null
          promotional_link?: string | null
          promotional_link_text?: string | null
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
          {
            foreignKeyName: "livestreams_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: string | null
          content_id: string | null
          content_type: string | null
          created_at: string | null
          id: string
          is_read: boolean | null
          message: string
          metadata: Json | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          content_id?: string | null
          content_type?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          metadata?: Json | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          actor_id?: string | null
          content_id?: string | null
          content_type?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          metadata?: Json | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payouts: {
        Row: {
          amount: number
          id: string
          notes: string | null
          processed_at: string | null
          requested_at: string
          status: string
          transaction_signature: string | null
          user_id: string
          wallet_address: string
        }
        Insert: {
          amount: number
          id?: string
          notes?: string | null
          processed_at?: string | null
          requested_at?: string
          status?: string
          transaction_signature?: string | null
          user_id: string
          wallet_address: string
        }
        Update: {
          amount?: number
          id?: string
          notes?: string | null
          processed_at?: string | null
          requested_at?: string
          status?: string
          transaction_signature?: string | null
          user_id?: string
          wallet_address?: string
        }
        Relationships: [
          {
            foreignKeyName: "payouts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payouts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_fees: {
        Row: {
          created_at: string | null
          donation_id: string | null
          fee_amount: number
          fee_source: string | null
          id: string
          source_id: string | null
          transaction_signature: string | null
        }
        Insert: {
          created_at?: string | null
          donation_id?: string | null
          fee_amount: number
          fee_source?: string | null
          id?: string
          source_id?: string | null
          transaction_signature?: string | null
        }
        Update: {
          created_at?: string | null
          donation_id?: string | null
          fee_amount?: number
          fee_source?: string | null
          id?: string
          source_id?: string | null
          transaction_signature?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_fees_donation_id_fkey"
            columns: ["donation_id"]
            isOneToOne: false
            referencedRelation: "donations"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_revenue_pool: {
        Row: {
          available_balance: number
          id: string
          last_updated: string
          settings: Json
          total_collected: number
          total_paid_for_views: number
        }
        Insert: {
          available_balance?: number
          id?: string
          last_updated?: string
          settings?: Json
          total_collected?: number
          total_paid_for_views?: number
        }
        Update: {
          available_balance?: number
          id?: string
          last_updated?: string
          settings?: Json
          total_collected?: number
          total_paid_for_views?: number
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          id: string
          setting_key: string
          setting_value: Json
          updated_at: string
        }
        Insert: {
          id?: string
          setting_key: string
          setting_value: Json
          updated_at?: string
        }
        Update: {
          id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string
        }
        Relationships: []
      }
      profile_wallets: {
        Row: {
          connection_count: number | null
          created_at: string
          first_connected_at: string | null
          last_connected_at: string | null
          updated_at: string
          user_id: string
          wallet_address: string | null
        }
        Insert: {
          connection_count?: number | null
          created_at?: string
          first_connected_at?: string | null
          last_connected_at?: string | null
          updated_at?: string
          user_id: string
          wallet_address?: string | null
        }
        Update: {
          connection_count?: number | null
          created_at?: string
          first_connected_at?: string | null
          last_connected_at?: string | null
          updated_at?: string
          user_id?: string
          wallet_address?: string | null
        }
        Relationships: []
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
          last_payout_at: string | null
          pending_earnings: number
          promotional_link: string | null
          promotional_link_text: string | null
          public_wallet_address: string | null
          social_links: Json | null
          total_donations_received: number | null
          total_earnings: number
          updated_at: string | null
          username: string
          verification_type: string | null
          verified_at: string | null
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
          last_payout_at?: string | null
          pending_earnings?: number
          promotional_link?: string | null
          promotional_link_text?: string | null
          public_wallet_address?: string | null
          social_links?: Json | null
          total_donations_received?: number | null
          total_earnings?: number
          updated_at?: string | null
          username: string
          verification_type?: string | null
          verified_at?: string | null
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
          last_payout_at?: string | null
          pending_earnings?: number
          promotional_link?: string | null
          promotional_link_text?: string | null
          public_wallet_address?: string | null
          social_links?: Json | null
          total_donations_received?: number | null
          total_earnings?: number
          updated_at?: string | null
          username?: string
          verification_type?: string | null
          verified_at?: string | null
        }
        Relationships: []
      }
      sharing_campaigns: {
        Row: {
          created_at: string
          creator_id: string
          escrow_transaction_signature: string | null
          id: string
          is_active: boolean
          livestream_id: string
          max_shares_per_user: number | null
          platform_fee_amount: number
          reward_per_share: number
          spent_budget: number
          total_budget: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          creator_id: string
          escrow_transaction_signature?: string | null
          id?: string
          is_active?: boolean
          livestream_id: string
          max_shares_per_user?: number | null
          platform_fee_amount?: number
          reward_per_share?: number
          spent_budget?: number
          total_budget: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          creator_id?: string
          escrow_transaction_signature?: string | null
          id?: string
          is_active?: boolean
          livestream_id?: string
          max_shares_per_user?: number | null
          platform_fee_amount?: number
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
            foreignKeyName: "sharing_campaigns_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
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
          {
            foreignKeyName: "short_video_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
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
          promotional_link: string | null
          promotional_link_text: string | null
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
          promotional_link?: string | null
          promotional_link_text?: string | null
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
          promotional_link?: string | null
          promotional_link_text?: string | null
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
          {
            foreignKeyName: "short_videos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
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
          platform_fee_amount: number
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
          platform_fee_amount?: number
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
          platform_fee_amount?: number
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
            foreignKeyName: "stream_bounties_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
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
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_shares: {
        Row: {
          campaign_id: string
          id: string
          is_claimed: boolean
          paid_at: string | null
          reward_amount: number
          share_platform: string
          share_url: string
          shared_at: string
          status: string
          transaction_signature: string | null
          twitter_handle: string | null
          user_id: string
          verified_at: string | null
        }
        Insert: {
          campaign_id: string
          id?: string
          is_claimed?: boolean
          paid_at?: string | null
          reward_amount: number
          share_platform?: string
          share_url: string
          shared_at?: string
          status?: string
          transaction_signature?: string | null
          twitter_handle?: string | null
          user_id: string
          verified_at?: string | null
        }
        Update: {
          campaign_id?: string
          id?: string
          is_claimed?: boolean
          paid_at?: string | null
          reward_amount?: number
          share_platform?: string
          share_url?: string
          shared_at?: string
          status?: string
          transaction_signature?: string | null
          twitter_handle?: string | null
          user_id?: string
          verified_at?: string | null
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
          {
            foreignKeyName: "user_shares_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      verification_codes: {
        Row: {
          code: string
          created_at: string | null
          expires_at: string
          id: string
          new_value: string
          type: string
          used: boolean | null
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string | null
          expires_at: string
          id?: string
          new_value: string
          type: string
          used?: boolean | null
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string | null
          expires_at?: string
          id?: string
          new_value?: string
          type?: string
          used?: boolean | null
          user_id?: string
        }
        Relationships: []
      }
      verification_requests: {
        Row: {
          created_at: string | null
          follower_count_at_request: number | null
          id: string
          legal_address: string | null
          legal_email: string
          legal_id_document_url: string | null
          legal_id_number_encrypted: string | null
          legal_id_type: string | null
          legal_name: string
          legal_phone: string | null
          meets_eligibility_criteria: boolean | null
          payment_amount: number | null
          payment_transaction_signature: string | null
          payment_verified_at: string | null
          payment_wallet_address: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_at: string | null
          total_watch_hours: number | null
          updated_at: string | null
          user_id: string
          verification_type: string
        }
        Insert: {
          created_at?: string | null
          follower_count_at_request?: number | null
          id?: string
          legal_address?: string | null
          legal_email: string
          legal_id_document_url?: string | null
          legal_id_number_encrypted?: string | null
          legal_id_type?: string | null
          legal_name: string
          legal_phone?: string | null
          meets_eligibility_criteria?: boolean | null
          payment_amount?: number | null
          payment_transaction_signature?: string | null
          payment_verified_at?: string | null
          payment_wallet_address?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string | null
          total_watch_hours?: number | null
          updated_at?: string | null
          user_id: string
          verification_type: string
        }
        Update: {
          created_at?: string | null
          follower_count_at_request?: number | null
          id?: string
          legal_address?: string | null
          legal_email?: string
          legal_id_document_url?: string | null
          legal_id_number_encrypted?: string | null
          legal_id_type?: string | null
          legal_name?: string
          legal_phone?: string | null
          meets_eligibility_criteria?: boolean | null
          payment_amount?: number | null
          payment_transaction_signature?: string | null
          payment_verified_at?: string | null
          payment_wallet_address?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string | null
          total_watch_hours?: number | null
          updated_at?: string | null
          user_id?: string
          verification_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "verification_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      view_earnings: {
        Row: {
          content_id: string
          content_type: Database["public"]["Enums"]["content_type"]
          created_at: string
          earnings_amount: number
          funded_by_pool: boolean | null
          id: string
          pool_balance_at_time: number | null
          user_id: string
          view_count: number
        }
        Insert: {
          content_id: string
          content_type: Database["public"]["Enums"]["content_type"]
          created_at?: string
          earnings_amount?: number
          funded_by_pool?: boolean | null
          id?: string
          pool_balance_at_time?: number | null
          user_id: string
          view_count?: number
        }
        Update: {
          content_id?: string
          content_type?: Database["public"]["Enums"]["content_type"]
          created_at?: string
          earnings_amount?: number
          funded_by_pool?: boolean | null
          id?: string
          pool_balance_at_time?: number | null
          user_id?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "view_earnings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "view_earnings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
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
      wutch_video_likes: {
        Row: {
          created_at: string | null
          user_id: string
          wutch_video_id: string
        }
        Insert: {
          created_at?: string | null
          user_id: string
          wutch_video_id: string
        }
        Update: {
          created_at?: string | null
          user_id?: string
          wutch_video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wutch_video_likes_wutch_video_id_fkey"
            columns: ["wutch_video_id"]
            isOneToOne: false
            referencedRelation: "wutch_videos"
            referencedColumns: ["id"]
          },
        ]
      }
      wutch_videos: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          duration: number | null
          id: string
          like_count: number | null
          promotional_link: string | null
          promotional_link_text: string | null
          status: string | null
          tags: string[] | null
          thumbnail_url: string | null
          title: string
          total_donations: number | null
          updated_at: string | null
          user_id: string
          video_url: string
          view_count: number | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          duration?: number | null
          id?: string
          like_count?: number | null
          promotional_link?: string | null
          promotional_link_text?: string | null
          status?: string | null
          tags?: string[] | null
          thumbnail_url?: string | null
          title: string
          total_donations?: number | null
          updated_at?: string | null
          user_id: string
          video_url: string
          view_count?: number | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          duration?: number | null
          id?: string
          like_count?: number | null
          promotional_link?: string | null
          promotional_link_text?: string | null
          status?: string | null
          tags?: string[] | null
          thumbnail_url?: string | null
          title?: string
          total_donations?: number | null
          updated_at?: string | null
          user_id?: string
          video_url?: string
          view_count?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      public_profiles: {
        Row: {
          avatar_url: string | null
          banner_url: string | null
          bio: string | null
          created_at: string | null
          display_name: string | null
          follower_count: number | null
          id: string | null
          is_verified: boolean | null
          promotional_link: string | null
          promotional_link_text: string | null
          public_wallet_address: string | null
          social_links: Json | null
          username: string | null
          verification_type: string | null
          verified_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          banner_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          follower_count?: number | null
          id?: string | null
          is_verified?: boolean | null
          promotional_link?: string | null
          promotional_link_text?: string | null
          public_wallet_address?: string | null
          social_links?: Json | null
          username?: string | null
          verification_type?: string | null
          verified_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          banner_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          follower_count?: number | null
          id?: string | null
          is_verified?: boolean | null
          promotional_link?: string | null
          promotional_link_text?: string | null
          public_wallet_address?: string | null
          social_links?: Json | null
          username?: string | null
          verification_type?: string | null
          verified_at?: string | null
        }
        Relationships: []
      }
      public_stream_bounties: {
        Row: {
          claimed_count: number | null
          created_at: string | null
          creator_id: string | null
          expires_at: string | null
          id: string | null
          is_active: boolean | null
          livestream_id: string | null
          participant_limit: number | null
          platform_fee_amount: number | null
          reward_per_participant: number | null
          total_deposit: number | null
          updated_at: string | null
        }
        Insert: {
          claimed_count?: number | null
          created_at?: string | null
          creator_id?: string | null
          expires_at?: string | null
          id?: string | null
          is_active?: boolean | null
          livestream_id?: string | null
          participant_limit?: number | null
          platform_fee_amount?: number | null
          reward_per_participant?: number | null
          total_deposit?: number | null
          updated_at?: string | null
        }
        Update: {
          claimed_count?: number | null
          created_at?: string | null
          creator_id?: string | null
          expires_at?: string | null
          id?: string | null
          is_active?: boolean | null
          livestream_id?: string | null
          participant_limit?: number | null
          platform_fee_amount?: number | null
          reward_per_participant?: number | null
          total_deposit?: number | null
          updated_at?: string | null
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
            foreignKeyName: "stream_bounties_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
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
    }
    Functions: {
      add_to_revenue_pool: {
        Args: { p_amount: number; p_fee_source: string; p_source_id: string }
        Returns: undefined
      }
      create_notification: {
        Args:
          | {
              p_actor_id?: string
              p_content_id?: string
              p_content_type?: string
              p_message: string
              p_metadata?: Json
              p_title: string
              p_type: string
              p_user_id: string
            }
          | {
              p_message: string
              p_metadata?: Json
              p_title: string
              p_type: string
              p_user_id: string
            }
        Returns: undefined
      }
      credit_view_earnings: {
        Args: {
          p_content_id: string
          p_content_type: Database["public"]["Enums"]["content_type"]
          p_user_id: string
          p_view_count?: number
        }
        Returns: undefined
      }
      deactivate_stale_sessions: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      decrement_stream_viewers: {
        Args: { stream_id: string }
        Returns: undefined
      }
      get_most_donated_leaderboard: {
        Args: { limit_count?: number }
        Returns: {
          avatar_url: string
          display_name: string
          donation_count: number
          rank: number
          total_received: number
          user_id: string
          username: string
        }[]
      }
      get_most_earned_leaderboard: {
        Args: { limit_count?: number }
        Returns: {
          avatar_url: string
          display_name: string
          paid_out: number
          pending: number
          rank: number
          total_earned: number
          user_id: string
          username: string
        }[]
      }
      get_most_rewards_given_leaderboard: {
        Args: { limit_count?: number }
        Returns: {
          avatar_url: string
          bounties_count: number
          bounties_total: number
          campaigns_count: number
          campaigns_total: number
          display_name: string
          rank: number
          total_rewards_given: number
          user_id: string
          username: string
        }[]
      }
      get_platform_earnings_stats: {
        Args: Record<PropertyKey, never>
        Returns: {
          active_creators: number
          total_paid_to_creators: number
        }[]
      }
      get_user_financial_stats: {
        Args: { p_user_id: string }
        Returns: {
          earnings_breakdown: Json
          rewards_breakdown: Json
          total_donated: number
          total_earned: number
          total_received: number
          total_rewards_given: number
        }[]
      }
      get_user_watch_time: {
        Args: { p_livestream_id: string; p_user_id: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_short_video_views: {
        Args: { video_id: string }
        Returns: undefined
      }
      increment_stream_viewers: {
        Args: { stream_id: string }
        Returns: undefined
      }
      increment_user_donations: {
        Args: { donation_amount: number; user_id: string }
        Returns: undefined
      }
      increment_wutch_video_views: {
        Args: { video_id: string }
        Returns: undefined
      }
      process_payout: {
        Args: { p_payout_id: string; p_transaction_signature: string }
        Returns: undefined
      }
      update_profile_verification: {
        Args: { p_user_id: string; p_verification_type: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      content_type: "livestream" | "shortvideo" | "wutch_video"
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
      app_role: ["admin", "moderator", "user"],
      content_type: ["livestream", "shortvideo", "wutch_video"],
      donation_status: ["pending", "confirmed", "failed"],
      livestream_status: ["pending", "approved", "live", "ended", "removed"],
    },
  },
} as const
