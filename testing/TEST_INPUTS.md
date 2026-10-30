# Smart Investigation Workspace - Complete Test Input Dataset

**File Location:** `testing/TEST_INPUTS.md`  
**Security Notice:** All records, government identities, telephone numbers, and credentials in this document are strictly **fictional, synthetic test data** designed for quality assurance testing in controlled environments. Never use real personal or official credentials.

---

## 1. Investigator Accounts (Synthetic Personas)

### Dataset IA-01: Primary Lead Investigator [VALID]
- **Full Name:** Detective James Miller
- **Designation / Role:** Senior Forensic Investigator
- **Department:** Digital Forensics Division
- **Official Email:** `detective.miller@gov.in`
- **Username:** `jmiller`
- **Password (Fictional):** `Forensic@Gov2026!`
- **Confirm Password:** `Forensic@Gov2026!`
- **Date of Birth:** `1986-04-12`
- **Calculated Age:** 40
- **Gender:** `Male`
- **Phone:** `+91 98765 43210`
- **Security Question:** `What was your first childhood pet's name?`
- **Security Answer:** `Titan`
- **Profile Photo:** Synthetic avatar (`avatar_miller.png`)
- **Usage:** Lead case owner, report generator, transfer initiator.

### Dataset IA-02: Colleague Forensic Examiner [VALID]
- **Full Name:** Detective David Chen
- **Designation / Role:** Digital Evidence Specialist
- **Department:** Cyber Forensics Section
- **Official Email:** `d.chen@gov.in`
- **Username:** `dchen`
- **Password (Fictional):** `Evidence#Secure2026`
- **Confirm Password:** `Evidence#Secure2026`
- **Date of Birth:** `1992-08-25`
- **Calculated Age:** 34
- **Gender:** `Male`
- **Phone:** `+91 98111 22334`
- **Security Question:** `In what city were you born?`
- **Security Answer:** `Chandigarh`
- **Profile Photo:** Synthetic avatar (`avatar_chen.png`)
- **Usage:** Custodian of evidence, recipient of transfer requests, messaging peer.

### Dataset IA-03: Secondary Case Officer [VALID]
- **Full Name:** Inspector Sarah Jenkins
- **Designation / Role:** Senior Cyber Investigator
- **Department:** Crime Investigation Branch
- **Official Email:** `sarah.jenkins@gov.in`
- **Username:** `sjenkins`
- **Password (Fictional):** `Cyber#Shield99!`
- **Confirm Password:** `Cyber#Shield99!`
- **Date of Birth:** `1989-11-03`
- **Calculated Age:** 36
- **Gender:** `Female`
- **Phone:** `+91 98222 33445`
- **Security Question:** `What is your mother's maiden name?`
- **Security Answer:** `Patel`
- **Usage:** Inter-agency evidence request filer.

---

## 2. Registration Input Datasets

### Dataset REG-01: Completely Valid Registration [VALID]
```json
{
  "fullName": "Officer Robert Vance",
  "role": "Forensic Ballistics Specialist",
  "dob": "1990-06-15",
  "age": 36,
  "gender": "Male",
  "email": "robert.vance@gov.in",
  "phone": "+91 98333 44556",
  "username": "rvance",
  "password": "Vance#Ballistics2026",
  "retypePassword": "Vance#Ballistics2026",
  "securityQuestion": "What was the make of your first vehicle?",
  "securityAnswer": "Maruti",
  "captcha": "VALID_CAPTCHA_TOKEN"
}
```

### Dataset REG-02: Empty Form Submission [INVALID]
```json
{
  "fullName": "",
  "role": "",
  "dob": "",
  "age": "",
  "gender": "",
  "email": "",
  "phone": "",
  "username": "",
  "password": "",
  "retypePassword": "",
  "securityQuestion": "",
  "securityAnswer": "",
  "captcha": ""
}
```
- **Expected Errors:** All required fields flagged with descriptive validation alerts.

