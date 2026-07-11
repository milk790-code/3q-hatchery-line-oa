---
name: skill-adoption
description: Use when evaluating, importing, updating, or routing an open-source agent skill for the 3Q Growth Loop knowledge base. Requires provenance, license review, security scan, least-privilege placement, and a workflow trigger before installation.
---

# Skill Adoption

Use this skill as the intake gate for any skill discovered outside the existing trusted skill set.

## Required sequence

1. Read `skills/skill-registry.json` and identify an existing skill that already covers the task. Do not add a duplicate by default.
2. Record the canonical repository URL, exact source commit, upstream path, license, and intended local path.
3. Run the installed `skill-scanner` against the candidate directory. If the scanner cannot run, record the dependency failure and perform manual review of frontmatter, scripts, hooks, network calls, secrets, and config writes.
4. Reject or quarantine candidates with unexplained external writes, credential reads, remote instruction loading, lifecycle hooks, or unclear licensing.
5. Define the trigger and the workflow position. A skill is not adopted merely because it is popular; it must have one clear entry condition and one measurable output.
6. Install only the smallest skill directory needed, preserve its license, update the registry, and run a smoke check that the skill is discoverable.

## Routing rule

Use domain skills for domain decisions (`cloudflare`, `browser`, `shopee-auto-optimizer`, writing voice, etc.). Use the open-source engineering skills only as the lifecycle wrapper:

`brainstorming → writing-plans → using-git-worktrees → test-driven-development → systematic-debugging (only on failure) → verification-before-completion → requesting-code-review → receiving-code-review (when feedback exists) → fresh verification → finishing-a-development-branch`.

`gogogogo` and `autopilot-mission` may accelerate reversible local work after the plan, but cannot skip tests, review, or human gates. Production deploys, merge-to-main, public links, formal posts, payments, customer-data actions, and deletion remain outside automatic adoption.

## Evidence required for completion

Return the candidate source/commit, license, scanner result, installed path, trigger, downstream workflow step, and rollback/removal path. If any field is missing, leave the candidate in `pending_review` rather than installing it.
