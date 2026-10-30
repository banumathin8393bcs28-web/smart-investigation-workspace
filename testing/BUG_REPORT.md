# Smart Investigation Workspace - Defect & Bug Tracking Report

**File Location:** `testing/BUG_REPORT.md`  
**Audit Date:** October 30, 2026  
**Auditor:** Antigravity Forensic QA & Security Engineering  
**Application:** Smart Investigation Workspace (v1.0.0)

---

## Defect Summary Register

| Bug ID | Module | Severity | Priority | Status | Title |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **BUG-001** | Home & Navigation | High | High | **FIXED** | Intrusive browser Leave/Cancel confirmation dialog on normal link navigation |
| **BUG-002** | Evidence Sharing | Critical | High | **FIXED** | Broken `EvidenceRequest` prototype reference (`getCollection is not a function`) |
| **BUG-003** | Storage & Persistence | Critical | High | **FIXED** | Uploaded evidence and profile images disappearing after server restart / redeployment |
| **BUG-004** | Storage & Persistence | High | High | **FIXED** | GridFS upload stream finish event resolution crash (`TypeError: reading '_id' of undefined`) |
| **BUG-005** | Autopsy Forensics | High | High | **FIXED** | Concurrency version conflict (`VersionError`) in Autopsy ingest background execution |
| **BUG-006** | Chain of Custody | Medium | High | **FIXED** | Ingest custody action enum mismatch (`Evidence Submitted for Analysis` not in enum) |
| **BUG-007** | Security & Auth | High | High | **FIXED** | Back-button browser cache (bfcache) exposing sensitive case data after logout |
| **BUG-008** | Crime Scene | Low | Low | **DOCUMENTED** | Standalone Scene creation form route (`POST /scenes/new`) is not implemented |

---

## Detailed Defect Reports

### BUG-001: Intrusive Browser Leave/Cancel Confirmation Dialog
- **Related Test Case ID:** `TC-NAV-05`
- **Module:** Home Page & Navigation
- **Severity:** High (Degraded UX across all internal links)
- **Priority:** High
- **Steps to Reproduce:**
  1. Log into the application.
  2. Click on any sidebar or header navigation link (e.g., `/cases`, `/evidence`).
  3. Browser displays modal: *"Changes you made may not be saved. Leave site? Cancel / Leave"*.
- **Likely Cause:** `public/js/main.js` unconditionally registered a window `beforeunload` listener inside `initBeforeUnloadWarning()`.
- **Suggested Correction:** Remove `initBeforeUnloadWarning()` and the `window.addEventListener('beforeunload')` listener.
- **Fix Status:** **FIXED**. Function and listener removed completely from `public/js/main.js`.
- **Regression Test:** `TC-NAV-05` executed; verified normal link transitions without prompt.

---

### BUG-002: Broken `EvidenceRequest` Prototype Reference
- **Related Test Case ID:** `TC-REQ-01`
- **Module:** Evidence Requests & Sharing
- **Severity:** Critical (Crashed inter-agency sharing)
- **Priority:** High
- **Steps to Reproduce:**
  1. Access `/evidence/requests`.
  2. Attempt to file or query an evidence request.
  3. Server threw: `TypeError: getCollection is not a function`.
- **Likely Cause:** Legacy prototype implementation referenced a non-existent `getCollection` helper instead of a standard Mongoose Schema model.
- **Suggested Correction:** Replace `models/EvidenceRequest.js` with a standard Mongoose schema containing request metadata, status enum, and timestamps.
- **Fix Status:** **FIXED**. Model rewritten as standard Mongoose schema.
- **Regression Test:** `TC-REQ-01` and `TC-REQ-02` passed; requests file and update cleanly.

---

### BUG-003: Ephemeral File Storage Causing Missing Images Upon Redeployment
- **Related Test Case ID:** `TC-EVD-03`, `TC-PRF-03`
- **Module:** Digital Evidence Management / Storage
- **Severity:** Critical (Evidence loss across server restarts and cloud container redeployments)
- **Priority:** High
- **Steps to Reproduce:**
  1. Upload evidence image or profile photo.
  2. Restart server or redeploy on Render.
  3. Access image URL: image returns 404 or fails to load.
- **Likely Cause:** Files were stored solely in the local ephemeral container filesystem (`private_uploads`) without persistent database storage.
- **Suggested Correction:** Implement a unified storage service abstraction (`services/storageService.js`) using MongoDB GridFS (`evidence_bucket`, `profile_bucket`, `attachments_bucket`) backed by local disk caching.
- **Fix Status:** **FIXED**. Persistent GridFS storage implemented and integrated into all upload routes.
- **Regression Test:** `TC-EVD-03` executed; GridFS save and stream retrieval confirmed intact.

