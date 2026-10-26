const express = require('express');
const router = express.Router();
const Case = require('../models/Case');
const Evidence = require('../models/Evidence');
const AIInspection = require('../models/AIInspection');
const Custody = require('../models/Custody');
const AuditLog = require('../models/AuditLog');
const { ensureAuthenticated } = require('../middleware/auth');
const { canAccessCase } = require('../middleware/authorization');
const { validateCaseCreation, handleValidationErrors } = require('../middleware/validation');
const { getNextCaseNumber } = require('../services/caseNumberService');
const { formatTimestamp } = require('../services/timestampService');

// 1. View Existing Cases (List / Search / Filter)
router.get('/', ensureAuthenticated, async (req, res) => {
  try {
    const investigatorId = req.investigator._id;
    const { search, crimeType, status, incidentDate } = req.query;

    const query = {
      $or: [
        { assignedInvestigator: investigatorId },
        { createdBy: investigatorId },
        { collaborators: investigatorId }
      ]
    };

    if (search && search.trim()) {
      const s = search.trim();
      query.$and = [
        {
          $or: [
            { caseNumber: { $regex: s, $options: 'i' } },
            { caseName: { $regex: s, $options: 'i' } },
            { incidentLocation: { $regex: s, $options: 'i' } }
          ]
        }
      ];
    }

    if (crimeType && crimeType !== 'All') {
      query.crimeType = crimeType;
    }

    if (status && status !== 'All') {
      query.status = status;
    }

    if (incidentDate) {
      const targetDate = new Date(incidentDate);
      const nextDay = new Date(targetDate);
      nextDay.setDate(nextDay.getDate() + 1);
      query.incidentDate = { $gte: targetDate, $lt: nextDay };
    }

    const cases = await Case.find(query).sort({ lastUpdatedTimestamp: -1 });

    res.render('cases/index', {
      title: 'Existing Investigation Cases - Smart Investigation Workspace',
      cases,
      filters: {
        search: search || '',
        crimeType: crimeType || 'All',
        status: status || 'All',
        incidentDate: incidentDate || ''
      }
    });
  } catch (error) {
    console.error('[Cases List Error]:', error);
    res.status(500).render('partials/error', {
      title: '500 - Case Query Error',
      message: 'Failed to retrieve cases from MongoDB database.'
    });
  }
});

// 2. Create New Case - Form
router.get('/new', ensureAuthenticated, (req, res) => {
  res.render('cases/new', {
    title: 'Create New Case - Smart Investigation Workspace',
    formData: {
      reportingInvestigator: req.investigator.fullName,
      department: req.investigator.role ? `${req.investigator.role} Unit` : 'Forensics Unit'
    },
    errors: {}
  });
});

// 3. Create New Case - Process (Ingest Case)
router.post('/new', ensureAuthenticated, validateCaseCreation, async (req, res) => {
  const validation = handleValidationErrors(req);
  if (validation.hasErrors) {
    return res.status(400).render('cases/new', {
      title: 'Create New Case - Smart Investigation Workspace',
      formData: req.body,
      errors: validation.errors
    });
  }

  try {
    // Concurrency-safe atomic case number generation (CASE001, CASE002...)
    const caseNumber = await getNextCaseNumber();
    const serverTimestamp = new Date();

    const {
      caseName,
      crimeType,
      crimeTypeOther,
      status,
      incidentDate,
      incidentTime,
      incidentLocation,
      crimeSceneAddress,
      caseDescription,
      reportingInvestigator,
      department,
      victimDetails,
      suspectDetails,
      witnessDetails,
      preliminaryFindings,
      knownObjects,
      additionalNotes
    } = req.body;

    const newCase = await Case.create({
      caseNumber,
      caseName: caseName.trim(),
      crimeType,
      crimeTypeOther: crimeType === 'Other' ? (crimeTypeOther || '').trim() : '',
      status: status || 'New',
      incidentDate: new Date(incidentDate),
      incidentTime,
      incidentLocation: incidentLocation.trim(),
      crimeSceneAddress: (crimeSceneAddress || '').trim(),
      caseDescription: caseDescription.trim(),
      reportingInvestigator: reportingInvestigator.trim(),
      department: (department || 'Forensic Investigation Division').trim(),
      victimDetails: (victimDetails || '').trim(),
      suspectDetails: (suspectDetails || '').trim(),
      witnessDetails: (witnessDetails || '').trim(),
      preliminaryFindings: (preliminaryFindings || '').trim(),
      knownObjects: (knownObjects || '').trim(),
      additionalNotes: (additionalNotes || '').trim(),
      createdBy: req.investigator._id,
      creatorName: req.investigator.fullName,
      assignedInvestigator: req.investigator._id,
      assignedName: req.investigator.fullName,
      collaborators: [],
      creationTimestamp: serverTimestamp,
      lastUpdatedTimestamp: serverTimestamp,
      lastUpdatedBy: req.investigator._id,
      lastUpdatedByName: req.investigator.fullName
    });

    // Record Audit Log
    await AuditLog.create({
      actor: req.investigator._id,
      actorName: req.investigator.fullName,
      action: 'CASE_CREATED',
      relatedCase: newCase._id,
      caseNumber: newCase.caseNumber,
      changeSummary: `Case ${newCase.caseNumber} ("${newCase.caseName}") ingested by ${req.investigator.fullName}.`,
      ipAddress: req.ip || '127.0.0.1',
      userAgent: req.headers['user-agent'] || '',
      timestamp: serverTimestamp
    });

    res.redirect(`/cases/${newCase._id}?success=${encodeURIComponent(`Case ${newCase.caseNumber} registered successfully.`)}`);
  } catch (error) {
    console.error('[Case Ingestion Error]:', error);
    res.status(500).render('cases/new', {
      title: 'Create New Case - Smart Investigation Workspace',
      formData: req.body,
      errors: { general: 'Failed to ingest case into database. Please verify inputs.' }
    });
  }
});

