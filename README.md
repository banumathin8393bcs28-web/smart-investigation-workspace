# Smart Investigation Workspace

**Smart Investigation Workspace** is an internal digital investigation and evidence management web application designed for certified law enforcement and forensic investigators. It provides end-to-end tooling to organize crime-scene photographs, extract EXIF metadata, calculate tamper-evident SHA-256 cryptographic digests, execute AI computer-vision object detection with Ultralytics YOLOv8, maintain immutable chain-of-custody ledgers, collaborate via real-time messaging, and compile comprehensive forensic PDF investigation reports.

---

## 1. Technology Stack

* **Frontend**: HTML5, CSS3, Bootstrap 5.3.3, Bootstrap Icons, Vanilla JavaScript, EJS Templates
* **Backend**: Node.js v24.x, Express.js v4.22.x
* **Database**: MongoDB Community Server 9.0, Mongoose v8.24.x (Only database used)
* **Authentication & Security**: Express Session, connect-mongo (MongoDB session store), bcryptjs, svg-captcha (Server-side CAPTCHA), express-validator, Helmet (HTTP security headers), express-rate-limit
* **Image Uploads & Processing**: Multer, Sharp v0.33.5, Exif-parser, Node.js Crypto (SHA-256)
* **AI Computer Vision**: Python 3.14, Ultralytics YOLOv8 (`yolov8n.pt`), PyTorch, OpenCV, FastAPI & Uvicorn
* **Communication**: Socket.IO v4.8.x with MongoDB persistence
* **Reports**: PDFKit v0.15.2 with cryptographic PDF hash verification

---

## 2. System Architecture & Directory Structure

