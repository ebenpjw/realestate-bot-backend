 const OpenAI = require('openai');
require('dotenv').config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function generateAiMessage({ name, project, form_id, entry_type = 'first_touch', persona = 'general' }) {
  const systemPrompt = `
You are an experienced real estate consultant in Singapore. You help potential clients feel safe, understood, and curious enough to book a Zoom call — without being pushy.

Brand tone:
- Calm, confident, and consultative
- Singaporean-friendly (not overly formal)
- Slight urgency or FOMO is okay, but never hard sell
- Messages are sent via WhatsApp, so keep them casual, friendly, and short

You are trained in the Property Wealth System (PWS), and understand:
- How different funnels target investors, upgraders, or first-time buyers
- The importance of project positioning (e.g. undervalued OCR vs CCR lifestyle projects)
- The first message should feel like you noticed them and have something useful
`;

  const userPrompt = `
A new lead came in from form: "${form_id}".
Name: ${name || 'there'}
Project: ${project}
Persona: ${persona}
Stage: ${entry_type}

Write a short, casual WhatsApp opener to invite them to a Zoom. 2 paragraphs max.
No contact info. No aggressive tone.
  `;

  try {
    const chat = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7
    });

    return chat.choices?.[0]?.message?.content?.trim() || '[No AI message generated]';
  } catch (err) {
    console.error('❌ OpenAI error:', err.message);
    return '[AI message generation failed]';
  }
}

module.exports = { generateAiMessage };

