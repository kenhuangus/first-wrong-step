import { defineConfig, devices } from "@playwright/test";
import { join } from "node:path";
import {
  E2E_EVIDENCE_BATCH_ENV,
  E2E_EVIDENCE_RESERVATION_ENV,
  E2E_EVIDENCE_ROOT_ENV,
  E2E_EVIDENCE_TASK_ENV,
  initializeE2eEvidenceRoot,
  verifyE2eEvidenceRootReservation,
  type EvidenceAssignment,
} from "./e2e/evidence-root";

const assignedBatch = process.env[E2E_EVIDENCE_BATCH_ENV];
const assignedTask = process.env[E2E_EVIDENCE_TASK_ENV];
const assignment: EvidenceAssignment | undefined =
  assignedBatch !== undefined && assignedTask !== undefined
    ? { batchId: assignedBatch, taskId: assignedTask }
    : undefined;
const inheritedReservation = process.env[E2E_EVIDENCE_RESERVATION_ENV];
let evidenceRoot: string;
if (inheritedReservation === undefined) {
  const reservation = initializeE2eEvidenceRoot(
    process.cwd(),
    process.env,
    assignment,
  );
  evidenceRoot = reservation.root;
  process.env[E2E_EVIDENCE_ROOT_ENV] = reservation.root;
  process.env[E2E_EVIDENCE_RESERVATION_ENV] = reservation.token;
} else {
  evidenceRoot = verifyE2eEvidenceRootReservation(
    process.cwd(),
    process.env[E2E_EVIDENCE_ROOT_ENV] ?? "",
    inheritedReservation,
    assignment,
  );
}

export default defineConfig({
  testDir: "./e2e",
  outputDir: join(evidenceRoot, "playwright", "test-results"),
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ["list"],
    [
      "html",
      {
        outputFolder: join(evidenceRoot, "playwright", "report"),
        open: "never",
      },
    ],
  ],
  use: {
    baseURL: "http://127.0.0.1:8080",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run start",
    url: "http://127.0.0.1:8080/healthz",
    reuseExistingServer: false,
    timeout: 30_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
