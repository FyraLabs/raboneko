import { Queue, Worker } from 'bullmq';
import { generateFinalReport } from './commands/progress';
import { getRedisConnection } from './util';
import { handleReminderEvent } from './commands/remind';

const reportQueue = new Queue('report', {
  connection: getRedisConnection(),
});

export const reminderQueue = new Queue('reminder', {
  connection: getRedisConnection(),
});

const _report = new Worker(
  'report',
  async (job) => {
    if (job.name === 'generateFinalReport') {
      await generateFinalReport();
    }
  },
  {
    connection: getRedisConnection(),
  },
);

const _reminder = new Worker(
  'reminder',
  async (job) => {
    if (job.name === 'reminder') {
      handleReminderEvent(job.data.id);
    }
  },
  {
    connection: getRedisConnection(),
  },
);

(async () => {
  await reportQueue.add(
    'generateFinalReport',
    {},
    {
      repeat: {
        pattern: '10 0 * * 1',
        utc: true,
      },
    },
  );
})();
