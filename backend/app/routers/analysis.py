import statistics
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.dependencies import (
    get_db,
    get_current_user,
    get_accessible_class_ids,
    get_user_school_id,
    require_admin_or_school_admin,
    require_teacher_or_admin,
)
from app.models.school import School
from app.models.score import Score
from app.models.student import Student
from app.models.class_ import Class
from app.models.exam import Exam
from app.models.subject import Subject
from app.models.total_rank import TotalRank
from app.models.score_full_score_config import ScoreFullScoreConfig
from app.models.user import User
from app.services.exam_grade_subjects import load_exam_subjects_for_grade

router = APIRouter(prefix="/api/analysis", tags=["成绩分析"])


DEFAULT_SUBJECT_FULL_SCORES = {
    "chinese_full_score": 120.0,
    "math_full_score": 120.0,
    "english_full_score": 120.0,
    "other_full_score": 60.0,
}


class FullScoreConfigPayload(BaseModel):
    chinese_full_score: float = Field(default=120.0, gt=0)
    math_full_score: float = Field(default=120.0, gt=0)
    english_full_score: float = Field(default=120.0, gt=0)
    other_full_score: float = Field(default=60.0, gt=0)


def _parse_exam_grades(exam_grade_value: str | None) -> set[str]:
    if not exam_grade_value:
        return set()
    normalized = str(exam_grade_value).replace("，", ",").replace("、", ",")
    return {part.strip() for part in normalized.split(",") if part and part.strip()}


def _exam_includes_grade(exam_grade_value: str | None, grade: str | None) -> bool:
    if not grade:
        return True
    exam_grades = _parse_exam_grades(exam_grade_value)
    if not exam_grades:
        return str(exam_grade_value or "").strip() == grade
    return grade in exam_grades


def _teacher_exam_grade_class_ids(current_user: User, db: Session, exam_id: int) -> list[int]:
    if current_user.role != "teacher" or current_user.school_id is None:
        return []
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        return []
    exam_grades = _parse_exam_grades(exam.grade)
    if not exam_grades:
        return []
    return [
        row[0]
        for row in db.query(Class.id)
        .filter(Class.school_id == current_user.school_id, Class.grade.in_(exam_grades))
        .all()
    ]


def _check_student_permission(student: Student, current_user: User, db: Session):
    if current_user.role == "student":
        # Prefer explicit binding by student_id; fallback to legacy username matching.
        if current_user.student_id is not None:
            if student.id != current_user.student_id:
                raise HTTPException(status_code=403, detail="无权访问该学生数据")
            return
        if student.student_no != current_user.username:
            raise HTTPException(status_code=403, detail="无权访问该学生数据")
    elif current_user.role == "teacher":
        accessible = get_accessible_class_ids(current_user, db)
        if accessible is not None and student.class_id not in accessible:
            raise HTTPException(status_code=403, detail="无权访问该学生数据")


def _check_class_permission(class_id: int, exam_id: int, current_user: User, db: Session):
    if current_user.role == "student":
        if current_user.student_id is None:
            raise HTTPException(status_code=400, detail="student account is not bound to a student profile")
        bound_student = db.query(Student).filter(Student.id == current_user.student_id).first()
        if bound_student is None:
            raise HTTPException(status_code=400, detail="bound student profile does not exist")
        if bound_student.class_id != class_id:
            raise HTTPException(status_code=403, detail="无权访问该班级")
        return
    if current_user.role == "student":
        if current_user.student_id is None:
            raise HTTPException(status_code=400, detail="student account is not bound to a student profile")
        bound_student = db.query(Student).filter(Student.id == current_user.student_id).first()
        if bound_student is None:
            raise HTTPException(status_code=400, detail="bound student profile does not exist")
        accessible = [bound_student.class_id]
    elif current_user.role == "teacher":
        accessible = _teacher_exam_grade_class_ids(current_user, db, exam_id)
    else:
        accessible = get_accessible_class_ids(current_user, db)
    if accessible is not None and class_id not in accessible:
        raise HTTPException(status_code=403, detail="无权访问该班级")


def _calc_rates(scores: list[float], max_score: float | None = None) -> dict:
    """Calculate distribution rates and counts. If max_score is provided, use percentage thresholds."""
    if not scores:
        return {
            "excellent_rate": 0.0, "good_rate": 0.0, "pass_rate": 0.0, "low_rate": 0.0, "fail_rate": 0.0,
            "excellent_count": 0, "good_count": 0, "pass_count": 0, "low_count": 0, "fail_count": 0, "total_count": 0,
        }
    n = len(scores)
    if max_score and max_score > 0:
        excellent = sum(1 for s in scores if s / max_score >= 0.8)
        good = sum(1 for s in scores if s / max_score >= 0.7)
        pass_ = sum(1 for s in scores if s / max_score >= 0.6)
        low = sum(1 for s in scores if s / max_score <= 0.3)
        fail = sum(1 for s in scores if s / max_score < 0.6)
    else:
        excellent = sum(1 for s in scores if s >= 80)
        good = sum(1 for s in scores if s >= 70)
        pass_ = sum(1 for s in scores if s >= 60)
        low = sum(1 for s in scores if s <= 30)
        fail = sum(1 for s in scores if s < 60)
    return {
        "excellent_rate": round(excellent / n, 4),
        "good_rate": round(good / n, 4),
        "pass_rate": round(pass_ / n, 4),
        "low_rate": round(low / n, 4),
        "fail_rate": round(fail / n, 4),
        "excellent_count": excellent,
        "good_count": good,
        "pass_count": pass_,
        "low_count": low,
        "fail_count": fail,
        "total_count": n,
    }


