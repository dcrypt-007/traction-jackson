# Traction Jackson Documentation

## Core Documents

| Document | Description |
|----------|-------------|
| [DOCTRINE.md](./DOCTRINE.md) | Operating philosophy and constraints for the system |
| [SETUP_CHECKLIST.md](./SETUP_CHECKLIST.md) | One-time integration setup guide for Canva, 11Labs, Meta, TikTok |

## System Design

See the main [SYSTEM-DESIGN.md](../SYSTEM-DESIGN.md) for technical architecture.

## Prompt Templates

Located in `/prompts/`:

| Template | Use Case |
|----------|----------|
| [experiment-creation.md](../prompts/experiment-creation.md) | Define new traction experiments |
| [hook-generation.md](../prompts/hook-generation.md) | Generate hook variants for video ads |
| [ad-script-generation.md](../prompts/ad-script-generation.md) | Full video scripts with timing |
| [experiment-summary.md](../prompts/experiment-summary.md) | Analyze results and get recommendations |

## Quick Reference

### Founder's Role
1. Define intent (hypotheses, budgets, tone)
2. Approve/reject creatives
3. Interpret results
4. Decide next experiment

### System's Role
1. Generate creatives
2. Assemble videos
3. Deploy campaigns
4. Collect funnel signals
5. Enforce guardrails
6. Summarize learnings

### V1 Constraints
- Video ads only
- Meta/Instagram + TikTok
- One product at a time
- Human approval required
- No auto-scaling
