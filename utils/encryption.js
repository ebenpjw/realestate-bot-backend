// utils/encryption.js

const crypto = require('crypto');
const config = require('../config');

// Use the encryption key from config
const ENCRYPTION_KEY = config.REFRESH_TOKEN_ENCRYPTION_KEY;
const ALGORITHM = 'aes-256-cbc';

/**
 * Encrypt sensitive data using AES-256-CBC (simpler and more reliable)
 * @param {string} text - Text to encrypt
 * @returns {Object} Object containing encrypted data and IV
 */
function encrypt(text) {
    try {
        if (!text) {
            throw new Error('Text to encrypt cannot be empty');
        }

        if (!ENCRYPTION_KEY) {
            throw new Error('Encryption key not configured');
        }

        // Generate a random initialization vector
        const iv = crypto.randomBytes(16);

        // Create cipher
        const cipher = crypto.createCipher(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'));

        // Encrypt the text
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        return {
            encryptedData: encrypted,
            iv: iv.toString('hex'),
            tag: null // Not used in CBC mode, but keeping for compatibility
        };

    } catch (error) {
        throw new Error(`Encryption failed: ${error.message}`);
    }
}

/**
 * Decrypt sensitive data using AES-256-CBC
 * @param {Object} encryptedObj - Object containing encrypted data and IV
 * @param {string} encryptedObj.encryptedData - Encrypted data
 * @param {string} encryptedObj.iv - Initialization vector (not used in createCipher)
 * @param {string} encryptedObj.tag - Authentication tag (not used in CBC mode)
 * @returns {string} Decrypted text
 */
function decrypt(encryptedObj) {
    try {
        if (!encryptedObj || !encryptedObj.encryptedData) {
            throw new Error('Invalid encrypted data object');
        }

        if (!ENCRYPTION_KEY) {
            throw new Error('Encryption key not configured');
        }

        const { encryptedData } = encryptedObj;

        // Create decipher
        const decipher = crypto.createDecipher(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'));

        // Decrypt the data
        let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;

    } catch (error) {
        throw new Error(`Decryption failed: ${error.message}`);
    }
}

/**
 * Generate a new encryption key (for setup purposes)
 * @returns {string} Hex-encoded encryption key
 */
function generateEncryptionKey() {
    return crypto.randomBytes(32).toString('hex');
}

module.exports = {
    encrypt,
    decrypt,
    generateEncryptionKey
};
