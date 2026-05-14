import libcst as cst
from typing import List, Dict, Any, Optional
from libcst.metadata import PositionProvider

class CodeStructureVisitor(cst.CSTVisitor):
    METADATA_DEPENDENCIES = (PositionProvider,)

    def __init__(self):
        super().__init__()
        self.nodes = []

    def visit_SimpleStatementLine(self, node: cst.SimpleStatementLine) -> Optional[bool]:
        pos = self.get_metadata(PositionProvider, node)
        self.nodes.append({
            "type": "statement",
            "content": node.code if hasattr(node, 'code') else "", # CST nodes don't always have .code
            "start_line": pos.start.line,
            "end_line": pos.end.line,
        })
        return True

    def visit_FunctionDef(self, node: cst.FunctionDef) -> Optional[bool]:
        pos = self.get_metadata(PositionProvider, node)
        self.nodes.append({
            "type": "function_def",
            "name": node.name.value,
            "start_line": pos.start.line,
            "end_line": pos.end.line,
        })
        return True

    def visit_If(self, node: cst.If) -> Optional[bool]:
        pos = self.get_metadata(PositionProvider, node)
        self.nodes.append({
            "type": "if_statement",
            "start_line": pos.start.line,
            "end_line": pos.end.line,
        })
        return True

    def visit_For(self, node: cst.For) -> Optional[bool]:
        pos = self.get_metadata(PositionProvider, node)
        self.nodes.append({
            "type": "for_loop",
            "start_line": pos.start.line,
            "end_line": pos.end.line,
        })
        return True

    def visit_While(self, node: cst.While) -> Optional[bool]:
        pos = self.get_metadata(PositionProvider, node)
        self.nodes.append({
            "type": "while_loop",
            "start_line": pos.start.line,
            "end_line": pos.end.line,
        })
        return True

    def visit_Assign(self, node: cst.Assign) -> Optional[bool]:
        pos = self.get_metadata(PositionProvider, node)
        targets = []
        for t in node.targets:
            if isinstance(t.target, cst.Name):
                targets.append(t.target.value)
        
        self.nodes.append({
            "type": "assignment",
            "targets": targets,
            "start_line": pos.start.line,
            "end_line": pos.end.line,
        })
        return True

class ASTAnalyzer:
    def analyze(self, code: str) -> Dict[str, Any]:
        try:
            wrapper = cst.metadata.MetadataWrapper(cst.parse_module(code))
            visitor = CodeStructureVisitor()
            wrapper.visit(visitor)
            return {
                "nodes": visitor.nodes,
                "language": "python"
            }
        except Exception as e:
            return {
                "error": str(e),
                "nodes": []
            }
