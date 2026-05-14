export type PrimitiveType = 
  | 'box' 
  | 'arrow' 
  | 'label' 
  | 'particle' 
  | 'pulse' 
  | 'gate' 
  | 'code_highlight' 
  | 'vibrate' 
  | 'stack' 
  | 'heap' 
  | 'audio' 
  | 'move' 
  | 'scale' 
  | 'fade' 
  | 'color'
  | 'runtime_variable'
  | 'stack_frame';

export interface ScenePrimitive {
  id: string;
  type: PrimitiveType;
  start: number;
  duration: number;
  props: Record<string, any>;
}

export interface SceneJSON {
  version: string;
  metadata: {
    title: string;
    description: string;
    totalDuration: number;
  };
  timeline: ScenePrimitive[];
}
