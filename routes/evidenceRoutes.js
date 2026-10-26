const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const Evidence = require('../models/Evidence');
const Case = require('../models/Case');
const EvidenceRequest = require('../models/EvidenceRequest');
const AuditLog = require('../models/AuditLog');
const IntegrityService = require('../services/integrityService');
const { isAuthenticated } = require('../middleware/auth');
const { uploadEvidence } = require('../middleware/upload');

// GET /evidence/gallery - Picture and Video Gallery format
router.get('/gallery', isAuthenticated, async (req, res) => {
  try {
    const { caseId, type, integrity } = req.query;
    let query = {};
    if (caseId) query.caseId = caseId;
    if (type && type !== 'all') query.fileType = type;
    if (integrity && integrity !== 'all') query.integrityStatus = integrity;

    const [allEvidence, cases] = await Promise.all([
      Evidence.find(query),
      Case.find()
    ]);

    allEvidence.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.render('evidence/gallery', {
      title: 'Digital Evidence Media Gallery | Smart Investigation Workspace',
      evidenceItems: allEvidence,
      cases,
      currentFilter: {
        caseId: caseId || '',
        type: type || 'all',
        integrity: integrity || 'all'
      },
      success: req.query.success || null,
      error: req.query.error || null
    });
  } catch (err) {
    console.error('Gallery error:', err);
    res.redirect('/dashboard?error=Could not open evidence gallery');
  }
});

// GET /evidence - Redirect or standard table list
router.get('/', isAuthenticated, (req, res) => {
  res.redirect('/evidence/gallery');
});

// GET /evidence/upload
router.get('/upload', isAuthenticated, async (req, res) => {
  const cases = await Case.find();
  res.render('evidence/upload', {
    title: 'Ingest New Digital Evidence | Smart Investigation Workspace',
    cases,
    preselectedCase: req.query.caseId || '',
    error: req.query.error || null,
    duplicateWarning: null
  });
});

// POST /evidence/upload
router.post('/upload', isAuthenticated, uploadEvidence.single('evidenceFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.redirect('/evidence/upload?error=No file selected for ingestion.');
    }

    const {
      title,
      caseId,
      description,
      sourceLocation,
      collectionDate,
      accessLevel
    } = req.body;

    if (!title || !caseId) {
      // Remove uploaded file if validation fails
      fs.unlinkSync(req.file.path);
      return res.redirect('/evidence/upload?error=Title and Associated Case are required.');
    }

    // 1. Calculate SHA-256 hash of original file
    const originalHash = await IntegrityService.calculateFileHash(req.file.path);

    // 2. Check for duplicate media
    const existingDuplicate = await IntegrityService.checkDuplicateHash(originalHash);

    // 3. Determine file type
    const mime = req.file.mimetype;
    let fileType = 'document';
    if (mime.startsWith('image/')) fileType = 'image';
    else if (mime.startsWith('video/')) fileType = 'video';
    else if (mime.startsWith('audio/')) fileType = 'audio';

    // 4. Create standardized analysis copy without touching the original
    const analysisDir = path.join(__dirname, '..', 'public', 'uploads', 'analysis');
    const analysisRelPath = await IntegrityService.createAnalysisCopy(req.file.path, analysisDir, req.file.filename);
    const originalRelPath = `/uploads/originals/${req.file.filename}`;

    // 5. Save Evidence record
    const newEvidence = await Evidence.create({
      title: title.trim(),
      caseId,
      fileType,
      originalFilename: req.file.originalname,
      mimeType: mime,
      fileSize: req.file.size,
      originalPath: originalRelPath,
      analysisPath: analysisRelPath,
      sha256Hash: originalHash,
      duplicateOf: existingDuplicate ? existingDuplicate.evidenceNumber : null,
      uploadedBy: req.user._id,
      uploaderName: req.user.name,
      uploaderBadge: req.user.badgeId,
      description: description ? description.trim() : '',
      sourceLocation: sourceLocation ? sourceLocation.trim() : 'Digital Extraction',
      collectionDate: collectionDate || new Date().toISOString(),
      accessLevel: accessLevel || 'Standard'
    });

    // 6. Update Case Timeline
    const targetCase = await Case.findById(caseId);
    if (targetCase) {
      await Case.addTimelineEvent(caseId, {
        title: 'Digital Evidence Ingested',
        description: `Evidence ${newEvidence.evidenceNumber} ("${newEvidence.title}") logged. SHA-256: ${originalHash.slice(0, 16)}...${existingDuplicate ? ' [DUPLICATE MEDIA DETECTED]' : ''}`,
        investigator: req.user.name,
        type: 'evidence_ingestion'
      });
    }

    // 7. Audit Log
    await AuditLog.log({
      investigator: req.user.name,
      badgeId: req.user.badgeId,
      action: 'EVIDENCE_UPLOAD',
      targetType: 'Evidence',
      targetId: newEvidence._id,
      details: `File ingested: ${req.file.originalname}. SHA-256 digest: ${originalHash}.${existingDuplicate ? ` Note: Duplicate of ${existingDuplicate.evidenceNumber}.` : ''}`,
      ipAddress: req.ip
    });

    const msg = existingDuplicate
      ? `Evidence ingested. Note: File matches hash of existing evidence ${existingDuplicate.evidenceNumber}.`
      : `Evidence ${newEvidence.evidenceNumber} logged and cryptographic baseline established.`;

    res.redirect(`/evidence/${newEvidence._id}?success=${encodeURIComponent(msg)}`);
  } catch (err) {
    console.error('Evidence upload error:', err);
    res.redirect('/evidence/upload?error=Internal error processing evidence file.');
  }
});

