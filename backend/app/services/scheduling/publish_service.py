from __future__ import annotations

from datetime import datetime

from sqlalchemy.orm import Session

from app.models.class_timetable import ClassTimetable
from app.models.schedule_draft import ScheduleDraft
from app.models.schedule_draft_item import ScheduleDraftItem


def publish_draft(db: Session, draft: ScheduleDraft) -> int:
    rows = db.query(ScheduleDraftItem).filter(ScheduleDraftItem.draft_id == draft.id).all()
    class_ids = sorted({row.class_id for row in rows})
    db.query(ClassTimetable).filter(
        ClassTimetable.school_id == draft.school_id,
        ClassTimetable.class_id.in_(class_ids),
    ).delete(synchronize_session=False)
    for row in rows:
        db.add(
            ClassTimetable(
                school_id=draft.school_id,
                class_id=row.class_id,
                teacher_id=row.teacher_id,
                subject_id=row.subject_id,
                weekday=row.weekday,
                period_id=row.period_id,
            )
        )
    draft.status = "published"
    draft.published_at = datetime.now()
    db.commit()
    return len(rows)
