import { Queue, Worker } from "bullmq";
import { generateFinalReport } from "./commands/progress.ts";
import { getRedisConnection } from "./util.ts";
import { handleReminderEvent } from "./commands/remind.ts";
import { processProgressReminders } from "./modules/progressReminders.ts";

const reportQueue = new Queue("report", {
  connection: getRedisConnection(),
});

export const reminderQueue = new Queue("reminder", {
  connection: getRedisConnection(),
});

const dailySummaryQueue = new Queue("daily-summary", {
  connection: getRedisConnection(),
});

const _report = new Worker(
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

const _reminder = new Worker(
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

const _dailySummary = new Worker(
  "daily-summary",
  async (job) => {
    if (job.name === "dailySummary") {
      await processProgressReminders();
    }
  },
  {
    connection: getRedisConnection(),
  },
);

await dailySummaryQueue.upsertJobScheduler(
  "dailySummary",
  { pattern: "* * * * *", tz: "UTC" },
  { name: "dailySummary" },
);

await reportQueue.upsertJobScheduler(
  "generateFinalReport",
  {
    pattern: "10 0 * * 1",
    tz: "UTC",
  },
  {
    name: "generateFinalReport",
  },
);
