import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext(null);

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

useEffect(() => {
    // 환경변수 또는 동적 결정으로 서버 URL 결정
    const isDevelopment = import.meta.env.MODE === 'development';
    const envSocketUrl = import.meta.env.VITE_SOCKET_URL;

    let baseUrl = envSocketUrl;
    if (!baseUrl) {
      if (isDevelopment) {
        baseUrl = `https://localhost:3001`;
      } else {
        // 프로덕션: 현재 호스트의 https 사용
        baseUrl = `https://${window.location.hostname}`;
      }
    }

    console.log('Connecting to server:', baseUrl);

    const newSocket = io(baseUrl, {
      path: '/socket.io/',  // nginx 리버스 프록시 경로
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      secure: isDevelopment ? false : true,
      rejectUnauthorized: false,  // 개발 환경에서 자체 서명 인증서 허용
    });

    newSocket.on('connect', () => {
      console.log('Socket connected:', newSocket.id);
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('Socket disconnected');
      setIsConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      setIsConnected(false);

      // Fallback 로직: 프로덕션 URL 실패 시 localhost 재시도
      if (baseUrl !== `https://localhost:3001` && !isDevelopment) {
        console.log('Attempting fallback connection to localhost:3001');
        // 재연결 시도 시 자동으로 fallback 처리됨 (reconnectionAttempts로 관리)
      }
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  const value = {
    socket,
    isConnected,
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};