def _resolve_full_score_config_school_id(current_user: User, school_id: int | None) -> int:
    if current_user.role == "admin":
        if school_id is None:
            raise HTTPException(status_code=400, detail="管理员请传 school_id")
        return school_id
    if current_user.school_id is None:
        raise HTTPException(status_code=400, detail="当前账号未绑定学校")
    if school_id is not None and school_id != current_user.school_id:
        raise HTTPException(status_code=403, detail="无权访问该学校配置")
    return current_user.school_id


def _load_subject_full_score_config(db: Session, school_id: int | None) -> dict[str, float]:
    config = dict(DEFAULT_SUBJECT_FULL_SCORES)
    if school_id is None:
        return config
    row = db.query(ScoreFullScoreConfig).filter(ScoreFullScoreConfig.school_id == school_id).first()
    if not row:
        return config
    config.update({
        "chinese_full_score": float(row.chinese_full_score),
        "math_full_score": float(row.math_full_score),
        "english_full_score": float(row.english_full_score),
        "other_full_score": float(row.other_full_score),
    })
    return config


def _subject_full_score_for_three_rates(
    subject_name: str | None,
    full_score_config: dict[str, float] | None = None,
) -> float:
    config = full_score_config or DEFAULT_SUBJECT_FULL_SCORES
    normalized_name = (subject_name or "").strip()
    if normalized_name in {"语文", "语"}:
        return float(config.get("chinese_full_score", DEFAULT_SUBJECT_FULL_SCORES["chinese_full_score"]))
    if normalized_name in {"数学", "数"}:
        return float(config.get("math_full_score", DEFAULT_SUBJECT_FULL_SCORES["math_full_score"]))
    if normalized_name in {"英语", "英"}:
        return float(config.get("english_full_score", DEFAULT_SUBJECT_FULL_SCORES["english_full_score"]))
    return float(config.get("other_full_score", DEFAULT_SUBJECT_FULL_SCORES["other_full_score"]))


def _total_full_score_for_three_rates(
    subjects: list[Subject],
    full_score_config: dict[str, float] | None = None,
) -> float:
    return round(
        sum(
            _subject_full_score_for_three_rates(
                getattr(subject, "name", None),
                full_score_config=full_score_config,
            )
            for subject in subjects
        ),
        2,
    )


def _fallback_exam_subjects_for_students(
    db: Session,
    exam_id: int,
    student_ids: list[int],
    school_id: int | None = None,
) -> list[Subject]:
    if not student_ids:
        return []
    subject_ids = [
        row[0]
        for row in db.query(Score.subject_id)
        .filter(Score.exam_id == exam_id, Score.student_id.in_(student_ids))
        .distinct()
        .all()
    ]
    if not subject_ids:
        return []
    query = db.query(Subject).filter(Subject.id.in_(subject_ids))
    if school_id is not None:
        query = query.filter(Subject.school_id == school_id)
    return query.all()


def _grade_scope_class_ids_for_three_rates(
    all_class_ids: list[int],
    class_grade_map: dict[int, str],
    target_class_id: int,
) -> list[int]:
    target_grade = class_grade_map.get(target_class_id)
    if not target_grade:
        return all_class_ids
    return [class_id for class_id in all_class_ids if class_grade_map.get(class_id) == target_grade]


def _calc_three_rate_scores(
    class_scores: dict[int, list[float]],
    subject_name: str | None,
    full_score_config: dict[str, float] | None = None,
    class_total_counts: dict[int, int] | None = None,
    full_score: float | None = None,
) -> dict[int, dict]:
    """Calculate per-class three-rate points and average score for one subject."""
    total_score = (
        float(full_score)
        if full_score is not None
        else _subject_full_score_for_three_rates(subject_name, full_score_config=full_score_config)
    )
    excellent_threshold = total_score * 0.8
    good_threshold = total_score * 0.7
    pass_threshold = total_score * 0.6
    low_threshold = total_score * 0.3

    metrics: dict[int, dict] = {}
    for class_id, scores in class_scores.items():
        normalized_scores = [float(s) for s in scores if s is not None]
        denominator = (
            int(class_total_counts.get(class_id, len(normalized_scores)))
            if class_total_counts is not None
            else len(normalized_scores)
        )
        if not normalized_scores or total_score <= 0:
            metrics[class_id] = {
                "score_count": len(normalized_scores),
                "student_count": denominator,
                "excellent_count": 0,
                "good_count": 0,
                "pass_count": 0,
                "low_count": 0,
                "excellent_rate": 0.0,
                "good_rate": 0.0,
                "pass_rate": 0.0,
                "low_rate": 0.0,
                "avg_score": round(float(sum(normalized_scores) / len(normalized_scores)), 2) if normalized_scores else 0.0,
            }
            continue

        excellent_count = sum(1 for score in normalized_scores if score >= excellent_threshold)
        good_count = sum(1 for score in normalized_scores if score >= good_threshold)
        pass_count = sum(1 for score in normalized_scores if score >= pass_threshold)
        low_count = sum(1 for score in normalized_scores if score <= low_threshold)
        rate_denominator = denominator if denominator > 0 else len(normalized_scores)
        metrics[class_id] = {
            "score_count": len(normalized_scores),
            "student_count": denominator,
            "excellent_count": excellent_count,
            "good_count": good_count,
            "pass_count": pass_count,
            "low_count": low_count,
            "excellent_rate": round(excellent_count / rate_denominator, 4) if rate_denominator > 0 else 0.0,
            "good_rate": round(good_count / rate_denominator, 4) if rate_denominator > 0 else 0.0,
            "pass_rate": round(pass_count / rate_denominator, 4) if rate_denominator > 0 else 0.0,
            "low_rate": round(low_count / rate_denominator, 4) if rate_denominator > 0 else 0.0,
            "avg_score": round(float(sum(normalized_scores) / len(normalized_scores)), 2),
        }

    comparable_metrics = [item for item in metrics.values() if item.get("score_count", 0) > 0]
    max_excellent = max((item["excellent_rate"] for item in comparable_metrics), default=0)
    max_good = max((item["good_rate"] for item in comparable_metrics), default=0)
    max_pass = max((item["pass_rate"] for item in comparable_metrics), default=0)

    low_rate_rank_scores = {
        low_rate: round(100.0 - index * 2.0, 2)
        for index, low_rate in enumerate(sorted({item["low_rate"] for item in comparable_metrics}))
    }

    for item in metrics.values():
        item["excellent_rate_score"] = round(item["excellent_rate"] / max_excellent * 100, 2) if max_excellent > 0 else 0.0
        item["good_rate_score"] = round(item["good_rate"] / max_good * 100, 2) if max_good > 0 else 0.0
        item["pass_rate_score"] = round(item["pass_rate"] / max_pass * 100, 2) if max_pass > 0 else 0.0
        item["low_rate_score"] = low_rate_rank_scores.get(item["low_rate"], 0.0)

    return metrics


