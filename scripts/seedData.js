const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function calculateFileSha256(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(fileBuffer).digest('hex');
}

async function seed() {
  console.log('[Seeder] Initializing forensic database seed...');

  const origDir = path.join(__dirname, '..', 'public', 'uploads', 'originals');
  const vaultHash = calculateFileSha256(path.join(origDir, 'evidence-cctv-vault.png'));
  const carHash = calculateFileSha256(path.join(origDir, 'evidence-getaway-car.png'));
  const gunHash = calculateFileSha256(path.join(origDir, 'evidence-firearm.png'));
  const phoneHash = calculateFileSha256(path.join(origDir, 'evidence-phone.png'));

  // 1. Users
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash('Password@123', salt);

  const users = [
    {
      _id: 'usr_sarah_miller',
      name: 'Detective Sarah Miller',
      email: 'detective.miller@police.gov',
      phone: '+1 555-019-2834',
      badgeId: 'INV-4029',
      department: 'Digital Forensics & Cyber Intelligence',
      rank: 'Senior Detective',
      role: 'lead_investigator',
      password: hashedPassword,
      securityQuestion: 'What is the name of your first elementary school?',
      securityAnswer: 'oxford', // lowercase trimmed single-word
      failedLoginAttempts: 0,
      isLocked: false,
      avatar: '/images/default-avatar.png',
      bio: 'Lead forensic examiner with 12 years experience in ballistics, media forensics, and digital incident analysis.',
      createdAt: '2026-10-01T08:00:00.000Z',
      updatedAt: '2026-10-23T14:00:00.000Z'
    },
    {
      _id: 'usr_david_chen',
      name: 'Inspector David Chen',
      email: 'd.chen@police.gov',
      phone: '+1 555-409-1188',
      badgeId: 'INV-7721',
      department: 'Homicide & Major Crimes Squad',
      rank: 'Inspector',
      role: 'investigator',
      password: hashedPassword,
      securityQuestion: 'In what city was your mother born?',
      securityAnswer: 'seattle',
      failedLoginAttempts: 0,
      isLocked: false,
      avatar: '/images/default-avatar.png',
      bio: 'Senior violent crimes detective specializing in armed robberies and organized syndicates.',
      createdAt: '2026-10-02T09:00:00.000Z',
      updatedAt: '2026-10-23T14:00:00.000Z'
    },
    {
      _id: 'usr_elena_rostova',
      name: 'Elena Rostova',
      email: 'e.rostova@police.gov',
      phone: '+1 555-782-9012',
      badgeId: 'INV-3310',
      department: 'Digital Forensics Lab',
      rank: 'Forensic Analyst',
      role: 'analyst',
      password: hashedPassword,
      securityQuestion: 'What was the make/brand of your first vehicle?',
      securityAnswer: 'toyota',
      failedLoginAttempts: 0,
      isLocked: false,
      avatar: '/images/default-avatar.png',
      bio: 'Certified computer vision examiner and cryptographic analyst.',
      createdAt: '2026-10-03T10:00:00.000Z',
      updatedAt: '2026-10-23T14:00:00.000Z'
    }
  ];

  // 2. Cases
  const cases = [
    {
      _id: 'case_vault_robbery',
      caseNumber: 'CASE-2026-1042',
      title: '5th Avenue Vault Breach & Armed Robbery',
      classification: 'Armed Robbery',
      priority: 'Critical',
      status: 'In Progress',
      incidentDate: '2026-10-18T22:30:00.000Z',
      incidentLocation: '482 5th Avenue, Commercial Deposit Vault',
      description: 'At approximately 22:30 hours, three armed masked perpetrators breached the primary vault mechanism using specialized plasma cutting gear. Surveillance cameras logged tactical firearms and an obscured black sedan departing westbound. Preliminary forensic ballistics indicate 9mm cartridge casings recovered near exit.',
      leadInvestigator: 'usr_sarah_miller',
      leadInvestigatorName: 'Detective Sarah Miller',
      assignedTeam: ['usr_david_chen', 'usr_elena_rostova'],
      tags: ['CCTV', 'Vault', 'Firearms', 'Vehicle', 'Ballistics'],
      timeline: [
        {
          timestamp: '2026-10-18T23:15:00.000Z',
          title: 'Emergency Dispatch & Perimeter Secured',
          description: 'First responders established perimeter. Evidence technicians deployed for physical extraction.',
          investigator: 'Inspector David Chen',
          type: 'dispatch'
        },
        {
          timestamp: '2026-10-19T02:00:00.000Z',
          title: 'CCTV Video Extraction Completed',
          description: 'Hard drive media pulled from surveillance rack. Ingestion SHA-256 hash verified.',
          investigator: 'Detective Sarah Miller',
          type: 'evidence_ingestion'
        },
        {
          timestamp: '2026-10-20T11:45:00.000Z',
          title: 'AI Object Detection Analysis Completed',
          description: 'Automated computer vision detected concealed weapon and duffle profile with 94% confidence.',
          investigator: 'Elena Rostova',
          type: 'ai_analysis'
        }
      ],
      handoverHistory: [],
      createdAt: '2026-10-19T00:00:00.000Z',
      updatedAt: '2026-10-23T15:00:00.000Z'
    },
    {
      _id: 'case_ransomware_intrusion',
      caseNumber: 'CASE-2026-3391',
      title: 'DarkWeb Syndicate Ransomware Intrusion',
      classification: 'Cybercrime',
      priority: 'High',
      status: 'Open',
      incidentDate: '2026-10-21T04:12:00.000Z',
      incidentLocation: 'Metro Healthcare Regional Data Center',
      description: 'Critical patient management servers locked by asymmetric RSA-4096 ransomware strain attributed to DarkWeb actor "Cipher". Bitcoin wallet addresses intercepted during ransom demand transmission.',
      leadInvestigator: 'usr_sarah_miller',
      leadInvestigatorName: 'Detective Sarah Miller',
      assignedTeam: ['usr_elena_rostova'],
      tags: ['Cyber', 'Ransomware', 'DarkWeb', 'Crypto'],
      timeline: [
        {
          timestamp: '2026-10-21T06:00:00.000Z',
          title: 'Intrusion Investigation Initiated',
          description: 'Server logs and memory dump snapshots secured under cryptographic custody.',
          investigator: 'Detective Sarah Miller',
          type: 'initialization'
        }
      ],
      handoverHistory: [],
      createdAt: '2026-10-21T06:30:00.000Z',
      updatedAt: '2026-10-23T12:00:00.000Z'
    },
    {
      _id: 'case_pier_narcotics',
      caseNumber: 'CASE-2026-8804',
      title: 'Pier 14 Narcotics Distribution Network',
      classification: 'Narcotics',
      priority: 'Medium',
      status: 'Under Review',
      incidentDate: '2026-10-15T01:45:00.000Z',
      incidentLocation: 'Pier 14 Industrial Shipping Terminal',
      description: 'Interception of maritime shipping cargo container concealing high-purity illicit narcotics and encrypted mobile satellite communications equipment.',
      leadInvestigator: 'usr_david_chen',
      leadInvestigatorName: 'Inspector David Chen',
      assignedTeam: ['usr_sarah_miller'],
      tags: ['Narcotics', 'Maritime', 'Hardware'],
      timeline: [
        {
          timestamp: '2026-10-15T04:00:00.000Z',
          title: 'Cargo Seizure Logged',
          description: 'Physical evidence transferred to central evidence holding vault.',
          investigator: 'Inspector David Chen',
          type: 'initialization'
        }
      ],
      handoverHistory: [],
      createdAt: '2026-10-15T04:30:00.000Z',
      updatedAt: '2026-10-22T10:00:00.000Z'
    }
  ];

  // 3. Suspects
  const suspects = [
    {
      _id: 'susp_marcus_vance',
      fullName: 'Marcus Vance',
      alias: 'Ghost',
      nationalId: 'SSN-849-21-9941',
      status: 'Wanted',
      riskLevel: 'Extreme',
      photo: '/uploads/suspects/suspect-marcus-vance.png',
      phone: '+1 555-902-4411',
      address: 'Last sighting: Industrial Warehouse District, Pier 12',
      physicalTraits: {
        height: "6' 1\" (185 cm)",
        eyeColor: 'Hazel',
        hairColor: 'Dark Brown / Shaved',
        identifyingMarks: 'Serpent tattoo wrapped around left forearm; 3-inch scar over right brow.'
      },
      priorOffenses: [
        '2019 - Grand Larceny & Evading Arrest',
        '2021 - Armed Commercial Robbery (Served 3 Years)',
        '2024 - Aggravated Assault with Deadly Weapon'
      ],
      connectedCases: ['case_vault_robbery'],
      notes: 'Considered armed and dangerous. Known to utilize heavy tactical firearms and signal jamming hardware.',
      interrogationNotes: [
        {
          date: '2026-10-20T16:00:00.000Z',
          investigator: 'Inspector David Chen',
          notes: 'Witness interview with security guard confirms suspect physique and vocal patterns match Marcus Vance.',
          voiceRecorded: true
        }
      ],
      createdAt: '2026-10-19T08:00:00.000Z',
      updatedAt: '2026-10-23T14:00:00.000Z'
    },
    {
      _id: 'susp_dmitri_volkov',
      fullName: 'Dmitri Volkov',
      alias: 'Cipher',
      nationalId: 'ID-882-10-5412',
      status: 'Under Surveillance',
      riskLevel: 'High',
      photo: '/images/default-suspect.png',
      phone: '+1 555-321-7788',
      address: '744 Metro Heights Apt 8B',
      physicalTraits: {
        height: "5' 9\" (175 cm)",
        eyeColor: 'Blue',
        hairColor: 'Blonde / Short',
        identifyingMarks: 'Barcode tattoo behind left ear.'
      },
      priorOffenses: [
        '2020 - Computer Fraud & Network Penetration',
        '2023 - Possession of Intercepted Cryptographic Keys'
      ],
      connectedCases: ['case_ransomware_intrusion'],
      notes: 'Affiliated with international cyber extortion forums. Operates anonymous bulletproof VPN gateways.',
      interrogationNotes: [],
      createdAt: '2026-10-21T09:00:00.000Z',
      updatedAt: '2026-10-23T11:00:00.000Z'
    }
  ];

  // 4. Evidence
  const evidence = [
    {
      _id: 'evd_cctv_vault',
      evidenceNumber: 'EVD-2026-1001',
      title: 'CCTV Camera #4 - Vault Perimeter Breach',
      caseId: 'case_vault_robbery',
      fileType: 'image',
      originalFilename: 'evidence-cctv-vault.png',
      mimeType: 'image/png',
      fileSize: 142850,
      originalPath: '/uploads/originals/evidence-cctv-vault.png',
      analysisPath: '/uploads/analysis/analysis_evidence-cctv-vault.png',
      sha256Hash: vaultHash,
      lastVerifiedHash: vaultHash,
      integrityStatus: 'Verified Intact',
      lastVerifiedAt: '2026-10-23T14:30:00.000Z',
      duplicateOf: null,
      uploadedBy: 'usr_sarah_miller',
      uploaderName: 'Detective Sarah Miller',
      uploaderBadge: 'INV-4029',
      description: 'High-definition digital still extracted from Camera #4 positioned over primary vault access hall. Depicts primary armed perpetrator in tactical balaclava.',
      sourceLocation: 'Vault Security Server #01',
      collectionDate: '2026-10-18T22:34:10.000Z',
      accessLevel: 'Standard',
      aiAnalysis: {
        analyzed: true,
        analyzedAt: '2026-10-20T11:45:00.000Z',
        model: 'Ultralytics YOLOv8-Forensic',
        summary: 'Detected 2 forensic objects with high confidence.',
        detections: [
          {
            id: 'det_gun_01',
            label: 'Weapon - Semi-Automatic Handgun',
            category: 'weapon',
            confidence: 0.94,
            bbox: [24, 38, 22, 18],
            frameTimestamp: null,
            investigatorStatus: 'Verified Relevant',
            notes: 'Metallic firearm profile identified in suspect right-hand quadrant.'
          },
          {
            id: 'det_person_01',
            label: 'Suspect - Clothed Figure (Masked)',
            category: 'person',
            confidence: 0.92,
            bbox: [32, 12, 34, 76],
            frameTimestamp: null,
            investigatorStatus: 'Verified Relevant',
            notes: 'Subject height estimated at 6ft 1in matching suspect Vance profile.'
          }
        ],
        investigatorReview: {
          reviewedBy: 'Detective Sarah Miller',
          reviewedAt: '2026-10-21T09:30:00.000Z',
          status: 'Approved & Verified',
          verdictNotes: 'Weapon profile correlates with 9mm ballistics casing recovered from exit stairwell.'
        }
      },
      chainOfCustody: [
        {
          timestamp: '2026-10-19T02:00:00.000Z',
          action: 'EVIDENCE_INGESTION',
          investigator: 'Detective Sarah Miller',
          badgeId: 'INV-4029',
          notes: 'Original evidence logged and SHA-256 hash calculated. Standardized analysis duplicate preserved.',
          hashSnapshot: vaultHash
        },
        {
          timestamp: '2026-10-21T09:30:00.000Z',
          action: 'INVESTIGATOR_AI_ATTESTATION',
          investigator: 'Detective Sarah Miller',
          badgeId: 'INV-4029',
          notes: 'Investigator completed forensic verification: Status marked as "Approved & Verified".',
          hashSnapshot: vaultHash
        }
      ],
      createdAt: '2026-10-19T02:00:00.000Z',
      updatedAt: '2026-10-23T14:30:00.000Z'
    },
    {
      _id: 'evd_getaway_car',
      evidenceNumber: 'EVD-2026-1002',
      title: 'Getaway Vehicle - Exterior Traffic Surveillance',
      caseId: 'case_vault_robbery',
      fileType: 'image',
      originalFilename: 'evidence-getaway-car.png',
      mimeType: 'image/png',
      fileSize: 138400,
      originalPath: '/uploads/originals/evidence-getaway-car.png',
      analysisPath: '/uploads/analysis/analysis_evidence-getaway-car.png',
      sha256Hash: carHash,
      lastVerifiedHash: carHash,
      integrityStatus: 'Verified Intact',
      lastVerifiedAt: '2026-10-23T14:30:00.000Z',
      duplicateOf: null,
      uploadedBy: 'usr_david_chen',
      uploaderName: 'Inspector David Chen',
      uploaderBadge: 'INV-7721',
      description: 'Department of Transportation automated traffic camera at 5th Ave and Grand. Captured dark sedan speeding away from scene 3 minutes post-alarm.',
      sourceLocation: 'DOT Intercept Node #124',
      collectionDate: '2026-10-18T22:37:05.000Z',
      accessLevel: 'Standard',
      aiAnalysis: {
        analyzed: true,
        analyzedAt: '2026-10-20T14:00:00.000Z',
        model: 'Ultralytics YOLOv8-Forensic',
        summary: 'Detected 1 vehicle object.',
        detections: [
          {
            id: 'det_car_01',
            label: 'Vehicle - Dark Sedan',
            category: 'vehicle',
            confidence: 0.96,
            bbox: [15, 25, 65, 45],
            frameTimestamp: null,
            investigatorStatus: 'Verified Relevant',
            notes: 'Late model black sedan with tinted windows.'
          }
        ],
        investigatorReview: {
          reviewedBy: 'Inspector David Chen',
          reviewedAt: '2026-10-21T10:15:00.000Z',
          status: 'Approved & Verified',
          verdictNotes: 'Vehicle matches make registered to known associate of Marcus Vance.'
        }
      },
      chainOfCustody: [
        {
          timestamp: '2026-10-19T05:00:00.000Z',
          action: 'EVIDENCE_INGESTION',
          investigator: 'Inspector David Chen',
          badgeId: 'INV-7721',
          notes: 'DOT video frame extracted and verified.',
          hashSnapshot: carHash
        }
      ],
      createdAt: '2026-10-19T05:00:00.000Z',
      updatedAt: '2026-10-23T14:30:00.000Z'
    },
    {
      _id: 'evd_firearm',
      evidenceNumber: 'EVD-2026-1003',
      title: 'Recovered Tactical 9mm Handgun',
      caseId: 'case_vault_robbery',
      fileType: 'image',
      originalFilename: 'evidence-firearm.png',
      mimeType: 'image/png',
      fileSize: 139900,
      originalPath: '/uploads/originals/evidence-firearm.png',
      analysisPath: '/uploads/analysis/analysis_evidence-firearm.png',
      sha256Hash: gunHash,
      lastVerifiedHash: gunHash,
      integrityStatus: 'Verified Intact',
      lastVerifiedAt: '2026-10-23T14:30:00.000Z',
      duplicateOf: null,
      uploadedBy: 'usr_sarah_miller',
      uploaderName: 'Detective Sarah Miller',
      uploaderBadge: 'INV-4029',
      description: 'Physical firearm dropped near loading dock perimeter during flight. Serial number partially defaced.',
      sourceLocation: 'Loading Dock Alleyway',
      collectionDate: '2026-10-19T01:15:00.000Z',
      accessLevel: 'Restricted',
      aiAnalysis: {
        analyzed: true,
        analyzedAt: '2026-10-21T16:00:00.000Z',
        model: 'Ultralytics YOLOv8-Forensic',
        summary: 'Detected 1 ballistic weapon marker.',
        detections: [
          {
            id: 'det_firearm_02',
            label: 'Weapon - Semi-Automatic Handgun',
            category: 'weapon',
            confidence: 0.98,
            bbox: [20, 30, 60, 40],
            frameTimestamp: null,
            investigatorStatus: 'Verified Relevant',
            notes: 'High-contrast mechanical firearm profile confirmed.'
          }
        ],
        investigatorReview: {
          reviewedBy: 'Elena Rostova',
          reviewedAt: '2026-10-22T09:00:00.000Z',
          status: 'Approved & Verified',
          verdictNotes: 'Weapon sent to ballistics lab for striation matching.'
        }
      },
      chainOfCustody: [
        {
          timestamp: '2026-10-19T06:00:00.000Z',
          action: 'EVIDENCE_INGESTION',
          investigator: 'Detective Sarah Miller',
          badgeId: 'INV-4029',
          notes: 'Evidence photographed and cataloged in forensics lab.',
          hashSnapshot: gunHash
        }
      ],
      createdAt: '2026-10-19T06:00:00.000Z',
      updatedAt: '2026-10-23T14:30:00.000Z'
    },
    {
      _id: 'evd_phone',
      evidenceNumber: 'EVD-2026-1004',
      title: 'Intercepted Cellphone Hardware Extraction',
      caseId: 'case_ransomware_intrusion',
      fileType: 'image',
      originalFilename: 'evidence-phone.png',
      mimeType: 'image/png',
      fileSize: 137800,
      originalPath: '/uploads/originals/evidence-phone.png',
      analysisPath: '/uploads/analysis/analysis_evidence-phone.png',
      sha256Hash: phoneHash,
      lastVerifiedHash: phoneHash,
      integrityStatus: 'Verified Intact',
      lastVerifiedAt: '2026-10-23T14:30:00.000Z',
      duplicateOf: null,
      uploadedBy: 'usr_elena_rostova',
      uploaderName: 'Elena Rostova',
      uploaderBadge: 'INV-3310',
      description: 'Burner smartphone seized during search warrant. Contains encrypted messaging apps.',
      sourceLocation: 'Suspect Residence',
      collectionDate: '2026-10-21T10:00:00.000Z',
      accessLevel: 'Restricted',
      aiAnalysis: {
        analyzed: true,
        analyzedAt: '2026-10-22T11:00:00.000Z',
        model: 'Ultralytics YOLOv8-Forensic',
        summary: 'Detected 1 electronic device.',
        detections: [
          {
            id: 'det_phone_01',
            label: 'Electronic Device - Smartphone',
            category: 'electronics',
            confidence: 0.95,
            bbox: [35, 20, 30, 60],
            frameTimestamp: null,
            investigatorStatus: 'Verified Relevant',
            notes: 'Handheld smartphone device profile.'
          }
        ],
        investigatorReview: {
          reviewedBy: 'Elena Rostova',
          reviewedAt: '2026-10-22T13:00:00.000Z',
          status: 'Approved & Verified',
          verdictNotes: 'Device physical extraction imaged for Cellebrite data recovery.'
        }
      },
      chainOfCustody: [
        {
          timestamp: '2026-10-21T14:00:00.000Z',
          action: 'EVIDENCE_INGESTION',
          investigator: 'Elena Rostova',
          badgeId: 'INV-3310',
          notes: 'Hardware bagged in Faraday shield and cataloged.',
          hashSnapshot: phoneHash
        }
      ],
      createdAt: '2026-10-21T14:00:00.000Z',
      updatedAt: '2026-10-23T14:30:00.000Z'
    }
  ];

  // 5. Messages
  const messages = [
    {
      _id: 'msg_001',
      sender: 'usr_david_chen',
      senderName: 'Inspector David Chen',
      senderBadge: 'INV-7721',
      recipient: null,
      caseId: 'case_vault_robbery',
      content: 'Sarah, I just uploaded the exterior DOT traffic camera still (EVD-2026-1002). License plate is obscured with mud, but the vehicle body matches Vance’s known associate.',
      evidenceShare: 'evd_getaway_car',
      messageType: 'chat',
      read: true,
      createdAt: '2026-10-19T06:30:00.000Z'
    },
    {
      _id: 'msg_002',
      sender: 'usr_sarah_miller',
      senderName: 'Detective Sarah Miller',
      senderBadge: 'INV-4029',
      recipient: null,
      caseId: 'case_vault_robbery',
      content: 'Excellent work David. I ran the AI detection model over Camera #4 and verified the handgun profile. Elena, please cross-reference the striations with recovered evidence EVD-2026-1003.',
      evidenceShare: 'evd_cctv_vault',
      messageType: 'chat',
      read: true,
      createdAt: '2026-10-19T07:15:00.000Z'
    },
    {
      _id: 'msg_003',
      sender: 'usr_elena_rostova',
      senderName: 'Elena Rostova',
      senderBadge: 'INV-3310',
      recipient: null,
      caseId: 'case_vault_robbery',
      content: 'Understood Detective. Ballistics baseline established and SHA-256 hashes verified intact. Submitting report now.',
      evidenceShare: null,
      messageType: 'chat',
      read: true,
      createdAt: '2026-10-19T08:00:00.000Z'
    }
  ];

  // 6. Audit Logs
  const auditLogs = [
    {
      _id: 'log_001',
      timestamp: '2026-10-18T23:00:00.000Z',
      investigator: 'Detective Sarah Miller',
      badgeId: 'INV-4029',
      action: 'CASE_CREATED',
      targetType: 'Case',
      targetId: 'case_vault_robbery',
      details: 'Case CASE-2026-1042 opened under classification Armed Robbery.',
      ipAddress: '10.0.4.15'
    },
    {
      _id: 'log_002',
      timestamp: '2026-10-19T02:00:00.000Z',
      investigator: 'Detective Sarah Miller',
      badgeId: 'INV-4029',
      action: 'EVIDENCE_UPLOAD',
      targetType: 'Evidence',
      targetId: 'evd_cctv_vault',
      details: `File ingested: evidence-cctv-vault.png. SHA-256 digest: ${vaultHash}. Dual-copy preserved.`,
      ipAddress: '10.0.4.15'
    },
    {
      _id: 'log_003',
      timestamp: '2026-10-21T09:30:00.000Z',
      investigator: 'Detective Sarah Miller',
      badgeId: 'INV-4029',
      action: 'AI_FINDINGS_REVIEWED',
      targetType: 'Evidence',
      targetId: 'evd_cctv_vault',
      details: 'Investigator certified AI detections with status "Approved & Verified".',
      ipAddress: '10.0.4.15'
    },
    {
      _id: 'log_004',
      timestamp: '2026-10-23T14:30:00.000Z',
      investigator: 'Detective Sarah Miller',
      badgeId: 'INV-4029',
      action: 'INTEGRITY_VERIFIED_INTACT',
      targetType: 'Evidence',
      targetId: 'evd_cctv_vault',
      details: `Live SHA-256 checksum confirmed intact: ${vaultHash.slice(0, 16)}...`,
      ipAddress: '10.0.4.15'
    }
  ];

  fs.writeFileSync(path.join(DATA_DIR, 'users.json'), JSON.stringify(users, null, 2), 'utf8');
  fs.writeFileSync(path.join(DATA_DIR, 'cases.json'), JSON.stringify(cases, null, 2), 'utf8');
  fs.writeFileSync(path.join(DATA_DIR, 'suspects.json'), JSON.stringify(suspects, null, 2), 'utf8');
  fs.writeFileSync(path.join(DATA_DIR, 'evidence.json'), JSON.stringify(evidence, null, 2), 'utf8');
  fs.writeFileSync(path.join(DATA_DIR, 'messages.json'), JSON.stringify(messages, null, 2), 'utf8');
  fs.writeFileSync(path.join(DATA_DIR, 'audit_logs.json'), JSON.stringify(auditLogs, null, 2), 'utf8');
  fs.writeFileSync(path.join(DATA_DIR, 'evidence_requests.json'), JSON.stringify([], null, 2), 'utf8');

  console.log('[Seeder] Forensic database successfully seeded with realistic cases, evidence, SHA-256 baselines, suspects, and audit records.');
}

seed().catch(console.error);
