import CryptoJS from 'crypto-js';

// Key size for AES encryption (256 bits)
const KEY_SIZE = 32;
// IV size for AES encryption (128 bits)
const IV_SIZE = 16;

/**
 * Generate a random encryption key
 * @returns {string} Base64 encoded encryption key
 */
export const generateEncryptionKey = () => {
  const randomBytes = new Uint8Array(KEY_SIZE);
  window.crypto.getRandomValues(randomBytes);
  return arrayBufferToBase64(randomBytes);
};

/**
 * Generate a random initialization vector (IV)
 * @returns {string} Base64 encoded IV
 */
export const generateIV = () => {
  const randomBytes = new Uint8Array(IV_SIZE);
  window.crypto.getRandomValues(randomBytes);
  return arrayBufferToBase64(randomBytes);
};

/**
 * Convert ArrayBuffer to Base64 string
 * @param {ArrayBuffer} buffer - The array buffer to convert
 * @returns {string} Base64 encoded string
 */
export const arrayBufferToBase64 = (buffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
};

/**
 * Convert Base64 string to ArrayBuffer
 * @param {string} base64 - The Base64 string to convert
 * @returns {ArrayBuffer} The resulting array buffer
 */
export const base64ToArrayBuffer = (base64) => {
  const binaryString = window.atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
};

/**
 * Encrypt a message using AES-256-GCM
 * @param {string} message - The message to encrypt
 * @param {string} key - Base64 encoded encryption key
 * @returns {Object} Object containing encrypted data and IV
 */
export const encryptMessage = (message, key) => {
  try {
    // Generate a random IV for this message
    const iv = generateIV();
    
    // Convert key and IV from Base64 to WordArray
    const keyWordArray = CryptoJS.enc.Base64.parse(key);
    const ivWordArray = CryptoJS.enc.Base64.parse(iv);
    
    // Encrypt the message
    const encrypted = CryptoJS.AES.encrypt(message, keyWordArray, {
      iv: ivWordArray,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });
    
    // Return the encrypted message and IV
    return {
      encryptedData: encrypted.toString(),
      iv: iv
    };
  } catch (error) {
    console.error('Encryption error:', error);
    return null;
  }
};

/**
 * Decrypt a message using AES-256-GCM
 * @param {string} encryptedData - The encrypted message
 * @param {string} iv - Base64 encoded IV
 * @param {string} key - Base64 encoded encryption key
 * @returns {string} The decrypted message
 */
export const decryptMessage = (encryptedData, iv, key) => {
  try {
    // Convert key and IV from Base64 to WordArray
    const keyWordArray = CryptoJS.enc.Base64.parse(key);
    const ivWordArray = CryptoJS.enc.Base64.parse(iv);
    
    // Decrypt the message
    const decrypted = CryptoJS.AES.decrypt(encryptedData, keyWordArray, {
      iv: ivWordArray,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });
    
    // Convert the decrypted data to a string
    return decrypted.toString(CryptoJS.enc.Utf8);
  } catch (error) {
    console.error('Decryption error:', error);
    return null;
  }
};

/**
 * Generate a shared secret key using Diffie-Hellman key exchange
 * This is a simplified implementation for demonstration purposes
 * In a real application, you would use a proper Diffie-Hellman implementation
 * @param {string} publicKey - The other party's public key
 * @param {string} privateKey - Your private key
 * @returns {string} The shared secret key
 */
export const generateSharedSecret = (publicKey, privateKey) => {
  // In a real implementation, this would be a proper Diffie-Hellman key exchange
  // For now, we'll just combine the keys and hash them
  const combined = publicKey + privateKey;
  const hash = CryptoJS.SHA256(combined);
  return hash.toString(CryptoJS.enc.Base64);
};

/**
 * Store encryption keys securely in localStorage
 * @param {string} contactId - The contact ID
 * @param {string} key - The encryption key
 */
export const storeEncryptionKey = (contactId, key) => {
  const encryptionKeys = JSON.parse(localStorage.getItem('encryptionKeys') || '{}');
  encryptionKeys[contactId] = key;
  localStorage.setItem('encryptionKeys', JSON.stringify(encryptionKeys));
};

/**
 * Retrieve an encryption key from localStorage
 * @param {string} contactId - The contact ID
 * @returns {string|null} The encryption key or null if not found
 */
export const getEncryptionKey = (contactId) => {
  const encryptionKeys = JSON.parse(localStorage.getItem('encryptionKeys') || '{}');
  return encryptionKeys[contactId] || null;
};
