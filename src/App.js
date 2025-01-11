import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import Logger from './utils/logger';

// Use the secure API exposed by our preload script
const { resizeWindow } = window.electronAPI;

function ChatScreen({ onBack, conversationId, messages, onSendMessage, conversations, onChatOpen }) {
  // Reference to the chat messages container
  const messagesContainerRef = useRef(null);
  // Track if we should auto-scroll
  const shouldScrollRef = useRef(true);

  // Initial window resize
  useEffect(() => {
    resizeWindow(1200, 800);
    return () => {
      resizeWindow(900, 700);
    };
  }, []);

  // Handle auto-scrolling when new messages arrive
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container && shouldScrollRef.current) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages]);

  // Track scroll position to determine if we should auto-scroll
  const handleScroll = () => {
    const container = messagesContainerRef.current;
    if (container) {
      const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 50;
      shouldScrollRef.current = isAtBottom;
    }
  };

  const [messageInput, setMessageInput] = useState('');

  const handleSend = () => {
    if (messageInput.trim()) {
      onSendMessage(messageInput);
      setMessageInput('');
      // Ensure we scroll to bottom on send
      shouldScrollRef.current = true;
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="chat-container">
      <div className="chat-sidebar">
        <button className="back-button" onClick={onBack}>
          ← Back
        </button>
        <div className="sidebar-conversations">
          {conversations.map((conv) => (
            <div 
              key={conv.id} 
              className={`sidebar-conversation ${conv.id === conversationId ? 'active' : ''}`}
              onClick={() => onChatOpen(conv.id)}
            >
              <span className="pier-name">{conv.id}</span>
              <span className="last-message">{conv.messages[conv.messages.length - 1]?.content || ''}</span>
          </div>
          ))}
        </div>
      </div>
      
      <div className="chat-main">
        <div 
          className="chat-messages" 
          ref={messagesContainerRef}
          onScroll={handleScroll}
        >
          {messages.map((msg, index) => (
            <div key={index} className={`message ${msg.type}`}>
              <span className="message-content">{msg.content}</span>
              <span className="message-time">{msg.time}</span>
          </div>
          ))}
        </div>
        
        <div className="chat-input">
          <input
            type="text"
            placeholder="Type a message..."
            className="message-input"
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            onKeyPress={handleKeyPress}
          />
          <button className="send-button" onClick={handleSend}>Send</button>
        </div>
      </div>
    </div>
  );
}

