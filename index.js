require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

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

    console.log('📥 Incoming Meta Lead:', { pageId, formId, leadgenId });

    // 🔍 Look up the correct consultant/client/project
    const { data: pages, error } = await supabase
      .from('pages')
      .select('*')
      .eq('fb_page_id', pageId)
      .eq('form_id', formId)
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    if (!pages) {
      console.warn('⚠️ Unknown page_id/form_id:', { pageId, formId });
      return res.status(200).json({ message: 'Unmapped lead received' }); // Respond to Meta to avoid retry spam
    }

    console.log('✅ Mapped lead to:', pages);

    // 📝 Save placeholder lead
    await supabase.from('leads').insert([{
      full_name: null, // you’ll fetch full details later
      phone: null,
      email: null,
      project: pages.page_name || 'Unknown Project',
      source: `Meta - ${formId}`,
      status: 'new'
    }]);

    res.status(200).json({ message: 'Lead stored (placeholder)' });

  } catch (err) {
    console.error('🔥 Webhook error:', err.message);
    res.status(500).json({ error: 'Internal webhook error' });
  }
});
