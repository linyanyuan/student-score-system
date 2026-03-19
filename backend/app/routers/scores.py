import io
import json

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, status
from fastapi.responses import StreamingResponse
from openpyxl import Workbook, load_workbook
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.dependencies import get_db, get_current_user, require_teacher_or_admin, get_accessible_class_ids
from app.models.score import Score
from app.models.student import Student
from app.models.class_ import Class
from app.models.exam import Exam
from app.models.subject import Subject
from app.models.total_rank import TotalRank
from app.models.user import User
from app.schemas.score import ScoreCreate, ScoreUpdate, ScoreItemResponse, ScorePaginatedResponse, BatchDeleteScoresRequest
from app.utils.ranking import recalculate_ranks

router = APIRouter(prefix="/api/scores", tags=["成绩管理"])

# Fixed subject display order and required subjects for import
SUBJECT_DISPLAY_ORDER = ["语文", "数学", "英语", "物理", "生物", "历史", "地理", "道法"]
REQUIRED_SUBJECTS = {"语文", "数学", "英语", "历史", "道法"}


def _sort_subjects(subjects: list) -> list:
    """Sort subjects by predefined display order, unknown subjects go to end."""
    order_map = {name: i for i, name in enumerate(SUBJECT_DISPLAY_ORDER)}
    return sorted(subjects, key=lambda s: order_map.get(s.name, 999))


def _get_previous_exam(db: Session, current_exam: Exam):
    """Find the previous exam (same grade, earlier date, closest to current)."""
    return (
        db.query(Exam)
        .filter(
            Exam.grade == current_exam.grade,
            Exam.exam_date < current_exam.exam_date,
        )
        .order_by(Exam.exam_date.desc())
        .first()
    )


def _rank_change_str(current_rank, prev_rank):
    if prev_rank is None or current_rank is None:
        return "-"
    diff = prev_rank - current_rank  # positive means improved (rank number decreased)
    if diff > 0:
        return f"↑{diff}"
    elif diff < 0:
        return f"↓{abs(diff)}"
    else:
        return "-"


