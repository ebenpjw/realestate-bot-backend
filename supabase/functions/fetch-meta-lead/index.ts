// supabase/functions/fetch-meta-lead/index.ts
// This function triggers when a new 'lead' is inserted.
// It fetches the lead's details from the Meta Graph API and sends a welcome message.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Main function logic
async function fetchAndProcessLead(leadRecord: any) {
  // *** FIX: Use non-reserved environment variable names ***
  const supabaseClient = createClient(
    Deno.env.get('PROJECT_SUPABASE_URL')!,
    Deno.env.get('PROJECT_SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: `Bearer ${Deno.env.get('PROJECT_SUPABASE_SERVICE_ROLE_KEY')}` } } }
  );

  const { meta_lead_id, meta_page_access_token, id: leadId } = leadRecord;

  // 1. Fetch lead data from Meta Graph API
  const graphApiUrl = `https://graph.facebook.com/v19.0/${meta_lead_id}?access_token=${meta_page_access_token}`;
  
  const metaResponse = await fetch(graphApiUrl);
  if (!metaResponse.ok) {
    const errorData = await metaResponse.text();
    throw new Error(`Meta Graph API error: ${errorData}`);
  }
  const leadData = await metaResponse.json();
  const { full_name, phone_number } = leadData;

  if (!full_name || !phone_number) {
    throw new Error(`Missing full_name or phone_number from Meta for lead_id: ${meta_lead_id}`);
  }

  // Sanitize phone number for WhatsApp (e.g., remove leading '+')
  const sanitizedPhoneNumber = phone_number.replace(/^\+/, '');

  // 2. Update the lead record in Supabase with the fetched details
  const { error: updateError } = await supabaseClient
    .from('leads')
    .update({ 
      full_name: full_name, 
      phone_number: sanitizedPhoneNumber,
      status: 'contacted' // Update status to show we've processed it
    })
    .eq('id', leadId);

  if (updateError) {
    throw new Error(`Supabase update error: ${updateError.message}`);
  }

  // 3. Send the initial template message via Gupshup
  const gupshupApiKey = Deno.env.get('GUPSHUP_API_KEY');
  const wabaNumber = Deno.env.get('WABA_NUMBER');
  const templateId = leadRecord.welcome_template_id || Deno.env.get('DEFAULT_WELCOME_TEMPLATE_ID'); // Use a default if not set
  
  const templateObject = {
    id: templateId,
    params: [full_name, "your property enquiry"] // Customize as needed
  };

  const gupshupPayload = new URLSearchParams({
      channel: 'whatsapp',
      source: wabaNumber,
      destination: sanitizedPhoneNumber,
      'src.name': 'DoroSmartGuide',
      template: JSON.stringify(templateObject)
  }).toString();

  const gupshupResponse = await fetch('https://api.gupshup.io/wa/api/v1/template/msg', {
    method: 'POST',
    headers: {
      'apikey': gupshupApiKey,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: gupshupPayload
  });

  if (!gupshupResponse.ok) {
    const errorText = await gupshupResponse.text();
    // Even if Gupshup fails, don't throw an error, just log it.
    // The lead is already saved.
    console.error(`Gupshup API error: ${errorText}`);
  }
  
  return { status: 'ok', leadId: leadId, phone: sanitizedPhoneNumber };
}


// --- Edge Function Server ---
serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { record } = await req.json();

    // We only care about new leads from Facebook that haven't been processed
    if (record?.source === 'Facebook Lead Ad' && record?.status === 'new') {
      const result = await fetchAndProcessLead(record);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    } else {
      return new Response(JSON.stringify({ message: "Ignoring irrelevant trigger" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