```
smart-investigation-workspace/
├── server.js                        # Express server entry point & Socket.IO engine
├── package.json                     # Node.js dependencies and scripts
├── .env.example                     # Environment variable blueprint
├── .env                             # Active environment configuration (git-ignored)
├── .gitignore                       # Git exclusion rules
├── README.md                        # Complete project manual & runbook
├── start.bat                        # One-click Windows launch script
│
├── .vscode/                         # Visual Studio Code configurations
│   ├── launch.json                  # F5 Debugger configs for Node.js, Tests, and Seeder
│   ├── settings.json                # Workspace formatting settings
│   └── tasks.json                   # Build and test tasks
│
├── config/
│   └── db.js                        # Central MongoDB connection manager via Mongoose
│
├── models/                          # Mongoose Data Models with validation & indexes
│   ├── Investigator.js              # Officer profile, credentials, security questions
│   ├── Case.js                      # Investigation cases with immutable creation dates
│   ├── Scene.js                     # Crime-scene sector records
│   ├── Evidence.js                  # Digital evidence files, metadata, SHA-256 digests
│   ├── AIInspection.js              # YOLOv8 detection boxes, confidence, context matches
│   ├── Contact.js                   # Verified colleague directory connections
│   ├── Message.js                   # Persistent Socket.IO messages & safe attachments
│   ├── Notification.js              # Real-time and offline alerts
│   ├── Custody.js                   # Append-only chain of custody & transfer workflows
│   ├── AuditLog.js                  # Security journal of all workstation operations
│   ├── Counter.js                   # Atomic sequence counters (CASE001, CUST-0001...)
│   └── Report.js                    # Generated PDF reports and PDF SHA-256 hashes
│
├── routes/                          # Express route controllers
│   ├── auth.js                      # Register, Login, CAPTCHA, Password reset, Logout
│   ├── dashboard.js                 # Metric aggregation & active case dashboard
│   ├── profile.js                   # Profile management & password updates
│   ├── cases.js                     # Ingest, list, filter, search, view, and edit cases
│   ├── scenes.js                    # Crime-scene sector details
│   ├── evidence.js                  # Multi-upload, metadata, SHA-256, AI inspection
│   ├── contacts.js                  # Colleague search by @gov.in email & approvals
│   ├── messages.js                  # Real-time chat & attachment downloads
│   ├── notifications.js             # Notification center
│   ├── custody.js                   # Transfer workflow & custody action ledger
│   └── reports.js                   # PDF report generation & authenticated download
│
├── middleware/
│   ├── auth.js                      # Session enforcement & inactivity timeouts
│   ├── validation.js                # express-validator rules (xxx.yyy@gov.in, passwords)
│   ├── authorization.js             # Resource-level access control (Case/Evidence/Report)
│   └── upload.js                    # Multer private uploads & executable rejection
│
├── services/
│   ├── caseNumberService.js         # Atomic concurrency-safe counter generator
│   ├── timestampService.js          # Authoritative UTC storage & Asia/Kolkata display
│   ├── hashService.js               # Cryptographic SHA-256 byte calculators
│   ├── metadataService.js           # Sharp image properties & Exif-parser
│   ├── aiService.js                 # Case context extraction & YOLO image annotation
│   ├── notificationService.js       # Persistent notification records & Socket.IO emits
│   ├── custodyService.js            # Chain of custody transfer state machine
│   └── reportService.js             # PDFKit investigation report generation
│
├── ai_service/                      # Python AI Microservice
│   ├── app.py                       # FastAPI Ultralytics YOLOv8 inference service
│   ├── requirements.txt             # Python requirements
│   └── README.md                    # AI microservice instructions
│
├── views/                           # Government administrative EJS templates
│   ├── home.ejs                     # Welcome page with Register/Login
│   ├── dashboard/                   # Metric figures & recent activity
│   ├── auth/                        # Register, Login, Forgot password
│   ├── profile/                     # Profile details & password change
│   ├── cases/                       # Case intake, directory, details, and edit
│   ├── evidence/                    # Multi-upload & inspection viewer
│   ├── contacts/                    # Directory & colleague search
│   ├── messages/                    # Real-time chat stream
│   ├── custody/                     # Custody ledger & transfer workflow
│   ├── reports/                     # Report generator & viewer
│   ├── notifications/               # Notification inbox
│   └── partials/                    # Header, sidebar, footer, error
│
├── public/                          # Public static assets
│   ├── css/style.css                # Government administrative stylesheet
│   ├── js/main.js                   # Clock, CAPTCHA refresh, copy hash, beforeunload
│   └── images/                      # Default avatars & logos
│
├── private_uploads/                 # Private file vault (NOT publicly exposed)
│   ├── evidence/                    # Raw uploaded crime-scene images
│   ├── profiles/                    # Officer profile photographs
│   ├── chat/                        # Message attachments
│   ├── reports/                     # Generated PDF reports
│   └── annotated/                   # YOLOv8 annotated image derivatives
│
├── scripts/
│   └── seedDatabase.js              # Database seeder for demo accounts & cases
│
└── tests/
    └── runAllTests.js               # Comprehensive 14-point verification test suite
```

---

## 3. Pre-requisites & Required Software

