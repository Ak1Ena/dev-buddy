import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useTimelineStore } from '../../timeline/useTimelineStore';

export interface RuntimeVariableProps {
  id: string;
  start: number;
  duration: number;
  position: [number, number, number];
  label: string;
  value?: string | number;
  color?: string;
}

const colorMap: Record<string, string> = {
  fuchsia: '#d946ef',
  sky: '#0ea5e9',
  emerald: '#10b981',
  amber: '#f59e0b',
  slate: '#64748b',
};

export const RuntimeVariable: React.FC<RuntimeVariableProps> = ({ 
  start, 
  duration, 
  position, 
  label,
  value,
  color = 'sky' 
}) => {
  const meshRef = useRef<THREE.Mesh>(null!);
  const { currentTime } = useTimelineStore();

  useFrame(() => {
    // Calculate internal progress
    let progress = 0;
    if (currentTime > start) {
        progress = Math.min(1, (currentTime - start) / (duration || 0.1));
    }
    if (currentTime < start || currentTime > start + duration) {
        meshRef.current.visible = false;
        return;
    } else {
        meshRef.current.visible = true;
    }

    // Imperative animation
    // Float effect
    meshRef.current.position.y = position[1] + Math.sin(currentTime * 2) * 0.1;
    
    // Scale up on spawn
    const scale = progress < 0.1 ? progress * 10 : (progress > 0.9 ? (1 - progress) * 10 : 1);
    meshRef.current.scale.setScalar(Math.max(0.01, scale));
  });

  const hexColor = colorMap[color] || colorMap.sky;

  return (
    <mesh ref={meshRef} position={position}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial 
        color={hexColor} 
        emissive={hexColor} 
        emissiveIntensity={0.2} 
        roughness={0.2} 
        metalness={0.8}
      />
      <Html distanceFactor={10} position={[0, 1.2, 0]} center>
        <div className="flex flex-col items-center select-none pointer-events-none">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400 bg-slate-900/80 px-2 py-0.5 rounded border border-slate-700/50 backdrop-blur-sm">
              {label}
            </span>
            {value !== undefined && (
                <span className="mt-1 text-sm font-black text-white bg-black/60 px-3 py-1 rounded-lg border border-slate-600/50 shadow-lg backdrop-blur-md">
                    {String(value)}
                </span>
            )}
        </div>
      </Html>
    </mesh>
  );
};

export default RuntimeVariable;
