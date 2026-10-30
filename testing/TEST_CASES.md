# Smart Investigation Workspace - Comprehensive Test Cases Specification

**Document Version:** 1.0.0  
**Target Environment:** Local Node.js v24 + MongoDB Community Server / Cloud Render  
**Database Isolation:** Dedicated Test Database (`smart_investigation_test`)  
**Associated Files:** `testing/TEST_INPUTS.md`, `testing/TEST_EXECUTION_REPORT.md`, `testing/BUG_REPORT.md`

---

## Summary of Test Case Status Legend
- **PASS**: The test was executed, and the observed result matched the expected result.
- **FAIL**: The test was executed, and the observed result did not match the expected result.
- **BLOCKED**: The test could not be executed due to an unavailable prerequisite service or hardware.
- **NOT IMPLEMENTED**: The requested feature does not exist in the inspected application codebase.

---

## Module 1: Home Page and Navigation

### TC-NAV-01: Public Welcome Page Load
- **Module:** Home Page & Navigation
- **Test Objective:** Verify that unauthenticated visitors are served the official welcome page at root URL (`/`).
- **Preconditions:** Server running; no active session cookie.
- **Exact Input Values:** HTTP `GET /`
- **Execution Procedure:**
  1. Clear browser cookies / launch clean HTTP agent.
  2. Send GET request to `http://localhost:3198/`.
  3. Inspect HTTP response status, headers, and body title.
- **Expected Output:** HTTP 200; rendered HTML contains `<title>Smart Investigation Workspace</title>` and government branding header.
- **Actual Output:** HTTP 200 rendered Home view with official banner.
- **Status:** PASS
- **Error Details:** None.
- **Severity / Priority:** Low / Low.

### TC-NAV-02: Public Navigation to Login Interface
- **Module:** Home Page & Navigation
- **Test Objective:** Verify that clicking or navigating to `/auth/login` renders the authentication form.
- **Preconditions:** Unauthenticated visitor.
- **Exact Input Values:** HTTP `GET /auth/login`
- **Execution Procedure:**
  1. Request `GET /auth/login`.
  2. Inspect response body for email, password, and CAPTCHA input fields.
- **Expected Output:** HTTP 200; page contains `<form action="/auth/login" method="POST">` with dynamic SVG CAPTCHA challenge.
- **Actual Output:** HTTP 200; login form displayed with CAPTCHA block.
- **Status:** PASS
- **Error Details:** None.
- **Severity / Priority:** High / High.

### TC-NAV-03: Public Navigation to Registration Form
- **Module:** Home Page & Navigation
- **Test Objective:** Verify that `/auth/register` serves the complete investigator registration form.
- **Preconditions:** Unauthenticated visitor.
- **Exact Input Values:** HTTP `GET /auth/register`
- **Execution Procedure:**
  1. Request `GET /auth/register`.
  2. Verify fields for Full Name, Role, DOB, Age, Gender, Phone, Email, Username, Password, Security Question/Answer, and CAPTCHA.
- **Expected Output:** HTTP 200 with complete registration form elements.
- **Actual Output:** HTTP 200 rendered registration form with all required inputs.
- **Status:** PASS
- **Error Details:** None.
- **Severity / Priority:** High / High.

### TC-NAV-04: Handling of Unknown / Invalid Routes (404 Error)
- **Module:** Home Page & Navigation
- **Test Objective:** Verify that non-existent paths return a graceful 404 error page without application crash or stack trace leakage.
- **Preconditions:** Server running.
- **Exact Input Values:** HTTP `GET /nonexistent-forensic-path-999`
- **Execution Procedure:**
  1. Request `GET /nonexistent-forensic-path-999`.
  2. Inspect response status code and body text.
- **Expected Output:** HTTP 404 Not Found; rendered page displays styled error message `"The requested investigation case, evidence artifact, or module does not exist."`.
- **Actual Output:** HTTP 404 rendered `partials/error` gracefully.
- **Status:** PASS
- **Error Details:** None.
- **Severity / Priority:** Medium / Medium.

### TC-NAV-05: Verification of Absence of Intrusive Leave/Cancel Prompts
- **Module:** Home Page & Navigation
- **Test Objective:** Confirm that standard link clicks and page transitions do not fire intrusive browser `beforeunload` dialogs.
- **Preconditions:** Public JavaScript bundle loaded.
- **Exact Input Values:** Source code audit of `public/js/main.js`.
- **Execution Procedure:**
  1. Inspect `public/js/main.js` for `window.addEventListener('beforeunload')` or `initBeforeUnloadWarning`.
  2. Click internal navigation links in browser.
- **Expected Output:** Zero `beforeunload` interceptors; seamless page transitions.
- **Actual Output:** Confirmed absent; navigation occurs immediately without prompt.
- **Status:** PASS
- **Error Details:** None (Previously resolved).
- **Severity / Priority:** High / High.

