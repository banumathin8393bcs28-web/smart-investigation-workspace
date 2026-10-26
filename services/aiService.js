const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const hashService = require('./hashService');
const AIInspection = require('../models/AIInspection');
const Evidence = require('../models/Evidence');

// Configurable object vocabulary mapping synonyms and variations to standard classes
const VOCABULARY_MAP = {
  knife: ['knife', 'knives', 'blade', 'dagger', 'machete', 'cleaver', 'shank'],
  gun: ['gun', 'pistol', 'handgun', 'firearm', 'rifle', 'shotgun', 'weapon', 'revolver'],
  bag: ['bag', 'backpack', 'handbag', 'purse', 'suitcase', 'duffel', 'tote', 'briefcase'],
  vehicle: ['vehicle', 'car', 'automobile', 'truck', 'van', 'suv', 'motorcycle', 'bike', 'bicycle', 'bus'],
  phone: ['phone', 'cellphone', 'mobile', 'smartphone', 'telephone', 'cellular'],
  bottle: ['bottle', 'flask', 'can', 'container', 'jug'],
  tool: ['tool', 'hammer', 'wrench', 'screwdriver', 'scissors', 'cutter', 'pliers'],
  person: ['person', 'suspect', 'victim', 'individual', 'perpetrator', 'witness', 'man', 'woman']
};

// COCO class to vocabulary category mapping
const COCO_CATEGORY_MAP = {
  knife: 'knife',
  scissors: 'tool',
  backpack: 'bag',
  handbag: 'bag',
  suitcase: 'bag',
  car: 'vehicle',
  truck: 'vehicle',
  bus: 'vehicle',
  motorcycle: 'vehicle',
  bicycle: 'vehicle',
  'cell phone': 'phone',
  bottle: 'bottle',
  laptop: 'tool',
  person: 'person'
};

/**
 * Extracts searchable forensic object terms from case description and known objects context
 */
function extractContextKeywords(text) {
  if (!text || typeof text !== 'string') return [];
  const normalized = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  const words = normalized.split(/\s+/).filter(w => w.length > 2);

  const matchedTerms = new Set();

  for (const [canonicalTerm, variations] of Object.entries(VOCABULARY_MAP)) {
    for (const variation of variations) {
      if (words.includes(variation) || normalized.includes(variation)) {
        matchedTerms.add(canonicalTerm);
        break;
      }
    }
  }

  return Array.from(matchedTerms);
}

/**
 * Annotates an image buffer with bounding boxes and labels using Sharp SVG overlay
 */
async function createAnnotatedImage(sourcePath, destPath, detections) {
  try {
    const metadata = await sharp(sourcePath).metadata();
    const width = metadata.width || 800;
    const height = metadata.height || 600;

    let svgElements = '';

    for (const det of detections) {
      // Bounding box can be percentage or absolute pixels
      const box = det.boundingBox || det.box;
      let x = box.x;
      let y = box.y;
      let w = box.width;
      let h = box.height;

      // If coordinates are percentages (<= 100), convert to pixels
      if (x <= 100 && y <= 100 && w <= 100 && h <= 100) {
        x = Math.round((x / 100) * width);
        y = Math.round((y / 100) * height);
        w = Math.round((w / 100) * width);
        h = Math.round((h / 100) * height);
      }

      const color = det.isContextMatch ? '#d9534f' : '#0275d8';
      const labelText = `${det.label} (${Math.round(det.confidence * 100)}%)`;

      svgElements += `
        <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${color}" stroke-width="3" stroke-dasharray="${det.isContextMatch ? 'none' : '4 2'}" />
        <rect x="${x}" y="${Math.max(0, y - 26)}" width="${Math.max(120, labelText.length * 8)}" height="26" fill="${color}" opacity="0.9" />
        <text x="${x + 6}" y="${Math.max(18, y - 8)}" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#ffffff">${labelText}</text>
      `;
    }

    const svgOverlay = Buffer.from(`
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        ${svgElements}
      </svg>
    `);

    await sharp(sourcePath)
      .composite([{ input: svgOverlay, top: 0, left: 0 }])
      .toFile(destPath);

    return true;
  } catch (err) {
    console.error('[AIService] Image annotation error:', err);
    return false;
  }
}

/**
 * Runs AI Object Inspection for an evidence image
 */
