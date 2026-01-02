import React, { useState, useEffect, useRef } from 'react';
import './chatbot.css';

const Chatbot = () => {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState(null);
  const chatWindowRef = useRef(null);
  
  const hasGreeted = useRef(false);

  useEffect(() => {
    if (!hasGreeted.current) {
      const initGreeting = "Hello Cadet, I am your NCC NEXUS Assistant. How may I help you today?";
      handleBotResponse(initGreeting);
      hasGreeted.current = true;
    }
  }, []);

  useEffect(() => {
    if (chatWindowRef.current) {
      chatWindowRef.current.scrollTo({
        top: chatWindowRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages, streamingMessage]);

  const handleBotResponse = async (fullText) => {
    setIsLoading(true);
    const words = fullText.split(" ");
    let currentText = "";

    for (let i = 0; i < words.length; i++) {
      currentText += (i === 0 ? "" : " ") + words[i];
      setStreamingMessage({
        sender: 'bot',
        text: currentText,
      });
      await new Promise(resolve => setTimeout(resolve, 40));
    }

    const finalMsg = {
      id: Date.now(),
      sender: 'bot',
      text: fullText,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, finalMsg]);
    setStreamingMessage(null);
    setIsLoading(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const text = inputValue.trim();
    if (!text || isLoading) return;

    const userMsg = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: text,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');

    setTimeout(() => {
      const response = "I have received your request regarding: " + text + ". I am processing this according to NCC protocols.";
      handleBotResponse(response);
    }, 600);
  };

  return (
    <div className="chatbot-inner-wrapper">
      <header className="fixed-top-bar">
        <h1 className="chat-title">Your Personal NCC Assistant Chatbot</h1>
      </header>

      <div className="chat-view-container">
        <div className="scrollable-chat-window" ref={chatWindowRef}>
          {messages.map((msg) => (
            <div key={msg.id} className={`message-wrapper ${msg.sender === 'bot' ? 'bot-align' : 'user-align'}`}>
              <div className={`message-bubble ${msg.sender === 'bot' ? 'bot-style' : 'user-style'}`}>
                <div className="content">{msg.text}</div>
                <div className="time-label">
                  {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Just now"}
                </div>
              </div>
            </div>
          ))}

          {streamingMessage && (
            <div className="message-wrapper bot-align">
              <div className="message-bubble bot-style">
                <div className="content">{streamingMessage.text}</div>
                <div className="time-label">typing...</div>
              </div>
            </div>
          )}

          {isLoading && !streamingMessage && (
            <div className="message-wrapper bot-align">
              <div className="message-bubble bot-style thinking-bubble">
                <div className="dot-pulse"></div>
              </div>
            </div>
          )}
        </div>

        <div className="fixed-input-section">
          <form className="chat-input-wrapper" onSubmit={handleSubmit}>
            <input 
              type="text" 
              placeholder={isLoading ? "Assistant is thinking..." : "Search Here"}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              disabled={isLoading}
              autoComplete="off"
              required
            />
            <button type="submit" className="send-btn" disabled={isLoading || !inputValue.trim()}>
              ▶
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Chatbot;