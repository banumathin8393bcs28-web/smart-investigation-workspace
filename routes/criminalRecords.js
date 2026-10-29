const express = require('express');
const router = express.Router();
const path = require('path');
const CriminalRecord = require('../models/CriminalRecord');
const Case = require('../models/Case');
const AuditLog = require('../models/AuditLog');
const { ensureAuthenticated } = require('../middleware/auth');
const { uploadProfile } = require('../middleware/upload');
const { saveToStorage, serveFileResponse } = require('../services/storageService');

// 1. List & Filter Criminal Records
router.get('/', ensureAuthenticated, async (req, res) => {
  try {
    const { q, status, riskLevel } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (riskLevel) filter.riskLevel = riskLevel;

    if (q) {
      const searchRegex = new RegExp(q.trim(), 'i');
      filter.$or = [
        { fullName: searchRegex },
        { alias: searchRegex },
        { nationalId: searchRegex }
      ];
    }

    const records = await CriminalRecord.find(filter).sort({ createdAt: -1 });

    res.render('suspects/index', {
      title: 'Criminal Records & Suspect Dossiers - Smart Investigation Workspace',
      records,
      suspects: records, // backwards compatibility
      query: req.query,
      success: req.query.success || null,
      error: req.query.error || null
    });
  } catch (error) {
    console.error('[Criminal Records List Error]:', error);
    res.status(500).render('partials/error', {
      title: '500 - Registry Fault',
      message: error.message
    });
  }
});

// 2. New Criminal Record Form
router.get('/new', ensureAuthenticated, async (req, res) => {
  try {
    const cases = await Case.find().select('caseNumber caseName');
    res.render('suspects/new', {
      title: 'Register Criminal Profile - Smart Investigation Workspace',
      cases,
      errors: {}
    });
  } catch (error) {
    res.status(500).render('partials/error', {
      title: '500 - Interface Fault',
      message: error.message
    });
  }
});

