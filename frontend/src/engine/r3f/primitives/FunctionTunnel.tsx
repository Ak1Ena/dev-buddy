import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useTimelineStore } from '../../timeline/useTimelineStore';

export interface FunctionTunnelProps {
  id: string;
  start: number;
  duration: number;
  position: [number, number, number];
  name: string;
  depth?: number;
}

export const FunctionTunnel: React.FC<FunctionTunnelProps> = ({
  start,
  duration,
  position,
  name,
  depth = 0
}) => {
  const groupRef = useRef<THREE.Group>(null!);
  const boxRef = useRef<THREE.Mesh>(null!);
  const { currentTime } = useTimelineStore();

  useFrame(() => {
    if (currentTime < start || currentTime > start + duration) {
        groupRef.current.visible = false;
        return;
    } else {
        groupRef.current.visible = true;
    }
    
    let progress = Math.min(1, (currentTime - start) / (duration || 0.1));
    const scale = progress < 0.1 ? progress * 10 : (progress > 0.9 ? (1 - progress) * 10 : 1);
    
    groupRef.current.scale.setScalar(Math.max(0.01, scale));
    // Subtly rotate the tunnel
    boxRef.current.rotation.x = Math.sin(currentTime * 0.5) * 0.05;
    boxRef.current.rotation.y = Math.cos(currentTime * 0.5) * 0.05;
  });

  return (
    <group ref={groupRef} position={position}>
      <mesh ref={boxRef} position={[0, 0, -depth * 2]}>
        {/* Hollow box using doubleSide or backSide, but simpler to just use a box with wireframe for now */}
        <boxGeometry args={[4, 3, 4]} />
        <meshStandardMaterial 
          color="#3b82f6" 
          wireframe 
          transparent
          opacity={0.3}
          emissive="#3b82f6"
          emissiveIntensity={0.5}
        />
      </mesh>
      
      <Html distanceFactor={15} position={[-2, 1.8, -depth * 2]} center>
         <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-sky-950/80 border border-sky-500/30 backdrop-blur-md shadow-[0_0_15px_rgba(14,165,233,0.2)] select-none pointer-events-none">
            <div className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
            <span className="text-xs font-mono font-bold text-sky-200">{name}()</span>
         </div>
      </Html>
    </group>
  );
};

export default FunctionTunnel;
