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
  scale?: number;
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
  color = 'sky',
  scale: baseScale = 1
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
    meshRef.current.scale.setScalar(Math.max(0.01, scale * baseScale));
  });

  const hexColor = colorMap[color] || colorMap.sky;

  return (
    <mesh ref={meshRef} position={position}>
      <boxGeometry args={[1.2, 1.2, 1.2]} />
      <meshStandardMaterial 
        color={hexColor} 
        emissive={hexColor} 
        emissiveIntensity={0.4} 
        roughness={0.1} 
        metalness={0.9}
      />
      <Html distanceFactor={12} position={[0, 1.5, 0]} center>
        <div className="flex flex-col items-center select-none pointer-events-none min-w-[120px]">
            <span className="text-[12px] font-mono font-black uppercase tracking-[0.2em] text-white bg-slate-900/90 px-3 py-1 rounded-md border-2 border-slate-700 shadow-2xl backdrop-blur-md">
              {label}
            </span>
            {value !== undefined && (
                <div className="mt-2 text-lg font-black text-sky-300 bg-slate-950/90 px-4 py-2 rounded-xl border-2 border-sky-500/50 shadow-[0_0_20px_rgba(14,165,233,0.3)] backdrop-blur-xl ring-1 ring-white/10">
                    {String(value)}
                </div>
            )}
        </div>
      </Html>
    </mesh>
  );
};

export default RuntimeVariable;
