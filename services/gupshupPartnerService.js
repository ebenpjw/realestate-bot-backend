const axios = require('axios');
const crypto = require('crypto');
const config = require('../config');
const logger = require('../logger');
const { supabase } = require('../database/supabaseClient');

/**
 * Gupshup Partner API Service
 * Handles Partner API operations for multi-tenant WABA management
 * 
 * Key Features:
 * - Partner authentication and token management
 * - App creation and management per agent
 * - Phone number registration for each app
 * - Template creation and approval automation
 * - WABA health monitoring
 */
class GupshupPartnerService {
  constructor() {
    this.baseURL = 'https://partner.gupshup.io/partner';
    this.partnerToken = null;
    this.tokenExpiry = null;
    this.partnerEmail = config.GUPSHUP_PARTNER_EMAIL;
    this.partnerPassword = config.GUPSHUP_PARTNER_PASSWORD;
    this.encryptionKey = config.REFRESH_TOKEN_ENCRYPTION_KEY;

    // Rate limiting configuration
    this.rateLimitDelay = 1000; // 1 second between requests
    this.lastRequestTime = 0;
    this.maxRetries = 3;
    this.retryDelay = 2000; // 2 seconds initial retry delay

    if (!this.partnerEmail || !this.partnerPassword) {
      throw new Error('Gupshup Partner API credentials not configured');
    }

    // Create axios instance with configuration
    this._createAxiosClient();

    logger.info('Gupshup Partner Service initialized');
  }

  /**
   * Create axios client with default configuration
   * @private
   */
  _createAxiosClient() {
    this.axios = axios.create({
      baseURL: this.baseURL,
      timeout: config.GUPSHUP_TIMEOUT || 30000,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'RealEstateBot-PartnerAPI/1.0'
      }
    });

    // Add request interceptor for logging
    this.axios.interceptors.request.use(
      (config) => {
        logger.debug({
          method: config.method?.toUpperCase(),
          url: config.url,
          headers: config.headers
        }, 'Partner API request');
        return config;
      },
      (error) => {
        logger.error({ err: error }, 'Partner API request error');
        return Promise.reject(error);
      }
    );

