# VolleyTrack v1.0 — Launch Readiness Report

**Prepared for Jason Paschall — February 16, 2026**

---

## Quick Status

| Area | Status | Notes |
|------|--------|-------|
| Free Tier Limits | **CRITICAL** | Still at testing values (100/100/50). Must revert. |
| App Store Description | **NEEDS UPDATE** | Missing Voice Input & Spectator features |
| App Store Privacy | **ACTION NEEDED** | You need to fill in the App Privacy questionnaire |
| StatsView Hook Bug | **FIXED** | useMemo correctly placed above early return |
| Hardcoded Version | **FIXED** | Now uses Constants.expoConfig?.version |
| @ts-ignore Directives | **MOSTLY FIXED** | Down from 5 to 1 (firebase config only) |
| Console Statements | **MEDIUM** | 16 files still have console.log/warn/error |
| RevenueCat/StoreKit | **GOOD** | 3 tiers configured, entitlements set |
| Firestore Rules | **GOOD** | Auth-gated writes, public read for live matches |
| iOS Config | **GOOD** | Privacy manifest, permissions, encryption flag |
| Landing Page | **NEEDS OVERHAUL** | Only 3 features listed, "Coming Soon" button, no screenshot |
| Privacy Policy | **CRITICAL REWRITE** | Claims no server data — but you use Firebase, AdMob, RevenueCat |

---

## 1. CRITICAL — Free Tier Limit Revert

### Current Values (Testing)
```
constants/monetization.ts:
  FREE_AI_NARRATIVE_LIMIT = 100    ← way too generous
  FREE_EXPORT_LIMIT       = 100    ← way too generous
  FREE_FAN_RECAP_LIMIT    = 50     ← way too generous

constants/voice.ts:
  FREE_VOICE_MATCH_LIMIT  = 3      ← already at target

constants/monetization.ts:
  FREE_SEASON_LIMIT       = 1      ← already at target
```

### Recommended Production Values
```
  FREE_AI_NARRATIVE_LIMIT = 3     (high-value AI feature, strong upsell driver)
  FREE_EXPORT_LIMIT       = 5     (let coaches export a few matches to see value)
  FREE_FAN_RECAP_LIMIT    = 3     (AI-powered, good upsell trigger)
  FREE_VOICE_MATCH_LIMIT  = 3     (already correct)
  FREE_SEASON_LIMIT       = 1     (already correct)
```

### PaywallModal Messages — Already Aligned
The trigger messages in `components/PaywallModal.tsx` already reference "3 free" for AI narratives, exports, and voice input. Once you change the constants to match, these messages will be accurate. If you choose 5 for exports, update line 30 to say "You've used all 5 free exports."

---

## 2. App Store Connect — Complete Field Guide

### Fields You Likely Have Filled In (from your metadata file)

**Promotional Text** (170 char max):
> Track every set, analyze every play. VolleyTrack gives you pro-level stats, rotation tracking, and instant AI-powered match narratives right in your pocket.

This is solid. Consider adding "voice input" or "spectator mode" if you have room, since those are differentiators.

**Keywords** (100 char max):
> volleyball,stats,coaching,scorekeeper,statistics,avca,club,match tracker,sports analysis,sideout

Good selection. Consider swapping "sports analysis" (generic, hard to rank for) with something more specific like "volleyball app" or "live score." Count your characters carefully — no spaces after commas.

### Description — Recommended Rewrite

Your current description is good but omits two of your most differentiating features: **Spectator/Super Fan Mode** and **Voice Input**. Here's a suggested rewrite:

---

Take your volleyball coaching and analysis to the next level with VolleyTrack. Designed for coaches, players, and fans, VolleyTrack offers professional-grade statistics tracking and real-time match insights right from your sideline.

KEY FEATURES:

• Live Scoring & Rotation Tracking — Effortlessly track score, server, and rotation with an intuitive interface built for fast-paced matches.

• Voice Input — Go hands-free during matches. Just speak your stats and let AI convert your voice to play-by-play entries in real time.

• Advanced Analytics — Go beyond the box score with Sideout %, Point Scoring %, Hitting Efficiency, momentum charts, and set-by-set breakdowns.

• AI-Powered Narratives — Instantly generate match recaps for social media or detailed reports for film study with our AI engine.

• Live Spectator Mode — Share a code with parents and fans so they can follow the match live, send cheers, and get personalized Super Fan recaps for their player.

• Team & Season Management — Manage multiple teams, rosters, and seasons. Track performance trends across an entire season.

Whether you're tracking a club tournament, a high school season, or cheering from the stands, VolleyTrack gives you the tools to stay connected to every point.

---

### Fields You Need to Fill In

**1. Category**
- Primary: `Sports`
- Secondary: `Utilities` or `Productivity`

