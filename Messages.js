import React, { useState, useEffect, useContext } from 'react';
import { AuthContext, SettingsContext } from '../App';
import { SocketContext } from './SocketProvider';
import './Messages.css';

const Messages = () => {
  const { user } = useContext(AuthContext);
  const { settings } = useContext(SettingsContext);
  const socket = useContext(SocketContext);

  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    socket.on('receive_message', (newMessage) => {
      setMessages((prev) => [...prev, newMessage]);
    });

    socket.on('user_typing', () => {
      setIsTyping(true);
    });

    socket.on('user_stop_typing', () => {
      setIsTyping(false);
    });

    return () => {
      socket.off('receive_message');
      socket.off('user_typing');
      socket.off('user_stop_typing');
    };
  }, [socket]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (message.trim()) {
      const newMessage = {
        text: message,
        sender: user.username,
        timestamp: new Date().toISOString()
      };
      socket.emit('send_message', newMessage);
      setMessages((prev) => [...prev, newMessage]);
      setMessage('');
    }
  };

  return (
    <div className={`messages-container ${settings.darkMode ? 'dark' : 'light'}`}>
      <div className="messages-list">
        {messages.map((msg, index) => (
          <div key={index} className={`message ${msg.sender === user.username ? 'sent' : 'received'}`}>
            <div className="message-content">
              <div className="message-text">{msg.text}</div>
              <div className="message-meta">
                <span className="message-sender">{msg.sender}</span>
                <span className="message-time">
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </span>
              </div>
            </div>
          </div>
        ))}
        {isTyping && <div className="typing-indicator">Someone is typing...</div>}
      </div>

      <form onSubmit={handleSendMessage} className="message-form">
        <input
          type="text"
          value={message}
          onChange={(e) => {
            setMessage(e.target.value);
            socket.emit('typing');
          }}
          onBlur={() => socket.emit('stop_typing')}
          placeholder="Type a message..."
          className={`message-input ${settings.textSize}`}
        />
        <button type="submit" className="send-button">
          Send
        </button>
      </form>
    </div>
  );
};

export default Messages;
