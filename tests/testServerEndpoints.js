require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const http = require('http');
const mongoose = require('mongoose');
const sharp = require('sharp');

const { connectDB } = require('../config/db');
const { app, server } = require('../server');
const Investigator = require('../models/Investigator');
const Case = require('../models/Case');
const Evidence = require('../models/Evidence');
const Custody = require('../models/Custody');
const Report = require('../models/Report');
const AnalysisJob = require('../models/AnalysisJob');
const EvidenceRequest = require('../models/EvidenceRequest');
const CriminalRecord = require('../models/CriminalRecord');

const TEST_PORT = 3199;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

// Simple Cookie Jar for fetch requests
let cookieHeader = '';

function updateCookieFromResponse(res) {
  const rawCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('set-cookie')].filter(Boolean);
  if (rawCookies && rawCookies.length > 0) {
    const parts = [];
    for (const cookieStr of rawCookies) {
      const match = cookieStr.match(/^([^;]+)/);
      if (match) parts.push(match[1]);
    }
    cookieHeader = parts.join('; ');
  }
}

async function request(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (cookieHeader) {
    headers['Cookie'] = cookieHeader;
  }
  options.headers = headers;
  options.redirect = options.redirect || 'manual'; // Don't auto follow redirects so we can assert 302s

  const res = await fetch(`${BASE_URL}${path}`, options);
  updateCookieFromResponse(res);
  return res;
}

// Helper to get session data from MongoDB
async function getSessionData() {
  const match = cookieHeader.match(/s%3A([a-zA-Z0-9_\-]+)\./) || cookieHeader.match(/connect\.sid=([^;]+)/);
  if (!match) return null;
  const sid = match[1].startsWith('s:') ? match[1].slice(2).split('.')[0] : match[1].split('.')[0].replace(/^s%3A/, '');

  const sessionDoc = await mongoose.connection.collection('sessions').findOne({ _id: sid });
  if (sessionDoc && sessionDoc.session) {
    return typeof sessionDoc.session === 'string' ? JSON.parse(sessionDoc.session) : sessionDoc.session;
  }
  return null;
}

let passedCount = 0;
let totalCount = 0;