1. **Node.js**: v18.x or v20.x or v24.x ([Download Node.js](https://nodejs.org/))
2. **MongoDB Community Server**: Version 7.0, 8.0, or 9.0 running locally on port `27017`
3. **Python**: Python 3.10, 3.11, 3.12, 3.13, or 3.14 with `pip`
4. **Visual Studio Code**: Recommended IDE for debugging and editing

---

## 4. Installation Steps

### Step 1: Open Project in VS Code
Open VS Code, press `Ctrl+O` (or `File` -> `Open Folder...`), and select the project folder:
`C:\Users\swarn\.gemini\antigravity\scratch\smart-investigation-workspace`

### Step 2: Install Node.js Dependencies
Open the VS Code Integrated Terminal (`Ctrl+\`` or `Terminal` -> `New Terminal`) and run:
```bash
npm install
```
*(On Windows PowerShell, use `npm.cmd install` if script execution policies apply)*.

### Step 3: Install Python AI Dependencies
In the terminal, install the Python microservice dependencies:
```bash
pip install fastapi uvicorn pydantic pillow ultralytics torch torchvision opencv-python
```

### Step 4: Verify MongoDB is Running
Ensure your local MongoDB Community Server is active. On Windows:
```powershell
Get-Service -Name MongoDB
```
*(If it is stopped, start it via `net start MongoDB` or Windows Services)*.

### Step 5: Seed the Database
Populate the database with default test accounts, sample cases, evidence files, and counters:
```bash
npm run seed
```

---

## 5. Pre-configured Official Test Accounts

The seeder initializes three certified investigator accounts conforming to the official government pattern (`xxx.yyy@gov.in`):

| Officer Name | Official Email | Password | Security Question | Answer | Role |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Detective Sarah Miller** | `detective.miller@gov.in` | `Password@123` | What is your childhood nickname? | `oxford` | Lead Investigator |
| **Inspector David Chen** | `david.chen@gov.in` | `Password@123` | What is your favourite book? | `sherlock` | Senior Detective |
| **Kanya T** | `kanya.t@gov.in` | `Password@123` | What is the name of your first pet? | `mobi` | Cybercrime Investigator |

---

## 6. How to Run the Application

You can launch the project using **VS Code Debugger (F5)**, **npm scripts**, or the included **start.bat** launcher.

### Option A: Running Inside VS Code (Recommended)
1. Open the **Run and Debug** panel in VS Code (`Ctrl+Shift+D`).
2. Select **"1. Start Smart Investigation Server (Node.js)"** from the dropdown.
3. Press **F5** or click the green Play button.
4. The server launches in the integrated terminal and listens at `http://localhost:3000`.

### Option B: Terminal Command Line
In one terminal window, start the Node.js application:
```bash
npm start
```

In a second terminal window (to enable live AI computer vision detection), start the Python YOLO microservice:
```bash
npm run ai:start
# Or directly:
python ai_service/app.py
```

### Option C: Double-click start.bat
Double-click `start.bat` in the project root to start the server.

---

## 7. Running the Automated Test Suite

The project includes an automated 14-point test suite covering authentication, regex enforcement, case immutability, SHA-256 calculation, AI keyword extraction, chain-of-custody transfer state machines, and PDFKit report generation:

```bash
npm test
```
All 14 tests run against the active MongoDB database and print:
`TEST EXECUTION SUMMARY: 14/14 TESTS PASSED`

---

## 8. Operational Walkthrough & Features

### 1. Welcome Page (`/`)
* Displays the clean title **"SMART INVESTIGATION WORKSPACE"** and subtitle: *"A secure workspace for investigation case management and digital evidence organization."*
* Two primary buttons: **Register** and **Login**.
* Direct access to protected dashboard or case information is blocked for unauthenticated users.

### 2. Investigator Registration (`/auth/register`)
* **Email Format**: Must match `xxx.yyy@gov.in`. Verified on both frontend and backend.
* **Age Calculation**: Enter Date of Birth; the age is automatically calculated and verified.
* **Password Policy**: Requires $\ge 8$ characters, at least 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special symbol. Show/hide password controls included.
* **Security Question**: Dropdown of 5 questions with a normalized single-word answer, hashed with bcryptjs.
* **Server-side CAPTCHA**: Generated with `svg-captcha`, verified on server with refresh capability.

### 3. Investigator Login & Lockout Protection (`/auth/login`)
* Validates official email, password, and CAPTCHA.
* **Failed Login Security**:
  * Tracks consecutive failed attempts.
  * After **3 consecutive failed password attempts**, the system triggers the investigator's personal security question.
  * A correct security answer **does not** bypass the password check—the correct password is still strictly required.
  * After 5 failures, a temporary 15-minute account lockout is enforced.

### 4. Investigator Dashboard (`/dashboard`)
* Top navigation displays project identity, investigator avatar, active name, live running clock (`Asia/Kolkata` local time), and unread notification badge.
* Menu options: Edit Profile, Create New Case, View Existing Cases, Investigator Communication, Chain of Custody, Generate Report, Notifications, and Sign Out.
* Six live metric figures computed dynamically from MongoDB records:
  * Assigned Cases
  * Active Cases
  * Closed Cases
  * Evidence Files
  * Pending Transfers
  * Unread Messages

### 5. Ingest New Case (`/cases/new`)
* Generates concurrency-safe atomic sequence case numbers (`CASE001`, `CASE002`, `CASE003`...).
* Records authoritative server UTC creation timestamp that remains unchanged when edited.
* Crime classifications include Theft, Murder, Robbery, Assault, Burglary, Cybercrime, Fraud, Missing Person, Drug-Related Crime, and Other.
* Fields for incident date, time, location, description, reporting investigator, preliminary findings, and known objects.

### 6. Add Crime-Scene Pictures & Metadata (`/evidence/upload`)
* Select multiple images from computer (JPG, JPEG, PNG, WebP).
* Multer stores original files securely in `private_uploads` (never in a public static directory).
* Automatically calculates SHA-256 hash from raw original file bytes.
* Sharp extracts width, height, format, channels, and color space.
* Exif-parser extracts camera make, model, original timestamp, and GPS coordinates (or displays *"No EXIF metadata available"*).
* Generates separate thumbnail in `private_uploads/evidence/thumbnails/`.

### 7. AI Object Detection & Computer Vision (`/evidence/:id`)
* Press the **Inspect** button on any evidence photograph.
* System extracts relevant search terms from the case narrative (e.g. knife, weapon, vehicle, bag, phone, tool).
* YOLOv8 neural network detects objects, identifies bounding boxes, and calculates confidence scores.
* Sharp generates an annotated overlay derivative in `private_uploads/annotated/` while **leaving the original evidence file untouched**.
* Displays clear disclaimers that AI detections are preliminary computer predictions and do not constitute conclusive judicial proof.
* If the Python AI service is offline, reports `Service Unavailable` with installation instructions without fabricating false detections.

### 8. Investigator Communication & Chat (`/contacts` & `/messages`)
* Search colleagues by official `@gov.in` email and send connection requests.
* Real-time messaging powered by Socket.IO with MongoDB persistence.
* Supports safe attachments (images, PDFs, text files). Dangerous executables (.exe, .bat, .dll) are rejected.
* Offline colleagues receive persistent notifications and unread badges.

### 9. Chain of Custody & Case Transfers (`/custody`)
* Formal transfer workflow: Officer A initiates case transfer $\rightarrow$ Officer B receives dashboard alert $\rightarrow$ Officer B reviews and accepts or declines with reason.
* Once accepted, case assignment updates and appears in Officer B's assigned cases.
* Immutable append-only audit ledger tracks all custody movements with timestamps and SHA-256 digests.

### 10. Generate Investigation PDF Report (`/reports`)
* Built with PDFKit to generate official investigation dossiers.
* Includes header, case specifications, investigator details, profile photograph, crime-scene images with SHA-256 hashes, EXIF metadata tables, AI bounding-box detection results, chronological custody ledger, and audit history.
* Computes and stores a SHA-256 hash of the generated PDF file.
* Authenticated downloads prevent unauthorized access.

### 11. Sign Out & Inactivity Timeout
* Prominent Sign Out button destroys server session, clears session cookies, and logs the sign-out event.
* Browser `beforeunload` warning prompts investigators if they attempt to close the tab without signing out.
* Session expires after 30 minutes of inactivity.

---

## 9. Common Errors & Troubleshooting

| Issue | Cause | Fix |
| :--- | :--- | :--- |
| **`MongoServerSelectionError: connect ECONNREFUSED 127.0.0.1:27017`** | MongoDB Community Server is not running. | Run `net start MongoDB` or start the MongoDB service from Windows Services (`services.msc`). |
| **`npm.ps1 cannot be loaded because running scripts is disabled`** | Windows PowerShell script execution policy. | Use `npm.cmd run start` or `npm.cmd test` instead of `npm`. |
| **`AI Inspection status: Service Unavailable`** | Python AI microservice is not running. | Open a separate terminal and run `python ai_service/app.py` or `npm run ai:start`. |
| **`Official email must follow xxx.yyy@gov.in format`** | Email entered does not match the official government pattern. | Use the required format: `name.dept@gov.in` (e.g., `detective.miller@gov.in`). |
| **`Account temporarily locked`** | 5 consecutive failed login attempts occurred. | Wait 15 minutes for the lockout to expire, or use the "Forgot Password" security question reset. |

---

## 10. License

Confidential Internal Software &copy; 2026 Central Digital Forensics & Crime Investigation Division. All rights reserved.
