import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { videoId, videoUrl } = await req.json();

    if (!videoId || !videoUrl) {
      throw new Error('Missing required parameters: videoId and videoUrl');
    }

    console.log(`Starting transcoding for video ${videoId}`);

    // Update status to processing
    await supabaseClient
      .from('wutch_videos')
      .update({
        transcoding_status: 'processing',
        transcoding_started_at: new Date().toISOString(),
      })
      .eq('id', videoId);

    // NOTE: This is a placeholder for actual transcoding logic
    // In production, you would:
    // 1. Download the video from videoUrl
    // 2. Use FFmpeg or external service (Mux, Cloudflare Stream, etc.) to transcode
    // 3. Generate HLS playlist (.m3u8) and segments
    // 4. Upload transcoded files to storage
    // 5. Update database with HLS URL and available qualities

    // For now, we'll mark it as completed with the original URL
    // This allows the system to work without actual transcoding infrastructure
    
    console.log('Transcoding placeholder - marking as completed with original video');
    
    await supabaseClient
      .from('wutch_videos')
      .update({
        transcoding_status: 'completed',
        transcoding_completed_at: new Date().toISOString(),
        // In production, set hls_playlist_url and available_qualities here
      })
      .eq('id', videoId);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Video processing initiated',
        note: 'Transcoding infrastructure not yet implemented - using original video'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Transcoding error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Try to update error status in database
    try {
      const { videoId } = await req.json();
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? ''
      );
      
      await supabaseClient
        .from('wutch_videos')
        .update({
          transcoding_status: 'failed',
          transcoding_error: errorMessage,
        })
        .eq('id', videoId);
    } catch (updateError) {
      console.error('Failed to update error status:', updateError);
    }

    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});