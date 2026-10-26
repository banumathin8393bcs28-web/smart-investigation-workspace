const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const hashService = require('./hashService');
const timestampService = require('./timestampService');
const { getNextReportNumber } = require('./caseNumberService');
const Report = require('../models/Report');
const AuditLog = require('../models/AuditLog');

/**
 * Generates a comprehensive forensic investigation PDF report using PDFKit
 */
async function generateCaseReport({
  caseDoc,
  evidenceList = [],
  inspections = [],
  custodyHistory = [],
  auditLogs = [],
  investigator
}) {
  const reportsDir = path.join(__dirname, '..', 'private_uploads', 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const reportId = await getNextReportNumber(caseDoc.caseNumber);
  const pdfFilename = `${reportId}_${caseDoc.caseNumber}.pdf`;
  const pdfPath = path.join(reportsDir, pdfFilename);

  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 45, bottom: 45, left: 45, right: 45 },
    bufferPages: true,
    info: {
      Title: `Forensic Case Report - ${caseDoc.caseNumber}`,
      Author: investigator.fullName,
      Subject: `Official Forensic Investigation Report for ${caseDoc.caseName}`,
      Keywords: 'Forensics, Evidence, Smart Investigation Workspace, Chain of Custody',
      CreationDate: new Date()
    }
  });

  const stream = fs.createWriteStream(pdfPath);
  doc.pipe(stream);

  const navyColor = '#0f2a4a';
  const charcoalColor = '#212529';
  const mutedColor = '#555555';
  const accentBlue = '#1a4b7a';
  const borderGrey = '#cccccc';

  // 1. HEADER / COVER SECTION
  doc.rect(45, 45, 505, 55).fill(navyColor);
  doc.fillColor('#ffffff')
    .font('Helvetica-Bold')
    .fontSize(16)
    .text('SMART INVESTIGATION WORKSPACE', 60, 56, { align: 'left' });
  doc.fontSize(9)
    .font('Helvetica')
    .text('CENTRAL FORENSIC CASE MANAGEMENT & DIGITAL EVIDENCE INTELLIGENCE SYSTEM', 60, 75, { align: 'left' });

  doc.moveDown(2.5);

  // Report Title
  doc.fillColor(navyColor)
    .font('Helvetica-Bold')
    .fontSize(18)
    .text(`INVESTIGATION CASE REPORT: ${caseDoc.caseNumber}`, 45, 115);

  doc.fillColor(charcoalColor)
    .font('Helvetica')
    .fontSize(12)
    .text(`Case Title: ${caseDoc.caseName}`, 45, 138);

  const genDateStr = timestampService.formatTimestamp(new Date());
  doc.fontSize(9)
    .fillColor(mutedColor)
    .text(`Report Identifier: ${reportId}   |   Generated: ${genDateStr}`, 45, 155);

  doc.moveTo(45, 172).lineTo(550, 172).strokeColor(borderGrey).stroke();

  // 2. INVESTIGATOR DETAILS SECTION
  doc.fillColor(navyColor)
    .font('Helvetica-Bold')
    .fontSize(12)
    .text('1. INVESTIGATOR DETAILS', 45, 185);

  // Investigator photograph embed if available
  let yPos = 205;
  const photoPath = investigator.profilePhoto && investigator.profilePhoto.startsWith('/uploads/')
    ? path.join(__dirname, '..', 'private_uploads', path.basename(investigator.profilePhoto))
    : null;

  if (photoPath && fs.existsSync(photoPath)) {
    try {
      doc.image(photoPath, 45, yPos, { width: 65, height: 65, fit: [65, 65] });
    } catch (e) {
      // ignore image error
    }
  }

  const textLeft = (photoPath && fs.existsSync(photoPath)) ? 120 : 45;
  doc.font('Helvetica-Bold').fontSize(10).fillColor(charcoalColor).text(`Generating Officer: `, textLeft, yPos, { continued: true });
  doc.font('Helvetica').text(`${investigator.fullName} (${investigator.role})`);
  doc.font('Helvetica-Bold').text(`Official Email: `, textLeft, yPos + 15, { continued: true });
  doc.font('Helvetica').text(`${investigator.email}`);
  doc.font('Helvetica-Bold').text(`Department / Unit: `, textLeft, yPos + 30, { continued: true });
  doc.font('Helvetica').text(`${caseDoc.department || 'Digital Forensics Unit'}`);
  doc.font('Helvetica-Bold').text(`Original Case Creator: `, textLeft, yPos + 45, { continued: true });
  doc.font('Helvetica').text(`${caseDoc.creatorName} (Created on ${timestampService.formatTimestamp(caseDoc.creationTimestamp)})`);

  yPos += 75;
  doc.moveTo(45, yPos).lineTo(550, yPos).strokeColor(borderGrey).stroke();
  yPos += 12;

  // 3. CASE DETAILS
  doc.fillColor(navyColor).font('Helvetica-Bold').fontSize(12).text('2. CASE DETAILS & INCIDENT SPECIFICATIONS', 45, yPos);
  yPos += 20;

  const caseSpecs = [
    ['Crime Classification:', caseDoc.crimeType + (caseDoc.crimeTypeOther ? ` (${caseDoc.crimeTypeOther})` : ''), 'Current Status:', caseDoc.status],
    ['Incident Date:', timestampService.formatDateOnly(caseDoc.incidentDate), 'Incident Time:', caseDoc.incidentTime],
    ['Incident Location:', caseDoc.incidentLocation, 'Scene Address:', caseDoc.crimeSceneAddress || 'Not specified'],
    ['Original Created:', timestampService.formatTimestamp(caseDoc.creationTimestamp), 'Last Updated:', timestampService.formatTimestamp(caseDoc.lastUpdatedTimestamp)]
  ];

  for (const row of caseSpecs) {
    doc.font('Helvetica-Bold').fontSize(9).fillColor(navyColor).text(row[0], 45, yPos, { width: 110 });
    doc.font('Helvetica').fontSize(9).fillColor(charcoalColor).text(row[1], 160, yPos, { width: 130 });
    doc.font('Helvetica-Bold').fontSize(9).fillColor(navyColor).text(row[2], 300, yPos, { width: 90 });
    doc.font('Helvetica').fontSize(9).fillColor(charcoalColor).text(row[3], 395, yPos, { width: 155 });
    yPos += 16;
  }

  yPos += 5;
  doc.font('Helvetica-Bold').fontSize(10).fillColor(navyColor).text('Case Summary & Incident Narrative:', 45, yPos);
  yPos += 14;
  doc.font('Helvetica').fontSize(9).fillColor(charcoalColor).text(caseDoc.caseDescription, 45, yPos, { width: 505, align: 'justify' });
  yPos += Math.min(60, doc.heightOfString(caseDoc.caseDescription, { width: 505 }) + 8);

  if (caseDoc.preliminaryFindings) {
    doc.font('Helvetica-Bold').fontSize(9).fillColor(navyColor).text('Preliminary Findings: ', 45, yPos, { continued: true });
    doc.font('Helvetica').fontSize(9).fillColor(charcoalColor).text(caseDoc.preliminaryFindings);
    yPos += 18;
  }

  if (caseDoc.knownObjects) {
    doc.font('Helvetica-Bold').fontSize(9).fillColor(navyColor).text('Known Objects / Context Targets: ', 45, yPos, { continued: true });
    doc.font('Helvetica').fontSize(9).fillColor(charcoalColor).text(caseDoc.knownObjects);
    yPos += 18;
  }

  // 4. CRIME-SCENE IMAGES & EVIDENCE METADATA
  doc.addPage();
  doc.fillColor(navyColor).font('Helvetica-Bold').fontSize(12).text('3. CRIME-SCENE DIGITAL EVIDENCE & HASH INTEGRITY', 45, 45);
  doc.moveTo(45, 62).lineTo(550, 62).strokeColor(borderGrey).stroke();

  let evY = 75;
  if (evidenceList.length === 0) {
    doc.font('Helvetica').fontSize(10).fillColor(mutedColor).text('No digital crime-scene photographs or evidence files registered.', 45, evY);
    evY += 30;
  } else {
    for (let i = 0; i < evidenceList.length; i++) {
      const ev = evidenceList[i];
      if (evY > 650) {
        doc.addPage();
        evY = 45;
      }

      doc.rect(45, evY, 505, 20).fill('#e9ecef');
      doc.font('Helvetica-Bold').fontSize(9).fillColor(navyColor)
        .text(`Evidence Item ${i + 1}: ${ev.evidenceIdentifier} - ${ev.originalFilename}`, 52, evY + 5);
      evY += 26;

      // Evidence details table
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(navyColor).text('MIME Type / Size:', 45, evY);
      doc.font('Helvetica').fillColor(charcoalColor).text(`${ev.fileMimeType} (${(ev.fileSize / 1024).toFixed(1)} KB)`, 140, evY);
      doc.font('Helvetica-Bold').fillColor(navyColor).text('Resolution:', 310, evY);
      doc.font('Helvetica').fillColor(charcoalColor).text(`${ev.imageProperties?.width || 0} x ${ev.imageProperties?.height || 0} px`, 380, evY);
      evY += 14;

      doc.font('Helvetica-Bold').fillColor(navyColor).text('Upload Timestamp:', 45, evY);
      doc.font('Helvetica').fillColor(charcoalColor).text(timestampService.formatTimestamp(ev.uploadTimestamp), 140, evY);
      doc.font('Helvetica-Bold').fillColor(navyColor).text('Uploaded By:', 310, evY);
      doc.font('Helvetica').fillColor(charcoalColor).text(ev.uploaderName, 380, evY);
      evY += 14;

      doc.font('Helvetica-Bold').fillColor(navyColor).text('SHA-256 Digest:', 45, evY);
      doc.font('Courier').fontSize(8).fillColor(charcoalColor).text(ev.sha256Hash, 140, evY);
      evY += 15;

      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(navyColor).text('EXIF Metadata:', 45, evY);
      doc.font('Helvetica').fillColor(charcoalColor).text(ev.availableMetadata?.rawExifSummary || 'No EXIF metadata available.', 140, evY, { width: 400 });
      evY += 18;

      // Embed evidence image if exists
      if (ev.protectedStoragePath && fs.existsSync(ev.protectedStoragePath)) {
        try {
          if (evY > 580) {
            doc.addPage();
            evY = 45;
          }
          doc.image(ev.protectedStoragePath, 45, evY, { width: 220, height: 140, fit: [220, 140] });
          evY += 150;
        } catch (imgErr) {
          evY += 10;
        }
      }
      evY += 15;
    }
  }

  // 5. AI INSPECTION RESULTS SECTION
  doc.addPage();
  doc.fillColor(navyColor).font('Helvetica-Bold').fontSize(12).text('4. AI OBJECT DETECTION & COMPUTER VISION INSPECTION', 45, 45);
  doc.moveTo(45, 62).lineTo(550, 62).strokeColor(borderGrey).stroke();

  let aiY = 75;
  if (inspections.length === 0) {
    doc.font('Helvetica').fontSize(10).fillColor(mutedColor)
      .text('No AI image inspections have been conducted on this case.', 45, aiY);
    aiY += 30;
  } else {
    for (const insp of inspections) {
      if (aiY > 600) {
        doc.addPage();
        aiY = 45;
      }

      doc.rect(45, aiY, 505, 20).fill('#e2eafc');
      doc.font('Helvetica-Bold').fontSize(9).fillColor(navyColor)
        .text(`Inspection for: ${insp.evidenceIdentifier} (${insp.modelName} ${insp.modelVersion})`, 52, aiY + 5);
      aiY += 26;

      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(navyColor).text('Status:', 45, aiY);
      doc.font('Helvetica').fillColor(charcoalColor).text(`${insp.inspectionStatus} (Threshold: ${(insp.confidenceThreshold * 100).toFixed(0)}%)`, 130, aiY);
      doc.font('Helvetica-Bold').fillColor(navyColor).text('Inspected At:', 310, aiY);
      doc.font('Helvetica').fillColor(charcoalColor).text(timestampService.formatTimestamp(insp.inspectionTimestamp), 390, aiY);
      aiY += 14;

      doc.font('Helvetica-Bold').fillColor(navyColor).text('Context Terms:', 45, aiY);
      doc.font('Helvetica').fillColor(charcoalColor).text(insp.extractedSearchTerms?.join(', ') || 'None identified', 130, aiY);
      aiY += 14;

      doc.font('Helvetica-Bold').fillColor(navyColor).text('Summary:', 45, aiY);
      doc.font('Helvetica').fillColor(charcoalColor).text(insp.summaryMessage || 'Inspection complete.', 130, aiY, { width: 410 });
      aiY += 20;

      // Detections list
      if (insp.detections && insp.detections.length > 0) {
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(navyColor).text('Detected Objects:');
        aiY += 12;
        for (const det of insp.detections) {
          const matchNote = det.isContextMatch ? ' [CONTEXT MATCH]' : '';
          doc.font('Helvetica').fontSize(8).fillColor(charcoalColor)
            .text(`• ${det.label} - Confidence: ${(det.confidence * 100).toFixed(1)}%${matchNote} (Box: x=${det.boundingBox.x}%, y=${det.boundingBox.y}%, w=${det.boundingBox.width}%, h=${det.boundingBox.height}%)`, 55, aiY);
          aiY += 12;
        }
      }

      // Embed annotated image if available
      if (insp.annotatedImageReference && fs.existsSync(insp.annotatedImageReference)) {
        try {
          if (aiY > 580) {
            doc.addPage();
            aiY = 45;
          }
          doc.image(insp.annotatedImageReference, 45, aiY, { width: 240, height: 150, fit: [240, 150] });
          aiY += 160;
        } catch (aiImgErr) {
          aiY += 10;
        }
      }

      // Legal disclaimer box
      doc.rect(45, aiY, 505, 34).strokeColor('#e0a800').stroke();
      doc.font('Helvetica-Oblique').fontSize(7.5).fillColor('#664d03')
        .text('FORENSIC DISCLAIMER: AI detections are computer vision predictions intended for preliminary investigative assistance only. They do not constitute conclusive forensic proof that an object was used in the commission of a crime, nor does non-detection prove an object is absent.', 52, aiY + 6, { width: 490 });
      aiY += 46;
    }
  }

  // 6. CHAIN OF CUSTODY SECTION
  doc.addPage();
  doc.fillColor(navyColor).font('Helvetica-Bold').fontSize(12).text('5. CHRONOLOGICAL CHAIN OF CUSTODY AUDIT LOG', 45, 45);
  doc.moveTo(45, 62).lineTo(550, 62).strokeColor(borderGrey).stroke();

  let custY = 75;
  if (custodyHistory.length === 0) {
    doc.font('Helvetica').fontSize(10).fillColor(mutedColor).text('No custody events or transfers recorded.', 45, custY);
  } else {
    for (const cust of custodyHistory) {
      if (custY > 680) {
        doc.addPage();
        custY = 45;
      }
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(navyColor).text(`[${cust.eventId}] ${cust.action}`, 45, custY);
      doc.font('Helvetica').fontSize(8).fillColor(mutedColor).text(timestampService.formatTimestamp(cust.eventTimestamp), 350, custY, { align: 'right', width: 195 });
      custY += 13;

      doc.font('Helvetica').fontSize(8).fillColor(charcoalColor)
        .text(`Actor: ${cust.actorName} | Transferor: ${cust.transferorName || 'N/A'} -> Recipient: ${cust.recipientName || 'N/A'} | Status: ${cust.status}`, 55, custY);
      custY += 12;

      doc.font('Helvetica-Oblique').fontSize(8).fillColor(mutedColor)
        .text(`Reason: ${cust.reason}${cust.notes ? ' | Notes: ' + cust.notes : ''}`, 55, custY, { width: 490 });
      custY += 18;
    }
  }

  // 7. FOOTER & PAGE NUMBERING ON ALL PAGES
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc.moveTo(45, 770).lineTo(550, 770).strokeColor(borderGrey).stroke();
    doc.font('Helvetica').fontSize(7.5).fillColor(mutedColor)
      .text(`Smart Investigation Workspace | Case: ${caseDoc.caseNumber} | Generated: ${genDateStr}`, 45, 776, { align: 'left', width: 350 });
    doc.text(`Page ${i + 1} of ${range.count}`, 400, 776, { align: 'right', width: 150 });
    doc.font('Helvetica-Oblique').fontSize(6.5).fillColor('#777777')
      .text('Confidential Official Record. Generated automatically from application records; does not independently establish judicial admissibility.', 45, 788, { align: 'center', width: 505 });
  }

  doc.end();

  await new Promise((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });

  // Calculate SHA-256 of the generated PDF
  const pdfSha256 = await hashService.calculateFileHash(pdfPath);
  const stats = fs.statSync(pdfPath);

  // Save report document in MongoDB
  const reportDoc = await Report.create({
    reportIdentifier: reportId,
    caseId: caseDoc._id,
    caseNumber: caseDoc.caseNumber,
    generatedBy: investigator._id,
    generatorName: investigator.fullName,
    generatorEmail: investigator.email,
    protectedFileReference: pdfPath,
    fileSize: stats.size,
    pdfSha256Hash: pdfSha256,
    generationTimestamp: new Date()
  });

  // Audit event
  await AuditLog.create({
    actor: investigator._id,
    actorName: investigator.fullName,
    action: 'REPORT_GENERATED',
    relatedCase: caseDoc._id,
    caseNumber: caseDoc.caseNumber,
    changeSummary: `PDF Investigation Report ${reportId} generated. SHA-256: ${pdfSha256.substring(0, 16)}...`,
    timestamp: new Date()
  });

  return reportDoc;
}

module.exports = {
  generateCaseReport
};
