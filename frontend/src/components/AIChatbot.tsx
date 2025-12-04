import React, { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { GlassCard } from "./GlassCard";
import { GlassButton } from "./GlassButton";
import { AIChatBubble } from "./AIChatBubble";
import { 
  Send, 
  Bot, 
  User, 
  Loader2,
  ThumbsUp,
  ThumbsDown,
  RefreshCw,
  Lightbulb
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";
import apiClient from "../lib/apiClient";

import { ChatMessage } from '@/types/application';

interface ChatContext {
  type: 'application';
  applicationId: string;
  jobTitle: string;
  candidateName: string;
}

interface AIChatbotProps {
  context?: ChatContext;
}

export default function AIChatbot({ context }: AIChatbotProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchSuggestions();
    // Add welcome message
    setMessages([{
      id: '1',
      type: 'ai',
      content: `Hello ${user?.name || 'there'}! I'm your AI HR assistant. I can help you with job applications, resume tips, interview preparation, and answer questions about our hiring process. How can I assist you today?`,
      timestamp: new Date(),
      suggestions: []
    }]);
  }, [user]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchSuggestions = async () => {
    try {
      const response = await apiClient.getChatSuggestions(user?.role || 'candidate');
      setSuggestions(response.suggestions || []);
    } catch (error) {
      console.error('Failed to fetch suggestions:', error);
    }
  };

  const sendMessage = async (message: string) => {
    if (!message.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: message,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage("");
    setIsLoading(true);

    try {
      const response = await apiClient.sendChatQuery(
        message,
        user?.role || 'candidate',
        user?.id,
        { previousMessages: messages.slice(-5) } // Send last 5 messages as context
      );

      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: response.response,
        timestamp: new Date(),
        suggestions: response.suggestions || []
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error: any) {
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: "I'm sorry, I'm having trouble processing your request right now. Please try again in a moment.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
      toast.error('Failed to send message: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(inputMessage);
  };

  const handleSuggestionClick = (suggestion: string) => {
    sendMessage(suggestion);
  };

  const handleFeedback = async (messageId: string, feedback: 'positive' | 'negative') => {
    try {
      await apiClient.submitChatFeedback({
        message_id: messageId,
        feedback,
        user_id: user?.id
      });
      
      setMessages(prev => prev.map(msg => 
        msg.id === messageId ? { ...msg, feedback } : msg
      ));
      
      toast.success('Thank you for your feedback!');
    } catch (error) {
      toast.error('Failed to submit feedback');
    }
  };

  const clearChat = () => {
    setMessages([{
      id: '1',
      type: 'ai',
      content: `Hello ${user?.name || 'there'}! I'm your AI HR assistant. How can I help you today?`,
      timestamp: new Date(),
      suggestions: []
    }]);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border/50">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
            <Bot className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold">AI HR Assistant</h2>
            <p className="text-sm text-muted-foreground">
              {user?.role === 'candidate' ? 'Job search & application help' :
               user?.role === 'hr' ? 'HR management & recruitment' :
               user?.role === 'recruiter' ? 'Candidate screening & matching' :
               'General assistance'}
            </p>
          </div>
        </div>
        
        <GlassButton variant="outline" size="sm" onClick={clearChat}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Clear Chat
        </GlassButton>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <motion.div
            key={message.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {message.type === 'user' ? (
              <div className="flex justify-end">
                <div className="max-w-[80%] bg-primary text-primary-foreground rounded-2xl px-4 py-2">
                  <p className="text-sm">{message.content}</p>
                  <p className="text-xs opacity-70 mt-1">
                    {message.timestamp.toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex justify-start">
                <div className="max-w-[80%]">
                  <AIChatBubble
                    message={message.content}
                    timestamp={message.timestamp}
                    suggestions={message.suggestions}
                    onSuggestionClick={handleSuggestionClick}
                  />
                  
                  {/* Feedback Buttons */}
                  <div className="flex items-center space-x-2 mt-2 ml-12">
                    <GlassButton
                      variant="outline"
                      size="sm"
                      onClick={() => handleFeedback(message.id, 'positive')}
                      className={`h-8 px-2 ${message.feedback === 'positive' ? 'bg-green-500/20 text-green-500' : ''}`}
                    >
                      <ThumbsUp className="w-3 h-3" />
                    </GlassButton>
                    <GlassButton
                      variant="outline"
                      size="sm"
                      onClick={() => handleFeedback(message.id, 'negative')}
                      className={`h-8 px-2 ${message.feedback === 'negative' ? 'bg-red-500/20 text-red-500' : ''}`}
                    >
                      <ThumbsDown className="w-3 h-3" />
                    </GlassButton>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="max-w-[80%]">
              <GlassCard className="p-4">
                <div className="flex items-center space-x-2">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">AI is thinking...</span>
                </div>
              </GlassCard>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="p-4 border-t border-border/50">
          <div className="flex items-center space-x-2 mb-3">
            <Lightbulb className="w-4 h-4 text-yellow-500" />
            <span className="text-sm font-medium">Suggested questions:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {suggestions.slice(0, 4).map((suggestion, index) => (
              <GlassButton
                key={index}
                variant="outline"
                size="sm"
                onClick={() => handleSuggestionClick(suggestion)}
                className="text-xs"
              >
                {suggestion}
              </GlassButton>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-border/50">
        <form onSubmit={handleSubmit} className="flex space-x-2">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Ask me anything about jobs, applications, or HR..."
            className="flex-1 glass px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
            disabled={isLoading}
          />
          <GlassButton
            type="submit"
            variant="primary"
            disabled={isLoading || !inputMessage.trim()}
          >
            <Send className="w-4 h-4" />
          </GlassButton>
        </form>
      </div>
    </div>
  );
}
