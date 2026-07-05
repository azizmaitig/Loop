import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';

export interface InitResult {
  created: string[];
  warnings: string[];
}

const STATE_MD_TEMPLATE = `---
last_run: never
active_children: 0
high_priority: 0
watch_items: 0
---

# Loop State

<!-- Human-editable body. Daemon only touches frontmatter above. -->

## High Priority

(none)

## Watch Items

(none)

`;

const LOOP_MD_TEMPLATE = `# Loop Configuration

## Level

- **L1** — report-only (default)
- Safety denylist: \`.env\`, \`auth/\`, \`payments/\`, \`secrets/\`, \`credentials/\`
- Max 3 fix attempts per item, then escalate
- Human approval required before any L2+ edit

## Conventions

- Read \`STATE.md\` before triage
- Update \`STATE.md\` after every loop run
- Use git worktree for code-changing attempts
- Run tests before proposing a fix
`;

const AGENTS_MD_TEMPLATE = `# AGENTS.md — Loop Mode Rules

## Loop Mode

- Start in L1 report-only mode.
- Read \`STATE.md\` before any triage.
- Update \`STATE.md\` after every loop run.
- Do not edit source code until the human explicitly enables L2.

## Safety

- Never push or merge without human approval.
- Never edit \`.env\`, \`.env.*\`, \`auth/\`, \`payments/\`, \`secrets/\`, or \`credentials/\`.
- Use a git worktree for every code-changing attempt.
- Max 3 fix attempts per item; escalate after that.

## Verification

- For L2+ changes, dispatch a verifier sub-agent after implementation.
- Run the project's documented tests before proposing a fix.
- Record test evidence in \`STATE.md\`.
`;

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Scaffold loop-engineering convention files (STATE.md, LOOP.md, AGENTS.md)
 * into the given directory. Skips existing files unless `force` is true.
 */
export async function initProject(
  dir: string,
  opts?: { force?: boolean },
): Promise<InitResult> {
  const result: InitResult = { created: [], warnings: [] };
  const force = opts?.force ?? false;

  await mkdir(dir, { recursive: true });

  const files: { name: string; content: string }[] = [
    { name: 'STATE.md', content: STATE_MD_TEMPLATE },
    { name: 'LOOP.md', content: LOOP_MD_TEMPLATE },
    { name: 'AGENTS.md', content: AGENTS_MD_TEMPLATE },
  ];

  for (const file of files) {
    const filePath = join(dir, file.name);
    const exists = await fileExists(filePath);

    if (exists && !force) {
      result.warnings.push(`${file.name} already exists — skipped (use --force to overwrite)`);
      continue;
    }

    await writeFile(filePath, file.content, 'utf-8');
    result.created.push(file.name);
  }

  return result;
}