@router.get("", response_model=ScorePaginatedResponse)
def list_scores(
    exam_id: int,
    class_id: int | None = None,
    student_id: int | None = None,
    student_no: str | None = Query(None, description="学号模糊搜索"),
    student_name: str | None = Query(None, description="姓名模糊搜索"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="考试不存在")

    # Permission check
    accessible = get_accessible_class_ids(current_user, db)

    # If student role, lock to their own data
    if current_user.role == "student":
        # Find the student record linked to this user (by username matching student_no or a separate link)
        # For now, students can only view scores if student_id is provided
        if student_id is None:
            raise HTTPException(status_code=400, detail="学生角色需指定 student_id")

    # Get all students with scores in this exam
    score_query = db.query(Score.student_id).filter(Score.exam_id == exam_id).distinct()
    student_ids_with_scores = [r[0] for r in score_query.all()]

    if not student_ids_with_scores:
        return ScorePaginatedResponse(items=[], total=0, page=page, page_size=page_size)

    # Build student query with filters
    student_query = db.query(Student).filter(Student.id.in_(student_ids_with_scores))
    if class_id:
        if accessible is not None and class_id not in accessible:
            raise HTTPException(status_code=403, detail="无权访问该班级")
        student_query = student_query.filter(Student.class_id == class_id)
    elif accessible is not None:
        student_query = student_query.filter(Student.class_id.in_(accessible))
    if student_id:
        student_query = student_query.filter(Student.id == student_id)
    if student_no:
        student_query = student_query.filter(Student.student_no.contains(student_no))
    if student_name:
        student_query = student_query.filter(Student.name.contains(student_name))

    total = student_query.count()

    # Get all matching student IDs for sorting by total_score
    all_matching_student_ids = [s.id for s in student_query.all()]

    if not all_matching_student_ids:
        return ScorePaginatedResponse(items=[], total=total, page=page, page_size=page_size)

    # Get ranks for sorting
    ranks_for_sort = {
        tr.student_id: tr.total_score
        for tr in db.query(TotalRank).filter(
            TotalRank.exam_id == exam_id,
            TotalRank.student_id.in_(all_matching_student_ids),
        ).all()
    }

    # Sort student IDs by total_score DESC
    sorted_student_ids = sorted(
        all_matching_student_ids,
        key=lambda sid: ranks_for_sort.get(sid, 0),
        reverse=True
    )

    # Paginate
    start = (page - 1) * page_size
    end = start + page_size
    paginated_student_ids = sorted_student_ids[start:end]

    if not paginated_student_ids:
        return ScorePaginatedResponse(items=[], total=total, page=page, page_size=page_size)

    # Get students in order
    students_map = {s.id: s for s in db.query(Student).filter(Student.id.in_(paginated_student_ids)).all()}
    students = [students_map[sid] for sid in paginated_student_ids if sid in students_map]

    student_ids = [s.id for s in students]
    class_map = {c.id: c.name for c in db.query(Class).all()}
    subject_map = {s.id: s.name for s in db.query(Subject).all()}

    # Get scores for these students in this exam
    scores = db.query(Score).filter(
        Score.exam_id == exam_id,
        Score.student_id.in_(student_ids),
    ).all()

    # Group scores by student
    student_scores = {}
    for sc in scores:
        if sc.student_id not in student_scores:
            student_scores[sc.student_id] = {}
        student_scores[sc.student_id][subject_map.get(sc.subject_id, str(sc.subject_id))] = sc.score

    # Get current ranks
    current_ranks = {
        tr.student_id: tr
        for tr in db.query(TotalRank).filter(
            TotalRank.exam_id == exam_id,
            TotalRank.student_id.in_(student_ids),
        ).all()
    }

    # Get previous exam ranks
    prev_exam = _get_previous_exam(db, exam)
    prev_ranks = {}
    if prev_exam:
        prev_ranks = {
            tr.student_id: tr
            for tr in db.query(TotalRank).filter(
                TotalRank.exam_id == prev_exam.id,
                TotalRank.student_id.in_(student_ids),
            ).all()
        }

    # Build response
    items = []
    for s in students:
        subj_scores = student_scores.get(s.id, {})
        curr_rank = current_ranks.get(s.id)
        prev_rank = prev_ranks.get(s.id)

        items.append(ScoreItemResponse(
            student_id=s.id,
            student_no=s.student_no,
            student_name=s.name,
            class_name=class_map.get(s.class_id, ""),
            subjects=subj_scores,
            total_score=curr_rank.total_score if curr_rank else sum(subj_scores.values()),
            rank_class=curr_rank.rank_class if curr_rank else None,
            rank_grade=curr_rank.rank_grade if curr_rank else None,
            prev_total_score=prev_rank.total_score if prev_rank else None,
            prev_rank_class=prev_rank.rank_class if prev_rank else None,
            prev_rank_grade=prev_rank.rank_grade if prev_rank else None,
            rank_class_change=_rank_change_str(
                curr_rank.rank_class if curr_rank else None,
                prev_rank.rank_class if prev_rank else None,
            ),
            rank_grade_change=_rank_change_str(
                curr_rank.rank_grade if curr_rank else None,
                prev_rank.rank_grade if prev_rank else None,
            ),
        ))

    return ScorePaginatedResponse(items=items, total=total, page=page, page_size=page_size)


@router.post("", status_code=status.HTTP_201_CREATED)
def create_score(
    req: ScoreCreate,
    current_user: User = Depends(require_teacher_or_admin),
    db: Session = Depends(get_db),
):
    # Validate references
    student = db.query(Student).filter(Student.id == req.student_id).first()
    if not student:
        raise HTTPException(status_code=400, detail="学生不存在")
    accessible = get_accessible_class_ids(current_user, db)
    if accessible is not None and student.class_id not in accessible:
        raise HTTPException(status_code=403, detail="无权操作该学生")
    if not db.query(Exam).filter(Exam.id == req.exam_id).first():
        raise HTTPException(status_code=400, detail="考试不存在")
    if not db.query(Subject).filter(Subject.id == req.subject_id).first():
        raise HTTPException(status_code=400, detail="科目不存在")

    existing = db.query(Score).filter(
        Score.student_id == req.student_id,
        Score.exam_id == req.exam_id,
        Score.subject_id == req.subject_id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="该学生此科目成绩已录入")

    score = Score(
        student_id=req.student_id,
        exam_id=req.exam_id,
        subject_id=req.subject_id,
        score=req.score,
    )
    db.add(score)
    db.flush()
    recalculate_ranks(db, req.exam_id)
    db.commit()
    return {"id": score.id, "message": "成绩录入成功"}


@router.put("/upsert")
def upsert_score(
    req: ScoreCreate,
    current_user: User = Depends(require_teacher_or_admin),
    db: Session = Depends(get_db),
):
    """Create or update a score record."""
    student = db.query(Student).filter(Student.id == req.student_id).first()
    if not student:
        raise HTTPException(status_code=400, detail="学生不存在")
    accessible = get_accessible_class_ids(current_user, db)
    if accessible is not None and student.class_id not in accessible:
        raise HTTPException(status_code=403, detail="无权操作该学生")
    if not db.query(Exam).filter(Exam.id == req.exam_id).first():
        raise HTTPException(status_code=400, detail="考试不存在")
    if not db.query(Subject).filter(Subject.id == req.subject_id).first():
        raise HTTPException(status_code=400, detail="科目不存在")

    existing = db.query(Score).filter(
        Score.student_id == req.student_id,
        Score.exam_id == req.exam_id,
        Score.subject_id == req.subject_id,
    ).first()

    if existing:
        existing.score = req.score
    else:
        score = Score(
            student_id=req.student_id,
            exam_id=req.exam_id,
            subject_id=req.subject_id,
            score=req.score,
        )
        db.add(score)

    db.flush()
    recalculate_ranks(db, req.exam_id)
    db.commit()
    return {"message": "成绩保存成功"}


@router.put("/{score_id}")
def update_score(
    score_id: int,
    req: ScoreUpdate,
    current_user: User = Depends(require_teacher_or_admin),
    db: Session = Depends(get_db),
):
    score = db.query(Score).filter(Score.id == score_id).first()
    if not score:
        raise HTTPException(status_code=404, detail="成绩记录不存在")
    student = db.query(Student).filter(Student.id == score.student_id).first()
    accessible = get_accessible_class_ids(current_user, db)
    if accessible is not None and student and student.class_id not in accessible:
        raise HTTPException(status_code=403, detail="无权操作该成绩")

    score.score = req.score
    db.flush()
    recalculate_ranks(db, score.exam_id)
    db.commit()
    return {"message": "成绩修改成功"}


@router.delete("/by-student", status_code=status.HTTP_204_NO_CONTENT)
def delete_scores_by_student(
    exam_id: int = Query(...),
    student_id: int = Query(...),
    current_user: User = Depends(require_teacher_or_admin),
    db: Session = Depends(get_db),
):
    """Delete all scores for a specific student in a specific exam."""
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="学生不存在")

    accessible = get_accessible_class_ids(current_user, db)
    if accessible is not None and student.class_id not in accessible:
        raise HTTPException(status_code=403, detail="无权操作该学生")

    scores = db.query(Score).filter(
        Score.exam_id == exam_id,
        Score.student_id == student_id,
    ).all()

    for score in scores:
        db.delete(score)

    # Also delete TotalRank
    total_rank = db.query(TotalRank).filter(
        TotalRank.exam_id == exam_id,
        TotalRank.student_id == student_id,
    ).first()
    if total_rank:
        db.delete(total_rank)

    db.flush()
    recalculate_ranks(db, exam_id)
    db.commit()


