import React from 'react';
import { motion } from 'framer-motion';

interface BoxProps {
  label: string;
  value: string;
  pos: [number, number];
  isActive?: boolean;
  progress: number; // 0 to 1
}

export const Box: React.FC<BoxProps> = ({ label, value, pos, isActive, progress }) => {
  // Deterministic entrance/exit based on progress
  const opacity = progress < 0.1 ? progress * 10 : (progress > 0.9 ? (1 - progress) * 10 : 1);
  const scale = 0.9 + (Math.min(opacity, 1) * 0.1);

  return (
    <motion.div
      style={{
        position: 'absolute',
        left: `${pos[0] / 10}%`,
        top: `${pos[1] / 10}%`,
        width: '100px',
        height: '60px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#1e293b',
        border: '2px solid',
        borderColor: isActive ? '#f0abfc' : '#334155',
        borderRadius: '8px',
        color: 'white',
        zIndex: 10,
        opacity: opacity,
        scale: scale,
        boxShadow: isActive ? `0 0 ${15 * opacity}px rgba(240, 171, 252, 0.5)` : 'none',
        transform: 'translate(-50%, -50%)',
      }}
    >
      <span style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      <span style={{ fontSize: '16px', fontWeight: 'bold', fontFamily: 'monospace' }}>{value}</span>
    </motion.div>
  );
};

export default Box;
