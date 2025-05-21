import argparse
import json
import sys
from pathlib import Path
from typing import List, Dict, Any

sys.path.append(str(Path(__file__).resolve().parents[1]))

from src.parse.math_models import Statements, Proofs
from src.utils import load_json


def _pydantic_parse(model, data):
    if hasattr(model, "model_validate"):
        return model.model_validate(data)
    return model.parse_obj(data)


def _internal_ids(refs: List[str]) -> List[str]:
    ids = []
    if refs:
        for r in refs:
            if r.startswith("IN|"):
                parts = r.split("|")
                if len(parts) > 1:
                    ids.append(parts[1])
    return ids


def _add_generated_proofs(nodes: Dict[str, Dict[str, Any]], proof_dir: Path) -> None:
    """Append generated proofs from a single directory to the nodes map."""

    gen_report = proof_dir / "proof_generation_report.json"
    if not gen_report.exists():
        return

    grade_report = None
    grade_dir = None
    for d in proof_dir.iterdir():
        if d.is_dir() and d.name.startswith("grades_"):
            candidate = d / "proof_grading_report.json"
            if candidate.exists():
                grade_report = candidate
                grade_dir = d
                break

    gen_data = load_json(gen_report) or {}
    grade_data = load_json(grade_report) if grade_report else {}
    evaluations = grade_data.get("evaluations", {}) if grade_data else {}

    for stmt_id, info in gen_data.get("statements_proof_generation_status", {}).items():
        if not info or not info.get("success"):
            continue
        proof_file = proof_dir / info["proof_file"]
        try:
            text = proof_file.read_text(encoding="utf-8")
        except Exception:
            text = ""

        origin = proof_dir.name.split("_", 1)[1] if "_" in proof_dir.name else proof_dir.name
        grade = evaluations.get(stmt_id)
        grade_text = ""
        if grade and grade.get("success"):
            origin += f" (score {grade['score']}/15)"
            if grade_dir is not None:
                eval_file = grade.get("evaluation_file")
                if eval_file:
                    try:
                        grade_text = (grade_dir / eval_file).read_text(encoding="utf-8")
                    except Exception:
                        grade_text = ""

        node = nodes.get(stmt_id)
        if node is not None:
            node.setdefault("proofs", []).append({"origin": origin, "text": text, "grade": grade_text})


def build_nodes(statements: Statements, proofs: Proofs,
                project_proofs_dir: Path) -> List[Dict[str, Any]]:
    """Build nodes for the visualisation, aggregating all proof directories."""

    nodes: Dict[str, Dict[str, Any]] = {}

    for stmt in statements.statements:
        node = {
            "id": stmt.local_id,
            "name": stmt.name or "",
            "type": stmt.type,
            "local_id": stmt.local_id_in_document or "",
            "description": stmt.description,
            "context": stmt.context or [],
            "proofs": []
        }

        pr = proofs.get_proof_by_statement_id(stmt.local_id)
        if pr:
            node["proofs"].append({"origin": "paper", "text": pr.content})

        nodes[stmt.local_id] = node

    if project_proofs_dir.exists():
        for d in sorted([p for p in project_proofs_dir.iterdir() if p.is_dir()], key=lambda p: p.name):
            _add_generated_proofs(nodes, d)

    return list(nodes.values())


def build_links(statements: Statements, proofs: Proofs) -> List[Dict[str, str]]:
    links = []
    for stmt in statements.statements:
        for target in _internal_ids(stmt.explicit_references):
            links.append({"source": stmt.local_id, "target": target, "type": "explicit"})
        for target in _internal_ids(stmt.implicit_references):
            links.append({"source": stmt.local_id, "target": target, "type": "implicit"})
    for proof in proofs.proofs:
        for target in _internal_ids(proof.explicit_references):
            links.append({"source": proof.corresponding_statement_id, "target": target, "type": "proof_explicit"})
        for target in _internal_ids(proof.implicit_references):
            links.append({"source": proof.corresponding_statement_id, "target": target, "type": "proof_implicit"})
    # remove duplicates
    unique = {(l["source"], l["target"], l["type"]): l for l in links}
    return list(unique.values())


def main():
    p = argparse.ArgumentParser(description="Create JSON for the UI")
    p.add_argument("--project_path", type=Path, help="Path to the project directory")
    p.add_argument("--project_proofs_dir", type=Path,
                   help="Directory containing generated proof folders")
    p.add_argument("--output", type=Path, help="Output JSON file")
    args = p.parse_args()
    
    statements = _pydantic_parse(Statements, load_json(args.project_path / "parsed" / "statements.json"))
    proofs = _pydantic_parse(Proofs, load_json(args.project_path / "parsed" / "proofs.json"))

    nodes = build_nodes(statements, proofs, args.project_proofs_dir)
    links = build_links(statements, proofs)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump({"nodes": nodes, "links": links}, f, indent=2)


if __name__ == "__main__":
    main()
