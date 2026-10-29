# Smart Investigation Workspace - Autopsy Integration & Forensic Worker Setup Guide

## Overview

The **Smart Investigation Workspace** connects the central cloud web application (e.g., hosted on Render) with the **Autopsy Digital Forensics Platform** (The Sleuth Kit). 

Because the web application runs on Linux cloud containers without desktop graphical environments or direct access to local hardware write-blockers, the system uses a **decoupled forensic worker architecture**:

```
+-------------------------------------------------------+
| Smart Investigation Workspace (Cloud Server / Render) |
|  - Forensic Job Queue (`AnalysisJob` Model)           |
|  - Persistent Evidence Storage (MongoDB GridFS)       |
|  - Chain of Custody & Audit Ledger                    |
+-------------------------------------------------------+
                       ^        |
      Job Status &     |        | Authenticated Job Poll
      Findings Ingest  |        | & Evidence Stream
                       |        v
+-------------------------------------------------------+
| Forensic Analysis Workstation (Dedicated Desktop PC)  |
|  - Autopsy 4.21+ / The Sleuth Kit (autopsy64.exe)     |
|  - Hardware Write-Blockers & Forensic Evidence Drives |
|  - Forensic Analysis Worker (`autopsyWorker.js`)      |
+-------------------------------------------------------+
```

---

## 1. Where Autopsy Must Be Installed

Autopsy should be installed on the investigator's local forensic analysis workstation (running Windows 10/11 64-bit or Linux):