@router.delete("/{score_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_score(
    score_id: int,
    _: User = Depends(require_teacher_or_admin),
    db: Session = Depends(get_db),
):
    score = db.query(Score).filter(Score.id == score_id).first()
    if not score:
        raise HTTPException(status_code=404, detail="成绩记录不存在")
    exam_id = score.exam_id
    db.delete(score)
    db.flush()
    recalculate_ranks(db, exam_id)
    db.commit()


@router.post("/batch-by-students/delete")
def batch_delete_scores_by_students(
    req: BatchDeleteScoresRequest,
    current_user: User = Depends(require_teacher_or_admin),
    db: Session = Depends(get_db),
):
    """Batch delete scores for multiple students in a specific exam."""
    if not req.student_ids:
        raise HTTPException(status_code=400, detail="请提供 student_ids")

    accessible = get_accessible_class_ids(current_user, db)
    students = db.query(Student).filter(Student.id.in_(req.student_ids)).all()

    deleted_count = 0
    for student in students:
        if accessible is not None and student.class_id not in accessible:
            continue

        scores = db.query(Score).filter(
            Score.exam_id == req.exam_id,
            Score.student_id == student.id,
        ).all()

        for score in scores:
            db.delete(score)
            deleted_count += 1

        # Also delete TotalRank
        total_rank = db.query(TotalRank).filter(
            TotalRank.exam_id == req.exam_id,
            TotalRank.student_id == student.id,
        ).first()
        if total_rank:
            db.delete(total_rank)

    db.flush()
    recalculate_ranks(db, req.exam_id)
    db.commit()

    return {"deleted_count": deleted_count}


