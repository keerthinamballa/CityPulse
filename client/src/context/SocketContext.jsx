import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [onlineCount, setOnlineCount] = useState(0);

  useEffect(() => {
    const newSocket = io(window.location.origin, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    newSocket.on('connect', () => {
      console.log('🟢 WebSocket connected');
      setConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('🔴 WebSocket disconnected');
      setConnected(false);
    });

    newSocket.on('connect_error', (err) => {
      console.warn('⚠️ WebSocket error:', err.message);
    });

    newSocket.on('users:count', (count) => {
      setOnlineCount(count);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, connected, onlineCount }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}