---

## Module 2: Investigator Registration

### TC-REG-01: Government Email Regex Validation (Valid Format)
- **Module:** Investigator Registration
- **Test Objective:** Verify that official government emails matching `xxx.yyy@gov.in` pass validation.
- **Preconditions:** Validation middleware loaded.
- **Exact Input Values:** `detective.miller@gov.in`, `john.doe.smith@gov.in`
- **Execution Procedure:**
  1. Evaluate string against `GOV_EMAIL_REGEX`.
- **Expected Output:** Returns `true`.
- **Actual Output:** Valid format passed regex evaluation.
- **Status:** PASS
- **Error Details:** None.
- **Severity / Priority:** Critical / High.

### TC-REG-02: Non-Government Email Rejection
- **Module:** Investigator Registration
- **Test Objective:** Verify that commercial or non-gov email addresses are rejected.
- **Preconditions:** Validation middleware loaded.
- **Exact Input Values:** `officer@gmail.com`, `detective@gov.org`, `miller@gov.in` (missing dot prefix).
- **Execution Procedure:**
  1. Test strings against `GOV_EMAIL_REGEX`.
- **Expected Output:** All non-conforming formats return `false`.
- **Actual Output:** Non-gov domains and single-term handles successfully rejected.
- **Status:** PASS
- **Error Details:** None.
- **Severity / Priority:** Critical / High.

### TC-REG-03: Password Complexity Rules
- **Module:** Investigator Registration
- **Test Objective:** Enforce minimum 8 characters with at least one uppercase, one lowercase, one digit, and one special character.
- **Preconditions:** Validation middleware loaded.
- **Exact Input Values:**
  - Valid: `Forensic@Gov2026!`
  - Invalid: `password123`, `NoSpecial1234`, `Short1!`
- **Execution Procedure:**
  1. Evaluate test passwords against `PASSWORD_REGEX`.
- **Expected Output:** Only complex passwords meeting all 4 criteria return `true`.
- **Actual Output:** Password complexity regex verified.
- **Status:** PASS
- **Error Details:** None.
- **Severity / Priority:** Critical / High.

### TC-REG-04: Single-Word Security Answer Enforcement
- **Module:** Investigator Registration
- **Test Objective:** Enforce that security question answers consist of exactly one single word without whitespace.
- **Preconditions:** Validation middleware loaded.
- **Exact Input Values:**
  - Valid: `Titan`
  - Invalid: `New Delhi` (2 words), ` My Dog ` (spaces).
- **Execution Procedure:**
  1. Test custom validator splitting by `\s+`.
- **Expected Output:** Single-word values pass; multi-word strings throw validation error.
- **Actual Output:** Validated single-word constraint.
- **Status:** PASS
- **Error Details:** None.
- **Severity / Priority:** High / Medium.

### TC-REG-05: Successful Registration with Bcrypt Hashing
- **Module:** Investigator Registration
- **Test Objective:** Verify that an investigator is saved to MongoDB with passwords and security answers hashed via bcryptjs.
- **Preconditions:** Isolated test database connected.
- **Exact Input Values:** Dataset REG-01 (`Detective James Miller`, `detective.miller@gov.in`, `jmiller`, `Forensic@Gov2026!`, `Titan`).
- **Execution Procedure:**
  1. Create investigator document in MongoDB.
  2. Inspect saved document properties.
- **Expected Output:** Document created; `password` and `securityAnswer` stored as 60-character bcrypt hash strings (`$2a$10$...`); plaintext values absent.
- **Actual Output:** Investigator registered with ID; plaintext password and answer verified hashed.
- **Status:** PASS
- **Error Details:** None.
- **Severity / Priority:** Critical / High.

### TC-REG-06: Duplicate Email Prevention
- **Module:** Investigator Registration
- **Test Objective:** Verify that attempting to register an already existing email address triggers an error.
- **Preconditions:** `detective.miller@gov.in` exists in test database.
- **Exact Input Values:** Dataset REG-05 with email `detective.miller@gov.in`.
- **Execution Procedure:**
  1. Attempt to create second investigator with identical email.
- **Expected Output:** MongoDB duplicate key error (code 11000) caught; user presented with `"Official email address is already registered."`.
- **Actual Output:** Rejection triggered by unique index constraint.
- **Status:** PASS
- **Error Details:** None.
- **Severity / Priority:** High / High.

---

## Module 3: Login and Authentication

### TC-LOG-01: Valid Password Authentication
- **Module:** Login & Authentication
- **Test Objective:** Verify that correct credentials authenticate successfully.
- **Preconditions:** Seeded user `detective.miller@gov.in` in database.
- **Exact Input Values:** Email: `detective.miller@gov.in`, Password: `Forensic@Gov2026!`.
- **Execution Procedure:**
  1. Execute `bcrypt.compare('Forensic@Gov2026!', user.password)`.
