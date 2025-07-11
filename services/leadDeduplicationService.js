// services/leadDeduplicationService.js

const logger = require('../logger');
const { createClient } = require('@supabase/supabase-js');
const config = require('../config');

class LeadDeduplicationService {
    constructor() {
        this.supabase = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY);
    }

    /**
     * Generate a duplicate check hash for a lead
     * @param {Object} leadData - Lead data containing phone_number, full_name, email
     * @returns {string} SHA-256 hash for duplicate detection
     */
    generateDuplicateHash(leadData) {
        const { phone_number, full_name, email } = leadData;
        const crypto = require('crypto');
        
        const hashInput = [
            (phone_number || '').toLowerCase().trim(),
            (full_name || '').toLowerCase().trim(),
            (email || '').toLowerCase().trim()
        ].join('|');
        
        return crypto.createHash('sha256').update(hashInput).digest('hex');
    }

    /**
     * Check for potential duplicate leads
     * @param {Object} newLead - New lead data to check
     * @returns {Array} Array of potential duplicate matches
     */
    async findPotentialDuplicates(newLead) {
        const operationId = `find-duplicates-${Date.now()}`;
        
        try {
            logger.info({ operationId, phone: newLead.phone_number }, 'Checking for potential duplicate leads');

            const duplicateHash = this.generateDuplicateHash(newLead);
            const potentialDuplicates = [];

            // 1. Exact phone number match
            if (newLead.phone_number) {
                const { data: phoneMatches, error: phoneError } = await this.supabase
                    .from('leads')
                    .select('id, phone_number, full_name, primary_source, created_at')
                    .eq('phone_number', newLead.phone_number)
                    .neq('id', newLead.id || '00000000-0000-0000-0000-000000000000');

                if (phoneError) {
                    logger.error({ err: phoneError, operationId }, 'Error checking phone duplicates');
                } else if (phoneMatches && phoneMatches.length > 0) {
                    phoneMatches.forEach(match => {
                        potentialDuplicates.push({
                            ...match,
                            match_type: 'phone_exact',
                            confidence_score: 0.95
                        });
                    });
                }
            }

            // 2. Duplicate hash match (phone + name combination)
            if (duplicateHash) {
                const { data: hashMatches, error: hashError } = await this.supabase
                    .from('leads')
                    .select('id, phone_number, full_name, primary_source, created_at, duplicate_check_hash')
                    .eq('duplicate_check_hash', duplicateHash)
                    .neq('id', newLead.id || '00000000-0000-0000-0000-000000000000');

                if (hashError) {
                    logger.error({ err: hashError, operationId }, 'Error checking hash duplicates');
                } else if (hashMatches && hashMatches.length > 0) {
                    hashMatches.forEach(match => {
                        // Avoid adding the same lead twice if already found by phone
                        const alreadyFound = potentialDuplicates.find(dup => dup.id === match.id);
                        if (!alreadyFound) {
                            potentialDuplicates.push({
                                ...match,
                                match_type: 'phone_email_combo',
                                confidence_score: 0.90
                            });
                        }
                    });
                }
            }

            // 3. Fuzzy name + phone match (for slight variations in names)
            if (newLead.full_name && newLead.phone_number) {
                const nameVariations = this.generateNameVariations(newLead.full_name);
                
                for (const nameVariation of nameVariations) {
                    const { data: fuzzyMatches, error: fuzzyError } = await this.supabase
                        .from('leads')
                        .select('id, phone_number, full_name, primary_source, created_at')
                        .eq('phone_number', newLead.phone_number)
                        .ilike('full_name', `%${nameVariation}%`)
                        .neq('id', newLead.id || '00000000-0000-0000-0000-000000000000');

                    if (fuzzyError) {
                        logger.error({ err: fuzzyError, operationId }, 'Error checking fuzzy duplicates');
                    } else if (fuzzyMatches && fuzzyMatches.length > 0) {
                        fuzzyMatches.forEach(match => {
                            const alreadyFound = potentialDuplicates.find(dup => dup.id === match.id);
                            if (!alreadyFound) {
                                potentialDuplicates.push({
                                    ...match,
                                    match_type: 'name_phone_fuzzy',
                                    confidence_score: 0.75
                                });
                            }
                        });
                    }
                }
            }

            logger.info({ 
                operationId, 
                duplicatesFound: potentialDuplicates.length,
                phone: newLead.phone_number 
            }, 'Duplicate check completed');

            return potentialDuplicates;

        } catch (error) {
            logger.error({ err: error, operationId }, 'Error in findPotentialDuplicates');
            return [];
        }
    }

    /**
     * Generate name variations for fuzzy matching
     * @param {string} fullName - Full name to generate variations for
     * @returns {Array} Array of name variations
     */
    generateNameVariations(fullName) {
        if (!fullName) return [];
        
        const variations = [];
        const cleanName = fullName.toLowerCase().trim();
        
        // Add the original name
        variations.push(cleanName);
        
        // Split by spaces and try different combinations
        const nameParts = cleanName.split(/\s+/);
        if (nameParts.length > 1) {
            // First name only
            variations.push(nameParts[0]);
            // Last name only
            variations.push(nameParts[nameParts.length - 1]);
            // First + Last (skip middle names)
            if (nameParts.length > 2) {
                variations.push(`${nameParts[0]} ${nameParts[nameParts.length - 1]}`);
            }
        }
        
        return [...new Set(variations)]; // Remove duplicates
    }

    /**
     * Record a potential duplicate in the deduplication table
     * @param {string} primaryLeadId - ID of the primary lead
     * @param {string} duplicateLeadId - ID of the potential duplicate
     * @param {string} matchType - Type of match found
     * @param {number} confidenceScore - Confidence score (0-1)
     * @returns {Object} Created deduplication record
     */
    async recordPotentialDuplicate(primaryLeadId, duplicateLeadId, matchType, confidenceScore) {
        const operationId = `record-duplicate-${Date.now()}`;
        
        try {
            logger.info({ 
                operationId, 
                primaryLeadId, 
                duplicateLeadId, 
                matchType, 
                confidenceScore 
            }, 'Recording potential duplicate');

            // Check if this duplicate pair already exists
            const { data: existing, error: checkError } = await this.supabase
                .from('lead_deduplication')
                .select('id')
                .or(`and(primary_lead_id.eq.${primaryLeadId},duplicate_lead_id.eq.${duplicateLeadId}),and(primary_lead_id.eq.${duplicateLeadId},duplicate_lead_id.eq.${primaryLeadId})`)
                .single();

            if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows found
                logger.error({ err: checkError, operationId }, 'Error checking existing duplicates');
                return null;
            }

            if (existing) {
                logger.info({ operationId, existingId: existing.id }, 'Duplicate pair already recorded');
                return existing;
            }

            // Create new deduplication record
            const { data: newRecord, error: insertError } = await this.supabase
                .from('lead_deduplication')
                .insert({
                    primary_lead_id: primaryLeadId,
                    duplicate_lead_id: duplicateLeadId,
                    match_type: matchType,
                    confidence_score: confidenceScore,
                    status: 'pending'
                })
                .select()
                .single();

            if (insertError) {
                logger.error({ err: insertError, operationId }, 'Error recording duplicate');
                return null;
            }

            logger.info({ operationId, recordId: newRecord.id }, 'Potential duplicate recorded successfully');
            return newRecord;

        } catch (error) {
            logger.error({ err: error, operationId }, 'Error in recordPotentialDuplicate');
            return null;
        }
    }

    /**
     * Process a new lead for duplicates and record findings
     * @param {Object} newLead - New lead to process
     * @returns {Object} Processing results with duplicate information
     */
    async processNewLeadForDuplicates(newLead) {
        const operationId = `process-lead-duplicates-${newLead.id || Date.now()}`;
        
        try {
            logger.info({ operationId, leadId: newLead.id }, 'Processing new lead for duplicates');

            // Find potential duplicates
            const potentialDuplicates = await this.findPotentialDuplicates(newLead);
            
            if (potentialDuplicates.length === 0) {
                logger.info({ operationId, leadId: newLead.id }, 'No duplicates found');
                return {
                    hasDuplicates: false,
                    duplicateCount: 0,
                    duplicates: []
                };
            }

            // Record each potential duplicate
            const recordedDuplicates = [];
            for (const duplicate of potentialDuplicates) {
                const record = await this.recordPotentialDuplicate(
                    newLead.id,
                    duplicate.id,
                    duplicate.match_type,
                    duplicate.confidence_score
                );
                
                if (record) {
                    recordedDuplicates.push({
                        ...duplicate,
                        deduplication_record_id: record.id
                    });
                }
            }

            logger.info({ 
                operationId, 
                leadId: newLead.id,
                duplicatesFound: potentialDuplicates.length,
                duplicatesRecorded: recordedDuplicates.length
            }, 'Lead duplicate processing completed');

            return {
                hasDuplicates: recordedDuplicates.length > 0,
                duplicateCount: recordedDuplicates.length,
                duplicates: recordedDuplicates
            };

        } catch (error) {
            logger.error({ err: error, operationId, leadId: newLead.id }, 'Error processing lead for duplicates');
            return {
                hasDuplicates: false,
                duplicateCount: 0,
                duplicates: [],
                error: error.message
            };
        }
    }

    /**
     * Get pending duplicates for manual review
     * @param {string} agentId - Optional agent ID to filter by
     * @returns {Array} Array of pending duplicate records
     */
    async getPendingDuplicates(agentId = null) {
        try {
            let query = this.supabase
                .from('lead_deduplication')
                .select(`
                    *,
                    primary_lead:primary_lead_id(id, phone_number, full_name, primary_source, created_at),
                    duplicate_lead:duplicate_lead_id(id, phone_number, full_name, primary_source, created_at)
                `)
                .eq('status', 'pending')
                .order('confidence_score', { ascending: false });

            if (agentId) {
                query = query.or(`primary_lead.assigned_agent_id.eq.${agentId},duplicate_lead.assigned_agent_id.eq.${agentId}`);
            }

            const { data, error } = await query;

            if (error) {
                logger.error({ err: error, agentId }, 'Error fetching pending duplicates');
                return [];
            }

            return data || [];

        } catch (error) {
            logger.error({ err: error, agentId }, 'Error in getPendingDuplicates');
            return [];
        }
    }
}

module.exports = new LeadDeduplicationService();
