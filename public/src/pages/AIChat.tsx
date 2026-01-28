import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, Sparkles, Smile, Frown, Zap, Coffee, Play, AlertCircle, RefreshCw, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Track } from '../types/types';
import { usePlayer } from '../context/PlayerContext';
import { aiAPI } from '../services/api';

interface Message {
  id: number;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
}

type Mood = 'Happy' | 'Sad' | 'Energetic' | 'Relaxed' | 'Neutral';

const AIChat: React.FC = () => {
  const navigate = useNavigate();
  const { playTrack, setPlaylist } = usePlayer();
  
  // --- CONFIG ---
  const isComingSoon = true; // Set to false when you're ready to launch
  // --------------

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      text: "Hey! I'm Mariz AI Assistant. Soon, you'll be able to tell me how you're feeling, and I'll build the perfect vibe for you!",
      sender: 'ai',
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [mood, setMood] = useState<Mood>('Neutral');
  const [recommendations, setRecommendations] = useState<Track[]>([]);
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = async () => {
    // Block execution if coming soon
    if (isComingSoon || !inputValue.trim() || isTyping) return;

    const userMsg: Message = {
      id: Date.now(),
      text: inputValue,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');
    setIsTyping(true);
    setError(null);

    try {
      const conversationHistory = messages
        .filter(m => m.sender === 'user' || m.sender === 'ai')
        .map(m => ({
          role: m.sender === 'user' ? 'user' : 'assistant',
          content: m.text
        }));

      conversationHistory.push({
        role: 'user',
        content: userMsg.text
      });

      const response = await aiAPI.chat(conversationHistory, true);

      const aiMsg: Message = {
        id: Date.now() + 1,
        text: response.message,
        sender: 'ai',
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, aiMsg]);

      if (response.mood && response.mood.confidence >= 0.5) {
        setMood(response.mood.mood);
        if (response.mood.mood !== 'Neutral') {
          loadRecommendations(response.mood.mood);
        }
      }

    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Connection failed';
      setError(errorMessage);
      setMessages((prev) => [...prev, {
        id: Date.now() + 1,
        text: `Sorry, I'm having trouble connecting. ${errorMessage}.`,
        sender: 'ai',
        timestamp: new Date(),
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const loadRecommendations = async (detectedMood: Mood) => {
    if (isComingSoon) return;
    setIsLoadingRecommendations(true);
    try {
      const response = await aiAPI.recommend(detectedMood, '', true);
      setRecommendations(response.tracks || []);
    } catch (error: any) {
      setError("Failed to load recommendations.");
    } finally {
      setIsLoadingRecommendations(false);
    }
  };

  const retryRecommendations = () => {
    if (!isComingSoon && mood !== 'Neutral') loadRecommendations(mood);
  };

  const handleTrackClick = (track: Track) => {
    if (isComingSoon) return;
    setPlaylist(recommendations);
    playTrack(track);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const moodIcons = {
    Happy: <Smile className="text-yellow-400" size={20} />,
    Sad: <Frown className="text-blue-400" size={20} />,
    Energetic: <Zap className="text-orange-400" size={20} />,
    Relaxed: <Coffee className="text-emerald-400" size={20} />,
    Neutral: <Sparkles className="text-[#1DB954]" size={20} />,
  };

  return (
    <div className="pt-5 flex flex-col h-screen bg-zinc-950 text-white">
      {/* 1️⃣ HEADER */}
      <div className="shrink-0 flex items-center justify-between p-4 bg-zinc-900/95 backdrop-blur-sm border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-zinc-800 rounded-full transition">
            <ArrowLeft size={24} />
          </button>
          <div className="w-10 h-10 rounded-full flex items-center justify-center border border-blue-400/40">
            <Bot className="text-blue-400" size={24} />
          </div>
          <div>
            <h2 className="font-bold text-sm">Mariz AI</h2>
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 ${isComingSoon ? 'bg-orange-500' : 'bg-blue-500'} rounded-full animate-pulse`} />
              <span className="text-[10px] text-zinc-400">{isComingSoon ? 'Beta Testing' : 'Online'}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-zinc-800/80 px-3 py-1.5 rounded-full border border-zinc-700">
          <span className="text-xs text-zinc-300 font-medium">Mood: {mood}</span>
          {moodIcons[mood]}
        </div>
      </div>

      {/* 2️⃣ SCROLL AREA */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {error && !isComingSoon && (
          <div className="mx-4 mt-4 p-3 bg-red-900/20 border border-red-500/50 rounded-lg flex items-start gap-2">
            <AlertCircle size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-400 flex-1">{error}</p>
            <button onClick={() => setError(null)} className="text-red-400">×</button>
          </div>
        )}

        <div className="p-4 space-y-4">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] px-4 py-3 rounded-2xl shadow-sm ${msg.sender === 'user' ? 'bg-blue-400 text-black rounded-tr-none' : 'bg-zinc-800 text-white rounded-tl-none'}`}>
                <p className="text-sm leading-relaxed">{msg.text}</p>
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-zinc-800 px-4 py-3 rounded-2xl rounded-tl-none flex gap-1">
                <div className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3️⃣ INPUT BAR WITH COMING SOON OVERLAY */}
      <div className="shrink-0 p-4 bg-zinc-900 border-t border-zinc-800 safe-area-inset-bottom relative">
        {isComingSoon && (
          <div className="absolute inset-0 z-10 bg-zinc-900/60 backdrop-blur-[2px] flex items-center justify-center">
            <div className="bg-blue-500/20 border border-blue-400/40 px-6 py-2 rounded-full flex items-center gap-3 shadow-2xl">
              <Sparkles size={16} className="text-blue-400 animate-pulse" />
              <span className="text-xs font-bold text-blue-100 tracking-wider uppercase">
                AI Mood Engine Coming Soon
              </span>
            </div>
          </div>
        )}

        <div className={`flex items-center gap-2 bg-zinc-800 p-1.5 pl-4 rounded-full border border-zinc-700 transition ${isComingSoon ? 'opacity-30 grayscale pointer-events-none' : 'focus-within:border-blue-100/40'}`}>
          <input
            type="text"
            placeholder={isComingSoon ? "Stay tuned..." : "Tell me your vibe..."}
            className="flex-1 bg-transparent text-sm py-2 focus:outline-none placeholder:text-zinc-500"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isComingSoon || isTyping}
          />
          <button
            onClick={handleSend}
            disabled={isComingSoon || !inputValue.trim() || isTyping}
            className="bg-blue-400 text-black p-2.5 rounded-full hover:scale-105 active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIChat;