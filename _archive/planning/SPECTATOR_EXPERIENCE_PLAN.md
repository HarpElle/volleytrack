# VolleyTrack Spectator Experience — Enhancement Plan

## Executive Summary

This document contains a detailed review of the current Spectator experience in VolleyTrack, identifies specific gaps, and provides actionable implementation plans for each enhancement area. The audience for this plan is an AI coding agent (Claude Code, Gemini, etc.) that will implement these changes.

The overarching design philosophy: **VolleyTrack's spectators are parents watching their kids play volleyball.** Every feature should make them feel connected to the action, proud of their players, and part of a community of families sharing this experience together.

---

## Current State Assessment

### What Exists Today

| Feature | Status | Quality | Notes |
|---------|--------|---------|-------|
| Live score viewing | ✅ Done | Good | Real-time Firestore sync, ScoreBoard read-only mode |
| Play-by-play feed | ✅ Done | Good | Last 15 events per set, full log modal |
| Lineup tracker | ✅ Done | Good | Read-only rotation view |
| Spectator onboarding | ✅ Done | Good | Name entry + player selection ("Who are you cheering for?") |
| Score correction alert | ✅ Done | **Needs Work** | Sends generic message; doesn't use the `suggestedScore` field in the type |
| Emergency alert | ✅ Done | **Needs Work** | Basic native Alert.alert; no ability to add context |
| Emoji reactions | ✅ Done | **Needs Work** | Only 3 in bottom bar (👏🔥❤️); 6 total in floater map |
| Cheer button | ✅ Done | Good | Heart icon with burst animation and cheer count |
| Cheer Meter | ✅ Done | Good | Mic + tap-to-cheer with color-coded intensity bar |
| Spectator Lobby | ✅ Done | **Needs Work** | Shows viewers and cheering-for, but no interaction (TODO comment: "Add High Five button?") |
| Super Fan Recap | ✅ Done | Good | AI-powered player recap with sharing |
| Player Check-In | ✅ Done | Good | Alert when cheered-for player rotates onto court |
| Share (coach side) | ✅ Done | Good | QR code, match code, deep link, native share |
| Share (spectator side) | ❌ Missing | — | Match code visible in tiny 10px text; no share action |
| Spectator-to-spectator chat | ❌ Missing | — | No community features between spectators |
| Volleyball-specific reactions | ❌ Missing | — | Only generic 🏐; no dig/spike/block/stuff reactions |
| Sport-specific reaction context | ❌ Missing | — | Reactions aren't tied to game moments |

### Architecture Notes for Implementors

- **Tech stack:** React Native + Expo 54, Zustand stores, Firebase Firestore real-time sync
- **Real-time pattern:** Firestore `onSnapshot` listeners on `liveMatches/{code}` documents
- **Reaction storage:** `liveMatches/{code}/reactions` subcollection (high-throughput writes)
- **Alert storage:** `spectatorAlerts` array field on main document, using `arrayUnion` for conflict-free appends
- **Spectator identity:** Device-based (no auth required), stored in AsyncStorage
- **Key files:**
  - `app/spectate/[code].tsx` — Main spectator screen
  - `components/SpectatorReactionBar.tsx` — Bottom action bar
  - `components/spectator/CheerMeter.tsx` — Audio/tap cheer meter
  - `components/SpectatorOnboardingModal.tsx` — Name + player selection
  - `components/SpectatorLobbyModal.tsx` — Viewer list
  - `components/SuperFanRecapModal.tsx` — AI recap generator
  - `components/ReactionFloater.tsx` — Floating emoji animations
  - `hooks/useSpectatorInteractions.ts` — Alert, cheer, and presence logic
  - `hooks/useSpectatorMatch.ts` — Real-time match subscription
  - `hooks/useIncomingReactions.ts` — Reaction listener
  - `services/firebase/spectatorInteractionService.ts` — Firebase write operations
  - `types/index.ts` — All TypeScript interfaces

---

## Enhancement 1: Score Correction Alert (Redesigned)

### Problem

The current implementation sends a generic "A spectator thinks the score may need checking" message. The `suggestedScore` field exists in the `SpectatorAlert` type but the UI never populates it. The coach receives a vague notification with no actionable information about what the spectator thinks the score should be.

### Design Goal

Make it trivially easy for a parent to say "Hey, the score table says 18-15, but you have 18-14" — and have the coach see both numbers side by side instantly.

### Implementation Plan

#### Step 1: Create `ScoreCorrectionModal` Component

**File:** `components/spectator/ScoreCorrectionModal.tsx`

Create a new modal component that replaces the current `Alert.alert` for score corrections:

```
Visual Layout:
┌─────────────────────────────────────┐
│        Score Doesn't Match?         │
│                                     │
│  What the app shows:                │
│  ┌───────────────────────────────┐  │
│  │   Eagles  18  -  14  Panthers │  │  (read-only, pulled from live state)
│  └───────────────────────────────┘  │
│                                     │
│  What the score table shows:        │
│  ┌──────────┐    ┌──────────┐       │
│  │  [  18 ] │ -  │  [  15 ] │       │  (editable, pre-filled with current score)
│  └──────────┘    └──────────┘       │
│  (tap the number that's different)  │
│                                     │
│  Optional note:                     │
│  ┌───────────────────────────────┐  │
│  │  "Ref missed the last point"  │  │  (TextInput, max 100 chars)
│  └───────────────────────────────┘  │
│                                     │
│  [ Cancel ]     [ Send to Coach ]   │
│                                     │
│  ⚠ Cooldown: 30s between alerts     │
└─────────────────────────────────────┘
```

