# Rhythm pattern audit — 2026-10-05

**Question:** which of the 108 style rhythm patterns does the card play or describe differently from how the style is
really played? This is the same class of bug as the shuffle boogie, which was stored as eight down-strums.

**Method:** went through every pattern's grid, name and research note (`styles.data.json`, from the vault drafts) and checked them against
what the grid tokens can express (`D U d u x B P BP N 5 6 -`) and what the card does (straight timing, a whole-chord strum,
the current bar's chord).

## Findings, ranked by how much they mislead the learner

| # | Problem | Patterns | Fix | Estimate |
|---|---|---|---|---|
| 1 | **Palm muting is invisible.** The grid only has the plain `D`, so the card shows a full open strum and the counts say "strum down". The faded `d`/`u` are fretting-hand ghost strokes, a different technique | `rock_hard.palm_muted_8ths_with_open_accent`, `rock_hard.all_down_16th_chug`, `rock_hard.shuffle_boogie_swung`, `pop.palm_muted_8th_pulse_verse`, `pop_rock.palm_muted_8th_verse`, `punk.palm_muted_verse_8ths`, `pop_punk.palm_muted_chug_verse`, `pop_punk.muted_to_open_alternation`, `metal.downpicked_8th_chug`, `metal.16th_chug_with_open_hits`, `country.train_beat_palm_muted` (10–11) | New token `M` = palm-muted down: an arrow with a "PM" mark on the card, a thud sound, and "palm-muted down" in the counts. The open accents stay `D`, so "open accent" patterns finally show which hits ring | 1.5 h |
| 2 | **Picked notes stored as strums** | `rock_indie_alt.jangle_arpeggio` (alternate-picked across strings → stored as 16 strums), `rock_indie_alt.quiet_verse_sparse_pick` (single notes/dyads → strums), `neo_soul.arpeggio_hammer` (arpeggio + hammer-on → two strums), `metal.half_time_riff_sabbath` (a riff → three strums) | Re-grid with the picked tokens the card already plays (`B`, `N`, `P`). The jangle needs a "next string up" walk across the shape (new role, same as the riff roles) | 1.5 h |
| 3 | **Swing is never played.** Blues, jazz, gypsy jazz, neo-soul and funk all have `swing_ratio` in their feel, but the card plays straight time and the counts don't say "swung" | 18 patterns in those five styles with 16-slot grids (the two 12-slot shuffles are already in triplets) | Carry `swing_ratio` into `plan.music.rhythm` and the review rhythms; the card delays offbeat 8ths (or 16ths for neo-soul/funk) by the ratio; the counts open with "swung: long-short" | 1 h |
| 4 | **Wrong meter.** | `gypsy_jazz.valse_musette_3_4_12_slots` has 16 slots, so a 3/4 waltz plays as 4/4. `soul.12_8_gospel_ballad_swing_to_triplets` is straight 8ths in 16 slots, not 12/8 triplets | Re-grid to 12 slots from the sources | 20 min |
| 5 | **"Next bar's chord" pushes** play the current chord on the push | `rock_classic.push_into_the_next_bar`, `pop_punk.push_anticipation` (`americana.anticipated_change` is similar) | Mark the slot (`>` prefix on the token) so the card plays the next chord there and the counts say "change early" | 45 min |

## Later (minor)
- `x` reads "mute (slap or choke)" everywhere. The notes say which one (a fret-hand choke for `stab_and_space` and the Malcolm stab; a palm slap for `pop.acoustic_slap_backbeat` and the rumba). The step text should name the one meant. About 30 min.
- The `accents` arrays are stored but never drawn or played.
- `bluegrass.carter_scratch_b_melody_on_strings_6_4`: the melody on the bass strings is shown as a plain root thump.
- 34 patterns are unverified (`?`, the research agents' own transcriptions). Fine for now; they are flagged in the data.

## Patterns that check out
The other ~70 patterns are plain strums, boom-chicks, fingerpicking or clave-based patterns that the tokens express correctly.

## Recommended order
1 → 4 → 3 → 2 → 5. Palm muting affects the most lessons (all of rock, punk and metal). The meter fixes are quick data
changes. Swing affects the feel of five whole styles. Each fix extends the catalogue guard test, so a pattern can't fall back to
plain strums.
