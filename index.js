const { fetchTemplate, fillTemplate } = require('./templates');

require('dotenv').config();
const express = require('express');


const app = express();
app.use(express.json());

app.get('/health', (req, res) => {
  res.send('✅ Bot backend is alive');
});

const PORT = process.env.PORT || 8880;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

const supabase = require('./supabaseClient');

app.post('/lead', async (req, res) => {
  const { full_name, phone, email, project, source } = req.body;

const { data, error } = await supabase
  .from('leads')
  .insert([{ full_name, phone, email, project, source }])
  .select(); 

  if (error) {
    console.error('❌ Supabase insert failed:', error.message);
    return res.status(500).json({ error: error.message });
  }

  console.log('✅ New lead inserted:', data);
  res.status(200).json({ message: 'Lead stored', data });
});

app.post('/meta-webhook', async (req, res) => {
  try {
    const body = req.body;

    const changes = body?.entry?.[0]?.changes?.[0];
    const pageId = changes?.value?.page_id;
    const formId = changes?.value?.form_id;
    const leadgenId = changes?.value?.leadgen_id;

    if (!pageId || !formId || !leadgenId) {
      console.error('❌ Missing Meta fields:', { pageId, formId, leadgenId });
      return res.status(400).json({ error: 'Missing page_id, form_id, or leadgen_id' });
    }


    // 🔍 Look up the correct consultant/client/project
  console.log('🧾 Incoming values from Meta:', { pageId, formId, leadgenId });

const { data: pages, error } = await supabase
  .from('pages')
  .select('*')
  .eq('fb_page_id', pageId)
  .eq('form_id', formId)
  .limit(1)
  .maybeSingle();

console.log('🔍 Lookup result:', { pages, error });
    if (error) throw error;

    if (!pages) {
      console.warn('⚠️ Unknown page_id/form_id:', { pageId, formId });
      return res.status(200).json({ message: 'Unmapped lead received' }); // Respond to Meta to avoid retry spam
    }

    console.log('✅ Mapped lead to:', pages);

// 📝 Save placeholder lead
await supabase.from('leads').insert([{
  full_name: null,
  phone: null,
  email: null,
  project: pages.page_name || 'Unknown Project',
  source: `Meta - ${formId}`,
  status: 'new'
}]);

// 🧠 Auto-generate first message
const situation = 'first_touch_new_launch';
const template = await fetchTemplate(situation, pageId, formId);

if (!template) {
  console.warn('⚠️ No template found, skipping message.');
} else {
  const leadData = {
    name: 'there',
    project: pages.page_name || 'this project'
  };

  const finalMessage = fillTemplate(template, leadData);
  console.log('💬 Message to send:', finalMessage);

  sendWhatsAppMessageMock(null, finalMessage); // this now calls the global version
}

res.status(200).json({ message: 'Lead stored (placeholder)' });

} catch (err) {
  console.error('🔥 Webhook error:', err.message);
  res.status(500).json({ error: 'Internal webhook error' });
}
}); // 👈 closes the route handler

// 🔁 Simulate a lead without Meta payload
app.post('/simulate-lead', async (req, res) => {
  const { page_id, form_id } = req.body;

  if (!page_id || !form_id) {
    return res.status(400).json({ error: 'Missing page_id or form_id' });
  }

  try {
    const { data: page, error } = await supabase
      .from('pages')
      .select('*')
      .eq('fb_page_id', page_id)
      .eq('form_id', form_id)
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!page) return res.status(404).json({ error: 'Page/form mapping not found' });

    await supabase.from('leads').insert([{
      full_name: null,
      phone: null,
      email: null,
      project: page.page_name || 'Unknown Project',
      source: `Simulated`,
      status: 'new'
    }]);

    const template = await fetchTemplate('first_touch_new_launch', page_id, form_id);
    if (!template) return res.status(200).json({ message: 'No template found, lead stored' });

    const leadData = {
      name: 'there',
      project: page.page_name
    };

    const finalMessage = fillTemplate(template, leadData);
    sendWhatsAppMessageMock(null, finalMessage);

    res.status(200).json({ message: finalMessage });
  } catch (err) {
    console.error('🔥 Simulate error:', err.message);
    res.status(500).json({ error: 'Simulate failed' });
  }
});


// 🔂 MOCK WhatsApp sender
function sendWhatsAppMessageMock(phone, message) {
  console.log(`📲 [MOCK SEND] Sending WhatsApp message to ${phone || '[no number yet]'}:\n${message}\n`);
}