**Key implementation details:**
- Pre-fill the "score table shows" fields with the current score from `state.scores[state.currentSet - 1]`
- Highlight the changed number(s) in the team's primary color when they differ from the app score
- The `suggestedScore` field in the alert payload should contain the spectator's entered score
- Include the `currentSet` number in the alert
- Disable "Send" button unless at least one number differs from the app score
- Show cooldown timer if within the 30s window (reuse existing `alertCooldownRemaining`)

#### Step 2: Update `SpectatorAlert` Handling in Coach View

**File:** `components/CoachAlertToast.tsx` (existing, needs update)

Update the coach-side toast to render score correction alerts with a comparison view:

```
Toast Layout (score_correction type):
┌─────────────────────────────────────────────┐
│ 📊 Score Check from "Coach Mom"             │
│                                             │
│ App: 18-14  →  Score Table: 18-15  (Set 2)  │
│ "Ref missed the last point"                 │
│                                             │
│                            [ Dismiss ]  [X] │
└─────────────────────────────────────────────┘
```

- Parse `alert.suggestedScore` and compare with current match score
- Highlight the differing number(s) in red/warning color
- Show the optional message if present
- Make the toast taller and more prominent for score corrections (they are actionable)

#### Step 3: Wire Up in Spectator Screen

**File:** `app/spectate/[code].tsx`

- Replace the `handleScoreAlert` function's `Alert.alert` call with opening the new `ScoreCorrectionModal`
- Pass `state.scores[state.currentSet - 1]`, `state.myTeamName`, `state.opponentName`, `state.currentSet`
- On submit, call `interactions.sendAlert('score_correction', { suggestedScore, message })` as before

#### Step 4: Update Alert Payload

**File:** `hooks/useSpectatorInteractions.ts`

- In the `sendAlert` function, ensure `suggestedScore` is properly passed through to `sendSpectatorAlert`
- No type changes needed — `SpectatorAlert` already has the `suggestedScore?: Score` field

---

## Enhancement 2: Emergency Alert (Redesigned)

### Problem

The current emergency alert is a native `Alert.alert` with just a "STOP MATCH" confirmation. There is no way for the spectator to communicate WHAT the emergency is, leaving the coach to look around and guess.

### Design Goal

A high-urgency, visually distinct alert that conveys "something is wrong, call timeout NOW" — with the ability to provide brief context about the issue.

### Implementation Plan

#### Step 1: Create `EmergencyAlertModal` Component

**File:** `components/spectator/EmergencyAlertModal.tsx`

```
Visual Layout:
┌─────────────────────────────────────┐
│  🚨  EMERGENCY STOP                 │
│                                     │
│  This will immediately alert the    │
│  coach to stop play.                │
│                                     │
│  What's happening?                  │
│  ┌─────────┐ ┌──────────┐          │
│  │🤕 Injury│ │🩹 Safety │          │
│  └─────────┘ └──────────┘          │
│  ┌─────────┐ ┌──────────┐          │
│  │📋 Wrong │ │⚠️ Other  │          │
│  │  Player │ │          │          │
│  └─────────┘ └──────────┘          │
│                                     │
│  Details (optional):                │
│  ┌───────────────────────────────┐  │
│  │  "#7 is limping on back row"  │  │
│  └───────────────────────────────┘  │
│                                     │
│  [ Cancel ]   [ 🚨 SEND ALERT ]    │
│  (red background, bold)             │
│                                     │
│  ⚠ Use only for genuine emergencies │
└─────────────────────────────────────┘
```

**Key implementation details:**
- Emergency category chips: "Injury", "Safety Issue", "Wrong Player In", "Other"
- The selected category is included in the alert message for instant context
- The "Send Alert" button should be red/destructive-styled
- The alert message sent to the coach should be structured: `[CATEGORY]: [details]` (e.g., "INJURY: #7 is limping on back row"). If no details provided, just send the category (e.g., "INJURY"). Store the category in the `message` field of the `SpectatorAlert` type.
- Uses the same 30s cooldown as score correction (shared `canSendAlert` flag)
- Add haptic feedback (long vibration) when sending to reinforce the gravity

#### Step 2: Enhance Coach-Side Emergency Toast

**File:** `components/CoachAlertToast.tsx`

For emergency type alerts:
- Use a red/error background color instead of the standard toast style
- Add a pulsing border animation to draw immediate attention
- Show the category prominently: "🚨 INJURY — from Coach Mom"
- Show the details message
- Play a distinct notification sound if available (or strong haptic)
- Emergency toasts should NOT auto-dismiss (require manual dismissal)
- Consider making the toast larger/full-width for emergencies

#### Step 3: Wire Up in Spectator Screen

**File:** `app/spectate/[code].tsx`

