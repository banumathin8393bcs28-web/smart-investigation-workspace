const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');
const mongoose = require('mongoose');

const BASE_UPLOAD_DIR = path.join(__dirname, '..', 'private_uploads');

// In-memory bucket cache
const buckets = {};

function getBucket(bucketName = 'evidence_bucket') {
  if (!mongoose.connection || mongoose.connection.readyState !== 1) {
    return null;
  }
  if (!buckets[bucketName]) {
    buckets[bucketName] = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
      bucketName
    });
  }
  return buckets[bucketName];
}

/**
 * Saves a file buffer or disk file into persistent MongoDB GridFS storage
 * and preserves/ensures a local disk cache for fast processing.
 *
 * @param {Object} options
 * @param {Buffer} [options.buffer] - Raw file buffer
 * @param {string} [options.filePath] - Existing local disk file path
 * @param {string} options.filename - Desired filename / storage key
 * @param {string} options.mimeType - MIME type
 * @param {string} [options.bucketName] - 'evidence_bucket' | 'profile_bucket' | 'attachments_bucket'
 * @param {Object} [options.metadata] - Extra metadata to store in GridFS
 * @returns {Promise<{ storageKey: string, gridFsId: mongoose.Types.ObjectId, localPath: string, size: number }>}
 */
async function saveToStorage({ buffer, filePath, filename, mimeType, bucketName = 'evidence_bucket', metadata = {} }) {
  const sanitizedFilename = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '_');
  const targetDir = bucketName === 'profile_bucket'
    ? path.join(BASE_UPLOAD_DIR, 'profiles')
    : (bucketName === 'attachments_bucket'
        ? path.join(BASE_UPLOAD_DIR, 'chat')
        : path.join(BASE_UPLOAD_DIR, 'evidence'));

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const localPath = filePath || path.join(targetDir, sanitizedFilename);

  // If buffer was passed and local file doesn't exist, write local cache
  if (buffer && (!filePath || !fs.existsSync(localPath))) {
    fs.writeFileSync(localPath, buffer);
  }

  let fileBuffer = buffer;
  if (!fileBuffer && fs.existsSync(localPath)) {
    fileBuffer = fs.readFileSync(localPath);
  }

  let gridFsId = null;
  const bucket = getBucket(bucketName);

  if (bucket && fileBuffer) {
    try {
      gridFsId = await new Promise((resolve, reject) => {
        const readable = Readable.from(fileBuffer);
        const uploadStream = bucket.openUploadStream(sanitizedFilename, {
          contentType: mimeType,
          metadata: {
            ...metadata,
            uploadedAt: new Date(),
            originalFilename: filename
          }
        });

        readable.pipe(uploadStream)
          .on('error', (err) => {
            console.warn(`[StorageService] GridFS upload warning for ${sanitizedFilename}:`, err.message);
            resolve(null); // Do not fail upload if GridFS has minor transient issue
          })
          .on('finish', () => {
            resolve(uploadStream.id || (uploadStream.gridFSFile && uploadStream.gridFSFile._id));
          });
      });
    } catch (err) {
      console.warn(`[StorageService] Failed writing to GridFS ${bucketName}:`, err.message);
    }
  }

  const fileSize = fileBuffer ? fileBuffer.length : (fs.existsSync(localPath) ? fs.statSync(localPath).size : 0);

  return {
    storageKey: sanitizedFilename,
    gridFsId: gridFsId ? new mongoose.Types.ObjectId(gridFsId) : null,
    localPath,
    size: fileSize,
    mimeType
  };
}

/**
 * Returns a readable stream for a file.
 * Checks local filesystem cache first; if not present, falls back to GridFS download stream.
 *
 * @param {Object} options
 * @param {string|mongoose.Types.ObjectId} [options.gridFsId]
 * @param {string} [options.filename]
 * @param {string} [options.localPath]
 * @param {string} [options.bucketName]
 * @returns {Promise<{ stream: Readable, mimeType: string, size?: number, fromGridFs: boolean } | null>}
 */