function HomeScreen({ onLogout, onChatOpen, conversations, onConnect, username, port, publicIP, onDeleteConversation }) {
  const [copyText, setCopyText] = useState('Copy Sigil');
  const [deleteConfirmation, setDeleteConfirmation] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('');
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [ritualModal, setRitualModal] = useState({ 
    isOpen: false, 
    type: null, 
    sigil: null,
    responseSigil: null,
    receivedSigil: null,
    answerSigil: null
  });

  // Add handler tracking
  const handlers = useRef({
    connect: null,
    data: null,
    signal: null,
    error: null,
    close: null
  });

  // Cleanup function for event handlers
  const cleanupHandlers = () => {
    const PeerConnection = require('./PeerConnection').default;
    Object.entries(handlers.current).forEach(([event, handler]) => {
      if (handler) {
        PeerConnection.off(event, handler);
        handlers.current[event] = null;
      }
    });
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupHandlers();
    };
  }, []);

  const setupConnectionHandlers = (PeerConnection, isInitiator) => {
    // Clean up any existing handlers
    cleanupHandlers();

    // Create new handlers
    handlers.current.connect = () => {
      Logger.info('Peer connection established!');
      setConnectionStatus('The connection has been established! A presence manifests!');
      // Send our username
      PeerConnection.sendMessage(JSON.stringify({ type: 'identity', username: username || 'NAMELESS' }));
      setRitualModal({ isOpen: false, type: null, sigil: null, responseSigil: null, receivedSigil: null, answerSigil: null });
    };

    handlers.current.data = async (data) => {
      try {
        const message = JSON.parse(data);
        Logger.debug('Received message:', message);
        if (message.type === 'identity') {
          // Create a deterministic conversation ID based on both usernames
          const ourName = username || 'NAMELESS';
          const theirName = message.username;
          const conversationId = [ourName, theirName].sort().join(':');
          Logger.debug('Creating conversation with ID:', conversationId);
          onConnect(conversationId);
        } else if (message.type === 'chat') {
          // Use the active conversation ID from state
          if (activeConversation) {
            await window.electronAPI.database.insertMessage(activeConversation, message.content, false);
            loadConversations();
          } else {
            Logger.error('Received chat message but no active conversation');
          }
        }
      } catch (error) {
        Logger.error('Error handling message:', error);
      }
    };

    handlers.current.signal = (data) => {
      if (isInitiator) {
        Logger.debug('Generated offer:', data);
        setConnectionStatus('The sigils have been drawn... Awaiting response from the void...');
      } else {
        Logger.debug('Generated answer:', data);
        setConnectionStatus('The answering sigils have been drawn...');
      }
      setRitualModal(prev => ({
        ...prev,
        [isInitiator ? 'sigil' : 'answerSigil']: JSON.stringify(data, null, 2)
      }));
    };

    handlers.current.error = (err) => {
      Logger.error('Peer connection error:', err);
      setConnectionStatus('The ritual has failed: ' + err.message);
      setRitualModal({ isOpen: false, type: null, sigil: null, responseSigil: null, receivedSigil: null, answerSigil: null });
    };

    handlers.current.close = () => {
      Logger.info('Peer connection closed');
      setConnectionStatus('The presence has returned to the void...');
      setRitualModal({ isOpen: false, type: null, sigil: null, responseSigil: null, receivedSigil: null, answerSigil: null });
    };

    // Register all handlers
    Object.entries(handlers.current).forEach(([event, handler]) => {
      if (handler) PeerConnection.on(event, handler);
    });
  };

  const handleConnect = async () => {
    try {
      setRitualModal({
        isOpen: true,
        type: 'offer',
        sigil: null
      });
      
      setConnectionStatus('Beginning the summoning ritual...');

      const PeerConnection = (await import('./PeerConnection')).default;
      PeerConnection.create(true);
      setupConnectionHandlers(PeerConnection, true);

    } catch (error) {
      Logger.error('Connection error:', error);
      setConnectionStatus('The sigils were malformed. The ritual cannot proceed.');
    }
  };

  const handleReceiveConnection = async () => {
    try {
      setRitualModal({
        isOpen: true,
        type: 'answer',
        sigil: null,
        receivedSigil: '',
        answerSigil: null
      });
      
      setConnectionStatus('Awaiting dark rites from your fellow conspirator...');

      const PeerConnection = (await import('./PeerConnection')).default;
      PeerConnection.create(false);
      setupConnectionHandlers(PeerConnection, false);

    } catch (error) {
      Logger.error('Connection error:', error);
      setConnectionStatus('The sigils were malformed. The ritual cannot proceed.');
    }
  };

  const handleSigilCopy = () => {
    if (ritualModal.sigil) {
      navigator.clipboard.writeText(ritualModal.sigil);
      setConnectionStatus('The sigils have been copied to your mortal clipboard...');
    }
  };

  const handleSigilPaste = async (signalData) => {
    try {
      // Import PeerConnection if needed
      const PeerConnection = (await import('./PeerConnection')).default;
      
      // Handle the pasted signal
      const success = PeerConnection.handleSignal(signalData);
      if (success) {
        setConnectionStatus('The sigils have been accepted... The ritual continues...');
        // Don't close modal yet if we're the receiver and haven't generated our answer
        if (ritualModal.type === 'offer' || (ritualModal.type === 'answer' && ritualModal.answerSigil)) {
          setRitualModal(prev => ({ ...prev, responseSigil: JSON.stringify(signalData, null, 2) }));
        }
      } else {
        setConnectionStatus('These sigils are invalid. The ritual cannot proceed.');
      }
    } catch (error) {
      Logger.error('Signal handling error:', error);
      setConnectionStatus('Failed to interpret the sigils. Are you sure you copied them correctly?');
    }
  };

  const handleDeleteClick = (e, convId) => {
    e.stopPropagation(); // Prevent opening the conversation
    setDeleteConfirmation(convId);
  };

  const handleConfirmDelete = async () => {
    if (deleteConfirmation) {
      await onDeleteConversation(deleteConfirmation);
      setDeleteConfirmation(null);
    }
  };

  return (
    <div className="home-container">
      {ritualModal.isOpen && (
        <div className="ritual-modal">
          <div className="ritual-modal-content">
            <h2 className="ritual-title">
              {ritualModal.type === 'offer' 
                ? 'Summoning Circle Preparation' 
                : 'Answering the Call'}
            </h2>

            {ritualModal.type === 'offer' ? (
              // Initiator Flow
              <>
                {!ritualModal.sigil ? (
                  <div className="ritual-step">
                    <p className="ritual-description">Drawing the summoning sigils...</p>
                    <div className="ritual-loading">🕯️</div>
                  </div>
                ) : !ritualModal.responseSigil ? (
                  <div className="ritual-step">
                    <p className="ritual-description">Share these summoning sigils with your fellow conspirator</p>
                    <div className="ritual-boxes-container">
                      <div className="ritual-box-column">
                        <p className="ritual-instruction">Your summoning sigils:</p>
                        <div className="ritual-box">
                          <pre className="sigil-text">{ritualModal.sigil}</pre>
                          <button className="ritual-button" onClick={handleSigilCopy}>
                            Copy Sigils
                          </button>
                        </div>
                      </div>
                      <div className="ritual-box-column">
                        <p className="ritual-instruction">Paste their answering sigils here:</p>
                        <textarea
                          className="ritual-input"
                          placeholder="Paste the response sigils here..."
                          value={ritualModal.responseSigil || ''}
                          onChange={(e) => {
                            const value = e.target.value;
                            setRitualModal(prev => ({ ...prev, responseSigil: value }));
                            try {
                              const signalData = JSON.parse(value);
                              handleSigilPaste(signalData);
                            } catch (error) {
                              // Invalid JSON, just store the text
                            }
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="ritual-step">
                    <p className="ritual-description">The connection is being established...</p>
                    <div className="ritual-loading">🕯️</div>
                  </div>
                )}
              </>
            ) : (
              // Receiver Flow
              <>
                {!ritualModal.receivedSigil ? (
                  <div className="ritual-step">
                    <p className="ritual-description">Paste the summoning sigils you received:</p>
                    <div className="ritual-boxes-container">
                      <div className="ritual-box-column">
                        <p className="ritual-instruction">Paste the summoning sigils here:</p>
                        <textarea
                          className="ritual-input"
                          placeholder="Paste the summoning sigils here..."
                          value={ritualModal.receivedSigil || ''}
                          onChange={(e) => {
                            const value = e.target.value;
                            setRitualModal(prev => ({ ...prev, receivedSigil: value }));
                            try {
                              const signalData = JSON.parse(value);
                              handleSigilPaste(signalData);
                            } catch (error) {
                              // Invalid JSON, just store the text
                            }
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ) : ritualModal.answerSigil ? (
                  <div className="ritual-step">
                    <p className="ritual-description">Return these response sigils to complete the ritual:</p>
                    <div className="ritual-boxes-container">
                      <div className="ritual-box-column">
                        <p className="ritual-instruction">Your response sigils:</p>
                        <div className="ritual-box">
                          <pre className="sigil-text">{ritualModal.answerSigil}</pre>
                          <button className="ritual-button" onClick={() => {
                            navigator.clipboard.writeText(ritualModal.answerSigil);
                            setConnectionStatus('Response sigils copied to your mortal clipboard...');
                          }}>
                            Copy Response
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="ritual-step">
                    <p className="ritual-description">Preparing the response...</p>
                    <div className="ritual-loading">🕯️</div>
                  </div>
                )}
              </>
            )}

            <button 
              className="ritual-button cancel" 
              onClick={() => setRitualModal(prev => ({ ...prev, isOpen: false }))}
            >
              Cancel Ritual
            </button>
          </div>
        </div>
      )}

      {deleteConfirmation && (
        <div className="delete-confirmation">
          <div className="delete-confirmation-content">
            <p>Are you sure you want to banish this conversation to the void?</p>
            <div className="delete-confirmation-buttons">
              <button onClick={handleConfirmDelete}>Yes, Banish It</button>
              <button onClick={() => setDeleteConfirmation(null)}>Spare It</button>
            </div>
          </div>
        </div>
      )}

      <div className="header-bar">
        <div className="user-address">
          <span className="address-value">
            {username || 'NAMELESS'}
          </span>
        </div>
        <button className="logout-button" onClick={onLogout}>
          Return to the Void
        </button>
      </div>

      <div className="connect-section">
        <div className="connect-input-group">
          <button 
            className="connect-button" 
            onClick={handleReceiveConnection}
          >
            ← Receive Unholy Rites
          </button>
          <button 
            className="connect-button" 
            onClick={handleConnect}
          >
            Initiate Connection Ritual →
          </button>
        </div>
      </div>

      {/* Pending Connections Section */}
      {(ritualModal.type || connectionStatus) && (
        <div className="pending-connections-section">
          <h2>Pending Rituals</h2>
          <div className="pending-connection-item">
            <span className="ritual-status">{connectionStatus || 'Ritual in progress...'}</span>
            <div className="pending-connection-actions">
              <button 
                className="resume-ritual-button"
                onClick={() => setRitualModal(prev => ({ ...prev, isOpen: true }))}
              >
                Resume Ritual →
              </button>
              <button 
                className="ritual-trash-button"
                onClick={() => {
                  setRitualModal({ 
                    isOpen: false, 
                    type: null, 
                    sigil: null,
                    responseSigil: null,
                    receivedSigil: null,
                    answerSigil: null 
                  });
                  setConnectionStatus('');
                }}
              >
                🗑️
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="conversations-section">
        <h2>Active Summonings</h2>
        
        {/* Incoming Requests Section */}
        {incomingRequests.map((request, index) => (
          <div key={`request-${index}`} className="conversation-item incoming-request">
            <div className="conversation-content">
              <span className="pier-name">A presence seeks to manifest: {request.address}</span>
            </div>
            <div className="request-buttons">
              <button className="accept-button" onClick={() => {}}>Accept</button>
              <button className="decline-button" onClick={() => {}}>Banish</button>
            </div>
          </div>
        ))}

        {/* Existing Conversations List */}
        <div className="conversation-list">
          {conversations.map((conv, index) => (
            <div key={index} className="conversation-item">
              <div className="conversation-content" onClick={() => onChatOpen(conv.id)}>
                <span className="pier-name">{conv.id}</span>
                <span className="last-message">{conv.messages[conv.messages.length - 1]?.content || ''}</span>
          </div>
              <button 
                className="delete-button"
                onClick={(e) => handleDeleteClick(e, conv.id)}
              >
                🗑️
              </button>
          </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function App() {
  const [username, setUsername] = useState('');
  const [key, setKey] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentScreen, setCurrentScreen] = useState('login');
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [loginError, setLoginError] = useState(null);
  const [port, setPort] = useState(3000);
  const [publicIP, setPublicIP] = useState(null);

  useEffect(() => {
    resizeWindow(400, 500);
    
    // Get port number
    window.electronAPI.getPort().then(port => {
      setPort(port);
    });
    
    // Listen for app ready event
    window.electronAPI.onAppReady(() => {
      console.log('App is ready');
    });
  }, []);

  // Load conversations from database
  const loadConversations = async () => {
    try {
      // First get all messages (we'll group them later)
      const allMessages = await window.electronAPI.database.query(
        'SELECT * FROM messages ORDER BY timestamp ASC'
      );

      // Get all peers
      const peers = await window.electronAPI.database.query(
        'SELECT * FROM peers ORDER BY last_seen DESC'
      );

      // Group messages by peer
      const conversationsData = peers.map(peer => {
        const peerMessages = allMessages.filter(msg => msg.peer === peer.address);

        return {
          id: peer.address,
          name: peer.name,
          lastSeen: peer.last_seen,
          messages: peerMessages.map(msg => ({
            content: msg.content,
            time: new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            type: msg.sent ? 'sent' : 'received'
          }))
        };
      });
      
      // Update state only if we have data
      if (conversationsData.length > 0) {
        setConversations(conversationsData);
      }
    } catch (error) {
      console.error('Failed to load conversations:', error);
    }
  };

  // Call loadConversations immediately after successful database init
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoginError(null); // Clear any previous errors
    
    try {
      // Validate that if there's a username, there must be a key
      if (username && !key) {
        setLoginError('Key is required when using a username');
        return;
      }

      const success = await window.electronAPI.database.init(username);
      
      if (success) {
    setIsLoggedIn(true);
    setCurrentScreen('home');
      }
    } catch (error) {
      console.error('Login error:', error);
      setLoginError(error.message);
    }
  };

  // Consolidate all database loading triggers into one useEffect
  useEffect(() => {
    if (isLoggedIn && currentScreen === 'home') {
      loadConversations();
      updatePublicIP();
    }
  }, [isLoggedIn, currentScreen]);

  const handleLogout = async () => {
    // Clean up empty database before state reset
    await window.electronAPI.database.cleanup();
    
    setIsLoggedIn(false);
    setUsername('');
    setKey('');
    setCurrentScreen('login');
    setConversations([]);
    setActiveConversation(null);
  };

  const handleConnect = async (address) => {
    try {
      const success = await window.electronAPI.database.createConversation(address);
      
      if (success) {
        // Create a temporary conversation while we wait for the database
        const tempConversation = {
          id: address,
          name: address,
          messages: []
        };
        
        setConversations(prev => [...prev, tempConversation]);
        setActiveConversation(address);
        setCurrentScreen('chat');
        
        // Then load the actual data from database
        await loadConversations();
      }
    } catch (error) {
      console.error('Failed to create conversation:', error);
    }
  };

  const handleSendMessage = async (content) => {
    try {
      // Send the message over WebRTC
      const PeerConnection = (await import('./PeerConnection')).default;
      if (PeerConnection.isConnected) {
        PeerConnection.sendMessage(JSON.stringify({ type: 'chat', content }));
      }

      // Insert into our database
      const message = await window.electronAPI.database.insertMessage(activeConversation, content, true);
      
      // Update UI with the sent message
      const userMessage = { 
        type: 'sent', 
        content: message.content, 
        time: new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      
      setConversations(prevConversations => {
        return prevConversations.map(conv => {
          if (conv.id === activeConversation) {
            return {
              ...conv,
              messages: [...(conv.messages || []), userMessage]
            };
          }
          return conv;
        });
      });
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleDeleteConversation = async (convId) => {
    try {
      const success = await window.electronAPI.database.deleteConversation(convId);
      
      if (success) {
        // Remove from UI
        setConversations(prev => prev.filter(conv => conv.id !== convId));
        
        // If we're viewing the deleted conversation, go back home
        if (activeConversation === convId) {
          setCurrentScreen('home');
          setActiveConversation(null);
        }
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    }
  };

  const renderTitleBar = () => {
    console.log('Title bar render - isLoggedIn:', isLoggedIn);  // Debug log
    return (
      <div className="title-bar">
        <span>Pier2Pier</span>
      </div>
    );
  };

  const renderScreen = () => {
    switch (currentScreen) {
      case 'login':
        return (
          <form className="login-form" onSubmit={handleSubmit}>
            <h1 className="title">Pier2Pier</h1>
            
            {loginError && (
              <div className="error-message">
                <span>{loginError}</span>
                <button onClick={() => setLoginError(null)}>✕</button>
              </div>
            )}
            
            <div className="input-group">
              <input
                type="text"
                className="input-field"
                placeholder="Username (optional)"
                value={username}
                onChange={(e) => {
                  const newUsername = e.target.value;
                  setUsername(newUsername);
                  // Clear key if username is cleared
                  if (!newUsername) {
                    setKey('');
                  }
                }}
                autoFocus
              />
            </div>

            <div className="input-group">
              <input
                type="password"
                placeholder="Key"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                disabled={!username}
                className={`input-field ${!username ? 'disabled' : ''}`}
              />
            </div>

            <button
              type="submit"
              className="login-button"
            >
              Login
            </button>
          </form>
        );
      case 'home':
        return (
          <HomeScreen 
            onLogout={handleLogout}
            onChatOpen={(convId) => {
              setActiveConversation(convId);
              setCurrentScreen('chat');
            }}
            conversations={conversations}
            onConnect={handleConnect}
            username={username}
            port={port}
            publicIP={publicIP}
            onDeleteConversation={handleDeleteConversation}
          />
        );
      case 'chat':
        const currentConversation = conversations.find(conv => conv.id === activeConversation);
        return (
          <ChatScreen 
            onBack={() => {
              setCurrentScreen('home');
              setActiveConversation(null);
            }}
            conversationId={activeConversation}
            messages={currentConversation?.messages || []}
            onSendMessage={handleSendMessage}
            conversations={conversations}
            onChatOpen={(convId) => {
              setActiveConversation(convId);
            }}
          />
        );
      default:
        return null;
    }
  };

  // Add function to get public IP
  const updatePublicIP = async () => {
    try {
      const result = await window.electronAPI.network.getPublicIP();
      if (result.success) {
        setPublicIP(result.ip);
      } else {
        console.error('Failed to get public IP:', result.error);
      }
    } catch (error) {
      console.error('Error getting public IP:', error);
    }
  };

  return (
    <>
      {renderTitleBar()}
      <div className="app-container">
        {renderScreen()}
      </div>
    </>
  );
}

export default App; 