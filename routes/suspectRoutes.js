const express = require('express');
const router = express.Router();
const Suspect = require('../models/Suspect');
const Case = require('../models/Case');
const AuditLog = require('../models/AuditLog');
const { isAuthenticated } = require('../middleware/auth');
const { uploadSuspect } = require('../middleware/upload');

// GET /suspects
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const { q, status, riskLevel } = req.query;
    let query = {};
    if (status) query.status = status;
    if (riskLevel) query.riskLevel = riskLevel;

    let suspects = await Suspect.find(query);

    if (q) {
      const search = q.toLowerCase();
      suspects = suspects.filter(s =>
        (s.fullName && s.fullName.toLowerCase().includes(search)) ||
        (s.alias && s.alias.toLowerCase().includes(search)) ||
        (s.nationalId && s.nationalId.toLowerCase().includes(search)) ||
        (s.phone && s.phone.toLowerCase().includes(search))
      );
    }

    suspects.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.render('suspects/index', {
      title: 'Criminal & Suspect Registry | Smart Investigation Workspace',
      suspects,
      query: req.query
    });
  } catch (err) {
    console.error('Suspect list error:', err);
    res.redirect('/dashboard?error=Could not load suspect profiles');
  }
});

// GET /suspects/new
router.get('/new', isAuthenticated, async (req, res) => {
  const cases = await Case.find();
  res.render('suspects/new', {
    title: 'Register Suspect Profile | Smart Investigation Workspace',
    cases,
    error: req.query.error || null
  });
});

// POST /suspects
router.post('/', isAuthenticated, uploadSuspect.single('photo'), async (req, res) => {
  try {
    const {
      fullName,
      alias,
      nationalId,
      status,
      riskLevel,
      phone,
      address,
      height,
      eyeColor,
      hairColor,
      identifyingMarks,
      priorOffenses,
      connectedCases,
      notes
    } = req.body;

    if (!fullName) {
      return res.redirect('/suspects/new?error=Suspect Full Name is required.');
    }

    const photoPath = req.file ? `/uploads/suspects/${req.file.filename}` : '/images/default-suspect.png';
    const offensesArray = priorOffenses ? priorOffenses.split('\n').map(o => o.trim()).filter(Boolean) : [];
    const casesArray = Array.isArray(connectedCases) ? connectedCases : (connectedCases ? [connectedCases] : []);

    const newSuspect = await Suspect.create({
      fullName: fullName.trim(),
      alias: alias ? alias.trim() : '',
      nationalId: nationalId ? nationalId.trim() : '',
      status: status || 'Person of Interest',
      riskLevel: riskLevel || 'Moderate',
      photo: photoPath,
      phone: phone ? phone.trim() : '',
      address: address ? address.trim() : '',
      physicalTraits: {
        height: height || 'Unrecorded',
        eyeColor: eyeColor || 'Unrecorded',
        hairColor: hairColor || 'Unrecorded',
        identifyingMarks: identifyingMarks ? identifyingMarks.trim() : 'None recorded'
      },
      priorOffenses: offensesArray,
      connectedCases: casesArray,
      notes: notes ? notes.trim() : ''
    });

    await AuditLog.log({
      investigator: req.user.name,
      badgeId: req.user.badgeId,
      action: 'SUSPECT_REGISTERED',
      targetType: 'Suspect',
      targetId: newSuspect._id,
      details: `Suspect profile registered: ${newSuspect.fullName} (${newSuspect.status}).`,
      ipAddress: req.ip
    });

    res.redirect(`/suspects/${newSuspect._id}?success=Suspect record created successfully.`);
  } catch (err) {
    console.error('Create suspect error:', err);
    res.redirect('/suspects/new?error=Failed to register suspect.');
  }
});

// GET /suspects/:id
router.get('/:id', isAuthenticated, async (req, res) => {
  try {
    const suspect = await Suspect.findById(req.params.id);
    if (!suspect) return res.redirect('/suspects?error=Suspect profile not found.');

    const allCases = await Case.find();
    const linkedCases = allCases.filter(c => suspect.connectedCases && suspect.connectedCases.includes(c._id.toString()));

    res.render('suspects/show', {
      title: `${suspect.fullName} - Dossier | Smart Investigation Workspace`,
      suspect,
      linkedCases,
      allCases,
      success: req.query.success || null,
      error: req.query.error || null
    });
  } catch (err) {
    console.error('Suspect detail error:', err);
    res.redirect('/suspects?error=Failed to retrieve suspect dossier.');
  }
});

// POST /suspects/:id/interrogation
router.post('/:id/interrogation', isAuthenticated, async (req, res) => {
  try {
    const { notes, voiceRecorded } = req.body;
    if (!notes || !notes.trim()) {
      return res.redirect(`/suspects/${req.params.id}?error=Notes cannot be empty.`);
    }

    const noteEntry = {
      date: new Date().toISOString(),
      investigator: req.user.name,
      notes: notes.trim(),
      voiceRecorded: voiceRecorded === 'true'
    };

    await Suspect.findByIdAndUpdate(req.params.id, {
      $push: { interrogationNotes: noteEntry }
    });

    res.redirect(`/suspects/${req.params.id}?success=Interrogation notes recorded.`);
  } catch (err) {
    console.error('Interrogation note error:', err);
    res.redirect(`/suspects/${req.params.id}?error=Failed to append interrogation record.`);
  }
});

// POST /suspects/:id/link-case
router.post('/:id/link-case', isAuthenticated, async (req, res) => {
  try {
    const { caseId } = req.body;
    const suspect = await Suspect.findById(req.params.id);
    if (!suspect || !caseId) return res.redirect('/suspects');

    if (!suspect.connectedCases.includes(caseId)) {
      await Suspect.findByIdAndUpdate(suspect._id, {
        $push: { connectedCases: caseId }
      });
      // Also add note to case timeline
      const targetCase = await Case.findById(caseId);
      if (targetCase) {
        await Case.addTimelineEvent(caseId, {
          title: 'Suspect Linked to Case',
          description: `Suspect ${suspect.fullName} (${suspect.status}) linked to active case.`,
          investigator: req.user.name,
          type: 'suspect_linked'
        });
      }
    }

    res.redirect(`/suspects/${suspect._id}?success=Case linkage updated.`);
  } catch (err) {
    console.error('Link case error:', err);
    res.redirect(`/suspects/${req.params.id}?error=Failed to link case.`);
  }
});

module.exports = router;