def _sort_three_rate_rank_rows(rows: list[dict]) -> list[dict]:
    for row in rows:
        total_score = (
            float(row.get("excellent_rate_score", 0.0))
            + float(row.get("good_rate_score", 0.0))
            + float(row.get("pass_rate_score", 0.0))
            + float(row.get("low_rate_score", 0.0))
            + float(row.get("avg_score", 0.0))
        )
        row["total_score"] = round(total_score, 2)
    rows.sort(key=lambda item: (item["total_score"], item.get("avg_score", 0.0)), reverse=True)
    return rows


def _three_rate_rank_row_for_class(
    class_id: int,
    class_name: str,
    grade: str | None,
    class_metrics: dict,
) -> dict:
    return {
        "class_id": class_id,
        "class_name": class_name,
        "grade": grade,
        "excellent_rate": class_metrics["excellent_rate"],
        "good_rate": class_metrics["good_rate"],
        "pass_rate": class_metrics["pass_rate"],
        "low_rate": class_metrics["low_rate"],
        "excellent_rate_score": class_metrics["excellent_rate_score"],
        "good_rate_score": class_metrics["good_rate_score"],
        "pass_rate_score": class_metrics["pass_rate_score"],
        "low_rate_score": class_metrics["low_rate_score"],
        "avg_score": class_metrics["avg_score"],
    }


@router.get("/full-score-config")
def get_full_score_config(
    school_id: int | None = Query(None, description="学校ID。管理员必填"),
    current_user: User = Depends(require_teacher_or_admin),
    db: Session = Depends(get_db),
):
    effective_school_id = _resolve_full_score_config_school_id(current_user, school_id)
    config = _load_subject_full_score_config(db, effective_school_id)
    return {"school_id": effective_school_id, **config}


@router.put("/full-score-config")
def update_full_score_config(
    payload: FullScoreConfigPayload,
    school_id: int | None = Query(None, description="学校ID。管理员必填"),
    current_user: User = Depends(require_admin_or_school_admin),
    db: Session = Depends(get_db),
):
    effective_school_id = _resolve_full_score_config_school_id(current_user, school_id)
    school_exists = db.query(School.id).filter(School.id == effective_school_id).first()
    if not school_exists:
        raise HTTPException(status_code=404, detail="学校不存在")

    row = db.query(ScoreFullScoreConfig).filter(ScoreFullScoreConfig.school_id == effective_school_id).first()
    if not row:
        row = ScoreFullScoreConfig(school_id=effective_school_id)
        db.add(row)

    row.chinese_full_score = payload.chinese_full_score
    row.math_full_score = payload.math_full_score
    row.english_full_score = payload.english_full_score
    row.other_full_score = payload.other_full_score
    db.commit()
    db.refresh(row)

    return {
        "school_id": effective_school_id,
        "chinese_full_score": float(row.chinese_full_score),
        "math_full_score": float(row.math_full_score),
        "english_full_score": float(row.english_full_score),
        "other_full_score": float(row.other_full_score),
    }


