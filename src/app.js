(function() {
  const originalLog = console.log.bind(console);
  console.log = (...args) => {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    const ms = String(now.getMilliseconds()).padStart(3, '0');
    originalLog(
      `[${hh}:${mm}:${ss}.${ms}]`,
      ...args
    );
  };
})();

const statusDiv = document.getElementById("status");
const messagesDiv = document.getElementById("messages");
const speedSlider = document.getElementById("speedSlider");
const eventStreamDiv = document.getElementById("eventStream");
speedSlider.disabled = true;  // start disabled

// Tab switching
const tabs = document.querySelectorAll('.tab');
const panels = document.querySelectorAll('.panel');

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const targetTab = tab.getAttribute('data-tab');

    // Update tabs
    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    // Update panels
    panels.forEach(panel => {
      panel.classList.remove('active');
      if (panel.id === `${targetTab}Panel`) {
        panel.classList.add('active');
      }
    });

    // Load agents when switching to agents tab
    if (targetTab === 'agents') {
      loadAgents();
    }
  });
});

let socket = null;
let audioContext = null;
let mediaStream = null;
let micWorkletNode = null;
let ttsWorkletNode = null;

let isTTSPlaying = false;
let ignoreIncomingTTS = false;
let micEnabled = true;  // Microphone mute state

let chatHistory = [];
let typingUser = "";
let typingAssistant = "";

// Agent management
let agents = [];
const agentList = document.getElementById("agentList");
const createAgentBtn = document.getElementById("createAgentBtn");
const createAgentModal = document.getElementById("createAgentModal");
const closeAgentModal = document.getElementById("closeAgentModal");
const createAgentForm = document.getElementById("createAgentForm");

// Event logging - matching RealtimeVoiceClient implementation
let events = [];
let eventFilter = 'agent'; // 'all' or 'agent' - default to agent events only

function logEvent(type, data) {
  const event = {
    type: type,
    timestamp: new Date().toISOString(),
    data: data
  };

  events.unshift(event);
  if (events.length > 100) events.pop(); // Keep last 100 events
  renderEvents();
}

function isAgentEvent(eventType) {
  const agentEventTypes = [
    'agent_created',
    'agent_deleted',
    'agent_command',
    'function_call'
  ];
  return agentEventTypes.includes(eventType);
}

function renderEvents() {
  // Filter events based on current filter
  const filteredEvents = eventFilter === 'agent'
    ? events.filter(event => isAgentEvent(event.type))
    : events;

  if (filteredEvents.length === 0) {
    const emptyMessage = eventFilter === 'agent'
      ? 'No agent events yet'
      : 'No events yet';
    const emptyDetail = eventFilter === 'agent'
      ? 'Agent events will appear here when agents are active'
      : 'Events will appear here when the connection is active';

    eventStreamDiv.innerHTML = `
      <div class="empty-state" style="color: #888;">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>
        </svg>
        <p>${emptyMessage}</p>
        <p style="font-size: 12px; margin-top: 8px;">${emptyDetail}</p>
      </div>
    `;
    return;
  }

  eventStreamDiv.innerHTML = filteredEvents.map(event => {
    const timestamp = new Date(event.timestamp).toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3
    });
    const eventClass = event.type || 'info';
    const eventTypeLabel = (event.type || 'event').toUpperCase().replace(/_/g, ' ');

    let eventData = '';
    if (typeof event.data === 'object') {
      eventData = JSON.stringify(event.data, null, 2);
    } else if (event.data) {
      eventData = event.data;
    }

    return `
      <div class="event ${eventClass}">
        <div class="event-type">${eventTypeLabel}</div>
        <div class="event-timestamp">${timestamp}</div>
        ${eventData ? `<div class="event-data">${escapeHtml(eventData)}</div>` : ''}
      </div>
    `;
  }).join('');

  // Scroll to bottom
  eventStreamDiv.scrollTop = eventStreamDiv.scrollHeight;
}