### Dataset REG-03: Non-Government Email Address [INVALID]
```json
{
  "email": "investigator.test@gmail.com"
}
```
- **Expected Error:** `Official email must match xxx.yyy@gov.in format.`

### Dataset REG-04: Non-Standard Government Email (Missing Dot Prefix) [INVALID]
```json
{
  "email": "investigator@gov.in"
}
```
- **Expected Error:** Rejection by regex `^[a-zA-Z0-9]+(\.[a-zA-Z0-9]+)+@gov\.in$`.

### Dataset REG-05: Duplicate Email Address [INVALID]
```json
{
  "email": "detective.miller@gov.in"
}
```
- **Expected Error:** `Official email address is already registered.`

### Dataset REG-06: Duplicate Username [INVALID]
```json
{
  "username": "jmiller"
}
```
- **Expected Error:** `Username is already taken. Please choose another.`

### Dataset REG-07: Invalid Underage Date of Birth (< 18 Years) [INVALID]
```json
{
  "dob": "2015-01-01"
}
```
- **Expected Error:** `Investigator must be at least 18 years of age.`

### Dataset REG-08: Future Date of Birth [INVALID]
```json
{
  "dob": "2030-01-01"
}
```
- **Expected Error:** `Date of birth cannot be in the future.`

### Dataset REG-09: Weak Password (No Special Character) [INVALID]
```json
{
  "password": "Password1234",
  "retypePassword": "Password1234"
}
```
- **Expected Error:** `Password must include at least one uppercase letter, one lowercase letter, one digit, and one special character.`

### Dataset REG-10: Short Password (< 8 Characters) [INVALID]
```json
{
  "password": "Ab1!",
  "retypePassword": "Ab1!"
}
```
- **Expected Error:** `Password must be at least 8 characters long.`

### Dataset REG-11: Password Confirmation Mismatch [INVALID]
```json
{
  "password": "Secure#Password2026",
  "retypePassword": "Secure#Mismatch2026"
}
```
- **Expected Error:** `Passwords do not match.`

### Dataset REG-12: Multi-Word Security Answer [INVALID]
```json
{
  "securityAnswer": "New Delhi"
}
```
- **Expected Error:** `Security answer must be exactly one single word with no spaces.`

### Dataset REG-13: Registration with Whitespace Padding [BOUNDARY]
```json
{
  "fullName": "   Inspector Neil Armstrong   ",
  "username": "   narmstrong   ",
  "email": "   neil.armstrong@gov.in   ",
  "securityAnswer": "   Apollo   "
}
```
- **Expected Result:** Successfully trimmed by middleware to clean strings.

---

## 3. Login & Authentication Datasets

### Dataset LOG-01: Valid Investigator Login [VALID]
```json
{
  "email": "detective.miller@gov.in",
  "password": "Forensic@Gov2026!",
  "captcha": "MATCHING_SESSION_CAPTCHA"
}
```
- **Expected Result:** HTTP 302 Redirect to `/dashboard`. Session initialized.

### Dataset LOG-02: Incorrect Password Attempt 1 [INVALID]
```json
{
  "email": "detective.miller@gov.in",
  "password": "WrongPassword#999",
  "captcha": "MATCHING_SESSION_CAPTCHA"
}
```
- **Expected Result:** HTTP 401 Unauthorized. Failed login count incremented to 1.

### Dataset LOG-03: Repeated Failed Passwords (Attempts 1 to 3) [BOUNDARY]
- **Attempt 1:** Password `BadAttempt1!` -> `failedLoginAttempts: 1`
- **Attempt 2:** Password `BadAttempt2!` -> `failedLoginAttempts: 2`
- **Attempt 3:** Password `BadAttempt3!` -> `failedLoginAttempts: 3`
- **Expected Result on Attempt 4:** Server renders login form with `requireSecurityQuestion: true` and displays registered question: *"What was your first childhood pet's name?"*.

