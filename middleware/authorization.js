const Case = require('../models/Case');
const Evidence = require('../models/Evidence');
const Report = require('../models/Report');

/**
 * Ensures investigator is authorized to access a specific case
 * (Must be creator, assigned investigator, or listed collaborator)
 */
async function canAccessCase(req, res, next) {
  try {
    const caseId = req.params.caseId || req.params.id || req.body.caseId;
    if (!caseId) {
      return res.status(400).render('partials/error', {
        title: '400 - Bad Request',
        message: 'No case identifier provided for authorization verification.'
      });
    }

    const caseDoc = await Case.findById(caseId);
    if (!caseDoc) {
      return res.status(404).render('partials/error', {
        title: '404 - Case Not Found',
        message: 'The requested investigation case record does not exist or has been archived.'
      });
    }

    const investigatorId = req.investigator._id.toString();
    const isAssigned = caseDoc.assignedInvestigator && caseDoc.assignedInvestigator.toString() === investigatorId;
    const isCreator = caseDoc.createdBy && caseDoc.createdBy.toString() === investigatorId;
    const isCollaborator = caseDoc.collaborators && caseDoc.collaborators.some(c => c.toString() === investigatorId);

    if (!isAssigned && !isCreator && !isCollaborator) {
      return res.status(403).render('partials/error', {
        title: '403 - Access Denied',
        message: 'Security Violation: You are not authorized to view or modify this investigation case. Access is restricted to assigned investigators.'
      });
    }

    req.caseDoc = caseDoc;
    res.locals.caseDoc = caseDoc;
    next();
  } catch (error) {
    console.error('[Authorization] canAccessCase error:', error);
    next(error);
  }
}

/**
 * Ensures investigator is authorized to access specific evidence item
 */
async function canAccessEvidence(req, res, next) {
  try {
    const evidenceId = req.params.evidenceId || req.params.id;
    if (!evidenceId) {
      return res.status(400).render('partials/error', {
        title: '400 - Bad Request',
        message: 'Evidence identifier missing.'
      });
    }

    const evidence = await Evidence.findById(evidenceId);
    if (!evidence) {
      return res.status(404).render('partials/error', {
        title: '404 - Evidence Not Found',
        message: 'The specified forensic evidence file was not found.'
      });
    }

    const caseDoc = await Case.findById(evidence.caseId);
    if (!caseDoc) {
      return res.status(404).render('partials/error', {
        title: '404 - Case Not Found',
        message: 'Associated case record does not exist.'
      });
    }

    const investigatorId = req.investigator._id.toString();
    const isAssigned = caseDoc.assignedInvestigator && caseDoc.assignedInvestigator.toString() === investigatorId;
    const isCreator = caseDoc.createdBy && caseDoc.createdBy.toString() === investigatorId;
    const isCollaborator = caseDoc.collaborators && caseDoc.collaborators.some(c => c.toString() === investigatorId);
    const isCustodian = evidence.currentCustodian && evidence.currentCustodian.toString() === investigatorId;

    if (!isAssigned && !isCreator && !isCollaborator && !isCustodian) {
      return res.status(403).render('partials/error', {
        title: '403 - Access Denied',
        message: 'Security Violation: You do not have authorization to access this evidence record.'
      });
    }

    req.evidence = evidence;
    req.caseDoc = caseDoc;
    next();
  } catch (error) {
    console.error('[Authorization] canAccessEvidence error:', error);
    next(error);
  }
}

/**
 * Ensures investigator can access a report
 */
async function canAccessReport(req, res, next) {
  try {
    const reportId = req.params.reportId || req.params.id;
    const report = await Report.findById(reportId);
    if (!report) {
      return res.status(404).render('partials/error', {
        title: '404 - Report Not Found',
        message: 'The specified investigation report does not exist.'
      });
    }

    const caseDoc = await Case.findById(report.caseId);
    if (!caseDoc) {
      return res.status(404).render('partials/error', {
        title: '404 - Case Not Found',
        message: 'The case associated with this report was not found.'
      });
    }

    const investigatorId = req.investigator._id.toString();
    const isAssigned = caseDoc.assignedInvestigator && caseDoc.assignedInvestigator.toString() === investigatorId;
    const isCreator = caseDoc.createdBy && caseDoc.createdBy.toString() === investigatorId;
    const isCollaborator = caseDoc.collaborators && caseDoc.collaborators.some(c => c.toString() === investigatorId);
    const isGenerator = report.generatedBy && report.generatedBy.toString() === investigatorId;

    if (!isAssigned && !isCreator && !isCollaborator && !isGenerator) {
      return res.status(403).render('partials/error', {
        title: '403 - Access Denied',
        message: 'Security Violation: You do not have permission to access or download this confidential case report.'
      });
    }

    req.report = report;
    req.caseDoc = caseDoc;
    next();
  } catch (error) {
    console.error('[Authorization] canAccessReport error:', error);
    next(error);
  }
}

module.exports = {
  canAccessCase,
  canAccessEvidence,
  canAccessReport
};
