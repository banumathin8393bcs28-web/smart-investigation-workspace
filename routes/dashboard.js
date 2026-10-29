const express = require('express');
const router = express.Router();
const Case = require('../models/Case');
const Evidence = require('../models/Evidence');
const Custody = require('../models/Custody');
const Message = require('../models/Message');
const Notification = require('../models/Notification');
const AuditLog = require('../models/AuditLog');
const AnalysisJob = require('../models/AnalysisJob');
const EvidenceRequest = require('../models/EvidenceRequest');
const { ensureAuthenticated } = require('../middleware/auth');
const { formatTimestamp } = require('../services/timestampService');

router.get('/', ensureAuthenticated, async (req, res) => {
  try {
    const investigatorId = req.investigator._id;

    // 1. Total assigned cases
    const totalAssignedCases = await Case.countDocuments({
      $or: [
        { assignedInvestigator: investigatorId },
        { createdBy: investigatorId },
        { collaborators: investigatorId }
      ]
    });

    // 2. Active cases (New or Under Investigation or Pending)
    const activeCases = await Case.countDocuments({
      $or: [
        { assignedInvestigator: investigatorId },
        { createdBy: investigatorId },
        { collaborators: investigatorId }
      ],
      status: { $in: ['New', 'Under Investigation', 'Pending'] }
    });

    // 3. Closed cases
    const closedCases = await Case.countDocuments({
      $or: [
        { assignedInvestigator: investigatorId },
        { createdBy: investigatorId },
        { collaborators: investigatorId }
      ],
      status: 'Closed'
    });

    // 4. Evidence items (in cases authorized or where currentCustodian)
    const userCases = await Case.find({
      $or: [
        { assignedInvestigator: investigatorId },
        { createdBy: investigatorId },
        { collaborators: investigatorId }
      ]
    }).select('_id');
    const caseIds = userCases.map(c => c._id);

    const evidenceItemsCount = await Evidence.countDocuments({
      $or: [
        { caseId: { $in: caseIds } },
        { currentCustodian: investigatorId },
        { uploadedBy: investigatorId }
      ]
    });

    // 5. Pending transfers (where recipient is current investigator and status is Pending)
    const pendingTransfers = await Custody.countDocuments({
      recipient: investigatorId,
      status: 'Pending'
    });

    // 6. Unread messages (direct chat where recipient is current user and status != Read)
    const unreadMessages = await Message.countDocuments({
      recipient: investigatorId,
      deliveryStatus: { $ne: 'Read' }
    });

    // 7. Autopsy forensic jobs
    const autopsyJobsCount = await AnalysisJob.countDocuments({
      $or: [
        { caseId: { $in: caseIds } },
        { submittedBy: investigatorId }
      ]
    });

    // 8. Pending evidence sharing requests
    const pendingRequestsCount = await EvidenceRequest.countDocuments({
      requestedTo: investigatorId,
      status: 'Pending'
    });

    // Recent activity (AuditLogs for this investigator or their cases)
    const recentActivities = await AuditLog.find({
      $or: [
        { actor: investigatorId },
        { relatedCase: { $in: caseIds } }
      ]
    })
      .sort({ timestamp: -1 })
      .limit(8);

    // Recent notifications
    const recentNotifications = await Notification.find({
      recipient: investigatorId
    })
      .sort({ createdTimestamp: -1 })
      .limit(5);

    // Recent cases
    const recentCases = await Case.find({
      $or: [
        { assignedInvestigator: investigatorId },
        { createdBy: investigatorId },
        { collaborators: investigatorId }
      ]
    })
      .sort({ lastUpdatedTimestamp: -1 })
      .limit(5);

    res.render('dashboard/index', {
      title: 'Dashboard - Smart Investigation Workspace',
      stats: {
        totalAssignedCases,
        activeCases,
        closedCases,
        evidenceItemsCount,
        pendingTransfers,
        unreadMessages,
        autopsyJobsCount,
        pendingRequestsCount
      },
      recentActivities,
      recentNotifications,
      recentCases,
      serverTime: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Dashboard Error]:', error);
    res.status(500).render('partials/error', {
      title: '500 - Dashboard Error',
      message: 'Failed to aggregate workspace metrics from database records.'
    });
  }
});

module.exports = router;
