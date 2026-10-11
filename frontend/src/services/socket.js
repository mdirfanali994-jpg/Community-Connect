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

let _lastRole = null;
let _lastCommunityId = null;
let _joinHandlerInstalled = false;

export const connectAsRole = (role, communityId) => {
  const socket = getSocket();

  _lastRole = role;
  _lastCommunityId = communityId;

  const joinRooms = () => {
    if (_lastRole) {
      socket.emit('joinRole', { role: _lastRole });
    }
    if (_lastCommunityId) {
      socket.emit('joinCommunity', { communityId: String(_lastCommunityId), role: _lastRole });
    }
  };

  if (socket.connected) {
    joinRooms();
  } else {
    if (!_joinHandlerInstalled) {
      socket.on('connect', joinRooms);
      _joinHandlerInstalled = true;
    }
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

