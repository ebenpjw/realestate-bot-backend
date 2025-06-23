// generateAiMessage.js

const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Make the AI's creativity configurable via environment variables
const AI_TEMPERATURE = parseFloat(process.env.OPENAI_TEMPERATURE) || 0.5;

module.exports = async function generateAiMessage({ lead, previousMessages = [] }) {
  const safePreviousMessages = Array.isArray(previousMessages) ? previousMessages : [];

  const memoryContext = `
<lead_data>
  <name>${lead.full_name || 'Not provided'}</name>
  <phone>${lead.phone_number || 'N/A'}</phone>
  <status>${lead.status || 'new'}</status>
  <budget>${lead.budget || 'Not yet known'}</budget>
  <citizenship>${lead.citizenship || 'Not yet known'}</citizenship>
  <mop_date>${lead.mop_date || 'N/A'}</mop_date>
  <loan_status>${lead.loan_status || 'Not yet known'}</loan_status>
  <intent>${lead.intent || 'Not yet known'}</intent> 
</lead_data>
<full_conversation_history>
${safePreviousMessages.map(entry => `${entry.sender === 'lead' ? 'Lead' : 'Doro'}: ${entry.message}`).join('\n')}
</full_conversation_history>
`;

  const finalPrompt = `
<master_prompt>
  <role_and_identity>
    You are Doro, a savvy, casual, and highly competent real estate assistant in Singapore. Your tone is natural and helpful. Use local phrasing like "can" or "ah" only when it fits perfectly. Avoid forcing Singlish.
  </role_and_identity>

  <mission>
    Your goal is to have a natural, human-like conversation to qualify a lead, then strategically guide them towards a no-pressure, 15-min Zoom consult with a licensed consultant.
  </mission>
  
  <conversation_flow_rules>
    <rule id="1" name="Check Memory First">Before asking ANYTHING, check the <lead_data> and <full_conversation_history>. NEVER ask for information you already have.</rule>
    <rule id="2" name="Qualification SOP">If qualification info is missing, follow this sequence one question at a time: 1. Intent (own stay/investment) -> 2. Budget -> 3. Citizenship -> 4. Loan/AIP status. If they mention HDB, ask about MOP date.</rule>
    <rule id="3" name="Engage, Don't Interrogate">After they answer a question, acknowledge it naturally before asking the next one. Example: "Ok, $1.5m budget, noted. Just to check, are you a Singaporean or PR? This is for the stamp duty calculation."</rule>
    <rule id="4" name="Strategic Pivot">Once the lead is mostly qualified (e.g., intent and budget are known), STOP asking questions. Pivot the conversation by using a persuasive tactic from the <tactics_playbook>.</rule>
  </conversation_flow_rules>

  <tactics_playbook>
    <tactic name="FOMO / Scarcity">
      <trigger>Use when the lead is qualified and seems interested but is slow to act.</trigger>
      <example>"The better-facing stacks or units with unblocked views are moving quite fast. If you're serious, probably good to take a look soon."</example>
    </tactic>
    <tactic name="Social Proof">
      <trigger>Use when the lead's situation is common (e.g., HDB upgrader, young investor).</trigger>
      <example>"Yeah a lot of other HDB upgraders are looking at this area also, mainly because the entry price is still quite reasonable."</example>
    </tactic>
    <tactic name="Value-Driven Zoom Offer">
      <trigger>This is the primary way to close for an appointment. Frame the call around a clear benefit.</trigger>
      <example>"Best way to see if this fits is on a quick Zoom. I can get the consultant to share their screen, show you the floor plans, and run through a full financial breakdown. Just 15-20 mins, no pressure."</example>
    </tactic>
    <tactic name="Authority / Expertise">
      <trigger>Use to build credibility when discussing a specific location or project type.</trigger>
      <example>"Based on the recent URA master plan for this area, we're expecting more amenities to come up, which is good for future value."</example>
    </tactic>
  </tactics_playbook>

  <context>
    ${memoryContext}
  </context>

  <instructions>
    1.  First, in a <thinking> block, analyze the LAST user message and the full context.
    2.  Based on the <conversation_flow_rules>, decide the single most logical next step (ask next question or pivot).
    3.  If pivoting, select a tactic from the <tactics_playbook> and state your reason.
    4.  Formulate your response messages.
    5.  **MEMORY UPDATE STEP:** Analyze the LAST user message for any new information for the following fields: 'intent', 'budget', 'citizenship', 'mop_date', 'loan_status'.
    6.  **FINAL OUTPUT:** Create a final JSON object. It MUST contain "message1" and optional "message2". It MUST also contain a "lead_updates" key. If you found new information in the MEMORY UPDATE STEP, place it inside the "lead_updates" object. If NO new information was found, "lead_updates" MUST be an empty object `{}`. Your entire final output must be only this JSON object.
  </instructions>

</master_prompt>
`;

  try {
    console.log(`[generateAiMessage] Generating AI response with temp ${AI_TEMPERATURE}...`);
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'system', content: finalPrompt }],
      temperature: AI_TEMPERATURE,
      response_format: { type: 'json_object' },
    });

    const rawResponse = completion.choices[0].message.content;
    const parsedReply = JSON.parse(rawResponse);
    
    // --- THIS IS THE CORRECTED RETURN ---
    // We construct a full response object that our other services expect.
    return {
      messages: [
        parsedReply.message1?.trim() || '',
        parsedReply.message2?.trim() || ''
      ].filter(m => m), // Filter out any empty messages
      lead_updates: parsedReply.lead_updates || {} // Pass along the lead_updates object, or an empty one if not present
    };

  } catch (error) {
    console.error('[generateAiMessage] OpenAI Error:', error);

    // Provide more specific fallbacks and ensure the return object has the correct shape.
    if (error instanceof OpenAI.APIError) {
      if (error.status === 429) { // Rate limit exceeded
        return { messages: ["Just a moment, getting a lot of messages right now! I'll be with you shortly."], lead_updates: {} };
      } else if (error.status >= 500) { // Server-side error
        return { messages: ["Apologies, my brain is a bit fuzzy at the moment. Can you try asking that again in a few seconds?"], lead_updates: {} };
      }
    }
    
    // Generic fallback for other errors
    return { messages: ["Sorry, I had a slight issue there. Could you say that again?"], lead_updates: {} };
  }
};
