<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# RumahBudget Agent Instructions

Follow the shared standard:
- `C:\Users\Lenovo\Desktop\Project Kanzan\AI_AGENT_STANDARD.md`
- `C:\Users\Lenovo\Desktop\Project Kanzan\AGENTS.md`
- Operator OS at `C:\Users\Lenovo\Documents\Codex\2026-06-03\i-just-installed-codex-and-want`

## Project Role

RumahBudget is the first portfolio priority for job-search readiness.

## Rules For This Project

- Inspect actual files before making recommendations or edits.
- Follow the Next.js warning above before writing code.
- Treat `.env`, financial data, account details, API keys, tokens, and private configs as sensitive.
- Do not expose real financial data in docs, demos, prompts, screenshots, or memory.
- Prefer dummy-data demos and safe portfolio packaging.
- Keep changes small and reversible.
- Do not modify unrelated files.
- Do not claim lint, build, tests, or manual checks passed unless actually run.

## Default Next Step

If the user asks to continue this project, first inspect repo state, then choose one portfolio-readiness slice: local run, lint/build, dummy-data demo, README/case study audit, or secret exposure review.

## Usage Efficiency Rules

- Start by reading only the files needed for the current request.
- Use targeted file listing and `rg` before opening large files.
- Do not scan the whole repo unless the task requires it.
- Keep the active task to one small slice.
- Summarize findings instead of pasting long file contents.
- Ask before running expensive commands, installs, builds, deployments, broad recursive scans, or long-running local servers.
- Do not re-read unchanged files unless needed for correctness.
- When context gets large, write a compact checkpoint or handoff instead of continuing broad exploration.
- Prefer existing workflows, project docs, and current files over re-explaining the whole project.
- Final reports should be concise and include verification labels when work was performed.