- **Official Download**: [https://www.autopsy.com/download/](https://www.autopsy.com/download/)
- **Default Windows Install Path**: `C:\Program Files\Autopsy-4.21.0\bin\autopsy64.exe`
- **Supported Autopsy Versions**: Autopsy 4.19.x, 4.20.x, 4.21.x+
- **Prerequisites**: Java Runtime (bundled with Autopsy 64-bit installer).

---

## 2. How the Analysis Worker Is Started

The analysis worker runs as a background service on the workstation.

1. Navigate to the project directory on your forensic computer:
   ```powershell
   cd "C:\path\to\smart-investigation-workspace"
   ```

2. Set the configuration environment variables in `.env` (or pass as CLI arguments):
   ```ini
   SERVER_URL=https://smart-investigation-workspace-1.onrender.com
   AUTOPSY_WORKER_SECRET=forensic-worker-shared-token-2026
   AUTOPSY_PATH=C:\Program Files\Autopsy-4.21.0\bin\autopsy64.exe
   ```

3. Launch the worker:
   ```powershell
   # Option A: Via npm script
   npm run autopsy:worker

   # Option B: Directly via Node CLI with explicit parameters
   node scripts/autopsyWorker.js --server https://smart-investigation-workspace-1.onrender.com --token forensic-worker-shared-token-2026 --interval 10000
   ```

---

## 3. How the Website Submits Authorized Analysis Jobs

1. An authorized investigator navigates to a case's evidence view: `/evidence/:id`.
2. Under the **Autopsy Digital Forensics Ingest** panel, the investigator selects the desired modules:
   - *File Type & Magic Byte Identification*
   - *Cryptographic Hash Verification (SHA-256)*
   - *Data Entropy & Steganography Detection*
   - *EXIF & Embedded Metadata Ingest*
   - *Forensic Artifact & Indicator Extraction (URLs, emails, IP addresses)*
3. The investigator clicks **Initiate Ingest Job**.
4. The system validates the investigator's authorization, creates a unique job identifier (e.g., `AJOB-2026-0001`), logs an immutable Chain of Custody event (`Evidence Submitted for Analysis`), and marks the job status as `Queued`.

---

## 4. How the Worker Authenticates with the Website

The worker authenticates using a cryptographically random shared secret token configured on both the server and worker:

- **Server Environment Variable**: `AUTOPSY_WORKER_SECRET` (configured in Render environment settings).
- **HTTP Header Authentication**: Every polling and update request sent by the worker must include:
  ```http
  x-worker-token: <AUTOPSY_WORKER_SECRET>
  x-worker-id: <WORKER_ID>
  ```
- Any request without a valid matching token receives an immediate `401 Unauthorized` response.

---

## 5. How Evidence Is Securely Made Available to the Worker

1. When a job is assigned to the worker, the payload includes the secure evidence stream URL: `/evidence/stream/:id`.
2. The worker retrieves the stream using its authenticated worker token.
3. The retrieved bytes are written into a temporary sandboxed forensic staging directory on the local analysis workstation (`./staging/case_<number>/`).
4. The worker calculates the SHA-256 hash of the downloaded stream to verify zero in-transit bit tampering before presenting the target to Autopsy.

---

## 6. How the Worker Runs the Supported Autopsy Workflow

1. The worker invokes Autopsy's command-line ingest tool:
   ```cmd
   autopsy64.exe --createCase --caseName="CASE001_E01" --caseBaseDir="C:\Cases" --addDataSource="C:\staging\evidence.raw"
   ```
2. The configured ingest modules execute against the evidence image:
   - Recent Activity (web history, bookmarks, downloads)
   - Hash Lookup (verifying against NSRL reference database)
   - Exif Parser (hardware timestamps and GPS metadata)
   - Keyword Search (regular expressions for sensitive indicators)
   - Embedded File Extractor (archives, embedded media)

---

## 7. How Reports Are Returned

1. Upon ingest completion, Autopsy produces HTML and XML forensic summary dossiers.
2. The worker reads the output report and transmits the results payload via `POST /api/autopsy/worker/update/:jobId`:
   ```json
   {
     "status": "Completed",
     "findingsCount": 14,
     "findings": [ ... ],
     "reportSummary": "Autopsy ingest completed with zero integrity faults.",
     "logOutput": "..."
   }
   ```
3. The server stores the forensic findings in MongoDB, logs a `Chain of Custody` event (`Analysis Completed`), and makes the report accessible through `/autopsy/report/:id`.

---

## 8. How Job Status and Errors Are Tracked

Job states follow a deterministic finite state machine:
- `Queued`: Awaiting worker pickup or server-side analysis engine dispatch.
- `Running`: Actively being analyzed; worker heartbeat logged.
- `Completed`: Analysis finished; findings and report attached.
- `Failed`: Ingest encountered an error; failure reason recorded in `failureReason` and error output preserved in `logOutput`.

All state transitions are visible in real-time on the **Autopsy Forensics Dashboard** (`/autopsy/jobs`).

---

## 9. How Original Evidence Remains Protected

1. **Read-Only Ingest**: The original evidence in MongoDB GridFS is never modified or rewritten.
2. **Cryptographic Sealing**: The original SHA-256 hash calculated at upload remains permanently recorded.
3. **Forensic Integrity Verification**: Any discrepancy between the calculated hash and the stored intake hash immediately triggers an `INTEGRITY_TAMPER_ALERT` and flags the Autopsy findings as anomalous.
4. **Local Staging Purge**: Once the worker completes analysis and transmits the report, the temporary staging copy is securely wiped from the local workstation.

---

## 10. Which Components Must Remain Running

For the complete hybrid cloud/workstation forensic workflow:

| Component | Host Environment | Requirement |
| :--- | :--- | :--- |
| **Node.js Web App** | Cloud Server (Render) | Always Running (handles web requests, authentication, and job dispatch) |
| **MongoDB Atlas** | Cloud Database | Always Running (stores persistent files via GridFS and database collections) |
| **Autopsy Worker (`autopsyWorker.js`)** | Local Forensic Workstation | Running during active investigation sessions when Autopsy processing is required |
| **Autopsy 4.21+** | Local Forensic Workstation | Executed automatically by the worker process when an ingest job is accepted |
