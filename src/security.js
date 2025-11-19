/**
 * Security utilities for managing sensitive data
 *
 * WARNING: API keys are currently stored in plaintext in localStorage.
 * This is a known security limitation. For production use, consider:
 * - Using backend API key management
 * - Implementing proper encryption with key management
 * - Using sessionStorage instead (cleared on tab close)
 * - Never committing API keys to version control
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
 * Load settings from localStorage
 * @returns {object} The settings object
 */
export function loadSecureSettings() {
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

  return settings;
}

/**
 * Save settings to localStorage
 * @param {object} settings - The settings to save
 */
export function saveSecureSettings(settings) {
  // Warn about API keys stored in plaintext
  if (settings.apiKey || settings.geminiApiKey || settings.agentZeroApiKey) {
    console.warn('⚠️ Security Warning: API keys are stored in plaintext in localStorage. ' +
                 'Do not use this application on shared or public computers. ' +
                 'For production use, implement proper API key management on the backend.');
  }

  localStorage.setItem('voiceChatSettings', JSON.stringify(settings));
  console.log('Settings saved');
}
