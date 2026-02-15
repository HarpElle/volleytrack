# VolleyTrack Project Handoff Document

## 1. Project Overview

**VolleyTrack** is a cross-platform mobile volleyball scorekeeper and analytics app built with React Native + Expo. It enables coaches and teams to track match stats in real-time, generate AI-powered post-match narratives, and share match summaries on social media.

**Primary Users:** Volleyball coaches and team managers tracking matches during play

**Platform Support:**
- iOS (primary, production-ready for App Store)
- Android (setup underway for Google Play)
- Web (via Expo Web, development only)

**Key Capabilities:**
- Real-time match scoring with set/timeout/substitution tracking
- Live player rotation and lineup management
- Detailed stat logging (aces, kills, blocks, digs, serve/attack errors, passes, etc.)
- **Voice input for hands-free stat tracking** (Gemini AI-powered speech parsing)
- AI-generated post-match narratives (coach summary + social media summary)
- Match export and sharing
- Spectator mode (QR-code-based live match broadcast)
- Dark and light theme support
- Freemium monetization (free tier with limits, Pro subscription for unlimited access)

---

## 2. Tech Stack

### Core Framework
- **React Native** `0.81.5` — Cross-platform mobile framework
- **Expo** `~54.0.33` — Development platform and managed services
- **Expo Router** `~6.0.23` — File-based routing (replacing React Navigation)
- **React** `19.1.0` — UI library

### State Management
- **Zustand** `^5.0.10` — Lightweight store management
  - `useMatchStore` — Current live match state
  - `useDataStore` — Seasons, events, saved matches (with Firebase sync)
  - `useSubscriptionStore` — Device UUID, Pro status, free-tier usage counters

### Backend & Auth
- **Firebase** `^12.9.0`
  - Authentication (Email/password + anonymous)
  - Firestore (real-time sync of seasons, events, match records)
  - Realtime Database (live match broadcast for spectators)

### Monetization
- **RevenueCat** `^9.8.0` (via `react-native-purchases`)
  - Subscription management (monthly, annual, lifetime tiers)
  - Entitlement tracking (Pro subscription status)
  - Platform-agnostic pricing and receipts
- **Google Mobile Ads** `^16.0.3` (AdMob)
  - Banner ads on free tier
  - Test and production ad unit IDs configured

### AI & NLP
- **Google Generative AI (Gemini)** `^0.24.1`
  - Match narrative generation (coach summary + social post)
  - **Voice transcript parsing** (unstructured speech → structured StatLog entries)
  - Prompt engineering for contextual summaries

### Speech Recognition
- **expo-speech-recognition** — On-device speech-to-text for voice input feature
  - Real-time transcription with interim results
  - Used with Gemini for two-stage pipeline: speech → text → structured stats

### Storage & Persistence
- **AsyncStorage** `2.2.0` — Local device storage for Zustand hydration
- **expo-file-system** `^19.0.21` — File operations for exports
- **expo-crypto** `^15.0.8` — Device UUID generation

### UI & Navigation
- **@react-navigation/native** `^7.1.8`, **@react-navigation/bottom-tabs** `^7.4.0`
- **lucide-react-native** `^0.563.0` — Icon library
- **react-native-svg** `15.12.1` — SVG rendering
- **react-native-reanimated** `~4.1.1` — Animations
- **react-native-gesture-handler** `~2.28.0` — Gesture recognition

### Additional Libraries
- **react-native-qrcode-svg** `^6.3.21` — QR code generation (spectator view)
- **react-native-view-shot** `^4.0.3` — Screenshot/export functionality
- **expo-sharing** `^14.0.8` — Share matches to messaging/email
- **@react-native-community/datetimepicker** `8.4.4` — Date/time picker
- **expo-store-review** `^9.0.9` — Prompt App Store reviews

### Development
- **TypeScript** `~5.9.2`
- **ESLint** + **expo-lint** `~10.0.0`

---

## 3. Architecture Overview

### 3.1 Routing & Navigation

VolleyTrack uses **Expo Router** (file-based routing), not React Navigation. Routes map to the file system:

```
app/
  _layout.tsx                 # Root layout, auth check, theme provider
  index.tsx                   # Dashboard (home screen)
  live.tsx                    # Live match scoreboard during play
  summary.tsx                 # Post-match summary with stats & AI narrative
  settings.tsx                # App settings, theme toggle, account
  quick-match-setup.tsx       # Quick match creation flow

  auth/
    sign-in.tsx               # Email login
    sign-up.tsx               # Email registration
    forgot-password.tsx       # Password reset

  season/
    create.tsx                # Create new season
    [id].tsx                  # Manage season (roster, events)

  event/
    manage.tsx                # Create/manage events
    [id].tsx                  # View event matches

  match/
    setup.tsx                 # Pre-match setup (roster, config, lineups)
    [id].tsx                  # Match details/replay screen

  spectate/
    join.tsx                  # QR code scanner to join live match
    [code].tsx                # Real-time spectator view

  +not-found.tsx              # 404 fallback
```

**Key Pattern:** Dynamic routes use `[id]` or `[code]` syntax. Nested routes inherit parent layout.

### 3.2 State Management (Zustand Stores)

#### **useMatchStore** — Live match state
Located: `/store/useMatchStore.ts`

Manages the currently active match during play:
- **Setup:** Team names, match config (set targets, win-by rules)
- **Live State:** Current set, scores, history of stats, set results
- **Roster & Rotation:** Player rosters, current court positions (P1-P6), libero tracking
- **Resources:** Timeouts/subs remaining per team
- **Actions:**
  - `setSetup()` — Initialize match with teams and config
  - `recordStat()` — Log a stat event (ace, kill, error, pass, etc.)
  - `undo()` — Remove last action and restore previous score
  - `startRally()` / `endRally()` — Manage rally flow and rotation
  - `rotate()` — Advance rotation (forward/backward)
  - `substitute()` — Swap player in/out
  - `useTimeout()` — Consume a timeout
  - `useSub()` — Consume a substitution

**Persistence:** Persisted to AsyncStorage (survives app close/reopen during a match)

#### **useDataStore** — Seasons, events, matches (Cloud-synced)
Located: `/store/useDataStore.ts`

Stores all user data with **bidirectional Firebase sync:**
- **Local Collections:**
  - `seasons: Season[]` — Team seasons with rosters
  - `events: Event[]` — Tournaments/dates within seasons
  - `savedMatches: MatchRecord[]` — Completed/saved matches
