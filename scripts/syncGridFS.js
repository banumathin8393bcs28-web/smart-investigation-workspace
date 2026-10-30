const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const sharp = require('sharp');
const { saveToStorage } = require('../services/storageService');
const Evidence = require('../models/Evidence');

async function syncAllEvidenceToGridFS() {
  const dbUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/smart_investigation';
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(dbUri);
  }
  
  console.log('[GridFS Sync] Inspecting Evidence documents for persistent storage sync...');
  const evidenceList = await Evidence.find({});
  let syncedCount = 0;

  for (const ev of evidenceList) {
    let changed = false;
    const updateFields = {};

    // 1. Resolve original image file on disk
    let fileBuf = null;
    let filePath = ev.protectedStoragePath;

    if (filePath && fs.existsSync(filePath)) {
      fileBuf = fs.readFileSync(filePath);
    } else if (ev.storedFilename) {
      const fallback = path.join(__dirname, '..', 'private_uploads', 'evidence', ev.storedFilename);
      if (fs.existsSync(fallback)) {
        filePath = fallback;
        fileBuf = fs.readFileSync(fallback);
      }
    }

    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'evidence_bucket' });
    let existingGridFs = null;

    if (ev.gridFsId) {
      try {
        const found = await bucket.find({ _id: ev.gridFsId }).limit(1).toArray();
        if (found && found.length > 0) {
          existingGridFs = found[0];
        }
      } catch (e) {}
    }

    if (!existingGridFs && ev.storedFilename) {
      try {
        const foundByName = await bucket.find({ filename: ev.storedFilename }).limit(1).toArray();
        if (foundByName && foundByName.length > 0) {
          existingGridFs = foundByName[0];
          updateFields.gridFsId = existingGridFs._id;
          changed = true;
        }
      } catch (e) {}
    }

    if (fileBuf && !existingGridFs) {
      console.log(`[GridFS Sync] Storing ${ev.evidenceIdentifier} (${ev.storedFilename}, ${fileBuf.length} bytes) to GridFS...`);
      const saved = await saveToStorage({
        buffer: fileBuf,
        filePath,
        filename: ev.storedFilename,
        mimeType: ev.fileMimeType || 'image/png',
        bucketName: 'evidence_bucket',
        metadata: { caseNumber: ev.caseNumber, evidenceIdentifier: ev.evidenceIdentifier }
      });
      if (saved && saved.gridFsId) {
        updateFields.gridFsId = saved.gridFsId;
        updateFields.storageKey = saved.storageKey;
        existingGridFs = { _id: saved.gridFsId };
        changed = true;
        console.log(`[GridFS Sync] -> GridFS ID: ${saved.gridFsId}`);
      }
    }

    // 2. Resolve thumbnail
    const thumbFilename = ev.thumbnailPath ? path.basename(ev.thumbnailPath) : `thumb_${ev.storedFilename}`;
    let thumbBuf = null;
    let thumbPath = ev.thumbnailPath;

    if (thumbPath && fs.existsSync(thumbPath)) {
      thumbBuf = fs.readFileSync(thumbPath);
    } else {
      const thumbFallback = path.join(__dirname, '..', 'private_uploads', 'evidence', 'thumbnails', thumbFilename);
      if (fs.existsSync(thumbFallback)) {
        thumbPath = thumbFallback;
        thumbBuf = fs.readFileSync(thumbFallback);
      }
    }

    if (thumbBuf && !ev.thumbnailGridFsId) {
      console.log(`[GridFS Sync] Storing thumbnail for ${ev.evidenceIdentifier} to GridFS...`);
      const savedThumb = await saveToStorage({
        buffer: thumbBuf,
        filePath: thumbPath,
        filename: thumbFilename,
        mimeType: 'image/jpeg',
        bucketName: 'evidence_bucket'
      });
      if (savedThumb && savedThumb.gridFsId) {
        updateFields.thumbnailGridFsId = savedThumb.gridFsId;
        changed = true;
      }
    }

    // 3. Resolve inline thumbnailDataUri directly inside MongoDB document
    if (!ev.thumbnailDataUri) {
      let sourceBuf = thumbBuf || fileBuf;
      if (!sourceBuf && (ev.gridFsId || (existingGridFs && existingGridFs._id))) {
        try {
          const targetId = ev.gridFsId || existingGridFs._id;
          const downloadStream = bucket.openDownloadStream(targetId);
          const chunks = [];
          await new Promise((resolve, reject) => {
            downloadStream.on('data', c => chunks.push(c));
            downloadStream.on('error', reject);
            downloadStream.on('end', resolve);
          });
          sourceBuf = Buffer.concat(chunks);
        } catch (streamErr) {
          console.warn(`[GridFS Sync] Stream download warning for ${ev.evidenceIdentifier}:`, streamErr.message);
        }
      }

      if (sourceBuf) {
        try {
          const resizedBuf = await sharp(sourceBuf)
            .resize(400, 300, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 82 })
            .toBuffer();
          updateFields.thumbnailDataUri = `data:image/jpeg;base64,${resizedBuf.toString('base64')}`;
          changed = true;
          console.log(`[GridFS Sync] -> Stored inline thumbnailDataUri for ${ev.evidenceIdentifier} (${resizedBuf.length} bytes) in MongoDB`);
        } catch (sharpErr) {
          console.warn(`[GridFS Sync] Thumbnail sharp conversion warning:`, sharpErr.message);
        }
      }
    }

    if (changed) {
      await Evidence.findByIdAndUpdate(ev._id, { $set: updateFields });
      syncedCount++;
      console.log(`[GridFS Sync] Successfully updated document for ${ev.evidenceIdentifier}`);
    }
  }

  console.log(`[GridFS Sync] Completed sync. Total records updated: ${syncedCount}`);
}

if (require.main === module) {
  syncAllEvidenceToGridFS()
    .then(() => mongoose.disconnect())
    .catch((err) => {
      console.error('[GridFS Sync Error]:', err);
      process.exit(1);
    });
}

module.exports = { syncAllEvidenceToGridFS };