@router.get("/template")
def download_score_template(
    _: User = Depends(require_teacher_or_admin),
    db: Session = Depends(get_db),
):
    subjects = _sort_subjects(db.query(Subject).all())
    wb = Workbook()
    ws = wb.active
    ws.title = "成绩导入模板"
    headers = ["学号", "班级", "姓名"]
    for subj in subjects:
        header = subj.name
        if subj.name in REQUIRED_SUBJECTS:
            header += "(必填)"
        headers.append(header)
    ws.append(headers)

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=score_template.xlsx"},
    )


@router.get("/export")
def export_scores(
    exam_id: int,
    class_id: int | None = None,
    current_user: User = Depends(require_teacher_or_admin),
    db: Session = Depends(get_db),
):
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="考试不存在")

    accessible = get_accessible_class_ids(current_user, db)
    subjects = _sort_subjects(db.query(Subject).all())
    subject_map = {s.id: s.name for s in subjects}
    class_map = {c.id: c.name for c in db.query(Class).all()}

    # Get students with scores
    score_query = db.query(Score).filter(Score.exam_id == exam_id)
    student_ids = [r[0] for r in score_query.with_entities(Score.student_id).distinct().all()]

    student_query = db.query(Student).filter(Student.id.in_(student_ids))
    if class_id:
        student_query = student_query.filter(Student.class_id == class_id)
    elif accessible is not None:
        student_query = student_query.filter(Student.class_id.in_(accessible))

    students = student_query.all()
    sid_list = [s.id for s in students]

    scores = db.query(Score).filter(Score.exam_id == exam_id, Score.student_id.in_(sid_list)).all()
    ranks = {
        tr.student_id: tr
        for tr in db.query(TotalRank).filter(TotalRank.exam_id == exam_id, TotalRank.student_id.in_(sid_list)).all()
    }

    # Group scores
    student_scores = {}
    for sc in scores:
        if sc.student_id not in student_scores:
            student_scores[sc.student_id] = {}
        student_scores[sc.student_id][sc.subject_id] = sc.score

    wb = Workbook()
    ws = wb.active
    ws.title = f"{exam.name} 成绩"
    headers = ["学号", "姓名", "班级"]
    for subj in subjects:
        headers.append(subj.name)
    headers.extend(["总分", "班级排名", "年级排名"])
    ws.append(headers)

    for s in students:
        row = [s.student_no, s.name, class_map.get(s.class_id, "")]
        ss = student_scores.get(s.id, {})
        for subj in subjects:
            row.append(ss.get(subj.id, ""))
        rank = ranks.get(s.id)
        row.append(rank.total_score if rank else "")
        row.append(rank.rank_class if rank else "")
        row.append(rank.rank_grade if rank else "")
        ws.append(row)

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=scores_{exam_id}.xlsx"},
    )


