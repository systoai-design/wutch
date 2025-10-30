import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify JWT and admin role
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const body = await req.json();
    const { action } = body;

    switch (action) {
      case 'populate_queue': {
        // Populate the optimization queue with unoptimized videos
        const { data, error } = await supabase.rpc('populate_video_optimization_queue');
        
        if (error) throw error;

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: `Added ${data} videos to optimization queue`,
            count: data
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get_queue_status': {
        // Get current queue statistics
        const { data: stats, error: statsError } = await supabase
          .from('video_optimization_queue')
          .select('status')
          .then(async ({ data, error }) => {
            if (error) throw error;
            
            const pending = data?.filter(v => v.status === 'pending').length || 0;
            const processing = data?.filter(v => v.status === 'processing').length || 0;
            const completed = data?.filter(v => v.status === 'completed').length || 0;
            const failed = data?.filter(v => v.status === 'failed').length || 0;
            const total = data?.length || 0;

            // Get total size savings
            const { data: logs } = await supabase
              .from('video_optimization_log')
              .select('original_size, optimized_size')
              .eq('status', 'completed');

            let totalSavings = 0;
            if (logs) {
              totalSavings = logs.reduce((sum, log) => {
                return sum + (log.original_size - log.optimized_size);
              }, 0);
            }

            return {
              data: {
                pending,
                processing,
                completed,
                failed,
                total,
                totalSavings
              },
              error: null
            };
          });

        if (statsError) throw statsError;

        return new Response(
          JSON.stringify({ success: true, stats }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get_next_video': {
        // Get next video to optimize
        const { data, error } = await supabase.rpc('get_next_video_to_optimize');
        
        if (error) throw error;

        if (!data || data.length === 0) {
          return new Response(
            JSON.stringify({ success: true, video: null, message: 'No videos to optimize' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, video: data[0] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'mark_complete': {
        const { queueId, optimizedUrl, originalSize, optimizedSize, processingTimeMs } = body;
        
        const { error } = await supabase.rpc('mark_video_optimization_complete', {
          p_queue_id: queueId,
          p_optimized_url: optimizedUrl,
          p_original_size: originalSize,
          p_optimized_size: optimizedSize,
          p_processing_time_ms: processingTimeMs
        });

        if (error) throw error;

        return new Response(
          JSON.stringify({ success: true, message: 'Video optimization marked as complete' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'mark_failed': {
        const { queueId, errorMessage } = body;
        
        const { error } = await supabase.rpc('mark_video_optimization_failed', {
          p_queue_id: queueId,
          p_error_message: errorMessage
        });

        if (error) throw error;

        return new Response(
          JSON.stringify({ success: true, message: 'Video optimization marked as failed' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

  } catch (error) {
    console.error('Error in batch-optimize-videos:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { 
        status: errorMessage === 'Unauthorized' ? 401 : 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
