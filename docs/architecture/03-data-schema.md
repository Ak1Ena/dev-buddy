# Data Schema & API Design

## 1. API Design
RESTful API for resource management with WebSocket support for real-time scene streaming (for long-running analysis).

### Endpoints:
- `POST /api/analyze`: Accepts code, returns a `SessionID`.
- `GET /api/scene/{session_id}`: Returns the complete `Scene JSON`.
- `POST /api/assessment/submit`: Processes user answers for Discovery Gates.
- `GET /api/user/path`: Returns the generated Learning Path.

## 2. Database Schema
Using PostgreSQL for relational data and Redis for session/scene caching.

### Tables:
- **`users`**: `id, email, baseline_score, current_level`.
- **`learning_paths`**: `id, user_id, goals: JSON, completed_nodes: string[]`.
- **`scenes`**: `id, hash (code_hash + concept), content: JSONB`.
- **`analytics`**: `id, user_id, scene_id, completion_rate, gate_failure_rate`.

## 3. TypeScript Types
```typescript
type ScenePrimitive = {
  id: string;
  type: 'box' | 'arrow' | 'label' | 'particle' | 'pulse' | 'gate' | 'code_highlight' | 'vibrate' | 'stack' | 'heap' | 'audio' | 'move' | 'scale' | 'fade' | 'color';
  start: number;       // Seconds
  duration: number;    // Seconds
  props: Record<string, any>;
};

interface SceneJSON {
  version: string;
  metadata: {
    title: string;
    description: string;
    totalDuration: number;
  };
  timeline: ScenePrimitive[];
}
```

## 4. Python Models (Pydantic)
```python
from pydantic import BaseModel
from typing import List, Dict, Any, Union, Literal

class Primitive(BaseModel):
    id: str
    type: Literal['box', 'arrow', 'label', 'particle', 'pulse', 'gate', 'code_highlight', 'vibrate', 'stack', 'heap', 'audio', 'move', 'scale', 'fade', 'color']
    start: float
    duration: float
    props: Dict[str, Any]

class Scene(BaseModel):
    version: str = "1.0"
    metadata: Dict[str, Any]
    timeline: List[Primitive]
```

## 5. Example API Responses
**Response for `GET /api/scene/{id}`:**
```json
{
  "version": "1.0",
  "metadata": {
    "title": "Variable Swap",
    "totalDuration": 4.5
  },
  "timeline": [
    {
      "id": "box-a",
      "type": "box",
      "start": 0.0,
      "duration": 4.5,
      "props": { "label": "a", "value": "10", "pos": [100, 100] }
    },
    {
      "id": "box-b",
      "type": "box",
      "start": 0.0,
      "duration": 4.5,
      "props": { "label": "b", "value": "20", "pos": [300, 100] }
    },
    {
      "id": "move-particle",
      "type": "particle",
      "start": 1.0,
      "duration": 0.8,
      "props": { "from": "box-a", "to": "box-b", "color": "sky" }
    },
    {
      "id": "highlight-swap",
      "type": "code_highlight",
      "start": 1.0,
      "duration": 0.8,
      "props": { "lines": [3, 4] }
    },
    {
        "id": "gate-prediction",
        "type": "gate",
        "start": 1.8,
        "duration": 0.0,
        "props": {
            "question": "What will be the value of 'b' now?",
            "options": ["10", "20", "Error"]
        }
    }
  ]
}
```
