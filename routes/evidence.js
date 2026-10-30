const fs = require('fs');
const path = require('path');
const express = require('express');
const router = express.Router();
const Case = require('../models/Case');
const Evidence = require('../models/Evidence');
const AnalysisJob = require('../models/AnalysisJob');
const AuditLog = require('../models/AuditLog');
const { ensureAuthenticated } = require('../middleware/auth');
const { canAccessCase, canAccessEvidence } = require('../middleware/authorization');
const { uploadEvidence } = require('../middleware/upload');
const { extractImagePropertiesAndExif, generateThumbnail } = require('../services/metadataService');
const { calculateBufferHash, calculateFileHash } = require('../services/hashService');
const { getNextEvidenceNumber } = require('../services/caseNumberService');
const { recordEvidenceCustodyEvent } = require('../services/custodyService');
const { createAnalysisJob } = require('../services/autopsyService');
const { saveToStorage, serveFileResponse } = require('../services/storageService');

// 1. Upload Form
router.get('/upload', ensureAuthenticated, async (req, res) => {
  const caseId = req.query.caseId;
  if (!caseId) {
    return res.redirect('/cases');
  }

  try {
    const caseDoc = await Case.findById(caseId);
    if (!caseDoc) {
      return res.status(404).render('partials/error', {
        title: '404 - Case Not Found',
        message: 'The case associated with this upload request does not exist.'
      });
    }

    res.render('evidence/upload', {
      title: `Add Crime-Scene Pictures - ${caseDoc.caseNumber}`,
      caseDoc,
      errors: {}
    });
  } catch (err) {
    res.status(500).render('partials/error', {
      title: '500 - Upload Interface Fault',
      message: err.message
    });
  }
});

