import React, { useState } from 'react';
import {
  Play, Pause, SkipForward, SkipBack, Repeat, Shuffle,
  Volume2, Maximize2, ChevronDown, ListMusic
} from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';

const Player = () => {
  const {
    currentTrack, isPlaying, progress, togglePlay, nextTrack, prevTrack,
    playbackMode, toggleShuffle, toggleRepeat
  } = usePlayer();
  const [isExpanded, setIsExpanded] = useState(false);

  if (!currentTrack) return null;

  const isSmartShuffle = playbackMode === 'smart-shuffle';
  const isRepeatOne = playbackMode === 'repeat-one';

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercent = (progress / currentTrack.duration) * 100;

  if (isExpanded) {
    return (
      <div className="fixed inset-0 z-[100] bg-gradient-to-b from-zinc-800 to-black p-8 flex flex-col items-center text-center animate-in slide-in-from-bottom duration-300">
        <button onClick={() => setIsExpanded(false)} className="self-start mb-12 text-zinc-400"><ChevronDown size={32} /></button>
        <img src={currentTrack.coverUrl} className="w-full max-w-[320px] aspect-square rounded-lg shadow-2xl mb-12" />
        <div className="w-full max-w-[320px] text-left mb-8">
          <h2 className="text-2xl font-bold truncate">{currentTrack.title}</h2>
          <p className="text-zinc-400 text-lg">{currentTrack.artist}</p>
        </div>

        {/* Progress Bar */}
        <div className="w-full max-w-[320px] mb-8">
          <div className="h-1 bg-zinc-700 rounded-full w-full relative mb-2">
            <div className="absolute h-full bg-white rounded-full" style={{ width: `${progressPercent}%` }} />
          </div>
          <div className="flex justify-between text-xs text-zinc-400">
            <span>{formatTime(progress)}</span>
            <span>{formatTime(currentTrack.duration)}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-8 mb-12">
          <button onClick={toggleShuffle} className="relative">
            <Shuffle size={24} className={isSmartShuffle ? "text-blue-400" : "text-zinc-400"} />
            {isSmartShuffle && <span className="absolute -top-2 -right-3 text-[10px] bg-blue-400 text-black px-1 rounded-sm font-bold">AI</span>}
          </button>
          <SkipBack size={32} className="fill-white" onClick={prevTrack} />
          <button onClick={togglePlay} className="w-20 h-20 bg-white rounded-full flex items-center justify-center text-black">
            {isPlaying ? <Pause size={40} className="fill-current" /> : <Play size={40} className="ml-1 fill-current" />}
          </button>
          <SkipForward size={32} className="fill-white" onClick={nextTrack} />
          <button
            onClick={toggleRepeat}
            className="relative group flex items-center justify-center"
          >
            <Repeat
              size={24}
              className={`transition-colors ${isRepeatOne ? "text-blue-400" : "text-zinc-400"}`}
            />
            {isRepeatOne && (
              <span className="absolute text-[9px] font-bold text-blue-400 bg-zinc-900 px-0.5 rounded-full">
                1
              </span>
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-[64px] md:bottom-0 left-0 right-0 bg-blue-900 md:bg-zinc-900 border-t border-zinc-800 px-4 py-2 md:h-24 flex items-center justify-between z-40">
      <div className="flex items-center gap-4 flex-1 md:flex-initial cursor-pointer" onClick={() => setIsExpanded(window.innerWidth < 768)}>
        <img src={currentTrack.coverUrl} className="w-12 h-12 rounded-md object-cover" />
        <div className="flex flex-col overflow-hidden max-w-[150px] md:max-w-[200px]">
          <span className="text-sm font-medium text-white truncate">{currentTrack.title}</span>
          <span className="text-xs text-zinc-400 truncate">{currentTrack.artist}</span>
        </div>
      </div>

      {/* Desktop Controls */}
      <div className="hidden md:flex flex-col items-center gap-2 flex-1 max-w-[600px]">
        <div className="flex items-center gap-6">
          <button onClick={toggleShuffle} className="relative group">
            <Shuffle size={18} className={`transition ${isSmartShuffle ? 'text-blue-400' : 'text-zinc-500 group-hover:text-white'}`} />
            {isSmartShuffle && <span className="absolute -top-2 -right-2 text-[8px] bg-blue-400 text-black px-0.5 rounded-sm font-bold">AI</span>}
          </button>
          <SkipBack size={20} className="text-zinc-400 hover:text-white fill-current cursor-pointer" onClick={prevTrack} />
          <button onClick={togglePlay} className="bg-white text-black p-2 rounded-full hover:scale-105 transition">
            {isPlaying ? <Pause size={20} className="fill-current" /> : <Play size={20} className="ml-0.5 fill-current" />}
          </button>
          <SkipForward size={20} className="text-zinc-400 hover:text-white fill-current cursor-pointer" onClick={nextTrack} />
          <button
            onClick={toggleRepeat}
            className="relative group flex items-center justify-center"
          >
            <Repeat
              size={24}
              className={`transition-colors ${isRepeatOne ? "text-blue-400" : "text-zinc-400"}`}
            />
            {isRepeatOne && (
              <span className="absolute text-[9px] font-bold text-blue-400 bg-zinc-900 px-0.5 rounded-full">
                1
              </span>
            )}
          </button>
        </div>
        <div className="w-full flex items-center gap-2">
          <span className="text-[10px] text-zinc-500 w-8 text-right">{formatTime(progress)}</span>
          <div className="flex-1 h-1 bg-zinc-700 rounded-full relative group">
            <div className="absolute h-full bg-blue-500 group-hover:bg-[#1ed760] rounded-full" style={{ width: `${progressPercent}%` }} />
          </div>
          <span className="text-[10px] text-zinc-500 w-8">{formatTime(currentTrack.duration)}</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button onClick={(e) => { e.stopPropagation(); togglePlay(); }} className="md:hidden text-white">
          {isPlaying ? <Pause size={28} /> : <Play size={28} />}
        </button>
        <div className="hidden md:flex items-center gap-4 text-zinc-400">
          <ListMusic size={18} className="hover:text-white cursor-pointer" />
          <Volume2 size={18} />
          <Maximize2 size={18} className="hover:text-white cursor-pointer" />
        </div>
      </div>
    </div>
  );
};

export default Player;