export interface Stream {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  streamerName: string;
  streamerAvatar: string;
  streamUrl: string;
  isLive: boolean;
  viewerCount: number;
  category: string;
  tags: string[];
  walletAddress: string;
  createdAt: Date;
}

export interface Streamer {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  bio: string;
  walletAddress: string;
  followerCount: number;
  totalDonations: number;
  socialLinks: {
    twitter?: string;
    discord?: string;
    website?: string;
  };
}
