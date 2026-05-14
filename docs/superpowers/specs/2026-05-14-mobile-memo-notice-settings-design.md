# Mobile Memo, Notice, and Notification Settings Design

## Goal

Build a first-phase mobile productivity loop for teachers and school admins: mobile memo CRUD connected to the existing web backend, Android local reminders for memo due dates, notification settings in profile, and an in-app school notice system with local alerts.

## Scope

Included in phase 1:
- Mobile memo create, edit, delete, list refresh using existing `/api/memos` backend.
- Android local notifications for pending memos with due dates.
- Profile notification settings with three toggles: memo reminders, school notice reminders, sound and vibration.
- New school notice backend and mobile UI.
- School admin can create, edit, delete, and send notices to teachers by audience scope.
- Teacher can read notices and update read state.
- App-local alerts for newly fetched unread school notices.

Not included in phase 1:
- Remote push delivery when app is fully offline.
- Reply threads, acknowledgment workflow, or comments.
- Cross-device sync for notification settings.
- A unified global message center.

## Product Decisions

### Memo UX
- Keep memo as a dedicated page in the timetable global menu.
- Add a FAB for creating a memo.
- Use one form page for both create and edit.
- Edit and delete actions live on the form/detail page, not crowded into the list card.
- Only pending memos with a due date schedule a reminder.
- Reminder time is fixed to 08:00 on the due date in phase 1.

### Notification Settings
- Entry remains under `我的 -> 通知设置`.
- Three settings only:
  - memo reminders
  - school notice reminders
  - sound and vibration
- Store settings locally in shared preferences in phase 1.
- On Android 13+, request notification permission before scheduling/showing notifications.

### School Notices
- Add `校内通知` to the global left menu.
- Teacher role: list + detail, read only.
- School admin role: management list + form + detail.
- Audience scopes supported:
  - all teachers
  - single teacher
  - multiple teachers
  - by grade
  - by class
- Teacher read state is tracked per recipient.
- First phase alerts are local notifications triggered when the app fetches newly unread notices.

## Backend Design

### New Models
- `SchoolNotice`
  - id
  - school_id
  - title
  - content
  - created_by
  - status (`draft`, `sent`)
  - sent_at nullable
  - created_at
  - updated_at
- `SchoolNoticeAudience`
  - id
  - notice_id
  - audience_type (`all_teachers`, `teacher`, `grade`, `class`)
  - target_id nullable
  - target_label nullable
- `SchoolNoticeRecipient`
  - id
  - notice_id
  - teacher_id
  - is_read
  - read_at nullable
  - created_at

### API
- Admin / school admin:
  - `GET /api/school-notices/manage`
  - `POST /api/school-notices/`
  - `PUT /api/school-notices/{id}`
  - `DELETE /api/school-notices/{id}`
  - `POST /api/school-notices/{id}/send`
  - `GET /api/school-notices/{id}`
- Teacher / admin-visible inbox:
  - `GET /api/school-notices/inbox`
  - `GET /api/school-notices/inbox/{id}`
  - `PATCH /api/school-notices/inbox/{id}/read`

### Audience Expansion Rules
- `all_teachers`: all teacher users within the same school.
- `teacher`: direct target by user id.
- `grade`: all teachers bound to classes in that grade through `teacher_classes`.
- `class`: all teachers bound to that class.
- Multiple audiences are unioned and deduplicated.

### Security
- School admin can only operate on notices within their school.
- Teacher can only view recipient rows addressed to themselves.
- Notice creation/update validates target ownership to the same school.
- No raw SQL; use SQLAlchemy filtering.

## Mobile Design

### New Pages
- `TimetableMemoEditorPage`
- `NotificationSettingsPage`
- `SchoolNoticeListPage`
- `SchoolNoticeEditorPage`
- `SchoolNoticeDetailPage`

### Memo Flow
- List page fetches all pending memos for current user.
- FAB opens create page.
- Tap memo card opens edit page.
- Save invalidates memo provider.
- Delete confirms then invalidates memo provider.
- After memo list changes, reschedule memo reminders from current pending items.

### Notice Flow
- Global menu entry opens school notice list.
- Teacher sees inbox grouped by unread/read ordering.
- Admin sees a segmented control for sent and draft notices.
- Admin can create draft, edit draft/sent notice content in phase 1, and delete notice.
- Sending expands recipients on backend and marks notice as sent.
- Opening teacher detail page marks as read.
- Newly fetched unread notices compared against locally seen ids; if unseen and reminders enabled, fire local notification.

### Local Notification Service
- Single mobile notification service wrapper.
- Responsibilities:
  - initialize plugin
  - request Android notification permission when needed
  - create channels honoring sound/vibration preference
  - schedule memo due reminders
  - cancel memo reminders
  - show immediate local school notice alerts
- Persist seen school notice ids locally to avoid duplicate alerts every refresh.

## Testing Strategy

Backend:
- notice audience expansion tests
- notice CRUD permission tests
- teacher inbox visibility tests
- mark-read tests

Mobile:
- memo repository/provider CRUD tests
- notification settings persistence tests
- school notice page role tests
- local notification scheduler tests with fake service

## Delivery Check
- tests pass
- Android debug APK rebuilt
- emulator app reinstalled and launched
- manual validation paths:
  - create/edit/delete memo
  - toggle notification settings
  - admin sends school notice
  - teacher sees notice and unread becomes read
  - memo due reminder and school notice local alert behavior
