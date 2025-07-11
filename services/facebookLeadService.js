// services/facebookLeadService.js

const logger = require('../logger');
const { createClient } = require('@supabase/supabase-js');
const config = require('../config');
const { encrypt, decrypt } = require('../utils/encryption');
const leadDeduplicationService = require('./leadDeduplicationService');

class FacebookLeadService {
    constructor() {
        this.supabase = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY);
    }

    /**
     * Store Facebook page connection for an agent
     * @param {string} agentId - Agent ID
     * @param {Object} pageData - Facebook page data
     * @param {string} accessToken - Page access token
     * @returns {Object} Created page record
     */
    async connectAgentPage(agentId, pageData, accessToken) {
        const operationId = `connect-page-${agentId}-${Date.now()}`;
        
        try {
            logger.info({ 
                operationId, 
                agentId, 
                pageId: pageData.id,
                pageName: pageData.name 
            }, 'Connecting Facebook page to agent');

            // Encrypt the access token
            const encryptedToken = encrypt(accessToken);

            // Check if page is already connected
            const { data: existingPage, error: checkError } = await this.supabase
                .from('facebook_pages')
                .select('id, status')
                .eq('page_id', pageData.id)
                .single();

            if (checkError && checkError.code !== 'PGRST116') {
                logger.error({ err: checkError, operationId }, 'Error checking existing page');
                throw checkError;
            }

            let pageRecord;

            if (existingPage) {
                // Update existing page connection
                const { data: updatedPage, error: updateError } = await this.supabase
                    .from('facebook_pages')
                    .update({
                        agent_id: agentId,
                        page_name: pageData.name,
                        page_category: pageData.category,
                        page_access_token_encrypted: encryptedToken.encryptedData,
                        page_access_token_iv: encryptedToken.iv,
                        page_access_token_tag: encryptedToken.tag,
                        status: 'active',
                        permissions: pageData.permissions || [],
                        last_token_refresh: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', existingPage.id)
                    .select()
                    .single();

                if (updateError) {
                    logger.error({ err: updateError, operationId }, 'Error updating page connection');
                    throw updateError;
                }

                pageRecord = updatedPage;
                logger.info({ operationId, pageId: pageData.id }, 'Updated existing page connection');

            } else {
                // Create new page connection
                const { data: newPage, error: insertError } = await this.supabase
                    .from('facebook_pages')
                    .insert({
                        agent_id: agentId,
                        page_id: pageData.id,
                        page_name: pageData.name,
                        page_category: pageData.category,
                        page_access_token_encrypted: encryptedToken.encryptedData,
                        page_access_token_iv: encryptedToken.iv,
                        page_access_token_tag: encryptedToken.tag,
                        status: 'active',
                        permissions: pageData.permissions || [],
                        lead_ads_enabled: false, // Will be updated when we detect lead ads
                        last_token_refresh: new Date().toISOString()
                    })
                    .select()
                    .single();

                if (insertError) {
                    logger.error({ err: insertError, operationId }, 'Error creating page connection');
                    throw insertError;
                }

                pageRecord = newPage;
                logger.info({ operationId, pageId: pageData.id }, 'Created new page connection');
            }

            return pageRecord;

        } catch (error) {
            logger.error({ err: error, operationId, agentId }, 'Error connecting agent page');
            throw error;
        }
    }

    /**
     * Get Facebook pages for an agent
     * @param {string} agentId - Agent ID
     * @returns {Array} Array of connected Facebook pages
     */
    async getAgentPages(agentId) {
        try {
            const { data: pages, error } = await this.supabase
                .from('facebook_pages')
                .select('id, page_id, page_name, page_category, status, lead_ads_enabled, instagram_connected, webhook_subscribed, created_at')
                .eq('agent_id', agentId)
                .order('created_at', { ascending: false });

            if (error) {
                logger.error({ err: error, agentId }, 'Error fetching agent pages');
                return [];
            }

            return pages || [];

        } catch (error) {
            logger.error({ err: error, agentId }, 'Error in getAgentPages');
            return [];
        }
    }

    /**
     * Get decrypted access token for a Facebook page
     * @param {string} pageId - Facebook page ID
     * @returns {string|null} Decrypted access token
     */
    async getPageAccessToken(pageId) {
        try {
            const { data: page, error } = await this.supabase
                .from('facebook_pages')
                .select('page_access_token_encrypted, page_access_token_iv, page_access_token_tag')
                .eq('page_id', pageId)
                .eq('status', 'active')
                .single();

            if (error) {
                logger.error({ err: error, pageId }, 'Error fetching page access token');
                return null;
            }

            if (!page.page_access_token_encrypted) {
                logger.warn({ pageId }, 'No access token found for page');
                return null;
            }

            // Decrypt the access token
            const decryptedToken = decrypt({
                encryptedData: page.page_access_token_encrypted,
                iv: page.page_access_token_iv,
                tag: page.page_access_token_tag
            });

            return decryptedToken;

        } catch (error) {
            logger.error({ err: error, pageId }, 'Error decrypting page access token');
            return null;
        }
    }

    /**
     * Find agent by Facebook page ID
     * @param {string} pageId - Facebook page ID
     * @returns {Object|null} Agent information
     */
    async findAgentByPageId(pageId) {
        try {
            const { data: pageData, error } = await this.supabase
                .from('facebook_pages')
                .select(`
                    agent_id,
                    page_name,
                    agents:agent_id (
                        id,
                        full_name,
                        email,
                        phone_number,
                        status
                    )
                `)
                .eq('page_id', pageId)
                .eq('status', 'active')
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    logger.warn({ pageId }, 'No agent found for Facebook page');
                    return null;
                }
                logger.error({ err: error, pageId }, 'Error finding agent by page ID');
                return null;
            }

            return {
                agent_id: pageData.agent_id,
                page_name: pageData.page_name,
                agent: pageData.agents
            };

        } catch (error) {
            logger.error({ err: error, pageId }, 'Error in findAgentByPageId');
            return null;
        }
    }

    /**
     * Create lead source record for Facebook/Instagram lead
     * @param {string} leadId - Lead ID
     * @param {Object} sourceData - Source data from Facebook webhook
     * @returns {Object} Created lead source record
     */
    async createLeadSource(leadId, sourceData) {
        const operationId = `create-lead-source-${leadId}-${Date.now()}`;
        
        try {
            logger.info({ 
                operationId, 
                leadId, 
                sourceType: sourceData.source_type,
                pageId: sourceData.page_id 
            }, 'Creating lead source record');

            const { data: sourceRecord, error } = await this.supabase
                .from('lead_sources')
                .insert({
                    lead_id: leadId,
                    source_type: sourceData.source_type,
                    source_platform: sourceData.source_platform,
                    page_id: sourceData.page_id,
                    form_id: sourceData.form_id,
                    ad_id: sourceData.ad_id,
                    campaign_id: sourceData.campaign_id,
                    adset_id: sourceData.adset_id,
                    leadgen_id: sourceData.leadgen_id,
                    campaign_data: sourceData.campaign_data || {},
                    utm_parameters: sourceData.utm_parameters || {},
                    lead_score: sourceData.lead_score || 0,
                    source_quality: sourceData.source_quality || 'unknown'
                })
                .select()
                .single();

            if (error) {
                logger.error({ err: error, operationId }, 'Error creating lead source');
                throw error;
            }

            logger.info({ operationId, sourceId: sourceRecord.id }, 'Lead source created successfully');
            return sourceRecord;

        } catch (error) {
            logger.error({ err: error, operationId, leadId }, 'Error in createLeadSource');
            throw error;
        }
    }

    /**
     * Process Facebook lead from webhook data
     * @param {Object} webhookData - Facebook webhook data
     * @returns {Object} Processing result with lead information
     */
    async processFacebookLead(webhookData) {
        const operationId = `process-fb-lead-${webhookData.leadgen_id}-${Date.now()}`;
        
        try {
            logger.info({ 
                operationId, 
                leadgenId: webhookData.leadgen_id,
                pageId: webhookData.page_id,
                formId: webhookData.form_id 
            }, 'Processing Facebook lead from webhook');

            // 1. Find the agent associated with this page
            const agentInfo = await this.findAgentByPageId(webhookData.page_id);
            if (!agentInfo) {
                logger.error({ operationId, pageId: webhookData.page_id }, 'No agent found for Facebook page');
                return {
                    success: false,
                    error: 'No agent found for Facebook page',
                    leadId: null
                };
            }

            // 2. Fetch lead data from Facebook API (this would require the actual API call)
            // For now, we'll work with the webhook data
            const leadData = {
                phone_number: webhookData.phone_number,
                full_name: webhookData.full_name,
                primary_source: webhookData.source_type === 'instagram' ? 'instagram' : 'facebook',
                assigned_agent_id: agentInfo.agent_id,
                source_details: {
                    page_id: webhookData.page_id,
                    form_id: webhookData.form_id,
                    leadgen_id: webhookData.leadgen_id
                },
                first_contact_method: 'facebook_lead_ads',
                lead_temperature: 'warm'
            };

            // 3. Check for duplicates before creating the lead
            const duplicateCheck = await leadDeduplicationService.processNewLeadForDuplicates(leadData);
            
            if (duplicateCheck.hasDuplicates) {
                logger.warn({ 
                    operationId, 
                    duplicateCount: duplicateCheck.duplicateCount,
                    phone: leadData.phone_number 
                }, 'Potential duplicates found for Facebook lead');
            }

            // 4. Create or update the lead
            let leadRecord;
            const { data: existingLead, error: checkError } = await this.supabase
                .from('leads')
                .select('id')
                .eq('phone_number', leadData.phone_number)
                .single();

            if (checkError && checkError.code !== 'PGRST116') {
                logger.error({ err: checkError, operationId }, 'Error checking existing lead');
                throw checkError;
            }

            if (existingLead) {
                // Update existing lead with new source information
                const { data: updatedLead, error: updateError } = await this.supabase
                    .from('leads')
                    .update({
                        full_name: leadData.full_name || undefined,
                        assigned_agent_id: leadData.assigned_agent_id,
                        source_details: leadData.source_details,
                        last_interaction: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', existingLead.id)
                    .select()
                    .single();

                if (updateError) {
                    logger.error({ err: updateError, operationId }, 'Error updating existing lead');
                    throw updateError;
                }

                leadRecord = updatedLead;
                logger.info({ operationId, leadId: existingLead.id }, 'Updated existing lead with Facebook source');

            } else {
                // Create new lead
                const { data: newLead, error: insertError } = await this.supabase
                    .from('leads')
                    .insert(leadData)
                    .select()
                    .single();

                if (insertError) {
                    logger.error({ err: insertError, operationId }, 'Error creating new lead');
                    throw insertError;
                }

                leadRecord = newLead;
                logger.info({ operationId, leadId: newLead.id }, 'Created new lead from Facebook');
            }

            // 5. Create lead source record
            const sourceData = {
                source_type: webhookData.source_type,
                source_platform: 'facebook_lead_ads',
                page_id: webhookData.page_id,
                form_id: webhookData.form_id,
                ad_id: webhookData.ad_id,
                campaign_id: webhookData.campaign_id,
                adset_id: webhookData.adset_id,
                leadgen_id: webhookData.leadgen_id,
                campaign_data: webhookData.campaign_data || {},
                lead_score: 75, // Default score for Facebook leads
                source_quality: 'medium'
            };

            const sourceRecord = await this.createLeadSource(leadRecord.id, sourceData);

            logger.info({ 
                operationId, 
                leadId: leadRecord.id,
                sourceId: sourceRecord.id,
                agentId: agentInfo.agent_id 
            }, 'Facebook lead processed successfully');

            return {
                success: true,
                leadId: leadRecord.id,
                sourceId: sourceRecord.id,
                agentId: agentInfo.agent_id,
                duplicateInfo: duplicateCheck,
                isNewLead: !existingLead
            };

        } catch (error) {
            logger.error({ err: error, operationId }, 'Error processing Facebook lead');
            return {
                success: false,
                error: error.message,
                leadId: null
            };
        }
    }

    /**
     * Get lead statistics by source for an agent
     * @param {string} agentId - Agent ID
     * @param {number} days - Number of days to look back (default: 30)
     * @returns {Object} Lead statistics
     */
    async getLeadStatsBySource(agentId, days = 30) {
        try {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);

            const { data: stats, error } = await this.supabase
                .from('leads_with_sources') // Using the view we created
                .select('source_type, source_quality, lead_temperature, status')
                .eq('assigned_agent_id', agentId)
                .gte('created_at', startDate.toISOString());

            if (error) {
                logger.error({ err: error, agentId }, 'Error fetching lead stats');
                return {};
            }

            // Process statistics
            const statsSummary = {
                total_leads: stats.length,
                by_source: {},
                by_quality: {},
                by_temperature: {},
                by_status: {}
            };

            stats.forEach(lead => {
                // By source
                const source = lead.source_type || 'unknown';
                statsSummary.by_source[source] = (statsSummary.by_source[source] || 0) + 1;

                // By quality
                const quality = lead.source_quality || 'unknown';
                statsSummary.by_quality[quality] = (statsSummary.by_quality[quality] || 0) + 1;

                // By temperature
                const temperature = lead.lead_temperature || 'unknown';
                statsSummary.by_temperature[temperature] = (statsSummary.by_temperature[temperature] || 0) + 1;

                // By status
                const status = lead.status || 'unknown';
                statsSummary.by_status[status] = (statsSummary.by_status[status] || 0) + 1;
            });

            return statsSummary;

        } catch (error) {
            logger.error({ err: error, agentId }, 'Error in getLeadStatsBySource');
            return {};
        }
    }
}

module.exports = new FacebookLeadService();