- Replace the `handleEmergencyAlert` function's `Alert.alert` with the new `EmergencyAlertModal`
- Pass necessary state (roster for "wrong player" context)
- On submit, call `interactions.sendAlert('emergency', { message: formattedMessage })`

---

## Enhancement 3: Spectator Community — Fan Zone Chat

### Problem

Spectators currently have zero interaction with each other. The Spectator Lobby shows who's watching but offers no engagement. This is a missed opportunity — parents at volleyball games naturally chat, cheer together, and share excitement. VolleyTrack should capture that energy digitally.

### Design Goal

Create a lightweight, fun, game-day chat that feels like sitting in the bleachers together. NOT a full messaging app — think "quick reactions and short bursts" rather than long conversations.

### Implementation Plan

#### Step 1: Create Firestore Subcollection for Chat Messages

**Firestore path:** `liveMatches/{matchCode}/chat/{messageId}`

**New type definition to add to `types/index.ts`:**

```typescript
export interface SpectatorChatMessage {
  id: string;
  senderDeviceId: string;
  senderName: string;
  text: string;
  timestamp: number;
  type: 'message' | 'celebration' | 'reaction_context';
  // For celebration type: auto-generated when big plays happen
  triggerEvent?: string; // e.g., 'ace', 'kill', 'block'
  triggerPlayerName?: string;
  // For reaction_context: links a reaction to game context
  linkedStatId?: string;
}
```

**Firestore rules considerations:**
- Limit message length to 200 characters
- Rate-limit to 1 message per 5 seconds per device (enforce client-side; optionally server-side with Cloud Functions)
- Auto-delete messages older than the match duration (or TTL via Cloud Function)

#### Step 2: Create `FanZoneModal` Component

**File:** `components/spectator/FanZoneModal.tsx`

This is a bottom-sheet-style modal (similar to `SpectatorLobbyModal`) that shows the live chat:

```
Visual Layout:
┌─────────────────────────────────────┐
│  Fan Zone 🏐   [12 fans]      [X]  │
│─────────────────────────────────────│
│                                     │
│  🎉 ACE by #7 Sarah!               │  (auto-generated celebration, styled differently)
│                                     │
│  Coach Mom: LET'S GOOO!!           │
│  Dave P: That serve was 🔥          │
│  Grandpa Joe: Is #12 playing next?  │
│                                     │
│  🎉 KILL by #3 Emma!               │  (auto-generated)
│                                     │
│  Sarah's Dad: THAT'S MY GIRL!!     │
│  Coach Mom: What a play!            │
│                                     │
│─────────────────────────────────────│
│  ┌──────────────────────────┐  [➤] │
│  │ Say something...         │       │
│  └──────────────────────────┘       │
│                                     │
│  [👏] [🔥] [❤️] [🏐] [💪] [LFG!]  │  (Quick-send chips)
└─────────────────────────────────────┘
```

**Key implementation details:**
- Uses a FlatList with `inverted={true}` for chat-style scrolling (newest at bottom)
- Subscribe to `liveMatches/{matchCode}/chat` with `orderBy('timestamp', 'desc')`, `limit(50)`
- Messages styled with sender name in bold, message text below
- Auto-generated celebration messages styled differently (gold/amber background, larger text, centered)
- Quick-send chips at the bottom send pre-formatted messages instantly without typing
- The quick-send chips should be: 👏 (sends "👏👏👏"), 🔥 (sends "🔥🔥🔥"), ❤️ (sends "❤️"), 🏐 (sends "🏐"), 💪 (sends "Let's go!"), "LFG!" (sends "LET'S GOOO!")
- Input field limited to 200 characters
- 5-second cooldown on sending (show brief disabled state on send button)
- Messages should show relative time ("just now", "1m ago")

#### Step 3: Create Chat Service

**File:** `services/firebase/spectatorChatService.ts`

Functions to implement:
- `sendChatMessage(matchCode, deviceId, senderName, text, type)` — Write to subcollection
- `subscribeToChatMessages(matchCode, callback, limit)` — Real-time listener with limit
- `sendCelebrationMessage(matchCode, eventType, playerName)` — Auto-generated celebrations

#### Step 4: Create `useFanZoneChat` Hook

**File:** `hooks/useFanZoneChat.ts`

```typescript
export function useFanZoneChat(matchCode: string, deviceId: string, senderName: string) {
  // State: messages[], isLoading, canSend (cooldown)
  // Subscribe to chat subcollection on mount
  // Expose: sendMessage(text), sendQuickReaction(type), messages
  // Handle 5-second send cooldown
  // Cleanup subscription on unmount
}
```

#### Step 5: Auto-Generate Celebration Messages

**File:** `app/spectate/[code].tsx` (or a new hook)

When a rally-ending event is detected in the play-by-play feed (aces, kills, blocks by the home team), auto-send a celebration message to the chat:

- Ace: "🎉 ACE by #7 Sarah!"
- Kill: "🔥 KILL by #3 Emma!"
- Block: "🧱 STUFF BLOCK by #12 Madison!"
- Multi-point run: "🔥 3 points in a row! [Team] on a run!"

These are `type: 'celebration'` messages and styled distinctly (not attributed to any spectator).

**Important:** Only generate celebrations for the home team (myTeam), since spectators are fans.

#### Step 6: Add Fan Zone Button to Reaction Bar