- **Expected Output:** Returns `true`.
- **Actual Output:** Bcrypt confirmed plaintext match.
- **Status:** PASS
- **Error Details:** None.
- **Severity / Priority:** Critical / High.

### TC-LOG-02: Incorrect Password Rejection
- **Module:** Login & Authentication
- **Test Objective:** Verify that an incorrect password fails authentication.
- **Preconditions:** Seeded user in database.
- **Exact Input Values:** Email: `detective.miller@gov.in`, Password: `WrongPassword#1`.
- **Execution Procedure:**
  1. Execute `bcrypt.compare('WrongPassword#1', user.password)`.
- **Expected Output:** Returns `false`.
- **Actual Output:** Comparison returned `false`.
- **Status:** PASS
- **Error Details:** None.
- **Severity / Priority:** Critical / High.

### TC-LOG-03: Failed Attempts Counter & Security Question Threshold
- **Module:** Login & Authentication
- **Test Objective:** Verify that 3 failed login attempts activate the security question challenge.
- **Preconditions:** Seeded user with `failedLoginAttempts = 0`.
- **Exact Input Values:** 3 sequential failed password attempts.
- **Execution Procedure:**
  1. Increment `failedLoginAttempts` from 0 to 3.
  2. Inspect `failedLoginAttempts >= 3`.
- **Expected Output:** On 3rd failure, login controller sets `requireSecurityQuestion = true` and retrieves the user's registered question.
- **Actual Output:** Security challenge activated at 3 failed attempts.
- **Status:** PASS
- **Error Details:** None.
- **Severity / Priority:** High / High.

### TC-LOG-04: Security Answer Verification During Challenge
- **Module:** Login & Authentication
- **Test Objective:** Verify that providing the correct security answer validates the security challenge.
- **Preconditions:** User in challenge state with answer `titan`.
- **Exact Input Values:** `securityAnswer = 'Titan'`.
- **Execution Procedure:**
  1. Compare submitted answer against hashed answer using `bcrypt.compare`.
- **Expected Output:** Returns `true`; failed attempts reset to 0 upon final password verification.
- **Actual Output:** Security answer verified and counter reset.
- **Status:** PASS
- **Error Details:** None.
- **Severity / Priority:** High / High.

### TC-LOG-05: Account Lockout After 5 Consecutive Failures
- **Module:** Login & Authentication
- **Test Objective:** Verify that 5 consecutive failures lock the account for 15 minutes.
- **Preconditions:** Seeded user.
- **Exact Input Values:** 5 sequential failed attempts.
- **Execution Procedure:**
  1. Set `failedLoginAttempts = 5`.
  2. Set `lockoutUntil = new Date(Date.now() + 15 * 60 * 1000)`.
  3. Attempt login while `lockoutUntil > new Date()`.
- **Expected Output:** HTTP 403 Forbidden with temporary account lock alert.
- **Actual Output:** Lockout timestamp validated; access blocked.
- **Status:** PASS
- **Error Details:** None.
- **Severity / Priority:** High / High.

### TC-LOG-06: Protected Route Access Redirection Without Session
- **Module:** Login & Authentication
- **Test Objective:** Confirm that unauthenticated requests to `/dashboard` are redirected to `/auth/login`.
- **Preconditions:** Clean request with no session cookie.
- **Exact Input Values:** HTTP `GET /dashboard`.
- **Execution Procedure:**
  1. Request `GET /dashboard`.
  2. Check response status and `location` header.
- **Expected Output:** HTTP 302 Redirect to `/auth/login`.
- **Actual Output:** HTTP 302 redirecting to `/auth/login`.
- **Status:** PASS
- **Error Details:** None.
- **Severity / Priority:** Critical / High.

---

## Module 4: Investigator Profile

### TC-PRF-01: Profile Information Retrieval
- **Module:** Investigator Profile
- **Test Objective:** Verify that viewing the profile displays the investigator's name, role, email, phone, and age.
- **Preconditions:** Authenticated investigator session.
- **Exact Input Values:** Query profile for `detective.miller@gov.in`.
- **Execution Procedure:**
  1. Retrieve investigator record by ID.
  2. Inspect properties.
- **Expected Output:** Returns full name, role, email, contact details.
- **Actual Output:** Correct details retrieved from MongoDB.
- **Status:** PASS
- **Error Details:** None.
- **Severity / Priority:** Medium / Medium.

