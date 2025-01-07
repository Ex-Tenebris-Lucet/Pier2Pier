import React, { useState } from 'react';
import './App.css';

function App() {
  const [username, setUsername] = useState('');
  const [key, setKey] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Login attempted with:', { username, key });
  };

  return (
    <div className="app-container">
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
          disabled={!username || !key}
        >
          Login
        </button>
      </form>
    </div>
  );
}

export default App; 