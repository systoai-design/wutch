import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Minimum requirements for red badge
    const MIN_WATCH_HOURS = 50;
    const MIN_FOLLOWERS = 100;

    console.log('Starting red badge eligibility check...');

    // Get all users who are not verified and haven't been notified yet
    const { data: unverifiedUsers, error: usersError } = await supabase
      .from('profiles')
      .select('id, username, follower_count')
      .or('verification_type.is.null,verification_type.eq.none')
      .gte('follower_count', MIN_FOLLOWERS);

    if (usersError) {
      console.error('Error fetching unverified users:', usersError);
      throw usersError;
    }

    console.log(`Found ${unverifiedUsers?.length || 0} users with sufficient followers`);

    let notifiedCount = 0;
    let alreadyNotifiedCount = 0;

    // Check each user's eligibility
    for (const user of unverifiedUsers || []) {
      try {
        // Check if already notified
        const { data: existingNotification } = await supabase
          .from('red_badge_eligibility_notifications')
          .select('id')
          .eq('user_id', user.id)
          .single();

        if (existingNotification) {
          alreadyNotifiedCount++;
          console.log(`User ${user.username} already notified, skipping`);
          continue;
        }

        // Calculate total watch hours for this user
        const { data: viewingSessions, error: sessionsError } = await supabase
          .from('viewing_sessions')
          .select('total_watch_time')
          .eq('user_id', user.id);

        if (sessionsError) {
          console.error(`Error fetching viewing sessions for user ${user.id}:`, sessionsError);
          continue;
        }

        const totalWatchTimeSeconds = viewingSessions?.reduce((sum, session) => 
          sum + (session.total_watch_time || 0), 0) || 0;
        const totalWatchHours = totalWatchTimeSeconds / 3600;

        console.log(`User ${user.username}: ${totalWatchHours.toFixed(2)} watch hours, ${user.follower_count} followers`);

        // Check if user meets all requirements
        if (totalWatchHours >= MIN_WATCH_HOURS && user.follower_count >= MIN_FOLLOWERS) {
          console.log(`User ${user.username} is eligible! Sending notification...`);

          // Create notification using the database function
          const { error: notificationError } = await supabase.rpc('create_notification', {
            p_user_id: user.id,
            p_type: 'red_badge_eligible',
            p_title: "You're Eligible for the Red Badge! 🔴",
            p_message: `Great news! You've met the requirements for a free Red Badge verification (${user.follower_count} followers, ${totalWatchHours.toFixed(1)} watch hours). Click to apply now!`,
            p_metadata: {
              follower_count: user.follower_count,
              watch_hours: totalWatchHours,
              min_requirements: {
                watch_hours: MIN_WATCH_HOURS,
                followers: MIN_FOLLOWERS
              }
            }
          });

          if (notificationError) {
            console.error(`Error creating notification for user ${user.id}:`, notificationError);
            continue;
          }

          // Record that we've notified this user
          const { error: trackError } = await supabase
            .from('red_badge_eligibility_notifications')
            .insert({
              user_id: user.id,
              was_eligible: true,
              follower_count: user.follower_count,
              watch_hours: totalWatchHours
            });

          if (trackError) {
            console.error(`Error tracking notification for user ${user.id}:`, trackError);
          } else {
            notifiedCount++;
            console.log(`Successfully notified user ${user.username}`);
          }
        }
      } catch (userError) {
        console.error(`Error processing user ${user.id}:`, userError);
      }
    }

    console.log(`Eligibility check complete. Notified: ${notifiedCount}, Already notified: ${alreadyNotifiedCount}`);

    return new Response(
      JSON.stringify({
        success: true,
        usersChecked: unverifiedUsers?.length || 0,
        notified: notifiedCount,
        alreadyNotified: alreadyNotifiedCount
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('Error in check-and-notify-eligible-users:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        success: false 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});