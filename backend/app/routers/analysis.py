import statistics
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.dependencies import get_db, get_current_user, get_accessible_class_ids, get_user_school_id
from app.models.score import Score
from app.models.student import Student
from app.models.class_ import Class
from app.models.exam import Exam
from app.models.subject import Subject
from app.models.total_rank import TotalRank
from app.models.user import User

router = APIRouter(prefix="/api/analysis", tags=["成绩分析"])


def _check_student_permission(student: Student, current_user: User, db: Session):
    if current_user.role == "student":
        if student.student_no != current_user.username:
            raise HTTPException(status_code=403, detail="无权访问该学生数据")
    elif current_user.role == "teacher":
        accessible = get_accessible_class_ids(current_user, db)
        if accessible is not None and student.class_id not in accessible:
            raise HTTPException(status_code=403, detail="无权访问该学生数据")


def _check_class_permission(class_id: int, current_user: User, db: Session):
    if current_user.role == "student":
        raise HTTPException(status_code=403, detail="学生无权访问班级分析")
    accessible = get_accessible_class_ids(current_user, db)
    if accessible is not None and class_id not in accessible:
        raise HTTPException(status_code=403, detail="无权访问该班级")


def _calc_rates(scores: list[float], max_score: float | None = None) -> dict:
    """Calculate distribution rates and counts. If max_score is provided, use percentage thresholds."""
    if not scores:
        return {
            "excellent_rate": 0.0, "good_rate": 0.0, "pass_rate": 0.0, "fail_rate": 0.0,
            "excellent_count": 0, "good_count": 0, "pass_count": 0, "fail_count": 0, "total_count": 0,
        }
    n = len(scores)
    if max_score and max_score > 0:
        # Use percentage thresholds for total scores
        excellent = sum(1 for s in scores if s / max_score >= 0.9)
        good = sum(1 for s in scores if 0.8 <= s / max_score < 0.9)
        pass_ = sum(1 for s in scores if 0.6 <= s / max_score < 0.8)
        fail = sum(1 for s in scores if s / max_score < 0.6)
    else:
        # Use absolute thresholds for single subjects
        excellent = sum(1 for s in scores if s >= 90)
        good = sum(1 for s in scores if 80 <= s < 90)
        pass_ = sum(1 for s in scores if 60 <= s < 80)
        fail = sum(1 for s in scores if s < 60)
    return {
        "excellent_rate": round(excellent / n, 4),
        "good_rate": round(good / n, 4),
        "pass_rate": round(pass_ / n, 4),
        "fail_rate": round(fail / n, 4),
        "excellent_count": excellent,
        "good_count": good,
        "pass_count": pass_,
        "fail_count": fail,
        "total_count": n,
    }


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
    # Filter by grade to only show same-grade exams
    if grade:
        query = query.filter(Exam.grade == grade)

    rows = query.order_by(Exam.exam_date.asc()).all()
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
    # Filter by grade
    if grade:
        query = query.filter(Exam.grade == grade)

    rows = query.order_by(Exam.exam_date.asc()).all()
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
    # Filter by grade
    if grade:
        query = query.filter(Exam.grade == grade)

    rows = query.order_by(Exam.exam_date.asc()).all()
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
            "class_avg": round(float(class_avg_row), 2) if class_avg_row is not None else None,
            "grade_avg": round(float(grade_avg_row), 2) if grade_avg_row is not None else None,
        })

    return result


# ── 班级分析 ──────────────────────────────────────────────────────────────────

@router.get("/classes/rank")
def classes_rank(
    exam_id: int = Query(...),
    subject_id: Optional[int] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    accessible = get_accessible_class_ids(current_user, db)
    school_id = get_user_school_id(current_user)

    query = db.query(Class)
    if school_id is not None:
        query = query.filter(Class.school_id == school_id)
    classes = query.all()
    if accessible is not None:
        classes = [c for c in classes if c.id in accessible]

    result = []
    for cls in classes:
        student_ids = [
            r[0] for r in db.query(Student.id).filter(Student.class_id == cls.id).all()
        ]
        if not student_ids:
            continue

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
            result.append({"class_name": cls.name, "avg_score": round(float(avg), 2), "class_id": cls.id})

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
    _check_class_permission(class_id, current_user, db)

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

    # Calculate max total score: use actual max score in data as reference
    max_total = max(total_scores) if total_scores else 0

    subjects_dist = {}
    for subj_id, subj in subjects.items():
        scores = [
            r[0] for r in db.query(Score.score).filter(
                Score.exam_id == exam_id,
                Score.subject_id == subj_id,
                Score.student_id.in_(student_ids),
            ).all()
        ]
        # Single subject uses absolute thresholds (no max_score)
        subjects_dist[subj.name] = _calc_rates(scores)

    # Total uses percentage thresholds
    return {"total": _calc_rates(total_scores, max_total), "subjects": subjects_dist}


@router.get("/class/{class_id}/exam/{exam_id}/bottom-students")
def class_bottom_students(
    class_id: int,
    exam_id: int,
    limit: int = Query(10, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _check_class_permission(class_id, current_user, db)

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
    _check_class_permission(class_id, current_user, db)

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