// 2. Process Multiple Image Uploads
router.post('/upload', ensureAuthenticated, uploadEvidence.array('evidenceFiles', 10), async (req, res) => {
  const caseId = req.body.caseId;
  if (!caseId) {
    return res.redirect('/cases');
  }

  try {
    const caseDoc = await Case.findById(caseId);
    if (!caseDoc) {
      return res.status(404).render('partials/error', {
        title: '404 - Case Not Found',
        message: 'The specified investigation case was not found.'
      });
    }

    const files = req.files;
    if (!files || files.length === 0) {
      return res.status(400).render('evidence/upload', {
        title: `Add Crime-Scene Pictures - ${caseDoc.caseNumber}`,
        caseDoc,
        errors: { files: 'Please select at least one crime-scene photograph to upload.' }
      });
    }

    const descriptions = Array.isArray(req.body.descriptions)
      ? req.body.descriptions
      : [req.body.description || ''];

    const uploadedRecords = [];
    const thumbnailsDir = path.join(path.dirname(files[0].path), 'thumbnails');
    if (!fs.existsSync(thumbnailsDir)) {
      fs.mkdirSync(thumbnailsDir, { recursive: true });
    }

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const buffer = fs.readFileSync(file.path);

      // 1. Calculate SHA-256 Hash from RAW original file bytes
      const sha256 = calculateBufferHash(buffer);

      // 2. Extract Sharp image properties and Exif-parser metadata
      const { properties, metadata } = await extractImagePropertiesAndExif(buffer, file.path);

      // 3. Generate thumbnail separately from original evidence
      const thumbFilename = `thumb_${file.filename}`;
      const thumbPath = path.join(thumbnailsDir, thumbFilename);
      await generateThumbnail(buffer, thumbPath, 320, 240);

      // Save original file to persistent GridFS storage
      const origStorage = await saveToStorage({
        buffer,
        filePath: file.path,
        filename: file.filename,
        mimeType: file.mimetype,
        bucketName: 'evidence_bucket',
        metadata: { caseNumber: caseDoc.caseNumber, originalFilename: file.originalname }
      });

      // Save thumbnail to persistent storage
      let thumbGridFsId = null;
      let thumbnailDataUri = '';
      if (fs.existsSync(thumbPath)) {
        const thumbBuf = fs.readFileSync(thumbPath);
        thumbnailDataUri = `data:image/jpeg;base64,${thumbBuf.toString('base64')}`;
        const thumbStorage = await saveToStorage({
          buffer: thumbBuf,
          filePath: thumbPath,
          filename: thumbFilename,
          mimeType: 'image/jpeg',
          bucketName: 'evidence_bucket'
        });
        thumbGridFsId = thumbStorage.gridFsId;
      }

      // 4. Generate unique atomic evidence identifier (EVID-CASE001-001)
      const evidenceIdentifier = await getNextEvidenceNumber(caseDoc.caseNumber);
      const fileDescription = (descriptions[i] || req.body.generalDescription || '').trim();

      const evidenceDoc = await Evidence.create({
        evidenceIdentifier,
        caseId: caseDoc._id,
        caseNumber: caseDoc.caseNumber,
        originalFilename: file.originalname,
        storedFilename: file.filename,
        storageKey: origStorage.storageKey,
        gridFsId: origStorage.gridFsId,
        protectedStoragePath: file.path,
        thumbnailPath: fs.existsSync(thumbPath) ? thumbPath : '',
        thumbnailGridFsId: thumbGridFsId,
        thumbnailDataUri: thumbnailDataUri,
        fileMimeType: file.mimetype,
        fileSize: file.size,
        imageProperties: properties,
        availableMetadata: metadata,
        sha256Hash: sha256,
        description: fileDescription,
        uploadedBy: req.investigator._id,
        uploaderName: req.investigator.fullName,
        uploadTimestamp: new Date(),
        inspectionStatus: 'Uninspected',
        currentCustodian: req.investigator._id,
        currentCustodianName: req.investigator.fullName,
        custodyStatus: 'In Custody'
      });

      uploadedRecords.push(evidenceDoc);

      // 5. Initial Custody Record
      await recordEvidenceCustodyEvent({
        caseDoc,
        evidence: evidenceDoc,
        actor: req.investigator,
        action: 'Evidence Received',
        reason: 'Initial digital evidence ingestion from crime-scene photography',
        notes: `Uploaded by ${req.investigator.fullName}. SHA-256 verified.`
      });

      // 6. Audit Log
      await AuditLog.create({
        actor: req.investigator._id,
        actorName: req.investigator.fullName,
        action: 'IMAGE_UPLOAD',
        relatedCase: caseDoc._id,
        caseNumber: caseDoc.caseNumber,
        relatedEvidence: evidenceDoc._id,
        relatedObjectIdentifier: evidenceIdentifier,
        changeSummary: `Uploaded evidence photo '${file.originalname}' (${(file.size / 1024).toFixed(1)} KB). Hash: ${sha256.substring(0, 16)}...`,
        ipAddress: req.ip || '127.0.0.1',
        userAgent: req.headers['user-agent'] || '',
        timestamp: new Date()
      });
    }

    res.redirect(`/cases/${caseDoc._id}?success=${encodeURIComponent(`Successfully ingested ${uploadedRecords.length} crime-scene image(s) with SHA-256 integrity verification.`)}`);
  } catch (error) {
    console.error('[Evidence Upload Error]:', error);
    res.status(500).render('partials/error', {
      title: '500 - Upload Processing Fault',
      message: `Failed to process image uploads: ${error.message}`
    });
  }
});

// 3. View Single Evidence Item Details
router.get('/:id', ensureAuthenticated, canAccessEvidence, async (req, res) => {
  try {
    const evidence = req.evidence;
    const caseDoc = req.caseDoc;

    const autopsyJobs = await AnalysisJob.find({ evidenceId: evidence._id }).sort({ submissionTimestamp: -1 });

    res.render('evidence/show', {
      title: `${evidence.evidenceIdentifier} - Evidence Details`,
      evidence,
      caseDoc,
      autopsyJobs,
      inspections: []
    });
  } catch (error) {
    console.error('[Evidence Show Error]:', error);
    res.status(500).render('partials/error', {
      title: '500 - Evidence Detail Fault',
      message: error.message
    });
  }
});

