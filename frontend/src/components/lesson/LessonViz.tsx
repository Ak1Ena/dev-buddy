import type { Viz } from "@/types";
import ConceptTree from "./viz/ConceptTree";
import ConceptGraph from "./viz/ConceptGraph";
import ComparisonTable from "./viz/ComparisonTable";
import StepFlow from "./viz/StepFlow";

interface Props {
  viz?: Viz;
  /** When the user activates a step in a flow viz, the parent can sync the walkthrough panel. */
  onStepActivate?: (walkthroughIndex: number | undefined) => void;
}

export default function LessonViz({ viz, onStepActivate }: Props) {
  if (!viz) return null;

  switch (viz.kind) {
    case "tree":
      return <ConceptTree rootId={viz.root_id} nodes={viz.nodes} />;
    case "graph":
      return <ConceptGraph nodes={viz.nodes} edges={viz.edges} />;
    case "table":
      return <ComparisonTable columns={viz.columns} rows={viz.rows} />;
    case "flow":
      return <StepFlow steps={viz.steps} onStepActivate={onStepActivate} />;
    default:
      return null;
  }
}
