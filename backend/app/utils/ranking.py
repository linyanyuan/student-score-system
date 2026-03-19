from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.score import Score
from app.models.student import Student
from app.models.class_ import Class
from app.models.exam import Exam
from app.models.total_rank import TotalRank


def recalculate_ranks(db: Session, exam_id: int):
    """Recalculate total scores and ranks for all students in an exam."""
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        return

    # Get total scores per student for this exam
    totals = (
        db.query(
            Score.student_id,
            func.sum(Score.score).label("total_score"),
        )
        .filter(Score.exam_id == exam_id)
        .group_by(Score.student_id)
        .all()
    )

    if not totals:
        # No scores, clean up any existing ranks
        db.query(TotalRank).filter(TotalRank.exam_id == exam_id).delete()
        db.flush()
        return

    # Get student -> class mapping
    student_ids = [t.student_id for t in totals]
    students = db.query(Student).filter(Student.id.in_(student_ids)).all()
    student_class = {s.id: s.class_id for s in students}
    student_grade = {}
    classes = db.query(Class).all()
    class_grade = {c.id: c.grade for c in classes}
    for s in students:
        student_grade[s.id] = class_grade.get(s.class_id, "")

    # Build score list
    score_list = [(t.student_id, float(t.total_score)) for t in totals]

    # Sort by total_score descending for grade rank
    score_list.sort(key=lambda x: x[1], reverse=True)
    grade_ranks = {}
    for rank, (sid, _) in enumerate(score_list, 1):
        grade_ranks[sid] = rank

    # Class ranks: group by class, sort within each class
    class_groups = {}
    for sid, total in score_list:
        cid = student_class.get(sid)
        if cid not in class_groups:
            class_groups[cid] = []
        class_groups[cid].append((sid, total))

    class_ranks = {}
    for cid, group in class_groups.items():
        group.sort(key=lambda x: x[1], reverse=True)
        for rank, (sid, _) in enumerate(group, 1):
            class_ranks[sid] = rank

    # Upsert total_ranks
    for sid, total in score_list:
        existing = db.query(TotalRank).filter(
            TotalRank.student_id == sid,
            TotalRank.exam_id == exam_id,
        ).first()
        if existing:
            existing.total_score = total
            existing.rank_class = class_ranks.get(sid, 0)
            existing.rank_grade = grade_ranks.get(sid, 0)
        else:
            tr = TotalRank(
                student_id=sid,
                exam_id=exam_id,
                total_score=total,
                rank_class=class_ranks.get(sid, 0),
                rank_grade=grade_ranks.get(sid, 0),
            )
            db.add(tr)

    # Remove ranks for students who no longer have scores
    db.query(TotalRank).filter(
        TotalRank.exam_id == exam_id,
        TotalRank.student_id.notin_(student_ids),
    ).delete(synchronize_session=False)

    db.flush()
