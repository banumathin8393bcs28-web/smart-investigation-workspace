const express = require('express');
const router = express.Router();
const Case = require('../models/Case');
const Evidence = require('../models/Evidence');
const Suspect = require('../models/Suspect');
const AuditLog = require('../models/AuditLog');
const EvidenceRequest = require('../models/EvidenceRequest');
const { isAuthenticated } = require('../middleware/auth');

router.get('/', isAuthenticated, async (req, res) => {
  try {
    const [
      totalCases,
      activeCases,
      totalEvidence,
      tamperedEvidence,
      totalSuspects,
      pendingRequests,
      recentCases,
      recentEvidence,
      recentLogs
    ] = await Promise.all([
      Case.countDocuments(),
      Case.countDocuments({ status: { $ne: 'Closed' } }),
      Evidence.countDocuments(),
      Evidence.countDocuments({ integrityStatus: 'Tampered' }),
      Suspect.countDocuments(),
      EvidenceRequest.countDocuments({ status: 'Pending' }),
      Case.find(),
      Evidence.find(),
      AuditLog.find()
    ]);

    // Pending AI reviews count
    const pendingAiReviews = recentEvidence.filter(e => 
      e.aiAnalysis && e.aiAnalysis.analyzed && e.aiAnalysis.investigatorReview?.status === 'Pending Review'
    ).length;

    // Sort recent items
    const sortedCases = [...recentCases].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);
    const sortedEvidence = [...recentEvidence].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 6);
    const sortedLogs = [...recentLogs].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 8);

    res.render('dashboard/index', {
      title: 'Investigation Command Center | Smart Investigation Workspace',
      metrics: {
        totalCases,
        activeCases,
        totalEvidence,
        tamperedEvidence,
        totalSuspects,
        pendingRequests,
        pendingAiReviews,
        integrityRate: totalEvidence > 0 ? Math.round(((totalEvidence - tamperedEvidence) / totalEvidence) * 100) : 100
      },
      recentCases: sortedCases,
      recentEvidence: sortedEvidence,
      recentLogs: sortedLogs
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).render('partials/error', {
      title: 'Workstation Error',
      message: 'Failed to load command dashboard data.'
    });
  }
});

module.exports = router;