// Agent Management Functions
async function loadAgents() {
  try {
    const settings = loadSettings();
    const wsProto = window.location.protocol === 'https:' ? 'https:' : 'http:';
    const backendUrl = settings.backendUrl;

    const response = await fetch(`${wsProto}//${backendUrl}/agents`);
    const result = await response.json();

    if (result && result.agents) {
      agents = result.agents;
      renderAgents();
    }
  } catch (e) {
    console.error('Failed to load agents:', e);
    logEvent('error', `Failed to load agents: ${e.message}`);
  }
}

function renderAgents() {
  if (agents.length === 0) {
    agentList.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
        </svg>
        <p>No agents created yet</p>
        <p style="font-size: 14px; margin-top: 8px;">Create an agent to get started</p>
      </div>
    `;
    return;
  }

  agentList.innerHTML = agents.map(agent => `
    <div class="agent-card">
      <div class="agent-header">
        <span class="agent-name">${escapeHtml(agent.name)}</span>
        <span class="agent-status ${agent.status || 'active'}">${agent.status || 'active'}</span>
      </div>
      <div class="agent-meta">
        <strong>Type:</strong> ${agent.tool} - ${agent.type}<br>
        <strong>Created:</strong> ${new Date(agent.created_at).toLocaleString()}<br>
        ${agent.expires_at ? `<strong>Expires:</strong> ${new Date(agent.expires_at).toLocaleString()}` : ''}
      </div>
      <div class="agent-actions">
        <button class="agent-btn command" onclick="commandAgent('${agent.name}')">📝 Command</button>
        <button class="agent-btn delete" onclick="deleteAgent('${agent.name}')">🗑️ Delete</button>
      </div>
    </div>
  `).join('');
}

async function commandAgent(agentName) {
  const prompt = window.prompt(`Enter command for ${agentName}:`);
  if (!prompt) return;

  try {
    const settings = loadSettings();
    const wsProto = window.location.protocol === 'https:' ? 'https:' : 'http:';
    const backendUrl = settings.backendUrl;

    const response = await fetch(`${wsProto}//${backendUrl}/agents/${agentName}/command`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ prompt })
    });

    const result = await response.json();

    if (result.ok) {
      alert(`Command sent to ${agentName}!\nOperator file: ${result.operator_file || 'N/A'}`);
      logEvent('agent_command', {
        agent_name: agentName,
        prompt: prompt.substring(0, 100),
        timestamp: new Date().toISOString()
      });
    } else {
      alert(`Error: ${result.error}`);
      logEvent('error', `Failed to command agent: ${result.error}`);
    }
  } catch (e) {
    console.error('Failed to command agent:', e);
    alert('Failed to send command');
    logEvent('error', `Failed to command agent: ${e.message}`);
  }
}

async function deleteAgent(agentName) {
  if (!confirm(`Delete agent "${agentName}"?`)) return;

  try {
    const settings = loadSettings();
    const wsProto = window.location.protocol === 'https:' ? 'https:' : 'http:';
    const backendUrl = settings.backendUrl;

    const response = await fetch(`${wsProto}//${backendUrl}/agents/${agentName}`, {
      method: 'DELETE'
    });

    const result = await response.json();

    if (result.ok) {
      loadAgents();
      logEvent('agent_deleted', {
        agent_name: agentName,
        timestamp: new Date().toISOString()
      });
    } else {
      alert(`Error: ${result.error}`);
      logEvent('error', `Failed to delete agent: ${result.error}`);
    }
  } catch (e) {
    console.error('Failed to delete agent:', e);
    alert('Failed to delete agent');
    logEvent('error', `Failed to delete agent: ${e.message}`);
  }
}

// Make functions globally accessible for onclick handlers
window.commandAgent = commandAgent;
window.deleteAgent = deleteAgent;

// Agent Modal Handlers
createAgentBtn.onclick = () => {
  createAgentModal.classList.add('show');
};