@router.post("/import")
def import_scores(
    exam_id: int = Query(..., description="考试ID"),
    file: UploadFile = File(...),
    current_user: User = Depends(require_teacher_or_admin),
    db: Session = Depends(get_db),
):
    if not file.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="请上传 Excel 文件")

    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=400, detail="考试不存在")

    # Build lookup maps
    student_map = {s.student_no: s for s in db.query(Student).all()}
    subject_map = {s.name: s for s in db.query(Subject).all()}
    # Also match headers with "(必填)" suffix stripped
    for s in db.query(Subject).all():
        subject_map[s.name + "(必填)"] = s

    wb = load_workbook(file.file)
    ws = wb.active
    headers = [cell.value for cell in ws[1]]

    # Detect rank columns (班级排名/年级排名)
    rank_class_col = None
    rank_grade_col = None
    for i, h in enumerate(headers):
        if h and "班级排名" in str(h):
            rank_class_col = i
        if h and "年级排名" in str(h):
            rank_grade_col = i

    # Headers: 学号, 班级, 姓名, 科目1, 科目2, ...
    # Skip columns 0 (学号), 1 (班级), 2 (姓名), match subjects from column 3+
    subject_cols = []
    for i, h in enumerate(headers):
        if i >= 3 and h and h.replace("(必填)", "") in subject_map:
            clean_name = h.replace("(必填)", "")
            subject_cols.append((i, subject_map[clean_name]))

    rows = list(ws.iter_rows(min_row=2, values_only=True))
    success_count = 0
    errors = []
    # Track students with explicit ranks from Excel
    students_with_explicit_ranks = {}

    for idx, row in enumerate(rows, start=2):
        try:
            if not row or not row[0]:
                continue
            student_no = str(row[0]).strip()

            if student_no not in student_map:
                errors.append({"row": idx, "error": f"学号 '{student_no}' 不存在"})
                continue

            student = student_map[student_no]

            # Check required subjects have values
            missing_required = []
            for col_idx, subject in subject_cols:
                if subject.name in REQUIRED_SUBJECTS:
                    if col_idx >= len(row) or row[col_idx] is None or str(row[col_idx]).strip() == "":
                        missing_required.append(subject.name)
            if missing_required:
                errors.append({"row": idx, "error": f"必填科目缺少成绩: {', '.join(missing_required)}"})
                continue

            for col_idx, subject in subject_cols:
                if col_idx < len(row) and row[col_idx] is not None and str(row[col_idx]).strip() != "":
                    try:
                        score_val = float(row[col_idx])
                    except (ValueError, TypeError):
                        errors.append({"row": idx, "error": f"科目 '{subject.name}' 分数格式错误"})
                        continue

                    existing = db.query(Score).filter(
                        Score.student_id == student.id,
                        Score.exam_id == exam.id,
                        Score.subject_id == subject.id,
                    ).first()
                    if existing:
                        existing.score = score_val
                    else:
                        db.add(Score(
                            student_id=student.id,
                            exam_id=exam.id,
                            subject_id=subject.id,
                            score=score_val,
                        ))

            # Check for explicit rank values
            explicit_rank_class = None
            explicit_rank_grade = None
            if rank_class_col is not None and rank_class_col < len(row) and row[rank_class_col]:
                try:
                    explicit_rank_class = int(row[rank_class_col])
                except (ValueError, TypeError):
                    pass
            if rank_grade_col is not None and rank_grade_col < len(row) and row[rank_grade_col]:
                try:
                    explicit_rank_grade = int(row[rank_grade_col])
                except (ValueError, TypeError):
                    pass

            if explicit_rank_class is not None or explicit_rank_grade is not None:
                students_with_explicit_ranks[student.id] = {
                    "rank_class": explicit_rank_class,
                    "rank_grade": explicit_rank_grade,
                }

            success_count += 1
        except Exception as e:
            errors.append({"row": idx, "error": str(e)})

    db.flush()

    # If all imported students have explicit ranks, use them; otherwise recalculate
    if students_with_explicit_ranks and len(students_with_explicit_ranks) == success_count:
        # Use explicit ranks - update TotalRank directly
        for student_id, ranks in students_with_explicit_ranks.items():
            # Calculate total score for this student
            scores = db.query(Score).filter(
                Score.exam_id == exam_id,
                Score.student_id == student_id,
            ).all()
            total_score = sum(s.score for s in scores)

            existing_rank = db.query(TotalRank).filter(
                TotalRank.exam_id == exam_id,
                TotalRank.student_id == student_id,
            ).first()
            if existing_rank:
                existing_rank.total_score = total_score
                if ranks["rank_class"] is not None:
                    existing_rank.rank_class = ranks["rank_class"]
                if ranks["rank_grade"] is not None:
                    existing_rank.rank_grade = ranks["rank_grade"]
            else:
                db.add(TotalRank(
                    exam_id=exam_id,
                    student_id=student_id,
                    total_score=total_score,
                    rank_class=ranks["rank_class"],
                    rank_grade=ranks["rank_grade"],
                ))
    else:
        # Recalculate ranks as before
        recalculate_ranks(db, exam_id)

    db.commit()

    return {"success_count": success_count, "error_count": len(errors), "errors": errors}
