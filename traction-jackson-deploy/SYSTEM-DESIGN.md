# TractionJackson System Design

**Version:** 1.0
**Purpose:** MVP Traction Bot for pre-PMF validation

---

## Philosophy

TractionJackson exists to answer one question quickly and cheaply:

> "Do the right users stop scrolling, engage, and give real contact info for this promise?"

**Core Principles:**
- Treat traction like engineering, not marketing
- Optimize for validated learning per dollar
- No over-polish, no fake social proof
- Let behavior decide if the product is good

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      TRACTIONJACKSON                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │  EXPERIMENT  │  │   CREATIVE   │  │   CAMPAIGN   │         │
│  │  DEFINITION  │──│  GENERATION  │──│  ORCHESTRATION│         │
│  │   ENGINE     │  │    ENGINE    │  │    LAYER     │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│         │                                    │                 │
│         │         ┌──────────────┐          │                 │
│         │         │   FUNNEL &   │          │                 │
│         └────────▶│   SIGNAL     │◀─────────┘                 │
│                   │   TRACKER    │                            │
│                   └──────────────┘                            │
│                          │                                    │
│                   ┌──────────────┐                            │
│                   │   DECISION   │                            │
│                   │    ENGINE    │                            │
│                   └──────────────┘                            │
│                                                               │
└───────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  PLATFORMS       │
                    │  • TikTok Ads    │
                    │  • Meta Ads      │
                    │  (Manual v1)     │
                    └──────────────────┘
```

---

## Component Specifications

### 1. Experiment Definition Engine

**Input:**
```javascript
{
  product: "SlotFillr.ai",
  icp: "Appointment-based businesses",
  corePromise: "Automatically fill empty appointment slots",
  cta: "Join the private beta",
  landingPage: "slotfillr.ai",
  budget: { daily: 50, total: 500, cpaTarget: 15 },
  hypotheses: [
    { name: "Pain Framing", description: "..." },
    { name: "Automation", description: "..." }
  ]
}
```

**Output:**
- Structured experiment definition
- Hypothesis list with clear distinctions
- Success thresholds (primary + secondary metrics)
- Kill rules (when to stop)
- Iterate rules (when to adjust)

**Storage:** LocalStorage (v1) → Database (v2)

---

### 2. Creative Generation Engine

**Hook Families (Built-in):**

| Family | Intent | Example |
|--------|--------|---------|
| Pain | Feel the problem | "Your calendar has holes in it" |
| Automation | Desire for ease | "What if your calendar filled itself?" |
| Loss Aversion | Fear of losing money | "$4,200/month vanishes from med spas" |
| Social Proof | FOMO / validation | "Smart clinics don't have empty slots" |
| Curiosity | Information gap | "The real reason your slots stay empty" |

**Output per Hook:**
- Hook text (spoken/read)
- Text-on-screen copy (1-2 frames)
- Full script (hook → bridge → CTA)
- Creative notes (POV, tone, pacing)

**Constraints:**
- Hooks < 15 words
- Scripts < 50 words total
- No unverifiable claims
- Create curiosity, don't close the sale

---

### 3. Ad Orchestration Layer

**Campaign Structure:**
```
Campaign (CBO)
├── Ad Set: Pain Framing
│   ├── Ad: Pain_Hook1_v1
│   ├── Ad: Pain_Hook2_v1
│   └── Ad: Pain_Hook3_v1
├── Ad Set: Automation
│   ├── Ad: Auto_Hook1_v1
│   └── ...
└── Ad Set: Loss Aversion
    └── ...
