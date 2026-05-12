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
    default: {
      // Fallback: try to render as graph if nodes are present, otherwise tree
      const v = viz as any;
      if (v.nodes && v.edges) return <ConceptGraph nodes={v.nodes} edges={v.edges} />;
      if (v.nodes && v.root_id) return <ConceptTree rootId={v.root_id} nodes={v.nodes} />;
      if (v.steps) return <StepFlow steps={v.steps} onStepActivate={onStepActivate} />;
      return (
        <div className="flex items-center justify-center h-full min-h-[120px] p-6">
          <p className="text-xs text-slate-600 font-mono">No visualization for this lesson.</p>
        </div>
      );
    }
  }
}
