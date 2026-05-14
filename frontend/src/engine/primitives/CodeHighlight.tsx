import React, { useEffect } from 'react';
import { useLessonHighlight } from '../../store/lessonHighlight';
import { CodeRef } from '../../types';

interface CodeHighlightProps {
  walkthrough_index: number;
  line_start: number;
  line_end: number;
  progress: number; // 0 to 1
}

export const CodeHighlight: React.FC<CodeHighlightProps> = ({
  walkthrough_index,
  line_start,
  line_end,
  progress
}) => {
  const setHoveredCode = useLessonHighlight(state => state.setHoveredCode);

  useEffect(() => {
    // Only highlight if we are actually active (this is managed by ScenePlayer anyway)
    const codeRef: CodeRef = {
      walkthrough_index,
      line_start,
      line_end
    };
    
    setHoveredCode(codeRef);

    return () => {
      setHoveredCode(null);
    };
  }, [walkthrough_index, line_start, line_end, setHoveredCode]);

  // This primitive doesn't render anything itself
  return null;
};

export default CodeHighlight;
