import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';

interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: string;
}

interface WebSocketContextType {
  isConnected: boolean;
  sendMessage: (message: WebSocketMessage) => void;
  subscribe: (eventType: string, callback: (data: any) => void) => () => void;
}

class WebSocketManager {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private subscribers: Map<string, Set<(data: any) => void>> = new Map();
  private isConnecting = false;
  private authToken: string | null = null;

  constructor() {
    this.connect = this.connect.bind(this);
    this.disconnect = this.disconnect.bind(this);
    this.sendMessage = this.sendMessage.bind(this);
    this.subscribe = this.subscribe.bind(this);
  }

  setAuthToken(token: string | null) {
    this.authToken = token;
    if (token && !this.ws) {
      this.connect();
    } else if (!token && this.ws) {
      this.disconnect();
    }
  }

  private connect() {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
      return;
    }

    this.isConnecting = true;
    const wsUrl = import.meta.env.VITE_WS_URL || '/api/jobs/ws';
    
    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        
        // Send authentication if token is available
        if (this.authToken) {
          this.sendMessage({
            type: 'auth',
            data: { token: this.authToken },
            timestamp: new Date().toISOString()
          });
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        this.isConnecting = false;
        this.ws = null;
        
        // Attempt to reconnect if we have an auth token
        if (this.authToken && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          setTimeout(() => {
            console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            this.connect();
          }, this.reconnectDelay * this.reconnectAttempts);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.isConnecting = false;
      };

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      this.isConnecting = false;
    }
  }

  private disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.reconnectAttempts = 0;
  }

  private handleMessage(message: WebSocketMessage) {
    const { type, data } = message;
    
    // Handle system messages
    switch (type) {
      case 'auth_success':
        console.log('WebSocket authentication successful');
        break;
      case 'auth_error':
        console.error('WebSocket authentication failed:', data);
        break;
      case 'error':
        console.error('WebSocket error:', data);
        toast.error(data.message || 'WebSocket error occurred');
        break;
      default:
        // Notify subscribers
        const callbacks = this.subscribers.get(type);
        if (callbacks) {
          callbacks.forEach(callback => {
            try {
              callback(data);
            } catch (error) {
              console.error('Error in WebSocket callback:', error);
            }
          });
        }
    }
  }

  sendMessage(message: WebSocketMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket is not connected');
    }
  }

  subscribe(eventType: string, callback: (data: any) => void): () => void {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, new Set());
    }
    
    this.subscribers.get(eventType)!.add(callback);
    
    // Return unsubscribe function
    return () => {
      const callbacks = this.subscribers.get(eventType);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.subscribers.delete(eventType);
        }
      }
    };
  }

  get isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

// Create singleton instance
const wsManager = new WebSocketManager();

// React hook for using WebSocket
export const useWebSocket = () => {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(wsManager.isConnected);

  useEffect(() => {
    // Update auth token when user changes
    wsManager.setAuthToken(user?.idToken || null);
    
    // Update connection status
    const updateConnectionStatus = () => {
      setIsConnected(wsManager.isConnected);
    };

    // Subscribe to connection status changes
    const unsubscribe = wsManager.subscribe('connection_status', updateConnectionStatus);

    return () => {
      unsubscribe();
    };
  }, [user?.idToken]);

  return {
    isConnected,
    sendMessage: wsManager.sendMessage.bind(wsManager),
    subscribe: wsManager.subscribe.bind(wsManager)
  };
};

// Hook for specific event types
export const useWebSocketEvent = (eventType: string, callback: (data: any) => void) => {
  const { subscribe } = useWebSocket();

  useEffect(() => {
    const unsubscribe = subscribe(eventType, callback);
    return unsubscribe;
  }, [eventType, callback, subscribe]);
};

export default wsManager;
