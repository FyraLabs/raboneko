import { Queue, QueueScheduler, Worker } from "bullmq";
import { generateFinalReport } from "./commands/progress.js";
import { getRedisConnection } from "./util.js";

const reportQueueScheduler = new QueueScheduler("report", {
  connection: getRedisConnection(),
});
const reportQueue = new Queue("report", {
  connection: getRedisConnection(),
});
const reportWorker = new Worker(
  "report",
  async (job) => {
    if (job.name === "generateFinalReport") {
      await generateFinalReport();
    }
  },
  {
    connection: getRedisConnection(),
  }
);

(async () => {
  await reportQueue.add(
    "generateFinalReport",
    {},
    {
      repeat: {
        cron: "0 0 * * 0",
        utc: true,
      },
    }
  );
})();