### Dataset LOG-04: Security Question Challenge with Valid Answer [VALID]
```json
{
  "email": "detective.miller@gov.in",
  "password": "Forensic@Gov2026!",
  "securityAnswer": "Titan",
  "captcha": "MATCHING_SESSION_CAPTCHA"
}
```
- **Expected Result:** Successful authentication. `failedLoginAttempts` reset to 0.

### Dataset LOG-05: Security Question Challenge with Incorrect Answer [INVALID]
```json
{
  "email": "detective.miller@gov.in",
  "password": "Forensic@Gov2026!",
  "securityAnswer": "WrongDogName",
  "captcha": "MATCHING_SESSION_CAPTCHA"
}
```
- **Expected Result:** HTTP 401 Unauthorized with error: `Incorrect security answer.`

### Dataset LOG-06: Excessive Failed Attempts (5 Failures) -> Account Lockout [SECURITY TEST]
- **5 Consecutive Failures:** Failed logins count reaches 5.
- **Expected Result:** `lockoutUntil` timestamp set to `Date.now() + 15 minutes`.
- **Subsequent Attempt:** HTTP 403 Forbidden with alert: `Account temporarily locked due to repeated failed logins. Please retry after 15 minute(s).`

### Dataset LOG-07: Missing / Incorrect CAPTCHA Code [INVALID]
```json
{
  "email": "detective.miller@gov.in",
  "password": "Forensic@Gov2026!",
  "captcha": "XXXXX"
}
```
- **Expected Result:** HTTP 400 Bad Request with error: `Incorrect CAPTCHA code. Please refresh or re-enter.`

---

## 4. Case Management Datasets

### Dataset CASE-01: Standard Cyber Intrusion Case [VALID]
```json
{
  "caseName": "Central Data Repository Security Breach",
  "crimeType": "Cybercrime",
  "status": "New",
  "incidentDate": "2026-10-24",
  "incidentTime": "02:45",
  "incidentLocation": "Sector 4 Data Center, Metro City",
  "crimeSceneAddress": "Server Rack Room B-12, Ground Floor",
  "caseDescription": "Unauthorized external network penetration detected originating from foreign IPs targeting confidential records.",
  "reportingInvestigator": "Detective James Miller"
}
```
- **Expected Case Number:** Sequentially generated (e.g., `CASE001`, `CASE002`).

### Dataset CASE-02: Missing Required Case Name & Description [INVALID]
```json
{
  "caseName": "",
  "crimeType": "Theft",
  "status": "New",
  "incidentDate": "2026-10-25",
  "incidentTime": "14:00",
  "incidentLocation": "Warehouse 4",
  "caseDescription": "Too short",
  "reportingInvestigator": "Detective James Miller"
}
```
- **Expected Errors:**
  - `Case name/title is required.`
  - `Case description must be at least 10 characters long.`

### Dataset CASE-03: Invalid Crime Classification [INVALID]
```json
{
  "caseName": "Vandalism Incident",
  "crimeType": "ArbitraryNonExistentCrime"
}
```
- **Expected Error:** `Please select a valid crime classification.`

### Dataset CASE-04: Nonexistent Case ID Lookup [BOUNDARY]
- **Query URL:** `/cases/650000000000000000000000`
- **Expected Result:** HTTP 404 Case Not Found.

### Dataset CASE-05: Malformed Mongo ObjectId [SECURITY TEST]
- **Query URL:** `/cases/invalid-hex-id-string`
- **Expected Result:** HTTP 404 or 400 graceful error page, zero unhandled 500 crash.

---

## 5. Digital Evidence & File Datasets

### Dataset EVID-01: Standard JPEG Crime-Scene Photo [VALID]
- **Filename:** `crime_scene_exhibit_01.jpg`
- **MIME Type:** `image/jpeg`
- **File Size:** `142,500 bytes` (~139 KB)
- **Image Resolution:** `1920 x 1080 px`
- **EXIF Tags:** Camera Make: `Nikon`, Model: `D850`, DateTimeOriginal: `2026-10-24 03:15:22`, Lat/Long: `28.6139, 77.2090`.
- **Expected SHA-256 Digest:** Consistent 64-character hexadecimal digest.
- **Storage Target:** MongoDB GridFS (`evidence_bucket`) + local disk cache.