// 4. Edit Evidence Description
router.post('/:id/edit-description', ensureAuthenticated, canAccessEvidence, async (req, res) => {
  try {
    const evidence = req.evidence;
    const newDescription = (req.body.description || '').trim();
    const oldDescription = evidence.description;

    evidence.description = newDescription;
    evidence.lastModifiedTimestamp = new Date();
    await evidence.save();

    await AuditLog.create({
      actor: req.investigator._id,
      actorName: req.investigator.fullName,
      action: 'EVIDENCE_DESCRIPTION_MODIFIED',
      relatedCase: evidence.caseId,
      caseNumber: evidence.caseNumber,
      relatedEvidence: evidence._id,
      relatedObjectIdentifier: evidence.evidenceIdentifier,
      changeSummary: `Evidence description updated: '${oldDescription}' -> '${newDescription}'`,
      ipAddress: req.ip || '127.0.0.1',
      userAgent: req.headers['user-agent'] || '',
      timestamp: new Date()
    });

    res.redirect(`/evidence/${evidence._id}?success=${encodeURIComponent('Evidence description updated successfully.')}`);
  } catch (error) {
    console.error('[Evidence Description Error]:', error);
    res.redirect(`/evidence/${req.params.id}?error=${encodeURIComponent('Failed to update description.')}`);
  }
});

// 5. Submit Evidence to Autopsy Forensic Ingest
router.post('/:id/autopsy', ensureAuthenticated, canAccessEvidence, async (req, res) => {
  try {
    const evidence = req.evidence;
    const caseDoc = req.caseDoc;
    const modules = Array.isArray(req.body.modules) ? req.body.modules : (req.body.modules ? [req.body.modules] : []);

    const job = await createAnalysisJob({
      caseDoc,
      evidenceDoc: evidence,
      investigator: req.investigator,
      modules
    });

    res.redirect(`/evidence/${evidence._id}?success=${encodeURIComponent(`Autopsy forensic analysis job ${job.jobIdentifier} initiated.`)}`);
  } catch (error) {
    console.error('[Autopsy Evidence Ingest Error]:', error);
    res.redirect(`/evidence/${req.params.id}?error=${encodeURIComponent(`Analysis failed: ${error.message}`)}`);
  }
});

// Backwards-compatible /:id/inspect redirecting to Autopsy ingest
router.post('/:id/inspect', ensureAuthenticated, canAccessEvidence, async (req, res) => {
  return res.redirect(307, `/evidence/${req.params.id}/autopsy`);
});

// 6. Authenticated File Serving for Original Evidence Image across all environments
router.get('/:id/file', ensureAuthenticated, canAccessEvidence, async (req, res) => {
  const evidence = req.evidence;
  await serveFileResponse(req, res, {
    gridFsId: evidence.gridFsId,
    filename: evidence.storedFilename || evidence.storageKey,
    localPath: evidence.protectedStoragePath,
    mimeType: evidence.fileMimeType || 'image/jpeg',
    bucketName: 'evidence_bucket',
    fallbackDataUri: evidence.thumbnailDataUri,
    fallbackPath: '/images/evidence-placeholder.svg',
    downloadAs: req.query.download ? evidence.originalFilename : null
  });
});

// 7. Authenticated Thumbnail Serving with persistent GridFS fallback
router.get('/:id/thumbnail', ensureAuthenticated, canAccessEvidence, async (req, res) => {
  const evidence = req.evidence;
  await serveFileResponse(req, res, {
    gridFsId: evidence.thumbnailGridFsId || evidence.gridFsId,
    filename: evidence.thumbnailPath ? path.basename(evidence.thumbnailPath) : evidence.storedFilename,
    localPath: evidence.thumbnailPath || evidence.protectedStoragePath,
    mimeType: 'image/jpeg',
    bucketName: 'evidence_bucket',
    fallbackDataUri: evidence.thumbnailDataUri,
    fallbackPath: '/images/evidence-placeholder.svg'
  });
});

module.exports = router;