```

**Naming Convention:**
- Campaign: `TJ_[Product]_[Date]`
- Ad Set: `[Campaign]_[HookFamily]`
- Ad: `[AdSet]_[HookVariant]_v[Version]`

**Rotation Rules:**
1. Start with 3 creatives per ad set
2. Kill creative if CPA > 2x target after $30 spend
3. Duplicate winners with variation after $50 profitable spend
4. Rotate new hooks weekly regardless of performance

**v1:** Outputs configuration specs for manual setup
**v2+:** Direct API integration with Meta/TikTok

---

### 4. Funnel & Signal Tracker

**Tracked Events:**

| Step | Event | Formula |
|------|-------|---------|
| 1 | Ad Impression | — |
| 2 | Ad Click | CTR = Clicks / Impressions |
| 3 | Page View | Landing Rate = PV / Clicks |
| 4 | AI Interaction Started | Engage Rate = AI Int / PV |
| 5 | Calculation Completed | Calc Rate = Calc / AI Int |
| 6 | Contact Submitted | Submit Rate = Conv / Calc |

**Data Model:**
```javascript
{
  experimentId: "exp_001",
  date: "2025-01-15",
  impressions: 10000,
  clicks: 120,
  pageViews: 100,
  aiInteractions: 45,
  calcCompleted: 32,
  conversions: 12,
  spend: 50.00,
  hookPerformance: {
    "Pain Framing": { clicks: 40, conversions: 2 },
    "Automation": { clicks: 35, conversions: 3 },
    "Loss Aversion": { clicks: 45, conversions: 7 }
  }
}
```

**Integration Points (v2+):**
- Meta Ads API for spend/impressions/clicks
- Google Analytics / Mixpanel for page events
- Landing page for conversion events

---

### 5. Decision Engine

**Analysis Logic:**

```
IF spend < $50:
  → "Insufficient data"

IF CPA ≤ target:
  IF CPA ≤ target × 0.7:
    → "Winner (high confidence)"
  ELSE:
    → "Winner (medium confidence)"

IF CPA > target × 2:
  → "Loser - consider killing"

ELSE:
  → "Iterate"
```

**Funnel Diagnostics:**

| Condition | Diagnosis | Recommendation |
|-----------|-----------|----------------|
| CTR < 0.5% | Hooks not resonating | Test new angles |
| AI Engage < 30% | Page not compelling | Fix above-the-fold |
| Calc Rate < 50% | Friction in flow | Simplify interaction |
| Submit < 30% | Value prop doesn't land | Strengthen CTA/reveal |

**Output:**
- Verdict (Winner / Loser / Iterate / Inconclusive)
- Confidence level
- Key learnings (what we validated/invalidated)
- Specific next steps
- Hook family leaderboard

---

## Data Flow

```
[User Input]
    → Experiment Definition
    → Creative Generation (hooks, scripts)
    → Campaign Spec (structure, naming)
    → [Manual: Run ads on TikTok/Meta]
    → [Manual: Log funnel data daily]
    → Funnel Tracker (store + visualize)
    → Decision Engine (analyze + recommend)
    → [Loop: Iterate or next experiment]
```

---

## V1 Constraints

**Supported:**
- TikTok Ads
- Instagram (Meta) Ads
- One interactive landing page
- Email + phone conversion goal
- One active product at a time

**Not Supported (Yet):**
- SEO
- LinkedIn Ads
- Google Search Ads
- Email campaigns
- Multi-product experiments

**Why:** Depth > breadth. Master two channels before expanding.

---

## Roadmap: V1 → V2

### V1 (Current)
- Manual ad management
- Manual data logging
- LocalStorage persistence
- Single-user

### V1.5 (Near-term)
- Export campaign specs to Meta Ads Manager format
- CSV import for funnel data
- Experiment history and comparison

### V2 (Future)
- Meta Ads API integration (read spend, impressions, clicks)
- TikTok Ads API integration
- Automatic daily data sync
- Multi-user support
- Database persistence (Supabase/Firebase)

### V3 (Vision)
- Creative auto-generation with AI
- Dynamic budget reallocation
- Predictive CPA modeling
- Slack/email alerts for kill rules
- Landing page A/B test integration

---

## Success Metrics (for TractionJackson itself)

TractionJackson is successful if a founder can:

1. **Spin up a real experiment in hours**, not days
2. **Learn something meaningful within 3-5 days**
3. **Avoid building the wrong thing** for weeks

The goal is validated learning velocity, not ad performance.
