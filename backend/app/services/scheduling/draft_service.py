from __future__ import annotations

import json
from typing import Any

from sqlalchemy.orm import Session

from app.models.schedule_draft import ScheduleDraft
from app.models.schedule_draft_item import ScheduleDraftItem
from app.services.scheduling.compiler import CompiledProblem
from app.services.scheduling.cp_sat_solver import SolverResult
from app.services.scheduling.validators import build_publish_checks


def _locked_hit_count(problem: CompiledProblem, result: SolverResult) -> int:
    locked_keys = {(int(item["class_id"]), int(item["subject_id"]), int(item["teacher_id"]), int(item["weekday"]), int(item["period_id"])) for item in problem.locked_assignments}
    hits = 0
    for lesson in problem.lessons:
        assignment = result.assignment_map.get(lesson.lesson_id)
        if not assignment:
            continue
        key = (lesson.class_id, lesson.subject_id, lesson.teacher_id, assignment[0], assignment[1])
        if key in locked_keys:
            hits += 1
    return hits


def create_draft_from_solution(
    db: Session,
    *,
    school_id: int,
    grade: str,
    created_by: int | None,
    problem: CompiledProblem,
    result: SolverResult,
) -> ScheduleDraft:
    locked_hits = _locked_hit_count(problem, result)
    summary = {
        "hard_pass_rate": 100,
        "score": result.score,
        "locked_hits": locked_hits,
        "locked_total": len(problem.locked_assignments),
        "risk_count": len(result.diagnostics),
    }
    draft = ScheduleDraft(
        school_id=school_id,
        grade=grade,
        status="draft",
        score=result.score,
        summary=json.dumps(summary, ensure_ascii=False),
        diagnostics=json.dumps(result.diagnostics, ensure_ascii=False),
        created_by=created_by,
    )
    db.add(draft)
    db.flush()

    lesson_map = {lesson.lesson_id: lesson for lesson in problem.lessons}
    locked_keys = {(int(item["class_id"]), int(item["subject_id"]), int(item["teacher_id"]), int(item["weekday"]), int(item["period_id"])) for item in problem.locked_assignments}
    for lesson_id, (weekday, period_id) in result.assignment_map.items():
        lesson = lesson_map[lesson_id]
        is_locked = (lesson.class_id, lesson.subject_id, lesson.teacher_id, weekday, period_id) in locked_keys
        db.add(
            ScheduleDraftItem(
                draft_id=draft.id,
                class_id=lesson.class_id,
                teacher_id=lesson.teacher_id,
                subject_id=lesson.subject_id,
                weekday=weekday,
                period_id=period_id,
                is_locked=is_locked,
                penalty_tags=json.dumps([], ensure_ascii=False),
            )
        )
    db.commit()
    db.refresh(draft)
    return draft


def serialize_draft(draft: ScheduleDraft) -> dict[str, Any]:
    summary = json.loads(draft.summary) if draft.summary else {}
    diagnostics = json.loads(draft.diagnostics) if draft.diagnostics else []
    return {
        "id": draft.id,
        "grade": draft.grade,
        "status": draft.status,
        "score": draft.score,
        "summary": summary,
        "diagnostics": diagnostics,
        "publish_checks": build_publish_checks(diagnostics, draft.score),
        "published_at": draft.published_at.isoformat() if draft.published_at else None,
        "created_at": draft.created_at.isoformat() if draft.created_at else None,
        "updated_at": draft.updated_at.isoformat() if draft.updated_at else None,
    }


def serialize_draft_items(rows: list[ScheduleDraftItem]) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    for row in rows:
        items.append(
            {
                "weekday": row.weekday,
                "period_id": row.period_id,
                "class_id": row.class_id,
                "subject_id": row.subject_id,
                "teacher_id": row.teacher_id,
                "is_locked": row.is_locked,
                "penalty_tags": json.loads(row.penalty_tags) if row.penalty_tags else [],
            }
        )
    return items
