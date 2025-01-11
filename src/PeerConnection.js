import SimplePeer from 'simple-peer';
import Logger from './utils/logger';
import EventEmitter from 'events';

class PeerConnection {
  constructor() {
    this.peer = null;
    this.isConnected = false;
    this.eventEmitter = new EventEmitter();
  }

  create(initiator) {
    if (this.peer) {
      Logger.warn('Cleaning up existing peer before creating new one');
      this.destroy();
    }

    this.peer = new SimplePeer({
      initiator,
      trickle: false
    });

    this.peer.on('error', err => {
      Logger.error('SimplePeer error:', err);
      this.isConnected = false;
      this.eventEmitter.emit('error', err);
    });

    this.peer.on('signal', data => {
      this.eventEmitter.emit('signal', data);
    });

    this.peer.on('connect', () => {
      Logger.info('SimplePeer connected');
      this.isConnected = true;
      this.eventEmitter.emit('connect');
    });

    this.peer.on('data', data => {
      const message = data.toString();
      Logger.debug('Received raw data:', message);
      this.eventEmitter.emit('data', message);
    });

    this.peer.on('close', () => {
      Logger.info('SimplePeer connection closed');
      this.isConnected = false;
      this.eventEmitter.emit('close');
      this.destroy();
    });
  }

  signal(data) {
    if (!this.peer) {
      throw new Error('Cannot signal before creating peer');
    }
    this.peer.signal(data);
  }

  sendMessage(message) {
    if (!this.peer || !this.isConnected) {
      throw new Error('Cannot send message: peer is not connected');
    }
    Logger.debug('Sending message:', message);
    this.peer.send(message);
  }

  destroy() {
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
    this.isConnected = false;
    this.eventEmitter.removeAllListeners();
  }

  on(event, callback) {
    this.eventEmitter.on(event, callback);
  }

  off(event, callback) {
    this.eventEmitter.off(event, callback);
  }

  get connected() {
    return this.isConnected;
  }
}

// Create a singleton instance
const instance = new PeerConnection();
export default instance; 