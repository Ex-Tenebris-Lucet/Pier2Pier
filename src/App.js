import React, { useState } from 'react';

function App() {
  const [username, setUsername] = useState('');
  const [key, setKey] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Login attempted with:', { username, key });
  };

  return (
    <div style={{ 
      height: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      backgroundColor: '#282c34'
    }}>
      <form 
        onSubmit={handleSubmit}
        style={{
          padding: '20px',
          backgroundColor: 'white',
          borderRadius: '8px',
          minWidth: '300px'
        }}
      >
        <h1 style={{ 
          textAlign: 'center',
          marginBottom: '20px',
          color: '#282c34'
        }}>
          Pier2Pier
        </h1>
        
        <div style={{ marginBottom: '15px' }}>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            style={{
              width: '100%',
              padding: '8px',
              borderRadius: '4px',
              border: '1px solid #ccc'
            }}
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="Key"
            style={{
              width: '100%',
              padding: '8px',
              borderRadius: '4px',
              border: '1px solid #ccc'
            }}
          />
        </div>

        <button 
          type="submit"
          style={{
            width: '100%',
            padding: '8px',
            backgroundColor: '#61dafb',
            border: 'none',
            borderRadius: '4px',
            color: 'white',
            cursor: 'pointer'
          }}
        >
          Login
        </button>
      </form>
    </div>
  );
}

export default App; 