### Dataset EVID-02: High-Resolution PNG Graphic Evidence [VALID]
- **Filename:** `forensic_schematic.png`
- **MIME Type:** `image/png`
- **File Size:** `340,120 bytes` (~332 KB)
- **Image Resolution:** `2048 x 1536 px`

### Dataset EVID-03: Prohibited Executable Upload [SECURITY TEST]
- **Filename:** `exploit_payload.exe`
- **MIME Type:** `application/x-msdownload`
- **File Size:** `12,000 bytes`
- **Expected Result:** Rejection by `imageFileFilter` with error: `Security Rejection: Invalid image format '.exe'. Only JPG, JPEG, PNG, and WebP are permitted.`

### Dataset EVID-04: Oversized Evidence File (> 30MB) [BOUNDARY]
- **Filename:** `oversized_dump.jpg`
- **File Size:** `35,000,000 bytes` (~33.3 MB)
- **Expected Result:** Multer `LIMIT_FILE_SIZE` rejection error.

### Dataset EVID-05: Empty Zero-Byte File [BOUNDARY]
- **Filename:** `empty_evidence.png`
- **File Size:** `0 bytes`
- **Expected Result:** Sharp extraction catches empty buffer and reports metadata processing fault gracefully.

---

## 6. Chain of Custody Transfer Datasets

### Dataset CUST-01: Case Transfer Initiation [VALID]
```json
{
  "caseId": "<CASE_ID>",
  "recipientId": "<CHEN_INVESTIGATOR_ID>",
  "reason": "Official handover for specialized cyber forensic disk analysis",
  "notes": "Includes 4 physical storage drives logged in evidence vault"
}
```
- **Expected Custody Event:** `CASE_TRANSFER_INITIATED`, status `Pending`.

### Dataset CUST-02: Transfer Acceptance [VALID]
```json
{
  "response": "Accept",
  "notes": "Evidence verified intact and custody acknowledged by Detective Chen"
}
```
- **Expected Result:** Case assignment updated to Detective Chen; custody status marked `Accepted`.

### Dataset CUST-03: Physical Evidence Custody Action [VALID]
```json
{
  "evidenceId": "<EVIDENCE_ID>",
  "action": "Evidence Viewed",
  "reason": "Forensic examination under sterile lab conditions",
  "notes": "Examined on forensic workstation node-01 without modifying file timestamps"
}
```
- **Expected Result:** Immutable ledger entry created with timestamp and actor ID.

---

## 7. Criminal Records & Suspect Datasets

### Dataset CR-01: High-Risk Suspect Profile [VALID]
```json
{
  "fullName": "Vikram Aditya Sharma",
  "alias": "The Specter",
  "nationalId": "IND-DL-88229911",
  "gender": "Male",
  "dob": "1984-03-22",
  "phone": "+91 98444 55667",
  "address": "Apartment 4B, Silver Heights, New Delhi",
  "status": "Person of Interest",
  "riskLevel": "High",
  "height": "182 cm",
  "eyeColor": "Dark Brown",
  "hairColor": "Black",
  "identifyingMarks": "Linear scar across left jawline; tattoo of an eagle on right forearm",
  "connectedCaseId": "<CASE_ID>"
}
```
- **Expected Record Identifier:** `CR-2026-0001` format.

### Dataset CR-02: Interrogation Entry [VALID]
```json
{
  "notes": "Subject questioned regarding whereabouts on the night of October 24. Claimed to be at a private conference in Gurgaon. Alibi currently under digital verification."
}
```
- **Expected Result:** Appended to `interrogationNotes` array with timestamp and interrogator identity.

---

## 8. Evidence Sharing Request Datasets

