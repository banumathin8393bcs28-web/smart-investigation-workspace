const express = require('express');
const router = express.Router();
const Case = require('../models/Case');
const Scene = require('../models/Scene');
const AuditLog = require('../models/AuditLog');
const { ensureAuthenticated } = require('../middleware/auth');
const { canAccessCase } = require('../middleware/authorization');

// View Scene
router.get('/:id', ensureAuthenticated, async (req, res) => {
  try {
    const scene = await Scene.findById(req.params.id);
    if (!scene) {
      return res.status(404).render('partials/error', {
        title: '404 - Scene Record Not Found',
        message: 'The requested crime-scene sector record does not exist.'
      });
    }

    const caseDoc = await Case.findById(scene.caseId);
    res.render('scenes/show', {
      title: `Crime Scene Sector ${scene.sceneIdentifier}`,
      scene,
      caseDoc
    });
  } catch (err) {
    res.status(500).render('partials/error', {
      title: '500 - Scene Error',
      message: err.message
    });
  }
});

module.exports = router;
