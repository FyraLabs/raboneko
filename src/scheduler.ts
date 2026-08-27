import { Queue, Worker } from "bullmq";
import { generateFinalReport } from "./commands/progress.ts";
import { getRedisConnection } from "./util.ts";
import { handleReminderEvent } from "./commands/remind.ts";
import { handleRecordingEvent } from "./commands/record.ts";
import { logger } from "./logger.ts";

const queueErrorHandler = (name: string) => (error: Error) =>
  logger.error(`Queue ${name} error:`, error);

const workerErrorHandler = (name: string) => (error: Error) =>
  logger.error(`Worker ${name} error:`, error);

const reportQueue = new Queue("report", {
  connection: getRedisConnection(),
});
reportQueue.on("error", queueErrorHandler("report"));

export const reminderQueue = new Queue("reminder", {
  connection: getRedisConnection(),
});
reportQueue.on("error", queueErrorHandler("reminder"));

export const recordingQueue = new Queue("recording", {
  connection: getRedisConnection(),
});
reportQueue.on("error", queueErrorHandler("recording"));

const reportWorker = new Worker(
  "report",
  async (job) => {
    if (job.name === "generateFinalReport") {
      await generateFinalReport();
    }
  },
  {
    connection: getRedisConnection(),
  },
);
reportWorker.on("error", workerErrorHandler("report"));

const reminderWorker = new Worker(
  "reminder",
  async (job) => {
    if (job.name === "reminder") {
      await handleReminderEvent(job.data.id);
    }
  },
  {
    connection: getRedisConnection(),
  },
);
reminderWorker.on("error", workerErrorHandler("reminder"));

const recordingWorker = new Worker(
  "recording",
  async (job) => {
    if (job.name === "recording") {
      await handleRecordingEvent(job.data.id);
    }
  },
  {
    connection: getRedisConnection(),
  },
);
recordingWorker.on("failed", (job, err) => console.log(job, err));
recordingWorker.on("error", workerErrorHandler("recording"));

(async () => {
  await reportQueue.add(
    "generateFinalReport",
    {},
    {
      repeat: {
        pattern: "10 0 * * 1",
        utc: true,
      },
    },
  );
})();