### TC-PRF-02: Profile Edit & Change Persistence
- **Module:** Investigator Profile
- **Test Objective:** Verify editing phone number updates the database and creates an audit log.
- **Preconditions:** Seeded investigator.
- **Exact Input Values:** `phone = '+91 98765 00000'`.
- **Execution Procedure:**
  1. Update phone field.
  2. Log audit event `PROFILE_UPDATED`.
  3. Reload document from database.
- **Expected Output:** Reloaded document contains new phone number; audit log recorded.
- **Actual Output:** Phone updated and audit log saved.
- **Status:** PASS
- **Error Details:** None.
- **Severity / Priority:** Medium / Medium.

### TC-PRF-03: Fallback Avatar for Profiles Without Custom Photo
- **Module:** Investigator Profile
- **Test Objective:** Verify that default avatar is assigned when no custom photograph has been uploaded.
- **Preconditions:** Investigator registered without photo.
- **Exact Input Values:** Default profile photo check.
- **Execution Procedure:**
  1. Inspect `investigator.profilePhoto`.
- **Expected Output:** Value is `'/images/default-avatar.png'`.
- **Actual Output:** Value confirmed as `'/images/default-avatar.png'`.
- **Status:** PASS
- **Error Details:** None.
- **Severity / Priority:** Low / Low.

---

## Module 5: Case Management

### TC-CAS-01: Atomic Sequential Case Numbering
- **Module:** Case Management
- **Test Objective:** Verify that cases receive sequential, atomic numbers (`CASE001`, `CASE002`...).
- **Preconditions:** Counter collection initialized.
- **Exact Input Values:** Consecutive calls to `getNextCaseNumber()`.
- **Execution Procedure:**
  1. Call `getNextCaseNumber()`.
  2. Inspect string format.
- **Expected Output:** String matches `/^CASE\d{3,}$/`.
- **Actual Output:** Produced sequential atomic case identifier.
- **Status:** PASS
- **Error Details:** None.
- **Severity / Priority:** Critical / High.

### TC-CAS-02: Case Ingestion with Mandatory Fields
- **Module:** Case Management
- **Test Objective:** Ingest a valid case and confirm all mandatory metadata and timestamps are recorded.
- **Preconditions:** Authenticated investigator.
- **Exact Input Values:** Dataset CASE-01 (`Central Data Repository Security Breach`, `Cybercrime`, `CASE001`).
- **Execution Procedure:**
  1. Create Case document.
  2. Verify fields: `caseNumber`, `caseName`, `crimeType`, `creationTimestamp`.
- **Expected Output:** Case document persisted; `creationTimestamp` is marked immutable.
- **Actual Output:** Case created with ID and immutable creation timestamp.
- **Status:** PASS
- **Error Details:** None.
- **Severity / Priority:** Critical / High.

### TC-CAS-03: Case Search and Filtering
- **Module:** Case Management
- **Test Objective:** Search and filter cases by crime type (`Cybercrime`) and status (`New`).
- **Preconditions:** `CASE001` exists with `Cybercrime` / `New`.
- **Exact Input Values:** Query `{ crimeType: 'Cybercrime', status: 'New' }`.
- **Execution Procedure:**
  1. Query `Case.find({ crimeType: 'Cybercrime', status: 'New' })`.
- **Expected Output:** Returns array containing `CASE001`.
- **Actual Output:** Returned matching case record.
- **Status:** PASS
- **Error Details:** None.
- **Severity / Priority:** Medium / Medium.

### TC-CAS-04: Duplicate Case Number Prevention
- **Module:** Case Management
- **Test Objective:** Verify that attempting to create a second case with an existing case number throws an error.
- **Preconditions:** `CASE001` exists in database.
- **Exact Input Values:** Second case document with `caseNumber = 'CASE001'`.
- **Execution Procedure:**
  1. Attempt `Case.create({ caseNumber: 'CASE001', ... })`.
- **Expected Output:** Duplicate key error (code 11000).
- **Actual Output:** Rejected by unique index constraint.
- **Status:** PASS
- **Error Details:** None.
- **Severity / Priority:** High / High.

---

## Module 6: Crime Scene Management

### TC-SCN-01: Crime Scene Address Persistence on Case Record
- **Module:** Crime Scene Management
- **Test Objective:** Verify that crime scene location and address are stored within the Case document.
- **Preconditions:** `CASE001` created.
- **Exact Input Values:** `crimeSceneAddress = 'Server Rack Room B-12, Ground Floor'`.
- **Execution Procedure:**
  1. Query `Case.findOne({ caseNumber: 'CASE001' })`.
  2. Inspect `crimeSceneAddress`.
- **Expected Output:** Exact address string retrieved.
- **Actual Output:** Crime scene address preserved on Case record.
- **Status:** PASS
- **Error Details:** None.
- **Severity / Priority:** Medium / Medium.

