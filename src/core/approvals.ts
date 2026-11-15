import { mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { DATA_DIR } from "./config.js";

/**
 * Every change an agent wants to make to a live account or website goes
 * through this queue. Agents can only *propose*; a human approves; only then
 * does an executor run. This is the safety boundary of the whole product.
 */
export type ApprovalStatus = "pending" | "approved" | "rejected" | "applied" | "failed";

export interface ProposedChange {
  id: string;
  client: string;
  agent: string;
  /** Machine-readable action, e.g. "google_ads.pause_campaign". Must exist in an executor registry. */
  action: string;
  /** Arguments the executor needs. */
  params: Record<string, unknown>;
  /** Human-readable: what it is now, what changes, why, expected effect, how to undo. */
  summary: string;
  currentState: string;
  expectedEffect: string;
  rollback: string;
  evidence: string;
  risk: "low" | "medium" | "high";
  status: ApprovalStatus;
  createdAt: string;
  decidedAt?: string;
  decidedBy?: string;
  result?: string;
}

const DIR = path.join(DATA_DIR, "approvals");

function file(id: string) {
  return path.join(DIR, `${id}.json`);
}

export function propose(
  change: Omit<ProposedChange, "id" | "status" | "createdAt">,
): ProposedChange {
  mkdirSync(DIR, { recursive: true });
  const full: ProposedChange = {
    ...change,
    id: randomUUID().slice(0, 8),
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  writeFileSync(file(full.id), JSON.stringify(full, null, 2));
  return full;
}

export function getChange(id: string): ProposedChange {
  if (!existsSync(file(id))) throw new Error(`No proposed change with id ${id}`);
  return JSON.parse(readFileSync(file(id), "utf8"));
}

export function saveChange(change: ProposedChange) {
  writeFileSync(file(change.id), JSON.stringify(change, null, 2));
}

export function listChanges(filter: { client?: string; status?: ApprovalStatus } = {}): ProposedChange[] {
  if (!existsSync(DIR)) return [];
  return readdirSync(DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(path.join(DIR, f), "utf8")) as ProposedChange)
    .filter((c) => (!filter.client || c.client === filter.client) && (!filter.status || c.status === filter.status))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
