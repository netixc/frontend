/**
 * ResilientWebSocket - WebSocket wrapper with automatic reconnection
 *
 * Features:
 * - Automatic reconnection with exponential backoff
 * - Connection state tracking
 * - Event emitter for connection status changes
 * - State persistence and recovery
 * - Graceful handling of network interruptions
 */

class ResilientWebSocket {
    constructor(url) {
        this.url = url;
        this.ws = null;

        // Reconnection settings
        this.reconnectDelay = 1000; // Start at 1 second
        this.maxReconnectDelay = 30000; // Max 30 seconds
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = Infinity; // Unlimited attempts
        this.reconnectTimer = null;

        // Connection state
        this.connectionState = 'disconnected'; // disconnected, connecting, connected, reconnecting
        this.isIntentionallyClosed = false;

        // Event handlers (to be set by user)
        this.onopen = null;
        this.onmessage = null;
        this.onclose = null;
        this.onerror = null;
        this.onreconnecting = null;
        this.onreconnected = null;
        this.onconnectionstatechange = null;

        // Message queue for buffering messages during reconnection
        this.messageQueue = [];
        this.maxQueueSize = 100;

        // Auto-connect on creation
        this.connect();
    }

    /**
     * Establish WebSocket connection
     */
    connect() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            console.log('[ResilientWS] Already connected');
            return;
        }

        this.isIntentionallyClosed = false;
        this.updateConnectionState('connecting');

        try {
            console.log(`[ResilientWS] Connecting to ${this.url}...`);
            this.ws = new WebSocket(this.url);

            // Set up event handlers
            this.ws.onopen = this.handleOpen.bind(this);
            this.ws.onmessage = this.handleMessage.bind(this);
            this.ws.onclose = this.handleClose.bind(this);
            this.ws.onerror = this.handleError.bind(this);

        } catch (error) {
            console.error('[ResilientWS] Connection error:', error);
            this.scheduleReconnect();
        }
    }

    /**
     * Handle WebSocket open event
     */
    handleOpen(event) {
        console.log('[ResilientWS] Connected successfully');

        const wasReconnecting = this.connectionState === 'reconnecting';
        this.updateConnectionState('connected');

        // Reset reconnection state
        this.reconnectDelay = 1000;
        this.reconnectAttempts = 0;

        // Flush message queue
        this.flushMessageQueue();

        // Restore state from localStorage
        this.restoreState();

        // Notify user handlers
        if (wasReconnecting && this.onreconnected) {
            this.onreconnected(event);
        }

        if (this.onopen) {
            this.onopen(event);
        }
    }

    /**
     * Handle WebSocket message event
     */
    handleMessage(event) {
        if (this.onmessage) {
            this.onmessage(event);
        }
    }

    /**
     * Handle WebSocket close event
     */
    handleClose(event) {
        console.log('[ResilientWS] Connection closed', event.code, event.reason);

        // Notify user handler
        if (this.onclose) {
            this.onclose(event);
        }

        // Don't reconnect if intentionally closed
        if (this.isIntentionallyClosed) {
            this.updateConnectionState('disconnected');
            return;
        }

        // Schedule reconnection
        this.updateConnectionState('reconnecting');
        this.scheduleReconnect();
    }

    /**
     * Handle WebSocket error event
     */
    handleError(error) {
        console.error('[ResilientWS] WebSocket error:', error);

        if (this.onerror) {
            this.onerror(error);
        }
    }

    /**
     * Schedule reconnection with exponential backoff
     */
    scheduleReconnect() {
        if (this.isIntentionallyClosed) {
            return;
        }

        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('[ResilientWS] Max reconnection attempts reached');
            this.updateConnectionState('disconnected');
            return;
        }

        this.reconnectAttempts++;

        console.log(`[ResilientWS] Reconnecting in ${this.reconnectDelay}ms (attempt ${this.reconnectAttempts})...`);

        // Notify user of reconnection attempt
        if (this.onreconnecting) {
            this.onreconnecting({
                attempt: this.reconnectAttempts,
                delay: this.reconnectDelay
            });
        }

        // Clear any existing timer
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
        }

        // Schedule reconnection
        this.reconnectTimer = setTimeout(() => {
            this.connect();
        }, this.reconnectDelay);

        // Exponential backoff
        this.reconnectDelay = Math.min(
            this.reconnectDelay * 2,
            this.maxReconnectDelay
        );
    }

    /**
     * Send data through WebSocket
     * Queues message if not connected
     */
    send(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(data);
        } else {
            // Queue message for later if connection is being established
            if (this.connectionState === 'connecting' || this.connectionState === 'reconnecting') {
                if (this.messageQueue.length < this.maxQueueSize) {
                    console.log('[ResilientWS] Queueing message (not connected)');
                    this.messageQueue.push(data);
                } else {
                    console.warn('[ResilientWS] Message queue full, dropping message');
                }
            } else {
                console.error('[ResilientWS] Cannot send: not connected');
            }
        }
    }

    /**
     * Flush queued messages
     */
    flushMessageQueue() {
        if (this.messageQueue.length > 0) {
            console.log(`[ResilientWS] Flushing ${this.messageQueue.length} queued messages`);

            while (this.messageQueue.length > 0) {
                const message = this.messageQueue.shift();
                if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                    this.ws.send(message);
                }
            }
        }
    }

    /**
     * Close WebSocket connection
     */
    close(code = 1000, reason = 'Normal closure') {
        console.log('[ResilientWS] Closing connection intentionally');

        this.isIntentionallyClosed = true;

        // Clear reconnection timer
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        // Close WebSocket
        if (this.ws) {
            this.ws.close(code, reason);
        }

        this.updateConnectionState('disconnected');
    }

    /**
     * Update connection state and notify listeners
     */
    updateConnectionState(newState) {
        const oldState = this.connectionState;
        this.connectionState = newState;

        console.log(`[ResilientWS] State: ${oldState} → ${newState}`);

        if (this.onconnectionstatechange) {
            this.onconnectionstatechange({
                oldState,
                newState,
                timestamp: new Date().toISOString()
            });
        }
    }

    /**
     * Restore application state from localStorage
     */
    restoreState() {
        try {
            const savedState = localStorage.getItem('ws_app_state');
            if (savedState) {
                console.log('[ResilientWS] Restoring application state');
                const state = JSON.parse(savedState);

                // Emit custom event for app to handle state restoration
                window.dispatchEvent(new CustomEvent('ws_state_restore', {
                    detail: state
                }));
            }
        } catch (error) {
            console.error('[ResilientWS] Failed to restore state:', error);
        }
    }

    /**
     * Save application state to localStorage
     * Should be called by the application when state changes
     */
    static saveState(state) {
        try {
            localStorage.setItem('ws_app_state', JSON.stringify(state));
        } catch (error) {
            console.error('[ResilientWS] Failed to save state:', error);
        }
    }

    /**
     * Get current connection state
     */
    getState() {
        return {
            connectionState: this.connectionState,
            reconnectAttempts: this.reconnectAttempts,
            queuedMessages: this.messageQueue.length,
            readyState: this.ws ? this.ws.readyState : WebSocket.CLOSED
        };
    }

    /**
     * Get WebSocket ready state as string
     */
    getReadyStateString() {
        if (!this.ws) return 'CLOSED';

        switch (this.ws.readyState) {
            case WebSocket.CONNECTING: return 'CONNECTING';
            case WebSocket.OPEN: return 'OPEN';
            case WebSocket.CLOSING: return 'CLOSING';
            case WebSocket.CLOSED: return 'CLOSED';
            default: return 'UNKNOWN';
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ResilientWebSocket;
}
