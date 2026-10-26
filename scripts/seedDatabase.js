require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const { connectDB } = require('../config/db');
const Investigator = require('../models/Investigator');
const Case = require('../models/Case');
const Evidence = require('../models/Evidence');
const Contact = require('../models/Contact');
const Custody = require('../models/Custody');
const AuditLog = require('../models/AuditLog');
const Counter = require('../models/Counter');
const { calculateBufferHash } = require('../services/hashService');
const { extractImagePropertiesAndExif, generateThumbnail } = require('../services/metadataService');

async function seed() {
  await connectDB();
  console.log('[Seed] Connected to MongoDB for seeding...');

  // Reset or initialize counter
  await Counter.findOneAndUpdate(
    { name: 'caseNumber' },
    { $set: { seq: 2 } },
    { upsert: true }
  );

  await Counter.findOneAndUpdate(
    { name: 'custodyEvent' },
    { $set: { seq: 4 } },
    { upsert: true }
  );

  // Hash password
  const salt = await bcrypt.genSalt(10);
  const commonPassHash = await bcrypt.hash('Password@123', salt);

  // 1. Seed Investigators
  const investigatorsData = [
    {
      fullName: 'Detective Sarah Miller',
      role: 'Lead Investigator',
      profilePhoto: '/images/default-avatar.png',
      dob: new Date('1988-06-15'),
      age: 38,
      gender: 'Female',
      phone: '+91 9876543210',
      email: 'detective.miller@gov.in',
      username: 'det_miller',
      password: commonPassHash,
      securityQuestion: 'What is your childhood nickname?',
      securityAnswer: await bcrypt.hash('oxford', salt),
      isEmailVerified: true,
      isApproved: true,
      failedLoginAttempts: 0
    },
    {
      fullName: 'Inspector David Chen',
      role: 'Senior Detective',
      profilePhoto: '/images/default-avatar.png',
      dob: new Date('1985-03-22'),
      age: 41,
      gender: 'Male',
      phone: '+91 9876543211',
      email: 'david.chen@gov.in',
      username: 'insp_chen',
      password: commonPassHash,
      securityQuestion: 'What is your favourite book?',
      securityAnswer: await bcrypt.hash('sherlock', salt),
      isEmailVerified: true,
      isApproved: true,
      failedLoginAttempts: 0
    },
    {
      fullName: 'Kanya T',
      role: 'Cybercrime Investigator',
      profilePhoto: '/images/default-avatar.png',
      dob: new Date('1994-09-10'),
      age: 32,
      gender: 'Female',
      phone: '+91 9626417895',
      email: 'kanya.t@gov.in',
      username: 'kanya_t',
      password: commonPassHash,
      securityQuestion: 'What is the name of your first pet?',
      securityAnswer: await bcrypt.hash('mobi', salt),
      isEmailVerified: true,
      isApproved: true,
      failedLoginAttempts: 0
    }
  ];

  const createdOfficers = [];
  for (const inv of investigatorsData) {
    let officer = await Investigator.findOne({ email: inv.email });
    if (!officer) {
      officer = await Investigator.create(inv);
      console.log(`[Seed] Created investigator: ${officer.fullName} (${officer.email})`);
    } else {
      console.log(`[Seed] Investigator exists: ${officer.fullName} (${officer.email})`);
    }
    createdOfficers.push(officer);
  }

  const [miller, chen, kanya] = createdOfficers;

  // 2. Mutual Contacts Connection
  await Contact.findOneAndUpdate(
    { owner: miller._id, contact: chen._id },
    { status: 'Accepted', displayName: 'David Chen (Homicide)', updatedTimestamp: new Date() },
    { upsert: true }
  );

  await Contact.findOneAndUpdate(
    { owner: chen._id, contact: miller._id },
    { status: 'Accepted', displayName: 'Sarah Miller (Forensics Lead)', updatedTimestamp: new Date() },
    { upsert: true }
  );

  await Contact.findOneAndUpdate(
    { owner: miller._id, contact: kanya._id },
    { status: 'Accepted', displayName: 'Kanya T (Cybercrime)', updatedTimestamp: new Date() },
    { upsert: true }
  );

  // 3. Create Sample Cases: CASE001 and CASE002
  let case001 = await Case.findOne({ caseNumber: 'CASE001' });
  if (!case001) {
    const creationTime = new Date('2026-10-15T10:30:00.000Z');
    case001 = await Case.create({
      caseNumber: 'CASE001',
      caseName: 'Armed Robbery at Central Commercial Bank',
      crimeType: 'Robbery',
      status: 'Under Investigation',
      incidentDate: new Date('2026-10-14'),
      incidentTime: '14:45',
      incidentLocation: 'New Delhi, Connaught Place Sector 4',
      crimeSceneAddress: 'Building 14, Barakhamba Road',
      caseDescription: 'Two armed perpetrators entered through the eastern entrance carrying a tactical knife and dark duffel bags. Cashier was threatened with a knife near the primary vault entrance.',
      reportingInvestigator: miller.fullName,
      department: 'Special Armed Crimes & Forensics Unit',
      victimDetails: 'Ramesh Gupta (Head Teller, uninjured), Sunita Sharma (Customer, minor abrasions)',
      suspectDetails: 'Suspect 1: approx 5ft 10in, black jacket, concealed face. Suspect 2: approx 6ft, dark hoodie.',
      preliminaryFindings: 'Latent fingerprints lifted from teller counter glass. Recovered metallic fragment from floor.',
      knownObjects: 'Knife, Bag, Vehicle, Backpack',
      additionalNotes: 'CCTV footage archived. Ballistics analysis requested.',
      createdBy: miller._id,
      creatorName: miller.fullName,
      assignedInvestigator: miller._id,
      assignedName: miller.fullName,
      collaborators: [chen._id],
      creationTimestamp: creationTime,
      lastUpdatedTimestamp: new Date()
    });
    console.log('[Seed] Created CASE001');
  }

  let case002 = await Case.findOne({ caseNumber: 'CASE002' });
  if (!case002) {
    const creationTime = new Date('2026-10-18T09:15:00.000Z');
    case002 = await Case.create({
      caseNumber: 'CASE002',
      caseName: 'Cyber Ransomware Infiltration & Extortion',
      crimeType: 'Cybercrime',
      status: 'New',
      incidentDate: new Date('2026-10-17'),
      incidentTime: '03:12',
      incidentLocation: 'Bengaluru Tech Corridor, Electronic City',
      crimeSceneAddress: 'Cyber Heights Tower B, Floor 6',
      caseDescription: 'Unauthorized remote penetration detected on database cluster. Server logs indicate exfiltration of customer records followed by a ransom note demanding cryptocurrency.',
      reportingInvestigator: kanya.fullName,
      department: 'Cyber Intelligence & Digital Forensics',
      victimDetails: 'Global Cloud Systems India Ltd.',
      suspectDetails: 'Online syndicate alias "SpectreHydra". Tor exit nodes identified.',
      preliminaryFindings: 'Malicious payload reverse-engineered. C2 server IPs traced.',
      knownObjects: 'Laptop, Phone, Server',
      additionalNotes: 'Network capture files isolated for forensic inspection.',
      createdBy: kanya._id,
      creatorName: kanya.fullName,
      assignedInvestigator: kanya._id,
      assignedName: kanya.fullName,
      collaborators: [miller._id],
      creationTimestamp: creationTime,
      lastUpdatedTimestamp: new Date()
    });
    console.log('[Seed] Created CASE002');
  }

  // 4. Sample Evidence File for CASE001
  const evidenceDir = path.join(__dirname, '..', 'private_uploads', 'evidence');
  if (!fs.existsSync(evidenceDir)) fs.mkdirSync(evidenceDir, { recursive: true });
  const thumbDir = path.join(evidenceDir, 'thumbnails');
  if (!fs.existsSync(thumbDir)) fs.mkdirSync(thumbDir, { recursive: true });

  const sampleImagePath = path.join(evidenceDir, 'evid_sample_crime_scene.jpg');
  if (!fs.existsSync(sampleImagePath)) {
    // Generate a clean test image with Sharp
    const sharp = require('sharp');
    const svgContent = `
      <svg width="800" height="600" xmlns="http://www.w3.org/2000/svg">
        <rect width="800" height="600" fill="#2d3748" />
        <rect x="50" y="50" width="700" height="500" fill="#1a202c" stroke="#e2e8f0" stroke-width="4" />
        <text x="400" y="250" font-family="Arial" font-size="28" fill="#ffffff" text-anchor="middle" font-weight="bold">CRIME SCENE FORENSIC ARTIFACT</text>
        <text x="400" y="300" font-family="Arial" font-size="18" fill="#a0aec0" text-anchor="middle">CASE001 - CENTRAL BANK VAULT ENTRANCE</text>
        <rect x="250" y="360" width="300" height="80" fill="#4a5568" rx="8" />
        <text x="400" y="410" font-family="Arial" font-size="20" fill="#f7fafc" text-anchor="middle">EVIDENCE MARKER #1: KNIFE / BLADE</text>
      </svg>
    `;
    await sharp(Buffer.from(svgContent)).jpeg({ quality: 90 }).toFile(sampleImagePath);
  }

  const sampleBuffer = fs.readFileSync(sampleImagePath);
  const sampleHash = calculateBufferHash(sampleBuffer);
  const { properties, metadata } = await extractImagePropertiesAndExif(sampleBuffer, sampleImagePath);

  const sampleThumbPath = path.join(thumbDir, 'thumb_evid_sample_crime_scene.jpg');
  await generateThumbnail(sampleBuffer, sampleThumbPath, 320, 240);

  let existingEvid = await Evidence.findOne({ evidenceIdentifier: 'EVID-CASE001-001' });
  if (!existingEvid) {
    existingEvid = await Evidence.create({
      evidenceIdentifier: 'EVID-CASE001-001',
      caseId: case001._id,
      caseNumber: case001.caseNumber,
      originalFilename: 'crime_scene_vault_entrance.jpg',
      storedFilename: 'evid_sample_crime_scene.jpg',
      protectedStoragePath: sampleImagePath,
      thumbnailPath: sampleThumbPath,
      fileMimeType: 'image/jpeg',
      fileSize: sampleBuffer.length,
      imageProperties: properties,
      availableMetadata: metadata,
      sha256Hash: sampleHash,
      description: 'Primary crime-scene photograph captured at eastern entrance showing floor area near vault entrance.',
      uploadedBy: miller._id,
      uploaderName: miller.fullName,
      uploadTimestamp: new Date('2026-10-15T11:00:00.000Z'),
      inspectionStatus: 'Uninspected',
      currentCustodian: miller._id,
      currentCustodianName: miller.fullName,
      custodyStatus: 'In Custody'
    });
    console.log('[Seed] Created EVID-CASE001-001 with SHA-256:', sampleHash.substring(0, 16));

    // Custody record
    await Custody.create({
      eventId: 'CUST-0001',
      caseId: case001._id,
      caseNumber: case001.caseNumber,
      evidenceId: existingEvid._id,
      evidenceIdentifier: existingEvid.evidenceIdentifier,
      actor: miller._id,
      actorName: miller.fullName,
      action: 'Evidence Received',
      transferor: miller._id,
      transferorName: miller.fullName,
      reason: 'Initial digital evidence ingestion from forensic crime-scene camera',
      status: 'Completed',
      evidenceSha256: sampleHash,
      eventTimestamp: new Date('2026-10-15T11:00:00.000Z')
    });
  }

  console.log('================================================================');
  console.log('[Seed Complete] Database seeded successfully!');
  console.log('Test Accounts available:');
  console.log(' 1. detective.miller@gov.in | Password@123 | Question: What is your childhood nickname? | Answer: oxford');
  console.log(' 2. david.chen@gov.in       | Password@123 | Question: What is your favourite book?        | Answer: sherlock');
  console.log(' 3. kanya.t@gov.in          | Password@123 | Question: What is the name of your first pet?  | Answer: mobi');
  console.log('================================================================');

  process.exit(0);
}

seed().catch(err => {
  console.error('[Seed Error]:', err);
  process.exit(1);
});
