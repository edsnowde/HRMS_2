import { useState, useEffect } from 'react';
import { Manager } from 'socket.io-client';
import { useToast } from './use-toast';
import { useAuth } from '@/contexts/AuthContext';
import type { AuthContextType } from '@/contexts/AuthContext';

export function useWebSocket() {
  const [socket, setSocket] = useState<ReturnType<typeof Manager['prototype']['socket']> | null>(null);
  const { token } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!token) return;

    // Initialize socket
    const manager = new Manager(process.env.VITE_API_URL || 'http://localhost:8000', {
      auth: {
        token
      },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });
    
    const newSocket = manager.socket('/');

    // Connection handlers
    newSocket.on('connect', () => {
      console.log('WebSocket connected');
    });

    newSocket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      toast({
        title: "Connection Error",
        description: "Failed to establish real-time connection",
        variant: "destructive"
      });
    });

    newSocket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      if (reason === 'io server disconnect') {
        // Server disconnected us, try to reconnect
        newSocket.connect();
      }
    });

    // Ping/pong for connection health
    newSocket.on('ping', () => {
      newSocket.emit('pong', { timestamp: Date.now() });
    });

    setSocket(newSocket);

    // Cleanup on unmount
    return () => {
      if (newSocket) {
        newSocket.disconnect();
      }
    };
  }, [token]);

  return socket;
}