### TC-SCN-02: Standalone Scene Model Schema Verification
- **Module:** Crime Scene Management
- **Test Objective:** Verify that `models/Scene.js` schema exists in codebase with fields for `sceneIdentifier`, `caseId`, `sceneDetails`.
- **Preconditions:** Model file loaded.
- **Exact Input Values:** Inspect `models/Scene.js`.
- **Execution Procedure:**
  1. Verify Mongoose model registration and schema paths.
- **Expected Output:** Model has `sceneIdentifier`, `caseId`, `sceneDetails`.
- **Actual Output:** Model schema verified.
- **Status:** PASS
- **Error Details:** None.
- **Severity / Priority:** Low / Low.

### TC-SCN-03: Standalone Crime Scene Creation Route Audit
- **Module:** Crime Scene Management
- **Test Objective:** Determine whether standalone scene creation routes (`POST /scenes/new`) are implemented.
- **Preconditions:** Route files inspected.
- **Exact Input Values:** Inspect `routes/scenes.js`.
- **Execution Procedure:**
  1. Check for `POST /scenes/new` or `POST /scenes`.
- **Expected Output:** Explicit identification of route status.
- **Actual Output:** Route does not exist. Crime scenes are managed via Case `crimeSceneAddress` and evidence uploads.
- **Status:** NOT IMPLEMENTED
- **Error Details:** Standalone scene creation form/routes are not implemented.
- **Severity / Priority:** Low / Low.

---

## Module 7: Digital Evidence Management

### TC-EVD-01: Cryptographic SHA-256 Digest Calculation
- **Module:** Digital Evidence Management
- **Test Objective:** Verify SHA-256 calculation against known cryptographic standard.
- **Preconditions:** Hash service loaded.
- **Exact Input Values:** String `"Forensic Integrity Test 2026"`.
- **Execution Procedure:**
  1. Compute hash via `calculateBufferHash()`.
  2. Compare against native `crypto.createHash('sha256')`.
- **Expected Output:** Hashes match exactly; length is 64 hex characters.
- **Actual Output:** SHA-256 verified matching known digest.
- **Status:** PASS
- **Error Details:** None.
- **Severity / Priority:** Critical / High.

### TC-EVD-02: Image Metadata Extraction via Sharp
- **Module:** Digital Evidence Management
- **Test Objective:** Extract width, height, format, and channels from a binary image buffer.
- **Preconditions:** Valid 100x100 PNG buffer.
- **Exact Input Values:** 100x100 synthetic PNG buffer.
- **Execution Procedure:**
  1. Run `extractImagePropertiesAndExif()`.
  2. Inspect `properties.width`, `properties.height`, `properties.format`.
- **Expected Output:** Width 100, Height 100, Format 'PNG'.
- **Actual Output:** Dimensions 100x100, Format 'PNG'.
- **Status:** PASS
- **Error Details:** None.
- **Severity / Priority:** High / High.

### TC-EVD-03: Persistent File Storage in MongoDB GridFS
- **Module:** Digital Evidence Management
- **Test Objective:** Verify that evidence files are saved into GridFS bucket `evidence_bucket` and stream back intact.
- **Preconditions:** MongoDB connection active.
- **Exact Input Values:** Specimen buffer `"Forensic Evidence Specimen Sample File 2026"`.
- **Execution Procedure:**
  1. Save buffer via `saveToStorage({ bucketName: 'evidence_bucket' })`.
  2. Verify returned `gridFsId`.
  3. Retrieve stream via `getFileReadStream({ gridFsId })`.
- **Expected Output:** Stream object returned; `gridFsId` is a valid ObjectId.
- **Actual Output:** GridFS ID returned; stream retrieved successfully.
- **Status:** PASS
- **Error Details:** None.
- **Severity / Priority:** Critical / High.

### TC-EVD-04: Evidence Ingestion with Unique Identifier
- **Module:** Digital Evidence Management
- **Test Objective:** Verify that digital evidence receives an atomic identifier (`EVID-CASE001-001`).
- **Preconditions:** `CASE001` exists.
- **Exact Input Values:** Dataset EVID-01 attached to `CASE001`.
- **Execution Procedure:**
  1. Call `getNextEvidenceNumber('CASE001')`.
  2. Create Evidence document.
- **Expected Output:** Evidence identifier starts with `EVID-CASE001-`.
- **Actual Output:** Registered `EVID-CASE001-001`.
- **Status:** PASS
- **Error Details:** None.
- **Severity / Priority:** Critical / High.

---

## Module 8: Chain of Custody

### TC-CST-01: Evidentiary Intake Custody Event Logging
- **Module:** Chain of Custody
- **Test Objective:** Verify logging initial custody event upon evidence ingestion.
- **Preconditions:** Case and Evidence records exist.
- **Exact Input Values:** `action = 'Evidence Received'`, `reason = 'Initial digital evidence ingestion'`.
- **Execution Procedure:**
  1. Call `recordEvidenceCustodyEvent()`.
  2. Inspect returned custody document.
