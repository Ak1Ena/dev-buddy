import React from 'react';
import { motion } from 'framer-motion';

interface PulseProps {
  x: number;
  y: number;
  radius?: number;
  color?: string;
  progress: number; // 0 to 1
}

export const Pulse: React.FC<PulseProps> = ({ 
  x, 
  y, 
  radius = 60, 
  color = '#f0abfc', // Fuchsia
  progress 
}) => {
  // Pulse twice over the duration
  const pulseCount = 2;
  const localProgress = (progress * pulseCount) % 1;
  const opacity = (1 - localProgress) * (progress < 0.9 ? 1 : (1 - progress) * 10);
  const currentRadius = radius * localProgress;

  return (
    <div
      style={{
        position: 'absolute',
        left: `${x / 10}%`,
        top: `${y / 10}%`,
        width: 0,
        height: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 5,
        pointerEvents: 'none',
        transform: 'translate(-50%, -50%)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          width: currentRadius * 2,
          height: currentRadius * 2,
          borderRadius: '50%',
          border: `2px solid ${color}`,
          opacity: opacity,
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: currentRadius * 1.5,
          height: currentRadius * 1.5,
          borderRadius: '50%',
          backgroundColor: color,
          opacity: opacity * 0.3,
        }}
      />
    </div>
  );
};

export default Pulse;
