// api/leadManager.js

const supabase = require('../supabaseClient');

/**
 * Finds a lead by their phone number. If the lead does not exist, it creates a new one.
 * @param {object} details - The lead's details.
 * @param {string} details.phoneNumber - The lead's WhatsApp phone number.
 * @param {string} details.fullName - The lead's full name.
 * @param {string} details.source - The source of the lead (e.g., 'WA Direct', 'WA Simulation').
 * @returns {object} The lead object from the database.
 */
async function findOrCreateLead({ phoneNumber, fullName, source }) {
  if (!phoneNumber || !fullName || !source) {
    throw new Error('Phone number, full name, and source are required to find or create a lead.');
  }

  // 1. Check if the lead already exists
  let { data: lead, error: leadError } = await supabase
    .from('leads')
    .select('*')
    .eq('phone_number', phoneNumber)
    .limit(1)
    .maybeSingle();

  if (leadError) {
    console.error(`Supabase lookup error for ${phoneNumber}:`, leadError.message);
    throw new Error(`Supabase lookup error: ${leadError.message}`);
  }

  // 2. If the lead exists, return it
  if (lead) {
    console.log(`[LeadManager] Found existing lead ID: ${lead.id} for ${phoneNumber}`);
    return lead;
  }

  // 3. If the lead does not exist, create it
  console.log(`[LeadManager] 🆕 Lead not found for ${phoneNumber}, creating new one...`);
  const { data: newLead, error: insertError } = await supabase
    .from('leads')
    .insert([{ full_name: fullName, phone_number: phoneNumber, source: source, status: 'new' }])
    .select()
    .single();

  if (insertError) {
    // Handle potential race conditions or unique constraint violations gracefully
    if (insertError.code === '23505') { 
        console.warn(`[LeadManager] A lead with phone number ${phoneNumber} was created by another process just now. Fetching it.`);
        // Retry the find operation once.
        let { data: existingLead, error: retryError } = await supabase.from('leads').select('*').eq('phone_number', phoneNumber).single();
        if (retryError) throw new Error(`Failed to fetch lead after race condition: ${retryError.message}`);
        return existingLead;
    }
    console.error('Failed to insert new lead:', insertError.message);
    throw new Error(`Failed to insert new lead: ${insertError.message}`);
  }

  console.log(`[LeadManager] ✅ Created new lead ID: ${newLead.id} for ${fullName}`);
  return newLead;
}

module.exports = { findOrCreateLead };