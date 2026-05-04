from typing import TypedDict, List, Dict, Annotated
from langgraph.graph import StateGraph, END
import operator

class AgentState(TypedDict):
    user_profile: Dict
    curriculum: Dict
    current_lesson: Dict
    analysis_feedback: List[str]
    fact_check_results: Dict
    messages: List[str]

def planner_node(state: AgentState):
    # logic to call Planner Agent
    return {"messages": ["Planner: Generated curriculum."]}

def analysis_node(state: AgentState):
    # logic to call Analysis Agent
    return {"messages": ["Analysis: Validated curriculum."]}

def design_node(state: AgentState):
    # logic to call Design Agent
    return {"messages": ["Design: Generated lesson content."]}

def checker_node(state: AgentState):
    # logic to call Checker Agent
    return {"messages": ["Checker: Fact-checked content."]}

def create_orchestration_graph():
    workflow = StateGraph(AgentState)

    workflow.add_node("planner", planner_node)
    workflow.add_node("analysis", analysis_node)
    workflow.add_node("design", design_node)
    workflow.add_node("checker", checker_node)

    workflow.set_entry_point("planner")
    workflow.add_edge("planner", "analysis")
    workflow.add_edge("analysis", "design")
    workflow.add_edge("design", "checker")
    workflow.add_edge("checker", END)

    return workflow.compile()

orchestrator_graph = create_orchestration_graph()