async function getFileReadStream({ gridFsId, filename, localPath, bucketName = 'evidence_bucket' }) {
  // 1. Check local disk cache
  if (localPath && fs.existsSync(localPath)) {
    try {
      const stats = fs.statSync(localPath);
      return {
        stream: fs.createReadStream(localPath),
        size: stats.size,
        fromGridFs: false
      };
    } catch (e) {
      // proceed to GridFS
    }
  }

  // Check fallback local path based on filename
  if (filename) {
    const subfolder = bucketName === 'profile_bucket' ? 'profiles' : (bucketName === 'attachments_bucket' ? 'chat' : 'evidence');
    const directPath = path.join(BASE_UPLOAD_DIR, subfolder, path.basename(filename));
    if (fs.existsSync(directPath)) {
      try {
        const stats = fs.statSync(directPath);
        return {
          stream: fs.createReadStream(directPath),
          size: stats.size,
          fromGridFs: false
        };
      } catch (e) {
        // proceed
      }
    }
  }

  // 2. Fall back to MongoDB GridFS persistent bucket
  const bucket = getBucket(bucketName);
  if (!bucket) {
    return null;
  }

  try {
    let targetId = gridFsId ? (typeof gridFsId === 'string' ? new mongoose.Types.ObjectId(gridFsId) : gridFsId) : null;

    if (!targetId && filename) {
      // Find by filename in GridFS
      const files = await bucket.find({ filename: path.basename(filename) }).limit(1).toArray();
      if (files && files.length > 0) {
        targetId = files[0]._id;
      }
    }

    if (targetId) {
      const downloadStream = bucket.openDownloadStream(targetId);
      return {
        stream: downloadStream,
        fromGridFs: true
      };
    }
  } catch (err) {
    console.warn(`[StorageService] GridFS retrieve error (${bucketName}):`, err.message);
  }

  return null;
}

/**
 * Serves a persistent file over Express HTTP response with appropriate caching and security headers.
 */
async function serveFileResponse(req, res, { gridFsId, filename, localPath, mimeType = 'application/octet-stream', bucketName = 'evidence_bucket', fallbackPath = null, fallbackDataUri = null, downloadAs = null }) {
  const result = await getFileReadStream({ gridFsId, filename, localPath, bucketName });

  if (!result || !result.stream) {
    if (fallbackDataUri && fallbackDataUri.startsWith('data:')) {
      const parts = fallbackDataUri.split(',');
      if (parts.length === 2) {
        const mimeMatch = parts[0].match(/:(.*?);/);
        const resolvedMime = mimeMatch ? mimeMatch[1] : (mimeType !== 'application/octet-stream' ? mimeType : 'image/jpeg');
        const imgBuf = Buffer.from(parts[1], 'base64');
        res.setHeader('Content-Type', resolvedMime);
        res.setHeader('Content-Length', imgBuf.length);
        res.setHeader('Cache-Control', 'private, max-age=86400');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        if (downloadAs) {
          res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(downloadAs)}"`);
        } else {
          res.setHeader('Content-Disposition', 'inline');
        }
        return res.send(imgBuf);
      }
    }

    const resolvedFallback = fallbackPath || (bucketName === 'evidence_bucket' ? '/images/evidence-placeholder.svg' : null);
    if (resolvedFallback) {
      const fullFallback = path.isAbsolute(resolvedFallback) ? resolvedFallback : path.join(__dirname, '..', 'public', resolvedFallback.replace(/^\//, ''));
      if (fs.existsSync(fullFallback)) {
        res.setHeader('Content-Type', resolvedFallback.endsWith('.svg') ? 'image/svg+xml' : 'image/png');
        return res.sendFile(fullFallback);
      }
      return res.redirect(resolvedFallback);
    }
    return res.status(404).send('Requested evidence or media artifact was not found in persistent storage.');
  }

  res.setHeader('Content-Type', mimeType);
  res.setHeader('Cache-Control', 'private, max-age=86400'); // Cache for 24 hours
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (downloadAs) {
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(downloadAs)}"`);
  } else {
    res.setHeader('Content-Disposition', 'inline');
  }

  result.stream.on('error', (streamErr) => {
    console.error('[StorageService] Stream pipe error:', streamErr.message);
    if (!res.headersSent) {
      res.status(500).send('Error streaming media file.');
    }
  });

  result.stream.pipe(res);
}

module.exports = {
  BASE_UPLOAD_DIR,
  saveToStorage,
  getFileReadStream,
  serveFileResponse
};
