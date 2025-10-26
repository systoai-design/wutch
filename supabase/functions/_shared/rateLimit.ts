import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

interface RateLimitConfig {
  maxRequests: number;
  windowMinutes: number;
}

// Default rate limit configurations per endpoint
const RATE_LIMITS: Record<string, RateLimitConfig> = {
  'verify-donation': { maxRequests: 10, windowMinutes: 1 },
  'send-verification-code': { maxRequests: 3, windowMinutes: 60 },
  'process-bounty-reward': { maxRequests: 5, windowMinutes: 1 },
  'process-share-payout': { maxRequests: 10, windowMinutes: 1 },
  'charge-bounty-wallet': { maxRequests: 5, windowMinutes: 1 },
  'verify-wallet': { maxRequests: 10, windowMinutes: 1 },
  'connect-twitter': { maxRequests: 5, windowMinutes: 60 },
  'post-twitter-share': { maxRequests: 5, windowMinutes: 60 }
};

export async function checkRateLimit(
  endpoint: string,
  userId: string | null,
  ipAddress: string | null
): Promise<{ allowed: boolean; remainingRequests: number; resetAt: Date }> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const config = RATE_LIMITS[endpoint] || { maxRequests: 10, windowMinutes: 1 };
  const windowStart = new Date(Date.now() - config.windowMinutes * 60 * 1000);

  // Build query based on available identifier
  let query = supabase
    .from('rate_limits')
    .select('*')
    .eq('endpoint', endpoint)
    .gte('window_start', windowStart.toISOString());

  if (userId) {
    query = query.eq('user_id', userId);
  } else if (ipAddress) {
    query = query.eq('ip_address', ipAddress);
  } else {
    // No identifier provided, allow the request
    return {
      allowed: true,
      remainingRequests: config.maxRequests,
      resetAt: new Date(Date.now() + config.windowMinutes * 60 * 1000)
    };
  }

  const { data: existingRecords, error } = await query;

  if (error) {
    console.error('Rate limit check error:', error);
    // On error, allow the request but log it
    return {
      allowed: true,
      remainingRequests: config.maxRequests,
      resetAt: new Date(Date.now() + config.windowMinutes * 60 * 1000)
    };
  }

  // Calculate total requests in current window
  const totalRequests = existingRecords?.reduce((sum, record) => sum + record.request_count, 0) || 0;
  const remainingRequests = Math.max(0, config.maxRequests - totalRequests);
  const allowed = totalRequests < config.maxRequests;

  if (allowed) {
    // Increment or create rate limit record
    const latestRecord = existingRecords?.[0];
    
    if (latestRecord && new Date(latestRecord.window_start).getTime() > windowStart.getTime()) {
      // Update existing record in current window
      await supabase
        .from('rate_limits')
        .update({ request_count: latestRecord.request_count + 1 })
        .eq('id', latestRecord.id);
    } else {
      // Create new record for new window
      await supabase
        .from('rate_limits')
        .insert({
          user_id: userId,
          ip_address: ipAddress,
          endpoint,
          request_count: 1,
          window_start: new Date()
        });
    }
  }

  const resetAt = existingRecords?.[0]
    ? new Date(new Date(existingRecords[0].window_start).getTime() + config.windowMinutes * 60 * 1000)
    : new Date(Date.now() + config.windowMinutes * 60 * 1000);

  return { allowed, remainingRequests, resetAt };
}

export function rateLimitResponse(resetAt: Date): Response {
  return new Response(
    JSON.stringify({
      error: 'Rate limit exceeded',
      message: 'Too many requests. Please try again later.',
      resetAt: resetAt.toISOString()
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': Math.ceil((resetAt.getTime() - Date.now()) / 1000).toString()
      }
    }
  );
}
