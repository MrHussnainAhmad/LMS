# Mobile teacher QR attendance

The mobile staff attendance screen opens **QR Scan** for its selected section. Only
the designated class incharge can scan or finalize that section. Existing printed
student ID cards work without regeneration. Public QR verification remains read-only.

`GET /api/staff/attendance/qr?sectionId=123` returns `{ date, total,
presentStudentIds }` for active, non-deleted, non-graduated students. All dates come
from the server in `Asia/Karachi`.

`POST /api/staff/attendance/qr` accepts one of:

```json
{ "action": "scan", "sectionId": 123, "date": "2026-10-27", "qr": "https://nisaab360.app/verify/student?token=..." }
```

```json
{ "action": "finalize", "sectionId": 123, "date": "2026-10-27" }
```

Scans verify the card signature and student creation identity, tenant, active
status and current section. They save PRESENT immediately and upgrade previous
non-present statuses. Already-present scans do not write or invalidate caches.
The response is `{ date, student: { id, name }, alreadyPresent }`.

**All Scanned** confirms and finalizes the selected section. A single bulk upsert
keeps every existing PRESENT record and sets all other eligible students to ABSENT,
including previous LATE/LEAVE records. Repeat finalization does not duplicate
absence notifications. The response is `{ success: true, date, changed }`.
The database's existing student/date unique constraint makes overlapping requests
safe. No schema migration is required.

The server rejects a stale scanner date with HTTP 409; close/reopen the scanner
after midnight. Invalid cards return 400, unavailable/wrong-section students 404,
and unassigned teachers 403. Request bodies are limited to 2 KiB and the existing
authenticated mutation rate limit applies. QR links are never fetched by the API.

Mobile scans serialize requests and suppress repeated camera frames. Camera use
stops in the background; permissions are refreshed on return from Settings. The
camera plugin requests no microphone permission. **expo-camera adds native code**:
include it in the next Android/iOS binary release; an OTA-only update cannot add it.

Verification (no application build, services, production database, or Docker):

- Backend: `npm run verify:qr-attendance` (isolated PGlite API checks).
- Mobile: `npm run verify:qr-attendance` (mocked native interaction checks;
  uses the sibling backend's existing esbuild dependency, entirely in memory).
- Both projects: `tsc --noEmit --incremental false`.

These checks do not replace testing an actual phone camera in a future native release.
