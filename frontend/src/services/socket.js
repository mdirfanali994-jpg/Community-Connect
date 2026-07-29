import { io } from 'socket.io-client';
import { SOCKET_URL } from '../config/api';

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

export const connectAsRole = (role, communityId) => {
  const socket = getSocket();

  if (role) {
    socket.emit('joinRole', { role });
  }

  if (communityId) {
    socket.emit('joinCommunity', { communityId: String(communityId), role });
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