**File:** `components/SpectatorReactionBar.tsx`

- Add a new "chat bubble" icon button (use `MessageCircle` from lucide-react-native)
- Show an unread badge (dot or count) when new messages arrive while the modal is closed
- Wire to open the `FanZoneModal`

#### Step 7: Integrate into Spectator Screen

**File:** `app/spectate/[code].tsx`

- Add `showFanZone` state variable
- Add `FanZoneModal` to the render tree
- Pass `onOpenFanZone` to `SpectatorReactionBar`
- Initialize `useFanZoneChat` hook

---

## Enhancement 4: Spectator-Side Share

### Problem

Only the coach can share the match code via the `ShareMatchModal`. Spectators can see the match code in tiny 10px text in the bottom bar but have no way to easily share it with other parents. Word-of-mouth sharing ("Hey, open VolleyTrack and type in this code") is the most natural growth vector for spectator adoption.

### Design Goal

Let any spectator share the match with one tap — identical ease to what the coach has, but from the spectator screen.

### Implementation Plan

#### Step 1: Create `SpectatorShareModal` Component

**File:** `components/spectator/SpectatorShareModal.tsx`

This is a simplified version of the coach's `ShareMatchModal`, containing only the sharing features (not the start/stop broadcasting controls):

```
Visual Layout:
┌─────────────────────────────────────┐
│  Invite More Fans! 🏐          [X]  │
│                                     │
│  Share this code so friends and     │
│  family can watch live:             │
│                                     │
│  Match Code                         │
│  ┌───────────────────────────────┐  │
│  │      A B C 1 2 3              │  │  (large, tappable to copy)
│  │                         [📋]  │  │
│  └───────────────────────────────┘  │
│                                     │
│  ┌─────────────────────────────┐    │
│  │         [QR CODE]           │    │
│  │                             │    │
│  └─────────────────────────────┘    │
│  "Scan to join instantly"           │
│                                     │
│  ┌──────────────────────────────┐   │
│  │  📤 Share with Friends       │   │  (Native share: SMS/iMessage/etc.)
│  └──────────────────────────────┘   │
│                                     │
│  ┌──────────────────────────────┐   │
│  │  📋 Copy Invite Message      │   │  (Copies pre-formatted text)
│  └──────────────────────────────┘   │
└─────────────────────────────────────┘
```

**Key implementation details:**
- Reuse `react-native-qrcode-svg` for QR generation (already a dependency)
- Deep link: `volleytrack://spectate/{matchCode}`
- "Share with Friends" uses React Native `Share.share()` with message:
  ```
  Come watch [TeamName] play live! 🏐

  Open VolleyTrack and enter code: [CODE]

  Or tap: volleytrack://spectate/[CODE]
  ```
- "Copy Invite Message" copies the same text to clipboard with feedback
- Match code display should use the same large, spaced monospace font as the coach's ShareMatchModal

#### Step 2: Add Share Button to Spectator Screen

**File:** `components/SpectatorReactionBar.tsx`

Option A (recommended): Make the existing match code text in the bottom bar tappable and open the `SpectatorShareModal`.

Option B: Add a dedicated share icon button (use `Share2` from lucide-react-native) to the reaction bar actions section.

**Recommended approach:** Do both — make the code tappable AND add a share icon. The tappable code is discoverable by curious users, and the share icon is discoverable by intent-driven users.

#### Step 3: Wire Up in Spectator Screen

**File:** `app/spectate/[code].tsx`

- Add `showShare` state
- Add `SpectatorShareModal` to render tree
- Pass `matchCode`, `teamName` (from `state.myTeamName`)

---

## Enhancement 5: Volleyball-Specific Reactions

### Problem

The current reaction set (👏🔥❤️🏐💪💯) is generic to any sport. Volleyball has distinctive, exciting plays that deserve their own reactions: a massive block, a diving dig, a perfect set, a powerful spike.

### Design Goal

Let fans react with volleyball-specific flair that shows they understand and appreciate the nuances of the sport. These should feel more expressive and fun than generic emoji.

### Implementation Plan

#### Step 1: Define Volleyball Reaction Set

**New reactions to add to the `EMOJI_MAP` in `ReactionFloater.tsx` and the reaction UI:**

