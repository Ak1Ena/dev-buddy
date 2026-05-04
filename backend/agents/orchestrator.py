from typing import Annotated, List, TypedDict
from langgraph.graph import StateGraph, END
from .planner import PlannerAgent
from .analysis import AnalysisAgent
from .design import DesignAgent
from .checker import CheckerAgent

# Define the global state
class AgentState(TypedDict):
    user_id: str
    subject: str
    user_level: str
    plan: List[str]
    current_topic_index: int
    content: dict
    verification_status: str # "approved" or "rejected"
    iterations: int
    curiosity_trigger: bool

# Initialize Agents
planner = PlannerAgent()
analysis = AnalysisAgent()
design = DesignAgent()
checker = CheckerAgent()

# --- Node Implementations ---

def planner_node(state: AgentState):
    print("Planner Agent is working...")
    plan = planner.generate_plan(state['subject'], state['user_level'])
    return {
        "plan": plan, 
        "iterations": state.get('iterations', 0) + 1,
        "current_topic_index": 0
    }

def analysis_node(state: AgentState):
    print("Analysis Agent is validating...")
    is_approved, reason = analysis.validate_plan(state['subject'], state['user_level'], state['plan'])
    return {"verification_status": "approved" if is_approved else "rejected"}

def design_node(state: AgentState):
    print("Design Agent is crafting content...")
    topic = state['plan'][state['current_topic_index']]
    content = design.generate_content(topic, state['user_level'])
    return {"content": content}

def checker_node(state: AgentState):
    print("Checker Agent is fact-checking...")
    is_approved, reason = checker.verify_content(state['content'])
    return {"verification_status": "approved" if is_approved else "rejected"}

# --- Conditional Logic ---
def should_move_to_design(state: AgentState):
    if state["verification_status"] == "approved":
        return "design"
    return "planner"

def should_finish_generation(state: AgentState):
    if state["verification_status"] == "approved":
        return "end"
    return "design"

def create_orchestrator_graph():
    workflow = StateGraph(AgentState)

    workflow.add_node("planner", planner_node)
    workflow.add_node("analysis", analysis_node)
    workflow.add_node("design", design_node)
    workflow.add_node("checker", checker_node)

    workflow.set_entry_point("planner")
    workflow.add_edge("planner", "analysis")
    
    workflow.add_conditional_edges(
        "analysis",
        should_move_to_design,
        {"design": "design", "planner": "planner"}
    )
    
    workflow.add_edge("design", "checker")
    
    workflow.add_conditional_edges(
        "checker",
        should_finish_generation,
        {"end": END, "design": "design"}
    )

    return workflow.compile()
