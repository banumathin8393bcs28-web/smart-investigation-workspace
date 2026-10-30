/**
 * SMART INVESTIGATION WORKSPACE - DEDICATED TEST DATABASE SEEDING UTILITY
 *
 * File Location: testing/seed-test-data.js
 *
 * SAFETY REQUIREMENTS:
 * 1. Strictly connects to a DEDICATED test database: smart_investigation_test
 * 2. Immediately aborts if the configured URI matches the production/dev database (smart_investigation)
 * 3. Uses purely synthetic investigator personas, evidence, and custody events.
 * 4. Never prints passwords or cryptographic secrets to console.
 * 5. Supports cleanup of only the generated synthetic test records via --clean.
 *
 * Usage:
 *   node testing/seed-test-data.js          # Seed test database
 *   node testing/seed-test-data.js --clean  # Remove only synthetic test records
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const TEST_DB_URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/smart_investigation_test';
const PRODUCTION_DB_NAME = 'smart_investigation';

// SAFETY GUARD: Verify target database is explicitly a test database
function verifySafetyGuard(uri) {
  const parsed = new URL(uri.replace('mongodb://', 'http://').replace('mongodb+srv://', 'http://'));
  const dbName = parsed.pathname.replace(/^\//, '');

  if (dbName === PRODUCTION_DB_NAME) {
    console.error(`[CRITICAL SAFETY ABORT] Target database is '${dbName}', which matches the production database!`);
    console.error(`This script is restricted to test databases ending in '_test'. Aborting immediately.`);
    process.exit(1);
  }

  if (!dbName.includes('test')) {
    console.error(`[SAFETY ABORT] Target database '${dbName}' does not contain 'test'. Aborting for safety.`);
    process.exit(1);
  }
}

// Model imports
const Investigator = require('../models/Investigator');
const Case = require('../models/Case');
const Evidence = require('../models/Evidence');
const Custody = require('../models/Custody');
const CriminalRecord = require('../models/CriminalRecord');
const AnalysisJob = require('../models/AnalysisJob');
const EvidenceRequest = require('../models/EvidenceRequest');
const Message = require('../models/Message');
const Notification = require('../models/Notification');
const Contact = require('../models/Contact');
const Counter = require('../models/Counter');

const isCleanMode = process.argv.includes('--clean');

async function run() {
  verifySafetyGuard(TEST_DB_URI);

  console.log(`================================================================`);
  console.log(` SMART INVESTIGATION WORKSPACE // TEST DATA SEEDING UTILITY`);
  console.log(` Mode: ${isCleanMode ? 'CLEANUP SYNTHETIC TEST DATA' : 'SEED SYNTHETIC TEST SUITE DATA'}`);
  console.log(` Target Test Database: ${TEST_DB_URI}`);
  console.log(`================================================================`);

  await mongoose.connect(TEST_DB_URI);
  console.log(`[Safety Verified] Connected to isolated test database.`);

  const testEmails = [
    'detective.miller@gov.in',
    'd.chen@gov.in',
    'sarah.jenkins@gov.in',
    'robert.vance@gov.in'
  ];

  if (isCleanMode) {
    console.log(`Cleaning up test records from test database...`);
    const investigators = await Investigator.find({ email: { $in: testEmails } });
    const invIds = investigators.map(i => i._id);

    await Investigator.deleteMany({ email: { $in: testEmails } });
    await Case.deleteMany({ caseNumber: { $in: ['CASE001', 'CASE002', 'CASE003'] } });
    await Evidence.deleteMany({ caseNumber: { $in: ['CASE001', 'CASE002'] } });
    await Custody.deleteMany({ actor: { $in: invIds } });
    await CriminalRecord.deleteMany({ recordNumber: { $in: ['CR-2026-0001', 'CR-2026-0002'] } });
    await AnalysisJob.deleteMany({ jobIdentifier: { $regex: /^AJOB-/ } });
    await EvidenceRequest.deleteMany({ requestIdentifier: { $regex: /^REQ-/ } });
    await Message.deleteMany({ sender: { $in: invIds } });
    await Notification.deleteMany({ recipient: { $in: invIds } });
    await Contact.deleteMany({ owner: { $in: invIds } });
    await Counter.deleteMany({ sequenceName: { $regex: /CASE00/ } });

    console.log(`[Success] Synthetic test data removed cleanly without dropping production collections.`);
    await mongoose.disconnect();
    return;
  }

  // 1. Seed Investigator 1: Detective James Miller
  const salt = await bcrypt.genSalt(10);
  const millerPassHash = await bcrypt.hash('Forensic@Gov2026!', salt);
  const millerAnswerHash = await bcrypt.hash('titan', salt);

  let miller = await Investigator.findOne({ email: 'detective.miller@gov.in' });
  if (!miller) {
    miller = await Investigator.create({
      fullName: 'Detective James Miller',
      role: 'Senior Forensic Investigator',
      dob: new Date('1986-04-12'),
      age: 40,
      gender: 'Male',
      phone: '+91 98765 43210',
      email: 'detective.miller@gov.in',
      username: 'jmiller',
      password: millerPassHash,
      securityQuestion: "What was your first childhood pet's name?",
      securityAnswer: millerAnswerHash,
      profilePhoto: '/images/default-avatar.png',
      isEmailVerified: true,
      failedLoginAttempts: 0
    });
    console.log(`  [+] Seeded Persona: Detective James Miller (${miller.email})`);
  }

  // 2. Seed Investigator 2: Detective David Chen
  const chenPassHash = await bcrypt.hash('Evidence#Secure2026', salt);
  const chenAnswerHash = await bcrypt.hash('chandigarh', salt);

  let chen = await Investigator.findOne({ email: 'd.chen@gov.in' });
  if (!chen) {
    chen = await Investigator.create({
      fullName: 'Detective David Chen',
      role: 'Digital Evidence Specialist',
      dob: new Date('1992-08-25'),
      age: 34,
      gender: 'Male',
      phone: '+91 98111 22334',
      email: 'd.chen@gov.in',
      username: 'dchen',
      password: chenPassHash,
      securityQuestion: 'In what city were you born?',
      securityAnswer: chenAnswerHash,
      profilePhoto: '/images/default-avatar.png',
      isEmailVerified: true,
      failedLoginAttempts: 0
    });
    console.log(`  [+] Seeded Persona: Detective David Chen (${chen.email})`);
  }

  // 3. Establish Mutual Contact Link
  await Contact.findOneAndUpdate(
    { owner: miller._id, contact: chen._id },
    { $set: { status: 'Accepted', connectionTimestamp: new Date() } },
    { upsert: true }
  );
  await Contact.findOneAndUpdate(
    { owner: chen._id, contact: miller._id },
    { $set: { status: 'Accepted', connectionTimestamp: new Date() } },
    { upsert: true }
  );

  // 4. Seed Primary Case: CASE001
  let testCase = await Case.findOne({ caseNumber: 'CASE001' });
  if (!testCase) {
    testCase = await Case.create({
      caseNumber: 'CASE001',
      caseName: 'Central Data Repository Security Breach',
      crimeType: 'Cybercrime',
      status: 'Under Investigation',
      incidentDate: new Date('2026-10-24'),
      incidentTime: '02:45',
      incidentLocation: 'Sector 4 Data Center, Metro City',
      crimeSceneAddress: 'Server Rack Room B-12, Ground Floor',
      caseDescription: 'Unauthorized external network penetration detected targeting confidential records.',
      reportingInvestigator: miller.fullName,
      assignedInvestigator: miller._id,
      assignedName: miller.fullName,
      createdBy: miller._id,
      creatorName: miller.fullName,
      createdByName: miller.fullName,
      creationTimestamp: new Date(),
      lastUpdatedTimestamp: new Date()
    });
    console.log(`  [+] Seeded Case: CASE001 - ${testCase.caseName}`);
  }

  // 5. Seed Digital Evidence Item
  let testEvidence = await Evidence.findOne({ evidenceIdentifier: 'EVID-CASE001-001' });
  if (!testEvidence) {
    testEvidence = await Evidence.create({
      evidenceIdentifier: 'EVID-CASE001-001',
      caseId: testCase._id,
      caseNumber: testCase.caseNumber,
      originalFilename: 'crime_scene_exhibit_01.jpg',
      storedFilename: 'evid_sample_crime_scene.jpg',
      storageKey: 'evid_sample_crime_scene.jpg',
      protectedStoragePath: path.join(__dirname, '..', 'private_uploads', 'evidence', 'evid_sample_crime_scene.jpg'),
      fileMimeType: 'image/jpeg',
      fileSize: 145200,
      imageProperties: { width: 1920, height: 1080, format: 'jpeg', channels: 3 },
      availableMetadata: { hasExif: true, make: 'Nikon', model: 'D850', dateTimeOriginal: '2026-10-24 03:15:22' },
      sha256Hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      description: 'Physical router terminal observed with foreign hardware tap attachment.',
      uploadedBy: miller._id,
      uploaderName: miller.fullName,
      uploadTimestamp: new Date(),
      currentCustodian: miller._id,
      currentCustodianName: miller.fullName,
      custodyStatus: 'In Custody'
    });
    console.log(`  [+] Seeded Evidence: EVID-CASE001-001`);
  }

  // 6. Seed Chain of Custody Initial Entry
  await Custody.findOneAndUpdate(
    { eventId: 'CUST-CASE001-001' },
    {
      $set: {
        eventId: 'CUST-CASE001-001',
        caseId: testCase._id,
        caseNumber: testCase.caseNumber,
        evidenceId: testEvidence._id,
        evidenceIdentifier: testEvidence.evidenceIdentifier,
        actor: miller._id,
        actorName: miller.fullName,
        action: 'Evidence Received',
        status: 'Recorded',
        reason: 'Initial digital evidence ingestion from crime-scene photography',
        notes: 'SHA-256 integrity hash verified at intake.',
        eventTimestamp: new Date()
      }
    },
    { upsert: true }
  );

  // 7. Seed Criminal Record: CR-2026-0001
  await CriminalRecord.findOneAndUpdate(
    { recordNumber: 'CR-2026-0001' },
    {
      $set: {
        fullName: 'Vikram Aditya Sharma',
        alias: 'The Specter',
        nationalId: 'IND-DL-88229911',
        gender: 'Male',
        dob: new Date('1984-03-22'),
        age: 42,
        phone: '+91 98444 55667',
        address: 'Apartment 4B, Silver Heights, New Delhi',
        status: 'Person of Interest',
        riskLevel: 'High',
        physicalTraits: {
          height: '182 cm',
          eyeColor: 'Dark Brown',
          hairColor: 'Black',
          identifyingMarks: 'Linear scar across left jawline'
        },
        connectedCases: [testCase._id],
        registeredBy: miller._id,
        registeredByName: miller.fullName,
        interrogationNotes: [{
          date: new Date(),
          investigatorName: miller.fullName,
          notes: 'Subject interrogated regarding presence at Sector 4 facility.'
        }]
      }
    },
    { upsert: true }
  );
  console.log(`  [+] Seeded Criminal Record: CR-2026-0001`);

  console.log(`================================================================`);
  console.log(` SEEDING COMPLETE: Dedicated test database populated successfully.`);
  console.log(` To remove synthetic data: node testing/seed-test-data.js --clean`);
  console.log(`================================================================`);

  await mongoose.disconnect();
}

run().catch(err => {
  console.error('[Seeding Error]:', err);
  process.exit(1);
});
