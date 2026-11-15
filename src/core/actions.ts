import { z } from "zod";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { ClientConfig } from "./config.js";
import { propose, getChange, saveChange, type ProposedChange } from "./approvals.js";

/**
 * An Action is a write an agent may *propose*. The agent never calls
 * `execute` itself: it is only run by `applyChange`, after a human approves.
 */
export interface Action<P extends z.ZodType = z.ZodType> {
  name: string;
  description: string;
  params: P;
  /** Extra guardrail checks against client config (e.g. max budget change). Return an error string to block. */
  validate?: (client: ClientConfig, params: z.infer<P>) => string | undefined;
  execute: (client: ClientConfig, params: z.infer<P>) => Promise<string>;
}

const registry = new Map<string, Action>();

export function defineAction<P extends z.ZodType>(action: Action<P>): Action {
  const erased = action as unknown as Action;
  registry.set(action.name, erased);
  return erased;
}

export function getAction(name: string): Action {
  const a = registry.get(name);
  if (!a) throw new Error(`Unknown action ${name}`);
  return a;
}

/** Builds the `propose_change` tool for an agent, limited to the actions it owns. */
export function proposeChangeTool(opts: { client: ClientConfig; agent: string; actions: Action[]; proposals: ProposedChange[] }) {
  const byName = new Map(opts.actions.map((a) => [a.name, a]));
  const catalog = opts.actions
    .map((a) => `- ${a.name}: ${a.description}\n  params: ${JSON.stringify(z.toJSONSchema(a.params))}`)
    .join("\n");

  return betaZodTool({
    name: "propose_change",
    description:
      "Queue a change for human approval. Nothing is applied until a person approves it. " +
      "Only propose changes backed by data you pulled this session. Available actions:\n" +
      catalog,
    inputSchema: z.object({
      action: z.string(),
      params: z.record(z.string(), z.unknown()),
      summary: z.string().describe("One line: what to change and why"),
      currentState: z.string().describe("The current setting/value, with numbers"),
      expectedEffect: z.string().describe("What should happen, and the metric to judge it by"),
      rollback: z.string().describe("Exactly how to undo it"),
      evidence: z.string().describe("The data behind this, incl. date range and sample size"),
      risk: z.enum(["low", "medium", "high"]),
    }),
    run: async (input) => {
      const action = byName.get(input.action);
      if (!action) return `Error: unknown action "${input.action}". Use one of: ${[...byName.keys()].join(", ")}`;
      const parsed = action.params.safeParse(input.params);
      if (!parsed.success) return `Error: invalid params for ${action.name}: ${z.prettifyError(parsed.error)}`;
      const blocked = action.validate?.(opts.client, parsed.data);
      if (blocked) return `Blocked by guardrail: ${blocked}`;

      const change = propose({
        client: opts.client.slug,
        agent: opts.agent,
        action: action.name,
        params: parsed.data as Record<string, unknown>,
        summary: input.summary,
        currentState: input.currentState,
        expectedEffect: input.expectedEffect,
        rollback: input.rollback,
        evidence: input.evidence,
        risk: input.risk,
      });
      opts.proposals.push(change);
      return `Queued for approval as #${change.id}. It will not be applied until a human approves it.`;
    },
  });
}

/** Called by the CLI / dashboard after a human approves. */
export async function applyChange(id: string, client: ClientConfig, approver: string): Promise<ProposedChange> {
  const change = getChange(id);
  if (change.status !== "pending" && change.status !== "approved") {
    throw new Error(`Change #${id} is ${change.status}; only pending/approved changes can be applied.`);
  }
  change.status = "approved";
  change.decidedAt = new Date().toISOString();
  change.decidedBy = approver;

  if (!client.guardrails.allowLiveWrites) {
    change.result = "Approved, but not pushed: guardrails.allowLiveWrites is false for this client. Apply it by hand or enable live writes.";
    saveChange(change);
    return change;
  }

  const action = getAction(change.action);
  try {
    const params = action.params.parse(change.params);
    const blocked = action.validate?.(client, params);
    if (blocked) throw new Error(`Blocked by guardrail: ${blocked}`);
    change.result = await action.execute(client, params);
    change.status = "applied";
  } catch (err) {
    change.status = "failed";
    change.result = err instanceof Error ? err.message : String(err);
  }
  saveChange(change);
  return change;
}

export function rejectChange(id: string, approver: string, reason?: string): ProposedChange {
  const change = getChange(id);
  change.status = "rejected";
  change.decidedAt = new Date().toISOString();
  change.decidedBy = approver;
  change.result = reason;
  saveChange(change);
  return change;
}
