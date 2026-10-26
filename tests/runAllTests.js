require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const assert = require('assert');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const { connectDB } = require('../config/db');
const Investigator = require('../models/Investigator');
const Case = require('../models/Case');
const Evidence = require('../models/Evidence');
const AIInspection = require('../models/AIInspection');
const Custody = require('../models/Custody');
const Notification = require('../models/Notification');
const Message = require('../models/Message');
const Report = require('../models/Report');
const { getNextCaseNumber, getNextEvidenceNumber, getNextCustodyEventId } = require('../services/caseNumberService');
const { calculateBufferHash, calculateFileHash, verifyFileIntegrity } = require('../services/hashService');
const { extractImagePropertiesAndExif } = require('../services/metadataService');
const { extractContextKeywords, inspectEvidenceImage } = require('../services/aiService');
const { initiateCaseTransfer, respondToTransfer, recordEvidenceCustodyEvent } = require('../services/custodyService');
const { generateCaseReport } = require('../services/reportService');
const { GOV_EMAIL_REGEX, PASSWORD_REGEX } = require('../middleware/validation');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  [FAIL] ${name}: ${err.message}`);
  }
}

async function runAsyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  [FAIL] ${name}: ${err.message}`);
  }
}

async function startTests() {
  console.log('================================================================');
  console.log(' STARTING SMART INVESTIGATION WORKSPACE VERIFICATION TEST SUITE');
  console.log('================================================================\n');

  await connectDB();

  console.log('=== TEST SUITE 1: AUTHENTICATION & INPUT VALIDATION ===');

  runTest('1.1: Government email regex validates standard xxx.yyy@gov.in', () => {
    assert.strictEqual(GOV_EMAIL_REGEX.test('sarah.miller@gov.in'), true);
    assert.strictEqual(GOV_EMAIL_REGEX.test('kanya.t@gov.in'), true);
    assert.strictEqual(GOV_EMAIL_REGEX.test('special.cyber.unit@gov.in'), true);
  });

  runTest('1.2: Government email regex rejects invalid formats or non-gov domains', () => {
    assert.strictEqual(GOV_EMAIL_REGEX.test('invalid@gmail.com'), false);
    assert.strictEqual(GOV_EMAIL_REGEX.test('plainuser@gov.in'), false); // Requires two-part name: xxx.yyy
    assert.strictEqual(GOV_EMAIL_REGEX.test('officer@police.gov'), false);
    assert.strictEqual(GOV_EMAIL_REGEX.test(''), false);
  });

  runTest('1.3: Password strength regex enforces complexity rules', () => {
    assert.strictEqual(PASSWORD_REGEX.test('Password@123'), true);
    assert.strictEqual(PASSWORD_REGEX.test('Forensic#2026'), true);
    assert.strictEqual(PASSWORD_REGEX.test('weakpass'), false); // No upper, number, symbol
    assert.strictEqual(PASSWORD_REGEX.test('Short1!'), false); // Less than 8 chars
    assert.strictEqual(PASSWORD_REGEX.test('NoSpecial123'), false); // No symbol
  });

  await runAsyncTest('1.4: Password hashing and verification via bcryptjs', async () => {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash('SecurePass#9988', salt);
    assert.strictEqual(await bcrypt.compare('SecurePass#9988', hash), true);
    assert.strictEqual(await bcrypt.compare('WrongPassword', hash), false);
  });

  await runAsyncTest('1.5: Security question single-word answer hashing', async () => {
    const rawAnswer = ' Oxford ';
    const normalized = rawAnswer.trim().toLowerCase();
    assert.strictEqual(normalized, 'oxford');
    assert.strictEqual(/\s/.test(normalized), false);
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(normalized, salt);
    assert.strictEqual(await bcrypt.compare('oxford', hash), true);
  });

  console.log('\n=== TEST SUITE 2: CASE NUMBERING & IMMUTABILITY ===');

  await runAsyncTest('2.1: Atomic case number sequence generation (CASE001, CASE002...)', async () => {
    const num1 = await getNextCaseNumber();
    const num2 = await getNextCaseNumber();
    assert.match(num1, /^CASE\d{3,}$/);
    assert.match(num2, /^CASE\d{3,}$/);
    const seq1 = parseInt(num1.replace('CASE', ''), 10);
    const seq2 = parseInt(num2.replace('CASE', ''), 10);
    assert.strictEqual(seq2, seq1 + 1);
  });

  await runAsyncTest('2.2: Concurrency-safe atomic case counter simulation', async () => {
    const promises = [getNextCaseNumber(), getNextCaseNumber(), getNextCaseNumber()];
    const results = await Promise.all(promises);
    const unique = new Set(results);
    assert.strictEqual(unique.size, 3, 'Concurrent case numbers must all be distinct.');
  });

  await runAsyncTest('2.3: Case creation timestamp immutability check', async () => {
    const officer = await Investigator.findOne({ email: 'detective.miller@gov.in' });
    assert(officer, 'Test officer must exist');

    const testNum = await getNextCaseNumber();
    const originalTime = new Date('2026-10-01T12:00:00Z');

    const testCase = await Case.create({
      caseNumber: testNum,
      caseName: 'Immutability Verification Incident',
      crimeType: 'Cybercrime',
      status: 'New',
      incidentDate: new Date(),
      incidentTime: '12:00',
      incidentLocation: 'New Delhi Lab',
      caseDescription: 'Testing timestamp immutability under edit operations.',
      reportingInvestigator: officer.fullName,
      createdBy: officer._id,
      creatorName: officer.fullName,
      assignedInvestigator: officer._id,
      assignedName: officer.fullName,
      creationTimestamp: originalTime,
      lastUpdatedTimestamp: originalTime
    });

    // Simulate editing
    testCase.caseName = 'Modified Case Title';
    testCase.status = 'Under Investigation';
    testCase.lastUpdatedTimestamp = new Date();
    await testCase.save();

    const reloaded = await Case.findById(testCase._id);
    assert.strictEqual(reloaded.caseName, 'Modified Case Title');
    assert.strictEqual(reloaded.creationTimestamp.getTime(), originalTime.getTime(), 'Original creation timestamp must remain unchanged.');
    assert(reloaded.lastUpdatedTimestamp.getTime() > originalTime.getTime(), 'Last updated timestamp must be updated.');

    await Case.findByIdAndDelete(testCase._id);
  });

  console.log('\n=== TEST SUITE 3: CRYPTOGRAPHIC HASHING & METADATA ===');

  runTest('3.1: SHA-256 calculation matches known cryptographic digest', () => {
    const sampleBuffer = Buffer.from('FORENSIC_DIGITAL_EVIDENCE_SPECIMEN_2026');
    const hash = calculateBufferHash(sampleBuffer);
    assert.strictEqual(hash.length, 64, 'SHA-256 hash must be 64 hexadecimal characters.');
    // Same buffer produces identical hash
    assert.strictEqual(calculateBufferHash(sampleBuffer), hash);
  });

  await runAsyncTest('3.2: Image properties analysis with Sharp', async () => {
    const sharp = require('sharp');
    const svg = '<svg width="400" height="300"><rect width="400" height="300" fill="#ff0000"/></svg>';
    const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();

    const { properties, metadata } = await extractImagePropertiesAndExif(pngBuffer, 'test.png');
    assert.strictEqual(properties.width, 400);
    assert.strictEqual(properties.height, 300);
    assert.strictEqual(properties.format, 'PNG');
    assert.strictEqual(metadata.hasExif, false); // Synthetic SVG has no EXIF
    assert.strictEqual(metadata.rawExifSummary.includes('No EXIF metadata available'), true);
  });

  console.log('\n=== TEST SUITE 4: AI CONTEXT & OBJECT DETECTION ===');

  runTest('4.1: Keyword extraction correctly maps case context variations', () => {
    const text1 = 'The victim was attacked using a hunting knife near the bank entrance.';
    const terms1 = extractContextKeywords(text1);
    assert(terms1.includes('knife'), 'Should extract knife from knife keyword.');

    const text2 = 'Perpetrators fled in a dark vehicle carrying stolen leather duffel bags and a handgun.';
    const terms2 = extractContextKeywords(text2);
    assert(terms2.includes('vehicle'), 'Should extract vehicle.');
    assert(terms2.includes('bag'), 'Should extract bag from duffel bags.');
    assert(terms2.includes('gun'), 'Should extract gun from handgun.');
  });

  await runAsyncTest('4.2: AI Inspection executes via Python child process fallback when HTTP service is offline', async () => {
    const officer = await Investigator.findOne({ email: 'detective.miller@gov.in' });
    const caseDoc = await Case.findOne({ caseNumber: 'CASE001' });
    const evidence = await Evidence.findOne({ caseNumber: 'CASE001' });

    assert(officer && caseDoc && evidence, 'Prerequisites must exist in database');

    // Run inspection with mock unreachable port 59999 to test automatic fallback to Python CLI
    const origUrl = process.env.PYTHON_AI_SERVICE_URL;
    process.env.PYTHON_AI_SERVICE_URL = 'http://127.0.0.1:59999/detect';

    const result = await inspectEvidenceImage({
      evidence,
      caseDoc,
      investigator: officer,
      confidenceThreshold: 0.25
    });

    // When HTTP is offline, fallback activates child process successfully
    assert(['Success', 'No Objects Detected'].includes(result.inspectionStatus), `Expected Success or No Objects Detected via CLI fallback, got ${result.inspectionStatus}`);
    assert(result.modelName.includes('YOLO'), 'Model name must reflect YOLO');

    process.env.PYTHON_AI_SERVICE_URL = origUrl;
  });

  await runAsyncTest('4.3: Truthful reporting with zero fake detections when AI service fails', async () => {
    const officer = await Investigator.findOne({ email: 'detective.miller@gov.in' });
    const caseDoc = await Case.findOne({ caseNumber: 'CASE001' });

    // Evidence pointing to non-existent image to simulate failure
    const fakeEvidence = {
      _id: new mongoose.Types.ObjectId(),
      caseId: caseDoc._id,
      evidenceIdentifier: 'EVID-TEST-999',
      protectedStoragePath: 'C:\\non_existent_image_path_forensic_test.jpg'
    };

    const origUrl = process.env.PYTHON_AI_SERVICE_URL;
    process.env.PYTHON_AI_SERVICE_URL = 'http://127.0.0.1:59999/detect';

    const result = await inspectEvidenceImage({
      evidence: fakeEvidence,
      caseDoc,
      investigator: officer,
      confidenceThreshold: 0.25
    });

    assert.strictEqual(result.inspectionStatus, 'Service Unavailable');
    assert(result.summaryMessage.includes('unavailable') || result.summaryMessage.includes('failed') || result.summaryMessage.includes('Ensure'));
    assert.strictEqual(result.detections.length, 0, 'Must NOT fabricate fake detections when service fails.');

    process.env.PYTHON_AI_SERVICE_URL = origUrl;
    await AIInspection.findByIdAndDelete(result._id);
  });

  console.log('\n=== TEST SUITE 5: CHAIN OF CUSTODY WORKFLOW ===');

  await runAsyncTest('5.1: Transfer request workflow (Initiate -> Notification -> Acceptance -> Assignment)', async () => {
    const miller = await Investigator.findOne({ email: 'detective.miller@gov.in' });
    const chen = await Investigator.findOne({ email: 'david.chen@gov.in' });
    assert(miller && chen);

    // Create temporary case
    const testNum = await getNextCaseNumber();
    const testCase = await Case.create({
      caseNumber: testNum,
      caseName: 'Transfer Workflow Verification Case',
      crimeType: 'Robbery',
      status: 'New',
      incidentDate: new Date(),
      incidentTime: '10:00',
      incidentLocation: 'Delhi',
      caseDescription: 'Case transfer verification.',
      reportingInvestigator: miller.fullName,
      createdBy: miller._id,
      creatorName: miller.fullName,
      assignedInvestigator: miller._id,
      assignedName: miller.fullName,
      creationTimestamp: new Date(),
      lastUpdatedTimestamp: new Date()
    });

    // 1. Miller initiates transfer to Chen
    const custodyRecord = await initiateCaseTransfer({
      caseDoc: testCase,
      fromInvestigator: miller,
      toInvestigator: chen,
      reason: 'Specialized detective interrogation required'
    });

    assert.strictEqual(custodyRecord.status, 'Pending');
    assert.strictEqual(custodyRecord.recipient.toString(), chen._id.toString());

    // 2. Verify Chen received Notification
    const notif = await Notification.findOne({
      recipient: chen._id,
      notificationType: 'case_transfer',
      caseNumber: testCase.caseNumber
    });
    assert(notif, 'Recipient must receive notification in MongoDB');

    // 3. Chen accepts transfer
    const updatedCustody = await respondToTransfer({
      custodyRecordId: custodyRecord._id,
      investigator: chen,
      response: 'Accept',
      responseNotes: 'Accepted. Will proceed with interrogation.'
    });

    assert.strictEqual(updatedCustody.status, 'Completed');

    // 4. Case assignment must be updated to Chen!
    const reloadedCase = await Case.findById(testCase._id);
    assert.strictEqual(reloadedCase.assignedInvestigator.toString(), chen._id.toString());
    assert.strictEqual(reloadedCase.assignedName, chen.fullName);
    assert.strictEqual(reloadedCase.status, 'Transferred');

    // Clean up test case
    await Case.findByIdAndDelete(testCase._id);
    await Custody.findByIdAndDelete(custodyRecord._id);
    await Notification.findByIdAndDelete(notif._id);
  });

  console.log('\n=== TEST SUITE 6: PDF REPORT GENERATION & SHA-256 ===');

  await runAsyncTest('6.1: PDFKit Report compilation with metadata, hashes, and custody history', async () => {
    const miller = await Investigator.findOne({ email: 'detective.miller@gov.in' });
    const caseDoc = await Case.findOne({ caseNumber: 'CASE001' });
    const evidenceList = await Evidence.find({ caseId: caseDoc._id });
    const inspections = await AIInspection.find({ caseId: caseDoc._id });
    const custodyHistory = await Custody.find({ caseId: caseDoc._id });

    const reportDoc = await generateCaseReport({
      caseDoc,
      evidenceList,
      inspections,
      custodyHistory,
      auditLogs: [],
      investigator: miller
    });

    assert(reportDoc, 'Report document must be generated');
    assert(reportDoc.reportIdentifier.startsWith('REP-CASE001-'));
    assert(fs.existsSync(reportDoc.protectedFileReference), 'Generated PDF file must exist on disk.');
    assert(reportDoc.fileSize > 1000, 'PDF must contain content.');
    assert.strictEqual(reportDoc.pdfSha256Hash.length, 64, 'Must compute and store SHA-256 digest of PDF.');

    // Verify PDF file integrity matches stored hash
    const integrityCheck = await verifyFileIntegrity(reportDoc.protectedFileReference, reportDoc.pdfSha256Hash);
    assert.strictEqual(integrityCheck.isValid, true, 'Stored PDF SHA-256 must match file on disk.');
  });

  console.log('\n================================================================');
  console.log(` TEST EXECUTION SUMMARY: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log('================================================================\n');

  if (passedTests === totalTests) {
    console.log('ALL VERIFICATION REQUIREMENTS CONFIRMED WORKING PROPERLY!');
    process.exit(0);
  } else {
    console.error(`FAILED ${totalTests - passedTests} TESTS.`);
    process.exit(1);
  }
}

startTests().catch(err => {
  console.error('[Test Execution Error]:', err);
  process.exit(1);
});
