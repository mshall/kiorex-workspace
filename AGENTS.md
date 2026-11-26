# Agents: start here

This workspace is the Kiorex and Kiorly ecosystem. Before doing anything, read in this order:

1. `_docs/LLM_HANDOFF.md` : full handoff (what exists, hard rules, repos and branches, state, open decisions, deployment facts, how to continue).
2. `CLAUDE.md` : permanent rules and condensed brief.
3. `_docs/LAUNCH_PREPARATION_GUIDE.md` : what is still open before launch.

Non-negotiables: no deploys or AWS access, `[skip ci]` on any push to Clinic `main`, never touch ports 3000/5173/5175 or the founder's checkout `kiorly-clinics-management`, mock providers by default, never invent prices or legal wording, no tax-authority integration, private DBs and ports for tests.
- Starter prompt for a new agent: `_docs/AGENT_ONBOARDING_PROMPT.md`.
- Environments, domains and URLs (27 Nov 2026, ADR-059 Proposed): canonical host list `_docs/registry/service-url-registry.yaml` (run `node _docs/registry/validate-registry.mjs`); docs in `_docs/environments/`. Never type a host into code; do not touch DNS, certificates or AWS without the founder.
