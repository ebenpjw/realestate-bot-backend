const supabase = require('../supabaseClient');
const logger = require('../logger');

async function findOrCreateLead({ phoneNumber, fullName, source }) {
  if (!phoneNumber || !fullName || !source) {
    const err = new Error('Phone number, full name, and source are required to find or create a lead.');
    logger.error({ phoneNumber, fullName, source }, err.message);
    throw err;
  }

  let { data: lead, error: leadError } = await supabase
    .from('leads')
    .select('*')
    .eq('phone_number', phoneNumber)
    .limit(1)
    .maybeSingle();

  if (leadError) {
    logger.error({ err: leadError, phoneNumber }, 'Supabase lookup error for lead.');
    throw new Error(`Supabase lookup error: ${leadError.message}`);
  }

  if (lead) {
    logger.info({ leadId: lead.id, phoneNumber }, `Found existing lead.`);
    return lead;
  }

  logger.info({ phoneNumber }, `Lead not found, creating new one...`);
  const { data: newLead, error: insertError } = await supabase
    .from('leads')
    .insert([{ full_name: fullName, phone_number: phoneNumber, source: source, status: 'new' }])
    .select()
    .single();

  if (insertError) {
    if (insertError.code === '23505') { 
        logger.warn({ phoneNumber }, `Race condition: A lead with this phone number was just created. Fetching it.`);
        let { data: existingLead, error: retryError } = await supabase.from('leads').select('*').eq('phone_number', phoneNumber).single();
        if (retryError) {
            logger.error({ err: retryError, phoneNumber }, 'Failed to fetch lead after race condition.');
            throw new Error(`Failed to fetch lead after race condition: ${retryError.message}`);
        }
        return existingLead;
    }
    logger.error({ err: insertError }, 'Failed to insert new lead.');
    throw new Error(`Failed to insert new lead: ${insertError.message}`);
  }

  logger.info({ leadId: newLead.id, fullName }, `Created new lead.`);
  return newLead;
}

module.exports = { findOrCreateLead };
