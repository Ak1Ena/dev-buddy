import React, { useEffect, useRef } from 'react';
import { useTimelineStore } from '../timeline/useTimelineStore';
import { SceneJSON, ScenePrimitive } from '../types';
import PrimitiveFactory from './PrimitiveFactory';
import TimelineControl from '../timeline/TimelineControl';

interface ScenePlayerProps {
  scene: SceneJSON;
}

export const ScenePlayer: React.FC<ScenePlayerProps> = ({ scene }) => {
  const { 
    currentTime, 
    setCurrentTime, 
    isPlaying, 
    setDuration 
  } = useTimelineStore();
  
  const lastTimeRef = useRef<number | null>(null);
  const requestRef = useRef<number>();

  // Initialize duration
  useEffect(() => {
    if (scene.metadata?.totalDuration) {
      setDuration(scene.metadata.totalDuration);
    }
  }, [scene, setDuration]);

  // Animation Loop
  const animate = (time: number) => {
    if (lastTimeRef.current !== null && isPlaying === 1) {
      const deltaTime = (time - lastTimeRef.current) / 1000;
      setCurrentTime((prev) => {
        const next = prev + deltaTime;
        if (next >= (scene.metadata?.totalDuration || 0)) {
          return scene.metadata?.totalDuration || 0;
        }
        return next;
      });
    }
    lastTimeRef.current = time;
    requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [isPlaying]);

  // Filter active primitives
  const activePrimitives = scene.timeline.filter((p: ScenePrimitive) => {
    return currentTime >= p.start && currentTime <= (p.start + (p.duration || 0.1));
  });

  return (
    <div className="relative w-full h-full overflow-hidden bg-slate-950 rounded-2xl border border-slate-700/60 shadow-2xl flex flex-col">
      {/* Background/Grid */}
      <div 
        className="absolute inset-0 opacity-20" 
        style={{ 
          backgroundImage: 'radial-gradient(#6366f1 1.5px, transparent 1.5px)', 
          backgroundSize: '40px 40px' 
        }} 
      />
      
      {/* Viewport (Squareish area for animation) */}
      <div className="relative flex-1 overflow-hidden">
        {activePrimitives.map((primitive) => {
          const progress = Math.max(0, Math.min(1, (currentTime - primitive.start) / (primitive.duration || 0.1)));
          return <PrimitiveFactory key={primitive.id} primitive={primitive} progress={progress} />;
        })}

        {/* Playback Indicator Overlay */}
        <div className="absolute top-4 right-4 flex items-center gap-2">
          {isPlaying === 2 && (
            <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
          )}
          <div className="text-[10px] font-bold tracking-widest uppercase text-slate-500 bg-slate-900/80 backdrop-blur-sm px-2.5 py-1 rounded-full border border-slate-700/50">
            {isPlaying === 2 ? 'WAITING' : (isPlaying === 1 ? 'LIVE' : 'PAUSED')}
          </div>
        </div>
      </div>

      {/* Control Area */}
      <div className="p-4 bg-gradient-to-t from-slate-950 to-transparent">
        <TimelineControl />
      </div>
    </div>
  );
};

export default ScenePlayer;
