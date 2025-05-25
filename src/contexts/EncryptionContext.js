import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';
import {
  generateEncryptionKey,
  encryptMessage,
  decryptMessage,
  storeEncryptionKey,
  getEncryptionKey,
  generateSharedSecret
} from '../utils/encryption';

const EncryptionContext = createContext();

export const useEncryption = () => useContext(EncryptionContext);

export const EncryptionProvider = ({ children }) => {
  const { user } = useAuth();
  const [publicKey, setPublicKey] = useState(null);
  const [privateKey, setPrivateKey] = useState(null);
  const [contactKeys, setContactKeys] = useState({});
  const [encryptionEnabled, setEncryptionEnabled] = useState(true);

  // Generate key pair on component mount
  useEffect(() => {
    if (user) {
      // Check if we already have keys in localStorage
      const storedPrivateKey = localStorage.getItem('privateKey');
      const storedPublicKey = localStorage.getItem('publicKey');

      if (storedPrivateKey && storedPublicKey) {
        setPrivateKey(storedPrivateKey);
        setPublicKey(storedPublicKey);
      } else {
        // Generate new keys
        const newPrivateKey = generateEncryptionKey();
        const newPublicKey = generateEncryptionKey(); // In a real app, this would be derived from the private key

        setPrivateKey(newPrivateKey);
        setPublicKey(newPublicKey);

        // Store keys in localStorage
        localStorage.setItem('privateKey', newPrivateKey);
        localStorage.setItem('publicKey', newPublicKey);
      }

      // First load encryption preference from localStorage
      const encryptionPref = localStorage.getItem('encryptionEnabled');
      if (encryptionPref !== null) {
        setEncryptionEnabled(encryptionPref === 'true');
      }

      // Then fetch user settings from the server
      const fetchUserEncryptionSettings = async () => {
        try {
          const response = await axios.get('/api/user/settings', {
            headers: {
              Authorization: `Bearer ${localStorage.getItem('token')}`
            }
          });
          
          if (response.data && response.data.encryptionEnabled !== undefined) {
            // Update state and localStorage with server value
            setEncryptionEnabled(response.data.encryptionEnabled);
            localStorage.setItem('encryptionEnabled', response.data.encryptionEnabled.toString());
          }
        } catch (error) {
          console.error('Error fetching user settings:', error);
          // If there's an error, keep using the localStorage value
        }
      };

      fetchUserEncryptionSettings();
    }
  }, [user]);

  // Exchange keys with a contact
  const exchangeKeys = async (contactId) => {
    try {
      if (!publicKey) return null;

      const response = await axios.post(
        '/api/keys/exchange',
        {
          recipientId: contactId,
          publicKey: publicKey
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      if (response.data.success && response.data.recipientPublicKey) {
        // Generate shared secret
        const sharedSecret = generateSharedSecret(
          response.data.recipientPublicKey,
          privateKey
        );

        // Store the shared secret
        storeEncryptionKey(contactId, sharedSecret);

        // Update state
        setContactKeys(prev => ({
          ...prev,
          [contactId]: sharedSecret
        }));

        return sharedSecret;
      }

      return null;
    } catch (error) {
      console.error('Error exchanging keys:', error);
      return null;
    }
  };

  // Get encryption key for a contact
  const getContactKey = async (contactId) => {
    // Check if we already have a key for this contact
    let key = getEncryptionKey(contactId);
    
    if (key) {
      return key;
    }

    // If not, try to exchange keys
    key = await exchangeKeys(contactId);
    return key;
  };

  // Encrypt a message
  const encrypt = async (message, contactId) => {
    if (!encryptionEnabled) {
      return { text: message, encrypted: false };
    }

    try {
      const key = await getContactKey(contactId);
      
      if (!key) {
        // If we can't get a key, send unencrypted
        return { text: message, encrypted: false };
      }

      const encrypted = encryptMessage(message, key);
      
      if (!encrypted) {
        return { text: message, encrypted: false };
      }

      return {
        text: message, // Original text for display in the UI
        encrypted: true,
        encryptedData: encrypted.encryptedData,
        iv: encrypted.iv
      };
    } catch (error) {
      console.error('Encryption error:', error);
      return { text: message, encrypted: false };
    }
  };

  // Decrypt a message
  const decrypt = (encryptedData, iv, contactId) => {
    if (!encryptionEnabled) {
      return null;
    }

    try {
      const key = getEncryptionKey(contactId);
      
      if (!key) {
        return null;
      }

      return decryptMessage(encryptedData, iv, key);
    } catch (error) {
      console.error('Decryption error:', error);
      return null;
    }
  };

  // Toggle encryption
  const toggleEncryption = async () => {
    const newValue = !encryptionEnabled;
    setEncryptionEnabled(newValue);
    localStorage.setItem('encryptionEnabled', newValue.toString());
    
    // Send the updated encryption setting to the server
    try {
      await axios.post(
        '/api/user/settings/encryption',
        { encryptionEnabled: newValue },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
    } catch (error) {
      console.error('Error updating encryption settings:', error);
    }
  };

  const value = {
    encryptionEnabled,
    toggleEncryption,
    encrypt,
    decrypt,
    exchangeKeys,
    getContactKey
  };

  return (
    <EncryptionContext.Provider value={value}>
      {children}
    </EncryptionContext.Provider>
  );
};