@router.get("/exam/{exam_id}/subject/{subject_id}/three-rates-one-score-rank")
def exam_subject_three_rates_one_score_rank(
    exam_id: int,
    subject_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="考试不存在")
    subject = db.query(Subject).filter(Subject.id == subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="科目不存在")

    if current_user.role == "student":
        if current_user.student_id is None:
            raise HTTPException(status_code=400, detail="student account is not bound to a student profile")
        bound_student = db.query(Student).filter(Student.id == current_user.student_id).first()
        if bound_student is None:
            raise HTTPException(status_code=400, detail="bound student profile does not exist")
        accessible = [bound_student.class_id]
    elif current_user.role == "teacher":
        accessible = _teacher_exam_grade_class_ids(current_user, db, exam_id)
    else:
        accessible = get_accessible_class_ids(current_user, db)
    school_id = get_user_school_id(current_user)

    class_query = db.query(Class.id, Class.name, Class.grade, Class.school_id)
    if school_id is not None:
        class_query = class_query.filter(Class.school_id == school_id)
    if accessible is not None:
        class_query = class_query.filter(Class.id.in_(accessible))
    class_rows = class_query.all()
    if not class_rows:
        return []

    class_info_map = {
        class_id: {
            "class_name": class_name,
            "grade": grade,
            "school_id": class_school_id,
        }
        for class_id, class_name, grade, class_school_id in class_rows
    }
    class_ids = list(class_info_map.keys())

    students = db.query(Student.id, Student.class_id).filter(Student.class_id.in_(class_ids)).all()
    if not students:
        return []
    student_class_map = {student_id: class_id for student_id, class_id in students}
    student_ids = list(student_class_map.keys())

    imported_student_rows = db.query(Score.student_id).filter(
        Score.exam_id == exam_id,
        Score.student_id.in_(student_ids),
    ).distinct().all()
    class_imported_students: dict[int, set[int]] = {}
    for (student_id,) in imported_student_rows:
        student_class_id = student_class_map.get(student_id)
        if student_class_id is None:
            continue
        class_imported_students.setdefault(student_class_id, set()).add(student_id)
    class_total_counts = {
        student_class_id: len(imported_students)
        for student_class_id, imported_students in class_imported_students.items()
    }

    score_rows = db.query(Score.student_id, Score.score).filter(
        Score.exam_id == exam_id,
        Score.subject_id == subject_id,
        Score.student_id.in_(student_ids),
    ).all()
    if not score_rows:
        return []

    class_scores: dict[int, list[float]] = {}
    for student_id, score in score_rows:
        class_id = student_class_map.get(student_id)
        if class_id is None:
            continue
        class_scores.setdefault(class_id, []).append(float(score))
    if not class_scores:
        return []

    # Denominator max should be computed within the same grade.
    grade_grouped_scores: dict[tuple[int | None, str], dict[int, list[float]]] = {}
    for class_id, scores in class_scores.items():
        info = class_info_map.get(class_id)
        if not info:
            continue
        key = (info["school_id"], info["grade"])
        grade_grouped_scores.setdefault(key, {})[class_id] = scores

    full_score_config_cache: dict[int | None, dict[str, float]] = {}

    def get_full_score_config_for_school(target_school_id: int | None) -> dict[str, float]:
        if target_school_id not in full_score_config_cache:
            full_score_config_cache[target_school_id] = _load_subject_full_score_config(db, target_school_id)
        return full_score_config_cache[target_school_id]

    rows = []
    for (group_school_id, _grade), group_scores in grade_grouped_scores.items():
        metrics = _calc_three_rate_scores(
            group_scores,
            subject_name=subject.name,
            full_score_config=get_full_score_config_for_school(group_school_id),
            class_total_counts=class_total_counts,
        )
        for class_id, class_metrics in metrics.items():
            if class_metrics.get("score_count", 0) <= 0:
                continue
            class_info = class_info_map.get(class_id)
            if not class_info:
                continue
            rows.append(
                _three_rate_rank_row_for_class(
                    class_id=class_id,
                    class_name=class_info["class_name"],
                    grade=class_info["grade"],
                    class_metrics=class_metrics,
                )
            )

    return _sort_three_rate_rank_rows(rows)


@router.get("/exam/{exam_id}/three-rates-one-score-rank")
def exam_total_three_rates_one_score_rank(
    exam_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="考试不存在")

    if current_user.role == "student":
        if current_user.student_id is None:
            raise HTTPException(status_code=400, detail="student account is not bound to a student profile")
        bound_student = db.query(Student).filter(Student.id == current_user.student_id).first()
        if bound_student is None:
            raise HTTPException(status_code=400, detail="bound student profile does not exist")
        accessible = [bound_student.class_id]
    elif current_user.role == "teacher":
        accessible = _teacher_exam_grade_class_ids(current_user, db, exam_id)
    else:
        accessible = get_accessible_class_ids(current_user, db)
    school_id = get_user_school_id(current_user)

    class_query = db.query(Class.id, Class.name, Class.grade, Class.school_id)
    if school_id is not None:
        class_query = class_query.filter(Class.school_id == school_id)
    if accessible is not None:
        class_query = class_query.filter(Class.id.in_(accessible))
    class_rows = class_query.all()
    if not class_rows:
        return []

    class_info_map = {
        class_id: {
            "class_name": class_name,
            "grade": grade,
            "school_id": class_school_id,
        }
        for class_id, class_name, grade, class_school_id in class_rows
    }
    class_ids = list(class_info_map.keys())

    students = db.query(Student.id, Student.class_id).filter(Student.class_id.in_(class_ids)).all()
    if not students:
        return []
    student_class_map = {student_id: class_id for student_id, class_id in students}
    student_ids = list(student_class_map.keys())

    imported_student_rows = db.query(Score.student_id).filter(
        Score.exam_id == exam_id,
        Score.student_id.in_(student_ids),
    ).distinct().all()
    class_imported_students: dict[int, set[int]] = {}
    for (student_id,) in imported_student_rows:
        student_class_id = student_class_map.get(student_id)
        if student_class_id is None:
            continue
        class_imported_students.setdefault(student_class_id, set()).add(student_id)
    class_total_counts = {
        student_class_id: len(imported_students)
        for student_class_id, imported_students in class_imported_students.items()
    }

    score_rows = db.query(TotalRank.student_id, TotalRank.total_score).filter(
        TotalRank.exam_id == exam_id,
        TotalRank.student_id.in_(student_ids),
    ).all()
    if not score_rows:
        return []

    class_scores: dict[int, list[float]] = {}
    for student_id, total_score in score_rows:
        class_id = student_class_map.get(student_id)
        if class_id is None:
            continue
        class_scores.setdefault(class_id, []).append(float(total_score))
    if not class_scores:
        return []

    grade_grouped_scores: dict[tuple[int | None, str], dict[int, list[float]]] = {}
    for class_id, scores in class_scores.items():
        info = class_info_map.get(class_id)
        if not info:
            continue
        key = (info["school_id"], info["grade"])
        grade_grouped_scores.setdefault(key, {})[class_id] = scores

    full_score_config_cache: dict[int | None, dict[str, float]] = {}

    def get_full_score_config_for_school(target_school_id: int | None) -> dict[str, float]:
        if target_school_id not in full_score_config_cache:
            full_score_config_cache[target_school_id] = _load_subject_full_score_config(db, target_school_id)
        return full_score_config_cache[target_school_id]

    rows = []
    for (group_school_id, grade), group_scores in grade_grouped_scores.items():
        group_class_ids = set(group_scores.keys())
        group_student_ids = [
            student_id
            for student_id, class_id in student_class_map.items()
            if class_id in group_class_ids
        ]
        subjects = load_exam_subjects_for_grade(db, exam_id, grade, group_school_id)
        if not subjects:
            subjects = _fallback_exam_subjects_for_students(
                db,
                exam_id,
                group_student_ids,
                school_id=group_school_id,
            )
        full_score_config = get_full_score_config_for_school(group_school_id)
        total_full_score = _total_full_score_for_three_rates(
            subjects,
            full_score_config=full_score_config,
        )
        metrics = _calc_three_rate_scores(
            group_scores,
            subject_name=None,
            full_score_config=full_score_config,
            class_total_counts=class_total_counts,
            full_score=total_full_score,
        )
        for class_id, class_metrics in metrics.items():
            if class_metrics.get("score_count", 0) <= 0:
                continue
            class_info = class_info_map.get(class_id)
            if not class_info:
                continue
            rows.append(
                _three_rate_rank_row_for_class(
                    class_id=class_id,
                    class_name=class_info["class_name"],
                    grade=class_info["grade"],
                    class_metrics=class_metrics,
                )
            )

    return _sort_three_rate_rank_rows(rows)


