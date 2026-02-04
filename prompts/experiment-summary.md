# Experiment Summary Report Prompt Template

Use this prompt to generate a founder-readable summary of experiment results.

---

## PROMPT

```
You are analyzing a traction experiment for an MVP. Generate a clear, actionable summary.

**Experiment Details:**
- Product: [PRODUCT_NAME]
- ICP: [TARGET CUSTOMER]
- Core promise: [VALUE PROPOSITION]
- Target CPA: $[AMOUNT]
- Test duration: [X] days
- Total spend: $[AMOUNT]

**Funnel Data:**
- Impressions: [NUMBER]
- Clicks: [NUMBER] (CTR: [X]%)
- Page views: [NUMBER]
- AI interactions: [NUMBER] ([X]% of page views)
- Calc completed: [NUMBER] ([X]% of AI interactions)
- Conversions (email + phone): [NUMBER]
- Actual CPA: $[AMOUNT]

**Hook Family Performance:**
[LIST EACH HOOK FAMILY WITH CLICKS AND CONVERSIONS]

**Kill Rules:**
[LIST THE PREDEFINED KILL RULES]

**Iterate Rules:**
[LIST THE PREDEFINED ITERATE RULES]

Generate a summary with:

1. **VERDICT** (Winner / Loser / Iterate / Inconclusive)
   - One sentence explaining why

2. **KEY METRICS** (formatted as a quick-scan table)

3. **WHAT WE LEARNED** (3-5 bullet points)
   - Focus on validated/invalidated hypotheses
   - Funnel insights
   - Hook family insights

4. **RECOMMENDED NEXT STEPS** (2-4 specific actions)
   - Be concrete: "Kill X, test Y, double down on Z"

5. **OPEN QUESTIONS** (if any)
   - What we still don't know

Keep it direct. This is for a founder making fast decisions, not a marketing report.
```

---

## EXAMPLE OUTPUT

# SlotFillr Experiment Summary
**Week 1 Results | Jan 15-22, 2025**

---

## VERDICT: ITERATE

CPA of $22 is 47% above target, but funnel shows clear optimization opportunities. Don't kill yet.

---

## KEY METRICS

| Metric | Actual | Target | Status |
|--------|--------|--------|--------|
| CPA | $22.00 | $15.00 | ⚠️ Above |
| CTR | 1.2% | >1% | ✅ Good |
| AI Engagement | 38% | >40% | ⚠️ Close |
| Calc Completion | 72% | >60% | ✅ Good |
| Submit Rate | 28% | >40% | ❌ Weak |

**Spend:** $440 / $500 budget
**Conversions:** 20 signups

---

## WHAT WE LEARNED

1. **Loss Aversion hooks win.** "$4,200/month" hook family drove 65% of conversions at half the CPA of other families. Hypothesis validated.

2. **Pain framing underperforms.** 0 conversions after $80 spend. Users may be desensitized to "your calendar has holes" messaging. Kill this family.

3. **The funnel breaks at submission.** 72% complete the revenue calculator, but only 28% submit contact info. The value reveal isn't compelling enough OR the ask feels too heavy.

4. **Automation hooks get clicks but don't convert.** High CTR (1.8%) but $45 CPA. Creates interest but may attract tire-kickers.

5. **AI engagement is the bottleneck.** 38% is close to target but means 62% of paid traffic bounces before interacting. Above-the-fold content needs work.

---

## RECOMMENDED NEXT STEPS

1. **Kill Pain Framing hooks.** Reallocate budget to Loss Aversion variants.

2. **Test new post-calc CTAs.** Current: "Join private beta." Test: "Get your personalized slot-filling plan" or "See exactly how it works for [their business type]."

3. **Add social proof at submission.** "47 clinics signed up this week" may reduce friction.

4. **A/B test landing page headline.** Current may not match Loss Aversion hook expectations.

---

## OPEN QUESTIONS

- Is $15 CPA realistic for this ICP, or should we adjust target?
- Would a "phone only" option (no email) increase submit rate?
- Are conversions from Loss Aversion hooks actually qualified (appointment-based businesses)?

---

## NEXT EXPERIMENT

**Focus:** Optimize submission rate while scaling Loss Aversion hooks
**Budget:** $300 over 5 days
**Primary hypothesis:** Softer CTA ("See your plan" vs "Join beta") will increase submit rate by 30%+