    // Add response interceptor for logging
    this.axios.interceptors.response.use(
      (response) => {
        logger.debug({
          status: response.status,
          url: response.config.url,
          data: response.data
        }, 'Partner API response');
        return response;
      },
      (error) => {
        logger.error({
          err: error,
          status: error.response?.status,
          data: error.response?.data,
          url: error.config?.url
        }, 'Partner API response error');
        return Promise.reject(error);
      }
    );
  }

  /**
   * Rate limiting helper to prevent API abuse
   * @private
   */
  async _enforceRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.rateLimitDelay) {
      const waitTime = this.rateLimitDelay - timeSinceLastRequest;
      logger.debug({ waitTime }, 'Rate limiting: waiting before next request');
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Retry helper with exponential backoff
   * @private
   */
  async _retryWithBackoff(operation, retries = this.maxRetries) {
    try {
      await this._enforceRateLimit();
      return await operation();
    } catch (error) {
      if (retries > 0 && this._isRetryableError(error)) {
        const delay = this.retryDelay * (this.maxRetries - retries + 1);
        logger.warn({
          err: error,
          retriesLeft: retries - 1,
          delay
        }, 'Retrying Partner API request');

        await new Promise(resolve => setTimeout(resolve, delay));
        return this._retryWithBackoff(operation, retries - 1);
      }
      throw error;
    }
  }

  /**
   * Check if error is retryable
   * @private
   */
  _isRetryableError(error) {
    if (!error.response) return true; // Network errors are retryable

    const status = error.response.status;
    return status === 429 || // Rate limited
           status === 502 || // Bad gateway
           status === 503 || // Service unavailable
           status === 504;   // Gateway timeout
  }

  /**
   * Encrypt sensitive data
   * @private
   */
  _encrypt(text) {
    try {
      const algorithm = 'aes-256-gcm';
      const key = Buffer.from(this.encryptionKey, 'hex');
      const iv = crypto.randomBytes(16);

      const cipher = crypto.createCipheriv(algorithm, key, iv);
      cipher.setAAD(Buffer.from('partner-token', 'utf8'));

      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const tag = cipher.getAuthTag();

      return {
        encrypted,
        iv: iv.toString('hex'),
        tag: tag.toString('hex')
      };
    } catch (error) {
      logger.error({ err: error }, 'Failed to encrypt sensitive data');
      throw new Error('Encryption failed');
    }
  }

  /**
   * Decrypt sensitive data
   * @private
   */
  _decrypt(encryptedData) {
    try {
      const algorithm = 'aes-256-gcm';
      const key = Buffer.from(this.encryptionKey, 'hex');
      const iv = Buffer.from(encryptedData.iv, 'hex');

      const decipher = crypto.createDecipheriv(algorithm, key, iv);
      decipher.setAAD(Buffer.from('partner-token', 'utf8'));
      decipher.setAuthTag(Buffer.from(encryptedData.tag, 'hex'));

      let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      logger.error({ err: error }, 'Failed to decrypt sensitive data');
      throw new Error('Decryption failed');
    }
  }

  /**
   * Get partner authentication token
   * @returns {Promise<string>} Partner token
   */
  async getPartnerToken() {
    try {
      // Check if we have a valid cached token
      if (this.partnerToken && this.tokenExpiry > Date.now()) {
        return this.partnerToken;
      }

      // Try to get token from database first
      const { data: tokenData, error } = await supabase
        .from('partner_api_tokens')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!error && tokenData && new Date(tokenData.expires_at) > new Date()) {
        // Decrypt and use stored token
        const decryptedToken = this._decrypt({
          encrypted: tokenData.token_encrypted,
          iv: tokenData.token_iv,
          tag: tokenData.token_tag
        });
        
        this.partnerToken = decryptedToken;
        this.tokenExpiry = new Date(tokenData.expires_at).getTime();
        
        logger.info('Using cached Partner API token from database');
        return this.partnerToken;
      }

      // Get new token from Partner API
      logger.info('Requesting new Partner API token');
      
      const response = await this.axios.post('/account/login', new URLSearchParams({
        email: this.partnerEmail,
        password: this.partnerPassword
      }));

      if (!response.data || !response.data.token) {
        throw new Error('Invalid response from Partner API login');
      }

      this.partnerToken = response.data.token;
      // Set expiry to 23 hours from now (tokens last 24 hours)
      this.tokenExpiry = Date.now() + (23 * 60 * 60 * 1000);

      // Store encrypted token in database
      const encryptedToken = this._encrypt(this.partnerToken);

      // Clear old tokens (keep only the latest 5 tokens for safety)
      const { data: existingTokens } = await supabase
        .from('partner_api_tokens')
        .select('id')
        .order('created_at', { ascending: false })
        .limit(5);

      if (existingTokens && existingTokens.length >= 5) {
        const tokensToDelete = existingTokens.slice(4); // Keep first 4, delete the rest
        const idsToDelete = tokensToDelete.map(t => t.id);

        if (idsToDelete.length > 0) {
          await supabase
            .from('partner_api_tokens')
            .delete()
            .in('id', idsToDelete);
        }
      }

      // Insert new token
      await supabase.from('partner_api_tokens').insert({
        token_encrypted: encryptedToken.encrypted,
        token_iv: encryptedToken.iv,
        token_tag: encryptedToken.tag,
        expires_at: new Date(this.tokenExpiry).toISOString()
      });

      logger.info('Partner API token obtained and stored successfully');
      return this.partnerToken;

    } catch (error) {
      logger.error({ err: error }, 'Failed to get Partner API token');
      throw new Error(`Partner API authentication failed: ${error.message}`);
    }
  }

  /**
   * Create a new WABA app for an agent
   * @param {Object} params - App parameters
   * @param {string} params.name - App name (must be unique)
   * @param {boolean} params.templateMessaging - Enable template messaging
   * @returns {Promise<Object>} Created app details
   */
  async createApp(params) {
    // Validate input parameters
    if (!params.name || typeof params.name !== 'string') {
      throw new Error('App name is required and must be a string');
    }

    if (params.name.length < 3 || params.name.length > 50) {
      throw new Error('App name must be between 3 and 50 characters');
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(params.name)) {
      throw new Error('App name can only contain letters, numbers, underscores, and hyphens');
    }

    return this._retryWithBackoff(async () => {
      const token = await this.getPartnerToken();

      const requestData = new URLSearchParams({
        name: params.name,
        templateMessaging: params.templateMessaging !== false ? 'true' : 'false'
      });

      const response = await this.axios.post('/app', requestData, {
        headers: {
          'token': token
        }
      });

      if (!response.data || !response.data.appId) {
        throw new Error('Invalid response from app creation');
      }

      logger.info({
        appId: response.data.appId,
        appName: params.name
      }, 'Partner API app created successfully');

      return {
        appId: response.data.appId,
        name: params.name,
        templateMessaging: params.templateMessaging !== false
      };
    }).catch(error => {
      logger.error({
        err: error,
        appName: params.name
      }, 'Failed to create Partner API app');

      if (error.response?.status === 409) {
        throw new Error(`App name "${params.name}" already exists. Please choose a different name.`);
      }

      if (error.response?.status === 400) {
        throw new Error(`Invalid app parameters: ${error.response.data?.message || error.message}`);
      }

      throw new Error(`Failed to create app: ${error.message}`);
    });
  }

  /**
   * Get all apps linked to partner account
   * @returns {Promise<Array>} List of partner apps
   */
  async getPartnerApps() {
    try {
      const token = await this.getPartnerToken();
      
      const response = await this.axios.get('/account/api/partnerApps', {
        headers: {
          'Authorization': token
        }
      });

      if (!response.data || response.data.status !== 'success') {
        throw new Error('Invalid response from get partner apps');
      }

      return response.data.partnerAppsList || [];

    } catch (error) {
      logger.error({ err: error }, 'Failed to get partner apps');
      throw new Error(`Failed to get partner apps: ${error.message}`);
    }
  }

  /**
   * Register phone number for an app
   * @param {Object} params - Registration parameters
   * @param {string} params.appId - App ID
   * @param {string} params.phoneNumber - Phone number to register
   * @returns {Promise<Object>} Registration result
   */
  async registerPhoneForApp(params) {
    try {
      const token = await this.getPartnerToken();
      
      const requestData = new URLSearchParams({
        appId: params.appId,
        phoneNumber: params.phoneNumber
      });

      const response = await this.axios.post('/app/registerPhone', requestData, {
        headers: {
          'token': token
        }
      });

      logger.info({
        appId: params.appId,
        phoneNumber: params.phoneNumber,
        response: response.data
      }, 'Phone number registered for app');

      return response.data;

    } catch (error) {
      logger.error({
        err: error,
        appId: params.appId,
        phoneNumber: params.phoneNumber
      }, 'Failed to register phone for app');
      
      throw new Error(`Failed to register phone: ${error.message}`);
    }
  }

  /**
   * Get access token for a specific app
   * @param {string} appId - App ID
   * @returns {Promise<string>} App access token
   */
  async getAppAccessToken(appId) {
    try {
      const token = await this.getPartnerToken();
      
      const response = await this.axios.get(`/app/${appId}/token`, {
        headers: {
          'Authorization': token
        }
      });

      if (!response.data || !response.data.token) {
        throw new Error('Invalid response from get app token');
      }

      return response.data.token;

    } catch (error) {
      logger.error({
        err: error,
        appId
      }, 'Failed to get app access token');
      
      throw new Error(`Failed to get app token: ${error.message}`);
    }
  }
}

module.exports = new GupshupPartnerService();
