'use strict';

/**
 * migrateToCloudinary.js
 * Smart Investigation Workspace — Cloudinary Migration Script
 *
 * Finds all Evidence records that do NOT yet have a cloudinaryUrl,
 * locates the original file (local disk → GridFS stream),
 * uploads it to Cloudinary, and stores the permanent URL + public_id.
 *
 * SAFE TO RE-RUN: skips records that already have cloudinaryUrl.
 * NEVER deletes original files or modifies sha256Hash.
 *
 * Usage:
 *   node scripts/migrateToCloudinary.js
 *
 * Or against Atlas for production:
 *   MONGODB_URI=<atlas_uri> node scripts/migrateToCloudinary.js
 */

require('dotenv').config();
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

const Evidence = require('../models/Evidence');
const { uploadBufferToCloudinary, isCloudinaryConfigured } = require('../services/cloudinaryService');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/smart_investigation';

// Lazy-load GridFS bucket
let gfsBucket = null;
function getGridFsBucket(db) {
  if (!gfsBucket) {
    gfsBucket = new mongoose.mongo.GridFSBucket(db, { bucketName: 'evidence_bucket' });
  }
  return gfsBucket;
}

/**
 * Try to read a file buffer from local disk path.
 */
function readLocalBuffer(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) {
      return fs.readFileSync(filePath);
    }
  } catch (_) {}
  return null;
}

/**
 * Try to stream a file from GridFS by ObjectId.
 */
function readGridFsBuffer(db, gridFsId) {
  return new Promise((resolve) => {
    if (!gridFsId) return resolve(null);
    try {
      const bucket = getGridFsBucket(db);
      const chunks = [];
      const downloadStream = bucket.openDownloadStream(
        typeof gridFsId === 'string' ? new mongoose.Types.ObjectId(gridFsId) : gridFsId
      );
      downloadStream.on('data', (chunk) => chunks.push(chunk));
      downloadStream.on('end', () => resolve(Buffer.concat(chunks)));
      downloadStream.on('error', () => resolve(null));
    } catch (_) {
      resolve(null);
    }
  });
}

async function main() {
  if (!isCloudinaryConfigured()) {
    console.error('[Migration] ERROR: Cloudinary credentials are not configured.');
    console.error('  Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in .env');
    process.exit(1);
  }

  console.log('[Migration] Connecting to MongoDB…');
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;
  console.log('[Migration] Connected.');

  // Find all evidence that lacks a cloudinaryUrl
  const records = await Evidence.find({
    $or: [
      { cloudinaryUrl: { $exists: false } },
      { cloudinaryUrl: '' },
      { cloudinaryUrl: null }
    ]
  }).lean();

  console.log(`[Migration] Found ${records.length} evidence record(s) without cloudinaryUrl.\n`);

  let succeeded = 0;
  let skipped = 0;
  let failed = 0;

  for (const ev of records) {
    const label = `${ev.evidenceIdentifier || ev._id}`;
    let buffer = null;

    // 1. Try local disk
    buffer = readLocalBuffer(ev.protectedStoragePath);
    if (buffer) {
      console.log(`  [${label}] Source: local disk`);
    }

    // 2. Try GridFS
    if (!buffer && ev.gridFsId) {
      buffer = await readGridFsBuffer(db, ev.gridFsId);
      if (buffer) {
        console.log(`  [${label}] Source: GridFS`);
      }
    }

    if (!buffer) {
      console.warn(`  [${label}] SKIPPED — file not found on local disk or GridFS.`);
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
        cloudinaryUrl: result.url,
        cloudinaryPublicId: result.publicId,
        lastModifiedTimestamp: new Date()
      });

      console.log(`  [${label}] ✓ Uploaded → ${result.url}`);
      succeeded++;
    } catch (uploadErr) {
      console.error(`  [${label}] ✗ Upload failed: ${uploadErr.message}`);
      failed++;
    }
  }

  console.log(`\n[Migration] Complete.`);
  console.log(`  Succeeded : ${succeeded}`);
  console.log(`  Skipped   : ${skipped}  (file not found anywhere — originals may be on Render ephemeral disk)`);
  console.log(`  Failed    : ${failed}  (Cloudinary API error)`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('[Migration] Fatal error:', err.message);
  process.exit(1);
});
