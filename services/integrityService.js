const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Evidence = require('../models/Evidence');

class IntegrityService {
  /**
   * Calculate SHA-256 hash of a file on disk
   * @param {string} filePath 
   * @returns {Promise<string>} Hex SHA-256 digest
   */
  static async calculateFileHash(filePath) {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);

      stream.on('data', chunk => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', err => reject(err));
    });
  }

  /**
   * Check if a file with the given SHA-256 hash already exists in evidence database
   * @param {string} hash 
   * @param {string} [excludeId] 
   * @returns {Promise<object|null>} Existing duplicate evidence record if found
   */
  static async checkDuplicateHash(hash, excludeId = null) {
    const allEvidence = await Evidence.find({ sha256Hash: hash });
    if (excludeId) {
      return allEvidence.find(e => e._id.toString() !== excludeId.toString()) || null;
    }
    return allEvidence.length > 0 ? allEvidence[0] : null;
  }

  /**
   * Live tamper verification: recalculates current file hash and compares to ingestion hash
   * @param {string} evidenceId 
   * @param {object} investigatorUser 
   * @returns {Promise<{isIntact: boolean, originalHash: string, currentHash: string, status: string}>}
   */
  static async verifyEvidenceIntegrity(evidenceId, investigatorUser) {
    const evidence = await Evidence.findById(evidenceId);
    if (!evidence) {
      throw new Error('Evidence record not found');
    }

    const fullOriginalPath = path.join(__dirname, '..', 'public', evidence.originalPath);
    if (!fs.existsSync(fullOriginalPath)) {
      throw new Error('Original evidence file not found in storage archive');
    }

    const currentHash = await this.calculateFileHash(fullOriginalPath);
    const isIntact = (currentHash.toLowerCase() === evidence.sha256Hash.toLowerCase());
    const status = isIntact ? 'Verified Intact' : 'Tampered';

    // Update evidence record
    await Evidence.findByIdAndUpdate(evidenceId, {
      lastVerifiedHash: currentHash,
      integrityStatus: status,
      lastVerifiedAt: new Date().toISOString()
    });

    // Append to Chain of Custody
    await Evidence.addChainOfCustody(evidenceId, {
      action: 'INTEGRITY_VERIFICATION',
      investigator: investigatorUser ? investigatorUser.name : 'Forensic System',
      badgeId: investigatorUser ? investigatorUser.badgeId : 'SYS',
      notes: isIntact
        ? `Cryptographic SHA-256 checksum matched original baseline (${currentHash.slice(0, 16)}...). File is authentic and unaltered.`
        : `CRITICAL ALERT: Hash mismatch! Live hash (${currentHash.slice(0, 16)}...) differs from baseline (${evidence.sha256Hash.slice(0, 16)}...). Potential evidence tampering.`,
      hashSnapshot: currentHash
    });

    return {
      isIntact,
      originalHash: evidence.sha256Hash,
      currentHash,
      status
    };
  }

  /**
   * Create standardized analysis copy without touching the original
   * @param {string} originalFilePath 
   * @param {string} destinationDir 
   * @param {string} filename 
   * @returns {Promise<string>} Relative path to analysis file
   */
  static async createAnalysisCopy(originalFilePath, destinationDir, filename) {
    if (!fs.existsSync(destinationDir)) {
      fs.mkdirSync(destinationDir, { recursive: true });
    }
    const analysisFilename = `analysis_${filename}`;
    const targetPath = path.join(destinationDir, analysisFilename);

    await fs.promises.copyFile(originalFilePath, targetPath);
    return `/uploads/analysis/${analysisFilename}`;
  }
}

module.exports = IntegrityService;
