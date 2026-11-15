import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { ROOT } from "./config.js";

/**
 * Expert playbooks vendored from coreyhaines31/marketingskills (MIT, see
 * knowledge/LICENSE-marketingskills). Each agent gets its core SKILL.md in the
 * system prompt and can pull deeper reference files on demand, which is how
 * the skills are designed to be used ("load by intent").
 */
const KNOWLEDGE = path.join(ROOT, "knowledge");

function stripFrontmatter(md: string): string {
  return md.replace(/^---\n[\s\S]*?\n---\n/, "");
}

export function loadSkill(skill: string): string {
  return stripFrontmatter(readFileSync(path.join(KNOWLEDGE, skill, "SKILL.md"), "utf8"));
}

export function listReferences(skills: string[]): string[] {
  return skills.flatMap((s) => {
    const dir = path.join(KNOWLEDGE, s, "references");
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
      .filter((f) => f.endsWith(".md"))
      .map((f) => `${s}/${f}`);
  });
}

/** Tool that lets an agent read a reference file from one of its own skills. */
export function playbookTool(skills: string[]) {
  const allowed = new Set(listReferences(skills));
  return betaZodTool({
    name: "read_playbook",
    description:
      "Load a reference playbook (thresholds, checklists, decision trees) before making an operational call. " +
      `Available files:\n${[...allowed].join("\n")}`,
    inputSchema: z.object({
      file: z.string().describe('One of the listed paths, e.g. "ads/operating-check.md"'),
    }),
    run: async ({ file }) => {
      // Only the enumerated files can be read; no path traversal possible.
      if (!allowed.has(file)) return `Unknown playbook "${file}". Choose one of the listed files.`;
      const [skill, name] = file.split("/");
      // Relative links in skills point at references/<file>; keep the text intact.
      return readFileSync(path.join(KNOWLEDGE, skill, "references", name), "utf8");
    },
  });
}
