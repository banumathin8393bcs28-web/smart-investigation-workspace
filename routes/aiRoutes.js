const express = require('express');
const router = express.Router();
const Evidence = require('../models/Evidence');
const Case = require('../models/Case');
const AuditLog = require('../models/AuditLog');
const AIAnalysisService = require('../services/aiAnalysisService');
const { isAuthenticated } = require('../middleware/auth');

// GET /ai/analyze/:id - Forensic AI inspection workstation
router.get('/analyze/:id', isAuthenticated, async (req, res) => {
  try {
    const evidence = await Evidence.findById(req.params.id);
    if (!evidence) {
      return res.redirect('/evidence/gallery?error=Evidence not found');
    }

    const linkedCase = evidence.caseId ? await Case.findById(evidence.caseId) : null;

    res.render('ai/analyze', {
      title: `AI Object Detection Inspection | ${evidence.evidenceNumber}`,
      evidence,
      linkedCase,
      success: req.query.success || null,
      error: req.query.error || null
    });
  } catch (err) {
    console.error('AI view error:', err);
    res.redirect('/evidence/gallery?error=Failed to open AI analysis workstation');
  }
});

// POST /ai/analyze/:id - Execute AI Object Detection Pipeline
router.post('/analyze/:id', isAuthenticated, async (req, res) => {
  try {
    const evidence = await Evidence.findById(req.params.id);
    if (!evidence) {
      return res.redirect('/evidence/gallery?error=Evidence not found');
    }

    const analysisResult = await AIAnalysisService.analyzeMedia(evidence);

    // Save analysis into evidence document
    await Evidence.findByIdAndUpdate(evidence._id, {
      aiAnalysis: analysisResult
    });

    // Append to chain of custody
    await Evidence.addChainOfCustody(evidence._id, {
      action: 'AI_FORENSIC_ANALYSIS',
      investigator: req.user.name,
      badgeId: req.user.badgeId,
      notes: `Executed AI object detection using ${analysisResult.model}. Identified ${analysisResult.detections.length} candidate evidentiary markers awaiting human review.`,
      hashSnapshot: evidence.sha256Hash
    });

    // Audit Log
    await AuditLog.log({
      investigator: req.user.name,
      badgeId: req.user.badgeId,
      action: 'AI_ANALYSIS_EXECUTED',
      targetType: 'Evidence',
      targetId: evidence._id,
      details: `Executed AI analysis model on ${evidence.evidenceNumber}. Found ${analysisResult.detections.length} objects.`,
      ipAddress: req.ip
    });

    res.redirect(`/ai/analyze/${evidence._id}?success=AI object detection complete. Identified ${analysisResult.detections.length} forensic items. Please conduct human investigator review.`);
  } catch (err) {
    console.error('AI execute error:', err);
    res.redirect(`/ai/analyze/${req.params.id}?error=Failed to execute AI analysis model: ${encodeURIComponent(err.message)}`);
  }
});

// POST /ai/review/:id - Investigator Review & Attestation Sign-off
router.post('/review/:id', isAuthenticated, async (req, res) => {
  try {
    const evidence = await Evidence.findById(req.params.id);
    if (!evidence || !evidence.aiAnalysis) {
      return res.redirect(`/evidence/${req.params.id}?error=No AI analysis to review`);
    }

    const { overallStatus, verdictNotes, detectionStatuses, detectionNotes } = req.body;

    // Update individual detections if provided
    let updatedDetections = (evidence.aiAnalysis.detections || []).map(d => {
      const statusKey = `status_${d.id}`;
      const notesKey = `notes_${d.id}`;
      const newStatus = req.body[statusKey] || d.investigatorStatus;
      const newNotes = req.body[notesKey] !== undefined ? req.body[notesKey] : d.notes;
      return {
        ...d,
        investigatorStatus: newStatus,
        notes: newNotes
      };
    });

    const reviewBlock = {
      reviewedBy: req.user.name,
      reviewedByBadge: req.user.badgeId,
      reviewedAt: new Date().toISOString(),
      status: overallStatus || 'Approved & Verified',
      verdictNotes: verdictNotes ? verdictNotes.trim() : 'AI findings manually audited and confirmed by investigator.'
    };

    await Evidence.findByIdAndUpdate(evidence._id, {
      'aiAnalysis.detections': updatedDetections,
      'aiAnalysis.investigatorReview': reviewBlock
    });

    // Chain of custody update
    await Evidence.addChainOfCustody(evidence._id, {
      action: 'INVESTIGATOR_AI_ATTESTATION',
      investigator: req.user.name,
      badgeId: req.user.badgeId,
      notes: `Investigator completed forensic verification: Status marked as "${reviewBlock.status}". Verdict: ${reviewBlock.verdictNotes}`,
      hashSnapshot: evidence.sha256Hash
    });

    // Audit log
    await AuditLog.log({
      investigator: req.user.name,
      badgeId: req.user.badgeId,
      action: 'AI_FINDINGS_REVIEWED',
      targetType: 'Evidence',
      targetId: evidence._id,
      details: `Investigator certified AI detections with status "${reviewBlock.status}".`,
      ipAddress: req.ip
    });

    res.redirect(`/ai/analyze/${evidence._id}?success=Investigator review attestation recorded successfully.`);
  } catch (err) {
    console.error('Review error:', err);
    res.redirect(`/ai/analyze/${req.params.id}?error=Failed to submit review attestation.`);
  }
});

module.exports = router;
