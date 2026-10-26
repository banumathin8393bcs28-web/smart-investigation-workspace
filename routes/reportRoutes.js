const express = require('express');
const router = express.Router();
const Case = require('../models/Case');
const Evidence = require('../models/Evidence');
const Suspect = require('../models/Suspect');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const ReportGenerator = require('../services/reportGenerator');
const { isAuthenticated } = require('../middleware/auth');

// GET /reports - Reports central registry
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const cases = await Case.find();
    cases.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.render('reports/index', {
      title: 'Investigation Reports & Dossier Generation | Smart Investigation Workspace',
      cases
    });
  } catch (err) {
    console.error('Reports error:', err);
    res.redirect('/dashboard?error=Could not open reports index');
  }
});

// GET /reports/case/:id - View Printable Official Investigation Report
router.get('/case/:id', isAuthenticated, async (req, res) => {
  try {
    const caseDoc = await Case.findById(req.params.id);
    if (!caseDoc) return res.redirect('/reports?error=Case not found');

    const [allInvestigators, evidenceList, suspectsList] = await Promise.all([
      User.find(),
      Evidence.find({ caseId: caseDoc._id }),
      Suspect.find()
    ]);

    const linkedSuspects = suspectsList.filter(s =>
      s.connectedCases && s.connectedCases.includes(caseDoc._id.toString())
    );

    const leadInvestigator = allInvestigators.find(u => u._id.toString() === (caseDoc.leadInvestigator || '').toString()) || {
      name: caseDoc.leadInvestigatorName || 'Lead Detective',
      badgeId: 'N/A',
      rank: 'Detective',
      department: 'Forensic Operations'
    };

    await AuditLog.log({
      investigator: req.user.name,
      badgeId: req.user.badgeId,
      action: 'REPORT_GENERATED',
      targetType: 'Case',
      targetId: caseDoc._id,
      details: `Generated official investigation dossier for ${caseDoc.caseNumber}.`,
      ipAddress: req.ip
    });

    res.render('reports/view', {
      title: `Official Report: ${caseDoc.caseNumber} - ${caseDoc.title}`,
      caseData: caseDoc,
      leadInvestigator,
      evidenceList,
      suspectsList: linkedSuspects,
      currentOfficer: req.user
    });
  } catch (err) {
    console.error('Report view error:', err);
    res.redirect('/reports?error=Failed to generate report view');
  }
});

// GET /reports/case/:id/pdf - Export PDF Document
router.get('/case/:id/pdf', isAuthenticated, async (req, res) => {
  try {
    const caseDoc = await Case.findById(req.params.id);
    if (!caseDoc) return res.redirect('/reports?error=Case not found');

    const [allInvestigators, evidenceList, suspectsList] = await Promise.all([
      User.find(),
      Evidence.find({ caseId: caseDoc._id }),
      Suspect.find()
    ]);

    const linkedSuspects = suspectsList.filter(s =>
      s.connectedCases && s.connectedCases.includes(caseDoc._id.toString())
    );

    const leadInvestigator = allInvestigators.find(u => u._id.toString() === (caseDoc.leadInvestigator || '').toString());

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Dossier_${caseDoc.caseNumber}.pdf`);

    ReportGenerator.generateCaseReport(caseDoc, evidenceList, linkedSuspects, leadInvestigator, res);
  } catch (err) {
    console.error('PDF export error:', err);
    res.redirect(`/reports/case/${req.params.id}?error=Failed to export PDF file`);
  }
});

module.exports = router;
