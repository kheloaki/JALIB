import { cronJobs } from "convex/server";

import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "alert push digest",
  { hours: 6 },
  internal.pushAlertDigest.runAlertPushDigest,
  {},
);

// 03:00 Africa/Casablanca (UTC+1)
crons.cron(
  "daily data backup email",
  "0 2 * * *",
  internal.dataBackup.runDailyBackup,
  {},
);

export default crons;
