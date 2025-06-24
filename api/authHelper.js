// api/authHelper.js

const crypto = require('crypto');
const config =require('../config');
const logger = require('../logger');

const algorithm = 'aes-256-gcm';
const encryptionKey = Buffer.from(config.REFRESH_TOKEN_ENCRYPTION_KEY, 'hex');

if (encryptionKey.length !== 32) {
    logger.error({ keyLength: encryptionKey.length }, 'SECURITY ALERT: REFRESH_TOKEN_ENCRYPTION_KEY must be a 32-byte hex string (64 characters).');
    if (config.NODE_ENV === 'production') process.exit(1);
}

function encrypt(text) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, encryptionKey, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const tag = cipher.getAuthTag();
    return {
        iv: iv.toString('hex'),
        encryptedData: encrypted,
        tag: tag.toString('hex')
    };
}

function decrypt(encryptedData, iv, tag) {
    const decipher = crypto.createDecipheriv(algorithm, encryptionKey, Buffer.from(iv, 'hex'));
    decipher.setAuthTag(Buffer.from(tag, 'hex'));
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

module.exports = { encrypt, decrypt };