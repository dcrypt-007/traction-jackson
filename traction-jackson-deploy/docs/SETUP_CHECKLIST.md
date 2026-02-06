# Setup Checklist

Complete these one-time setup steps to enable fully automated video ad deployment.

After setup, you won't need to open these tools again for daily operation.

---

## 1. Canva Setup

### What You Need
- [ ] Canva Pro account (required for API access)
- [ ] 6-10 vertical video templates (9:16 aspect ratio)
- [ ] API access enabled
- [ ] Template IDs for each template

### Steps

1. **Create Templates**
   - Go to [canva.com](https://canva.com) → Create a design → Video (9:16)
   - Create 6-10 templates with these placeholders:
     - Hook text (large, top of frame)
     - Supporting text (medium, middle)
     - CTA text (bottom, with background)
   - Keep templates minimal: text + simple backgrounds/animations
   - Save each template

2. **Get API Access**
   - Go to [canva.com/developers](https://www.canva.com/developers/)
   - Create a new app
   - Request "Design" and "Asset" scopes
   - Copy your **API Key**

3. **Get Template IDs**
   - Open each template in Canva
   - Look at the URL: `canva.com/design/XXXXX/edit`
   - The `XXXXX` part is your Template ID
   - Copy all Template IDs

### Where to Enter in Traction Jackson
- Go to **Settings → Integrations → Canva**
- Paste your API Key
- Add each Template ID with a label (e.g., "Minimal Dark", "Bold Colors")

---

## 2. ElevenLabs (11Labs) Setup

### What You Need
- [ ] 11Labs account (Starter plan or higher)
- [ ] 1-2 voice selections
- [ ] API Key

### Steps

1. **Choose Your House Voices**
   - Go to [elevenlabs.io](https://elevenlabs.io) → Voice Library
   - Pick 1-2 voices that match your brand:
     - One neutral/calm voice
     - One assertive/energetic voice (optional)
   - Note the **Voice IDs** (click on voice → Settings)

2. **Get API Key**
   - Go to Profile → API Key
   - Copy your API Key

### Where to Enter in Traction Jackson
- Go to **Settings → Integrations → 11Labs**
- Paste your API Key
- Add each Voice ID with a label (e.g., "Calm Male", "Assertive Female")

---

## 3. Meta / Instagram Ads Setup

### What You Need
- [ ] Facebook Business Manager account
- [ ] Ad Account connected
- [ ] Meta Pixel installed on your landing page
- [ ] API access token

### Steps

1. **Business Manager Setup**
   - Go to [business.facebook.com](https://business.facebook.com)
   - Create or access your Business Manager
   - Ensure you have an Ad Account (Business Settings → Ad Accounts)

2. **Create Meta Pixel**
   - Go to Events Manager → Connect Data Sources → Web → Meta Pixel
   - Name it (e.g., "SlotFillr Pixel")
   - Copy your **Pixel ID**
   - Install the pixel on your landing page (or confirm it's already there)

3. **Get API Access**
   - Go to [developers.facebook.com](https://developers.facebook.com)
   - Create an app (Business type)
   - Add "Marketing API" product
   - Generate a **System User Access Token** with these permissions:
     - `ads_management`
     - `ads_read`
     - `business_management`

4. **Get Ad Account ID**
   - In Business Manager → Business Settings → Ad Accounts
   - Copy the **Ad Account ID** (starts with `act_`)

### Where to Enter in Traction Jackson
- Go to **Settings → Integrations → Meta**
- Paste your Access Token
- Paste your Ad Account ID
- Paste your Pixel ID
- Enter your landing page domain

---

## 4. TikTok Ads Setup

### What You Need
- [ ] TikTok Business Center account
- [ ] Ad Account created
- [ ] TikTok Pixel installed on your landing page
- [ ] API access token

### Steps

1. **Business Center Setup**
   - Go to [ads.tiktok.com](https://ads.tiktok.com)
   - Create or access your Business Center
   - Create an Ad Account if you don't have one

2. **Create TikTok Pixel**
   - Go to Assets → Events → Web Events
   - Create a new Pixel
   - Copy your **Pixel ID**
   - Install on your landing page (use their code or Google Tag Manager)

3. **Get API Access**
   - Go to [ads.tiktok.com/marketing_api](https://ads.tiktok.com/marketing_api/)
   - Create a developer app
   - Request access to Ads Management API
   - Generate an **Access Token**

4. **Get Advertiser ID**
   - In TikTok Ads Manager, your Advertiser ID is shown in the top-right
   - Or find it in Business Center → Ad Accounts

### Where to Enter in Traction Jackson
- Go to **Settings → Integrations → TikTok**
- Paste your Access Token
- Paste your Advertiser ID
- Paste your Pixel ID

---

## 5. Tracking Validation

### What You Need
- [ ] Funnel events firing correctly on your landing page

### Events to Validate

| Event | Trigger |
|-------|---------|
| `page_view` | User lands on page |
| `ai_interaction_start` | User begins interacting with AI |
| `revenue_calc_complete` | User completes the revenue calculator |
| `lead_submit` | User submits email + phone |

### Steps

1. **Test Each Event**
   - Open your landing page
   - Open browser DevTools → Network tab
   - Filter by "facebook" or "tiktok"
   - Walk through your funnel and confirm each event fires

2. **Verify in Platforms**
   - Meta: Events Manager → Test Events
   - TikTok: Events → Test Events
   - Confirm events are received

### Where to Validate in Traction Jackson
- Go to **Settings → Tracking**
- Click "Run Validation Test"
- System will confirm which events are detected

---

## Setup Status Summary

Once complete, your Settings page should show:

| Integration | Status |
|-------------|--------|
| Canva | ✅ Connected |
| 11Labs | ✅ Connected |
| Meta | ✅ Connected |
| TikTok | ✅ Connected |
| Tracking | ✅ Validated |

**You're ready to launch automated video experiments.**

---

## Troubleshooting

### "API Key Invalid"
- Regenerate the key and try again
- Check for extra spaces when pasting

### "Pixel Not Receiving Events"
- Verify pixel code is on all pages of your funnel
- Check for ad blockers in your test browser
- Use incognito mode for testing

### "Template ID Not Found"
- Make sure you're copying the ID from the URL, not the template name
- Template must be a Video type, not a static design

### "Insufficient Permissions"
- For Meta: Regenerate token with all required scopes
- For TikTok: Request API access approval (can take 24-48 hours)
