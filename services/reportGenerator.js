const PDFDocument = require('pdfkit');

class ReportGenerator {
  /**
   * Generate official PDF Case Dossier
   * @param {object} caseData 
   * @param {Array} evidenceList 
   * @param {Array} suspectsList 
   * @param {object} leadInvestigator 
   * @param {stream.Writable} outputStream 
   */
  static generateCaseReport(caseData, evidenceList = [], suspectsList = [], leadInvestigator = null, outputStream) {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    doc.pipe(outputStream);

    // Header & Confidentiality banner
    doc.rect(40, 40, 515, 25).fill('#0f172a');
    doc.fillColor('#ef4444').fontSize(11).font('Helvetica-Bold')
       .text('CONFIDENTIAL // LAW ENFORCEMENT & JUDICIAL FORENSICS ONLY', 45, 48, { align: 'center' });

    doc.moveDown(2);

    // Title Block
    doc.fillColor('#0f172a').fontSize(20).font('Helvetica-Bold')
       .text('SMART INVESTIGATION WORKSPACE');
    doc.fontSize(14).font('Helvetica')
       .text(`OFFICIAL CASE DOSSIER: ${caseData.caseNumber}`);
    doc.fontSize(10).fillColor('#64748b')
       .text(`Generated on: ${new Date().toUTCString()} | Status: ${caseData.status.toUpperCase()} | Priority: ${caseData.priority.toUpperCase()}`);

    doc.moveDown(1);
    doc.strokeColor('#cbd5e1').lineWidth(1).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown(1);

    // 1. Case Overview
    doc.fillColor('#1e293b').fontSize(14).font('Helvetica-Bold').text('1. Case Overview & Incident Summary');
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica')
       .fillColor('#334155')
       .text(`Title: ${caseData.title}`)
       .text(`Classification: ${caseData.classification}`)
       .text(`Incident Location: ${caseData.incidentLocation || 'Not specified'}`)
       .text(`Incident Date: ${caseData.incidentDate ? new Date(caseData.incidentDate).toLocaleDateString() : 'Pending'}`)
       .text(`Lead Investigator: ${leadInvestigator ? `${leadInvestigator.name} (${leadInvestigator.rank}, Badge: ${leadInvestigator.badgeId})` : 'Unassigned'}`)
       .moveDown(0.5)
       .text(`Detailed Narrative:\n${caseData.description || 'No description recorded.'}`, { lineGap: 3 });

    doc.moveDown(1);

    // 2. Suspects & Persons of Interest
    doc.fillColor('#1e293b').fontSize(14).font('Helvetica-Bold').text('2. Suspects & Persons of Interest');
    doc.moveDown(0.5);

    if (suspectsList.length === 0) {
      doc.fontSize(10).font('Helvetica-Oblique').fillColor('#64748b').text('No suspects currently registered under this case.');
    } else {
      suspectsList.forEach((s, idx) => {
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#0f172a')
           .text(`[${idx + 1}] ${s.fullName} (Alias: "${s.alias || 'None'}") - Status: ${s.status} | Risk Level: ${s.riskLevel}`);
        doc.fontSize(9).font('Helvetica').fillColor('#475569')
           .text(`National ID: ${s.nationalId || 'N/A'} | Height: ${s.physicalTraits?.height || 'N/A'} | Eye: ${s.physicalTraits?.eyeColor || 'N/A'} | Marks: ${s.physicalTraits?.identifyingMarks || 'None'}`)
           .text(`Prior Offenses: ${(s.priorOffenses || []).join(', ') || 'No prior record'}`)
           .moveDown(0.5);
      });
    }

    doc.moveDown(1);

    // 3. Digital Evidence & Cryptographic SHA-256 Baselines
    doc.fillColor('#1e293b').fontSize(14).font('Helvetica-Bold').text('3. Digital Evidence & Integrity Baselines (SHA-256)');
    doc.moveDown(0.5);

    if (evidenceList.length === 0) {
      doc.fontSize(10).font('Helvetica-Oblique').fillColor('#64748b').text('No digital media evidence recorded.');
    } else {
      evidenceList.forEach((e, idx) => {
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#0f172a')
           .text(`[${idx + 1}] ${e.evidenceNumber} - ${e.title} (${e.fileType.toUpperCase()})`);
        doc.fontSize(9).font('Courier').fillColor('#0369a1')
           .text(`SHA-256 Hash: ${e.sha256Hash}`);
        doc.fontSize(9).font('Helvetica').fillColor('#334155')
           .text(`Integrity Status: ${e.integrityStatus} | Last Verified: ${e.lastVerifiedAt ? new Date(e.lastVerifiedAt).toLocaleString() : 'N/A'}`)
           .text(`Source: ${e.sourceLocation || 'Field Collection'} | Ingested by: ${e.uploaderName || 'Investigator'}`);

        if (e.aiAnalysis && e.aiAnalysis.detections && e.aiAnalysis.detections.length > 0) {
          doc.fontSize(9).font('Helvetica-Bold').fillColor('#7c3aed')
             .text(`AI Forensic Detections (${e.aiAnalysis.detections.length}):`);
          e.aiAnalysis.detections.forEach(d => {
            doc.fontSize(8).font('Helvetica').fillColor('#475569')
               .text(`  • ${d.label} (Confidence: ${Math.round(d.confidence * 100)}%) - Review Status: ${d.investigatorStatus}`);
          });
        }
        doc.moveDown(0.5);
      });
    }

    doc.moveDown(1);

    // 4. Incident Timeline & Chain of Custody
    doc.fillColor('#1e293b').fontSize(14).font('Helvetica-Bold').text('4. Case Progression Timeline');
    doc.moveDown(0.5);

    if (!caseData.timeline || caseData.timeline.length === 0) {
      doc.fontSize(10).font('Helvetica-Oblique').fillColor('#64748b').text('No events recorded in case timeline.');
    } else {
      caseData.timeline.forEach(t => {
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#0f172a')
           .text(`${new Date(t.timestamp).toLocaleString()} - ${t.title} [${t.investigator || 'System'}]`);
        doc.fontSize(9).font('Helvetica').fillColor('#475569')
           .text(`${t.description}`, { indent: 10 })
           .moveDown(0.3);
      });
    }

    doc.moveDown(2);

    // Lead Investigator Sign-off block
    doc.strokeColor('#cbd5e1').lineWidth(1).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown(1);
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#0f172a')
       .text('FORENSIC ATTESTATION & SIGN-OFF');
    doc.fontSize(9).font('Helvetica').fillColor('#475569')
       .text('I hereby certify that all digital media, cryptographic SHA-256 hashes, suspect references, and AI-assisted detections in this dossier have been cataloged in accordance with statutory evidence handling protocols.')
       .moveDown(1);

    doc.text(`Lead Investigator Signature: _______________________      Date: ${new Date().toLocaleDateString()}`)
       .text(`Name: ${leadInvestigator ? leadInvestigator.name : 'Authorized Officer'} | Badge #: ${leadInvestigator ? leadInvestigator.badgeId : 'N/A'}`);

    doc.end();
  }
}

module.exports = ReportGenerator;
