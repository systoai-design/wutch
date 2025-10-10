import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { videoUrl, contentType, contentId, userId } = await req.json();
    
    console.log('Moderating content:', { videoUrl, contentType, contentId, userId });
    
    // Initialize Supabase client to check user tier
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    // Check user's moderation tier first
    const { data: userTier, error: tierError } = await supabaseClient
      .rpc('get_user_moderation_tier', { user_id: userId });
    
    if (tierError) {
      console.error('Error fetching user tier:', tierError);
    }
    
    console.log('User moderation tier:', userTier);
    
    // Skip moderation for trusted users (verified or established)
    if (userTier === 'verified' || userTier === 'established') {
      console.log(`User is ${userTier} - skipping AI moderation`);
      return new Response(JSON.stringify({
        success: true,
        skipped: true,
        userTier: userTier,
        reason: `User is ${userTier} - auto-approved`,
        moderation: {
          isViolation: false,
          violationCategories: [],
          confidenceScores: {},
          reasoning: 'Content from trusted user - no moderation needed'
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Check if content is a video file (skip AI moderation for videos)
    const isVideoFile = videoUrl.match(/\.(mp4|webm|mov|avi|mkv|flv)$/i) || 
                        contentType === 'wutch_video' || 
                        contentType === 'short_video';

    if (isVideoFile) {
      console.log('Video content detected - skipping AI moderation');
      return new Response(JSON.stringify({
        success: true,
        skipped: true,
        userTier: userTier || 'new',
        reason: 'Video content - AI moderation not applicable',
        moderation: {
          isViolation: false,
          violationCategories: [],
          confidenceScores: {},
          reasoning: 'Video files cannot be analyzed by image-based AI - auto-approved'
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Continue with AI moderation for 'new' and 'flagged' users (images/thumbnails only)
    console.log('Performing AI moderation for user tier:', userTier);
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Use Gemini 2.5 Flash for multimodal content moderation
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are a content moderation AI. Analyze the provided image/video frame and detect if it violates community guidelines. 

Detect these violation categories:
- NSFW/Adult: pornography, nudity, sexual content
- Violence: gore, blood, weapons, physical harm
- Hate: hate symbols, extremist content, terrorism
- Drugs: illegal drugs, drug paraphernalia
- Dangerous: self-harm, dangerous activities

Return JSON ONLY in this exact format:
{
  "isViolation": boolean,
  "violationCategories": string[],
  "confidenceScores": { [category]: number },
  "reasoning": string
}`
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Analyze this content for violations:' },
              { type: 'image_url', image_url: { url: videoUrl } }
            ]
          }
        ],
      }),
    });

    if (response.status === 429) {
      console.error('Rate limit exceeded');
      return new Response(JSON.stringify({ 
        error: 'Rate limit exceeded. Please try again later.' 
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (response.status === 402) {
      console.error('Payment required');
      return new Response(JSON.stringify({ 
        error: 'Payment required. Please contact support.' 
      }), {
        status: 402,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      throw new Error(`AI gateway returned ${response.status}`);
    }

    const data = await response.json();
    console.log('AI moderation response:', data);
    
    const messageContent = data.choices?.[0]?.message?.content;
    if (!messageContent) {
      throw new Error('No content in AI response');
    }

    // Parse the JSON from the AI response
    const moderationResult = JSON.parse(messageContent);

    console.log('Moderation result:', moderationResult);

    return new Response(JSON.stringify({
      success: true,
      skipped: false,
      userTier: userTier || 'new',
      moderation: moderationResult
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Moderation error:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Moderation failed',
      details: error.toString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