- **Sync State:** `syncStatus`, `lastSyncedAt`, `syncError`
- **Actions:**
  - CRUD operations (add, update, delete) for seasons, events, matches
  - `syncWithCloud(uid)` — Full two-way Firebase sync
  - `pushItemToCloud()`, `deleteItemFromCloud()` — Manual sync
  - Helper getters: `getSeasonEvents()`, `getEventMatches()`

**Auth Requirement:** Sync only works for logged-in users (requires Firebase UID)

#### **useSubscriptionStore** — Device identity & Pro status
Located: `/store/useSubscriptionStore.ts`

Manages free/Pro tier gating and usage tracking:
- **Device Identity:** `deviceUUID` (persisted to both Zustand and AsyncStorage)
  - Unique per device install (not per user email)
  - Generated with `expo-crypto.randomUUID()` on first launch
  - Sent to RevenueCat for anonymous entitlement checks
- **Subscription Status:**
  - `isPro: boolean` — Whether user has active Pro subscription
  - `subscriptionType: 'monthly' | 'annual' | 'lifetime' | null`
  - `expiresAt: string | null` — Expiry timestamp for time-based subscriptions
- **Free Tier Counters (persisted locally):**
  - `aiNarrativesUsed` / `getRemainingAINarratives()` — Max 3 narratives
  - `exportsUsed` / `getRemainingExports()` — Max 3 exports
  - `voiceMatchIds` / `getRemainingVoiceMatches()` — Max 3 voice-enabled matches
  - Free tier allows max 1 active season
- **Actions:**
  - `initializeDevice()` — Async init/retrieve device UUID before RevenueCat init
  - `setProStatus()` — Update subscription status from RevenueCat
  - `incrementAINarratives()` / `incrementExports()` — Track free tier usage
  - `canUseAINarrative()` — Check if user can generate another narrative
  - `canUseExport()` — Check if user can export another match
  - `canUseVoiceInput(matchId)` — Check if voice input allowed (Pro or within free limit)
  - `registerVoiceMatch(matchId)` — Track a match as voice-enabled for free tier counting

**Design Note:** Free tier is device-based, not email-based. Users can create/switch Firebase accounts on the same device and still share the usage counters.

### 3.3 Firebase Architecture

#### Config
File: `/services/firebase/config.ts`

Firebase is initialized with credentials for the `harpelleapps` project (production). Email/password auth is enabled.

#### Authentication
File: `/services/firebase/AuthContext.tsx`

React Context providing:
- `user: FirebaseUser | null` — Current logged-in user (or null if anonymous)
- `uid: string | null` — User's UID for Firestore queries
- `signUp()`, `signIn()`, `signOut()`, `resetPassword()` — Auth methods
- `loading: boolean` — Auth state check in progress
- `hasPassword: boolean` — Whether user has email/password set (vs anonymous)

**Initialization Flow:**
1. App checks AsyncStorage for cached `authToken`
2. If cached, silently restores session
3. If no cached token, user is anonymous until they sign in

**Anonymous Fallback:** App starts anonymous if user closes during onboarding; they can sign in later and sync data.

#### Firestore Sync
File: `/services/firebase/syncService.ts`

Two-way sync of `seasons`, `events`, `savedMatches` collections:

```
Firestore Structure:
users/{uid}/
  seasons/{seasonId}
  events/{eventId}
  savedMatches/{matchId}
```

**Functions:**
- `fullSync(uid: string)` — Download all user data from Firestore, merge with local, upload any local-only items
- `pushItem(uid, type, data)` — Upload a single item (season/event/match) to Firestore
- `deleteCloudItem(uid, type, id)` — Delete an item from Firestore

**Conflict Resolution:** Last-write-wins; local changes always pushed to cloud.

#### Live Match Broadcast (Phase 4)
File: `/services/firebase/liveMatchService.ts`

Spectators join live matches via QR code:

```
Realtime Database Path: liveMatches/{matchCode}
  coachUid: string
  matchId: string
  currentState: LiveMatchSnapshot
  isActive: boolean
  createdAt: number
  lastUpdated: number
```

**Coach Flow:**
1. During live match, coach generates QR code (contains 6-char `matchCode`)
2. Coach updates Realtime DB with `LiveMatchSnapshot` on each score change
3. QR code shared with spectators

**Spectator Flow:**
1. Scan QR code or manually enter 6-char code
2. Join `/spectate/[code]` route
3. Listen to `liveMatches/{matchCode}` for real-time updates
4. Display score, stats, current rotation

### 3.4 Monetization Architecture

#### RevenueCat Integration
File: `/services/revenuecat/RevenueCatService.ts`

RevenueCat manages subscriptions cross-platform:

**Initialization (App Startup):**
```typescript
// Must call before any subscription check
await Purchases.setSimulationEnabled(true);  // dev/test
await Purchases.configure({
  apiKey: getRevenueCatApiKey(),
  appUserID: deviceUUID,  // Tied to device, not email
});
```

**Entitlement Check:**
```typescript
const customerInfo = await Purchases.getCustomerInfo();
const isPro = customerInfo.entitlements.active['HarpElle / VolleyTrack Pro'] !== undefined;
```

**Subscription Tiers:**
- **Monthly:** `pro_monthly` — $4.99/month
- **Annual:** `pro_annual` — $34.99/year
- **Lifetime:** `pro_lifetime` — $79.99 (non-consumable)

**Key Design:**
- Device UUID (not email) anchors the subscription
- Free users are anonymous and device-locked
- Signed-in users can recover subscriptions via same device ID

#### Free vs Pro Features
File: `/constants/monetization.ts`

| Feature | Free | Pro |
|---------|------|-----|
| Seasons | 1 | Unlimited |
| AI Narratives | 3 per device | Unlimited |
| Match Exports | 3 per device | Unlimited |
| Voice Input | 3 matches per device | Unlimited |
| Ads | Yes (banner) | No |
| Spectator Mode | Yes | Yes |

**Gating Pattern:**
```typescript
const { isPro, canUseAINarrative } = useSubscriptionStore();

if (!isPro && !canUseAINarrative()) {
  // Show paywall modal
  return <PaywallModal />;
}

// Generate narrative
```

#### AdMob Ads
File: `/constants/monetization.ts`

Banner ads shown at bottom of free-tier screens:

**Test Ad Unit IDs (dev):**
- iOS: `ca-app-pub-3940256099942544/2934735716`
- Android: `ca-app-pub-3940256099942544/6300978111`

**Production Ad Unit IDs:**
- iOS: `ca-app-pub-4048915758307061/9820858426`
- Android: `ca-app-pub-4048915758307061/6863522594`

