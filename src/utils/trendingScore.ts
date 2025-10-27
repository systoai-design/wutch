/**
 * Calculate trending score for content based on multiple factors
 * Higher score = more trending
 */

interface TrendingInput {
  view_count?: number;
  like_count?: number;
  created_at?: string;
  commentCount?: number;
}

export function calculateTrendingScore(content: TrendingInput): number {
  const views = content.view_count || 0;
  const likes = content.like_count || 0;
  const createdAt = content.created_at || new Date().toISOString();
  const commentCount = content.commentCount || 0;
  const now = Date.now();
  const ageInHours = (now - new Date(createdAt).getTime()) / (1000 * 60 * 60);
  
  // Time decay: Content loses 10% value every 24 hours
  const recencyFactor = Math.exp(-ageInHours / 240);
  
  // Engagement rate with safe division
  const engagementRate = views > 0 ? (likes + commentCount) / views : 0;
  
  // Weighted score calculation
  const viewScore = views * 1.0;
  const likeScore = likes * 5.0;
  const commentScore = commentCount * 3.0;
  const engagementBonus = engagementRate * 100;
  
  // Combine factors
  const baseScore = viewScore + likeScore + commentScore + engagementBonus;
  const trendingScore = baseScore * recencyFactor;
  
  return Math.round(trendingScore * 100) / 100;
}

/**
 * Sort content array by trending score
 */
export function sortByTrending<T extends TrendingInput>(content: T[]): T[] {
  return [...content].sort((a, b) => {
    const scoreA = calculateTrendingScore(a);
    const scoreB = calculateTrendingScore(b);
    return scoreB - scoreA;
  });
}