// 4. View Case Details
router.get('/:id', ensureAuthenticated, canAccessCase, async (req, res) => {
  try {
    const caseDoc = req.caseDoc;

    // Fetch related evidence
    const evidenceList = await Evidence.find({ caseId: caseDoc._id }).sort({ uploadTimestamp: -1 });

    // Fetch related AI inspections
    const inspections = await AIInspection.find({ caseId: caseDoc._id }).sort({ inspectionTimestamp: -1 });

    // Fetch chain of custody records
    const custodyHistory = await Custody.find({ caseId: caseDoc._id }).sort({ eventTimestamp: -1 });

    // Fetch audit activity logs
    const auditLogs = await AuditLog.find({ relatedCase: caseDoc._id }).sort({ timestamp: -1 });

    res.render('cases/show', {
      title: `${caseDoc.caseNumber}: ${caseDoc.caseName} - Smart Investigation Workspace`,
      caseDoc,
      evidenceList,
      inspections,
      custodyHistory,
      auditLogs
    });
  } catch (error) {
    console.error('[Case Show Error]:', error);
    res.status(500).render('partials/error', {
      title: '500 - Case Error',
      message: 'Failed to load case records.'
    });
  }
});

// 5. Edit Case Details - Form
router.get('/:id/edit', ensureAuthenticated, canAccessCase, (req, res) => {
  res.render('cases/edit', {
    title: `Edit Case ${req.caseDoc.caseNumber} - Smart Investigation Workspace`,
    caseDoc: req.caseDoc,
    errors: {}
  });
});

// 6. Edit Case Details - Process
router.post('/:id/edit', ensureAuthenticated, canAccessCase, validateCaseCreation, async (req, res) => {
  const validation = handleValidationErrors(req);
  const caseDoc = req.caseDoc;

  if (validation.hasErrors) {
    return res.status(400).render('cases/edit', {
      title: `Edit Case ${caseDoc.caseNumber} - Smart Investigation Workspace`,
      caseDoc: { ...caseDoc.toObject(), ...req.body },
      errors: validation.errors
    });
  }

  const {
    caseName,
    crimeType,
    crimeTypeOther,
    status,
    incidentDate,
    incidentTime,
    incidentLocation,
    crimeSceneAddress,
    caseDescription,
    department,
    victimDetails,
    suspectDetails,
    witnessDetails,
    preliminaryFindings,
    knownObjects,
    additionalNotes
  } = req.body;

  try {
    const changes = [];
    if (caseName !== caseDoc.caseName) changes.push(`Name: '${caseDoc.caseName}' -> '${caseName}'`);
    if (status !== caseDoc.status) changes.push(`Status: '${caseDoc.status}' -> '${status}'`);
    if (crimeType !== caseDoc.crimeType) changes.push(`Crime Type: '${caseDoc.crimeType}' -> '${crimeType}'`);

    // Preserve original creation details (caseNumber, createdBy, creatorName, creationTimestamp)
    caseDoc.caseName = caseName.trim();
    caseDoc.crimeType = crimeType;
    caseDoc.crimeTypeOther = crimeType === 'Other' ? (crimeTypeOther || '').trim() : '';
    caseDoc.status = status;
    caseDoc.incidentDate = new Date(incidentDate);
    caseDoc.incidentTime = incidentTime;
    caseDoc.incidentLocation = incidentLocation.trim();
    caseDoc.crimeSceneAddress = (crimeSceneAddress || '').trim();
    caseDoc.caseDescription = caseDescription.trim();
    caseDoc.department = (department || caseDoc.department).trim();
    caseDoc.victimDetails = (victimDetails || '').trim();
    caseDoc.suspectDetails = (suspectDetails || '').trim();
    caseDoc.witnessDetails = (witnessDetails || '').trim();
    caseDoc.preliminaryFindings = (preliminaryFindings || '').trim();
    caseDoc.knownObjects = (knownObjects || '').trim();
    caseDoc.additionalNotes = (additionalNotes || '').trim();

    // Server-managed modification timestamps
    const now = new Date();
    caseDoc.lastUpdatedTimestamp = now;
    caseDoc.lastUpdatedBy = req.investigator._id;
    caseDoc.lastUpdatedByName = req.investigator.fullName;

    await caseDoc.save();

    // Record Audit Log
    await AuditLog.create({
      actor: req.investigator._id,
      actorName: req.investigator.fullName,
      action: 'CASE_MODIFIED',
      relatedCase: caseDoc._id,
      caseNumber: caseDoc.caseNumber,
      changeSummary: changes.length > 0
        ? `Case details modified by ${req.investigator.fullName}: ${changes.join(', ')}`
        : `Case ${caseDoc.caseNumber} updated by ${req.investigator.fullName}.`,
      ipAddress: req.ip || '127.0.0.1',
      userAgent: req.headers['user-agent'] || '',
      timestamp: now
    });

    res.redirect(`/cases/${caseDoc._id}?success=${encodeURIComponent('Case details updated successfully.')}`);
  } catch (error) {
    console.error('[Case Edit Error]:', error);
    res.status(500).render('cases/edit', {
      title: `Edit Case ${caseDoc.caseNumber} - Smart Investigation Workspace`,
      caseDoc,
      errors: { general: 'Failed to save case modifications.' }
    });
  }
});

module.exports = router;