// 3. Process Criminal Record Registration
router.post('/', ensureAuthenticated, uploadProfile.single('photo'), async (req, res) => {
  try {
    const {
      fullName,
      alias,
      nationalId,
      gender,
      dob,
      phone,
      address,
      status,
      riskLevel,
      height,
      eyeColor,
      hairColor,
      identifyingMarks,
      connectedCaseId
    } = req.body;

    if (!fullName || fullName.trim().length < 2) {
      return res.redirect('/criminals/new?error=Full+legal+name+is+required.');
    }

    let photoPath = '/images/default-suspect.png';
    let photoGridFsId = null;

    if (req.file) {
      photoPath = `/criminals/photo/${req.file.filename}`;
      try {
        const storageResult = await saveToStorage({
          filePath: req.file.path,
          filename: req.file.filename,
          mimeType: req.file.mimetype,
          bucketName: 'profile_bucket',
          metadata: { subjectName: fullName }
        });
        photoGridFsId = storageResult.gridFsId;
      } catch (e) {
        console.warn('[Criminal Record] Photo persistent storage warning:', e.message);
      }
    }

    const count = await CriminalRecord.countDocuments();
    const seq = String(count + 1).padStart(4, '0');
    const recordNumber = `CR-${new Date().getFullYear()}-${seq}`;

    const connectedCases = connectedCaseId ? [connectedCaseId] : [];

    let calculatedAge = null;
    if (dob) {
      const birth = new Date(dob);
      calculatedAge = Math.floor((Date.now() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    }

    const newRecord = await CriminalRecord.create({
      recordNumber,
      fullName: fullName.trim(),
      alias: (alias || 'None').trim(),
      nationalId: (nationalId || '').trim(),
      photo: photoPath,
      photoGridFsId,
      gender: gender || 'Unknown',
      dob: dob ? new Date(dob) : null,
      age: calculatedAge,
      phone: (phone || '').trim(),
      address: (address || '').trim(),
      status: status || 'Person of Interest',
      riskLevel: riskLevel || 'Moderate',
      physicalTraits: {
        height: (height || 'Not recorded').trim(),
        eyeColor: (eyeColor || 'Not recorded').trim(),
        hairColor: (hairColor || 'Not recorded').trim(),
        identifyingMarks: (identifyingMarks || 'None noted').trim()
      },
      connectedCases,
      registeredBy: req.investigator._id,
      registeredByName: req.investigator.fullName,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await AuditLog.create({
      actor: req.investigator._id,
      actorName: req.investigator.fullName,
      action: 'CRIMINAL_RECORD_CREATED',
      relatedObjectIdentifier: recordNumber,
      changeSummary: `Criminal record ${recordNumber} (${newRecord.fullName}) registered.`,
      ipAddress: req.ip || '127.0.0.1',
      userAgent: req.headers['user-agent'] || '',
      timestamp: new Date()
    });

    res.redirect(`/criminals/${newRecord._id}?success=${encodeURIComponent(`Profile dossier ${recordNumber} created successfully.`)}`);
  } catch (error) {
    console.error('[Create Criminal Record Error]:', error);
    res.redirect(`/criminals/new?error=${encodeURIComponent(error.message)}`);
  }
});

// 4. View Criminal Record Dossier
router.get('/:id', ensureAuthenticated, async (req, res) => {
  try {
    const record = await CriminalRecord.findById(req.params.id).populate('connectedCases', 'caseNumber caseName status crimeType');
    if (!record) {
      return res.redirect('/criminals?error=Record+not+found.');
    }

    const allCases = await Case.find().select('caseNumber caseName');

    res.render('suspects/show', {
      title: `${record.fullName} - Dossier | Smart Investigation Workspace`,
      record,
      suspect: record, // backwards compatibility
      allCases,
      success: req.query.success || null,
      error: req.query.error || null
    });
  } catch (error) {
    console.error('[Criminal Record Detail Error]:', error);
    res.redirect('/criminals?error=Failed+to+load+profile+dossier.');
  }
});

// 5. Append Interrogation Note
router.post('/:id/interrogation', ensureAuthenticated, async (req, res) => {
  try {
    const { notes } = req.body;
    if (!notes || notes.trim().length === 0) {
      return res.redirect(`/criminals/${req.params.id}?error=Interrogation+notes+cannot+be+empty.`);
    }

    const record = await CriminalRecord.findById(req.params.id);
    if (!record) {
      return res.redirect('/criminals?error=Record+not+found.');
    }

    record.interrogationNotes.push({
      date: new Date(),
      investigatorName: req.investigator.fullName,
      notes: notes.trim()
    });
    record.updatedAt = new Date();
    await record.save();

    await AuditLog.create({
      actor: req.investigator._id,
      actorName: req.investigator.fullName,
      action: 'INTERROGATION_RECORDED',
      relatedObjectIdentifier: record.recordNumber,
      changeSummary: `Interrogation statement recorded for ${record.fullName}.`,
      ipAddress: req.ip || '127.0.0.1',
      userAgent: req.headers['user-agent'] || '',
      timestamp: new Date()
    });

    res.redirect(`/criminals/${record._id}?success=Interrogation+note+recorded+successfully.`);
  } catch (error) {
    console.error('[Append Interrogation Error]:', error);
    res.redirect(`/criminals/${req.params.id}?error=${encodeURIComponent(error.message)}`);
  }
});

// 6. Link Active Case to Criminal Profile
router.post('/:id/link-case', ensureAuthenticated, async (req, res) => {
  try {
    const { caseId } = req.body;
    const record = await CriminalRecord.findById(req.params.id);
    if (!record || !caseId) {
      return res.redirect('/criminals');
    }

    if (!record.connectedCases.includes(caseId)) {
      record.connectedCases.push(caseId);
      record.updatedAt = new Date();
      await record.save();
    }

    res.redirect(`/criminals/${record._id}?success=Investigation+case+linked+to+profile.`);
  } catch (error) {
    console.error('[Link Case Error]:', error);
    res.redirect(`/criminals/${req.params.id}?error=${encodeURIComponent(error.message)}`);
  }
});

// 7. Serve Criminal Photograph persistently across all environments
router.get('/photo/:filename', (req, res) => {
  const filename = path.basename(req.params.filename);
  const filePath = path.join(__dirname, '..', 'private_uploads', 'profiles', filename);
  const ext = path.extname(filename).toLowerCase();
  const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';

  serveFileResponse(req, res, {
    filename,
    localPath: filePath,
    mimeType,
    bucketName: 'profile_bucket',
    fallbackPath: '/images/default-suspect.png'
  });
});

module.exports = router;
