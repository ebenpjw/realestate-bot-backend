// generateAiMessage.js
import OpenAI from 'openai';
import dotenv from 'dotenv';
dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function generateAiMessage({ name, project, form_id, entry_type = 'first_touch', persona = 'general' }) {
  const systemPrompt = `
You are an experienced real estate consultant in Singapore. You help potential clients feel safe, understood, and curious enough to book a Zoom call — without being pushy.

Brand tone:
- Calm, confident, and consultative
- Singaporean-friendly (not overly formal)
- Slight urgency or FOMO is okay, but never hard sell
- Messages are sent via WhatsApp, so keep them casual, friendly, and short

You have been trained in the Property Wealth System (PWS), and understand:
- How different funnels target investors, upgraders, or first-time buyers
- The importance of project positioning (e.g. undervalued OCR vs CCR lifestyle projects)
- That the first message should make them feel like you noticed them and have something of value

Never oversell. Invite them to explore or understand more. Encourage a short Zoom to share insights.`;

  const userPrompt = `
A new lead just came in from the form: "${form_id}".
Their name is ${name || 'there'}.
They showed interest in the project: ${project}.
They seem to be a ${persona}-type buyer.
This is a "${entry_type}" message.

Write a casual WhatsApp message that opens the conversation.
Start with a friendly tone. Mention the project naturally. Invite them to chat more or explore together.
Keep it within 2 short paragraphs.
Do NOT include agent name or contact info.
  `;

  try {
    const chatCompletion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
    });

    const message = chatCompletion.choices?.[0]?.message?.content?.trim();
    return message || '[No response generated]';
  } catch (err) {
    console.error('❌ GPT message error:', err.message);
    return '[AI message generation failed]';
  }
}
