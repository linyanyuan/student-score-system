# Existing Timetable Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first usable slice of “上传已有课表”: Excel import, teacher auto-match, review/fix items, draft generation, and a front-end upload wizard.

**Architecture:** Add persisted import tasks/items under the existing scheduling module, then convert valid reviewed import items into existing `schedule_drafts` and `schedule_draft_items`. First version only supports Excel files; non-Excel uploads are rejected.

**Tech Stack:** FastAPI, SQLAlchemy, Alembic, openpyxl, React 19, Ant Design 6, existing schedule draft/publish APIs.

---

## File Structure

- Create: `backend/app/models/schedule_import.py` — import task metadata.
- Create: `backend/app/models/schedule_import_item.py` — recognized/reviewable timetable slots.
- Modify: `backend/app/models/__init__.py` — include new models for `Base.metadata.create_all`.
- Modify: `backend/app/schemas/scheduling.py` — import task/item response schemas.
- Create: `backend/app/services/scheduling/import_service.py` — Excel parsing, subject normalization, teacher matching, draft creation.
- Modify: `backend/app/routers/scheduling.py` — import endpoints.
- Create: `backend/alembic/versions/c9f0a4d1b2e3_add_schedule_import_tables.py` — import tables migration.
- Create: `backend/tests/test_schedule_import_api.py` — API behavior tests.
- Modify: `frontend/src/api/scheduling.js` — import API wrappers.
- Modify: `frontend/src/pages/scheduleManageUtils.js` — small pure helpers for import summaries/status.
- Modify: `frontend/src/pages/scheduleManageUtils.test.mjs` — helper tests.
- Modify: `frontend/src/pages/ScheduleManage.jsx` — upload wizard and review UI.

## Scope Boundaries

- Excel first: parse simple sheets where the first row contains weekdays and the first column contains period names or numbers.
- Subject recognition first: cell text may be just `数学` or `数学/王老师`; teacher text is optional.
- Teacher matching happens on the backend using `TeacherClassSubject`.
- Images return a clear unsupported task failure in this slice.
- No drag-and-drop timetable editor, image recognition, batch replace, or arbitrary Excel mapping builder.

### Task 1: Backend Import Models And Schemas

**Files:**
- Create: `backend/app/models/schedule_import.py`
- Create: `backend/app/models/schedule_import_item.py`
- Modify: `backend/app/models/__init__.py`
- Modify: `backend/app/schemas/scheduling.py`
- Create: `backend/alembic/versions/c9f0a4d1b2e3_add_schedule_import_tables.py`
- Test: `backend/tests/test_schedule_import_api.py`

- [ ] **Step 1: Write failing schema/model API test**

Create `backend/tests/test_schedule_import_api.py` with a TestClient setup like `test_scheduling_config_api.py`. Add a test that calls `GET /api/schedule/imports/999` and expects `404`, proving the endpoint does not exist yet.

- [ ] **Step 2: Verify RED**

Run: `python -m unittest backend.tests.test_schedule_import_api -v`

Expected: FAIL or ERROR because the route/model is missing.

- [ ] **Step 3: Add models and schemas**

Add `ScheduleImport` fields: `id`, `school_id`, `grade`, `scope`, `class_id`, `source_type`, `status`, `message`, `error`, `summary`, `created_by`, timestamps.

Add `ScheduleImportItem` fields: `id`, `import_id`, `class_id`, `weekday`, `period_id`, nullable `subject_id`, `recognized_subject_name`, nullable `teacher_id`, `teacher_match_status`, `teacher_match_source`, `teacher_candidates`, `confidence`, `issue_flags`, `is_empty`, `created_at`, `updated_at`.

Add Pydantic response/update schemas for import tasks and import items.

- [ ] **Step 4: Add migration**

Create `schedule_imports` and `schedule_import_items` tables with foreign keys to school, class, period, subject, teacher, and user tables.

- [ ] **Step 5: Add minimal GET endpoint**

Add `GET /api/schedule/imports/{import_id}` returning 404 for missing rows and scoped to the current school admin.

- [ ] **Step 6: Verify GREEN**

Run: `python -m unittest backend.tests.test_schedule_import_api -v`

Expected: PASS for the 404 route existence behavior.

### Task 2: Excel Import And Teacher Matching

**Files:**
- Modify: `backend/tests/test_schedule_import_api.py`
- Create: `backend/app/services/scheduling/import_service.py`
- Modify: `backend/app/routers/scheduling.py`

- [ ] **Step 1: Write failing upload test**

Add a test that uploads a small `.xlsx` with headers `节次, 周一`, one row `第1节, 数学`, and existing data for class, subject, period, and `TeacherClassSubject`. Assert `POST /api/schedule/imports` returns `201`, status `needs_review`, summary counts, and one item with matched teacher.

- [ ] **Step 2: Verify RED**

Run: `python -m unittest backend.tests.test_schedule_import_api.ScheduleImportApiTests.test_excel_import_matches_teacher_from_arrangement -v`

Expected: FAIL because upload endpoint/service does not exist.

- [ ] **Step 3: Implement import service**