# ── 学生分析 ──────────────────────────────────────────────────────────────────

@router.get("/student/{student_id}/total-trend")
def student_total_trend(
    student_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="学生不存在")
    _check_student_permission(student, current_user, db)

    # Get student's class grade
    cls = db.query(Class).filter(Class.id == student.class_id).first()
    grade = cls.grade if cls else None

    query = (
        db.query(TotalRank, Exam)
        .join(Exam, Exam.id == TotalRank.exam_id)
        .filter(TotalRank.student_id == student_id)
    )
    rows = query.order_by(Exam.exam_date.asc()).all()
    if grade:
        rows = [(rank, exam) for rank, exam in rows if _exam_includes_grade(exam.grade, grade)]
    return [
        {"exam_name": exam.name, "exam_date": str(exam.exam_date), "total_score": rank.total_score}
        for rank, exam in rows
    ]


@router.get("/student/{student_id}/subject-trend")
def student_subject_trend(
    student_id: int,
    subject_id: int = Query(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="学生不存在")
    _check_student_permission(student, current_user, db)

    subject = db.query(Subject).filter(Subject.id == subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="科目不存在")

    # Get student's class grade
    cls = db.query(Class).filter(Class.id == student.class_id).first()
    grade = cls.grade if cls else None

    query = (
        db.query(Score, Exam)
        .join(Exam, Exam.id == Score.exam_id)
        .filter(Score.student_id == student_id, Score.subject_id == subject_id)
    )
    rows = query.order_by(Exam.exam_date.asc()).all()
    if grade:
        rows = [(score, exam) for score, exam in rows if _exam_includes_grade(exam.grade, grade)]
    return [
        {"exam_name": exam.name, "exam_date": str(exam.exam_date), "score": score.score}
        for score, exam in rows
    ]


@router.get("/student/{student_id}/rank-trend")
def student_rank_trend(
    student_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="学生不存在")
    _check_student_permission(student, current_user, db)

    # Get student's class grade
    cls = db.query(Class).filter(Class.id == student.class_id).first()
    grade = cls.grade if cls else None

    query = (
        db.query(TotalRank, Exam)
        .join(Exam, Exam.id == TotalRank.exam_id)
        .filter(TotalRank.student_id == student_id)
    )
    rows = query.order_by(Exam.exam_date.asc()).all()
    if grade:
        rows = [(rank, exam) for rank, exam in rows if _exam_includes_grade(exam.grade, grade)]
    return [
        {
            "exam_name": exam.name,
            "exam_date": str(exam.exam_date),
            "rank_class": rank.rank_class,
            "rank_grade": rank.rank_grade,
        }
        for rank, exam in rows
    ]


@router.get("/student/{student_id}/subject-comparison")
def student_subject_comparison(
    student_id: int,
    exam_id: int = Query(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="学生不存在")
    _check_student_permission(student, current_user, db)

    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="考试不存在")

    # Get student's class and grade
    cls = db.query(Class).filter(Class.id == student.class_id).first()
    grade = cls.grade if cls else None
    school_id_for_full_score = cls.school_id if cls else get_user_school_id(current_user)
    full_score_config = _load_subject_full_score_config(db, school_id_for_full_score)

    # Get all subjects that have scores in this exam
    subject_ids = [
        r[0] for r in db.query(Score.subject_id).filter(Score.exam_id == exam_id).distinct().all()
    ]
    subjects = {s.id: s.name for s in db.query(Subject).filter(Subject.id.in_(subject_ids)).all()}

    # Students in same class
    class_student_ids = [
        r[0] for r in db.query(Student.id).filter(Student.class_id == student.class_id).all()
    ]

    # Students in same grade
    grade_class_ids = [
        r[0] for r in db.query(Class.id).filter(Class.grade == grade).all()
    ] if grade else []
    grade_student_ids = [
        r[0] for r in db.query(Student.id).filter(Student.class_id.in_(grade_class_ids)).all()
    ] if grade_class_ids else []

    result = []
    for subj_id, subj_name in subjects.items():
        # Student's own score
        own = db.query(Score).filter(
            Score.student_id == student_id,
            Score.exam_id == exam_id,
            Score.subject_id == subj_id,
        ).first()

        # Class avg
        class_avg_row = db.query(func.avg(Score.score)).filter(
            Score.exam_id == exam_id,
            Score.subject_id == subj_id,
            Score.student_id.in_(class_student_ids),
        ).scalar()

        # Grade avg
        grade_avg_row = db.query(func.avg(Score.score)).filter(
            Score.exam_id == exam_id,
            Score.subject_id == subj_id,
            Score.student_id.in_(grade_student_ids),
        ).scalar() if grade_student_ids else None

        result.append({
            "subject_name": subj_name,
            "student_score": own.score if own else None,
            "subject_full_score": _subject_full_score_for_three_rates(subj_name, full_score_config=full_score_config),
            "class_avg": round(float(class_avg_row), 2) if class_avg_row is not None else None,
            "grade_avg": round(float(grade_avg_row), 2) if grade_avg_row is not None else None,
        })

    return result


# ── 班级分析 ──────────────────────────────────────────────────────────────────

def _round_score(value: float | None) -> float | None:
    return round(float(value), 2) if value is not None else None


def _ordered_exam_subject_rows(db: Session, exam_id: int) -> list[tuple[int, str]]:
    return (
        db.query(Subject.id, Subject.name)
        .join(Score, Score.subject_id == Subject.id)
        .filter(Score.exam_id == exam_id)
        .distinct()
        .order_by(Subject.id.asc())
        .all()
    )


@router.get("/student/{student_id}/score-comparison")
def student_score_comparison(
    student_id: int,
    exam_id: int = Query(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="瀛︾敓涓嶅瓨鍦?")
    _check_student_permission(student, current_user, db)

    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="鑰冭瘯涓嶅瓨鍦?")

    cls = db.query(Class).filter(Class.id == student.class_id).first()
    class_student_ids = [
        row[0] for row in db.query(Student.id).filter(Student.class_id == student.class_id).all()
    ]
    grade_class_ids = (
        [row[0] for row in db.query(Class.id).filter(Class.grade == cls.grade).all()]
        if cls and cls.grade
        else []
    )
    grade_student_ids = (
        [row[0] for row in db.query(Student.id).filter(Student.class_id.in_(grade_class_ids)).all()]
        if grade_class_ids
        else []
    )

    result = [{
        "dimension_name": "总分",
        "student_score": db.query(TotalRank.total_score).filter(
            TotalRank.student_id == student_id,
            TotalRank.exam_id == exam_id,
        ).scalar(),
        "class_avg": _round_score(
            db.query(func.avg(TotalRank.total_score)).filter(
                TotalRank.exam_id == exam_id,
                TotalRank.student_id.in_(class_student_ids),
            ).scalar()
        ),
        "grade_avg": _round_score(
            db.query(func.avg(TotalRank.total_score)).filter(
                TotalRank.exam_id == exam_id,
                TotalRank.student_id.in_(grade_student_ids),
            ).scalar()
        ) if grade_student_ids else None,
        "highest_score": _round_score(
            db.query(func.max(TotalRank.total_score)).filter(
                TotalRank.exam_id == exam_id,
                TotalRank.student_id.in_(grade_student_ids),
            ).scalar()
        ) if grade_student_ids else None,
    }]

    for subj_id, subj_name in _ordered_exam_subject_rows(db, exam_id):
        result.append({
            "dimension_name": subj_name,
            "student_score": db.query(Score.score).filter(
                Score.student_id == student_id,
                Score.exam_id == exam_id,
                Score.subject_id == subj_id,
            ).scalar(),
            "class_avg": _round_score(
                db.query(func.avg(Score.score)).filter(
                    Score.exam_id == exam_id,
                    Score.subject_id == subj_id,
                    Score.student_id.in_(class_student_ids),
                ).scalar()
            ),
            "grade_avg": _round_score(
                db.query(func.avg(Score.score)).filter(
                    Score.exam_id == exam_id,
                    Score.subject_id == subj_id,
                    Score.student_id.in_(grade_student_ids),
                ).scalar()
            ) if grade_student_ids else None,
            "highest_score": _round_score(
                db.query(func.max(Score.score)).filter(
                    Score.exam_id == exam_id,
                    Score.subject_id == subj_id,
                    Score.student_id.in_(grade_student_ids),
                ).scalar()
            ) if grade_student_ids else None,
        })

    return result


@router.get("/classes/rank")
def classes_rank(
    exam_id: int = Query(...),
    subject_id: Optional[int] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role == "student":
        if current_user.student_id is None:
            raise HTTPException(status_code=400, detail="student account is not bound to a student profile")
        bound_student = db.query(Student).filter(Student.id == current_user.student_id).first()
        if bound_student is None:
            raise HTTPException(status_code=400, detail="bound student profile does not exist")
        accessible = [bound_student.class_id]
    elif current_user.role == "teacher":
        accessible = _teacher_exam_grade_class_ids(current_user, db, exam_id)
    else:
        accessible = get_accessible_class_ids(current_user, db)
    school_id = get_user_school_id(current_user)

    query = db.query(Class)
    if school_id is not None:
        query = query.filter(Class.school_id == school_id)
    classes = query.all()
    if accessible is not None:
        classes = [c for c in classes if c.id in accessible]

    result = []
    class_student_ids_map: dict[int, list[int]] = {}
    for cls in classes:
        student_ids = [
            r[0] for r in db.query(Student.id).filter(Student.class_id == cls.id).all()
        ]
        if not student_ids:
            continue
        class_student_ids_map[cls.id] = student_ids

        if subject_id:
            avg = db.query(func.avg(Score.score)).filter(
                Score.exam_id == exam_id,
                Score.subject_id == subject_id,
                Score.student_id.in_(student_ids),
            ).scalar()
        else:
            avg = db.query(func.avg(TotalRank.total_score)).filter(
                TotalRank.exam_id == exam_id,
                TotalRank.student_id.in_(student_ids),
            ).scalar()

        if avg is not None:
            result.append({
                "class_name": cls.name,
                "avg_score": round(float(avg), 2),
                "class_id": cls.id,
                "grade": cls.grade,
            })

    grade_avg_by_grade: dict[str, float] = {}
    for grade in {item["grade"] for item in result if item.get("grade")}:
        grade_student_ids = [
            student_id
            for item in result
            if item.get("grade") == grade
            for student_id in class_student_ids_map.get(item["class_id"], [])
        ]
        if not grade_student_ids:
            continue
        if subject_id:
            grade_avg = db.query(func.avg(Score.score)).filter(
                Score.exam_id == exam_id,
                Score.subject_id == subject_id,
                Score.student_id.in_(grade_student_ids),
            ).scalar()
        else:
            grade_avg = db.query(func.avg(TotalRank.total_score)).filter(
                TotalRank.exam_id == exam_id,
                TotalRank.student_id.in_(grade_student_ids),
            ).scalar()
        if grade_avg is not None:
            grade_avg_by_grade[grade] = round(float(grade_avg), 2)

    for item in result:
        item["grade_avg"] = grade_avg_by_grade.get(item.get("grade"))

    result.sort(key=lambda x: x["avg_score"], reverse=True)
    for i, item in enumerate(result, 1):
        item["rank"] = i

    return result


@router.get("/class/{class_id}/exam/{exam_id}/distribution")
def class_distribution(
    class_id: int,
    exam_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _check_class_permission(class_id, exam_id, current_user, db)
    target_class = db.query(Class).filter(Class.id == class_id).first()
    full_score_config = _load_subject_full_score_config(
        db,
        target_class.school_id if target_class else get_user_school_id(current_user),
    )

    student_ids = [
        r[0] for r in db.query(Student.id).filter(Student.class_id == class_id).all()
    ]
    if not student_ids:
        return {"total": _calc_rates([]), "subjects": {}}

    # Total scores
    total_scores = [
        r[0] for r in db.query(TotalRank.total_score).filter(
            TotalRank.exam_id == exam_id,
            TotalRank.student_id.in_(student_ids),
        ).all()
    ]

    # Per-subject scores
    subject_ids = [
        r[0] for r in db.query(Score.subject_id).filter(
            Score.exam_id == exam_id,
            Score.student_id.in_(student_ids),
        ).distinct().all()
    ]
    subjects = {s.id: s for s in db.query(Subject).filter(Subject.id.in_(subject_ids)).all()}

    max_total = sum(
        _subject_full_score_for_three_rates(subject.name, full_score_config=full_score_config)
        for subject in subjects.values()
    )

    subjects_dist = {}
    for subj_id, subj in subjects.items():
        scores = [
            r[0] for r in db.query(Score.score).filter(
                Score.exam_id == exam_id,
                Score.subject_id == subj_id,
                Score.student_id.in_(student_ids),
            ).all()
        ]
        # Single subject uses percentage thresholds based on subject full score.
        subject_full_score = _subject_full_score_for_three_rates(subj.name, full_score_config=full_score_config)
        subjects_dist[subj.name] = _calc_rates(scores, max_score=subject_full_score)

    # Total uses percentage thresholds
    return {"total": _calc_rates(total_scores, max_total), "subjects": subjects_dist}


@router.get("/class/{class_id}/exam/{exam_id}/three-rates-one-score")
def class_three_rates_one_score(
    class_id: int,
    exam_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _check_class_permission(class_id, exam_id, current_user, db)
    target_class = db.query(Class).filter(Class.id == class_id).first()
    full_score_config = _load_subject_full_score_config(
        db,
        target_class.school_id if target_class else get_user_school_id(current_user),
    )

    if current_user.role == "teacher":
        accessible = _teacher_exam_grade_class_ids(current_user, db, exam_id)
    else:
        accessible = get_accessible_class_ids(current_user, db)
    school_id = get_user_school_id(current_user)

    class_query = db.query(Class.id)
    if school_id is not None:
        class_query = class_query.filter(Class.school_id == school_id)
    if accessible is not None:
        class_query = class_query.filter(Class.id.in_(accessible))
    accessible_class_ids = [row[0] for row in class_query.all()]
    if not accessible_class_ids:
        return []

    class_rows = db.query(Class.id, Class.grade).filter(Class.id.in_(accessible_class_ids)).all()
    class_grade_map = {class_id: grade for class_id, grade in class_rows}
    grade_class_ids = _grade_scope_class_ids_for_three_rates(
        accessible_class_ids,
        class_grade_map,
        target_class_id=class_id,
    )
    if not grade_class_ids:
        return []

    students = db.query(Student.id, Student.class_id).filter(Student.class_id.in_(grade_class_ids)).all()
    if not students:
        return []

    student_class_map = {student_id: student_class_id for student_id, student_class_id in students}
    all_student_ids = list(student_class_map.keys())

    scores = db.query(Score.subject_id, Score.student_id, Score.score).filter(
        Score.exam_id == exam_id,
        Score.student_id.in_(all_student_ids),
    ).all()
    if not scores:
        return []

    subject_scores_by_class: dict[int, dict[int, list[float]]] = {}
    class_imported_students: dict[int, set[int]] = {}
    for subject_id, student_id, score in scores:
        student_class_id = student_class_map.get(student_id)
        if student_class_id is None:
            continue
        class_imported_students.setdefault(student_class_id, set()).add(student_id)
        subject_scores_by_class.setdefault(subject_id, {}).setdefault(student_class_id, []).append(float(score))

    class_total_counts = {
        student_class_id: len(imported_students)
        for student_class_id, imported_students in class_imported_students.items()
    }

    if not subject_scores_by_class:
        return []

    subject_ids = list(subject_scores_by_class.keys())
    subject_name_map = {
        subject.id: subject.name
        for subject in db.query(Subject).filter(Subject.id.in_(subject_ids)).all()
    }

    rows = []
    for subject_id, class_score_map in subject_scores_by_class.items():
        subject_name = subject_name_map.get(subject_id, str(subject_id))
        scoped_scores = {cid: class_score_map.get(cid, []) for cid in grade_class_ids}
        metrics = _calc_three_rate_scores(
            scoped_scores,
            subject_name=subject_name,
            full_score_config=full_score_config,
            class_total_counts=class_total_counts,
        )
        class_metrics = metrics.get(class_id)
        if not class_metrics or class_metrics.get("score_count", 0) == 0:
            continue
        rows.append({
            "subject_id": subject_id,
            "subject_name": subject_name,
            "excellent_rate": class_metrics["excellent_rate"],
            "good_rate": class_metrics["good_rate"],
            "pass_rate": class_metrics["pass_rate"],
            "low_rate": class_metrics["low_rate"],
            "excellent_rate_score": class_metrics["excellent_rate_score"],
            "good_rate_score": class_metrics["good_rate_score"],
            "pass_rate_score": class_metrics["pass_rate_score"],
            "low_rate_score": class_metrics["low_rate_score"],
            "avg_score": class_metrics["avg_score"],
        })

    rows.sort(key=lambda item: item["subject_name"])
    return rows


@router.get("/class/{class_id}/exam/{exam_id}/bottom-students")
def class_bottom_students(
    class_id: int,
    exam_id: int,
    limit: int = Query(10, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _check_class_permission(class_id, exam_id, current_user, db)

    student_ids = [
        r[0] for r in db.query(Student.id).filter(Student.class_id == class_id).all()
    ]
    if not student_ids:
        return []

    # Get ranks sorted by total_score ASC (bottom students first)
    ranks = (
        db.query(TotalRank, Student)
        .join(Student, Student.id == TotalRank.student_id)
        .filter(TotalRank.exam_id == exam_id, TotalRank.student_id.in_(student_ids))
        .order_by(TotalRank.total_score.asc())
        .limit(limit)
        .all()
    )

    if not ranks:
        return []

    bottom_ids = [s.id for _, s in ranks]

    # Get all scores for these students
    scores = db.query(Score).filter(
        Score.exam_id == exam_id,
        Score.student_id.in_(bottom_ids),
    ).all()

    subject_map = {s.id: s.name for s in db.query(Subject).all()}

    # Class avg per subject
    class_avgs = {}
    for subj_id in {sc.subject_id for sc in scores}:
        avg = db.query(func.avg(Score.score)).filter(
            Score.exam_id == exam_id,
            Score.subject_id == subj_id,
            Score.student_id.in_(student_ids),
        ).scalar()
        class_avgs[subj_id] = float(avg) if avg is not None else 0.0

    # Group scores by student
    student_scores: dict[int, dict] = {}
    for sc in scores:
        student_scores.setdefault(sc.student_id, {})[subject_map.get(sc.subject_id, str(sc.subject_id))] = sc.score

    result = []
    for rank, student in ranks:
        subj_scores = student_scores.get(student.id, {})
        weak = [
            subject_map[sid]
            for sid, avg in class_avgs.items()
            if student_scores.get(student.id, {}).get(subject_map.get(sid, ""), 999) < avg
        ]
        result.append({
            "student_name": student.name,
            "student_no": student.student_no,
            "total_score": rank.total_score,
            "rank_class": rank.rank_class,
            "subjects": subj_scores,
            "weak_subjects": weak,
        })

    return result


@router.get("/class/{class_id}/exam/{exam_id}/biased-students")
def class_biased_students(
    class_id: int,
    exam_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    偏科生分析：
    1. 取班级总分排名前40名的学生
    2. 计算本班本次考试每科的平均分
    3. 若某学生任意科目分数低于该科班级平均分，则为偏科生
    """
    _check_class_permission(class_id, exam_id, current_user, db)

    student_ids = [
        r[0] for r in db.query(Student.id).filter(Student.class_id == class_id).all()
    ]
    if not student_ids:
        return []

    # Get top 40 students by rank_class
    top_ranks = (
        db.query(TotalRank, Student)
        .join(Student, Student.id == TotalRank.student_id)
        .filter(
            TotalRank.exam_id == exam_id,
            TotalRank.student_id.in_(student_ids),
            TotalRank.rank_class <= 40,
        )
        .order_by(TotalRank.rank_class.asc())
        .all()
    )

    if not top_ranks:
        return []

    top_student_ids = [s.id for _, s in top_ranks]
    student_map = {s.id: s for _, s in top_ranks}

    # Get all scores for top students
    scores = db.query(Score).filter(
        Score.exam_id == exam_id,
        Score.student_id.in_(top_student_ids),
    ).all()

    if not scores:
        return []

    subject_map = {s.id: s.name for s in db.query(Subject).all()}

    # Calculate class average per subject (using all students in class, not just top 40)
    class_avgs = {}
    subject_ids = {sc.subject_id for sc in scores}
    for subj_id in subject_ids:
        avg = db.query(func.avg(Score.score)).filter(
            Score.exam_id == exam_id,
            Score.subject_id == subj_id,
            Score.student_id.in_(student_ids),
        ).scalar()
        class_avgs[subj_id] = float(avg) if avg is not None else 0.0

    # Group scores by student
    student_scores: dict[int, dict[int, float]] = {}
    for sc in scores:
        student_scores.setdefault(sc.student_id, {})[sc.subject_id] = sc.score

    result = []
    for rank, student in top_ranks:
        subj_scores = student_scores.get(student.id, {})
        # Find subjects where score < class average
        weak_subjects = []
        for subj_id, score in subj_scores.items():
            if score < class_avgs.get(subj_id, 0):
                weak_subjects.append(subject_map.get(subj_id, str(subj_id)))

        if weak_subjects:
            result.append({
                "student_name": student.name,
                "student_no": student.student_no,
                "rank_class": rank.rank_class,
                "subjects": {subject_map.get(k, str(k)): v for k, v in subj_scores.items()},
                "weak_subjects": weak_subjects,
                "weak_count": len(weak_subjects),
            })

    # Sort by weak_count descending
    result.sort(key=lambda x: x["weak_count"], reverse=True)
    return result
