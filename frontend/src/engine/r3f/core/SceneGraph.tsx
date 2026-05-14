import React from 'react';
import { SceneJSON, ScenePrimitive } from '../../types';
import RuntimeVariable from '../primitives/RuntimeVariable';
import FunctionTunnel from '../primitives/FunctionTunnel';

interface SceneGraphProps {
  scene: SceneJSON | null;
}

export const SceneGraph: React.FC<SceneGraphProps> = ({ scene }) => {
  if (!scene || !scene.timeline) return null;

  return (
    <>
      {scene.timeline.map((primitive: ScenePrimitive) => {
        const { type, id, start, duration, props } = primitive;
        
        switch (type as string) {
          case 'runtime_variable':
          case 'variable':
          case 'box': // Map legacy 'box' to variable for now to test
            return (
              <RuntimeVariable 
                key={id}
                id={id}
                start={start}
                duration={duration}
                position={props.position || [(Math.random() - 0.5) * 4, 1, (Math.random() - 0.5) * 4]}
                label={props.label || 'var'}
                value={props.value}
                color={props.color}
              />
            );
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
          // Add more mappings here
          default:
            // Ignore unmapped 2D primitives for now
            return null;
        }
      })}
    </>
  );
};

export default SceneGraph;
