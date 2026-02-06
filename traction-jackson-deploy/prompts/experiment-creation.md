# Experiment Creation Prompt Template

Use this prompt with Claude to define a new traction experiment.

---

## PROMPT

```
You are helping me define a traction experiment for an MVP. I need a structured experiment definition that I can use to validate demand before building.

**Product Details:**
- Product Name: [PRODUCT_NAME]
- One-line description: [DESCRIPTION]
- Landing page URL: [URL]

**Target Customer:**
- ICP (Ideal Customer Profile): [WHO ARE THEY]
- Primary pain point: [THEIR MAIN PROBLEM]
- Current solution: [HOW THEY SOLVE IT NOW]

**Value Proposition:**
- Core promise: [WHAT YOU PROMISE]
- CTA: [CALL TO ACTION, e.g., "Join the private beta"]
- Primary conversion goal: [EMAIL + PHONE / WAITLIST / DEMO BOOKING]

**Budget Constraints:**
- Daily budget: $[AMOUNT]
- Total experiment budget: $[AMOUNT]
- Target CPA: $[AMOUNT]

Based on this, create:

1. **3-5 HYPOTHESES TO TEST**
   Format: [Name]: [Description of the framing/angle to test]
   These should be distinct messaging angles that could resonate differently.

2. **SUCCESS THRESHOLDS**
   - Primary metric and target
   - Secondary signals to watch

3. **KILL RULES**
   Specific conditions that mean we should stop the experiment.

4. **ITERATE RULES**
   Conditions that mean we should adjust rather than kill.

5. **FUNNEL EVENTS TO TRACK**
   The specific user actions from ad impression to conversion.

Keep the output structured and actionable. This is a smoke test, not a marketing campaign.
```

---

## EXAMPLE OUTPUT

**Product:** SlotFillr.ai
**ICP:** Appointment-based businesses (med spas, salons, PT clinics)
**Core Promise:** Automatically fill empty appointment slots with AI

### Hypotheses to Test

1. **Pain Framing:** Lead with the pain of empty slots and lost revenue. "Your calendar has holes. I can see them from here."

2. **Automation Framing:** Lead with "AI does it for you" convenience angle. "What if your calendar filled itself?"

3. **Loss Aversion:** Lead with specific dollar amounts being lost. "$4,200/month vanishes from med spas. What's your number?"

4. **Social Proof:** Lead with what competitors are doing. "Smart clinics don't have empty slots anymore."

5. **Curiosity Gap:** Lead with "the real reason" hooks. "I found out why your slots stay empty. It's not what you think."

### Success Thresholds

**Primary:** Cost per qualified signup (email + phone) ≤ $15

**Secondary:**
- CTR > 1% (hooks are resonating)
- Page → AI engagement > 40% (landing page is compelling)
- AI → calc completion > 60% (interaction is smooth)
- Calc → submit > 40% (value prop lands)

### Kill Rules

- CPA > $30 after $100 spend
- CTR < 0.5% after 10,000 impressions
- AI engagement < 20% after 100 page views
- Zero conversions after $150 spend

### Iterate Rules

- CPA $15-$30: Keep running, iterate on lowest-performing hook family
- High CTR but low page engagement: Landing page issue, not ad issue
- High engagement but low conversion: Value prop or CTA issue
- Single hook family dominating: Double down, test variants

### Funnel Events

1. Ad impression
2. Ad click (CTR)
3. Page view
4. AI interaction started
5. Revenue calculator completed
6. Email + phone submitted (conversion)
