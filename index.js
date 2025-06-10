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
