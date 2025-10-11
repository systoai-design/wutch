import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-token',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Admin reset function called');
    
    // SECURITY: Require both admin token AND authenticated admin user
    const adminToken = req.headers.get('x-admin-token');
    const expectedToken = Deno.env.get('ADMIN_MAINTENANCE_TOKEN');
    
    if (!adminToken || adminToken !== expectedToken) {
      console.error('Invalid or missing admin token');
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Invalid admin token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify authenticated user is an admin
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

    console.log(`Admin token verified, checking user ${user.id} for admin role`);

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

    console.log(`Admin user ${user.id} authorized for database reset`);

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
      console.error('Error fetching users:', usersError);
      results.errors.push(`Failed to fetch users: ${usersError.message}`);
    } else if (users?.users) {
      console.log(`Found ${users.users.length} users to delete`);
      
      for (const user of users.users) {
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
        if (deleteError) {
          console.error(`Error deleting user ${user.id}:`, deleteError);
          results.errors.push(`Failed to delete user ${user.id}: ${deleteError.message}`);
        } else {
          results.usersDeleted++;
          console.log(`Deleted user ${user.id}`);
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
      'short_videos',
      'viewing_sessions',
      'livestreams',
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
        console.error(`Error clearing ${table}:`, deleteError);
        results.errors.push(`Failed to clear ${table}: ${deleteError.message}`);
        results.tablesCleared[table] = 0;
      } else {
        results.tablesCleared[table] = count || 0;
        console.log(`Cleared ${count || 0} rows from ${table}`);
      }
    }

    // Step 3: Purge storage buckets
    const bucketsToPurge = ['short-videos', 'short-thumbnails'];

    for (const bucket of bucketsToPurge) {
      console.log(`Purging bucket: ${bucket}`);
      try {
        // List all files in the bucket
        const { data: files, error: listError } = await supabaseAdmin
          .storage
          .from(bucket)
          .list();

        if (listError) {
          console.error(`Error listing files in ${bucket}:`, listError);
          results.errors.push(`Failed to list files in ${bucket}: ${listError.message}`);
          continue;
        }

        if (files && files.length > 0) {
          const filePaths = files.map(file => file.name);
          console.log(`Found ${filePaths.length} files in ${bucket}`);

          const { error: removeError } = await supabaseAdmin
            .storage
            .from(bucket)
            .remove(filePaths);

          if (removeError) {
            console.error(`Error removing files from ${bucket}:`, removeError);
            results.errors.push(`Failed to remove files from ${bucket}: ${removeError.message}`);
          } else {
            results.storageCleared.push(bucket);
            console.log(`Purged ${filePaths.length} files from ${bucket}`);
          }
        } else {
          results.storageCleared.push(bucket);
          console.log(`Bucket ${bucket} was already empty`);
        }
      } catch (error) {
        console.error(`Exception while purging ${bucket}:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.errors.push(`Exception while purging ${bucket}: ${errorMessage}`);
      }
    }

    console.log('Admin reset completed:', results);

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
