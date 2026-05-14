import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useTimelineStore } from '../../timeline/useTimelineStore';
import { SceneJSON, ScenePrimitive } from '../../types';

interface ParticleSystemProps {
  scene: SceneJSON | null;
}

export const ParticleSystem: React.FC<ParticleSystemProps> = ({ scene }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const { currentTime } = useTimelineStore();
  
  // Create a dummy object to compute matrix transformations
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Filter out particle primitives
  const particlePrimitives = useMemo(() => {
    if (!scene || !scene.timeline) return [];
    return scene.timeline.filter((p: ScenePrimitive) => p.type === 'particle' || p.type === 'async_packet');
  }, [scene]);

  const maxParticles = 1000;
  const particlesPerFlow = 10;

  useFrame(() => {
    if (!meshRef.current || particlePrimitives.length === 0) return;

    let instanceIdx = 0;

    for (let i = 0; i < particlePrimitives.length; i++) {
      const p = particlePrimitives[i];
      
      // Skip if not active
      if (currentTime < p.start || currentTime > p.start + p.duration) {
          continue;
      }

      const startPos = new THREE.Vector3().fromArray(p.props.position || [0, 0, 0]);
      const endPos = new THREE.Vector3().fromArray(p.props.target || [0, 0, 0]);
      
      const progress = (currentTime - p.start) / (p.duration || 1);
      
      // We spawn `particlesPerFlow` particles for each active flow
      for (let j = 0; j < particlesPerFlow; j++) {
         if (instanceIdx >= maxParticles) break;
         
         // Offset each particle slightly so they form a stream
         const particleProgress = (progress + (j / particlesPerFlow)) % 1;
         
         // Bezier curve approximation for a slight arc
         const mid = startPos.clone().lerp(endPos, 0.5);
         mid.y += 2; // Arc height
         
         // Quadratic bezier
         const t = particleProgress;
         const currentPos = new THREE.Vector3()
             .copy(startPos).multiplyScalar((1 - t) * (1 - t))
             .add(mid.clone().multiplyScalar(2 * (1 - t) * t))
             .add(endPos.clone().multiplyScalar(t * t));

         // Scale particles based on their progress (fade in/out effect)
         const scale = particleProgress < 0.1 ? particleProgress * 10 : (particleProgress > 0.9 ? (1 - particleProgress) * 10 : 1);

         dummy.position.copy(currentPos);
         dummy.scale.setScalar(scale * 0.2); // Base size 0.2
         dummy.updateMatrix();
         meshRef.current.setMatrixAt(instanceIdx, dummy.matrix);
         
         // Dynamic color based on primitive props or default
         const color = new THREE.Color(p.props.color || '#0ea5e9');
         meshRef.current.setColorAt(instanceIdx, color);

         instanceIdx++;
      }
    }

    // Hide remaining unused instances
    dummy.scale.setScalar(0);
    dummy.updateMatrix();
    for (let k = instanceIdx; k < maxParticles; k++) {
       meshRef.current.setMatrixAt(k, dummy.matrix);
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) {
        meshRef.current.instanceColor.needsUpdate = true;
    }
  });

  if (particlePrimitives.length === 0) return null;

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, maxParticles]}>
      <sphereGeometry args={[1, 16, 16]} />
      <meshStandardMaterial 
        emissive="#ffffff" 
        emissiveIntensity={1} 
        toneMapped={false} 
        transparent
        opacity={0.8}
      />
    </instancedMesh>
  );
};

export default ParticleSystem;