**AdMob App IDs** (in `app.json`):
- iOS: `ca-app-pub-4048915758307061~9420470963`
- Android: `ca-app-pub-4048915758307061~7721308693`

**Pattern:** In dev mode, test ads are always shown (safe). In production, real ads served.

#### PaywallModal
File: `/components/PaywallModal.tsx`

Modal shown when user hits a free-tier limit:
- Displays 3 subscription options with pricing
- Links to Apple App Store subscription management
- RevenueCat Customer Center integration for account management

### 3.5 Theme System

#### ThemeContext
Located: `contexts/ThemeContext.tsx` (implied from usage)

Provides `useTheme()` hook for dark/light mode:

**Dark Mode Colors:**
```typescript
{
  bg: '#0d1117',           // Very dark navy background
  bgCard: '#161b22',       // Slightly lighter cards
  text: '#e6edf3',         // Light text
  primary: '#53caff',      // Cyan accent
  // Additional colors for stats, errors, etc.
}
```

**Light Mode Colors:**
```typescript
{
  bg: '#f5f7fa',           // Light gray background
  bgCard: '#ffffff',       // White cards
  text: '#1a1a2e',         // Dark text
  primary: '#53caff',      // Same cyan accent
}
```

**Toggling:** User can manually toggle dark/light in settings. `app.json` has `"userInterfaceStyle": "automatic"` to respect system preference by default.

### 3.6 Stat Logging System

#### StatLog Type
File: `/types/index.ts`

Every action during a match is logged as a `StatLog`:

```typescript
interface StatLog {
  id: string;                    // Unique ID for undo tracking
  timestamp: number;             // When it happened
  type: 'ace' | 'kill' | 'dig' | 'pass_error' | 'block' | 'serve_error' | /* ... */ 'rotation' | 'substitution';
  team: 'myTeam' | 'opponent';   // Who got the stat
  scoreSnapshot: Score;          // Score before this event (for undo restore)
  setNumber: number;             // Which set
  playerId?: string;             // Player who performed the action
  assistPlayerId?: string;       // Setter/assist player (for kills)
  metadata?: { ... };            // Sub in/out, rotation details, etc.
  rallyStateSnapshot?: 'pre-serve' | 'in-rally';
  servingTeamSnapshot?: Team;
  rotationSnapshot?: LineupPosition[];  // My Team's court positions at event time
}
```

**Flow:**
1. User taps stat button (e.g., "Ace")
2. `recordStat('ace', 'myTeam', playerId)` called
3. `StatLog` appended to `useMatchStore.history`
4. Score updated, rotation possibly advanced
5. User can `undo()` to remove last action

**Undo Mechanism:**
- Pops last `StatLog` from history
- Restores `scoreSnapshot` to get previous score
- Restores `rotationSnapshot` if applicable

### 3.7 Match Configuration & Sets

#### MatchConfig Type
File: `/types/index.ts`

```typescript
interface MatchConfig {
  presetName: '3-Set' | '5-Set' | '2-Set-Seeding' | 'Custom';
  totalSets: number;
  sets: SetConfig[];  // Config for each set
  timeoutsPerSet?: number;     // Default 2
  subsPerSet?: number;         // Default 15
}

interface SetConfig {
  targetScore: number;  // 25 or 15
  winBy: number;        // Usually 2
  cap: number;          // Sanity cap (30 or 20)
}
```

**3-Set Default:**
- Set 1, 2: First to 25 (win by 2), cap at 30
- Set 3 (tiebreaker): First to 15 (win by 2), cap at 20

**Set Advancement:**
- When a team reaches `targetScore` AND leads by at least `winBy`:
  - Set is "won" and added to `setHistory`
  - New set begins, score resets to 0-0
  - Rotation resets for new set
  - If this was the deciding set, match ends

---

## 4. Directory Structure

```
VolleyTrack/
│
├── app/                        # Expo Router screens
│   ├── _layout.tsx
│   ├── index.tsx               # Dashboard
│   ├── live.tsx                # Scoreboard during play
│   ├── summary.tsx             # Post-match
│   ├── settings.tsx
│   ├── quick-match-setup.tsx
│   ├── auth/
│   │   ├── sign-in.tsx
│   │   ├── sign-up.tsx
│   │   └── forgot-password.tsx
│   ├── season/
│   │   ├── create.tsx
│   │   └── [id].tsx
│   ├── event/
│   │   ├── manage.tsx
│   │   └── [id].tsx
│   ├── match/
│   │   ├── setup.tsx
│   │   └── [id].tsx
│   ├── spectate/
│   │   ├── join.tsx
│   │   └── [code].tsx
│   └── +not-found.tsx
│
├── components/                 # Reusable UI components
│   ├── AdBanner.tsx            # AdMob banner (free tier)
│   ├── ScoreBoard.tsx          # Live match scoreboard
│   ├── StatPickerModal.tsx     # Stat selection modal
│   ├── PaywallModal.tsx        # Subscription upsell
│   ├── MatchErrorBoundary.tsx  # Error boundary with fallback
│   ├── LineupTracker.tsx       # Court positions display
│   ├── SubstituteModalContent.tsx
│   ├── ShareMatchModal.tsx     # Export/share match
│   ├── ServeChoiceModal.tsx    # Pre-match serve selection
│   ├── MatchSettingsModal.tsx
│   ├── ScoreEditModal.tsx      # Manual score adjustment
│   ├── EditLogEntryModal.tsx   # Edit past stat
│   ├── FullLogModal.tsx        # Complete match history
│   ├── EndOfSetModal.tsx       # Set completion confirmation
│   ├── OnboardingFlow.tsx      # First-launch tutorial
│   ├── VoiceInputOverlay.tsx   # Voice recording/confirmation modal
│   ├── VoiceActionCard.tsx     # Parsed voice action card (confirmation list)
│   ├── VoiceInputTipsModal.tsx # First-use voice tips/guidance
│   ├── ai/
│   │   ├── MagicSummaryCard.tsx  # AI narrative display
│   │   └── SocialSharePreview.tsx
│   ├── stats/
│   │   ├── StatsView.tsx       # Full stats page
│   │   ├── StatsSummary.tsx    # Quick stats overview
│   │   ├── DetailedStatsTable.tsx
│   │   ├── Leaderboard.tsx
│   │   └── ComparisonChart.tsx
│   ├── themed-text.tsx         # Dark/light theme text wrapper
│   ├── themed-view.tsx         # Dark/light theme view wrapper
│   ├── ui/
│   │   └── collapsible.tsx     # Accordion component
│   └── ... (utility components)
│
├── services/                   # External services
│   ├── ai/
│   │   ├── GeminiService.ts    # Google Gemini API wrapper
│   │   └── VoiceParsingService.ts # Gemini voice transcript → stat parser
│   ├── firebase/
│   │   ├── config.ts           # Firebase init
│   │   ├── AuthContext.tsx     # Auth provider
│   │   ├── index.ts            # Firebase helpers
│   │   ├── syncService.ts      # Firestore bidirectional sync
│   │   └── liveMatchService.ts # Realtime DB spectator broadcast
│   └── revenuecat/
│       └── RevenueCatService.ts # RevenueCat subscriptions wrapper
│
├── store/                      # Zustand stores
│   ├── useMatchStore.ts        # Live match state
│   ├── useDataStore.ts         # Seasons/events/matches + sync
│   └── useSubscriptionStore.ts # Device UUID + Pro status + free tier
│
├── types/
│   └── index.ts                # TypeScript interfaces (Season, Event, MatchRecord, StatLog, etc.)
│
├── constants/
│   ├── monetization.ts         # Free tier limits, AdMob/RevenueCat config, product IDs, pricing
│   └── voice.ts                # Voice input feature flag, config, stat vocabulary
│
├── hooks/                      # Custom React hooks
│   ├── useVoiceInput.ts        # Voice input lifecycle (record → parse → confirm → commit)
│   └── ... (theme, auth, etc.)
│
├── contexts/                   # React contexts (implied)
│   └── ThemeContext.tsx
│
├── assets/
│   ├── images/
│   │   ├── icon.png            # App icon
│   │   ├── splash-icon.png
│   │   ├── android-icon-*.png
│   │   └── favicon.png
│   └── fonts/
│
├── package.json
├── app.json                    # Expo configuration
├── tsconfig.json
├── .gitignore
├── .eslintrc.js
└── ... (build/config files)
```

