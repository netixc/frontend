/**
 * Security utilities for encrypting/decrypting sensitive data
 */

/**
 * Get the backend URL from settings
 * @returns {string} The backend URL
 */
function getBackendUrl() {
  const settings = JSON.parse(localStorage.getItem('voiceChatSettings') || '{}');
  const backendUrl = settings.backendUrl || 'localhost:8000';

  // Check if it's a local/private IP address
  const isLocalhost = backendUrl.startsWith('localhost') || backendUrl.startsWith('127.0.0.1');
  const isPrivateIP = backendUrl.match(/^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)/);

  // Use http for localhost and private IPs, https for everything else
  const protocol = isLocalhost || isPrivateIP ? 'http' : 'https';
  return `${protocol}://${backendUrl}`;
}

/**
 * Encrypt a sensitive value (like an API key) using server-side encryption
 * @param {string} value - The value to encrypt
 * @returns {Promise<string>} The encrypted value
 */
export async function encryptValue(value) {
  if (!value) return '';

  try {
    const response = await fetch(`${getBackendUrl()}/api/encrypt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ value }),
    });

    if (!response.ok) {
      console.error('Encryption failed:', response.statusText);
      return value; // Fallback to plaintext if encryption fails
    }

    const data = await response.json();
    return data.encrypted;
  } catch (error) {
    console.error('Error encrypting value:', error);
    return value; // Fallback to plaintext if encryption fails
  }
}

/**
 * Decrypt a previously encrypted value
 * @param {string} encrypted - The encrypted value
 * @returns {Promise<string>} The decrypted value
 */
export async function decryptValue(encrypted) {
  if (!encrypted) return '';

  // If it doesn't look encrypted (no base64 characters), return as-is
  if (!/^[A-Za-z0-9+/=]+$/.test(encrypted)) {
    return encrypted;
  }

  try {
    const response = await fetch(`${getBackendUrl()}/api/decrypt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ encrypted }),
    });

    if (!response.ok) {
      console.error('Decryption failed:', response.statusText);
      return encrypted; // Fallback to returning the encrypted value
    }

    const data = await response.json();
    return data.value;
  } catch (error) {
    console.error('Error decrypting value:', error);
    return encrypted; // Fallback to returning the encrypted value
  }
}

/**
 * Load settings with automatic decryption of sensitive fields
 * @returns {Promise<object>} The settings object with decrypted values
 */
export async function loadSecureSettings() {
  const saved = localStorage.getItem('voiceChatSettings');

  // Default settings
  const config = window.APP_CONFIG || { backendUrl: 'localhost:8000', autoProtocol: true };
  const defaults = {
    backendUrl: config.backendUrl,
    wakewordEnabled: false,
    speechLanguage: 'en',
    ttsVoice: 'af_heart',
    speechSpeed: 126,
    llmProvider: 'openai',
    llmModel: 'gpt-4o-mini',
    apiKey: '',
    apiBaseUrl: 'https://api.openai.com/v1',
    geminiApiKey: '',
    agentZeroApiUrl: 'http://192.168.50.40:50080',
    agentZeroApiKey: '',
    logLevel: 'INFO',
    maxAudioQueueSize: 50
  };

  let settings = defaults;
  if (saved) {
    try {
      settings = { ...defaults, ...JSON.parse(saved) };
    } catch (e) {
      console.error('Failed to parse settings:', e);
      return defaults;
    }
  }

  // Decrypt sensitive fields
  const sensitiveFields = ['apiKey', 'geminiApiKey', 'agentZeroApiKey'];
  for (const field of sensitiveFields) {
    if (settings[field]) {
      settings[field] = await decryptValue(settings[field]);
    }
  }

  return settings;
}

/**
 * Save settings with automatic encryption of sensitive fields
 * @param {object} settings - The settings to save
 */
export async function saveSecureSettings(settings) {
  // Clone settings to avoid modifying the original
  const toSave = { ...settings };

  // Encrypt sensitive fields
  const sensitiveFields = ['apiKey', 'geminiApiKey', 'agentZeroApiKey'];
  for (const field of sensitiveFields) {
    if (toSave[field]) {
      toSave[field] = await encryptValue(toSave[field]);
    }
  }

  localStorage.setItem('voiceChatSettings', JSON.stringify(toSave));
  console.log('Settings saved securely');
}
