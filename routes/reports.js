const fs = require('fs');
const express = require('express');
const router = express.Router();
const Case = require('../models/Case');
const Evidence = require('../models/Evidence');
const AIInspection = require('../models/AIInspection');
const Custody = require('../models/Custody');
const AuditLog = require('../models/AuditLog');
const Report = require('../models/Report');
const { ensureAuthenticated } = require('../middleware/auth');
const { canAccessCase, canAccessReport } = require('../middleware/authorization');
const { generateCaseReport } = require('../services/reportService');

// 1. Reports Dashboard / Listing
router.get('/', ensureAuthenticated, async (req, res) => {
  try {
    const investigatorId = req.investigator._id;

    // Authorized cases
    const authorizedCases = await Case.find({
      $or: [
        { assignedInvestigator: investigatorId },
        { createdBy: investigatorId },
        { collaborators: investigatorId }
      ]
    }).sort({ caseNumber: 1 });

    const caseIds = authorizedCases.map(c => c._id);

    // Reports generated for authorized cases
    const reports = await Report.find({
      caseId: { $in: caseIds }
    }).sort({ generationTimestamp: -1 });

    res.render('reports/index', {
      title: 'Investigation Reports - Smart Investigation Workspace',
      authorizedCases,
      reports
    });
  } catch (error) {
    console.error('[Reports Route Error]:', error);
    res.status(500).render('partials/error', {
      title: '500 - Report Service Fault',
      message: error.message
    });
  }
});

// 2. Generate PDF Report for a Case
router.post('/generate', ensureAuthenticated, async (req, res) => {
  const caseId = req.body.caseId;
  if (!caseId) {
    return res.redirect('/reports?error=Please+select+a+case.');
  }

  try {
    const caseDoc = await Case.findById(caseId);
    if (!caseDoc) {
      return res.redirect('/reports?error=Case+not+found.');
    }

    // Authorization check
    const invId = req.investigator._id.toString();
    const isAssigned = caseDoc.assignedInvestigator && caseDoc.assignedInvestigator.toString() === invId;
    const isCreator = caseDoc.createdBy && caseDoc.createdBy.toString() === invId;
    const isCollaborator = caseDoc.collaborators && caseDoc.collaborators.some(c => c.toString() === invId);

    if (!isAssigned && !isCreator && !isCollaborator) {
      return res.status(403).render('partials/error', {
        title: '403 - Forbidden',
        message: 'Security Violation: You are not authorized to generate reports for this case.'
      });
    }

    // Aggregate case data for report
    const evidenceList = await Evidence.find({ caseId: caseDoc._id });
    const inspections = await AIInspection.find({ caseId: caseDoc._id });
    const custodyHistory = await Custody.find({ caseId: caseDoc._id }).sort({ eventTimestamp: 1 });
    const auditLogs = await AuditLog.find({ relatedCase: caseDoc._id }).sort({ timestamp: 1 });

    // Generate PDF via PDFKit
    const reportDoc = await generateCaseReport({
      caseDoc,
      evidenceList,
      inspections,
      custodyHistory,
      auditLogs,
      investigator: req.investigator
    });

    res.redirect(`/reports/view/${reportDoc._id}?success=${encodeURIComponent(`Investigation Report ${reportDoc.reportIdentifier} compiled successfully.`)}`);
  } catch (err) {
    console.error('[Report Generation Error]:', err);
    res.redirect(`/reports?error=${encodeURIComponent(err.message)}`);
  }
});

// 3. View Report Metadata & Details
router.get('/view/:id', ensureAuthenticated, canAccessReport, async (req, res) => {
  try {
    const report = req.report;
    const caseDoc = req.caseDoc;

    res.render('reports/view', {
      title: `Report ${report.reportIdentifier} - Smart Investigation Workspace`,
      report,
      caseDoc
    });
  } catch (err) {
    res.status(500).render('partials/error', {
      title: '500 - Report Fault',
      message: err.message
    });
  }
});

// 4. Authenticated PDF Download
router.get('/download/:id', ensureAuthenticated, canAccessReport, async (req, res) => {
  try {
    const report = req.report;
    if (!fs.existsSync(report.protectedFileReference)) {
      return res.status(404).send('PDF file does not exist on disk.');
    }

    // Audit log report download
    await AuditLog.create({
      actor: req.investigator._id,
      actorName: req.investigator.fullName,
      action: 'REPORT_DOWNLOADED',
      relatedCase: report.caseId,
      caseNumber: report.caseNumber,
      changeSummary: `Report ${report.reportIdentifier} downloaded by ${req.investigator.fullName}.`,
      ipAddress: req.ip || '127.0.0.1',
      userAgent: req.headers['user-agent'] || '',
      timestamp: new Date()
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${report.reportIdentifier}_${report.caseNumber}.pdf"`);
    res.sendFile(report.protectedFileReference);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

module.exports = router;
