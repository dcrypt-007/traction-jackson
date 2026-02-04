# Hook Generation Prompt Template

Use this prompt with Claude to generate short-form ad hooks for TikTok and Instagram Reels.

---

## PROMPT

```
You are generating hooks for short-form video ads (TikTok/Instagram Reels) for an MVP traction test.

**Context:**
- Product: [PRODUCT_NAME]
- ICP: [TARGET CUSTOMER]
- Core promise: [VALUE PROPOSITION]
- Landing page has: [DESCRIBE THE INTERACTIVE ELEMENT, e.g., "AI that calculates lost revenue"]

**Hook Families to Generate:**
[LIST THE FRAMING ANGLES, e.g., Pain, Automation, Loss Aversion, Social Proof, Curiosity]

**Rules:**
- Hooks must work in the first 1-3 seconds
- They should CREATE CURIOSITY, not close the sale
- The landing page AI does the selling—ads just get them there
- No hype, no fake numbers, no scammy language
- Keep hooks under 15 words
- Write for speaking out loud, not reading

For each hook family, generate:
1. **5 hook variants** (the opening line that stops the scroll)
2. **Text-on-screen version** (how it would appear as overlay text, may be split across 2 frames)

Format output as:

### [HOOK FAMILY NAME]
**Intent:** [What emotional response are we going for]

1. "[Hook text]"
   Text: [Line 1] / [Line 2 if split]

2. "[Hook text]"
   Text: [Line 1] / [Line 2 if split]

[etc.]
```

---

## EXAMPLE OUTPUT

### PAIN FRAMING
**Intent:** Make them feel the frustration of empty slots before offering a solution

1. "Your appointment book has holes in it. I can see them from here."
   Text: Your appointment book / has holes in it.

2. "That empty 2pm slot? It's not coming back."
   Text: That empty 2pm slot? / It's not coming back.

3. "Every no-show costs you $150. How many did you have this week?"
   Text: Every no-show / costs you $150.

4. "You're running a business with Swiss cheese scheduling."
   Text: Swiss cheese / scheduling.

5. "Empty slots don't reschedule themselves."
   Text: Empty slots don't / reschedule themselves.

---

### AUTOMATION FRAMING
**Intent:** Appeal to the desire for things to just work without effort

1. "What if your calendar filled itself?"
   Text: What if your calendar / filled itself?

2. "AI just booked 3 appointments while you read this."
   Text: AI just booked / 3 appointments.

3. "Stop chasing patients. Let the AI do it."
   Text: Stop chasing patients. / Let the AI do it.

4. "Your front desk can't text 50 people at once. AI can."
   Text: Your front desk can't / text 50 people at once.

5. "Automatic slot-filling is here. Your competitors know."
   Text: Automatic slot-filling / is here.

---

### LOSS AVERSION
**Intent:** Trigger loss aversion with specific, believable numbers

1. "Med spas lose $4,200/month to empty slots. What's your number?"
   Text: $4,200/month / to empty slots.

2. "$127 vanished at 3pm yesterday. You didn't notice."
   Text: $127 vanished / at 3pm yesterday.

3. "10 empty slots × $150 = $1,500 gone. Every. Single. Week."
   Text: 10 empty slots / = $1,500 gone.

4. "You're paying rent on chairs nobody's sitting in."
   Text: Paying rent on chairs / nobody's sitting in.

5. "That cancellation just cost you a car payment."
   Text: That cancellation / just cost you a car payment.

---

## HOOK QUALITY CHECKLIST

Before using a hook, verify:

- [ ] Works in first 2 seconds (no setup required)
- [ ] Creates a "wait, what?" moment
- [ ] Specific to the ICP (not generic)
- [ ] No unverifiable claims
- [ ] Sounds natural when spoken
- [ ] Text-on-screen is readable in <2 seconds
- [ ] Doesn't try to close the sale (that's the landing page's job)