**2. Age Rating**
You'll answer a questionnaire. Based on your app's content:
- No violence, gambling, horror, drugs, sexual content, etc.
- You DO show ads (AdMob) → select "Yes" for "Frequent/Intense: None" under unrestricted web access
- **Result: Likely rated 4+**

**3. Copyright**
```
© 2026 HarpElle Apps
```
(or whatever your legal entity name is)

**4. App Review Information**

Contact info for the review team. Also provide:

- **Demo Account:** If Firebase auth is required to access features, provide a test login. If the app works in "free tier" without login, note that.
- **Notes for Reviewer:** Something like:
  > "VolleyTrack is a volleyball statistics and live scoring app. Core features (live scoring, stats, rotation tracking) work without an account. Cloud sync, spectator broadcasting, and AI features require sign-in. The app uses RevenueCat for in-app purchases with 3 subscription tiers. Voice input requires microphone permission and uses on-device speech recognition."

**5. What's New (Version 1.0)**
```
Initial release of VolleyTrack! Features include:
- Live match scoring with rotation tracking
- Advanced volleyball analytics
- AI-powered match narratives and recaps
- Hands-free voice stat input
- Live spectator mode with Super Fan recaps
- Team and season management
```

**6. Support URL:**
`https://harpelle.com/volleytrack`

**7. Privacy Policy URL:**
`https://harpelle.com/volleytrack/privacy.html`

**8. Marketing URL (optional):**
`https://harpelle.com/volleytrack`

---

## 3. App Store Privacy Questionnaire

This is the "App Privacy" section in App Store Connect. Based on my analysis of your codebase, here's exactly what to select:

### Data Types Collected:

**Contact Info → Email Address**
- Collected: Yes
- Linked to User: Yes (Firebase Auth)
- Used for Tracking: No
- Purpose: App Functionality, Account Management

**Identifiers → Device ID**
- Collected: Yes (device UUID for free tier tracking + RevenueCat)
- Linked to User: No
- Used for Tracking: No
- Purpose: App Functionality

**Usage Data → Product Interaction**
- Collected: Yes (feature usage counters for paywall limits)
- Linked to User: No (stored on device only)
- Used for Tracking: No
- Purpose: App Functionality

**Diagnostics → Performance Data**
- Collected: Possibly (Firebase may collect crash data)
- Linked to User: No
- Used for Tracking: No
- Purpose: Analytics

### Third-Party Data Collection (ads):

**AdMob (Google Mobile Ads)** collects:
- Device ID for ad targeting
- Usage data for ad performance
- This is disclosed through Google's AdMob SDK documentation

When you reach the "Do you or your third-party partners collect data?" question for advertising, answer **Yes** and note AdMob.

