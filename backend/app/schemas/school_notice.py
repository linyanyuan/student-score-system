from datetime import datetime

from pydantic import BaseModel, ConfigDict


class SchoolNoticeAudiencePayload(BaseModel):
    audience_type: str
    target_id: int | None = None
    target_label: str | None = None


class SchoolNoticeCreateRequest(BaseModel):
    title: str
    content: str
    audiences: list[SchoolNoticeAudiencePayload]


class SchoolNoticeUpdateRequest(BaseModel):
    title: str | None = None
    content: str | None = None
    audiences: list[SchoolNoticeAudiencePayload] | None = None


class SchoolNoticeAudienceResponse(BaseModel):
    audience_type: str
    target_id: int | None = None
    target_label: str | None = None


class SchoolNoticeSummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    school_id: int
    title: str
    content: str
    created_by: int
    status: str
    sent_at: datetime | None
    created_at: datetime
    updated_at: datetime
    audiences: list[SchoolNoticeAudienceResponse]
    recipient_count: int
    read_count: int


class SchoolNoticeInboxItemResponse(BaseModel):
    id: int
    notice_id: int
    title: str
    content: str
    status: str
    sent_at: datetime | None
    created_at: datetime
    is_read: bool
    read_at: datetime | None