- **Expected Output:** Event ID starts with `CUST-`; action is `Evidence Received`.
- **Actual Output:** Event recorded with ID `CUST-0001` and action `Evidence Received`.
- **Status:** PASS
- **Error Details:** None.
- **Severity / Priority:** Critical / High.

### TC-CST-02: Inter-Investigator Transfer Workflow
- **Module:** Chain of Custody
- **Test Objective:** Verify case transfer initiation and acceptance between investigators.
- **Preconditions:** Miller (transferor) and Chen (recipient) registered.
- **Exact Input Values:** Transfer Dataset CUST-01 & CUST-02.
- **Execution Procedure:**
  1. Initiate transfer via `initiateCaseTransfer()`.
  2. Verify status is `Pending`.
  3. Respond with `respondToTransfer(response: 'Accept')`.
  4. Verify status transitions to `Completed`.
- **Expected Output:** Status transitions `Pending` -> `Completed`; case assigned to recipient.
- **Actual Output:** Transfer completed and acknowledged.
- **Status:** PASS
- **Error Details:** None.
- **Severity / Priority:** Critical / High.

---

## Module 9: Criminal Records and Photos

### TC-CRM-01: Criminal Profile Dossier Creation
- **Module:** Criminal Records
- **Test Objective:** Register suspect with physical traits and link to active case.
- **Preconditions:** Authenticated investigator; `CASE001` exists.
- **Exact Input Values:** Dataset CR-01 (`Vikram Aditya Sharma`, `CR-2026-0001`).
- **Execution Procedure:**
  1. Create `CriminalRecord` document.
  2. Verify fields: `recordNumber`, `fullName`, `physicalTraits`, `connectedCases`.
- **Expected Output:** Record saved with `CR-2026-0001` and physical traits.
- **Actual Output:** Registered `CR-2026-0001` (`Vikram Aditya Sharma`).
- **Status:** PASS
- **Error Details:** None.
- **Severity / Priority:** High / Medium.

### TC-CRM-02: Interrogation Statement Logging
- **Module:** Criminal Records
- **Test Objective:** Append chronological interrogation statements to criminal profile.
- **Preconditions:** `CR-2026-0001` exists.
- **Exact Input Values:** Dataset CR-02.
- **Execution Procedure:**
  1. Push interrogation object into `interrogationNotes` array.
  2. Save document.
- **Expected Output:** Interrogation notes array length increments to 1.
- **Actual Output:** Interrogation statement recorded by Detective Miller.
- **Status:** PASS
- **Error Details:** None.
- **Severity / Priority:** Medium / Medium.

---

## Module 10: Investigator Messaging

### TC-MSG-01: Direct Message Transmission
- **Module:** Investigator Messaging
- **Test Objective:** Create direct message between two investigators.
- **Preconditions:** Miller and Chen registered.
- **Exact Input Values:** Dataset MSG-01.
- **Execution Procedure:**
  1. Create Message document.
  2. Verify `deliveryStatus = 'Sent'`.
- **Expected Output:** Message persisted with sender, recipient, and timestamp.
- **Actual Output:** Message sent and saved to MongoDB.
- **Status:** PASS
- **Error Details:** None.
- **Severity / Priority:** High / Medium.

### TC-MSG-02: Message Unread Count and Read Receipts
- **Module:** Investigator Messaging
- **Test Objective:** Verify unread message counting and marking messages as Read.
- **Preconditions:** Unread message exists from Miller to Chen.
- **Exact Input Values:** Query and update unread messages.
- **Execution Procedure:**
  1. Count unread messages (should be > 0).
  2. Execute `Message.updateMany` marking as `Read`.
  3. Re-count unread messages.
- **Expected Output:** Unread count drops to 0.
- **Actual Output:** Unread count updated to 0 after read status change.
- **Status:** PASS
- **Error Details:** None.
- **Severity / Priority:** Medium / Medium.

---

## Module 11: Evidence Requests and Sharing

### TC-REQ-01: Inter-Agency Evidence Request Submission
- **Module:** Evidence Requests & Sharing
- **Test Objective:** Submit evidence access request to custodian.
- **Preconditions:** Case, Evidence, and Custodian exist.
- **Exact Input Values:** Dataset REQ-01 (`REQ-2026-0001`).
- **Execution Procedure:**
  1. Create `EvidenceRequest` document with `status = 'Pending'`.
- **Expected Output:** Request created with `REQ-` identifier and `Pending` status.
- **Actual Output:** Filed request `REQ-2026-0001`.
- **Status:** PASS
- **Error Details:** None.
- **Severity / Priority:** High / High.