### Key File Paths (Absolute)

- Package metadata: `/sessions/quirky-dreamy-hamilton/mnt/VolleyTrack/package.json`
- Expo config: `/sessions/quirky-dreamy-hamilton/mnt/VolleyTrack/app.json`
- Firebase config: `/sessions/quirky-dreamy-hamilton/mnt/VolleyTrack/services/firebase/config.ts`
- Monetization constants: `/sessions/quirky-dreamy-hamilton/mnt/VolleyTrack/constants/monetization.ts`
- Zustand stores: `/sessions/quirky-dreamy-hamilton/mnt/VolleyTrack/store/`
- Type definitions: `/sessions/quirky-dreamy-hamilton/mnt/VolleyTrack/types/index.ts`

---

## 5. Completed Development Phases

### Phase 1: Critical Bug Fixes (Foundation)
**Status:** ✅ Complete

Fixed core volleyball scoring logic and Firestore integration:
1. **Firestore Undefined Fields** — Removed `undefined` values when saving to Firestore (causes sync issues)
2. **Server Highlight Rotation** — Fixed court position display after rally wins
3. **Player Selection** — Ensured correct player is selected for stat logging in 2-player picker
4. **Block Attribution** — Block stats now correctly attributed to blocking player, not previous player
5. **Empty Slot Assignments** — Fixed crash when assigning players to empty court slots

### Phase 2: Firebase Auth + Firestore Sync (Cloud Backbone)
**Status:** ✅ Complete

Implemented user authentication and cloud data persistence:
1. **Email/Password Auth** — Sign up, sign in, password reset via Firebase Authentication
2. **Anonymous Fallback** — App works offline; users can sign in later to sync
3. **Bidirectional Sync**
   - Seasons, events, saved matches synced to Firestore
   - Merge logic: local + remote data combined on sync
   - Conflicts resolved via last-write-wins
4. **Firestore Structure:**
   ```
   users/{uid}/seasons/{seasonId}/...
   users/{uid}/events/{eventId}/...
   users/{uid}/savedMatches/{matchId}/...
   ```

### Phase 3: UI/UX Polish (Polish & Themes)
**Status:** ✅ Complete

