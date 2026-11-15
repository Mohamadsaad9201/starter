import "dotenv/config";
import { parseArgs } from "node:util";
import { listClients, loadClient } from "./core/config.js";
import { runAgent } from "./core/agent.js";
import { listChanges, getChange, type ApprovalStatus } from "./core/approvals.js";
import { applyChange, rejectChange } from "./core/actions.js";
import { agents, plannedAgents } from "./agents/registry.js";
import { inspectPage } from "./integrations/sites/crawler.js";

const HELP = `
Agency agents

  npm run agent -- agents                              List agents
  npm run agent -- clients                             List client configs in clients/
  npm run agent -- run <agent> --client <slug>         Run one agent for one client
  npm run agent -- run <agent> --all                   Run it for every client
        [--task "custom instruction"]                  (default: the agent's scheduled check)
  npm run agent -- approvals [--client x] [--status pending|approved|applied|rejected|failed]
  npm run agent -- show <id>                           Full detail of a queued change
  npm run agent -- approve <id> [--by "name"]          Approve and apply (if live writes are on)
  npm run agent -- reject <id> [--by "name"] [--reason "..."]
  npm run agent -- inspect <url>                       Test the page inspector (no AI call)

Set MOCK_DATA=1 to run on built-in sample data.
`.trim();

async function main() {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      client: { type: "string" },
      all: { type: "boolean" },
      task: { type: "string" },
      status: { type: "string" },
      by: { type: "string" },
      reason: { type: "string" },
    },
  });
  const [cmd, arg] = positionals;

  switch (cmd) {
    case "agents":
      for (const a of Object.values(agents)) console.log(`${a.id.padEnd(14)} ${a.name} - ${a.description}`);
      for (const a of plannedAgents) console.log(`${a.id.padEnd(14)} ${a.name} - (planned; playbooks: ${a.skills.join(", ")})`);
      return;

    case "clients":
      for (const c of listClients()) {
        console.log(`${c.slug.padEnd(20)} ${c.name}  ads: ${Object.keys(c.ads).join(",") || "-"}  sites: ${c.sites.map((s) => s.platform).join(",") || "-"}  live writes: ${c.guardrails.allowLiveWrites ? "ON" : "off"}`);
      }
      return;

    case "run": {
      const def = arg && agents[arg];
      if (!def) throw new Error(`Unknown agent "${arg}". Try: ${Object.keys(agents).join(", ")}`);
      const targets = values.all ? listClients() : values.client ? [loadClient(values.client)] : [];
      if (!targets.length) throw new Error("Pass --client <slug> or --all");
      for (const client of targets) {
        console.error(`\n== ${def.name} -> ${client.name}`);
        const res = await runAgent(def, client, values.task);
        console.log(`\n${res.report}\n`);
        console.error(`Report saved: ${res.reportPath}`);
        if (res.proposals.length) console.error(`Queued for approval: ${res.proposals.map((p) => `#${p.id}`).join(", ")}  (npm run agent -- approvals)`);
      }
      return;
    }

    case "approvals": {
      const rows = listChanges({ client: values.client, status: (values.status as ApprovalStatus) ?? "pending" });
      if (!rows.length) return console.log("Nothing here.");
      for (const c of rows) console.log(`#${c.id}  [${c.status}] ${c.client} · ${c.agent} · ${c.action} · risk ${c.risk}\n          ${c.summary}`);
      return;
    }

    case "show":
      console.log(JSON.stringify(getChange(arg), null, 2));
      return;

    case "approve": {
      const change = getChange(arg);
      const res = await applyChange(arg, loadClient(change.client), values.by ?? process.env.USER ?? "cli");
      console.log(`#${res.id} -> ${res.status}: ${res.result ?? ""}`);
      return;
    }

    case "reject": {
      const res = rejectChange(arg, values.by ?? process.env.USER ?? "cli", values.reason);
      console.log(`#${res.id} -> rejected`);
      return;
    }

    case "inspect":
      console.log(JSON.stringify(await inspectPage(arg), null, 2));
      return;

    default:
      console.log(HELP);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
