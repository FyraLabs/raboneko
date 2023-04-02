import { Queue, Worker } from 'bullmq';
import { generateFinalReport } from './commands/progress';
import { getRedisConnection } from './util';

const reportQueue = new Queue('report', {
  connection: getRedisConnection()
});

new Worker(
  'report',
  async (job) => {
    if (job.name === 'generateFinalReport') {
      await generateFinalReport();
    }
  },
  {
    connection: getRedisConnection()
  }
);

(async () => {
  await reportQueue.add(
    'generateFinalReport',
    {},
    {
      repeat: {
        pattern: '*/1 * * * *',
        utc: true
      }
    }
  );
})();
