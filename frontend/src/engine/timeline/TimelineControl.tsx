import React from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';
import { useTimelineStore } from './useTimelineStore';
import { cn } from '@/lib/utils';

export const TimelineControl: React.FC = () => {
  const { 
    currentTime, 
    setCurrentTime, 
    isPlaying, 
    play, 
    pause, 
    reset, 
    duration 
  } = useTimelineStore();

  const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setCurrentTime(value);
  };

  const formatTime = (seconds: number) => {
    return seconds.toFixed(1) + 's';
  };

  return (
    <div className="flex items-center gap-4 bg-slate-900/80 backdrop-blur-md border border-slate-700/50 p-3 rounded-xl shadow-xl">
      {/* Play/Pause */}
      <button
        onClick={isPlaying === 1 ? pause : play}
        className={cn(
          "p-2 rounded-full transition-all",
          isPlaying === 1 ? "bg-fuchsia-500/20 text-fuchsia-400 hover:bg-fuchsia-500/30" : "bg-sky-500/20 text-sky-400 hover:bg-sky-500/30"
        )}
      >
        {isPlaying === 1 ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
      </button>

      {/* Reset */}
      <button
        onClick={reset}
        className="p-2 rounded-full bg-slate-800 text-slate-400 hover:bg-slate-700 transition-all"
        title="Reset"
      >
        <RotateCcw size={18} />
      </button>

      {/* Time Display */}
      <div className="text-xs font-mono text-slate-400 min-w-[40px] tabular-nums">
        {formatTime(currentTime)}
      </div>

      {/* Slider */}
      <div className="relative flex-1 h-6 flex items-center">
        <input
          type="range"
          min={0}
          max={duration || 0.1}
          step={0.01}
          value={currentTime}
          onChange={handleScrub}
          className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-fuchsia-500 hover:accent-fuchsia-400 transition-all"
        />
        {/* Progress Fill */}
        <div 
          className="absolute left-0 top-[11px] h-1.5 bg-fuchsia-500 rounded-l-lg pointer-events-none"
          style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
        />
      </div>

      {/* Total Duration */}
      <div className="text-xs font-mono text-slate-500 min-w-[40px] tabular-nums text-right">
        {formatTime(duration)}
      </div>
    </div>
  );
};

export default TimelineControl;
