import { io } from 'socket.io-client';

const SOCKET_URL = 'https://community-connect-backend-wqwc.onrender.com';

let socketSingleton = null;

export const getSocket = () => {
  if (!socketSingleton) {
    socketSingleton = io(SOCKET_URL, {
      transports: ['websocket'],
      autoConnect: false
    });
  }
  return socketSingleton;
};

export const connectAsRole = (role) => {
  const socket = getSocket();

  if (role) {
    socket.emit('joinRole', { role });
  }

  if (!socket.connected) {
    socket.connect();
  }

  return socket;
};

export const disconnectSocket = () => {
  const socket = getSocket();
  if (socket && socket.connected) {
    socket.disconnect();
  }
};