### TC-REQ-02: Custodian Request Approval
- **Module:** Evidence Requests & Sharing
- **Test Objective:** Custodian approves request and records approval notes.
- **Preconditions:** `REQ-2026-0001` exists.
- **Exact Input Values:** `decision = 'Approved'`, `responseNotes = 'Access authorized for 7-day review'`.
- **Execution Procedure:**
  1. Update request status to `Approved`.
  2. Save document.
- **Expected Output:** Status is `Approved`; respondedAt timestamp recorded.
- **Actual Output:** Request marked Approved by custodian.
- **Status:** PASS
- **Error Details:** None.
- **Severity / Priority:** High / High.

---

## Module 12: Notifications

### TC-NOT-01: Real-Time Notification Dispatch
- **Module:** Notifications
- **Test Objective:** Create notification for investigator recipient.
- **Preconditions:** Recipient investigator exists.
- **Exact Input Values:** Notification title: `"New Forensic Message"`, notificationText: `"Hashes confirmed for EVID-CASE001-001"`.
- **Execution Procedure:**
  1. Create Notification document.
  2. Verify `isRead = false`.
- **Expected Output:** Notification document created in unread state.
- **Actual Output:** Notification created successfully.
- **Status:** PASS
- **Error Details:** None.
- **Severity / Priority:** Medium / Medium.

### TC-NOT-02: Mark Notification as Read
- **Module:** Notifications
- **Test Objective:** Mark notification as read and record timestamp.
- **Preconditions:** Unread notification exists.
- **Exact Input Values:** `isRead = true`.
- **Execution Procedure:**
  1. Update notification `isRead = true` and `readTimestamp = new Date()`.
  2. Save document.
- **Expected Output:** Document updated with `isRead = true`.
- **Actual Output:** Notification marked read.
- **Status:** PASS
- **Error Details:** None.
- **Severity / Priority:** Low / Low.

---

## Module 13: Autopsy Digital Forensics

### TC-AUT-01: Ingest Job Creation & Autonomous Execution
- **Module:** Autopsy Digital Forensics
- **Test Objective:** Create ingest job, run forensic modules, and generate findings.
- **Preconditions:** Evidence item exists.
- **Exact Input Values:** Dataset AUT-01 (File Identification, Hash Verification, Entropy Check).
- **Execution Procedure:**
  1. Call `createAnalysisJob()`.
  2. Call `executeAnalysis(job._id)`.
  3. Reload job document.
- **Expected Output:** Status transitions to `Completed`; findings array contains extracted indicators.
- **Actual Output:** Job completed producing verified forensic findings.
- **Status:** PASS
- **Error Details:** None.
- **Severity / Priority:** Critical / High.

### TC-AUT-02: Magic Byte File Signature Verification
- **Module:** Autopsy Digital Forensics
- **Test Objective:** Verify detection of file headers for PNG (`89 50 4E 47`) and JPEG (`FF D8 FF`).
- **Preconditions:** Magic byte detector loaded.
- **Exact Input Values:** Headers for PNG and JPEG.
- **Execution Procedure:**
  1. Inspect hex output of first 4 bytes of test streams.
- **Expected Output:** Identifies `89504E47` as PNG and `FFD8FF` as JPEG.
- **Actual Output:** Magic bytes correctly identify PNG and JPEG.
- **Status:** PASS
- **Error Details:** None.
- **Severity / Priority:** High / High.

---

## Module 14: Report Generation

### TC-REP-01: PDF Investigation Report Compilation
- **Module:** Report Generation
- **Test Objective:** Compile comprehensive PDF investigation report with case metadata, exhibits, and custody history.
- **Preconditions:** Case, Evidence, and Custody events exist.
- **Exact Input Values:** Case `CASE001`.
- **Execution Procedure:**
  1. Call `generateCaseReport()`.
  2. Verify generated PDF file exists on disk.
  3. Verify 64-character SHA-256 hash calculated.
  4. Verify `verifyFileIntegrity()` returns `true`.
- **Expected Output:** PDF report generated; integrity verified matching disk bytes.
- **Actual Output:** Report compiled and verified intact.
- **Status:** PASS
- **Error Details:** None.
- **Severity / Priority:** Critical / High.

---

## Module 15: Security Testing

### TC-SEC-01: Anti-Caching Cache-Control Headers on Protected Routes
- **Module:** Security Testing
- **Test Objective:** Enforce `Cache-Control: no-store, no-cache, must-revalidate, private` on authenticated requests.
- **Preconditions:** Authenticated middleware.
- **Exact Input Values:** Authenticated request to `/dashboard`.
- **Execution Procedure:**
  1. Execute `ensureAuthenticated()` middleware with authenticated session.
  2. Inspect `Cache-Control` header.
