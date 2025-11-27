import React, { useState, useRef, useEffect } from 'react';
import { useGame } from '../contexts/GameContext';
import './Chat.css';

const Chat = () => {
  const { chatMessages, sendChatMessage, player } = useGame();
  const [message, setMessage] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (message.trim()) {
      sendChatMessage(message.trim());
      setMessage('');
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('ko-KR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        <span className="chat-title">채팅</span>
        <span className="message-count">{chatMessages.length}</span>
      </div>
      
      <div className="chat-messages">
        {chatMessages.length === 0 ? (
          <div className="no-messages">
            <p>아직 메시지가 없습니다</p>
          </div>
        ) : (
          chatMessages.map((msg, index) => (
            <div 
              key={index} 
              className={`chat-message ${msg.senderId === player?.id ? 'is-mine' : ''}`}
            >
              <div className="message-header">
                <span className="sender-name">{msg.senderNickname}</span>
                <span className="message-time">{formatTime(msg.timestamp)}</span>
              </div>
              <div className="message-content">{msg.message}</div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
      
      <form className="chat-input-form" onSubmit={handleSubmit}>
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="메시지 입력..."
          maxLength={200}
        />
        <button type="submit" disabled={!message.trim()}>
          전송
        </button>
      </form>
    </div>
  );
};

export default Chat;
