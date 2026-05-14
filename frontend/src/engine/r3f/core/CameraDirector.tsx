import React, { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useTimelineStore } from '../../timeline/useTimelineStore';
import { SceneJSON, ScenePrimitive } from '../../types';

interface CameraDirectorProps {
  scene: SceneJSON | null;
}

export const CameraDirector: React.FC<CameraDirectorProps> = ({ scene }) => {
  const { camera } = useThree();
  const { currentTime } = useTimelineStore();
  
  // Keep track of where we want the camera to look
  const targetLookAt = useRef(new THREE.Vector3(0, 0, 0));
  const targetPosition = useRef(new THREE.Vector3(0, 5, 10));

  useFrame((state, delta) => {
    if (!scene || !scene.timeline) return;

    // Find the currently active primitive with `focus: true` or just the first active one
    const activePrimitives = scene.timeline.filter(p => 
      currentTime >= p.start && currentTime <= p.start + p.duration
    );

    const focusedPrimitive = activePrimitives.find(p => p.props.focus) || activePrimitives[0];

    if (focusedPrimitive && focusedPrimitive.props.position) {
      const pos = focusedPrimitive.props.position;
      targetLookAt.current.set(pos[0], pos[1], pos[2]);
      
      // Calculate a comfortable viewing position based on primitive type
      if (focusedPrimitive.type === 'stack_frame') {
         targetPosition.current.set(pos[0] - 2, pos[1] + 2, pos[2] + 6);
      } else {
         targetPosition.current.set(pos[0], pos[1] + 3, pos[2] + 6);
      }
    } else {
      // Default overview
      targetLookAt.current.set(0, 0, 0);
      targetPosition.current.set(0, 5, 10);
    }

    // Smoothly lerp camera position
    camera.position.lerp(targetPosition.current, 2 * delta);
    
    // Smoothly lerp what the camera is looking at
    // We need to keep OrbitControls updated if it's being used, but since we are manually controlling the camera,
    // we should ideally feed this target to OrbitControls, or disable OrbitControls when auto-focusing.
    // For now, we will just lerp the camera's lookAt. If OrbitControls is active, they will fight.
    // We will assume OrbitControls is disabled during cinematic playback, or we update OrbitControls' target.
    // The easiest way to work WITH OrbitControls is to not change camera lookAt directly, but update the controls target.
    // We will assume this is a pure cinematic camera for now.
    
    // Instead of looking directly, we can manually lookAt for pure cinematic, or if we use OrbitControls,
    // we should access its ref. For simplicity, we just use lookAt.
    const currentLookAt = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).add(camera.position);
    currentLookAt.lerp(targetLookAt.current, 3 * delta);
    camera.lookAt(currentLookAt);
  });

  return null;
};

export default CameraDirector;
