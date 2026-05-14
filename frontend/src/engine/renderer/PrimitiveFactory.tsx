import React from 'react';
import { ScenePrimitive } from '../types';
import Box from '../primitives/Box';
import Particle from '../primitives/Particle';
import Pulse from '../primitives/Pulse';
import Gate from '../primitives/Gate';
import CodeHighlight from '../primitives/CodeHighlight';

interface PrimitiveFactoryProps {
  primitive: ScenePrimitive;
  progress: number;
}

export const PrimitiveFactory: React.FC<PrimitiveFactoryProps> = ({ primitive, progress }) => {
  const { type, props, id } = primitive;

  switch (type) {
    case 'box':
      return <Box key={id} {...(props as any)} progress={progress} />;
    case 'particle':
      return <Particle key={id} {...(props as any)} progress={progress} />;
    case 'pulse':
      return <Pulse key={id} {...(props as any)} progress={progress} />;
    case 'gate':
      return <Gate key={id} {...(props as any)} progress={progress} />;
    case 'code_highlight':
      return <CodeHighlight key={id} {...(props as any)} progress={progress} />;
    default:
      console.warn(`Unknown primitive type: ${type}`);
      return null;
  }
};

export default PrimitiveFactory;
