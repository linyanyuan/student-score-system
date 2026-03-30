from __future__ import annotations

from dataclasses import dataclass

from app.services.scheduling.compiler import CompiledLesson, CompiledSlot


@dataclass(frozen=True)
class SolverWeights:
    preferred_session_penalty: int = 3
    pe_morning_penalty: int = 5


def lesson_slot_penalty(lesson: CompiledLesson, slot: CompiledSlot, weights: SolverWeights) -> int:
    penalty = 0
    if lesson.preferred_session == "morning_prefer" and slot.session == "afternoon":
        penalty += weights.preferred_session_penalty
    elif lesson.preferred_session == "afternoon_prefer" and slot.session == "morning":
        penalty += weights.preferred_session_penalty

    if "体育" in lesson.subject_name and slot.session == "morning" and slot.period_order <= 3:
        penalty += weights.pe_morning_penalty
    return penalty
