const supabase = require('./supabaseClient');

// Step 3: Fetch message template from Supabase
async function fetchTemplate(situation, pageId = null, formId = null) {
  let query = supabase
    .from('message_templates')
    .select('template')
    .eq('situation', situation)
    .eq('active', true);

  if (pageId) {
    query = query.or(`page_id.is.null,page_id.eq.${pageId}`);
  }

  if (formId) {
    query = query.or(`form_id.is.null,form_id.eq.${formId}`);
  }

  const { data, error } = await query.limit(1);

  if (error) {
    console.error('Error fetching template:', error);
    return null;
  }

  return data?.[0]?.template || null;
}

// Step 4: Replace placeholders like {{name}}, {{project}}
function fillTemplate(template, leadData) {
  return Object.entries(leadData).reduce((msg, [key, value]) => {
    return msg.replace(new RegExp(`{{${key}}}`, 'g'), value || '');
  }, template);
}

module.exports = {
  fetchTemplate,
  fillTemplate
};
