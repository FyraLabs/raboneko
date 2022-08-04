import { Queue, QueueScheduler, Worker } from "bullmq";
import { generateFinalReport } from "./commands/progress";
import { getRedisConnection } from "./util";

const reportQueueScheduler = new QueueScheduler("report");
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
