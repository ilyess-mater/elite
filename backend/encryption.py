import os
import base64
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives import padding
from cryptography.hazmat.backends import default_backend

# Key size for AES encryption (256 bits)
KEY_SIZE = 32
# IV size for AES encryption (128 bits)
IV_SIZE = 16

def generate_encryption_key():
    """Generate a random encryption key"""
    return os.urandom(KEY_SIZE)

def generate_iv():
    """Generate a random initialization vector (IV)"""
    return os.urandom(IV_SIZE)

def encrypt_message(message, key, iv=None):
    """
    Encrypt a message using AES-256-CBC
    
    Args:
        message (str): The message to encrypt
        key (bytes): The encryption key
        iv (bytes, optional): The initialization vector. If None, a random IV will be generated.
        
    Returns:
        dict: A dictionary containing the encrypted data and IV
    """
    try:
        # Convert message to bytes if it's a string
        if isinstance(message, str):
            message = message.encode('utf-8')
            
        # Generate a random IV if none is provided
        if iv is None:
            iv = generate_iv()
            
        # Pad the message to a multiple of the block size
        padder = padding.PKCS7(algorithms.AES.block_size).padder()
        padded_message = padder.update(message) + padder.finalize()
        
        # Create an encryptor
        cipher = Cipher(algorithms.AES(key), modes.CBC(iv), backend=default_backend())
        encryptor = cipher.encryptor()
        
        # Encrypt the message
        encrypted_data = encryptor.update(padded_message) + encryptor.finalize()
        
        # Return the encrypted data and IV as base64 strings
        return {
            'encrypted_data': base64.b64encode(encrypted_data).decode('utf-8'),
            'iv': base64.b64encode(iv).decode('utf-8')
        }
    except Exception as e:
        print(f"Encryption error: {e}")
        return None

def decrypt_message(encrypted_data, iv, key):
    """
    Decrypt a message using AES-256-CBC
    
    Args:
        encrypted_data (str): Base64 encoded encrypted data
        iv (str): Base64 encoded initialization vector
        key (bytes): The encryption key
        
    Returns:
        str: The decrypted message
    """
    try:
        # Convert base64 strings to bytes
        encrypted_data = base64.b64decode(encrypted_data)
        iv = base64.b64decode(iv)
        
        # Create a decryptor
        cipher = Cipher(algorithms.AES(key), modes.CBC(iv), backend=default_backend())
        decryptor = cipher.decryptor()
        
        # Decrypt the message
        padded_message = decryptor.update(encrypted_data) + decryptor.finalize()
        
        # Unpad the message
        unpadder = padding.PKCS7(algorithms.AES.block_size).unpadder()
        message = unpadder.update(padded_message) + unpadder.finalize()
        
        # Return the decrypted message as a string
        return message.decode('utf-8')
    except Exception as e:
        print(f"Decryption error: {e}")
        return None

def generate_key_pair():
    """
    Generate a key pair for key exchange
    This is a simplified implementation for demonstration purposes
    In a real application, you would use a proper asymmetric encryption algorithm
    
    Returns:
        tuple: A tuple containing the public and private keys
    """
    private_key = os.urandom(KEY_SIZE)
    # In a real implementation, this would be derived from the private key
    # using a proper asymmetric algorithm
    public_key = os.urandom(KEY_SIZE)
    return public_key, private_key

def generate_shared_secret(public_key, private_key):
    """
    Generate a shared secret key using a key exchange protocol
    This is a simplified implementation for demonstration purposes
    In a real application, you would use a proper key exchange protocol
    
    Args:
        public_key (bytes): The other party's public key
        private_key (bytes): Your private key
        
    Returns:
        bytes: The shared secret key
    """
    # In a real implementation, this would be a proper key exchange calculation
    # For now, we'll just combine the keys and hash them
    import hashlib
    combined = public_key + private_key
    hash_obj = hashlib.sha256(combined)
    return hash_obj.digest()
