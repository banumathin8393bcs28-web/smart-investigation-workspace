const fs = require('fs');
const path = require('path');
const express = require('express');
const router = express.Router();
const AnalysisJob = require('../models/AnalysisJob');
const Case = require('../models/Case');
const Evidence = require('../models/Evidence');
const AuditLog = require('../models/AuditLog');
const { ensureAuthenticated } = require('../middleware/auth');
const { canAccessCase, canAccessEvidence } = require('../middleware/authorization');
const { createAnalysisJob } = require('../services/autopsyService');

const WORKER_SECRET = process.env.AUTOPSY_WORKER_SECRET || 'forensic-worker-secret-key-2026';

// 1. List all Autopsy Analysis Jobs
router.get('/jobs', ensureAuthenticated, async (req, res) => {
  try {
    const jobs = await AnalysisJob.find()
      .sort({ submissionTimestamp: -1 })
      .populate('caseId', 'caseNumber caseName status')
      .populate('evidenceId', 'evidenceIdentifier originalFilename');

    res.render('autopsy/index', {
      title: 'Autopsy Forensic Analysis - Smart Investigation Workspace',
      jobs,
      success: req.query.success || null,
      error: req.query.error || null
    });
  } catch (error) {
    console.error('[Autopsy Jobs List Error]:', error);
    res.status(500).render('partials/error', {
      title: '500 - Forensic Service Fault',
      message: error.message
    });
  }
});

// 2. View Single Autopsy Job Dossier
router.get('/jobs/:id', ensureAuthenticated, async (req, res) => {
  try {
    const job = await AnalysisJob.findById(req.params.id)
      .populate('caseId')
      .populate('evidenceId')
      .populate('submittedBy', 'fullName role email');

    if (!job) {
      return res.status(404).render('partials/error', {
        title: '404 - Job Not Found',
        message: 'The requested Autopsy analysis job does not exist.'
      });
    }

    res.render('autopsy/show', {
      title: `${job.jobIdentifier} - Autopsy Forensic Dossier`,
      job,
      caseDoc: job.caseId,
      evidenceDoc: job.evidenceId
    });
  } catch (error) {
    console.error('[Autopsy Job Detail Error]:', error);
    res.status(500).render('partials/error', {
      title: '500 - Forensic Job Fault',
      message: error.message
    });
  }
});

// 3. Submit New Evidence for Autopsy Forensic Ingest
router.post('/create', ensureAuthenticated, async (req, res) => {
  try {
    const { caseId, evidenceId, modules, dataSourceType } = req.body;
    if (!caseId) {
      return res.redirect('/cases?error=Case+ID+is+required+to+initiate+Autopsy+ingest.');
    }

    const caseDoc = await Case.findById(caseId);
    if (!caseDoc) {
      return res.redirect('/cases?error=Case+record+not+found.');
    }

    let evidenceDoc = null;
    if (evidenceId) {
      evidenceDoc = await Evidence.findById(evidenceId);
    }

    const selectedModules = Array.isArray(modules)
      ? modules
      : (modules ? [modules] : []);

    const job = await createAnalysisJob({
      caseDoc,
      evidenceDoc,
      investigator: req.investigator,
      modules: selectedModules,
      dataSourceType: dataSourceType || (evidenceDoc ? 'file_evidence' : 'forensic_disk_image')
    });

    const redirectUrl = evidenceDoc
      ? `/evidence/${evidenceDoc._id}?success=${encodeURIComponent(`Autopsy analysis job ${job.jobIdentifier} queued successfully.`)}`
      : `/autopsy/jobs/${job._id}?success=${encodeURIComponent(`Autopsy job ${job.jobIdentifier} initiated.`)}`;

    res.redirect(redirectUrl);
  } catch (error) {
    console.error('[Autopsy Create Job Error]:', error);
    res.redirect(`/autopsy/jobs?error=${encodeURIComponent(`Failed to create Autopsy job: ${error.message}`)}`);
  }
});

// 4. View / Serve Autopsy HTML Report File
router.get('/report/:id', ensureAuthenticated, async (req, res) => {
  try {
    const job = await AnalysisJob.findById(req.params.id);
    if (!job) {
      return res.status(404).send('Analysis job not found.');
    }

    // Check if report is cached on disk
    const reportFilename = `autopsy_report_${job.jobIdentifier}_*.html`;
    const reportsDir = path.join(__dirname, '..', 'private_uploads', 'reports');

    let reportFile = null;
    if (fs.existsSync(reportsDir)) {
      const files = fs.readdirSync(reportsDir);
      reportFile = files.find(f => f.startsWith(`autopsy_report_${job.jobIdentifier}`));
    }

    if (reportFile) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.sendFile(path.join(reportsDir, reportFile));
    }

    // Fallback: Generate dynamic report view from findings in MongoDB
    res.render('autopsy/show', {
      title: `${job.jobIdentifier} - Autopsy Forensic Dossier`,
      job,
      caseDoc: job.caseId,
      evidenceDoc: job.evidenceId
    });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// 5. Worker API: Poll for queued jobs
router.get('/worker/poll', async (req, res) => {
  const token = req.headers['x-worker-token'];
  if (token !== WORKER_SECRET) {
    return res.status(401).json({ error: 'Unauthorized worker authentication' });
  }

  const job = await AnalysisJob.findOne({ status: 'Queued' }).sort({ submissionTimestamp: 1 });
  res.json({ job: job || null });
});

// 6. Worker API: Update job status and logs
router.post('/worker/update/:id', async (req, res) => {
  const token = req.headers['x-worker-token'];
  if (token !== WORKER_SECRET) {
    return res.status(401).json({ error: 'Unauthorized worker authentication' });
  }

  const job = await AnalysisJob.findById(req.params.id);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  const { status, logOutput, findings, failureReason } = req.body;
  if (status) job.status = status;
  if (logOutput) job.logOutput += logOutput;
  if (findings) {
    job.findings = findings;
    job.findingsCount = findings.length;
  }
  if (failureReason) job.failureReason = failureReason;

  if (status === 'Completed' || status === 'Failed') {
    job.completedTimestamp = new Date();
  }

  await job.save();
  res.json({ success: true, jobId: job._id });
});

module.exports = router;