closeAgentModal.onclick = () => {
  createAgentModal.classList.remove('show');
};

createAgentModal.onclick = (e) => {
  if (e.target === createAgentModal) {
    createAgentModal.classList.remove('show');
  }
};

createAgentForm.onsubmit = async (e) => {
  e.preventDefault();

  const tool = document.getElementById('agentTool').value;
  const agentType = document.getElementById('agentType').value;
  const agentName = document.getElementById('agentName').value;
  const expiryHours = parseInt(document.getElementById('agentExpiry').value);

  try {
    const settings = loadSettings();
    const wsProto = window.location.protocol === 'https:' ? 'https:' : 'http:';
    const backendUrl = settings.backendUrl;

    const response = await fetch(`${wsProto}//${backendUrl}/agents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        tool,
        type: agentType,
        name: agentName,
        expiry_hours: expiryHours
      })
    });

    const result = await response.json();

    if (result.ok) {
      createAgentModal.classList.remove('show');
      createAgentForm.reset();
      loadAgents();
      logEvent('agent_created', {
        agent_name: agentName,
        tool: tool,
        agent_type: agentType,
        timestamp: new Date().toISOString()
      });
      alert(`Agent "${agentName}" created successfully!`);
    } else {
      alert(`Error: ${result.error}`);
      logEvent('error', `Failed to create agent: ${result.error}`);
    }
  } catch (e) {
    console.error('Failed to create agent:', e);
    alert('Failed to create agent');
    logEvent('error', `Failed to create agent: ${e.message}`);
  }
};

// --- batching + fixed 8‑byte header setup ---
const BATCH_SAMPLES = 2048;
const HEADER_BYTES  = 8;
const FRAME_BYTES   = BATCH_SAMPLES * 2;
const MESSAGE_BYTES = HEADER_BYTES + FRAME_BYTES;

const bufferPool = [];
let batchBuffer = null;
let batchView = null;
let batchInt16 = null;
let batchOffset = 0;

function initBatch() {
  if (!batchBuffer) {
    batchBuffer = bufferPool.pop() || new ArrayBuffer(MESSAGE_BYTES);
    batchView   = new DataView(batchBuffer);
    batchInt16  = new Int16Array(batchBuffer, HEADER_BYTES);
    batchOffset = 0;
  }
}

function flushBatch() {
  // Don't send audio if mic is muted
  if (!micEnabled) {
    bufferPool.push(batchBuffer);
    batchBuffer = null;
    return;
  }

  const ts = Date.now() & 0xFFFFFFFF;
  batchView.setUint32(0, ts, false);
  const flags = isTTSPlaying ? 1 : 0;
  batchView.setUint32(4, flags, false);

  socket.send(batchBuffer);

  bufferPool.push(batchBuffer);
  batchBuffer = null;
}

function flushRemainder() {
  if (batchOffset > 0) {
    for (let i = batchOffset; i < BATCH_SAMPLES; i++) {
      batchInt16[i] = 0;
    }
    flushBatch();
  }
}

function initAudioContext() {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
}

function base64ToInt16Array(b64) {
  const raw = atob(b64);
  const buf = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < raw.length; i++) {
    view[i] = raw.charCodeAt(i);
  }
  return new Int16Array(buf);
}

async function startRawPcmCapture() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: { ideal: 24000 },
        channelCount: 1,
        echoCancellation: true,
        // autoGainControl: true,
        noiseSuppression: true
      }
    });
    mediaStream = stream;
    initAudioContext();
    await audioContext.audioWorklet.addModule('/pcmWorkletProcessor.js');
    micWorkletNode = new AudioWorkletNode(audioContext, 'pcm-worklet-processor');

    micWorkletNode.port.onmessage = ({ data }) => {
      const incoming = new Int16Array(data);
      let read = 0;
      while (read < incoming.length) {
        initBatch();
        const toCopy = Math.min(
          incoming.length - read,
          BATCH_SAMPLES - batchOffset
        );
        batchInt16.set(
          incoming.subarray(read, read + toCopy),
          batchOffset
        );
        batchOffset += toCopy;
        read       += toCopy;
        if (batchOffset === BATCH_SAMPLES) {
          flushBatch();
        }
      }
    };

    const source = audioContext.createMediaStreamSource(stream);
    source.connect(micWorkletNode);
    statusDiv.textContent = "Recording...";
  } catch (err) {
    statusDiv.textContent = "Mic access denied.";
    console.error(err);
  }
}

async function setupTTSPlayback() {
  await audioContext.audioWorklet.addModule('/ttsPlaybackProcessor.js');
  ttsWorkletNode = new AudioWorkletNode(
    audioContext,
    'tts-playback-processor'
  );

  ttsWorkletNode.port.onmessage = (event) => {
    const { type } = event.data;
    if (type === 'ttsPlaybackStarted') {
      if (!isTTSPlaying && socket && socket.readyState === WebSocket.OPEN) {
        isTTSPlaying = true;
        console.log(
          "TTS playback started. Reason: ttsWorkletNode Event ttsPlaybackStarted."
        );
        socket.send(JSON.stringify({ type: 'tts_start' }));
      }
    } else if (type === 'ttsPlaybackStopped') {
      if (isTTSPlaying && socket && socket.readyState === WebSocket.OPEN) {
        isTTSPlaying = false;
        console.log(
          "TTS playback stopped. Reason: ttsWorkletNode Event ttsPlaybackStopped."
        );
        socket.send(JSON.stringify({ type: 'tts_stop' }));
      }
    }
  };
  ttsWorkletNode.connect(audioContext.destination);
}

function cleanupAudio() {
  if (micWorkletNode) {
    micWorkletNode.disconnect();
    micWorkletNode = null;
  }
  if (ttsWorkletNode) {
    ttsWorkletNode.disconnect();
    ttsWorkletNode = null;
  }
  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }
  if (mediaStream) {
    mediaStream.getAudioTracks().forEach(track => track.stop());
    mediaStream = null;
  }
  // Disable controls when stopping (keep mic toggle enabled)
  document.getElementById("textInput").disabled = true;
  document.getElementById("sendBtn").disabled = true;
}

function renderMessages() {
  messagesDiv.innerHTML = "";
  chatHistory.forEach(msg => {
    const bubble = document.createElement("div");
    bubble.className = `bubble ${msg.role}`;
    bubble.textContent = msg.content;
    messagesDiv.appendChild(bubble);
  });
  if (typingUser) {
    const typing = document.createElement("div");
    typing.className = "bubble user typing";
    typing.innerHTML = typingUser + '<span style="opacity:.6;">✏️</span>';
    messagesDiv.appendChild(typing);
  }
  if (typingAssistant) {
    const typing = document.createElement("div");
    typing.className = "bubble assistant typing";
    typing.innerHTML = typingAssistant + '<span style="opacity:.6;">✏️</span>';
    messagesDiv.appendChild(typing);
  }
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function handleJSONMessage(msg) {
  const { type, content } = msg;

  // Log function calls specifically
  if (type && type.includes('function_call')) {
    logEvent('function_call', msg);
  }

  if (type === "partial_user_request") {
    typingUser = content?.trim() ? escapeHtml(content) : "";
    renderMessages();
    return;
  }
  if (type === "final_user_request") {
    if (content?.trim()) {
      chatHistory.push({ role: "user", content, type: "final" });
    }
    typingUser = "";
    renderMessages();
    return;
  }
  if (type === "partial_assistant_answer") {
    typingAssistant = content?.trim() ? escapeHtml(content) : "";
    renderMessages();
    return;
  }
  if (type === "final_assistant_answer") {
    if (content?.trim()) {
      chatHistory.push({ role: "assistant", content, type: "final" });
    }
    typingAssistant = "";
    renderMessages();
    return;
  }
  if (type === "tts_chunk") {
    if (ignoreIncomingTTS) return;
    const int16Data = base64ToInt16Array(content);
    if (ttsWorkletNode) {
      ttsWorkletNode.port.postMessage(int16Data);
    }
    return;
  }
  if (type === "tts_interruption") {
    if (ttsWorkletNode) {
      ttsWorkletNode.port.postMessage({ type: "clear" });
    }
    isTTSPlaying = false;
    ignoreIncomingTTS = false;
    return;
  }
  if (type === "stop_tts") {
    if (ttsWorkletNode) {
      ttsWorkletNode.port.postMessage({ type: "clear" });
    }
    isTTSPlaying = false;
    ignoreIncomingTTS = true;
    console.log("TTS playback stopped. Reason: tts_interruption.");
    socket.send(JSON.stringify({ type: 'tts_stop' }));
    return;
  }
}

function escapeHtml(str) {
  return (str ?? '')
    .replace(/&/g, "&amp;")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, "&quot;");
}

// UI Controls

document.getElementById("clearBtn").onclick = () => {
  chatHistory = [];
  typingUser = typingAssistant = "";
  renderMessages();
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: 'clear_history' }));
  }
};

speedSlider.addEventListener("input", (e) => {
  const speedValue = parseInt(e.target.value);
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({
      type: 'set_speed',
      speed: speedValue
    }));
  }
  console.log("Speed setting changed to:", speedValue);
});

// Settings management
function loadSettings() {
  const saved = localStorage.getItem('voiceChatSettings');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to parse settings:', e);
    }
  }
  // Default fallback to config.js
  const config = window.APP_CONFIG || { backendUrl: 'localhost:8000', autoProtocol: true };
  return { backendUrl: config.backendUrl };
}

function saveSettings(settings) {
  localStorage.setItem('voiceChatSettings', JSON.stringify(settings));
  console.log('Settings saved:', settings);
}

// Settings modal handlers
const settingsModal = document.getElementById('settingsModal');
const settingsBtn = document.getElementById('settingsBtn');
const closeModal = document.getElementById('closeModal');
const settingsForm = document.getElementById('settingsForm');
const backendUrlInput = document.getElementById('backendUrl');

settingsBtn.onclick = () => {
  const settings = loadSettings();
  backendUrlInput.value = settings.backendUrl || '';
  document.getElementById('wakewordToggle').checked = settings.wakewordEnabled || false;
  settingsModal.classList.add('show');
};

closeModal.onclick = () => {
  settingsModal.classList.remove('show');
};

settingsModal.onclick = (e) => {
  if (e.target === settingsModal) {
    settingsModal.classList.remove('show');
  }
};

settingsForm.onsubmit = (e) => {
  e.preventDefault();
  const settings = {
    backendUrl: backendUrlInput.value.trim(),
    wakewordEnabled: document.getElementById('wakewordToggle').checked
  };
  saveSettings(settings);
  settingsModal.classList.remove('show');
  statusDiv.textContent = "Settings saved. Click Start to connect.";
};

document.getElementById("startBtn").onclick = async () => {
  if (socket && socket.readyState === WebSocket.OPEN) {
    statusDiv.textContent = "Already recording.";
    return;
  }
  statusDiv.textContent = "Initializing connection...";

  // Get backend URL from saved settings or config
  const settings = loadSettings();
  const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const backendUrl = settings.backendUrl;

  console.log(`Connecting to backend: ${wsProto}//${backendUrl}/ws`);
  socket = new WebSocket(`${wsProto}//${backendUrl}/ws`);

  socket.onopen = async () => {
    statusDiv.textContent = "Connected. Activating mic and TTS…";
    logEvent('connection', 'WebSocket connected');

    // Send wakeword setting to backend
    const settings = loadSettings();
    if (settings.wakewordEnabled !== undefined) {
      socket.send(JSON.stringify({
        type: 'set_wakeword',
        enabled: settings.wakewordEnabled
      }));
      console.log('Sent wakeword setting:', settings.wakewordEnabled);
    }

    await startRawPcmCapture();
    await setupTTSPlayback();
    speedSlider.disabled = false;
    textInput.disabled = false;
    sendBtn.disabled = false;
  };

  socket.onmessage = (evt) => {
    if (typeof evt.data === "string") {
      try {
        const msg = JSON.parse(evt.data);

        // Log message events (excluding tts_chunk to avoid spam)
        if (msg.type && msg.type !== 'tts_chunk') {
          logEvent('message', { type: msg.type, content: msg.content ? msg.content.substring(0, 100) + (msg.content.length > 100 ? '...' : '') : undefined });
        }

        handleJSONMessage(msg);
      } catch (e) {
        console.error("Error parsing message:", e);
        logEvent('error', `Error parsing message: ${e.message}`);
      }
    }
  };

  socket.onclose = () => {
    statusDiv.textContent = "Connection closed.";
    logEvent('connection', 'WebSocket disconnected');
    flushRemainder();
    cleanupAudio();
    speedSlider.disabled = true;
  };

  socket.onerror = (err) => {
    statusDiv.textContent = "Connection error.";
    logEvent('error', `WebSocket error: ${err.message || 'Unknown error'}`);
    cleanupAudio();
    console.error(err);
    speedSlider.disabled = true;
  };
};

document.getElementById("stopBtn").onclick = () => {
  if (socket && socket.readyState === WebSocket.OPEN) {
    flushRemainder();
    socket.close();
  }
  cleanupAudio();
  statusDiv.textContent = "Stopped.";
};

document.getElementById("copyBtn").onclick = () => {
  const text = chatHistory
    .map(msg => `${msg.role.charAt(0).toUpperCase() + msg.role.slice(1)}: ${msg.content}`)
    .join('\n');

  navigator.clipboard.writeText(text)
    .then(() => console.log("Conversation copied to clipboard"))
    .catch(err => console.error("Copy failed:", err));
};

// Mute microphone toggle
const toggleMicBtn = document.getElementById("toggleMicBtn");
const micIcon = document.getElementById("micIcon");
const micText = document.getElementById("micText");

toggleMicBtn.onclick = () => {
  micEnabled = !micEnabled;

  if (micEnabled) {
    // Mic is ON
    toggleMicBtn.classList.remove('muted');
    micText.textContent = 'Mic On';
    micIcon.innerHTML = `
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" fill="currentColor"/>
      <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    `;
    console.log('Microphone unmuted');
  } else {
    // Mic is OFF (muted)
    toggleMicBtn.classList.add('muted');
    micText.textContent = 'Mic Off';
    micIcon.innerHTML = `
      <path d="M2 2l20 20M15 9.34V5a3 3 0 0 0-5.94-.6M9 9v3a3 3 0 0 0 5.12 2.12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23M12 19v4M8 23h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    `;
    console.log('Microphone muted');
  }
};

// Text input handlers
const textInput = document.getElementById("textInput");
const sendBtn = document.getElementById("sendBtn");

sendBtn.onclick = async () => {
  const text = textInput.value.trim();
  if (!text || !socket || socket.readyState !== WebSocket.OPEN) return;

  // Clear input
  textInput.value = "";

  // Don't add to chat history here - backend will send final_user_request
  // which will add it via handleJSONMessage to avoid duplicates

  // Send text message to backend
  const message = {
    type: "user_text",
    text: text
  };
  socket.send(JSON.stringify(message));

  logEvent('message', { type: 'user_text', text: text.substring(0, 100) + (text.length > 100 ? '...' : '') });
  console.log("Sent text message:", text);
};

// Handle Enter key in text input
textInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter' && !textInput.disabled) {
    sendBtn.onclick();
  }
});

// First render
renderMessages();