Use `openpyxl.load_workbook` on `UploadFile.file`, never save user files to disk. Validate extension and content type defensively. Parse only simple weekday header sheets.

Match class by selected `class_id` for single-class imports. For grade imports in this first slice, parse against the first grade class only unless class headers are present; keep UI defaulting to single-class for reliable tests.

Normalize subject by exact subject name within school. Match teacher through `TeacherClassSubject` for `(school_id, class_id, subject_id)`.

- [ ] **Step 4: Implement POST import endpoint**

Use multipart form fields: `grade`, `scope`, optional `class_id`, and `file`. Only `school_admin` can call it. Reject non-Excel extensions with a clear validation message.

- [ ] **Step 5: Verify GREEN**

Run: `python -m unittest backend.tests.test_schedule_import_api -v`

Expected: PASS.

### Task 3: Review, Patch, And Draft Creation

**Files:**
- Modify: `backend/tests/test_schedule_import_api.py`
- Modify: `backend/app/services/scheduling/import_service.py`
- Modify: `backend/app/routers/scheduling.py`

- [ ] **Step 1: Write failing review/draft test**

Add a test that patches an import item teacher, then calls `POST /api/schedule/imports/{import_id}/draft`, and asserts a `schedule_drafts` row plus `schedule_draft_items` row exists.

- [ ] **Step 2: Verify RED**

Run: `python -m unittest backend.tests.test_schedule_import_api.ScheduleImportApiTests.test_patch_item_and_create_draft -v`

Expected: FAIL because patch/draft endpoints do not exist.

- [ ] **Step 3: Implement item list and patch endpoints**

Add:
- `GET /api/schedule/imports/{import_id}/items`
- `PATCH /api/schedule/imports/{import_id}/items/{item_id}`

Patch accepts `subject_id`, `teacher_id`, and `is_empty`. Recompute issue flags and summary after patch.

- [ ] **Step 4: Implement draft creation endpoint**

Add `POST /api/schedule/imports/{import_id}/draft`. Reject imports with unrecognized subject or unmatched teacher unless item is empty. Create `ScheduleDraft` with diagnostics showing source `schedule_import`, then `ScheduleDraftItem` rows. Mark import `draft_created`.

- [ ] **Step 5: Verify GREEN**

Run: `python -m unittest backend.tests.test_schedule_import_api -v`

Expected: PASS.

### Task 4: Frontend API And Pure Helpers

**Files:**
- Modify: `frontend/src/api/scheduling.js`
- Modify: `frontend/src/pages/scheduleManageUtils.js`
- Modify: `frontend/src/pages/scheduleManageUtils.test.mjs`

- [ ] **Step 1: Write failing helper/API tests**

Add assertions for `summarizeImportIssues` and `canCreateImportDraft`. Add source checks for new API wrapper paths.

- [ ] **Step 2: Verify RED**

Run: `node frontend/src/pages/scheduleManageUtils.test.mjs`

Expected: FAIL because helpers/API wrappers are missing.

- [ ] **Step 3: Implement helpers and API wrappers**

Add wrappers for create import, get import, get import items, patch import item, and create import draft. Implement pure helpers for status counts and draft button enablement.

- [ ] **Step 4: Verify GREEN**

Run: `node frontend/src/pages/scheduleManageUtils.test.mjs`

Expected: PASS.

### Task 5: Frontend Import Wizard

**Files:**
- Modify: `frontend/src/pages/ScheduleManage.jsx`
- Test: `frontend/src/pages/scheduleManageUtils.test.mjs`

- [ ] **Step 1: Write failing content smoke test**

Add a simple source-content assertion that `ScheduleManage.jsx` contains `上传已有课表`, `待确认草案`, and `正式课表尚未变更`.

- [ ] **Step 2: Verify RED**

Run: `node frontend/src/pages/scheduleManageUtils.test.mjs`

Expected: FAIL because UI content is missing.

- [ ] **Step 3: Implement wizard UI**

Add imports for `Modal`, `Steps`, `Upload`, `Drawer`, and upload icons. Add state for wizard open/current step/import task/items/file/review editor. Implement single-class and grade scope controls, upload step, review table, item patching, and draft creation success.

Keep visual style aligned with current schedule workbench. Use Ant Design components; no `dangerouslySetInnerHTML`; render server strings as text only.

- [ ] **Step 4: Verify GREEN**

Run: `node frontend/src/pages/scheduleManageUtils.test.mjs`

Expected: PASS.

### Task 6: Final Verification

**Files:**
- All changed files.

- [ ] **Step 1: Backend targeted tests**

Run: `python -m unittest backend.tests.test_schedule_import_api -v`

Expected: PASS.

- [ ] **Step 2: Frontend helper tests**

Run: `node frontend/src/pages/scheduleManageUtils.test.mjs`

Expected: PASS.

- [ ] **Step 3: Build or lint if available**

Run: `npm run build` from `frontend`.

Expected: exit 0.

- [ ] **Step 4: Git review**

Run: `git diff --stat` and `git status --short --branch`.

Expected: only planned files changed.
