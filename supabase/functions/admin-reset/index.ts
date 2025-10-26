import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

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
    console.log('Admin reset function called');
    
    // SECURITY: Require authenticated admin user ONLY
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('Missing Authorization header');
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create client to verify user authentication
    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();

    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Checking user ${user.id} for admin role`);

    // Initialize Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Verify user has admin role
    const { data: roles, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (roleError || !roles) {
      console.error(`User ${user.id} is not an admin`);
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Admin role required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Require confirmation in request body
    const { confirm } = await req.json();
    if (confirm !== true) {
      return new Response(
        JSON.stringify({ error: 'Confirmation required. Send { "confirm": true } to proceed.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Admin user ${user.id} authorized for database reset`);

    // Log the admin action with IP
    const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    await supabaseAdmin
      .from('admin_actions_log')
      .insert({
        admin_user_id: user.id,
        action_type: 'database_reset',
        ip_address: ipAddress,
        action_details: { timestamp: new Date().toISOString() }
      });

    const results = {
      usersDeleted: 0,
      tablesCleared: {} as Record<string, number>,
      storageCleared: [] as string[],
      errors: [] as string[]
    };

    // Step 1: Delete all users via admin API
    console.log('Fetching all users...');
    const { data: users, error: usersError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (usersError) {
      results.errors.push(`Failed to fetch users: ${usersError.message}`);
    } else if (users?.users) {
      console.log(`Found ${users.users.length} users to delete`);
      
      for (const user of users.users) {
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
        if (deleteError) {
          results.errors.push(`Failed to delete user ${user.id}`);
        } else {
          results.usersDeleted++;
        }
      }
    }

    // Step 2: Clear all data tables (in dependency order)
    const tablesToClear = [
      'bounty_claims',
      'stream_bounties',
      'user_shares',
      'sharing_campaigns',
      'donations',
      'comments',
      'short_video_likes',
      'wutch_video_likes',
      'livestream_likes',
      'community_post_likes',
      'short_videos',
      'wutch_videos',
      'viewing_sessions',
      'livestreams',
      'community_posts',
      'follows',
      'user_roles',
      'profile_wallets',
      'profiles'
    ];

    for (const table of tablesToClear) {
      console.log(`Clearing table: ${table}`);
      const { error: deleteError, count } = await supabaseAdmin
        .from(table)
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all rows
      
      if (deleteError) {
        results.errors.push(`Failed to clear ${table}`);
        results.tablesCleared[table] = 0;
      } else {
        results.tablesCleared[table] = count || 0;
      }
    }

    // Step 3: Purge storage buckets
    const bucketsToPurge = ['short-videos', 'short-thumbnails', 'wutch-videos', 'wutch-video-thumbnails'];

    for (const bucket of bucketsToPurge) {
      console.log(`Purging bucket: ${bucket}`);
      try {
        const { data: files, error: listError } = await supabaseAdmin
          .storage
          .from(bucket)
          .list();

        if (listError) {
          results.errors.push(`Failed to list files in ${bucket}`);
          continue;
        }

        if (files && files.length > 0) {
          const filePaths = files.map(file => file.name);
          const { error: removeError } = await supabaseAdmin
            .storage
            .from(bucket)
            .remove(filePaths);

          if (removeError) {
            results.errors.push(`Failed to remove files from ${bucket}`);
          } else {
            results.storageCleared.push(bucket);
          }
        } else {
          results.storageCleared.push(bucket);
        }
      } catch (error) {
        results.errors.push(`Exception while purging ${bucket}`);
      }
    }

    console.log('Admin reset completed');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Database reset completed',
        results
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Admin reset function error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: errorMessage
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
