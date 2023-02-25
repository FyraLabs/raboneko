import { Queue, Worker } from "bullmq";
import { generateFinalReport } from "./commands/progress.js";
import { getRedisConnection } from "./util.js";

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
        pattern: "10 0 * * 1",
        utc: true,
      },
    }
  );
})();
