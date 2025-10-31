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

/**
 * Get random seed that changes on every call for true randomization
 */
function getRandomSeed(): number {
  return Math.random() * 1000000;
}

/**
 * Seeded random number generator for consistent "randomness" per session
 */
function seededRandom(seed: number, index: number): number {
  const x = Math.sin(seed + index) * 10000;
  return x - Math.floor(x);
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
 * Add randomization factor to score for variety
 */
export function calculateTrendingScoreWithRandomness(
  content: TrendingInput,
  index: number
): number {
  const baseScore = calculateTrendingScore(content);
  const seed = getRandomSeed(); // Changed to truly random seed
  const randomFactor = seededRandom(seed, index);
  
  // Add 0-30% random variance to the score
  const variance = baseScore * 0.3 * randomFactor;
  
  return baseScore + variance;
}

/**
 * Sort content array by trending score with weighted randomization
 * Groups content into tiers and randomizes within each tier
 */
export function sortByTrendingWithVariety<T extends TrendingInput>(content: T[]): T[] {
  if (content.length === 0) return content;

  // Calculate scores for all content
  const withScores = content.map((item, index) => ({
    item,
    baseScore: calculateTrendingScore(item),
    randomizedScore: calculateTrendingScoreWithRandomness(item, index)
  }));
  
  // Define score tiers dynamically
  const sortedByBase = [...withScores].sort((a, b) => b.baseScore - a.baseScore);
  const top20Index = Math.floor(sortedByBase.length * 0.2);
  const top60Index = Math.floor(sortedByBase.length * 0.6);
  
  const tierThresholds = {
    trending: sortedByBase[top20Index]?.baseScore || 0,
    rising: sortedByBase[top60Index]?.baseScore || 0,
  };
  
  // Assign tiers
  const tiered = withScores.map(item => ({
    ...item,
    tier: item.baseScore >= tierThresholds.trending ? 'hot' :
          item.baseScore >= tierThresholds.rising ? 'trending' : 'rising'
  }));
  
  // Sort by tier first, then by randomized score within tier
  return tiered
    .sort((a, b) => {
      const tierOrder = { hot: 0, trending: 1, rising: 2 };
      const tierDiff = tierOrder[a.tier] - tierOrder[b.tier];
      if (tierDiff !== 0) return tierDiff;
      
      return b.randomizedScore - a.randomizedScore;
    })
    .map(item => item.item);
}

/**
 * Simple randomization with bias toward quality
 */
export function shuffleWithBias<T extends TrendingInput>(
  content: T[],
  biasFactor: number = 0.5
): T[] {
  const seed = getRandomSeed(); // Changed to truly random seed
  
  return [...content]
    .map((item, index) => ({
      item,
      score: calculateTrendingScore(item),
      random: seededRandom(seed, index)
    }))
    .sort((a, b) => {
      // Blend score and randomness
      const scoreA = a.score * biasFactor + a.random * 1000 * (1 - biasFactor);
      const scoreB = b.score * biasFactor + b.random * 1000 * (1 - biasFactor);
      return scoreB - scoreA;
    })
    .map(item => item.item);
}

/**
 * Disperse content by creator to avoid clustering same-creator content
 * Maintains quality distribution while spreading out same-creator items
 */
export function disperseByCreator<T extends { user_id?: string; profiles?: any }>(
  content: T[]
): T[] {
  if (content.length <= 1) return content;

  const result: T[] = [];
  const byCreator = new Map<string, T[]>();
  
  // Group by creator
  content.forEach(item => {
    const creatorId = item.user_id || 'unknown';
    if (!byCreator.has(creatorId)) {
      byCreator.set(creatorId, []);
    }
    byCreator.get(creatorId)!.push(item);
  });

  // Convert to array and sort by group size (larger groups first)
  const creatorGroups = Array.from(byCreator.entries())
    .sort((a, b) => b[1].length - a[1].length);

  // Round-robin distribute items from each creator
  let maxLength = Math.max(...creatorGroups.map(g => g[1].length));
  
  for (let i = 0; i < maxLength; i++) {
    for (const [_, items] of creatorGroups) {
      if (items[i]) {
        result.push(items[i]);
      }
    }
  }

  return result;
}

/**
 * Sort content array by trending score (legacy)
 */
export function sortByTrending<T extends TrendingInput>(content: T[]): T[] {
  return [...content].sort((a, b) => {
    const scoreA = calculateTrendingScore(a);
    const scoreB = calculateTrendingScore(b);
    return scoreB - scoreA;
  });
}
