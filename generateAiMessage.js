
const { Configuration, OpenAIApi } = require('openai');

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

async function generateAiMessage({ name = 'there', project = 'this project', user_input = '', entry_type = 'first_touch' }) {
  const systemPrompt = `
You are a WhatsApp assistant trained under the Property Wealth System (PWS).
You help real estate consultants in Singapore handle property leads casually and consultatively — not salesy.

Your job is to reply like a real local assistant would on WhatsApp, in 2 short messages.
Each message should be max 2 lines, with natural WhatsApp-style breaks (no walls of text).

Only use light Singlish where natural.
Always speak with calm, grounded confidence — not overly polite, not robotic.

---

If entry_type is "first_touch":
- Greet them casually using their name and mention the project if given.
- Assume they came from a Facebook/IG ad — they’re curious but not committed.
- Mention others are also exploring or comparing.

If entry_type is "whatsapp_text":
- You’re replying to what the user said.
- Pick up on their tone: if short, reply short. If they say "ok" or "sure", move to next step.
- If relevant, offer to arrange a short Zoom consult.

Never repeat the same disclaimers.
Never use robotic sentences like "No pressure, up to you."
Never send both messages in one big chunk — they must be spaced.

Return just the full 2-part WhatsApp message, separated by two line breaks.
  `.trim();

  const userPrompt = `
Lead Name: ${name}
Project: ${project}
Stage: ${entry_type}
User said: "${user_input}"

Write a casual, WhatsApp-style reply in 2 short parts with 2 line breaks between.
  `.trim();

  try {
    const completion = await openai.createChatCompletion({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
    });

    return completion.data.choices[0].message.content.trim();
  } catch (error) {
    console.error('❌ OpenAI error:', error.message);
    return `Hey there! Got your enquiry, thanks for reaching out.

If you’re open, can help schedule a quick Zoom to walk through your options.`;
  }
}

module.exports = { generateAiMessage };
