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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      throw new Error('Unauthorized');
    }

    const { orderId, status, deliveryNote } = await req.json();

    if (!orderId || !status) {
      throw new Error('Missing required fields: orderId, status');
    }

    console.log('Updating service order:', { orderId, status, userId: user.id });

    // Verify user is the seller
    const { data: order, error: orderError } = await supabaseClient
      .from('service_orders')
      .select('seller_id, buyer_id')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      throw new Error('Order not found');
    }

    if (order.seller_id !== user.id) {
      throw new Error('Unauthorized: Only the seller can update this order');
    }

    // Update the order
    const updateData: any = { status };
    
    if (deliveryNote) {
      updateData.delivery_note = deliveryNote;
    }
    
    if (status === 'completed') {
      updateData.completed_at = new Date().toISOString();
    }

    const { data: updatedOrder, error: updateError } = await supabaseClient
      .from('service_orders')
      .update(updateData)
      .eq('id', orderId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating service order:', updateError);
      throw new Error('Failed to update service order');
    }

    // Create notification for buyer
    if (status === 'completed') {
      await supabaseClient.rpc('create_notification', {
        p_user_id: order.buyer_id,
        p_type: 'service_completed',
        p_title: 'Service Completed! 🎉',
        p_message: 'Your service order has been completed. Check your order details for delivery notes.',
        p_actor_id: user.id,
        p_content_type: 'service_order',
        p_content_id: orderId,
      });
    } else if (status === 'in_progress') {
      await supabaseClient.rpc('create_notification', {
        p_user_id: order.buyer_id,
        p_type: 'service_update',
        p_title: 'Service In Progress 🚀',
        p_message: 'The seller has started working on your order.',
        p_actor_id: user.id,
        p_content_type: 'service_order',
        p_content_id: orderId,
      });
    }

    console.log('Service order updated successfully');

    return new Response(
      JSON.stringify({ success: true, order: updatedOrder }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in update-service-order:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});