async function inspectEvidenceImage({ evidence, caseDoc, investigator, confidenceThreshold = 0.25 }) {
  const extractedTerms = extractContextKeywords(`${caseDoc.caseDescription} ${caseDoc.knownObjects || ''} ${caseDoc.crimeType}`);

  const aiServiceUrl = process.env.PYTHON_AI_SERVICE_URL || 'http://127.0.0.1:8000/detect';

  let detectionResponse = null;
  let serviceAvailable = false;
  let serviceError = null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(aiServiceUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filePath: evidence.protectedStoragePath,
        contextTerms: extractedTerms,
        confidenceThreshold: Number(confidenceThreshold)
      }),
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (res.ok) {
      detectionResponse = await res.json();
      serviceAvailable = true;
    } else {
      serviceError = `Python AI HTTP service responded with status ${res.status}`;
    }
  } catch (httpErr) {
    // Fallback: execute Python child process directly
    try {
      const { execFile } = require('child_process');
      const scriptPath = path.join(__dirname, '..', 'ai_service', 'app.py');

      detectionResponse = await new Promise((resolve, reject) => {
        execFile('python', [scriptPath, '--cli', evidence.protectedStoragePath, String(confidenceThreshold)], {
          timeout: 15000,
          maxBuffer: 10 * 1024 * 1024
        }, (err, stdout, stderr) => {
          if (err) return reject(err);
          const startMarker = '__JSON_START__';
          const endMarker = '__JSON_END__';
          const sIdx = stdout.indexOf(startMarker);
          const eIdx = stdout.indexOf(endMarker);
          if (sIdx !== -1 && eIdx !== -1) {
            try {
              const parsed = JSON.parse(stdout.substring(sIdx + startMarker.length, eIdx));
              resolve(parsed);
            } catch (pErr) {
              reject(pErr);
            }
          } else {
            reject(new Error(stderr || 'Malformed Python CLI output'));
          }
        });
      });
      serviceAvailable = true;
    } catch (cliErr) {
      serviceAvailable = false;
      serviceError = `Python AI service unavailable: ${cliErr.message}. Ensure Python dependencies (ultralytics, torch) are installed.`;
    }
  }

  const annotatedDir = path.join(path.dirname(evidence.protectedStoragePath), 'annotated');
  if (!fs.existsSync(annotatedDir)) {
    fs.mkdirSync(annotatedDir, { recursive: true });
  }

  const annotatedFilename = `annotated_${path.basename(evidence.protectedStoragePath)}`;
  const annotatedPath = path.join(annotatedDir, annotatedFilename);

  let inspectionStatus = 'Service Unavailable';
  let detections = [];
  let summaryMessage = '';
  let annotatedSha256 = '';

  if (serviceAvailable && detectionResponse && Array.isArray(detectionResponse.detections)) {
    const rawDetections = detectionResponse.detections;

    // Filter and map detections
    for (const d of rawDetections) {
      const conf = Number(d.confidence) || 0;
      if (conf < confidenceThreshold) continue;

      const rawLabel = (d.label || d.category || 'Object').toLowerCase();
      const detectedCategory = COCO_CATEGORY_MAP[rawLabel] || rawLabel;
      const isContextMatch = extractedTerms.includes(detectedCategory) || extractedTerms.some(term => rawLabel.includes(term));

      detections.push({
        label: d.label || detectedCategory.toUpperCase(),
        confidence: conf,
        boundingBox: {
          x: d.bbox ? d.bbox[0] : 0,
          y: d.bbox ? d.bbox[1] : 0,
          width: d.bbox ? d.bbox[2] : 0,
          height: d.bbox ? d.bbox[3] : 0
        },
        isContextMatch,
        notes: isContextMatch
          ? `Matches context object keyword '${detectedCategory}'. Model confidence: ${(conf * 100).toFixed(1)}%`
          : `General object detected by model. Confidence: ${(conf * 100).toFixed(1)}%`
      });
    }

    if (detections.length > 0) {
      inspectionStatus = 'Success';
      summaryMessage = `YOLO detection identified ${detections.length} object(s). ${detections.filter(d => d.isContextMatch).length} matched case context keywords.`;
      const annotatedSuccess = await createAnnotatedImage(evidence.protectedStoragePath, annotatedPath, detections);
      if (annotatedSuccess && fs.existsSync(annotatedPath)) {
        annotatedSha256 = await hashService.calculateFileHash(annotatedPath);
      }
    } else {
      inspectionStatus = 'No Objects Detected';
      summaryMessage = 'No matching objects detected by the configured model at the specified confidence threshold. (Note: Non-detection does not prove an object is absent).';
    }
  } else {
    inspectionStatus = 'Service Unavailable';
    summaryMessage = serviceError || 'AI microservice is offline. Local inspection could not be completed.';
  }

  // Create AIInspection record in MongoDB
  const inspectionRecord = await AIInspection.create({
    caseId: caseDoc._id,
    caseNumber: caseDoc.caseNumber,
    evidenceId: evidence._id,
    evidenceIdentifier: evidence.evidenceIdentifier,
    extractedSearchTerms: extractedTerms,
    modelName: detectionResponse?.model || 'Ultralytics YOLOv8',
    modelVersion: detectionResponse?.version || '8.1.0-forensic',
    confidenceThreshold: Number(confidenceThreshold),
    detections,
    detectionLabels: detections.map(d => d.label),
    confidenceScores: detections.map(d => d.confidence),
    annotatedImageReference: inspectionStatus === 'Success' ? annotatedPath : '',
    annotatedSha256,
    inspectionStatus,
    errorInformation: serviceError,
    summaryMessage,
    inspectedBy: investigator._id,
    inspectedByName: investigator.fullName,
    inspectionTimestamp: new Date()
  });

  // Update Evidence status
  await Evidence.findByIdAndUpdate(evidence._id, {
    inspectionStatus: inspectionStatus === 'Success' ? 'Inspected' : (inspectionStatus === 'No Objects Detected' ? 'Inspected' : 'Failed'),
    lastModifiedTimestamp: new Date()
  });

  return inspectionRecord;
}

module.exports = {
  VOCABULARY_MAP,
  COCO_CATEGORY_MAP,
  extractContextKeywords,
  createAnnotatedImage,
  inspectEvidenceImage
};
