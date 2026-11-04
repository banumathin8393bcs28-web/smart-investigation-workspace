'use strict';
/**
 * routes/admin.js
 * Smart Investigation Workspace — Administrative Utilities
 *
 * Provides one-shot maintenance operations accessible to any authenticated
 * investigator. These routes are idempotent — safe to run multiple times.
 *
 * Routes:
 *   GET  /admin/migrate-cloudinary          — View migration status
 *   POST /admin/migrate-cloudinary/run      — Run Cloudinary migration
 */

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Evidence = require('../models/Evidence');
const { ensureAuthenticated } = require('../middleware/auth');
const { uploadBufferToCloudinary, isCloudinaryConfigured } = require('../services/cloudinaryService');
const { getFileReadStream } = require('../services/storageService');

// ── Helper: stream GridFS file to buffer ───────────────────────────────────────
async function streamToBuffer(readable) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readable.on('data', c => chunks.push(c));
    readable.on('end', () => resolve(Buffer.concat(chunks)));
    readable.on('error', reject);
  });
}

// ── GET /admin/migrate-cloudinary ─────────────────────────────────────────────
router.get('/migrate-cloudinary', ensureAuthenticated, async (req, res) => {
  try {
    const total   = await Evidence.countDocuments({});
    const done    = await Evidence.countDocuments({ cloudinaryUrl: { $exists: true, $ne: '' } });
    const pending = total - done;

    const cloudinaryReady = isCloudinaryConfigured();

    res.render('admin/migrate-cloudinary', {
      title: 'Cloudinary Migration — Admin',
      total,
      done,
      pending,
      cloudinaryReady,
      result: null
    });
  } catch (err) {
    res.status(500).render('partials/error', { title: '500', message: err.message });
  }
});

// ── POST /admin/migrate-cloudinary/run ────────────────────────────────────────
router.post('/migrate-cloudinary/run', ensureAuthenticated, async (req, res) => {
  const log     = [];
  let succeeded = 0;
  let skipped   = 0;
  let failed    = 0;

  if (!isCloudinaryConfigured()) {
    return res.render('admin/migrate-cloudinary', {
      title: 'Cloudinary Migration — Admin',
      total: 0, done: 0, pending: 0,
      cloudinaryReady: false,
      result: { log: ['❌ Cloudinary credentials are not configured on this server. Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET to your Render environment variables and redeploy.'], succeeded: 0, skipped: 0, failed: 0 }
    });
  }

  try {
    // Find all evidence without a cloudinaryUrl
    const records = await Evidence.find({
      $or: [
        { cloudinaryUrl: { $exists: false } },
        { cloudinaryUrl: '' },
        { cloudinaryUrl: null }
      ]
    }).lean();

    log.push(`Found ${records.length} evidence record(s) without cloudinaryUrl.`);

    for (const ev of records) {
      const label = ev.evidenceIdentifier || String(ev._id);
      let buffer = null;

      // 1. Try to get buffer from GridFS (works in Atlas even after Render restart)
      try {
        const streamResult = await getFileReadStream({
          gridFsId:   ev.gridFsId,
          filename:   ev.storedFilename || ev.storageKey,
          localPath:  ev.protectedStoragePath,
          bucketName: 'evidence_bucket'
        });
        if (streamResult && streamResult.stream) {
          buffer = await streamToBuffer(streamResult.stream);
        }
      } catch (streamErr) {
        log.push(`  [${label}] GridFS stream error: ${streamErr.message}`);
      }

      // 2. Fall back to thumbnailDataUri if GridFS unavailable
      if (!buffer && ev.thumbnailDataUri && ev.thumbnailDataUri.startsWith('data:')) {
        try {
          const parts = ev.thumbnailDataUri.split(',');
          if (parts.length === 2) {
            buffer = Buffer.from(parts[1], 'base64');
            log.push(`  [${label}] Using embedded DataURI thumbnail as source.`);
          }
        } catch (_) {}
      }

      if (!buffer) {
        log.push(`  [${label}] ⚠ SKIPPED — no file data found in GridFS or DataURI. Original may be on a previous ephemeral disk.`);
        skipped++;
        continue;
      }

      // Upload to Cloudinary
      try {
        const result = await uploadBufferToCloudinary(
          buffer,
          ev.storedFilename || ev.originalFilename || label,
          ev.fileMimeType || 'image/jpeg',
          'evidence'
        );

        await Evidence.findByIdAndUpdate(ev._id, {
          cloudinaryUrl:      result.url,
          cloudinaryPublicId: result.publicId,
          lastModifiedTimestamp: new Date()
        });

        log.push(`  [${label}] ✓ Uploaded → ${result.url}`);
        succeeded++;
      } catch (uploadErr) {
        log.push(`  [${label}] ✗ Cloudinary upload failed: ${uploadErr.message}`);
        failed++;
      }
    }

    log.push(`\nMigration complete. Succeeded: ${succeeded} | Skipped: ${skipped} | Failed: ${failed}`);

    const total   = await Evidence.countDocuments({});
    const done    = await Evidence.countDocuments({ cloudinaryUrl: { $exists: true, $ne: '' } });
    const pending = total - done;

    res.render('admin/migrate-cloudinary', {
      title: 'Cloudinary Migration — Admin',
      total,
      done,
      pending,
      cloudinaryReady: true,
      result: { log, succeeded, skipped, failed }
    });
  } catch (err) {
    res.status(500).render('partials/error', { title: '500', message: err.message });
  }
});

module.exports = router;
