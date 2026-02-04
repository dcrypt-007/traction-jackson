# TractionJackson

**MVP Traction Bot** — Validate demand before you build.

---

## What It Does

TractionJackson is a closed-loop experimentation system that helps founders answer one question quickly and cheaply:

> "Do the right users stop scrolling, engage with my offer, and give real contact info for this promise?"

It's not a marketing tool. It's a learning machine.

---

## Quick Start

1. **Open the dashboard:** Open `index.html` in your browser
2. **Review the seed experiment:** SlotFillr.ai is pre-loaded as an example
3. **Generate creatives:** Go to Creative Engine → select hook families → generate
4. **Build campaign spec:** Go to Campaign Builder → export structure for manual setup
5. **Log daily results:** Go to Funnel Tracker → input your numbers
6. **Get recommendations:** Go to Decision Engine → analyze your data

---

## The Five Engines

| Engine | What It Does |
|--------|--------------|
| **Experiment Definition** | Structures your hypothesis, ICP, budget, and kill rules |
| **Creative Generation** | Generates hooks and scripts for TikTok/IG Reels |
| **Campaign Builder** | Outputs campaign structure specs for ad platforms |
| **Funnel Tracker** | Logs and visualizes your conversion funnel |
| **Decision Engine** | Analyzes results and recommends next steps |

---

## Philosophy

- **Learning velocity > vanity metrics**
- **Depth > breadth** (TikTok + IG only)
- **Let behavior decide** if the product is good
- **No fake social proof**, no hype, no assumptions

---

## File Structure

```
tractionjackson/
├── index.html              # Main dashboard (open this)
├── README.md               # You're here
├── SYSTEM-DESIGN.md        # Architecture documentation
└── prompts/
    ├── experiment-creation.md    # Prompt template
    ├── hook-generation.md        # Prompt template
    ├── ad-script-generation.md   # Prompt template
    └── experiment-summary.md     # Prompt template
```

---

## Prompt Templates

Use these with Claude for deeper generation:

- **Experiment Creation:** Define new experiments with hypotheses and rules
- **Hook Generation:** Generate hook variants for different framing angles
- **Ad Script Generation:** Full scripts with text-on-screen and creative notes
- **Experiment Summary:** Founder-readable analysis of your results

---

## V1 Scope

**Supported:**
- TikTok Ads
- Instagram (Meta) Ads
- One landing page per experiment
- Email + phone conversion goal

**Not supported yet:**
- SEO, LinkedIn, Google Ads
- Email campaigns
- API integrations (manual setup for now)

---

## First Use Case: SlotFillr.ai

The dashboard comes pre-loaded with a SlotFillr.ai experiment:

- **ICP:** Appointment-based businesses (med spas, salons, PT clinics)
- **Promise:** Automatically fill empty appointment slots
- **Goal:** Validate demand before building the product

Use this as a template for your own MVPs.

---

## Data Storage

All data is stored in your browser's localStorage. To export:

1. Open browser console (F12)
2. Run: `localStorage.getItem('tractionjackson_data')`
3. Copy the JSON

To reset: `localStorage.removeItem('tractionjackson_data')`

---

## Built For

Founders who want to:
- Test ideas before building
- Spend $500 to learn, not $5,000 to guess
- Treat traction like engineering

---

*"Quant desk for messaging and demand."*