Enhanced user experience and visual consistency:
1. **Dark/Light Themes** — Full theme support with context provider
   - Dark: Navy bg (#0d1117), cyan accent (#53caff)
   - Light: Gray bg (#f5f7fa), same cyan accent
2. **Redesigned Dashboard** — Cards, season list, quick-access match creation
3. **Improved Match Flow** — Smoother stat picker, clearer rotation display
4. **Settings Screen** — Theme toggle, account management, feedback

### Phase 4: Spectator View (Live Broadcasting)
**Status:** ✅ Complete

Real-time match broadcasting for live spectators:
1. **QR Code Generation** — Coach generates 6-character match code + QR
2. **Realtime Database Broadcast** — Coach updates `liveMatches/{matchCode}` with `LiveMatchSnapshot` on each score change
3. **Spectator Join** — Scan QR or enter code manually
4. **Live Display** — Spectators see score, current set, player roster, rotation in real-time
5. **Firestore Listener** — No polling; updates via Realtime DB listener

### Phase 5: Monetization (Revenue Model)
**Status:** ✅ Complete (iOS Production Key Configured; Android Key Pending)

Implemented free/Pro tier with RevenueCat + AdMob:

1. **Free Tier Limits** (device-based, persisted locally):
   - 1 active season
   - 3 AI narratives per device
   - 3 match exports per device
   - Banner ads displayed

2. **Pro Tier** (RevenueCat entitlement):
   - Unlimited seasons, narratives, exports
   - No ads
   - Pricing: $4.99/month, $34.99/year, $79.99 lifetime

3. **Integration Points:**
   - RevenueCat SDK detects entitlement from App Store receipt
   - `useSubscriptionStore` tracks Pro status
   - `PaywallModal` shown when free limits hit
   - AdMob banners shown on free-tier screens

4. **Device-Based Identity:**
   - No email required for free tier
   - Device UUID generated via `expo-crypto`
   - UUID sent to RevenueCat for anonymous entitlement checks

### Phase 6: Stats & Analytics (Advanced Insights)
**Status:** ✅ Complete

Comprehensive statistical analysis tools:
1. **Season/Event Stats** — Aggregated stats across multiple matches
2. **Leaderboards** — Top performers by category (Kills, Aces, Digs, Blocks)
3. **Comparison Charts** — Visualizing team vs opponent performance
4. **Detail Views** — Drill-down into specific match or player stats
5. **Date Range Filtering** — Analyze performance over specific periods

### Phase 7: User Onboarding & Discovery
**Status:** ✅ Complete

Features to help users master the app:
1. **Capabilities Tour** — 4-slide interactive tour showing features from basic to advanced
2. **Access Points** — "Feature Tour" available from Dashboard and Settings
3. **Progressive Disclosure** — Guides users from simple scorekeeping to power-user stats
4. **Native Integration** — Smooth animations and native-feel navigation

### Phase 8: Post-Beta Refinements (AI & Spectator Experience)
**Status:** ✅ Complete

Refined AI analysis and spectator engagement based on user feedback:
1. **AI Rally Reconstruction** — Implemented logic to group raw stat logs into rallies (Serve -> Dig -> Set -> Kill) before sending to Gemini, providing context on match flow and cause-and-effect.
2. **Spectator Full Match Log** — Added a read-only "View Full History" modal to the spectator screen, allowing fans to review the entire match event-by-event.
3. **Libero Visibility** — Fixed contrast issues for Libero player cards in Dark Mode (now uses adaptive background color).
4. **AI Narrative Persistence** — Ensures AI summaries are saved to the match record immediately upon generation.

### Phase 9: Spectator Experience 2.0 (Engagement & Social)
**Status:** ✅ Complete

Major overhaul of the spectator experience to increase engagement and retention:
1. **"Who Are You Cheering For?" Onboarding** — New personalized onboarding flow where spectators select the player(s) they are supporting.
2. **Smart Alerts** — Real-time notifications for spectators:
   - **Player Check-In:** Alerts when a tracked player rotates onto the court.
   - **Score Correction:** Dedicated button to flag score discrepancies to the coach.
   - **Emergency Alert:** High-friction "Stop Match" button for urgent safety issues.
3. **Community Overlay** — "Twitch-style" floating reaction stream (Fire, Clap, Volleyball emojis) and a "Lobby" view to see other active spectators.
4. **Match History** — Spectators can now "Save" a match to their local history and view it later from the Dashboard.
5. **Keep Awake** — Screen stays on automatically during match viewing (`expo-keep-awake` integration).

### Phase 10: Voice Input — Hands-Free Stat Tracking
**Status:** ✅ Complete

AI-powered voice input as a supplement to button-based stat tracking:

1. **On-Device Speech Recognition** — Uses `expo-speech-recognition` for real-time speech-to-text transcription with interim results and live transcript preview.
2. **Gemini AI Parsing** — Sends raw transcript to Google Gemini (`VoiceParsingService.ts`) with full roster context (names, jersey numbers, IDs), match state (pre-serve/in-rally, serving team), and stat vocabulary with synonyms. Returns structured `ParsedVoiceAction[]` with type, team, player, confidence.
3. **Confirmation Modal** — Parsed actions displayed as removable cards (`VoiceActionCard.tsx`) before committing. Users can delete individual actions, retry recording, or confirm all.
4. **Sequential Commit** — On confirm, calls `recordStat()` for each action in order (handles rally state machine transitions automatically) with rollback via `undo()` on failure.
5. **Feature Flag** — Entire feature gated behind `VOICE_INPUT_ENABLED` boolean in `constants/voice.ts`. Set to `false` to completely disable.
6. **Premium Feature** — Free tier: 3 voice-enabled matches per device (tracked by match ID array). Pro users: unlimited. Paywall shown when limit reached.
7. **User Guidance** — 4-slide tips modal (`VoiceInputTipsModal.tsx`) shown on first mic press. Covers best practices: speak naturally, keep it short, use jersey numbers, review before logging.
8. **Capabilities Tour** — New slide added to `CapabilitiesTour.tsx` introducing voice input.
9. **UI Integration** — Floating mic button positioned near the stat grid in `app/live.tsx`. Color-coded states: idle (blue), recording (red), parsing (amber), success (green).

**Key Files:**
- `constants/voice.ts` — Feature flag, limits, recording config, stat vocabulary
- `services/ai/VoiceParsingService.ts` — Gemini transcript parsing
- `hooks/useVoiceInput.ts` — Full lifecycle: recording → transcription → parsing → confirmation → commit
- `components/VoiceInputOverlay.tsx` — Recording/confirmation overlay modal
- `components/VoiceActionCard.tsx` — Individual parsed action card
- `components/VoiceInputTipsModal.tsx` — First-use tips
- `app/live.tsx` — Mic button integration + overlay wiring

**Cost:** ~$0.003/match for Gemini parsing (negligible impact on operating costs).

### Phase 11: Technical Maintenance & Hardening
**Status:** ✅ Complete

Addressed key technical debt and stability improvements:
1. **Type Safety** — Enforced strict typing for `AuthContext` to prevent implicit `any` usage.
2. **Error Handling** — Hardened `MatchErrorBoundary` against potential context crashes.
3. **Infrastructure** — Resolved Firebase `getReactNativePersistence` export issues (with suppression for wrapper type definitions).
4. **Documentation** — Added critical build warnings (folder naming) to README.

---

## 6. Monetization Details

### Free Tier Configuration
File: `/constants/monetization.ts`

```typescript
export const FREE_AI_NARRATIVE_LIMIT = 3;
export const FREE_EXPORT_LIMIT = 3;
export const FREE_SEASON_LIMIT = 1;
export const FREE_VOICE_MATCH_LIMIT = 3;  // from constants/voice.ts
```

### Pro Subscription Products
File: `/constants/monetization.ts`

```typescript
export const PRODUCT_IDS = {
  monthly: 'pro_monthly',    // Apple App Store ID: 6759176199
  annual: 'pro_annual',      // Apple App Store ID: 6759177179
  lifetime: 'pro_lifetime',  // Apple App Store ID: 6759177245
};

export const PRICING = {
  monthly: { price: '$4.99', period: '/month' },
  annual: { price: '$34.99', period: '/year', savings: '42%' },
  lifetime: { price: '$79.99', period: 'one-time' },
};
```

### RevenueCat Configuration
File: `/constants/monetization.ts`

```typescript
// Production API Key (iOS / Apple)
const REVENUECAT_IOS_KEY = 'appl_ePZNxNFIVWTwPIlNAaFKXHNPUxN';

export const ENTITLEMENT_ID = 'HarpElle / VolleyTrack Pro';
export const OFFERING_ID = 'default';
```

**Status:** ✅ Production iOS key configured and ready for App Store submission. Android key still needed for Google Play launch.

### AdMob Configuration
File: `/constants/monetization.ts`

**Test Banner IDs** (development, safe to click):
- iOS: `ca-app-pub-3940256099942544/2934735716`
- Android: `ca-app-pub-3940256099942544/6300978111`

**Production Banner IDs:**
- iOS: `ca-app-pub-4048915758307061/9820858426`
- Android: `ca-app-pub-4048915758307061/6863522594`

**App IDs** (in `app.json`):
- iOS: `ca-app-pub-4048915758307061~9420470963`
- Android: `ca-app-pub-4048915758307061~7721308693`

### Usage Tracking
File: `/store/useSubscriptionStore.ts`

Free tier usage is tracked locally and **NOT synced to cloud** (to prevent sharing across devices):

```typescript
interface SubscriptionState {
  aiNarrativesUsed: number;      // Incremented when narrative generated
  exportsUsed: number;           // Incremented when match exported
  voiceMatchIds: string[];       // Match IDs that have used voice input
  // ...
  canUseAINarrative(): boolean;  // true if isPro || aiNarrativesUsed < 3
  canUseExport(): boolean;       // true if isPro || exportsUsed < 3
  canUseVoiceInput(matchId): boolean; // true if isPro || matchId already registered || voiceMatchIds.length < 3
}
```

**Persistence:** Stored in AsyncStorage under key `'volleytrack-subscription'` (survives app uninstall on same device if app cache preserved).

---

## 7. Key Design Patterns

### 7.1 Dark/Light Mode

**Implementation:**
```typescript
// In components, use ThemeContext
const { colors } = useTheme();

// Dark mode colors
const darkColors = {
  bg: '#0d1117',
  bgCard: '#161b22',
  text: '#e6edf3',
  primary: '#53caff',
};

// Light mode colors
const lightColors = {
  bg: '#f5f7fa',
  bgCard: '#ffffff',
  text: '#1a1a2e',
  primary: '#53caff',
};
```

**Wrapper Components:**
- `<ThemedView>` — Auto-switches background color based on theme
- `<ThemedText>` — Auto-switches text color based on theme

**System Integration:** `app.json` has `"userInterfaceStyle": "automatic"` to respect OS preference.

### 7.2 Stat Logging & Undo

**Logging Pattern:**
```typescript
// When user taps "Ace" button
useMatchStore.recordStat('ace', 'myTeam', playerId);

// Internally:
// 1. Create StatLog with current score snapshot
// 2. Increment my team score by 1
// 3. Append StatLog to history
// 4. Update serving team / rotation if needed
```

**Undo Pattern:**
```typescript
const lastLog = history[history.length - 1];
const { scoreSnapshot, rotationSnapshot } = lastLog;

// 1. Pop lastLog from history
// 2. Restore scores from scoreSnapshot
// 3. Restore rotation from rotationSnapshot (if applicable)
```

### 7.3 Set Management

**Set Advancement Logic:**
```typescript
// After endRally(winner):
if (scores[currentSet - 1].myTeam >= config.sets[currentSet - 1].targetScore &&
    scores[currentSet - 1].myTeam - scores[currentSet - 1].opponent >= config.sets[currentSet - 1].winBy) {
  // My Team won this set
  setsWon.myTeam++;

  // Check if match is over
  if (setsWon.myTeam > totalSets / 2) {
    // Match complete
    finalizeMatch();
  } else {
    // Start next set
    startNextSet();
  }
}
```

### 7.4 Momentum Tracker (Implied)

While not explicitly in Phase list, the `history` and `setHistory` enable momentum analysis:
- Track points scored by each team in sequence
- Identify serving streaks
- Analyze player performance across multiple matches
- Used in AI narrative generation

### 7.5 Rotation System

**Court Positions:** P1 (right back) to P6 (left front), in order around court
```
        P3 - P2 - P1
        P4 - P5 - P6
   (net in middle)
```

**Rotation Flow:**
1. Serve ends rally (score awarded)
2. If serving team won, they serve again (no rotation)
3. If receiving team won, they get serve + **rotation occurs**
4. Rotation advances P1→P2→P3→...→P6→P1

**Player Substitution:**
- Can swap any court position with a bench player
- Liberos have special rules (can only play back row, unlimited subs)
- `substitute(position: 1-6, player)` handles sub tracking

**Lineup Tracking:**
```typescript
lineups: Record<number, LineupPosition[]>  // Set number -> [P1-P6 positions]

interface LineupPosition {
  position: 1 | 2 | 3 | 4 | 5 | 6;
  playerId: string | null;
  isLibero: boolean;
  designatedSubId?: string;  // Default sub for this player
}
```

---

## 8. Known Issues & Technical Debt

### Pre-Existing TypeScript Errors
Detailed maintenance plan available in [TECHNICAL_MAINTENANCE.md](TECHNICAL_MAINTENANCE.md).

These errors do not block builds but should be addressed:

1. **FirebaseAuthContext Implicit Any**
   - Location: `/services/firebase/AuthContext.tsx`
   - Issue: Some auth context values typed as `any` instead of specific types
   - Impact: Type safety reduced in auth-dependent components
   - Fix: Add explicit types to context provider

2. **getReactNativePersistence Export**
   - Location: Firebase auth initialization
   - Issue: `getReactNativePersistence` from `firebase/auth/react-native` not properly exported
   - Impact: AsyncStorage persistence may not work correctly across app restarts
   - Fix: Check Firebase version compatibility; may need to use alternative persistence strategy

3. **MatchErrorBoundary Context Issue**
   - Location: `/components/MatchErrorBoundary.tsx`
   - Issue: Context provider used without proper type narrowing
   - Impact: Error boundary may not catch certain component errors
   - Fix: Add type guards before consuming context

---

## 9. Pending Items & Launch Blockers

### Before App Store Submission (Production Launch)

1. **Production RevenueCat API Key**
   - ✅ **DONE:** iOS production key `appl_ePZNxNFIVWTwPIlNAaFKXHNPUxN` configured in `/constants/monetization.ts`
   - Android key still needed when Google Play is set up

2. **Google Play Setup (Android)**
   - Status: AdMob app IDs configured; RevenueCat Android key not yet configured
   - Action Needed:
     - Set up Google Play Console project
     - Create in-app subscription products (monthly, annual, lifetime)
     - Generate Android-specific RevenueCat API key
     - Update `/constants/monetization.ts` with Android key (separate from iOS if needed)
   - Timeline: Can be done after iOS launch or in parallel

3. **Subscription Group Configuration (Apple)**
   - Status: Configured in App Store Connect
   - Group Name: `VolleyTrack Pro`
   - Products: `pro_monthly`, `pro_annual`, `pro_lifetime`
   - Action: Verify all 3 products are in same subscription group before submission

4. **Firebase Project Production Readiness**
   - Firestore security rules should restrict access to authenticated users only
   - Test with real App Store purchases to verify entitlement sync
   - Test with real App Store purchases to verify entitlement sync
   - Monitor Firestore quotas

### Phase 8: Security & Architecture (Pre-Launch Verified)
**Status:** ✅ Complete

Critical infrastructure hardening for production:
1.  **API Security:** All API keys (Firebase, Gemini) moved to `.env` file (gitignored)
2.  **Native Build:** iOS project regenerated (`prebuild --clean`) to fix `EXConstants` issues
3.  **Path Safety:** Identified and verified fix for Xcode build failures caused by spaces in project path
4.  **Testing Limits:** Free tier limits temporarily increased (100) for TestFlight testing

### Sandbox Testing Complete
- ✅ RevenueCat sandbox purchases tested on iOS
- ✅ Free tier limits enforced locally
- ✅ Paywall modal displays correctly
- ✅ AdMob test ads render (will switch to production ads in build)

---

## 10. Planned Enhancements

## 10. Planned Enhancements & Roadmap

### 10.1 Spectator Experience (Viewer 2.0)
*Status: ✅ Complete (See Phase 9)*

1.  **Engagement Ideas (Future)**
    *   **"Virtual High Five":** (✅ Complete) Prompt spectators to high-five when their players make a big play (Ace/Block/Kill).
    *   **Spectator Cheer Meter:** (✅ Complete) Shows real-time "Energy Level" combining manual tapping and microphone volume (decibels). User opts-in to mic usage.

### 10.2 Coach & Analyst Features

4.  **Voice-Based Stat Tracking** ✅ Complete (See Phase 10)
    *   Transcribe spoken play descriptions: "Ace on serve", "Block on 3".
    *   Uses `expo-speech-recognition` + Gemini AI to parse speech → stat actions.
    *   Floating mic button on live match screen, confirmation modal before commit.

5.  **Quick Match Lineup Intelligence** (✅ Complete)
    *   Currently, lineups copy forward from Set 1.
    *   **Enhancement:** Auto-rotate the forwarded lineup (forward/backward) based on whether the team served first in the previous set.

    *   Per-player stats across multiple matches (Season aggregations).
    *   Trend analysis (improve/decline over season).

### 10.3 UI Refinements
8.  **Icon Sizing**
    *   **Status:** ✅ Complete
    *   Increase touch target size for Heart/Alert/Star icons in the Spectator/Live view.

### 10.4 Third-Party Data Integrations (New)
9.  **External Schedule Import**
    *   **Status:** 📅 Planned
    *   Allow users to import team rosters and event/match schedules from popular platforms:
        *   **Advanced Event Systems (AES)**
        *   **TeamSnap**
        *   Other sources (SportsEngine, etc.)

---

## 11. App Store Configuration

### iOS / App Store

**Bundle ID:** `com.harpelleapps.volleytrack`

**App Store Configuration:**
- Project: `HarpElle` (in both Apple Developer and RevenueCat)
- Subscription Group: `VolleyTrack Pro`
- Product IDs:
  - `pro_monthly` (Apple ID: 6759176199) → $4.99/month
  - `pro_annual` (Apple ID: 6759177179) → $34.99/year
  - `pro_lifetime` (Apple ID: 6759177245) → $79.99 (non-consumable)

**AdMob Configuration:**
- App ID: `ca-app-pub-4048915758307061~9420470963`
- Banner Ad Unit (iOS): `ca-app-pub-4048915758307061/9820858426`

**Expo Configuration** (in `app.json`):
```json
{
  "ios": {
    "bundleIdentifier": "com.harpelleapps.volleytrack",
    "supportsTablet": true,
    "infoPlist": {
      "ITSAppUsesNonExemptEncryption": false,
      "NSSpeechRecognitionUsageDescription": "VolleyTrack uses speech recognition for hands-free stat tracking during matches.",
      "NSMicrophoneUsageDescription": "VolleyTrack needs microphone access to transcribe your voice commands for stat tracking."
    }
  }
}
```

### Android / Google Play

**Package Name:** `com.harpelleapps.volleytrack`

**Google Play Configuration:**
- Subscription products: To be created (mirrors iOS)
- AdMob App ID: `ca-app-pub-4048915758307061~7721308693`
- Banner Ad Unit (Android): `ca-app-pub-4048915758307061/6863522594`

**Expo Configuration** (in `app.json`):
```json
{
  "android": {
    "package": "com.harpelleapps.volleytrack",
    "adaptiveIcon": { ... },
    "edgeToEdgeEnabled": true
  }
}
```

**RevenueCat Android Key:** To be added once Google Play setup complete.

---

## 12. Important Notes & Gotchas

### Device UUID & Anonymous Auth
- **Free Tier Lock:** Users on free tier are **device-locked**, not email-locked
  - Same device, different email → same usage counters
  - Different device, same email → separate usage counters
- **Pro Subscription:** Tied to device UUID sent to RevenueCat
  - If user uninstalls and reinstalls on same device, subscription is recovered
  - If user switches devices, they can re-purchase or use app-specific restore mechanisms

### Firebase Silent Auth Restore
- **On App Start:** AuthContext checks AsyncStorage for cached `authToken`
- **Timing:** Auth restore is async; app may render before auth state known
- **Pattern:** Root `_layout.tsx` should show loading state until `auth.loading === false`
- **Fallback:** If auth fails to restore, user remains anonymous and can sign in later

### Firestore Sync Conflicts
- **Design:** Last-write-wins; no conflict resolution UI
- **Scenario:** User offline, edits season locally, then comes online
  - Local changes pushed to Firestore
  - If cloud had newer version, local version overwrites it
- **Risk:** Data loss if user expects cloud version to be preserved
- **Mitigation:** Consider adding timestamp checks or user-facing conflict warnings in future

### StatLog Snapshots
- **Why Snapshots:** Each stat log stores score/rotation at time of event
- **Purpose:** Enables accurate undo (restore exact state, not just decrement score)
- **Memory:** Snapshots increase JSON size per stat; negligible for typical match (100 stats = ~10KB)

### Ads & Revenue
- **Test Ads:** Always shown in dev mode; safe to click during testing
- **Production Ads:** Real ads only served in production builds
- **Frequency:** Currently banner ads; interstitial ads not yet implemented
- **Free Tier Only:** Pro users see no ads

---

## 13. Quick Reference: Key Files & Locations

### State Management
- **Live Match:** `/store/useMatchStore.ts`
- **Cloud Data:** `/store/useDataStore.ts`
- **Subscription:** `/store/useSubscriptionStore.ts`

### Firebase Services
- **Config:** `/services/firebase/config.ts`
- **Auth:** `/services/firebase/AuthContext.tsx`
- **Cloud Sync:** `/services/firebase/syncService.ts`
- **Live Broadcast:** `/services/firebase/liveMatchService.ts`

### Voice Input
- **Feature Config:** `/constants/voice.ts`
- **AI Parser:** `/services/ai/VoiceParsingService.ts`
- **Lifecycle Hook:** `/hooks/useVoiceInput.ts`
- **Overlay UI:** `/components/VoiceInputOverlay.tsx`
- **Action Card:** `/components/VoiceActionCard.tsx`
- **Tips Modal:** `/components/VoiceInputTipsModal.tsx`

### Monetization
- **Constants:** `/constants/monetization.ts`
- **RevenueCat:** `/services/revenuecat/RevenueCatService.ts`
- **Paywall UI:** `/components/PaywallModal.tsx`
- **Ads:** `/components/AdBanner.tsx`

### Type Definitions
- **All Types:** `/types/index.ts` (Season, Event, MatchRecord, StatLog, Player, etc.)

### Key Routes
- **Home:** `/app/index.tsx`
- **Live Score:** `/app/live.tsx`
- **Match Summary:** `/app/summary.tsx`
- **Settings:** `/app/settings.tsx`
- **Spectate Join:** `/app/spectate/join.tsx`
- **Spectate View:** `/app/spectate/[code].tsx`

### UI Components
- **Score Board:** `/components/ScoreBoard.tsx`
- **Stat Picker:** `/components/StatPickerModal.tsx`
- **Paywall:** `/components/PaywallModal.tsx`
- **AI Summary:** `/components/ai/MagicSummaryCard.tsx`
- **Stats View:** `/components/stats/StatsView.tsx`

---

## 14. How to Continue Development

### Setting Up a Fresh Clone
1. Clone repository
2. Run `npm install`
3. Create `.env` or use default Firebase config (already in `config.ts`)
4. For testing: Keep RevenueCat sandbox key; ads will show test ads
5. Run `npm start` or `expo start`

### Making Changes
- **Stores:** Edit `/store/*.ts` directly; Zustand handles persistence
- **Screens:** Edit `/app/**/*.tsx` routes
- **Components:** Add to `/components/` and import
- **Services:** Update `/services/` for API integrations
- **Constants:** Update `/constants/monetization.ts` for pricing/free limits

### Testing Subscriptions
1. Use RevenueCat sandbox key (already configured)
2. Install on physical device
3. Use test Apple ID in App Store settings
4. Purchase will complete in sandbox
5. Check `useSubscriptionStore.isPro` to verify entitlement is set

### Building for App Store
1. Ensure folder name is correct for xcodebuild
2. Increment version in `package.json` and `app.json`
3. Update `REVENUECAT_API_KEY` with production key before final submission
4. Run `eas build --platform ios` (requires EAS CLI + account)
5. Monitor build logs for any TypeScript errors (known issues listed above)

### Common Tasks
- **Add Free Tier Limit:** Update `/constants/monetization.ts` constants
- **Change Subscription Price:** Update `/constants/monetization.ts` PRICING object; actual prices come from store
- **Add New Stat Type:** Add to `StatLog['type']` union in `/types/index.ts`, then add handler in `useMatchStore.recordStat()`
- **Add Themed Component:** Use `<ThemedView>` and `<ThemedText>` wrappers or access `useTheme()` hook
- **Disable Voice Input:** Set `VOICE_INPUT_ENABLED = false` in `/constants/voice.ts` — all voice UI disappears
- **Change Voice Free Tier Limit:** Update `FREE_VOICE_MATCH_LIMIT` in `/constants/voice.ts`

---

## Summary

VolleyTrack is a mature, feature-complete MVP volleyball app with:
- ✅ Real-time match scoring with advanced stat logging
- ✅ **Voice input for hands-free stat tracking** (Gemini AI-powered)
- ✅ Cloud persistence via Firebase (Firestore + Realtime DB)
- ✅ Monetization with free/Pro tiers (RevenueCat + AdMob)
- ✅ Spectator mode for live match viewing
- ✅ AI-powered post-match narratives (Gemini)
- ✅ Dark/light themes
- ✅ Account management and settings

**Current Status:** Production-ready. iOS RevenueCat production key configured. Ready for App Store submission.

**Tech Debt:** Minor TypeScript type annotations needed; folder naming workaround required for builds.

**Voice Input Note:** Feature gated behind `VOICE_INPUT_ENABLED` flag in `constants/voice.ts`. Set to `false` to fully disable without removing code.

## 15. Feedback & Known Issues (Post-Phase 9 Verification)

### ✅ Recently Resolved (Critical Fixes & Verbal Input)
1.  **Spectator Screen Dimming**
    *   **Status:** Fixed (Added `expo-keep-awake` to `app/spectate/[code].tsx`).
2.  **UI Shift on Set/Match Point**
    *   **Status:** Fixed (Added `minWidth` to score text containers).
3.  **Momentum Bar Timeout Prompt**
    *   **Status:** Fixed (Momentum tracker now respects `dismissedAtScore` to prevent spamming).
4.  **AI Player ID Fallback**
    *   **Status:** Fixed (`GeminiService` correctly handles missing player IDs).
5.  **Viewer AI Limit**
    *   **Status:** Fixed (Limit raised to 50 for testing in `constants/monetization.ts`).
6.  **Delete Season/Team**
    *   **Status:** Fixed (Added "Delete" option in settings).
7.  **Missing Lineup in Set 3**
    *   **Status:** Fixed (Corrected `startNextSet()` logic for tiebreaker).
8.  **Event Data Gaps**
    *   **Status:** Fixed (Resolved `useDataStore` sync/caching issues).
9.  **Summary Stats 0**
    *   **Status:** Fixed (Corrected `calculateStats` logic in summary screen).
10. **Undo Haptics**
    *   **Status:** Fixed (Added haptic feedback to undo action).
11. **Pricing Text Wrapping**
    *   **Status:** Fixed (Adjusted font sizing/layout in `PaywallModal`).
12. **AI Stat Accuracy**
    *   **Status:** Fixed (Refined prompt data formatting to reduce hallucinations).

### ℹ️ Notes
- **AI Analysis Persistence:** Verified as fixed via `useMatchStore` persistence.
- **Haptics:** General haptics working; specific gaps (Undo) listed above.

