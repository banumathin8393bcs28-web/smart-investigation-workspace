const mongoose = require('mongoose');
const AnalysisJob = require('../models/AnalysisJob');

async function fixStuckJobs() {
  await mongoose.connect('mongodb://127.0.0.1:27017/smart_investigation');
  
  // AJOB-2026-0001 is stuck in 'Queued' - it was never executed because the server
  // was not running when it was submitted. We need to re-execute it.
  const stuckJob = await AnalysisJob.findOne({ status: 'Queued' });
  if (stuckJob) {
    console.log('Found stuck job:', stuckJob.jobIdentifier);
    
    // Try to run it now
    const { executeAnalysis } = require('../services/autopsyService');
    try {
      const result = await executeAnalysis(stuckJob._id);
      console.log('Job executed. New status:', result ? result.status : 'unknown');
    } catch (err) {
      console.error('Execution failed:', err.message);
      // Mark as Failed with reason
      await AnalysisJob.findByIdAndUpdate(stuckJob._id, {
        $set: {
          status: 'Failed',
          completedTimestamp: new Date(),
          failureReason: `Re-execution attempt failed: ${err.message}`,
          logOutput: (stuckJob.logOutput || '') + `[${new Date().toISOString()}] Re-execution failed: ${err.message}\n`
        }
      });
      console.log('Marked as Failed');
    }
  } else {
    console.log('No stuck jobs found.');
  }
  
  await mongoose.disconnect();
}

fixStuckJobs();
