const express = require('express');
const router = express.Router();
const Case = require('../models/Case');
const Suspect = require('../models/Suspect');
const Evidence = require('../models/Evidence');
const User = require('../models/User');
const { isAuthenticated } = require('../middleware/auth');

// GET /graph - Render Cytoscape.js Relationship Graph view
router.get('/', isAuthenticated, async (req, res) => {
  const cases = await Case.find();
  res.render('graph/index', {
    title: 'Pictorial Relationship Knowledge Graph | Smart Investigation Workspace',
    cases,
    selectedCaseId: req.query.caseId || 'all'
  });
});

// GET /graph/data - JSON network elements for Cytoscape.js
router.get('/data', isAuthenticated, async (req, res) => {
  try {
    const { caseId } = req.query;

    const [allCases, allSuspects, allEvidence, allUsers] = await Promise.all([
      Case.find(),
      Suspect.find(),
      Evidence.find(),
      User.find()
    ]);

    let filteredCases = allCases;
    if (caseId && caseId !== 'all') {
      filteredCases = allCases.filter(c => c._id.toString() === caseId.toString());
    }
    const caseIdsSet = new Set(filteredCases.map(c => c._id.toString()));

    const nodes = [];
    const edges = [];
    const locationSet = new Set();
    const investigatorSet = new Set();

    // 1. Case Nodes
    filteredCases.forEach(c => {
      nodes.push({
        data: {
          id: `case_${c._id}`,
          rawId: c._id,
          label: `${c.caseNumber}\n${c.title}`,
          name: c.title,
          type: 'case',
          classification: c.classification,
          status: c.status,
          priority: c.priority,
          url: `/cases/${c._id}`
        }
      });

      // Location node & edge
      if (c.incidentLocation && c.incidentLocation !== 'Unspecified') {
        const locId = `loc_${c.incidentLocation.replace(/[^a-zA-Z0-9]/g, '_')}`;
        if (!locationSet.has(locId)) {
          locationSet.add(locId);
          nodes.push({
            data: {
              id: locId,
              label: `📍 ${c.incidentLocation}`,
              name: c.incidentLocation,
              type: 'location'
            }
          });
        }
        edges.push({
          data: {
            id: `edge_${c._id}_${locId}`,
            source: `case_${c._id}`,
            target: locId,
            label: 'Occurred At'
          }
        });
      }

      // Lead investigator edge
      if (c.leadInvestigator) {
        const leadUser = allUsers.find(u => u._id.toString() === c.leadInvestigator.toString());
        if (leadUser) {
          const invId = `inv_${leadUser._id}`;
          if (!investigatorSet.has(invId)) {
            investigatorSet.add(invId);
            nodes.push({
              data: {
                id: invId,
                rawId: leadUser._id,
                label: `🕵️ ${leadUser.name}\n${leadUser.rank}`,
                name: leadUser.name,
                type: 'investigator',
                badge: leadUser.badgeId,
                department: leadUser.department
              }
            });
          }
          edges.push({
            data: {
              id: `edge_${invId}_case_${c._id}`,
              source: invId,
              target: `case_${c._id}`,
              label: 'Investigating Lead'
            }
          });
        }
      }
    });

    // 2. Suspect Nodes & Edges
    allSuspects.forEach(s => {
      const isConnected = s.connectedCases && s.connectedCases.some(cId => caseIdsSet.has(cId.toString()));
      if (caseId && caseId !== 'all' && !isConnected) return;

      const suspectNodeId = `suspect_${s._id}`;
      nodes.push({
        data: {
          id: suspectNodeId,
          rawId: s._id,
          label: `👤 ${s.fullName}\n[${s.status}]`,
          name: s.fullName,
          alias: s.alias,
          type: 'suspect',
          status: s.status,
          riskLevel: s.riskLevel,
          photo: s.photo,
          url: `/suspects/${s._id}`
        }
      });

      if (s.connectedCases) {
        s.connectedCases.forEach(cId => {
          if (caseIdsSet.has(cId.toString())) {
            edges.push({
              data: {
                id: `edge_${suspectNodeId}_case_${cId}`,
                source: `case_${cId}`,
                target: suspectNodeId,
                label: 'Linked Suspect'
              }
            });
          }
        });
      }
    });

    // 3. Evidence Nodes & Edges
    allEvidence.forEach(e => {
      if (!caseIdsSet.has((e.caseId || '').toString())) return;

      const evNodeId = `evidence_${e._id}`;
      const icon = e.fileType === 'image' ? '🖼️' : (e.fileType === 'video' ? '🎬' : '📄');
      nodes.push({
        data: {
          id: evNodeId,
          rawId: e._id,
          label: `${icon} ${e.evidenceNumber}\n${e.title}`,
          name: e.title,
          type: 'evidence',
          fileType: e.fileType,
          hash: e.sha256Hash,
          integrity: e.integrityStatus,
          url: `/evidence/${e._id}`
        }
      });

      edges.push({
        data: {
          id: `edge_case_${e.caseId}_${evNodeId}`,
          source: `case_${e.caseId}`,
          target: evNodeId,
          label: 'Contains Evidence'
        }
      });

      // AI Detections as child findings nodes
      if (e.aiAnalysis && e.aiAnalysis.detections) {
        e.aiAnalysis.detections.forEach(d => {
          const findingNodeId = `finding_${d.id}`;
          nodes.push({
            data: {
              id: findingNodeId,
              label: `🔍 ${d.label}\n(${Math.round(d.confidence * 100)}%)`,
              name: d.label,
              type: 'finding',
              confidence: d.confidence,
              status: d.investigatorStatus,
              url: `/ai/analyze/${e._id}`
            }
          });
          edges.push({
            data: {
              id: `edge_${evNodeId}_${findingNodeId}`,
              source: evNodeId,
              target: findingNodeId,
              label: 'AI Marker'
            }
          });
        });
      }
    });

    res.json({ nodes, edges });
  } catch (err) {
    console.error('Graph data error:', err);
    res.status(500).json({ error: 'Failed to construct relationship graph data.' });
  }
});

module.exports = router;
