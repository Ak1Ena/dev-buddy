import React from 'react';
import { motion } from 'framer-motion';

interface ParticleProps {
  fromPos: [number, number];
  toPos: [number, number];
  color?: string;
  progress: number; // 0 to 1
}

export const Particle: React.FC<ParticleProps> = ({ fromPos, toPos, color = 'sky', progress }) => {
  const x = fromPos[0] + (toPos[0] - fromPos[0]) * progress;
  const y = fromPos[1] + (toPos[1] - fromPos[1]) * progress;
  
  const colorMap: Record<string, string> = {
    fuchsia: '#f0abfc',
    sky: '#38bdf8',
    emerald: '#10b981',
    amber: '#fbbf24',
  };

  return (
    <div
      style={{
        position: 'absolute',
        left: `${x / 10}%`,
        top: `${y / 10}%`,
        width: '12px',
        height: '12px',
        borderRadius: '50%',
        backgroundColor: colorMap[color] || color,
        boxShadow: `0 0 10px ${colorMap[color] || color}`,
        zIndex: 20,
        transform: 'translate(-50%, -50%)',
      }}
    />
  );
};

export default Particle;