| Key | Display | Meaning | When to use |
|-----|---------|---------|-------------|
| `stuff` | 🧱 | Stuff block / Wall | After a big block |
| `dig` | 🦵 | Amazing dig / save | After a spectacular dig |
| `spike` | 💥 | Powerful kill / attack | After a kill |
| `ace_serve` | 🎯 | Service ace | After an ace |
| `setter` | 🪄 | Perfect set / assist | After a great set |
| `roof` | 🏠 | Roof block (ball goes straight down) | After a dominant block |
| `pancake` | 🥞 | Pancake dig (hand flat on floor) | After a desperation save |
| `sideout` | ✊ | Side out! (won rally on opponent's serve) | After winning a side-out rally |

#### Step 2: Create Contextual Reaction Drawer

**File:** `components/spectator/ReactionDrawer.tsx`

Rather than showing all reactions in the cramped bottom bar, replace the current inline emoji buttons with a drawer/expandable panel:

```
Visual Layout (collapsed - in reaction bar):
[🏐 React]  — single button that opens the drawer

Visual Layout (expanded — slides up from bottom):
┌─────────────────────────────────────┐
│  Quick Reactions                    │
│                                     │
│  VOLLEYBALL                         │
│  [🧱 Block] [💥 Spike] [🦵 Dig]   │
│  [🎯 Ace]  [🪄 Set]   [🥞 Save]  │
│  [🏠 Roof] [✊ Side Out]           │
│                                     │
│  HYPE                               │
│  [👏 Clap] [🔥 Fire]  [❤️ Love]   │
│  [💪 Flex] [💯 100]   [🏐 Ball]   │
│                                     │
│  (tap any to send — floats up       │
│   on all spectator screens)         │
└─────────────────────────────────────┘
```

**Key implementation details:**
- Use a `BottomSheet` or animated `View` that slides up 200px from the reaction bar
- Group reactions into "Volleyball" and "Hype" categories
- Each reaction button is a `TouchableOpacity` that calls `interactions.sendReaction(type)`
- After sending, show a brief "sent!" checkmark animation on the button
- Drawer auto-closes after 3 seconds of no interaction, or on tap-outside
- Keep the existing cheer button and alert buttons outside the drawer (they serve different purposes)

#### Step 3: Update ReactionFloater Animation

**File:** `components/ReactionFloater.tsx`

- Add all new emoji types to the `EMOJI_MAP`
- For volleyball-specific reactions, make the floating animation slightly larger (scale 1.2x) since they carry more meaning
- Consider adding a brief text label under the floating emoji for volleyball reactions (e.g., "STUFF!" under 🧱) that fades faster than the emoji

#### Step 4: Contextual Reaction Suggestions (Future/Nice-to-Have)

After a specific play type is logged, briefly highlight the matching reaction in the drawer:
- After an ace is logged → pulse the 🎯 button
- After a kill is logged → pulse the 💥 button
- After a block → pulse the 🧱 button

This requires watching the `history` array for new entries and matching by `StatLog.type`.

---

## Enhancement 6: General Sport Reactions & Momentum Indicators

### Problem

The current reactions are static and disconnected from game flow. Parents want to feel the momentum of the match — run streaks, comeback rallies, close sets.

### Design Goal

Layer contextual awareness on top of the reaction system so spectators feel the game's emotional arc, not just see numbers change.

### Implementation Plan

#### Step 1: Create Momentum Banner Component

**File:** `components/spectator/MomentumBanner.tsx`

A contextual banner that appears at the top of the spectator view during notable game moments:

```
Examples:

[🔥 3-POINT RUN! Eagles on fire!]           (3+ consecutive points)
[⚡ SET POINT — Eagles 24-22]                (team is at set point)
[😱 MATCH POINT — Eagles lead 2-0, 24-20]   (team is at match point)
[🔄 SIDE OUT — Back to serve!]              (won rally on opponent's serve)
[⏰ TIMEOUT — Eagles]                       (timeout called)
[🔀 SUBSTITUTION — #7 in for #12]           (sub involving a cheered-for player)
[🏆 SET WON! Eagles take Set 2, 25-21]      (set just ended)
[💪 COMEBACK! Eagles tied it up 20-20]       (team erased a 3+ point deficit)
```

**Key implementation details:**
- Renders as an animated banner (slide down from below header, auto-dismiss after 4 seconds)
- Uses `react-native-reanimated` for smooth entrance/exit
- Banner color matches the mood: gold for positive, neutral for timeouts/subs, red for opponent momentum
- Only show for the home team's positive moments and significant game state changes
- Stack multiple banners if they happen in quick succession (queue with 1.5s gap)

**Detection logic (in a new hook `useMomentumDetection.ts`):**

```typescript
// Watch state.history for patterns:
//
// POINT RUN (3+ consecutive points by same team):
//   Walk backwards through history from the most recent entry.
//   Count consecutive rally-ending events where the scoring team is the same.
//   "Scoring team" = team for POINT_SCORERS (ace/kill/block), or opposing team for POINT_ERRORS.
//   If count >= 3 for myTeam → "🔥 X-POINT RUN! [TeamName] on fire!"
//   If count >= 3 for opponent → "⚡ [Opponent] on a X-point run"
//   Reset when the other team scores.
//
// SET POINT:
//   currentScore[myTeam] >= setConfig.targetScore - 1
//     AND currentScore[myTeam] >= currentScore[opponent] + (setConfig.winBy - 1)
//   → "⚡ SET POINT — [TeamName] [score]"
//   Show for opponent too: "😬 SET POINT — [Opponent] [score]"
//
// MATCH POINT:
//   Same as SET POINT, but also setsWon.myTeam === config.totalSets / 2 (rounded down)
//   i.e., winning this set wins the match.
//   → "😱 MATCH POINT — [TeamName] leads [setsWon], [score]"
//
// COMEBACK:
//   Track the maximum deficit in the current set (max difference where myTeam was behind).
//   If maxDeficit >= 3 AND myTeam ties or takes the lead → "💪 COMEBACK! [TeamName] tied it up [score]!"
//   Only triggers ONCE per deficit recovery (reset tracker after triggering).
//
// SIDE OUT:
//   Detected when: the previous point's servingTeam was opponent, and myTeam just scored.
//   This means myTeam won the rally while receiving (broke serve).
//   Only show banner if it breaks a 2+ point opponent run (to avoid banner spam on every side-out).
//
// TIMEOUT / SUBSTITUTION:
//   Detected directly from StatLog entries with type === 'timeout' or type === 'substitution'.
//   For subs: only show banner if the subbed-in or subbed-out player is in the spectator's cheeringFor array.
```

#### Step 2: Create Heartbeat Emoji Rain for Big Moments

**File:** `components/spectator/EmojiRain.tsx`

For major moments (set won, match point converted, 5+ point run), trigger a brief "emoji rain" across the screen:
- 20-30 small emoji falling from top to bottom over 2 seconds
- Mix of relevant emoji (🎉🏐🔥👏❤️)
- Purely decorative/celebratory
- Uses `Animated` API with randomized horizontal positions and fall speeds

#### Step 3: Point Streak Counter in Score Area

**File:** `components/ScoreBoard.tsx` (or a wrapper for spectator view)

Add a small "streak" indicator near the score when either team is on a 3+ point run:

```
Score: 18-14  🔥x5 (5 straight!)
```

- Shows on spectator view only (not coach view, to avoid distraction)
- Disappears when the other team scores
- Calculated from the tail of `state.history`

---

## Enhancement 7: Parent-First Engagement Features

### Problem

The app knows which players each spectator is cheering for (the onboarding modal collects this), but this information is underutilized. Beyond the player check-in alert, there's no personalized experience.

### Design Goal

Make every parent feel like VolleyTrack is their personal window into their child's game — celebrating their kid's great plays, alerting them when their kid is involved, and giving them shareable moments of pride.

### Implementation Plan

#### Step 1: "My Player" Highlights in the Play-by-Play Feed

**File:** `app/spectate/[code].tsx` (in the `renderItem` for the FlatList)

When a play involves a player the spectator is cheering for, visually highlight it:

```
Current rendering:
  ● Kill                    18-14     (standard row)

Enhanced rendering when #7 (cheered-for player) gets a kill:
  ⭐ Kill — #7 Sarah       18-14     (highlighted background, star icon, player name shown)
```

**Key implementation details:**
- In `renderItem`, check if `item.playerId` is in `interactions.cheeringFor`
- If yes: use a highlighted background color (`colors.primaryLight`), show a star icon instead of the dot, and append the player's name and jersey number
- This makes the feed feel personalized — "my kid's plays pop"

#### Step 2: "Proud Moment" Instant Share Cards

**File:** `components/spectator/ProudMomentCard.tsx`

When a cheered-for player makes a significant play (ace, kill, block), show a brief toast/card with a "Share" button:

```
┌─────────────────────────────────────┐
│  🌟 PROUD MOMENT                    │
│                                     │
│  #7 Sarah just got a KILL!          │
│  Set 2 · Eagles lead 18-14         │
│                                     │
│  [ Share ] [ Dismiss ]              │
└─────────────────────────────────────┘
```

Tapping "Share" opens the native share dialog with a pre-formatted message:

```
🏐 Proud parent moment!
#7 Sarah just got a KILL! 💥
Eagles lead 18-14 in Set 2
Follow live on VolleyTrack: [code]
```

**Key implementation details:**
- Only triggers for home team (myTeam) plays where `item.playerId` is in `interactions.cheeringFor`
- Only for significant rally-ending plays: `ace`, `kill`, `block` (not routine passes, digs, or errors)
- Max 1 proud moment card every 30 seconds (to avoid spam during hot streaks)
- Card auto-dismisses after 5 seconds if not interacted with
- Optional: Add haptic feedback when the card appears

#### Step 3: End-of-Set "Your Player's Set Summary"

**File:** `components/spectator/PlayerSetSummary.tsx`

When a set ends (`status` changes to `between-sets`), show a brief summary of the cheered-for player(s)' stats for that set:

```
┌─────────────────────────────────────┐
│  Set 2 Summary for #7 Sarah        │
│                                     │
│  🎯 2 Aces                          │
│  💥 3 Kills                         │
│  🦵 1 Dig                           │
│                                     │
│  [ Share ] [ View Full Stats ]      │
└─────────────────────────────────────┘
```

**Key implementation details:**
- Computed from `state.history.filter(e => e.setNumber === completedSet && e.playerId === cheeringForId)`
- Group by stat type and count
- Only show stats with count > 0
- "Share" opens native share with formatted text
- "View Full Stats" could link to the full log modal with a filter

#### Step 4: Personalized Onboarding Enhancements

**File:** `components/SpectatorOnboardingModal.tsx`

Enhance the existing onboarding to feel more warm and parent-friendly:

- Step 1 (name): Add suggested names as tappable chips: "Mom", "Dad", "Grandma", "Grandpa", "Coach Mom", "Fan" — pre-fill on tap
- Step 2 (player selection): Add a subtitle: "We'll highlight their plays and send you alerts when they're on the court"
- Add a brief animation (confetti or sparkle) when they tap "Let's Go!"

---

## Enhancement 8: Reaction Bar Redesign

### Problem

The current `SpectatorReactionBar` is cramped and overloaded. It tries to fit viewer count, 3 emoji buttons, cheer button, meter toggle, score alert, fan recap, emergency alert, and match code all in one horizontal row. This makes icons small, hard to tap, and visually overwhelming.

### Design Goal

A clean, spacious, fun bottom bar that prioritizes the most-used actions and nests secondary actions behind discoverable entry points.

### Implementation Plan

#### Step 1: Redesign the Reaction Bar Layout

**File:** `components/SpectatorReactionBar.tsx` (rewrite)

New layout with clear grouping:

```
┌──────────────────────────────────────────────────┐
│                                                  │
│  [👥 12]  [🏐 React ▾]  [📣 Cheer]  [💬 Chat]  [📤]  [⚠️ ▾] │
│                                                  │
└──────────────────────────────────────────────────┘

Where:
- [👥 12] = Viewer count, taps to open lobby
- [🏐 React ▾] = Opens reaction drawer (Enhancement 5)
- [📣 Cheer] = Cheer button with count (existing)
- [💬 Chat] = Opens Fan Zone (Enhancement 3), with unread badge
- [📤] = Opens share modal (Enhancement 4)
- [⚠️ ▾] = Opens alert menu (score correction + emergency)
```

**Key implementation details:**
- Each button is a minimum 44x44px touch target (Apple HIG recommendation)
- Use `Animated.View` for the cheer burst effect (existing)
- The alert button (⚠️) uses a small dropdown/popover with two options: "Score Check" and "Emergency Stop"
- Show cooldown timer overlay on the alert button when in cooldown
- The Fan Recap (⭐) button moves into the header area or becomes accessible from a "..." overflow menu
- Match code is no longer shown in the bar (moved to the share modal and the header subtitle)

#### Step 2: Create Alert Popover

**File:** `components/spectator/AlertPopover.tsx`

A small popover that appears above the ⚠️ button with two options:

```
┌─────────────────────┐
│ 📊 Score Check      │  → Opens ScoreCorrectionModal
│ 🚨 Emergency Stop   │  → Opens EmergencyAlertModal
└─────────────────────┘
```

- Uses `react-native-reanimated` for fade-in/slide-up animation
- Dismisses on tap outside
- Shows cooldown state on both options if in cooldown

---

## Enhancement 9: Match Ambiance & Polish

### Design Goal

Small details that make the spectator experience feel alive and premium. These are polish items that add delight.

### Implementation Plan

#### Step 1: Live Pulse Indicator

**File:** `app/spectate/[code].tsx` (header area)

Replace the static green dot with an animated pulsing dot:
- Use `Animated.loop` with a scale/opacity pulse
- Pulse faster during active play (when `rallyState === 'in-rally'`)
- Pulse slowly between points
- Stop pulsing when connection is lost (switch to warning color)

#### Step 2: Sound & Haptic Feedback (Optional, Configurable)

**File:** `hooks/useMatchSounds.ts` (new)

Add optional sound effects for key moments:
- Whistle sound on set start
- Brief cheer sound when the home team scores
- Buzzer sound on timeouts
- Haptic feedback on every point scored

**Important:** This MUST be configurable with a toggle in settings. Many parents will be watching from the bleachers where sounds would be annoying. Default should be OFF for sound, ON for haptics.

#### Step 3: Between-Sets Experience

**File:** `components/spectator/BetweenSetsView.tsx`

When `state.status === 'between-sets'`, show a transitional view instead of the normal play-by-play:

```
┌─────────────────────────────────────┐
│                                     │
│  🏐 SET 2 COMPLETE                  │
│                                     │
│  Eagles  25  -  21  Panthers        │
│                                     │
│  Sets: Eagles 2 - 0 Panthers        │
│                                     │
│  [ View Set Stats ]                 │
│  [ Generate Fan Recap ]             │
│                                     │
│  Next set starting soon...          │
│  (pulsing dots animation)           │
│                                     │
└─────────────────────────────────────┘
```

This provides a natural pause point and surfaces the Fan Recap feature.

#### Step 4: Match Complete Celebration Screen

**File:** `components/spectator/MatchCompleteView.tsx`

When the home team wins the match, replace the standard "Match Ended" banner with a celebration screen:

```
┌─────────────────────────────────────┐
│                                     │
│  🎉🏐🎉                             │
│  EAGLES WIN!                        │
│  3 - 1                              │
│  25-21 · 23-25 · 25-18 · 25-20     │
│                                     │
│  [🌟 Generate Fan Recap]            │
│  [📤 Share Result]                  │
│  [💾 Save to History]               │
│                                     │
│  Thank you for cheering with us!    │
│  👏 Total cheers: 247               │
│  👥 Peak viewers: 18                │
│                                     │
└─────────────────────────────────────┘
```

If the team lost, use a more subdued but still warm design: "Great effort, Eagles! 💪" with the same action buttons.

---

## Implementation Priority & Phasing

### Phase 1: Core Improvements (High Impact, Moderate Effort)

These enhance existing features and should be done first:

1. **Score Correction Modal** (Enhancement 1) — Most impactful alert improvement. Uses existing type fields.
2. **Emergency Alert Modal** (Enhancement 2) — Safety feature, relatively straightforward.
3. **Spectator-Side Share** (Enhancement 4) — Growth enabler. Mostly reuses ShareMatchModal code.
4. **Reaction Bar Redesign** (Enhancement 8) — Layout fix that unblocks other enhancements.

Estimated effort: 3-4 days

### Phase 2: Engagement Layer (High Impact, High Effort)

New features that create the community experience:

5. **Volleyball-Specific Reactions** (Enhancement 5) — Fun, differentiating. Medium effort.
6. **Fan Zone Chat** (Enhancement 3) — Biggest new feature. Requires new Firestore subcollection, hook, and component.
7. **Parent-First Features** (Enhancement 7) — "My Player" highlights, proud moment cards. High engagement.

Estimated effort: 5-7 days

### Phase 3: Polish & Delight (Medium Impact, Low-Medium Effort)

Features that make the experience feel premium:

8. **Momentum Indicators** (Enhancement 6) — Contextual banners, streak counters.
9. **Match Ambiance** (Enhancement 9) — Between-sets view, match complete celebration, live pulse.

Estimated effort: 2-3 days

---

## New Files Summary

| File | Enhancement | Purpose |
|------|-------------|---------|
| `components/spectator/ScoreCorrectionModal.tsx` | 1 | Score discrepancy reporting with side-by-side comparison |
| `components/spectator/EmergencyAlertModal.tsx` | 2 | Structured emergency alert with categories |
| `components/spectator/FanZoneModal.tsx` | 3 | Spectator-to-spectator chat |
| `components/spectator/SpectatorShareModal.tsx` | 4 | QR code + share for spectators |
| `components/spectator/ReactionDrawer.tsx` | 5 | Expandable volleyball + hype reaction panel |
| `components/spectator/MomentumBanner.tsx` | 6 | Contextual game moment banners |
| `components/spectator/EmojiRain.tsx` | 6 | Celebratory emoji animation for big moments |
| `components/spectator/ProudMomentCard.tsx` | 7 | Shareable highlight card for cheered-for players |
| `components/spectator/PlayerSetSummary.tsx` | 7 | End-of-set stats for cheered-for players |
| `components/spectator/AlertPopover.tsx` | 8 | Score check / emergency popover menu |
| `components/spectator/BetweenSetsView.tsx` | 9 | Transitional view between sets |
| `components/spectator/MatchCompleteView.tsx` | 9 | Win/loss celebration screen |
| `services/firebase/spectatorChatService.ts` | 3 | Chat CRUD operations |
| `hooks/useFanZoneChat.ts` | 3 | Chat subscription and send logic |
| `hooks/useMomentumDetection.ts` | 6 | Streak, set point, and momentum detection |
| `hooks/useMatchSounds.ts` | 9 | Optional sound/haptic feedback |

## Modified Files Summary

| File | Enhancements | Changes |
|------|-------------|---------|
| `app/spectate/[code].tsx` | 1,2,3,4,5,6,7,8,9 | Wire up all new modals, hooks, and components |
| `components/SpectatorReactionBar.tsx` | 3,4,5,8 | Complete redesign with new layout |
| `components/CoachAlertToast.tsx` | 1,2 | Score comparison view, emergency styling |
| `components/ReactionFloater.tsx` | 5 | Add volleyball emoji to EMOJI_MAP |
| `components/SpectatorOnboardingModal.tsx` | 7 | Name chips, enhanced copy |
| `types/index.ts` | 3 | Add `SpectatorChatMessage` type |

---

## Firestore Schema Additions

```
/liveMatches/{matchCode}
├── (existing fields unchanged)
│
└── /chat/{messageId}  [NEW subcollection]
    ├── id: string
    ├── senderDeviceId: string
    ├── senderName: string
    ├── text: string (max 200 chars)
    ├── timestamp: number
    ├── type: 'message' | 'celebration' | 'reaction_context'
    ├── triggerEvent?: string
    └── triggerPlayerName?: string
```

No changes to existing Firestore schema. The chat subcollection is additive and follows the same pattern as the existing `reactions` subcollection.

---

## Design Principles for Implementors

1. **Parents first.** Every design decision should pass the "volleyball mom test." Would a parent who isn't tech-savvy find this intuitive and delightful?

2. **Don't distract from the game.** Modals should be dismissable, animations should be brief, sounds should be off by default. The volleyball match is the main event — VolleyTrack enhances it, not competes with it.

3. **Celebrate generously.** When in doubt, celebrate. Parents are there because they're proud. Give them reasons to feel that pride digitally.

4. **Keep it fast.** Every interaction should feel instant. Use optimistic UI updates (show the cheer/reaction immediately, sync to Firestore in the background). Never show a loading spinner for reactions or cheers.

5. **Respect Firestore limits.** The main `liveMatches/{code}` document should stay under 1MB. Keep high-throughput writes (reactions, chat) in subcollections. Use `arrayUnion` for alerts. Use atomic `increment` for counters.

6. **Theme-aware.** All new components must use `useAppTheme()` for colors, spacing, and radius. Support both light and dark mode.

7. **Free vs Pro.** Chat and reactions should be free. The Fan Recap and advanced AI features are already gated behind Pro. New features (momentum banners, highlights, etc.) should be free to maximize engagement.
