import React, { useState, useEffect } from 'react';
import './App.css';

// Use the secure API exposed by our preload script
const { resizeWindow } = window.electronAPI;

function ChatScreen({ onBack, conversationId, messages, onSendMessage, conversations, onChatOpen }) {
  useEffect(() => {
    resizeWindow(1200, 800);
    return () => {
      resizeWindow(900, 700);
    };
  }, []);

  const [messageInput, setMessageInput] = useState('');

  const handleSend = () => {
    if (messageInput.trim()) {
      onSendMessage(messageInput);
      setMessageInput('');
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
        <div className="chat-messages">
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

function HomeScreen({ onLogout, onChatOpen, conversations, onConnect, username, onDeleteConversation }) {
  const [copyText, setCopyText] = useState('Copy');
  const [connectAddress, setConnectAddress] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState(null);

  useEffect(() => {
    resizeWindow(900, 700);
    return () => {
      resizeWindow(400, 500);
    };
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText('localhost:3000');
    setCopyText('Copied!');
    setTimeout(() => setCopyText('Copy'), 2000);
  };

  const handleConnect = () => {
    if (connectAddress.trim()) {
      onConnect(connectAddress);
      setConnectAddress('');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleConnect();
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
      {deleteConfirmation && (
        <div className="delete-confirmation">
          <div className="delete-confirmation-content">
            <p>Are you sure you want to delete this conversation?</p>
            <div className="delete-confirmation-buttons">
              <button onClick={handleConfirmDelete}>Yes, Delete</button>
              <button onClick={() => setDeleteConfirmation(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className="header-bar">
        <div className="user-address">
          <span className="address-label">Logged in as: </span>
          <span className="address-value">{username || 'default'}@localhost:3000</span>
          <button className="subtle-button" onClick={handleCopy}>
            {copyText}
          </button>
        </div>
        <button className="logout-button" onClick={onLogout}>
          Logout
        </button>
      </div>

      <div className="connect-section">
        <div className="connect-input-group">
          <span className="connect-label">Connect:</span>
          <input
            type="text"
            className="input-field"
            placeholder="Enter Pier2Pier address"
            value={connectAddress}
            onChange={(e) => setConnectAddress(e.target.value)}
            onKeyPress={handleKeyPress}
          />
          <button className="connect-button" onClick={handleConnect}>Send</button>
        </div>
      </div>

      <div className="conversations-section">
        <h2>Previous Conversations</h2>
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

  useEffect(() => {
    resizeWindow(400, 500);
    
    // Listen for app ready event
    window.electronAPI.onAppReady(() => {
      console.log('App is ready');
    });
  }, []);

  // Load conversations from database
  const loadConversations = async () => {
    try {
      console.log('Loading conversations...');
      
      // First get all messages (we'll group them later)
      const allMessages = await window.electronAPI.database.query(
        'SELECT * FROM messages ORDER BY timestamp ASC'
      );
      console.log('All messages loaded:', allMessages);

      // Get all peers
      const peers = await window.electronAPI.database.query(
        'SELECT * FROM peers ORDER BY last_seen DESC'
      );
      console.log('All peers loaded:', peers);

      // Group messages by peer
      const conversationsData = peers.map(peer => {
        const peerMessages = allMessages.filter(msg => msg.peer === peer.address);
        console.log(`Processing ${peerMessages.length} messages for peer ${peer.address}`);

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

      console.log('Final processed conversations:', conversationsData);
      
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
    console.log('Initializing database for user:', username);
    const success = await window.electronAPI.database.init(username);
    console.log('Database initialization result:', success);
    
    if (success) {
      // Inspect database after initialization
      await window.electronAPI.database.inspect();
      
      setIsLoggedIn(true);
      setCurrentScreen('home');
      
      // Explicitly load conversations after state updates
      setTimeout(async () => {
        await loadConversations();
      }, 0);
    }
  };

  // Add automatic conversation reload when returning to home screen
  useEffect(() => {
    if (currentScreen === 'home' && isLoggedIn) {
      loadConversations();
    }
  }, [currentScreen, isLoggedIn]);

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUsername('');
    setKey('');
    setCurrentScreen('login');
    setConversations([]);
    setActiveConversation(null);
  };

  const handleConnect = async (address) => {
    try {
      console.log('Creating conversation with:', address);
      const success = await window.electronAPI.database.createConversation(address);
      console.log('Conversation created:', success);
      
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
        
        // Inspect database after creating conversation
        await window.electronAPI.database.inspect();
      }
    } catch (error) {
      console.error('Failed to create conversation:', error);
    }
  };

  const handleSendMessage = async (content) => {
    try {
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      // Send the message and get the result
      const message = await window.electronAPI.database.insertMessage(activeConversation, content, true);
      console.log('Message sent:', message);
      
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

      // Simulate response after delay
      setTimeout(async () => {
        const response = await window.electronAPI.database.insertMessage(
          activeConversation,
          'erm what the sigma',
          false
        );
        console.log('Response received:', response);

        const responseMessage = { 
          type: 'received', 
          content: response.content,
          time: new Date(response.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        // Update UI with the response
        setConversations(prevConversations => {
          return prevConversations.map(conv => {
            if (conv.id === activeConversation) {
              return {
                ...conv,
                messages: [...(conv.messages || []), responseMessage]
              };
            }
            return conv;
          });
        });

        // Inspect database after message exchange
        await window.electronAPI.database.inspect();
      }, 1000);

    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleDeleteConversation = async (convId) => {
    try {
      console.log('Deleting conversation:', convId);
      const success = await window.electronAPI.database.deleteConversation(convId);
      
      if (success) {
        // Remove from UI
        setConversations(prev => prev.filter(conv => conv.id !== convId));
        console.log('Conversation deleted successfully');
        
        // If we're viewing the deleted conversation, go back home
        if (activeConversation === convId) {
          setCurrentScreen('home');
          setActiveConversation(null);
        }
        
        // Inspect database after deletion
        await window.electronAPI.database.inspect();
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    }
  };

  const renderScreen = () => {
    switch (currentScreen) {
      case 'login':
        return (
          <form className="login-form" onSubmit={handleSubmit}>
            <h1 className="title">Pier2Pier</h1>
            
            <div className="input-group">
              <input
                type="text"
                className="input-field"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
              />
            </div>

            <div className="input-group">
              <input
                type="password"
                className="input-field"
                placeholder="Key"
                value={key}
                onChange={(e) => setKey(e.target.value)}
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

  return (
    <>
      <div className="title-bar">
        <span>Pier2Pier</span>
      </div>
      <div className="app-container">
        {renderScreen()}
      </div>
    </>
  );
}

export default App; 