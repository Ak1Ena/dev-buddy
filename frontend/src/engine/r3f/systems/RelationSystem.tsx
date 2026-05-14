import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useTimelineStore } from '../../timeline/useTimelineStore';
import { SceneJSON, ScenePrimitive } from '../../types';

interface RelationSystemProps {
  scene: SceneJSON | null;
}

export const RelationSystem: React.FC<RelationSystemProps> = ({ scene }) => {
  const { currentTime } = useTimelineStore();
  
  const activeRelations = useMemo(() => {
    if (!scene || !scene.timeline) return [];
    
    const objectsById = new Map<string, ScenePrimitive>();
    scene.timeline.forEach(p => objectsById.set(p.id, p));
    
    const relations: { from: THREE.Vector3; to: THREE.Vector3; color: string; id: string }[] = [];
    
    scene.timeline.forEach(p => {
        if (currentTime < p.start || currentTime > p.start + p.duration) return;
        
        // Relation 1: Parent-Child (e.g. Variable to StackFrame)
        if (p.props.parent && objectsById.has(p.props.parent)) {
            const parent = objectsById.get(p.props.parent)!;
            // Check if parent is also active
            if (currentTime >= parent.start && currentTime <= parent.start + parent.duration) {
                // If it's a child, SceneGraph offsets it.
                // We'll just use the props position for now as a baseline
                const from = new THREE.Vector3().fromArray(p.props.position || [0, 0, 0]);
                const to = new THREE.Vector3().fromArray(parent.props.position || [0, 0, 0]);
                
                relations.push({ from, to, color: '#3b82f6', id: `rel-${p.id}-${parent.id}` });
            }
        }
    });
    
    return relations;
  }, [scene, currentTime]);

  return (
    <group>
      {activeRelations.map((rel) => (
        <LineHelper 
          key={rel.id} 
          start={rel.from} 
          end={rel.to} 
          color={rel.color} 
        />
      ))}
    </group>
  );
};

const LineHelper = ({ start, end, color }: { start: THREE.Vector3; end: THREE.Vector3; color: string }) => {
    const ref = useRef<THREE.Line>(null!);
    
    const geometry = useMemo(() => {
        const g = new THREE.BufferGeometry().setFromPoints([start, end]);
        return g;
    }, [start, end]);

    return (
        <primitive object={new THREE.Line(geometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.4 }))} />
    );
};

export default RelationSystem;
