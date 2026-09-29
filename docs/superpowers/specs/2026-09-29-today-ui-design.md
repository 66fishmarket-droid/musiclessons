# Today UI — Design Spec

- **Date:** 2026-09-29
- **Status:** Approved 2026-09-29 (user: "Yes, perfect" on mockup row D)
- **Parent spec:** `2026-09-28-guitar-coach-design.md` §8 (App screens)
- **Mockups:** https://claude.ai/artifact/H3hkGH4qeQpD9Gbkx4RG48 (row D = the approved hybrid)
- **Research:** `Music_Lessons Vault/Research/app_ux/` (53 notes; start at `_index.md`)

## 1. Direction

**Hybrid layout:**
- **Player:** every block uses the "Stage" layout, full screen and one block at a time.
- **Chord panel:** blocks built on a progression (Apply) swap in the "Instrument" chord panel.
- **Done screen:** a "Notebook"-style list of each block and its result.

**Palette:** "Diwali" — soft, drifting powder clouds of festival colour on a dark night-plum background.

## 2. Research rules the UI must keep

1. **One primary action per screen state.** Today has Start. In a block, the verdict buttons are primary.
2. **Readable from a music stand at about 70 cm:**
   - body text ≥ 16 px;
   - the tempo number ≥ 56 px (76 px in the metronome card);
   - the timer ≥ 30 px;
   - touch targets ≥ 44 px, and ≥ 56 px for the main controls.
3. **Nothing covers the block.** No pop-ups mid-session. The voicing sheet opens only when the user taps a chord.
4. **The player decides pass or fail, not the microphone.**
   - Buttons read `Not yet` / `Clean at {bpm}`.
   - Blocks without a tempo read `Not yet` / `Clean`.
5. **Where you are.** A progress rail sized by each block's minutes, plus "N of M · Block". The block's target is its title.
6. **Reopening resumes** at the same block, with earlier verdicts kept.
7. **Hands busy.**
   - Screen wake lock while the player is open.
   - Space starts or stops the metronome; → goes to the next block and ← to the previous one.
   - Keys are ignored while typing in a field.
8. **Tempo:** ± buttons, a large number, and ladder chips (4 rungs from the start tempo to the target). No sliders.
9. **Chord diagrams:**
   - vertical, finger numbers in the dots, ×/○ above the nut;
   - the root in marigold;
   - a Fingers / Intervals toggle;
   - "Shape n of N" paging in the voicing sheet.
10. **Rewards:**
    - real numbers (best bpm, blocks clean, minutes);
    - days practised this week, not an unbroken streak;
    - one calm celebration on Done.

## 3. Tokens

| Token | Value | Use |
|---|---|---|
| `--bg` | `#140B1F` | page |
| `--surface` | `#1F1430` | cards |
| `--surface-2` | `#2A1D3F` | buttons on cards |
| `--line` | `#3A2B52` | outlines |
| `--line-soft` | `#2E2244` | dividers, empty beats |
| `--text` | `#FBF4EA` | body |
| `--text-2` | `#DCD0E6` | secondary |
| `--muted` | `#C4B6D4` | captions |
| `--gold` / `--gold-dim` | `#FFB627` / `#5A4220` | warm-up; **all primary buttons and chord roots** (text on gold `#1A0F05`) |
| `--pink` / `--pink-dim` | `#FF3D8B` / `#5A1F42` | new skill |
| `--teal` / `--teal-dim` | `#14C9B8` / `#174A4F` | apply (text on teal `#0B2421`) |
| `--violet` / `--violet-dim` | `#9D7BFF` / `#3E3366` | create |
| `--saffron` / `--saffron-dim` | `#FF7A1A` / `#5A3020` | record & rate |
| `--blue` / `--blue-dim` | `#4D8DFF` / `#1C2F5E` | cold retest, review |
| `--muted` / `--line-soft` | as above | reset |

**Type:**
- **Bricolage Grotesque** 700/800: titles and chord names.
- **IBM Plex Sans** 400–600: body.
- **IBM Plex Mono** 500: tempo, timer, minutes.

## 4. Powder bursts

- Static SVGs are generated once by `scripts/gen-bursts.ts` into `public/bursts/`. Each one is:
  - radial-gradient ellipses with a bright core and satellite puffs;
  - a filter chain of blur, turbulence displacement and a noise mask;
  - a seeded particle spray.
- They are shown as `<img>`, which is decorative (`alt=""`).
- **Placement:**
  - **Today:** a large hero burst at the top right.
  - **About this skill** (Today and the Player's new-skill, apply and retest blocks): what the skill is, how to practise it, what to listen for. Fingerstyle skills also show their **animated picking pattern**: tab-style strings, finger dots p/i/m/a in gold/pink/teal/violet lighting in sequence, each note plucked at its real pitch at the metronome's tempo, with a chip for each pattern the skill uses. The Player's new-skill block shows the first pattern inline.
- **Done:** a full-width burst above the heading; this is the celebration.
  - **Player:** a small corner burst in the block's colour, at 70% opacity.

## 5. Screens

**Today:**
- the date and 7 week dots;
- a track pill;
- the title and why it matters;
- the block list, each with a colour dot and its minutes;
- a "Why it works" disclosure;
- the songs, each linked to an Ultimate Guitar search;
- Start (or Resume · block N, or Done for today).

**Player:**
- rail + status + timer;
- title (the target);
- a step card (instructions one at a time, with prev/next and inline chord chips);
- tools for the block (metronome card with drone chip, chord panel, recorder, or create prompt);
- a "Tips & why" disclosure;
- the verdict bar.

**Done:**
- the burst and the "Session done" heading;
- 3 stat cards;
- a result per block;
- today's take with a 1–5 rating;
- a "Fix tomorrow" line;
- "I need more time on today's new skill";
- Save & finish.

## 6. Deliberately left out of Phase 3

- **The Ask button:** the `ask` edge function is Phase 4. The verdict bar leaves room for it.
- **The 10-minute short day:** the engine templates are 25/30/40 only. It would need a planner template, so it is not a UI-only change.
- **A weekly target (the "of 5" in the mockups):** there is no setting for it. Today shows the days practised this week against a 7-day row instead.
