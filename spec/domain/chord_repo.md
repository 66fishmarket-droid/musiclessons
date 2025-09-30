# Chord Repository — Standard Tuning (E A D G B e)
Authoritative shapes for lesson generation. Orientation is **EADGBE** (low E → high e).  
Values:
- **EADGBE** — fret numbers per string (`x` = muted).  
- **Fingering** — finger used per string (`1=index, 2=middle, 3=ring, 4=pinky, T=thumb, x=muted, 0=open`).  
- **ChordAscii** — same 6-char mask as in lessons (low→high) for quick embedding.

> Policy: The generator must copy **EADGBE** and **ChordAscii** verbatim when `status: "OK"`. If a requested chord is absent, the generator must return `status: "NOT_FOUND"`.

---

## Open Major
### C (open)
EADGBE = x 3 2 0 1 0
Fingering = x 3 2 0 1 0
ChordAscii = x32010

### G (open, 3–4 fingering)
EADGBE = 3 2 0 0 3 3
Fingering = 3 2 0 0 3 4
ChordAscii = 320033

### E (open)
EADGBE = 0 2 2 1 0 0
Fingering = 0 2 3 1 0 0
ChordAscii = 022100

### D (open)
EADGBE = x x 0 2 3 2
Fingering = x x 0 1 3 2
ChordAscii = xx0232

### A (open)
EADGBE = x 0 2 2 2 0
Fingering = x 0 1 2 3 0   # stacked or mini-bar acceptable
ChordAscii = x02220

---

## Open Minor
### Am (open)
EADGBE = x 0 2 2 1 0
Fingering = x 0 2 3 1 0
ChordAscii = x02210

### Em (open)
EADGBE = 0 2 2 0 0 0
Fingering = 0 2 3 0 0 0
ChordAscii = 022000

### Dm (open)
EADGBE = x x 0 2 3 1
Fingering = x x 0 2 3 1
ChordAscii = xx0231

---

## Open Sus / Add (comfort shapes)
### Asus2
EADGBE = x 0 2 2 0 0
Fingering = x 0 2 3 0 0
ChordAscii = x02200

### Asus4
EADGBE = x 0 2 2 3 0
Fingering = x 0 1 2 3 0
ChordAscii = x02230

### Dsus2
EADGBE = x x 0 2 3 0
Fingering = x x 0 1 3 0
ChordAscii = xx0230

### Dsus4
EADGBE = x x 0 2 3 3
Fingering = x x 0 1 3 4
ChordAscii = xx0233

### Cadd9 (open-friendly with G)
EADGBE = x 3 2 0 3 3
Fingering = x 3 2 0 3 4
ChordAscii = x32033

### Esus4
EADGBE = 0 2 2 2 0 0
Fingering = 0 2 3 4 0 0
ChordAscii = 022200

---

## Barre — E-shape Majors (low stretch, common frets)
### F — E-shape barre @ 1st fret
EADGBE = 1 3 3 2 1 1
Fingering = 1 3 4 2 1 1
ChordAscii = 133211

### G — E-shape barre @ 3rd fret
EADGBE = 3 5 5 4 3 3
Fingering = 1 3 4 2 1 1
ChordAscii = 355433

### A — E-shape barre @ 5th fret
EADGBE = 5 7 7 6 5 5
Fingering = 1 3 4 2 1 1
ChordAscii = 577655

### B♭ — E-shape barre @ 6th fret
EADGBE = 6 8 8 7 6 6
Fingering = 1 3 4 2 1 1
ChordAscii = 688766

---

## Barre — E-shape Minors
### Fm — E-shape barre @ 1st fret
EADGBE = 1 3 3 1 1 1
Fingering = 1 3 4 1 1 1
ChordAscii = 133111

### Gm — E-shape barre @ 3rd fret
EADGBE = 3 5 5 3 3 3
Fingering = 1 3 4 1 1 1
ChordAscii = 355333

### Am — E-shape barre @ 5th fret
EADGBE = 5 7 7 5 5 5
Fingering = 1 3 4 1 1 1
ChordAscii = 577555

---

## Barre — A-shape Majors (avoid >9th-fret doubles for ASCII)
### C — A-shape barre @ 3rd fret
EADGBE = x 3 5 5 5 3
Fingering = x 1 3 4 2 1
ChordAscii = x35553

### D — A-shape barre @ 5th fret
EADGBE = x 5 7 7 7 5
Fingering = x 1 3 4 2 1
ChordAscii = x57775

### E — A-shape barre @ 7th fret
EADGBE = x 7 9 9 9 7
Fingering = x 1 3 4 2 1
ChordAscii = x79997

---

## Barre — A-shape Minors
### Cm — A-shape (minor) @ 3rd fret
EADGBE = x 3 5 5 4 3
Fingering = x 1 3 4 2 1
ChordAscii = x35543

### Dm — A-shape (minor) @ 5th fret
EADGBE = x 5 7 7 6 5
Fingering = x 1 3 4 2 1
ChordAscii = x57765

### Em — A-shape (minor) @ 7th fret
EADGBE = x 7 9 9 8 7
Fingering = x 1 3 4 2 1
ChordAscii = x79987

---

## Notes
- All shapes are **playable** with standard technique; avoid extreme stretches.  
- For A-shape at higher frets that require double-digit frets (e.g., F at 8 → 10s), prefer E-shape alternatives in lessons to preserve single-digit ASCII.  
- Muting: low-E is muted (`x`) on A-shape barres; confirm clean mute in instructions when used.
