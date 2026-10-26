const Counter = require('../models/Counter');

/**
 * Concurrency-safe atomic case number generator
 * Formats: CASE001, CASE002, CASE003...
 */
async function getNextCaseNumber() {
  const counter = await Counter.findOneAndUpdate(
    { name: 'caseNumber' },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  const seq = counter.seq;
  const padded = String(seq).padStart(3, '0');
  return `CASE${padded}`;
}

/**
 * Concurrency-safe atomic evidence number generator per case
 * Formats: EVID-CASE001-001, EVID-CASE001-002...
 */
async function getNextEvidenceNumber(caseNumber) {
  const counter = await Counter.findOneAndUpdate(
    { name: `evidence_${caseNumber}` },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  const seq = counter.seq;
  const padded = String(seq).padStart(3, '0');
  return `EVID-${caseNumber}-${padded}`;
}

/**
 * Concurrency-safe atomic custody event number generator
 * Formats: CUST-0001, CUST-0002...
 */
async function getNextCustodyEventId() {
  const counter = await Counter.findOneAndUpdate(
    { name: 'custodyEvent' },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  const seq = counter.seq;
  const padded = String(seq).padStart(4, '0');
  return `CUST-${padded}`;
}

/**
 * Concurrency-safe atomic report number generator
 * Formats: REP-CASE001-001
 */
async function getNextReportNumber(caseNumber) {
  const counter = await Counter.findOneAndUpdate(
    { name: `report_${caseNumber}` },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  const seq = counter.seq;
  const padded = String(seq).padStart(3, '0');
  return `REP-${caseNumber}-${padded}`;
}

module.exports = {
  getNextCaseNumber,
  getNextEvidenceNumber,
  getNextCustodyEventId,
  getNextReportNumber
};