// GET /evidence/requests - Evidence transfer & access approvals
router.get('/requests', isAuthenticated, async (req, res) => {
  try {
    const [allRequests, evidenceList, cases] = await Promise.all([
      EvidenceRequest.find(),
      Evidence.find(),
      Case.find()
    ]);

    const enrichedRequests = allRequests.map(r => {
      const ev = evidenceList.find(e => e._id.toString() === (r.evidenceId || '').toString());
      const cs = cases.find(c => c._id.toString() === (r.caseId || '').toString());
      return {
        ...r,
        evidence: ev || { title: 'Unknown Evidence', evidenceNumber: 'N/A' },
        caseItem: cs || { caseNumber: 'N/A', title: 'N/A' }
      };
    });

    enrichedRequests.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.render('evidence/requests', {
      title: 'Evidence Transfer & Access Requests | Smart Investigation Workspace',
      requests: enrichedRequests,
      success: req.query.success || null,
      error: req.query.error || null
    });
  } catch (err) {
    console.error('Requests error:', err);
    res.redirect('/dashboard?error=Failed to load evidence requests');
  }
});

// POST /evidence/requests - Submit new access request
router.post('/requests', isAuthenticated, async (req, res) => {
  try {
    const { evidenceId, caseId, purpose } = req.body;
    if (!evidenceId || !purpose) {
      return res.redirect('/evidence/gallery?error=Evidence ID and Purpose are required.');
    }

    const newReq = await EvidenceRequest.create({
      evidenceId,
      caseId: caseId || '',
      requestedBy: req.user._id,
      requestedByName: req.user.name,
      requestedByBadge: req.user.badgeId,
      purpose: purpose.trim(),
      status: 'Pending'
    });

    await AuditLog.log({
      investigator: req.user.name,
      badgeId: req.user.badgeId,
      action: 'EVIDENCE_REQUEST_SUBMITTED',
      targetType: 'EvidenceRequest',
      targetId: newReq._id,
      details: `Investigator requested access authorization for evidence ${evidenceId}.`,
      ipAddress: req.ip
    });

    res.redirect('/evidence/requests?success=Evidence access request filed successfully.');
  } catch (err) {
    console.error('Submit request error:', err);
    res.redirect('/evidence/requests?error=Failed to file access request.');
  }
});

