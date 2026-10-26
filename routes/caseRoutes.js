const express = require('express');
const router = express.Router();
const Case = require('../models/Case');
const User = require('../models/User');
const Evidence = require('../models/Evidence');
const Suspect = require('../models/Suspect');
const AuditLog = require('../models/AuditLog');
const { isAuthenticated } = require('../middleware/auth');

// GET /cases
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const { q, classification, status, priority } = req.query;
    let query = {};

    if (classification) query.classification = classification;
    if (status) query.status = status;
    if (priority) query.priority = priority;

    let cases = await Case.find(query);

    if (q) {
      const search = q.toLowerCase();
      cases = cases.filter(c =>
        (c.caseNumber && c.caseNumber.toLowerCase().includes(search)) ||
        (c.title && c.title.toLowerCase().includes(search)) ||
        (c.description && c.description.toLowerCase().includes(search)) ||
        (c.incidentLocation && c.incidentLocation.toLowerCase().includes(search))
      );
    }

    cases.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.render('cases/index', {
      title: 'Active Case Files | Smart Investigation Workspace',
      cases,
      query: req.query
    });
  } catch (err) {
    console.error('Case list error:', err);
    res.redirect('/dashboard?error=Could not retrieve cases');
  }
});

// GET /cases/new
router.get('/new', isAuthenticated, async (req, res) => {
  const investigators = await User.find();
  res.render('cases/new', {
    title: 'Initiate New Criminal Investigation | Smart Investigation Workspace',
    investigators,
    error: req.query.error || null
  });
});

// POST /cases
router.post('/', isAuthenticated, async (req, res) => {
  try {
    const {
      title,
      classification,
      priority,
      status,
      incidentDate,
      incidentLocation,
      description,
      assignedTeam,
      tags
    } = req.body;

    if (!title || !classification) {
      return res.redirect('/cases/new?error=Case Title and Classification are mandatory.');
    }

    const teamArray = Array.isArray(assignedTeam) ? assignedTeam : (assignedTeam ? [assignedTeam] : []);
    const tagArray = tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [];

    const newCase = await Case.create({
      title: title.trim(),
      classification,
      priority: priority || 'High',
      status: status || 'Open',
      incidentDate: incidentDate || new Date().toISOString(),
      incidentLocation: incidentLocation ? incidentLocation.trim() : 'Unspecified',
      description: description ? description.trim() : '',
      leadInvestigator: req.user._id,
      leadInvestigatorName: req.user.name,
      assignedTeam: teamArray,
      tags: tagArray
    });

    await AuditLog.log({
      investigator: req.user.name,
      badgeId: req.user.badgeId,
      action: 'CASE_CREATED',
      targetType: 'Case',
      targetId: newCase._id,
      details: `Case ${newCase.caseNumber} ("${newCase.title}") opened under classification ${newCase.classification}.`,
      ipAddress: req.ip
    });

    res.redirect(`/cases/${newCase._id}?success=Case file ${newCase.caseNumber} initiated successfully.`);
  } catch (err) {
    console.error('Create case error:', err);
    res.redirect('/cases/new?error=Internal error creating case file.');
  }
});

// GET /cases/:id
router.get('/:id', isAuthenticated, async (req, res) => {
  try {
    const caseDoc = await Case.findById(req.params.id);
    if (!caseDoc) {
      return res.redirect('/cases?error=Case file not found.');
    }

    const [allInvestigators, evidenceList, suspectsList] = await Promise.all([
      User.find(),
      Evidence.find({ caseId: caseDoc._id }),
      Suspect.find()
    ]);

    // Find suspects connected to this case
    const connectedSuspects = suspectsList.filter(s =>
      s.connectedCases && s.connectedCases.includes(caseDoc._id.toString())
    );

    const leadInvestigator = allInvestigators.find(u => u._id.toString() === (caseDoc.leadInvestigator || '').toString()) || {
      name: caseDoc.leadInvestigatorName || 'Lead Detective',
      badgeId: 'N/A'
    };

    res.render('cases/show', {
      title: `${caseDoc.caseNumber} - ${caseDoc.title} | Smart Investigation Workspace`,
      caseData: caseDoc,
      leadInvestigator,
      investigators: allInvestigators,
      evidenceList,
      suspectsList: connectedSuspects,
      allSuspects: suspectsList,
      success: req.query.success || null,
      error: req.query.error || null
    });
  } catch (err) {
    console.error('Case details error:', err);
    res.redirect('/cases?error=Failed to retrieve case details.');
  }
});

