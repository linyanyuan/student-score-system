# Mobile Memo, Notice, and Notification Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver mobile memo CRUD, Android local reminders, notification settings, and first-phase school notices for teachers and school admins.

**Architecture:** Reuse the existing memo backend, add a new school notice backend module with explicit recipient expansion, and add a lightweight mobile notification service that handles both memo reminders and in-app school notice alerts. Keep settings local on device in phase 1.

**Tech Stack:** FastAPI, SQLAlchemy, Flutter, Riverpod, Dio, SharedPreferences, Android local notifications

---

## File Map

Backend:
- Create: `backend/app/models/school_notice.py`
- Create: `backend/app/models/school_notice_audience.py`
- Create: `backend/app/models/school_notice_recipient.py`
- Create: `backend/app/schemas/school_notice.py`
- Create: `backend/app/routers/school_notices.py`
- Create: `backend/alembic/versions/20260514_add_school_notice_tables.py`
- Modify: `backend/app/models/__init__.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_school_notices_api.py`

Mobile:
- Modify: `student-score-mobile/pubspec.yaml`
- Modify: `student-score-mobile/lib/data/models.dart`
- Modify: `student-score-mobile/lib/data/services/api_service.dart`
- Modify: `student-score-mobile/lib/data/services/dio_api_service.dart`
- Modify: `student-score-mobile/lib/data/services/mock_api_service.dart`
- Modify: `student-score-mobile/lib/data/repositories/repositories.dart`
- Modify: `student-score-mobile/lib/application/providers.dart`
- Modify: `student-score-mobile/lib/app/router.dart`
- Modify: `student-score-mobile/lib/main.dart`
- Modify: `student-score-mobile/lib/presentation/profile/profile_page.dart`
- Modify: `student-score-mobile/lib/presentation/timetable/timetable_memo_page.dart`
- Modify: `student-score-mobile/lib/presentation/timetable/timetable_menu_sheet.dart`
- Create: `student-score-mobile/lib/core/notifications/local_notification_service.dart`
- Create: `student-score-mobile/lib/core/notifications/notification_preferences_store.dart`
- Create: `student-score-mobile/lib/presentation/profile/notification_settings_page.dart`
- Create: `student-score-mobile/lib/presentation/timetable/timetable_memo_editor_page.dart`
- Create: `student-score-mobile/lib/presentation/notice/school_notice_list_page.dart`
- Create: `student-score-mobile/lib/presentation/notice/school_notice_detail_page.dart`
- Create: `student-score-mobile/lib/presentation/notice/school_notice_editor_page.dart`
- Modify: `student-score-mobile/android/app/src/main/AndroidManifest.xml`
- Test: `student-score-mobile/test/notice_and_notification_test.dart`
- Test: `student-score-mobile/test/timetable_provider_test.dart`
- Test: `student-score-mobile/test/models_contract_test.dart`

## Tasks

### Task 1: Backend school notice data model and API
- [ ] Add failing backend tests for notice CRUD, audience expansion, inbox visibility, and mark-read.
- [ ] Create school notice models and schemas with school scoping.
- [ ] Implement router endpoints and recipient expansion logic.
- [ ] Register models/router in app startup.
- [ ] Run focused backend tests.

### Task 2: Mobile data contracts and repositories
- [ ] Add failing mobile contract tests for notice models and notification settings serialization.
- [ ] Extend API service, Dio service, mock service, and repositories for memo CRUD and school notice APIs.
- [ ] Add Riverpod providers for memo mutations, notice lists, notice management, and notification settings state.
- [ ] Run focused mobile tests.

### Task 3: Memo CRUD and notification settings UI
- [ ] Add failing widget tests for memo create/edit/delete entry points and notification settings page.
- [ ] Implement memo editor page and wire it from memo list FAB + card tap.
- [ ] Implement profile notification settings page and route.
- [ ] Refresh providers after successful memo mutations.
- [ ] Run focused widget tests.

### Task 4: School notice UI
- [ ] Add failing widget tests for teacher/admin notice list states.
- [ ] Implement school notice list/detail/editor pages and global menu entry.
- [ ] Respect role-based UI: teacher read-only, admin manage/send.
- [ ] Run focused widget tests.

### Task 5: Local notification service integration
- [ ] Add failing unit tests for memo scheduling and notice dedupe alert logic.
- [ ] Add local notification service and local settings store.
- [ ] Initialize notification service at app startup.
- [ ] Schedule memo reminders after memo refresh/mutation.
- [ ] Show local alert for newly fetched unread school notices when enabled.
- [ ] Update Android manifest/permissions.
- [ ] Run focused tests.

### Task 6: End-to-end verification
- [ ] Run focused backend test suite.
- [ ] Run focused Flutter tests.
- [ ] Build debug APK.
- [ ] Reinstall APK on emulator and launch app.
- [ ] Smoke-test memo CRUD, notice settings, and school notice flows.
