from __future__ import annotations

from typing import Any

from app.services.scheduling.compiler import CompiledProblem


def _diag(code: str, message: str, *, blocking: bool = True, entity: dict[str, Any] | None = None) -> dict[str, Any]:
    return {
        "code": code,
        "message": message,
        "blocking": blocking,
        "entity": entity or {},
    }


def validate_raw_config(raw_config: dict[str, Any]) -> list[dict[str, Any]]:
    diagnostics: list[dict[str, Any]] = []
    classes = raw_config.get("classes") or []
    slots = raw_config.get("slots") or []
    arrangements = raw_config.get("arrangements") or []
    lesson_plans = raw_config.get("lesson_plans") or []

    if not classes:
        diagnostics.append(_diag("no_classes", "当前年级没有班级数据"))
    if not slots:
        diagnostics.append(_diag("no_slots", "当前没有可参与自动排课的节次配置"))
    if not arrangements:
        diagnostics.append(_diag("no_arrangements", "当前年级没有授课安排"))

    base_plan_subject_ids = {int(item.get("subject_id") or 0) for item in lesson_plans if int(item.get("class_id") or 0) == 0}
    sorted_base_plan_subject_ids = sorted(subject_id for subject_id in base_plan_subject_ids if subject_id)
    for arrangement in arrangements:
        subject_id = int(arrangement.get("subject_id") or 0)
        if subject_id and subject_id not in base_plan_subject_ids:
            subject_name = str(arrangement.get("subject_name") or "").strip()
            subject_label = f"{subject_name} (ID {subject_id})" if subject_name else str(subject_id)
            diagnostics.append(
                _diag(
                    "missing_lesson_plan",
                    f"科目 {subject_label} 未配置年级基础课时规则，本次不会自动排课",
                    blocking=False,
                    entity={
                        "subject_id": subject_id,
                        "subject_name": subject_name,
                        "base_plan_subject_ids": sorted_base_plan_subject_ids,
                    },
                )
            )

    total_hours = 0
    for item in lesson_plans:
        if int(item.get("class_id") or 0) != 0:
            continue
        total_hours += int(item.get("weekly_hours") or 0)
    total_capacity = len(slots)
    if classes and total_capacity and total_hours * len(classes) > total_capacity * len(classes):
        diagnostics.append(_diag("grade_capacity_exceeded", "年级总课时超过可用排课容量"))
    return diagnostics


def validate_compiled_problem(problem: CompiledProblem) -> list[dict[str, Any]]:
    diagnostics: list[dict[str, Any]] = []
    for lesson in problem.lessons:
        if not lesson.candidate_slots:
            diagnostics.append(
                _diag(
                    "no_candidate_slots",
                    f"课时 {lesson.lesson_id} 没有可用时段",
                    entity={"lesson_id": lesson.lesson_id},
                )
            )
    return diagnostics


def build_publish_checks(diagnostics: list[dict[str, Any]], score: int | None) -> list[dict[str, Any]]:
    checks = list(diagnostics)
    if score is not None and score < 60:
        checks.append(_diag("low_score", "草案得分较低，建议人工复核后再发布", blocking=False))
    return checks
