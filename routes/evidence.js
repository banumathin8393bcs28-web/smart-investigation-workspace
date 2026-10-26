const fs = require('fs');
const path = require('path');
const express = require('express');
const router = express.Router();
const Case = require('../models/Case');
const Evidence = require('../models/Evidence');
const AIInspection = require('../models/AIInspection');
const AuditLog = require('../models/AuditLog');
const { ensureAuthenticated } = require('../middleware/auth');
const { canAccessCase, canAccessEvidence } = require('../middleware/authorization');
const { uploadEvidence } = require('../middleware/upload');
const { extractImagePropertiesAndExif, generateThumbnail } = require('../services/metadataService');
const { calculateBufferHash, calculateFileHash } = require('../services/hashService');
const { getNextEvidenceNumber } = require('../services/caseNumberService');
const { recordEvidenceCustodyEvent } = require('../services/custodyService');
const { inspectEvidenceImage } = require('../services/aiService');

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

      // 4. Generate unique atomic evidence identifier (EVID-CASE001-001)
      const evidenceIdentifier = await getNextEvidenceNumber(caseDoc.caseNumber);
      const fileDescription = (descriptions[i] || req.body.generalDescription || '').trim();

      const evidenceDoc = await Evidence.create({
        evidenceIdentifier,
        caseId: caseDoc._id,
        caseNumber: caseDoc.caseNumber,
        originalFilename: file.originalname,
        storedFilename: file.filename,
        protectedStoragePath: file.path,
        thumbnailPath: fs.existsSync(thumbPath) ? thumbPath : '',
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

    const inspections = await AIInspection.find({ evidenceId: evidence._id }).sort({ inspectionTimestamp: -1 });

    res.render('evidence/show', {
      title: `${evidence.evidenceIdentifier} - Evidence Details`,
      evidence,
      caseDoc,
      inspections
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

// 5. Trigger AI Object Inspection
router.post('/:id/inspect', ensureAuthenticated, canAccessEvidence, async (req, res) => {
  try {
    const evidence = req.evidence;
    const caseDoc = req.caseDoc;
    const confidenceThreshold = parseFloat(req.body.confidenceThreshold || '0.25');

    // Run inspection via AI Service
    const inspection = await inspectEvidenceImage({
      evidence,
      caseDoc,
      investigator: req.investigator,
      confidenceThreshold
    });

    // Audit Log
    await AuditLog.create({
      actor: req.investigator._id,
      actorName: req.investigator.fullName,
      action: 'AI_IMAGE_INSPECTED',
      relatedCase: caseDoc._id,
      caseNumber: caseDoc.caseNumber,
      relatedEvidence: evidence._id,
      relatedObjectIdentifier: evidence.evidenceIdentifier,
      changeSummary: `AI object detection completed. Status: ${inspection.inspectionStatus}. Detections: ${inspection.detections.length}.`,
      ipAddress: req.ip || '127.0.0.1',
      userAgent: req.headers['user-agent'] || '',
      timestamp: new Date()
    });

    res.redirect(`/evidence/${evidence._id}?success=${encodeURIComponent(`AI inspection finished: ${inspection.summaryMessage}`)}`);
  } catch (error) {
    console.error('[AI Inspection Error]:', error);
    res.redirect(`/evidence/${req.params.id}?error=${encodeURIComponent(`Inspection failed: ${error.message}`)}`);
  }
});

// 6. Authenticated File Serving for Original Evidence Image
router.get('/:id/file', ensureAuthenticated, canAccessEvidence, (req, res) => {
  const filePath = req.evidence.protectedStoragePath;
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('Evidence file not found on disk.');
  }
  res.setHeader('Content-Type', req.evidence.fileMimeType);
  res.sendFile(filePath);
});

// 7. Authenticated Thumbnail Serving
router.get('/:id/thumbnail', ensureAuthenticated, canAccessEvidence, (req, res) => {
  const thumbPath = req.evidence.thumbnailPath;
  if (thumbPath && fs.existsSync(thumbPath)) {
    res.setHeader('Content-Type', 'image/jpeg');
    return res.sendFile(thumbPath);
  }
  // Fallback to original
  res.sendFile(req.evidence.protectedStoragePath);
});

// 8. Authenticated Annotated Image Serving
router.get('/:id/annotated', ensureAuthenticated, canAccessEvidence, async (req, res) => {
  const latestInspection = await AIInspection.findOne({
    evidenceId: req.evidence._id,
    inspectionStatus: 'Success'
  }).sort({ inspectionTimestamp: -1 });

  if (!latestInspection || !latestInspection.annotatedImageReference || !fs.existsSync(latestInspection.annotatedImageReference)) {
    return res.status(404).send('No annotated inspection image found.');
  }

  res.setHeader('Content-Type', req.evidence.fileMimeType);
  res.sendFile(latestInspection.annotatedImageReference);
});

module.exports = router;
