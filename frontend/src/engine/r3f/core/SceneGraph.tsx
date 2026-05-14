import React from 'react';
import { SceneJSON, ScenePrimitive } from '../../types';
import RuntimeVariable from '../primitives/RuntimeVariable';
import FunctionTunnel from '../primitives/FunctionTunnel';

interface SceneGraphProps {
  scene: SceneJSON | null;
}

export const SceneGraph: React.FC<SceneGraphProps> = ({ scene }) => {
  if (!scene || !scene.timeline) return null;

  // First pass: Index objects by ID
  const objectsById = new Map<string, ScenePrimitive>();
  scene.timeline.forEach(p => objectsById.set(p.id, p));

  // Second pass: Group children by parent
  const childrenByParent = new Map<string, ScenePrimitive[]>();
  scene.timeline.forEach(p => {
    if (p.props.parent) {
      const kids = childrenByParent.get(p.props.parent) || [];
      kids.push(p);
      childrenByParent.set(p.props.parent, kids);
    }
  });

  return (
    <>
      {scene.timeline.map((primitive: ScenePrimitive) => {
        const { type, id, start, duration, props } = primitive;
        
        // Skip children here as they will be rendered relative to parents (optional, depends on if we want nesting)
        // For 3D, we can just render them flat but calculate their world positions.
        
        switch (type as string) {
          case 'runtime_variable':
          case 'variable':
          case 'box': {
            let finalPos = props.position || [0, 1, 0];
            
            // If it has a parent that is a function tunnel
            if (props.parent && objectsById.has(props.parent)) {
               const parent = objectsById.get(props.parent)!;
               const parentPos = parent.props.position || [0, 1.5, 0];
               
               // Find index among siblings for layout
               const siblings = childrenByParent.get(props.parent) || [];
               const index = siblings.findIndex(s => s.id === id);
               
               // Position variables inside the tunnel
               finalPos = [
                 parentPos[0] + (index % 2 === 0 ? -1 : 1),
                 parentPos[1] + Math.floor(index / 2) * -1.2,
                 parentPos[2]
               ];
            }

            return (
              <RuntimeVariable 
                key={id}
                id={id}
                start={start}
                duration={duration}
                position={finalPos}
                label={props.label || 'var'}
                value={props.value}
                color={props.color}
                scale={props.scale}
              />
            );
          }
          case 'stack_frame':
          case 'function':
            return (
              <FunctionTunnel
                key={id}
                id={id}
                start={start}
                duration={duration}
                position={props.position || [0, 1.5, 0]}
                name={props.label || props.name || 'func'}
              />
            );
          default:
            return null;
        }
      })}
    </>
  );
};

export default SceneGraph;
