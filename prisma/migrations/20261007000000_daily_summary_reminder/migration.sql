CREATE TABLE "StaffDailyReminder" (
    "userID" TEXT NOT NULL,
    "githubUsername" TEXT,
    "optedIn" BOOLEAN NOT NULL DEFAULT false,
    "time" TEXT NOT NULL DEFAULT '17:00',
    "timezone" TEXT NOT NULL DEFAULT 'America/Chicago',
    "lastSentDate" TEXT,
    "lastGithubCheckAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffDailyReminder_pkey" PRIMARY KEY ("userID")
);

CREATE UNIQUE INDEX "StaffDailyReminder_githubUsername_key" ON "StaffDailyReminder"("githubUsername");

CREATE TABLE "GithubContribution" (
    "deliveryID" TEXT NOT NULL,
    "githubUsername" TEXT NOT NULL,
    "repository" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GithubContribution_pkey" PRIMARY KEY ("deliveryID")
);

CREATE INDEX "GithubContribution_githubUsername_occurredAt_idx" ON "GithubContribution"("githubUsername", "occurredAt");
CREATE INDEX "GithubContribution_occurredAt_idx" ON "GithubContribution"("occurredAt");
