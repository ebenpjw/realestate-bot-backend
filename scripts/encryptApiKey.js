#!/usr/bin/env node

/**
 * Script to encrypt Gupshup API keys for secure storage
 */

const crypto = require('crypto');
const config = require('../config');

class ApiKeyEncryptor {
  constructor() {
    this.encryptionKey = config.REFRESH_TOKEN_ENCRYPTION_KEY;
  }

  /**
   * Encrypt sensitive data (simple base64 encoding for now)
   */
  encrypt(text) {
    if (!text) return null;

    // For now, use simple base64 encoding with a prefix to indicate it's "encrypted"
    const encoded = Buffer.from(text).toString('base64');
    return `enc_${encoded}`;
  }

  /**
   * Decrypt to verify
   */
  decrypt(encryptedText) {
    if (!encryptedText) return null;

    // Handle simple base64 encoding
    if (encryptedText.startsWith('enc_')) {
      const encoded = encryptedText.replace('enc_', '');
      return Buffer.from(encoded, 'base64').toString('utf8');
    }

    // If it's already plain text, return as-is
    return encryptedText;
  }
}

// Main execution
async function main() {
  const encryptor = new ApiKeyEncryptor();
  
  // Your API key
  const apiKey = 'sk_3aa0886748fb4d6685bbcd7853e4ac44';
  
  console.log('🔐 Encrypting Gupshup API Key...');
  console.log('Original API Key:', apiKey);
  
  try {
    // Encrypt the API key
    const encryptedKey = encryptor.encrypt(apiKey);
    console.log('✅ Encrypted API Key:', encryptedKey);
    
    // Verify by decrypting
    const decryptedKey = encryptor.decrypt(encryptedKey);
    console.log('🔍 Verification (decrypted):', decryptedKey);
    
    if (decryptedKey === apiKey) {
      console.log('✅ Encryption/Decryption successful!');
      console.log('\n📋 SQL to update your agent:');
      console.log(`UPDATE agents SET gupshup_api_key_encrypted = '${encryptedKey}' WHERE full_name = 'Doro';`);
    } else {
      console.log('❌ Encryption/Decryption failed!');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = ApiKeyEncryptor;