### Data NOT Collected:
- Health & Fitness: No
- Financial Info: No
- Location: No
- Sensitive Info: No
- Contacts: No
- Browsing History: No
- Search History: No
- Photos or Videos: No (you write to photo library but don't read it)

---

## 4. Privacy Policy — CRITICAL REWRITE NEEDED

I reviewed the source at `harpelle.github.io/volleytrack/privacy.html`. **The current policy is inaccurate and incomplete.** Apple can reject apps whose privacy policy doesn't match actual data practices.

### What the Policy Currently Says vs. Reality:

| Current Claim | Reality |
|---------------|---------|
| "We do not collect, store, or share any personal data on our servers" | **FALSE** — Firebase Auth stores email/password. Firestore stores all match data, seasons, rosters in the cloud. |
| "All match data...stored locally on your device" | **FALSE** — Cloud sync sends everything to Google Firestore when signed in. Live matches are publicly readable. |
| Third-party services: "Google Play Services, Expo" | **Massively incomplete** — Missing Firebase, AdMob, RevenueCat, Google Gemini AI |

### What's Missing Entirely:

1. **Firebase Authentication** — Email + password collection, account creation
2. **Firebase Firestore** — Cloud storage of all user data (matches, seasons, rosters, play-by-play logs)
3. **Live Match Broadcasting** — Match data is publicly readable by anyone with a 6-character code
4. **Google AdMob** — Third-party advertising SDK that collects device info for ad targeting
5. **RevenueCat** — Subscription management that collects device IDs and purchase history
6. **Voice Data** — On-device speech recognition + transcription sent to Google Gemini for parsing
7. **Device UUID** — Generated and stored for free tier tracking and RevenueCat identity
8. **Data Retention & Deletion** — Apple REQUIRES you to explain how users can delete their data
9. **Children's Privacy** — COPPA statement (critical for a school/club volleyball context)
10. **Changes to Policy** — How users will be notified of updates

### Action Required:
The privacy policy needs a complete rewrite before App Store submission. I can draft an updated version that accurately reflects your app's data practices.

---

## 5. Landing Page Overhaul — Specific Findings

I reviewed the source at `harpelle.github.io/volleytrack/index.html`. It's a basic placeholder that needs a full overhaul for launch.

### Current State:
- Only 3 features listed (Live Scoring, AI Narratives, Advanced Analytics)
- **Missing:** Voice Input, Spectator Mode, Team Management — your biggest differentiators
- Download button says **"Coming Soon to App Store"** — must update at launch
- No app icon or screenshot shown (you DO have `assets/VolleyTrack-icon.png` and `assets/VolleyTrack-Screenshot.png` in the repo)
- No pricing section, no FAQ, no App Store badge
- Very minimal styling — functional but not polished

### What the Page Needs for Launch:

1. **Hero** — App icon (you have `VolleyTrack-icon.png`), tagline, App Store download badge (you have the SVG badge in `assets/`), hero screenshot
2. **6 Feature Sections** (not just 3):
   - Live Scoring & Rotation Tracking
   - Voice Input (hands-free) ← NEW, major differentiator
   - Advanced Analytics
   - AI-Powered Narratives
   - Live Spectator Mode ← NEW, viral feature
   - Team & Season Management
3. **Pricing Section** — Free vs. Pro comparison table
4. **App Store Badge** — Use the official SVG already in your assets folder
5. **Footer** — Privacy Policy link, support email, copyright

### Why This Matters:
- This URL is your **Support URL** in App Store Connect — Apple Review will visit it
- It's also your **Marketing URL** — first impression for anyone finding your app
- The "Coming Soon" button will look bad if the app is already live

### Available Assets (already in repo):
- `assets/VolleyTrack-icon.png` — App icon
- `assets/VolleyTrack-Screenshot.png` — App screenshot
- `assets/Download_on_the_App_Store_Badge_US-UK_RGB_blk_092917.svg` — App Store badge
- `assets/volleyball-favicon.png` — Favicon

I can draft a complete updated landing page HTML for you.

---

## 6. Remaining Code Issues (from Pre-Release Review)

### Already Fixed Since Review:
- ✅ StatsView.tsx hook violation — useMemo correctly placed above early return
- ✅ Settings version display — now uses `Constants.expoConfig?.version`
- ✅ @ts-ignore count reduced to 1 (from 5)

### Still Outstanding:

| Priority | Issue | Files |
|----------|-------|-------|
| **Critical** | Free tier limits at testing values | `constants/monetization.ts` |
| High | 16 files with console.log/warn/error | Various |
| High | GeminiService has no API call timeout | `services/ai/GeminiService.ts` |
| Medium | Empty `app/roster/` directory | `app/roster/` |
| Medium | 10 exhaustive-deps warnings | Various components |
| Low | Spectator reaction rate limiting | `spectatorInteractionService.ts` |

### Console Statements — Recommendation
For v1.0, the console statements won't block App Review, but they do leak info to device logs. You already have a `utils/logger.ts` utility. I recommend:
- Keep them for now if you want debugging visibility during your tournament test
- Strip them for the production build after testing is complete

---

## 7. Pre-Submission Checklist

### Before Your Tournament Test Today:
- [ ] Verify TestFlight build works on your device
- [ ] Test all core flows: create season → setup match → live scoring → stats → export
- [ ] Test voice input flow
- [ ] Test spectator join via match code
- [ ] Test paywall trigger (if limits allow)
- [ ] Verify RevenueCat sandbox purchases work

### Before Submitting to App Review:
- [ ] **Rewrite privacy policy** — current version is inaccurate (CRITICAL — see Section 4)
- [ ] **Revert free tier limits** in `constants/monetization.ts` (CRITICAL)
- [ ] **Overhaul landing page** — update features, remove "Coming Soon", add App Store badge
- [ ] Update App Store description to include Voice Input & Spectator Mode
- [ ] Fill in App Privacy questionnaire (see Section 3 above)
- [ ] Fill in age rating questionnaire
- [ ] Add "What's New" text for v1.0
- [ ] Add review notes for App Review team
- [ ] Verify privacy policy URL returns 200 (not 403!)
- [ ] Verify support URL returns 200
- [ ] Upload all required screenshot sizes (6.7", 6.5", 5.5" at minimum)
- [ ] Build production binary via EAS (`eas build --platform ios --profile production`)
- [ ] Upload build to App Store Connect

### Post-Approval (v1.0.1 fast-follow):
- [ ] Remove/gate console statements for production
- [ ] Add GeminiService timeout
- [ ] Clean up empty `app/roster/` directory
- [ ] Add spectator reaction rate limiting
- [ ] Fix remaining exhaustive-deps warnings
