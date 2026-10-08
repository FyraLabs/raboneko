import { Buffer } from "node:buffer";
import { createHmac, timingSafeEqual } from "node:crypto";
import type * as http from "http";
import { client as db } from "../prisma.ts";

const defaultOrganizations = [
  "fyralabs",
  "fyrastack",
  "ultramarine-linux",
  "terrapkg",
];

const supportedWebhookEvents = new Set([
  "push",
  "pull_request",
  "pull_request_review",
  "pull_request_review_comment",
  "issues",
  "issue_comment",
  "commit_comment",
  "create",
  "release",
]);

export const getConfiguredGitHubOrganizations = (): Set<string> => {
  const configured = process.env.GITHUB_ORGANIZATIONS?.trim();
  const organizations = configured
    ? configured.split(",")
    : defaultOrganizations;
  const normalized = organizations
    .map((organization) => organization.trim().toLowerCase())
    .filter(Boolean);
  return new Set(normalized.length > 0 ? normalized : defaultOrganizations);
};

export const handleGitHubWebhook = async (
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> => {
  try {
    const secret = process.env.GITHUB_WEBHOOK_SECRET;
    if (!secret) {
      res.writeHead(503).end("GitHub webhook is not configured");
      return;
    }
    if (req.method !== "POST") {
      res.writeHead(405).end("Method not allowed");
      return;
    }

    const chunks: Uint8Array[] = [];
    let bodySize = 0;
    for await (const chunk of req) {
      const bytes = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
      bodySize += bytes.length;
      if (bodySize > 10 * 1024 * 1024) {
        res.writeHead(413).end("Payload too large");
        return;
      }
      chunks.push(bytes);
    }
    const body = Buffer.concat(chunks);
    const signatureHeader = req.headers["x-hub-signature-256"];
    const signature = Array.isArray(signatureHeader)
      ? signatureHeader[0]
      : signatureHeader;
    if (!signature?.startsWith("sha256=")) {
      res.writeHead(401).end("Missing signature");
      return;
    }

    const expected = createHmac("sha256", secret).update(body).digest();
    const received = Buffer.from(signature.slice("sha256=".length), "hex");
    if (
      received.length !== expected.length ||
      !timingSafeEqual(received, expected)
    ) {
      res.writeHead(401).end("Invalid signature");
      return;
    }

    const eventHeader = req.headers["x-github-event"];
    const deliveryHeader = req.headers["x-github-delivery"];
    const eventType = Array.isArray(eventHeader) ? eventHeader[0] : eventHeader;
    const deliveryID = Array.isArray(deliveryHeader)
      ? deliveryHeader[0]
      : deliveryHeader;
    if (!eventType || !deliveryID) {
      res.writeHead(400).end("Missing GitHub event headers");
      return;
    }
    if (!supportedWebhookEvents.has(eventType)) {
      res.writeHead(202).end("Event ignored");
      return;
    }

    const payload = JSON.parse(body.toString("utf8")) as {
      repository?: { full_name?: string };
      sender?: { login?: string };
    };
    const repository = payload.repository?.full_name;
    const username = payload.sender?.login;
    const organization = repository?.split("/")[0]?.toLowerCase();
    if (
      !repository ||
      !username ||
      !getConfiguredGitHubOrganizations().has(organization ?? "")
    ) {
      res.writeHead(202).end("Event ignored");
      return;
    }

    await db.githubContribution.upsert({
      where: { deliveryID },
      create: {
        deliveryID,
        githubUsername: username.toLowerCase(),
        repository,
        eventType,
        occurredAt: new Date(),
      },
      update: {},
    });
    res.writeHead(202).end("Contribution recorded");
  } catch (error) {
    console.error("Failed to process GitHub webhook:", error);
    if (!res.headersSent) {
      res.writeHead(500).end("Failed to process webhook");
    }
  }
};