- **Expected Output:** Header contains `no-store` and `no-cache`.
- **Actual Output:** `Cache-Control: no-store, no-cache, must-revalidate, private` confirmed.
- **Status:** PASS
- **Error Details:** None.
- **Severity / Priority:** High / High.

### TC-SEC-02: HTTP Security Headers via Helmet
- **Module:** Security Testing
- **Test Objective:** Confirm presence of `X-Content-Type-Options: nosniff`.
- **Preconditions:** Express server running with Helmet.
- **Exact Input Values:** HTTP `GET /`.
- **Execution Procedure:**
  1. Request `GET /`.
  2. Inspect response headers.
- **Expected Output:** `x-content-type-options: nosniff` present.
- **Actual Output:** Header present and verified.
- **Status:** PASS
- **Error Details:** None.
- **Severity / Priority:** High / Medium.

### TC-SEC-03: Cross-Site Scripting (XSS) Template Escaping
- **Module:** Security Testing
- **Test Objective:** Verify that malicious script tags in variables are escaped by EJS.
- **Preconditions:** EJS template rendering.
- **Exact Input Values:** Payload `<script>alert('XSS')</script>`.
- **Execution Procedure:**
  1. Render string with `<%= var %>`.
- **Expected Output:** `<` and `>` converted to `&lt;` and `&gt;`; raw `<script>` tags absent.
- **Actual Output:** Script tags escaped safely into HTML entities.
- **Status:** PASS
- **Error Details:** None.
- **Severity / Priority:** Critical / High.

---

## Module 16: Database and Data Persistence

### TC-DB-01: MongoDB Connection and Database Isolation
- **Module:** Database & Persistence
- **Test Objective:** Confirm connection state is active and bound to the test database.
- **Preconditions:** Mongoose connected.
- **Exact Input Values:** `mongoose.connection.name`.
- **Execution Procedure:**
  1. Inspect `readyState` and `name`.
- **Expected Output:** `readyState = 1`; `name = 'smart_investigation_test'`.
- **Actual Output:** Connected to `smart_investigation_test`.
- **Status:** PASS
- **Error Details:** None.
- **Severity / Priority:** Critical / High.

### TC-DB-02: Concurrency-Safe Atomic Case Counter
- **Module:** Database & Persistence
- **Test Objective:** Verify that concurrent requests for case numbers do not produce collisions.
- **Preconditions:** Counter collection active.
- **Exact Input Values:** 3 concurrent `getNextCaseNumber()` executions.
- **Execution Procedure:**
  1. Execute `Promise.all([getNextCaseNumber(), getNextCaseNumber(), getNextCaseNumber()])`.
  2. Verify all 3 numbers are distinct.
- **Expected Output:** Array of 3 distinct sequential identifiers.
- **Actual Output:** 3 unique sequences generated concurrently.
- **Status:** PASS
- **Error Details:** None.
- **Severity / Priority:** Critical / High.

---

## Module 17: File Storage and Deployment

### TC-STR-01: File Streaming Security Headers
- **Module:** File Storage & Deployment
- **Test Objective:** Verify that `serveFileResponse` sets `Content-Type`, `Cache-Control`, and `X-Content-Type-Options: nosniff`.
- **Preconditions:** `services/storageService.js` loaded.
- **Exact Input Values:** Inspect function implementation.
- **Execution Procedure:**
  1. Check headers configured in `serveFileResponse()`.
- **Expected Output:** Headers set appropriately.
- **Actual Output:** Confirmed function sets all required headers.
- **Status:** PASS
- **Error Details:** None.
- **Severity / Priority:** High / High.

---

## Module 18: Performance and Reliability

### TC-PRF-01: Root Welcome Page Response Time
- **Module:** Performance & Reliability
- **Test Objective:** Verify that public home page responds under 250 milliseconds.
- **Preconditions:** Server running.
- **Exact Input Values:** HTTP `GET /`.
- **Execution Procedure:**
  1. Measure elapsed time between request and response.
- **Expected Output:** Response time < 250 ms.
- **Actual Output:** Response time was 5 ms (< 250 ms threshold).
- **Status:** PASS
- **Error Details:** None.
- **Severity / Priority:** Medium / Low.

### TC-PRF-02: Graceful Server Shutdown
- **Module:** Performance & Reliability
- **Test Objective:** Verify that HTTP server closes cleanly without hanging handles.
- **Preconditions:** Active test server.
- **Exact Input Values:** `testServer.close()`.
- **Execution Procedure:**
  1. Invoke `close()` on HTTP server instance.
- **Expected Output:** Server closes cleanly.
- **Actual Output:** Test server closed successfully.
- **Status:** PASS
- **Error Details:** None.
- **Severity / Priority:** Medium / Low.
