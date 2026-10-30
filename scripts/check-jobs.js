const mongoose = require('mongoose');
const AnalysisJob = require('../models/AnalysisJob');

async function checkJobs() {
  await mongoose.connect('mongodb://127.0.0.1:27017/smart_investigation');
  
  // Find any failed or queued (stuck) jobs
  const failedOrQueued = await AnalysisJob.find({ status: { $in: ['Failed', 'Queued'] } }).lean();
  console.log('Failed/Queued jobs count:', failedOrQueued.length);
  failedOrQueued.forEach(j => {
    console.log({
      jobIdentifier: j.jobIdentifier,
      status: j.status,
      failureReason: j.failureReason,
      evidenceId: j.evidenceId,
      submissionTimestamp: j.submissionTimestamp
    });
  });

  // All jobs sorted newest first
  const allJobs = await AnalysisJob.find({}).sort({ submissionTimestamp: -1 }).lean();
  console.log('\nAll jobs (newest first):');
  allJobs.forEach(j => console.log({
    jobIdentifier: j.jobIdentifier,
    status: j.status,
    failureReason: j.failureReason || '(none)',
    evidenceId: j.evidenceId,
    submissionTimestamp: j.submissionTimestamp
  }));
  
  await mongoose.disconnect();
}
checkJobs();
