// api/authHelper.js

const crypto = require('crypto');
const config =require('../config');
const logger = require('../logger');

const algorithm = 'aes-256-gcm';
const encryptionKey = Buffer.from(config.REFRESH_TOKEN_ENCRYPTION_KEY, 'hex');

if (encryptionKey.length !== 32) {
    const errorMessage = 'SECURITY ALERT: REFRESH_TOKEN_ENCRYPTION_KEY must be a 32-byte hex string (64 characters).';
    logger.error({ keyLength: encryptionKey.length }, errorMessage);
    if (config.NODE_ENV === 'production') {
        throw new Error(errorMessage);
    }
}

function encrypt(text) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, encryptionKey, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const tag = cipher.getAuthTag();

    // Combine IV, encrypted data, and tag into a single string
    const combined = `${iv.toString('hex')}:${encrypted}:${tag.toString('hex')}`;

    return {
        iv: iv.toString('hex'),
        encryptedData: combined, // Store combined format for new simplified structure
        tag: tag.toString('hex')
    };
}

function decrypt(encryptedData, iv = null, tag = null) {
    // Handle both old format (separate iv, tag) and new format (combined)
    if (iv && tag) {
        // Old format - separate parameters
        const decipher = crypto.createDecipheriv(algorithm, encryptionKey, Buffer.from(iv, 'hex'));
        decipher.setAuthTag(Buffer.from(tag, 'hex'));
        let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } else {
        // Check if it's new combined format (contains colons)
        if (encryptedData.includes(':')) {
            const parts = encryptedData.split(':');
            if (parts.length !== 3) {
                throw new Error('Invalid encrypted data format');
            }

            const [ivHex, encrypted, tagHex] = parts;
            const decipher = crypto.createDecipheriv(algorithm, encryptionKey, Buffer.from(ivHex, 'hex'));
            decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
            let decrypted = decipher.update(encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            return decrypted;
        } else {
            // Old format without IV/tag - cannot decrypt, needs re-authentication
            throw new Error('Legacy encrypted data format - requires re-authentication');
        }
    }
}

module.exports = { encrypt, decrypt };