async function check(name, fn) {
  totalCount++;
  try {
    await fn();
    console.log(`  [PASS] ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`  [FAIL] ${name}:`, err.message);
  }
}

async function runEndToEndTests() {
  console.log('================================================================');
  console.log(' RUNNING END-TO-END HTTP SERVER VERIFICATION TEST SUITE');
  console.log('================================================================\n');

  await connectDB();

  await new Promise((resolve) => {
    server.listen(TEST_PORT, () => {
      console.log(`[Test Server] Listening on ${BASE_URL}\n`);
      resolve();
    });
  });

  try {
    console.log('--- 1. PUBLIC ROUTES & WELCOME PAGE ---');

    await check('1.1 GET / (Root Welcome Page)', async () => {
      const res = await request('/');
      assert.strictEqual(res.status, 200);
      const text = await res.text();
      assert(text.includes('SMART INVESTIGATION WORKSPACE'), 'Must contain site title');
      assert(text.includes('Register'), 'Must contain Register button');
      assert(text.includes('Login'), 'Must contain Login button');
    });

    await check('1.2 GET /auth/login (Login Page)', async () => {
      const res = await request('/auth/login');
      assert.strictEqual(res.status, 200);
      const text = await res.text();
      assert(text.includes('Investigator Login'), 'Must contain page title');
      assert(text.includes('Official Government Email'), 'Must have official email field');
      assert(text.includes('<svg'), 'Must render SVG CAPTCHA');
    });

    await check('1.3 GET /auth/captcha (CAPTCHA Endpoint)', async () => {
      const res = await request('/auth/captcha');
      assert.strictEqual(res.status, 200);
      assert(res.headers.get('content-type').includes('image/svg+xml') || res.headers.get('content-type').includes('svg'));
      const text = await res.text();
      assert(text.includes('<svg'), 'Must return valid SVG');
    });

    await check('1.4 GET /auth/register (Registration Page)', async () => {
      const res = await request('/auth/register');
      assert.strictEqual(res.status, 200);
      const text = await res.text();
      assert(text.includes('Investigator Registration'), 'Must contain page title');
      assert(text.includes('xxx.yyy@gov.in'), 'Must specify government email format');
    });

    console.log('\n--- 2. ACCESS CONTROL & REDIRECTION ---');

    await check('2.1 GET /dashboard without auth redirects to /auth/login', async () => {
      // Clear cookie header to simulate unauthenticated client
      cookieHeader = '';
      const res = await request('/dashboard');
      assert.strictEqual(res.status, 302, 'Unauthenticated request must receive 302 redirect');
      const location = res.headers.get('location');
      assert(location.includes('/auth/login'), 'Must redirect to login page');
    });

    await check('2.2 GET /cases without auth redirects to /auth/login', async () => {
      cookieHeader = '';
      const res = await request('/cases');
      assert.strictEqual(res.status, 302);
      assert(res.headers.get('location').includes('/auth/login'));
    });

    console.log('\n--- 3. AUTHENTICATION WORKFLOW ---');

    await check('3.1 Authenticate with valid credentials + CAPTCHA', async () => {
      // 1. Load login page to create session and CAPTCHA
      await request('/auth/login');

      // 2. Retrieve CAPTCHA from session in MongoDB
      const sessionData = await getSessionData();
      assert(sessionData && sessionData.captcha, 'Session must contain CAPTCHA code');
      const validCaptcha = sessionData.captcha;

      // 3. Post login form with credentials
      const params = new URLSearchParams();
      params.append('email', 'detective.miller@gov.in');
      params.append('password', 'Password@123');
      params.append('captcha', validCaptcha);

      const res = await request('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString()
      });

      assert.strictEqual(res.status, 302, 'Successful login must redirect');
      assert(res.headers.get('location').includes('/dashboard'), 'Must redirect to dashboard');
    });

    console.log('\n--- 4. PROTECTED FORENSIC WORKSPACE ROUTES ---');

    await check('4.1 GET /dashboard with authenticated session', async () => {
      const res = await request('/dashboard');
      assert.strictEqual(res.status, 200);
      const text = await res.text();
      assert(text.includes('Investigator Operational Dashboard'), 'Must show dashboard');
      assert(text.includes('Detective Sarah Miller'), 'Must display logged-in investigator');
      assert(text.includes('Assigned Cases'), 'Must display metric cards');
    });

    await check('4.2 GET /cases (Existing Cases List)', async () => {
      const res = await request('/cases');
      assert.strictEqual(res.status, 200);
      const text = await res.text();
      assert(text.includes('Existing Investigation Cases'));
      assert(text.includes('CASE001'), 'Must list seeded case CASE001');
    });

    let createdCaseId = null;

    await check('4.3 POST /cases/new (Create New Case Ingestion)', async () => {
      const params = new URLSearchParams();
      params.append('caseName', 'Automated Integration Test Incident');
      params.append('crimeType', 'Murder');
      params.append('status', 'New');
      params.append('incidentDate', '2026-10-25');
      params.append('incidentTime', '14:30');
      params.append('incidentLocation', 'Sector 12 Forensic Facility');
      params.append('caseDescription', 'A suspicious duffel bag and a knife were recovered near the security perimeter.');
      params.append('knownObjects', 'knife, bag, weapon');
      params.append('reportingInvestigator', 'Detective Sarah Miller');
      params.append('department', 'Cyber & Forensic Special Unit');

      const res = await request('/cases/new', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString()
      });

      assert.strictEqual(res.status, 302, 'Case creation must redirect to case view');
      const location = res.headers.get('location');
      assert(location.startsWith('/cases/'), 'Must redirect to /cases/:id');
      createdCaseId = location.replace('/cases/', '').split('?')[0];
    });

    await check('4.4 GET /cases/:id (Comprehensive Case View)', async () => {
      assert(createdCaseId, 'Created case ID must exist');
      const res = await request(`/cases/${createdCaseId}`);
      assert.strictEqual(res.status, 200);
      const text = await res.text();
      assert(text.includes('Automated Integration Test Incident'));
      assert(text.includes('Sector 12 Forensic Facility'));
      assert(text.includes('Chain of Custody'));
    });

    let uploadedEvidenceId = null;

    await check('4.5 POST /evidence/upload (Upload Crime-Scene Evidence Image)', async () => {
      assert(createdCaseId, 'Created case ID must exist');

      // Create a test synthetic JPEG with Sharp
      const testImageBuffer = await sharp({
        create: {
          width: 640,
          height: 480,
          channels: 3,
          background: { r: 50, g: 100, b: 150 }
        }
      }).jpeg().toBuffer();

      // Build multipart request using native boundary
      const boundary = '----WebKitFormBoundaryForensicTest7MA4YWxkTrZu0gW';
      const bodyParts = [];

      bodyParts.push(Buffer.from(
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="caseId"\r\n\r\n` +
        `${createdCaseId}\r\n`
      ));

      bodyParts.push(Buffer.from(
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="generalDescription"\r\n\r\n` +
        `Synthetic forensic specimen test capture\r\n`
      ));

      bodyParts.push(Buffer.from(
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="evidenceFiles"; filename="test_specimen.jpg"\r\n` +
        `Content-Type: image/jpeg\r\n\r\n`
      ));
      bodyParts.push(testImageBuffer);
      bodyParts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

      const payload = Buffer.concat(bodyParts);

      const res = await request('/evidence/upload', {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`
        },
        body: payload
      });

      assert.strictEqual(res.status, 302, 'Evidence upload must redirect to case view');

      // Verify evidence is created in MongoDB
      const ev = await Evidence.findOne({ caseId: createdCaseId });
      assert(ev, 'Uploaded evidence must exist in MongoDB');
      assert.strictEqual(ev.originalFilename, 'test_specimen.jpg');
      assert.strictEqual(ev.sha256Hash.length, 64, 'Must compute SHA-256');
      uploadedEvidenceId = ev._id.toString();
    });

    await check('4.6 GET /evidence/:id (Inspect Evidence Image)', async () => {
      assert(uploadedEvidenceId);
      const res = await request(`/evidence/${uploadedEvidenceId}`);
      assert.strictEqual(res.status, 200);
      const text = await res.text();
      assert(text.includes('Evidence Photography Artifact'));
      assert(text.includes('Autopsy Digital Forensics Ingest'));
      assert(text.includes('Initiate Autopsy Forensic Ingest'));
    });

    await check('4.7 POST /evidence/:id/autopsy (Trigger Autopsy Digital Forensics Ingest)', async () => {
      assert(uploadedEvidenceId);
      const params = new URLSearchParams();
      params.append('modules', 'File Type Identification');
      params.append('modules', 'Cryptographic Hash Verification');

      const res = await request(`/evidence/${uploadedEvidenceId}/autopsy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString()
      });

      assert.strictEqual(res.status, 302, 'Inspection must redirect back to evidence page');

      // Verify AnalysisJob record in MongoDB
      const job = await AnalysisJob.findOne({ evidenceId: uploadedEvidenceId });
      assert(job, 'AnalysisJob record must be persisted');
      assert(job.jobIdentifier.startsWith('AJOB-'));
    });

    await check('4.8 GET /autopsy/jobs (Autopsy Jobs Dashboard)', async () => {
      const res = await request('/autopsy/jobs');
      assert.strictEqual(res.status, 200);
      const text = await res.text();
      assert(text.includes('Autopsy Forensic Analysis Jobs'));
    });

    await check('4.9 GET /evidence/requests (Evidence Sharing Requests Dashboard)', async () => {
      const res = await request('/evidence/requests');
      assert.strictEqual(res.status, 200);
      const text = await res.text();
      assert(text.includes('Evidence Access & Secure Sharing Requests'));
    });

    await check('4.10 GET /criminals (Criminal Registry & Suspect Dossiers)', async () => {
      const res = await request('/criminals');
      assert.strictEqual(res.status, 200);
      const text = await res.text();
      assert(text.includes('Criminal Records & Suspect Dossiers'));
    });

    await check('4.11 GET /custody (Chain of Custody Dashboard)', async () => {
      const res = await request('/custody');
      assert.strictEqual(res.status, 200);
      const text = await res.text();
      assert(text.includes('Chain of Custody'));
      assert(text.includes('Chain of Custody & Evidence Ledger'));
    });

    await check('4.12 GET /contacts (Investigator Directory & Communication)', async () => {
      const res = await request('/contacts');
      assert.strictEqual(res.status, 200);
      const text = await res.text();
      assert(text.includes('Investigator Contacts'));
    });

    await check('4.13 GET /messages (Real-Time Communication Interface)', async () => {
      const res = await request('/messages');
      // If user has contacts, /messages auto-redirects (302) to first contact's chat
      if (res.status === 302) {
        const redirectedLocation = res.headers.get('location');
        assert(redirectedLocation.startsWith('/messages?recipientId='));
        const chatRes = await request(redirectedLocation);
        assert.strictEqual(chatRes.status, 200);
        const text = await chatRes.text();
        assert(text.includes('Investigator Communication'));
      } else {
        assert.strictEqual(res.status, 200);
        const text = await res.text();
        assert(text.includes('Investigator Communication'));
      }
    });

    let generatedReportId = null;

    await check('4.14 GET /reports (Reports Center)', async () => {
      const res = await request('/reports');
      assert.strictEqual(res.status, 200);
      const text = await res.text();
      assert(text.includes('Investigation Reports'));
    });

    await check('4.15 POST /reports/generate (Generate PDF Investigation Report)', async () => {
      assert(createdCaseId);
      const params = new URLSearchParams();
      params.append('caseId', createdCaseId);

      const res = await request('/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString()
      });

      assert.strictEqual(res.status, 302);
      const location = res.headers.get('location');
      assert(location.startsWith('/reports/view/'));
      generatedReportId = location.replace('/reports/view/', '').split('?')[0];

      // Verify Report in DB
      const report = await Report.findById(generatedReportId);
      assert(report, 'Report document must exist');
      assert.strictEqual(report.pdfSha256Hash.length, 64);
      assert(fs.existsSync(report.protectedFileReference), 'PDF file must exist on disk');
    });

    await check('4.16 GET /reports/download/:id (Download Authenticated PDF Report)', async () => {
      assert(generatedReportId);
      const res = await request(`/reports/download/${generatedReportId}`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.headers.get('content-type'), 'application/pdf');
      const buffer = Buffer.from(await res.arrayBuffer());
      assert(buffer.length > 1000, 'PDF buffer must have content');
      assert(buffer.subarray(0, 4).toString() === '%PDF', 'Must start with PDF header bytes');
    });

    await check('4.17 Cache-Control Headers on Protected Routes', async () => {
      const res = await request('/dashboard');
      assert.strictEqual(res.status, 200);
      const cacheControl = res.headers.get('cache-control') || '';
      assert(cacheControl.includes('no-store'), 'Protected route must enforce no-store');
      assert(cacheControl.includes('no-cache'), 'Protected route must enforce no-cache');
    });

    await check('4.18 GET /auth/logout (Secure Sign Out)', async () => {
      const res = await request('/auth/logout');
      assert.strictEqual(res.status, 302);
      assert.strictEqual(res.headers.get('location'), '/?success=You+have+been+securely+signed+out.');

      // After logout, accessing /dashboard must redirect again
      const dashRes = await request('/dashboard');
      assert.strictEqual(dashRes.status, 302);
      assert(dashRes.headers.get('location').includes('/auth/login'));
    });

    // Cleanup test artifacts from database
    if (createdCaseId) {
      await Case.findByIdAndDelete(createdCaseId);
      await Evidence.deleteMany({ caseId: createdCaseId });
      await AnalysisJob.deleteMany({ caseId: createdCaseId });
      await Custody.deleteMany({ caseId: createdCaseId });
      if (generatedReportId) {
        const report = await Report.findById(generatedReportId);
        if (report && fs.existsSync(report.protectedFileReference)) {
          fs.unlinkSync(report.protectedFileReference);
        }
        await Report.findByIdAndDelete(generatedReportId);
      }
    }

  } finally {
    server.close();
  }

  console.log('\n================================================================');
  console.log(` END-TO-END TEST RESULTS: ${passedCount}/${totalCount} TESTS PASSED`);
  console.log('================================================================\n');

  if (passedCount === totalCount) {
    console.log('ALL WEB ENDPOINTS & INVESTIGATION WORKFLOWS VERIFIED WORKING!');
    process.exit(0);
  } else {
    console.error(`FAILED ${totalCount - passedCount} TESTS.`);
    process.exit(1);
  }
}

runEndToEndTests().catch(err => {
  console.error('[End-to-End Suite Fatal Error]:', err);
  process.exit(1);
});
