import React from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import { SceneJSON } from '../../types';
import SceneGraph from './SceneGraph';

interface RuntimeManagerProps {
  scene?: SceneJSON;
}

export const RuntimeManager: React.FC<RuntimeManagerProps> = ({ scene }) => {
  return (
    <div className="w-full h-full bg-slate-950 absolute inset-0">
      <Canvas camera={{ position: [0, 5, 10], fov: 45 }}>
        <color attach="background" args={['#020617']} /> {/* slate-950 equivalent */}
        
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 10]} intensity={1} />
        
        {/* Infinite Grid to act as the "Memory Floor" */}
        <Grid 
          infiniteGrid 
          fadeDistance={50} 
          sectionColor="#334155" 
          cellColor="#1e293b" 
          position={[0, -1, 0]} 
        />
        
        <SceneGraph scene={scene || null} />
        
        <OrbitControls makeDefault />
      </Canvas>
    </div>
  );
};

export default RuntimeManager;
