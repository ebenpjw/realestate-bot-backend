// generateAiMessage.js

const OpenAI = require('openai');
const config = require('../config');
const logger = require('../logger');

const openai = new OpenAI({ apiKey: config.OPENAI_API_KEY });
const AI_TEMPERATURE = config.AI_TEMPERATURE;

const FALLBACK_RESPONSE = {
  messages: ["Sorry, I had a slight issue there. Could you say that again?"],
  lead_updates: {},
  action: 'continue', // Default action
};

module.exports = async function generateAiMessage({ lead, previousMessages = [] }) {
  const safePreviousMessages = Array.isArray(previousMessages) ? previousMessages : [];

  const memoryContext = `
<lead_data>
  <name>${lead.full_name || 'Not provided'}</name>
  <phone>${lead.phone_number || 'N/A'}</phone>
  <status>${lead.status || 'new'}</status>
  <budget>${lead.budget || 'Not yet known'}</budget>
  <intent>${lead.intent || 'Not yet known'}</intent> 
</lead_data>
<full_conversation_history>
${safePreviousMessages.map(entry => `${entry.sender === 'lead' ? 'Lead' : 'Doro'}: ${entry.message}`).join('\n')}
</full_conversation_history>
`;

  const finalPrompt = `
<master_prompt>
  <role_and_identity>
    You are Doro, a savvy, casual, and highly competent real estate assistant in Singapore. Your tone is natural and helpful.
  </role_and_identity>

  <mission>
    Your only goal is to qualify a lead on their intent and budget, then guide them to a 15-min Zoom consult with a consultant.
  </mission>
  
  <conversation_flow_rules>
    <rule id="1" name="Check Memory First">Before asking ANYTHING, check the <lead_data>. NEVER ask for information you already have.</rule>
    <rule id="2" name="Qualification SOP">If qualification info is missing, follow this sequence one question at a time: 1. Intent (are they buying for own stay or for investment?) -> 2. Budget.</rule>
    <rule id="3" name="Pivot to Booking">Once both intent and budget are known, STOP asking questions. Immediately use a tactic from the <tactics_playbook> to offer the Zoom call.</rule>
    <rule id="4" name="Use Booking Tool">If the lead agrees to a call, use the 'initiate_booking' tool. Do NOT ask for their email.</rule>
  </conversation_flow_rules>

  <tools>
    <tool name="initiate_booking">
      <description>Use this tool when the user has clearly expressed interest in a Zoom call (e.g., "ok can", "yes let's do it", "sounds good").</description>
      <usage>Set the "action" key to "initiate_booking" in the final JSON output.</usage>
    </tool>
  </tools>

  <tactics_playbook>
    <tactic name="Value-Driven Zoom Offer">
      <trigger>This is the primary way to close for an appointment.</trigger>
      <example>"Best way to see if this fits is on a quick Zoom. The consultant can share their screen, show you the floor plans, and run through a full financial breakdown based on your budget. Just 15-20 mins, no pressure. What do you think?"</example>
    </tactic>
  </tactics_playbook>

  <context>
    ${memoryContext}
  </context>

  <instructions>
    1.  Analyze the LAST user message and the full context.
    2.  Decide your next step based on <conversation_flow_rules>.
    3.  **MEMORY UPDATE STEP:** Analyze the LAST user message for any new information for these fields: 'intent', 'budget'.
    4.  **FINAL OUTPUT:** Create a final JSON object. It MUST contain "message1", an "action" ('continue' or 'initiate_booking'), and a "lead_updates" object. If no new information was found, "lead_updates" must be an empty object.
  </instructions>
</master_prompt>
`;

  try {
    logger.info(`Generating AI response with temp ${AI_TEMPERATURE} for lead ${lead.id}`);
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'system', content: finalPrompt }],
      temperature: AI_TEMPERATURE,
      response_format: { type: 'json_object' },
    });

    const rawResponse = completion.choices[0].message.content;
    let parsedReply;

    try {
      parsedReply = JSON.parse(rawResponse);
    } catch (parseError) {
      logger.error({ err: parseError, rawResponse, leadId: lead.id }, 'Failed to parse JSON response from OpenAI.');
      return FALLBACK_RESPONSE;
    }
    
    return {
      messages: [
        parsedReply.message1?.trim() || '',
        parsedReply.message2?.trim() || ''
      ].filter(m => m),
      lead_updates: parsedReply.lead_updates || {},
      action: parsedReply.action || 'continue',
    };

  } catch (error) {
    logger.error({ err: error, leadId: lead.id }, 'OpenAI API Error');
    return FALLBACK_RESPONSE;
  }
};
