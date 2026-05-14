import React from 'react';
import { Canvas } from '@react-three/fiber';
import { Grid, OrbitControls } from '@react-three/drei';
import { SceneJSON } from '../../types';
import SceneGraph from './SceneGraph';
import CameraDirector from './CameraDirector';
import ParticleSystem from '../systems/ParticleSystem';
import RelationSystem from '../systems/RelationSystem';

interface RuntimeManagerProps {
  scene?: SceneJSON;
}

export const RuntimeManager: React.FC<RuntimeManagerProps> = ({ scene }) => {
  return (
    <div className="w-full h-full bg-slate-950 absolute inset-0">
      <Canvas camera={{ position: [0, 8, 15], fov: 35 }}>
        <color attach="background" args={['#020617']} />
        
        <ambientLight intensity={0.6} />
        <pointLight position={[10, 10, 10]} intensity={1.5} />
        <spotLight position={[-10, 10, 10]} angle={0.15} penumbra={1} intensity={1} castShadow />
        
        <Grid 
          infiniteGrid 
          fadeDistance={60} 
          sectionColor="#334155" 
          cellColor="#1e293b" 
          position={[0, -1, 0]} 
        />
        
        <SceneGraph scene={scene || null} />
        <RelationSystem scene={scene || null} />
        <ParticleSystem scene={scene || null} />
        <CameraDirector scene={scene || null} />
        
        <OrbitControls 
          enableDamping 
          dampingFactor={0.05}
          rotateSpeed={0.5}
          maxPolarAngle={Math.PI / 2.1} 
          minDistance={5}
          maxDistance={40}
        />
      </Canvas>
    </div>
  );
};

export default RuntimeManager;