// GET /cases/:id/edit
router.get('/:id/edit', isAuthenticated, async (req, res) => {
  const caseDoc = await Case.findById(req.params.id);
  if (!caseDoc) return res.redirect('/cases?error=Case not found');
  const investigators = await User.find();
  res.render('cases/edit', {
    title: `Edit ${caseDoc.caseNumber} | Smart Investigation Workspace`,
    caseData: caseDoc,
    investigators,
    error: req.query.error || null
  });
});

// POST /cases/:id/edit
router.post('/:id/edit', isAuthenticated, async (req, res) => {
  try {
    const { title, classification, priority, status, incidentDate, incidentLocation, description, assignedTeam, tags } = req.body;
    const teamArray = Array.isArray(assignedTeam) ? assignedTeam : (assignedTeam ? [assignedTeam] : []);
    const tagArray = tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [];

    await Case.findByIdAndUpdate(req.params.id, {
      title: title.trim(),
      classification,
      priority,
      status,
      incidentDate,
      incidentLocation: incidentLocation.trim(),
      description: description ? description.trim() : '',
      assignedTeam: teamArray,
      tags: tagArray
    });

    await AuditLog.log({
      investigator: req.user.name,
      badgeId: req.user.badgeId,
      action: 'CASE_UPDATED',
      targetType: 'Case',
      targetId: req.params.id,
      details: `Case parameters updated. Status: ${status}, Priority: ${priority}`,
      ipAddress: req.ip
    });

    res.redirect(`/cases/${req.params.id}?success=Case updated successfully.`);
  } catch (err) {
    console.error('Case edit error:', err);
    res.redirect(`/cases/${req.params.id}?error=Failed to update case file.`);
  }
});

// POST /cases/:id/handover
router.post('/:id/handover', isAuthenticated, async (req, res) => {
  try {
    const { newLeadId, reason } = req.body;
    const caseDoc = await Case.findById(req.params.id);
    if (!caseDoc) return res.redirect('/cases?error=Case not found');

    const newLead = await User.findById(newLeadId);
    if (!newLead) return res.redirect(`/cases/${req.params.id}?error=Target investigator not found`);

    const handoverRecord = {
      fromInvestigator: req.user.name,
      fromBadge: req.user.badgeId,
      toInvestigator: newLead.name,
      toBadge: newLead.badgeId,
      timestamp: new Date().toISOString(),
      reason: reason || 'Operational case reassignment'
    };

    // Update case lead and append handover
    await Case.findByIdAndUpdate(caseDoc._id, {
      leadInvestigator: newLead._id,
      leadInvestigatorName: newLead.name,
      $push: {
        handoverHistory: handoverRecord,
        timeline: {
          timestamp: new Date().toISOString(),
          title: 'Case Responsibility Handover',
          description: `Investigation leadership formally transferred from ${req.user.name} to ${newLead.name}. Reason: ${handoverRecord.reason}`,
          investigator: req.user.name,
          type: 'handover'
        }
      }
    });

    await AuditLog.log({
      investigator: req.user.name,
      badgeId: req.user.badgeId,
      action: 'CASE_HANDOVER',
      targetType: 'Case',
      targetId: caseDoc._id,
      details: `Responsibility for ${caseDoc.caseNumber} transferred to ${newLead.name} (${newLead.badgeId}).`,
      ipAddress: req.ip
    });

    res.redirect(`/cases/${caseDoc._id}?success=Case leadership transferred to ${newLead.name}.`);
  } catch (err) {
    console.error('Case handover error:', err);
    res.redirect(`/cases/${req.params.id}?error=Failed to execute case handover.`);
  }
});

// POST /cases/:id/timeline
router.post('/:id/timeline', isAuthenticated, async (req, res) => {
  try {
    const { title, description, eventType } = req.body;
    if (!title || !description) {
      return res.redirect(`/cases/${req.params.id}?error=Event title and description required.`);
    }

    await Case.addTimelineEvent(req.params.id, {
      title: title.trim(),
      description: description.trim(),
      investigator: req.user.name,
      type: eventType || 'investigation_note'
    });

    res.redirect(`/cases/${req.params.id}?success=Timeline event added.`);
  } catch (err) {
    console.error('Timeline error:', err);
    res.redirect(`/cases/${req.params.id}?error=Failed to add timeline event.`);
  }
});

module.exports = router;
