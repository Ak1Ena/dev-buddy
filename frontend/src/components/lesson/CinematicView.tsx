import React from 'react';
import { SceneJSON, AnimationFrame } from '@/types';
import ScenePlayer from '@/engine/renderer/ScenePlayer';
import AnimationPlayer from './AnimationPlayer';

interface CinematicViewProps {
  scene?: SceneJSON;
  frames?: AnimationFrame[];
  activeFrameIndex?: number;
  highlightedNodeIds?: string[];
  onFrameChange?: (idx: number, isCheckpoint: boolean) => void;
}

export const CinematicView: React.FC<CinematicViewProps> = ({
  scene,
  frames,
  activeFrameIndex,
  highlightedNodeIds,
  onFrameChange
}) => {
  if (scene) {
    return <ScenePlayer scene={scene} />;
  }

  if (frames && frames.length > 0) {
    return (
      <AnimationPlayer
        frames={frames}
        activeFrameIndex={activeFrameIndex}
        highlightedNodeIds={highlightedNodeIds}
        onFrameChange={onFrameChange}
      />
    );
  }

  return (
    <div className="h-full flex items-center justify-center opacity-40 bg-slate-900/50 rounded-2xl border border-slate-800">
      <div className="text-center">
        <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">No Cinematic Content</p>
      </div>
    </div>
  );
};

export default CinematicView;
