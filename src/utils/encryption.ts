import CryptoJS from 'crypto-js';

// Get encryption key from environment variable
// In production, this should be stored securely (e.g., Supabase Vault or environment variable)
const getEncryptionKey = (): string => {
  const key = import.meta.env.VITE_ENCRYPTION_KEY || 'default-key-change-in-production';
  if (key === 'default-key-change-in-production') {
    console.warn('⚠️ Using default encryption key. Set VITE_ENCRYPTION_KEY in production!');
  }
  return key;
};

/**
 * Encrypt sensitive payment data
 */
export const encryptPaymentData = (data: string): string | null => {
  if (!data || data.trim() === '') return null;
  
  try {
    const encrypted = CryptoJS.AES.encrypt(data, getEncryptionKey()).toString();
    return encrypted;
  } catch (error) {
    console.error('Encryption error:', error);
    return null;
  }
};

/**
 * Decrypt sensitive payment data
 */
export const decryptPaymentData = (encryptedData: string | null): string | null => {
  if (!encryptedData || encryptedData.trim() === '') return null;
  
  try {
    const decrypted = CryptoJS.AES.decrypt(encryptedData, getEncryptionKey());
    const decryptedString = decrypted.toString(CryptoJS.enc.Utf8);
    return decryptedString || null;
  } catch (error) {
    console.error('Decryption error:', error);
    return null;
  }
};

/**
 * Mask sensitive data for display (show only last 4 characters)
 */
export const maskPaymentData = (data: string | null): string => {
  if (!data) return '';
  if (data.length <= 4) return '****';
  return '****' + data.slice(-4);
};




