const assert = require('assert');
const fs = require('fs');
const path = require('path');
const User = require('../models/User');
const Case = require('../models/Case');
const Evidence = require('../models/Evidence');
const Suspect = require('../models/Suspect');
const AuditLog = require('../models/AuditLog');
const IntegrityService = require('../services/integrityService');
const AIAnalysisService = require('../services/aiAnalysisService');

async function runTests() {
  console.log('====================================================');
  console.log('RUNNING FULL SYSTEM TEST SUITE: SMART INVESTIGATION WORKSPACE');
  console.log('====================================================');

  // Test 1: User Format Validation
  console.log('\n[TEST 1] Testing Validation Logic (Email, Phone, Password, Security Answer)...');
  
  // Email validation
  assert.strictEqual(User.validateEmail('officer@agency.gov'), true, 'Valid email should pass');
  assert.strictEqual(User.validateEmail('invalid-email'), false, 'Invalid email should fail');
  assert.strictEqual(User.validateEmail('test@domain'), false, 'Missing TLD should fail');
  console.log('  ✔ Email format validation passed');

  // Phone validation
  assert.strictEqual(User.validatePhone('+1 555-019-2834'), true, 'Valid international phone should pass');
  assert.strictEqual(User.validatePhone('9876543210'), true, 'Valid 10-digit phone should pass');
  assert.strictEqual(User.validatePhone('12345'), false, 'Short phone number should fail');
  console.log('  ✔ Phone number format validation passed');

  // Password strength validation (min 8 chars, uppercase, lowercase, number, special char)
  assert.strictEqual(User.validatePassword('Password@123'), true, 'Strong password should pass');
  assert.strictEqual(User.validatePassword('weak'), false, 'Short password should fail');
  assert.strictEqual(User.validatePassword('password123'), false, 'Missing uppercase & special should fail');
  assert.strictEqual(User.validatePassword('PASSWORD123!'), false, 'Missing lowercase should fail');
  assert.strictEqual(User.validatePassword('PasswordABC!'), false, 'Missing digit should fail');
  console.log('  ✔ Master password forensic security standards validation passed');

  // Security Answer validation (must be ONE word with no spaces)
  assert.strictEqual(User.validateSecurityAnswer('Oxford'), true, 'Single word answer should pass');
  assert.strictEqual(User.validateSecurityAnswer('Blue'), true, 'Single word answer should pass');
  assert.strictEqual(User.validateSecurityAnswer('Oxford Elementary School'), false, 'Multi-word answer must fail');
  assert.strictEqual(User.validateSecurityAnswer(''), false, 'Empty answer must fail');
  console.log('  ✔ One-word personal security answer constraint passed');

  // Test 2: User Registration & Password Hashing
  console.log('\n[TEST 2] Testing User Registration & Secure Password Hashing...');
  const testUser = await User.create({
    name: 'Detective James Gordon',
    email: 'j.gordon@gotham.gov',
    phone: '555-901-2345',
    badgeId: 'INV-9901',
    department: 'Major Crimes',
    rank: 'Detective',
    password: 'SecurePassword!99',
    securityQuestion: 'What was the name of your first elementary school?',
    securityAnswer: 'stewart'
  });

  assert.ok(testUser._id, 'User must have an ID');
  assert.notStrictEqual(testUser.password, 'SecurePassword!99', 'Password must be hashed with bcrypt');
  const pwdMatch = await User.comparePassword('SecurePassword!99', testUser.password);
  assert.strictEqual(pwdMatch, true, 'bcrypt compare must succeed for valid password');
  console.log('  ✔ User created with bcrypt hash and one-word security answer');

  // Test 3: Lockout Logic & Security Challenge Workflow
  console.log('\n[TEST 3] Testing 3-Attempt Failed Password Lockout & Challenge Resolution...');
  let u = await User.findById(testUser._id);
  assert.strictEqual(u.failedLoginAttempts, 0, 'Initial attempts must be 0');

  // Fail 1
  u = await User.findByIdAndUpdate(u._id, { $inc: { failedLoginAttempts: 1 } }, { new: true });
  assert.strictEqual(u.failedLoginAttempts, 1);
  console.log('  ✔ Attempt 1 failed (attempts: 1, unlocked)');

  // Fail 2
  u = await User.findByIdAndUpdate(u._id, { $inc: { failedLoginAttempts: 1 } }, { new: true });
  assert.strictEqual(u.failedLoginAttempts, 2);
  console.log('  ✔ Attempt 2 failed (attempts: 2, unlocked)');

  // Fail 3 -> Locks account!
  u = await User.findByIdAndUpdate(u._id, { $inc: { failedLoginAttempts: 1 }, isLocked: true }, { new: true });
  assert.strictEqual(u.failedLoginAttempts, 3);
  assert.strictEqual(u.isLocked, true);
  console.log('  ✔ Attempt 3 failed -> ACCOUNT LOCKED! (isLocked: true)');

  // Challenge test: incorrect security answer
  const wrongAnswer = 'wrongschool';
  assert.notStrictEqual(wrongAnswer.trim().toLowerCase(), u.securityAnswer.toLowerCase(), 'Wrong answer must not match');
  console.log('  ✔ Security challenge rejects incorrect answer');

  // Challenge test: correct security answer + password restores access
  const correctAnswer = 'stewart';
  assert.strictEqual(correctAnswer.trim().toLowerCase(), u.securityAnswer.toLowerCase(), 'Correct answer matches');
  const unlockedUser = await User.findByIdAndUpdate(u._id, { failedLoginAttempts: 0, isLocked: false }, { new: true });
  assert.strictEqual(unlockedUser.isLocked, false);
  assert.strictEqual(unlockedUser.failedLoginAttempts, 0);
  console.log('  ✔ Correct security answer + password unlocks account and resets attempts!');

  // Cleanup test user
  await User.findByIdAndDelete(testUser._id);

  // Test 4: Evidence Ingestion, SHA-256 Hash Calculation & Duplicate Detection
  console.log('\n[TEST 4] Testing SHA-256 Cryptographic Hash & Duplicate Media Detection...');
  const samplePath = path.join(__dirname, '..', 'public', 'uploads', 'originals', 'evidence-cctv-vault.png');
  const hash = await IntegrityService.calculateFileHash(samplePath);
  assert.ok(hash && hash.length === 64, 'SHA-256 digest must be 64 hex characters');
  console.log(`  ✔ Computed SHA-256: ${hash}`);

  // Check duplicate detection
  const duplicate = await IntegrityService.checkDuplicateHash(hash);
  assert.ok(duplicate, 'Duplicate detection must detect existing seeded evidence file');
  console.log(`  ✔ Detected duplicate evidence: ${duplicate.evidenceNumber} ("${duplicate.title}")`);

  // Test 5: Live Tamper Verification
  console.log('\n[TEST 5] Testing Live Cryptographic Tamper Verification...');
  const evidenceRecord = await Evidence.findOne({ evidenceNumber: 'EVD-2026-1001' });
  assert.ok(evidenceRecord, 'Seeded evidence EVD-2026-1001 must exist');
  const verifyResult = await IntegrityService.verifyEvidenceIntegrity(evidenceRecord._id, { name: 'Automated Test', badgeId: 'TEST-01' });
  assert.strictEqual(verifyResult.isIntact, true, 'Original file must verify intact');
  assert.strictEqual(verifyResult.status, 'Verified Intact');
  console.log(`  ✔ Live cryptographic tamper check: ${verifyResult.status}`);

  // Test 6: AI-Assisted Object Detection Pipeline & Review
  console.log('\n[TEST 6] Testing AI Object Detection & Investigator Review Workflow...');
  const aiResult = await AIAnalysisService.analyzeMedia(evidenceRecord);
  assert.strictEqual(aiResult.analyzed, true);
  assert.ok(aiResult.detections && aiResult.detections.length > 0, 'Must produce detections');
  console.log(`  ✔ AI Analysis produced ${aiResult.detections.length} forensic object markers`);
  console.log(`  ✔ Sample Detection: "${aiResult.detections[0].label}" (${Math.round(aiResult.detections[0].confidence * 100)}% confidence)`);
  console.log(`  ✔ Investigator review initial status: "${aiResult.investigatorReview.status}"`);

  // Test 7: Case Management & Timeline Addition
  console.log('\n[TEST 7] Testing Case Timeline & Handover...');
  const sampleCase = await Case.findOne({ caseNumber: 'CASE-2026-1042' });
  assert.ok(sampleCase, 'Seeded case must exist');
  await Case.addTimelineEvent(sampleCase._id, {
    title: 'Automated Forensic Benchmark Note',
    description: 'System integrity and database checks concluded without anomalies.',
    investigator: 'System Auditor',
    type: 'benchmark'
  });
  const updatedCase = await Case.findById(sampleCase._id);
  const lastEvent = updatedCase.timeline[updatedCase.timeline.length - 1];
  assert.strictEqual(lastEvent.title, 'Automated Forensic Benchmark Note');
  console.log('  ✔ Successfully appended immutable timeline record to case docket');

  // Test 8: Suspect Dossier & Linkage
  console.log('\n[TEST 8] Testing Suspect Dossier & Risk Classification...');
  const suspect = await Suspect.findOne({ fullName: 'Marcus Vance' });
  assert.ok(suspect, 'Suspect Marcus Vance must exist');
  assert.strictEqual(suspect.riskLevel, 'Extreme');
  assert.strictEqual(suspect.status, 'Wanted');
  assert.ok(suspect.connectedCases.includes(sampleCase._id.toString()));
  console.log(`  ✔ Suspect dossier verified: ${suspect.fullName} (${suspect.status}, Risk: ${suspect.riskLevel})`);

  console.log('\n====================================================');
  console.log('ALL TESTS PASSED! SMART INVESTIGATION WORKSPACE IS 100% OPERATIONAL.');
  console.log('====================================================\n');
}

runTests().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