---

### BUG-004: GridFS Upload Stream Finish Event Resolution Crash
- **Related Test Case ID:** `TC-EVD-03`
- **Module:** Digital Evidence Management / Storage
- **Severity:** High (Crash during persistent GridFS upload)
- **Priority:** High
- **Steps to Reproduce:**
  1. Upload a file to GridFS via `saveToStorage()`.
  2. Server crashed with: `TypeError: Cannot read properties of undefined (reading '_id') at GridFSBucketWriteStream.<anonymous> (services/storageService.js:82)`.
- **Likely Cause:** In MongoDB Node.js driver, the `finish` event on `GridFSBucketWriteStream` does not pass the file document argument; the identifier is located directly on `uploadStream.id`.
- **Suggested Correction:** Update line 82 to resolve `uploadStream.id || (uploadStream.gridFSFile && uploadStream.gridFSFile._id)`.
- **Fix Status:** **FIXED**. Resolved in `services/storageService.js`.
- **Regression Test:** `TC-EVD-03` executed; upload and stream retrieval pass.

---

### BUG-005: Concurrency Version Conflict in Autopsy Ingest
- **Related Test Case ID:** `TC-AUT-01`
- **Module:** Autopsy Digital Forensics
- **Severity:** High (Ingest job failure under concurrency)
- **Priority:** High
- **Steps to Reproduce:**
  1. Create an Autopsy job.
  2. When background task and direct worker attempt to update the job document concurrently, Mongoose throws: `VersionError: No matching document found for id ... version 0 modifiedPaths ...`.
- **Likely Cause:** Concurrent callers both read `__v = 0` and attempted optimistic concurrency `job.save()`.
- **Suggested Correction:** Use atomic `findOneAndUpdate({ _id: jobId, status: { $in: ['Queued', 'Running'] } }, ...)` to claim the job, and update final status via atomic `$set` with `findByIdAndUpdate`.
- **Fix Status:** **FIXED**. Atomic claiming and updates implemented in `services/autopsyService.js`.
- **Regression Test:** `TC-AUT-01` executed; job executes and produces findings with zero version faults.

---

### BUG-006: Ingest Custody Action Enum Validation Failure
- **Related Test Case ID:** `TC-CST-01`
- **Module:** Chain of Custody
- **Severity:** Medium (Validation error when logging forensic analysis)
- **Priority:** High
- **Steps to Reproduce:**
  1. Trigger Autopsy analysis for evidence.
  2. Server logs error: `Custody validation failed: action: 'Evidence Submitted for Analysis' is not a valid enum value for path 'action'`.
- **Likely Cause:** `models/Custody.js` schema had a fixed enum list omitting forensic analysis actions.
- **Suggested Correction:** Add `'Evidence Submitted for Analysis'` and `'Analysis Completed'` to the `action` enum in `models/Custody.js`.
- **Fix Status:** **FIXED**. Added both forensic actions to the enum.
- **Regression Test:** `TC-CST-01` and `TC-AUT-01` passed; events logged without validation error.

---

### BUG-007: Back-Button Cache Exposure After Logout
- **Related Test Case ID:** `TC-SEC-01`
- **Module:** Security Testing & Auth
- **Severity:** High (Confidential case information exposed in browser back cache)
- **Priority:** High
- **Steps to Reproduce:**
  1. Log in and open confidential case `/cases/CASE001`.
  2. Click **Sign Out**.
  3. Click the browser **Back** button.
  4. Browser reloaded page from local cache, displaying confidential data.
- **Likely Cause:** Missing `Cache-Control: no-store` HTTP headers on protected routes.
- **Suggested Correction:** Inject `res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private')`, `Pragma: no-cache`, `Expires: 0` in `ensureAuthenticated` middleware.
- **Fix Status:** **FIXED**. Anti-caching headers enforced across all protected routes.
- **Regression Test:** `TC-SEC-01` executed; confirmed anti-caching headers returned.

---

### BUG-008: Standalone Crime Scene Creation Route Not Implemented
- **Related Test Case ID:** `TC-SCN-03`
- **Module:** Crime Scene Management
- **Severity:** Low (Architectural gap)
- **Priority:** Low
- **Description:** `routes/scenes.js` only implements `GET /scenes/:id` for displaying a sector record. There is no route or web form for creating a standalone Scene (`POST /scenes/new`).
- **Operational Reality:** The application manages crime scene locations directly through `Case.crimeSceneAddress` and `Evidence.sceneId`.
- **Fix Status:** **DOCUMENTED / NOT IMPLEMENTED**. Identified as an incomplete standalone submodule; primary case workflows remain fully operational.