### Dataset REQ-01: Inter-Agency Evidence Request [VALID]
```json
{
  "caseId": "<CASE_ID>",
  "evidenceId": "<EVIDENCE_ID>",
  "requestedTo": "<CHEN_INVESTIGATOR_ID>",
  "purpose": "Corroboration of network log timestamps with suspect's mobile device capture"
}
```
- **Expected Identifier:** `REQ-2026-0001`
- **Expected Custodian Notification:** Generated automatically in recipient's notification inbox.

### Dataset REQ-02: Custodian Request Decision - Approved [VALID]
```json
{
  "decision": "Approved",
  "responseNotes": "Access authorized for 7-day review period."
}
```
- **Expected Result:** Status updated to `Approved`; Chain of Custody event `Evidence Transferred` automatically recorded.

---

## 9. Autopsy Digital Forensics Datasets

### Dataset AUT-01: Standard Multi-Module Ingest Job [VALID]
```json
{
  "caseId": "<CASE_ID>",
  "evidenceId": "<EVIDENCE_ID>",
  "modules": [
    "File Type Identification",
    "Cryptographic Hash Verification",
    "Data Entropy & Steganography Check",
    "Exif & Embedded Metadata Ingest",
    "Forensic Artifact & Keyword Search"
  ],
  "dataSourceType": "file_evidence"
}
```
- **Expected Job Identifier:** `AJOB-2026-0001`
- **Expected Result:** Status progresses `Queued` -> `Running` -> `Completed`. Produces HTML dossier report.

### Dataset AUT-02: Steganographic / High-Entropy Payload [SECURITY TEST]
- **Input Specimen:** High-entropy encrypted binary block.
- **Expected Finding:** `Entropy Analysis` module flags Shannon entropy score `> 7.5/8.0` with alert: `High entropy detected. Likely encrypted or compressed payload.`

---

## 10. Direct Messaging & Notification Datasets

### Dataset MSG-01: Encrypted Text Message [VALID]
```json
{
  "recipientId": "<CHEN_INVESTIGATOR_ID>",
  "messageText": "Detective Chen, forensic hashes for exhibit EVID-CASE001-001 are confirmed matching intake logs.",
  "caseId": "<CASE_ID>"
}
```
- **Expected Result:** Stored in MongoDB, broadcasted over Socket.IO room `user_<recipientId>`, notification created.

### Dataset MSG-02: Empty Message and No Attachment [INVALID]
```json
{
  "recipientId": "<CHEN_INVESTIGATOR_ID>",
  "messageText": ""
}
```
- **Expected Result:** Rejection with error: `Message cannot be empty.`

### Dataset MSG-03: Message with Secure Document Attachment [VALID]
- **Filename:** `forensic_warrant_signed.pdf`
- **MIME Type:** `application/pdf`
- **Size:** `45,200 bytes`
- **Expected Result:** SHA-256 calculated on attachment, saved to `attachments_bucket` in GridFS.

---

## 11. Security Payloads & Penetration Vectors

### Dataset SEC-01: Cross-Site Scripting (XSS) in Case Title [SECURITY TEST]
```json
{
  "caseName": "<script>alert('XSS-EXPOSURE');</script> Bank Fraud Case"
}
```
- **Expected Result:** EJS escaping (`<%= caseDoc.caseName %>`) safely escapes `<` and `>` into `&lt;script&gt;`, preventing script execution in the DOM.

### Dataset SEC-02: NoSQL Injection Query Payload [SECURITY TEST]
```json
{
  "email": { "$gt": "" },
  "password": { "$gt": "" }
}
```
- **Expected Result:** Express-validator strings casting rejects object input or queries evaluate against explicit string conversion, preventing unauthorized authentication bypass.

### Dataset SEC-03: Directory Path Traversal in Attachment Download [SECURITY TEST]
- **Query URL:** `/messages/attachment/650000000000000000000000/..%2f..%2f..%2fwindows%2fwin.ini`
- **Expected Result:** HTTP 403 / 404 security rejection; access confined strictly within `private_uploads`.