// POST /evidence/requests/:id/respond - Approve or reject request
router.post('/requests/:id/respond', isAuthenticated, async (req, res) => {
  try {
    const { status, responseNotes } = req.body;
    const reqDoc = await EvidenceRequest.findById(req.params.id);
    if (!reqDoc) return res.redirect('/evidence/requests?error=Request not found.');

    await EvidenceRequest.findByIdAndUpdate(req.params.id, {
      status: status === 'Approved' ? 'Approved' : 'Rejected',
      responseNotes: responseNotes ? responseNotes.trim() : '',
      respondedAt: new Date().toISOString(),
      respondedBy: req.user.name
    });

    await AuditLog.log({
      investigator: req.user.name,
      badgeId: req.user.badgeId,
      action: `EVIDENCE_REQUEST_${status.toUpperCase()}`,
      targetType: 'EvidenceRequest',
      targetId: reqDoc._id,
      details: `Access request for evidence ${reqDoc.evidenceId} was ${status} by ${req.user.name}.`,
      ipAddress: req.ip
    });

    res.redirect(`/evidence/requests?success=Request marked as ${status}.`);
  } catch (err) {
    console.error('Respond request error:', err);
    res.redirect('/evidence/requests?error=Failed to process request decision.');
  }
});

// GET /evidence/:id - Details, Tamper Check, Chain of Custody
router.get('/:id', isAuthenticated, async (req, res) => {
  try {
    const evidence = await Evidence.findById(req.params.id);
    if (!evidence) {
      return res.redirect('/evidence/gallery?error=Evidence record not found.');
    }

    const linkedCase = evidence.caseId ? await Case.findById(evidence.caseId) : null;
    const duplicateEvidence = evidence.duplicateOf ? await Evidence.findOne({ evidenceNumber: evidence.duplicateOf }) : null;

    res.render('evidence/show', {
      title: `${evidence.evidenceNumber} - Digital Forensics | Smart Investigation Workspace`,
      evidence,
      linkedCase,
      duplicateEvidence,
      success: req.query.success || null,
      error: req.query.error || null
    });
  } catch (err) {
    console.error('Evidence view error:', err);
    res.redirect('/evidence/gallery?error=Failed to load evidence details.');
  }
});

// POST /evidence/:id/verify - Live Cryptographic SHA-256 Tamper Check
router.post('/:id/verify', isAuthenticated, async (req, res) => {
  try {
    const result = await IntegrityService.verifyEvidenceIntegrity(req.params.id, req.user);

    await AuditLog.log({
      investigator: req.user.name,
      badgeId: req.user.badgeId,
      action: result.isIntact ? 'INTEGRITY_VERIFIED_INTACT' : 'INTEGRITY_TAMPER_ALERT',
      targetType: 'Evidence',
      targetId: req.params.id,
      details: result.isIntact
        ? `Live SHA-256 checksum confirmed intact: ${result.currentHash.slice(0, 16)}...`
        : `TAMPER ALERT: Live hash (${result.currentHash.slice(0, 16)}...) differs from original (${result.originalHash.slice(0, 16)}...).`,
      ipAddress: req.ip
    });

    if (result.isIntact) {
      res.redirect(`/evidence/${req.params.id}?success=Cryptographic verification PASSED: SHA-256 baseline matches original byte-for-byte.`);
    } else {
      res.redirect(`/evidence/${req.params.id}?error=CRITICAL TAMPER WARNING: Checksum mismatch detected! Original file content has been altered.`);
    }
  } catch (err) {
    console.error('Verification error:', err);
    res.redirect(`/evidence/${req.params.id}?error=${encodeURIComponent(err.message)}`);
  }
});

module.exports = router;
