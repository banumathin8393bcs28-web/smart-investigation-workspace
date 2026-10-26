const fs = require('fs');
const crypto = require('crypto');

/**
 * Calculates SHA-256 hash from a Buffer
 */
function calculateBufferHash(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex').toLowerCase();
}

/**
 * Calculates SHA-256 hash directly from a file path on disk
 */
function calculateFileHash(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);

    stream.on('data', data => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex').toLowerCase()));
    stream.on('error', err => reject(err));
  });
}

/**
 * Verifies if file on disk matches expected SHA-256 hash
 */
async function verifyFileIntegrity(filePath, expectedHash) {
  try {
    const actualHash = await calculateFileHash(filePath);
    return {
      isValid: actualHash === expectedHash.toLowerCase(),
      actualHash,
      expectedHash: expectedHash.toLowerCase()
    };
  } catch (error) {
    return {
      isValid: false,
      error: error.message
    };
  }
}

module.exports = {
  calculateBufferHash,
  calculateFileHash,
  verifyFileIntegrity
};
