import { create } from 'zustand';

interface TimelineState {
  currentTime: number;
  isPlaying: number; // 0: paused, 1: playing, 2: waiting_at_gate
  duration: number;
  
  setCurrentTime: (time: number | ((prev: number) => number)) => void;
  play: () => void;
  pause: () => void;
  reset: () => void;
  setDuration: (duration: number) => void;
  waitAtGate: () => void;
  resumeFromGate: () => void;
}

export const useTimelineStore = create<TimelineState>((set) => ({
  currentTime: 0,
  isPlaying: 0,
  duration: 0,
  
  setCurrentTime: (time) => set((state) => ({ 
    currentTime: typeof time === 'function' ? time(state.currentTime) : time 
  })),
  play: () => set({ isPlaying: 1 }),
  pause: () => set({ isPlaying: 0 }),
  reset: () => set({ currentTime: 0, isPlaying: 0 }),
  setDuration: (duration) => set({ duration }),
  waitAtGate: () => set({ isPlaying: 2 }),
  resumeFromGate: () => set({ isPlaying: 1 }),
}));
