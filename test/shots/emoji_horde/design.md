# Emoji Horde: design notes (written before the code, kept for the PR)

**Reference bar:** The Tower (idle core defence), Vampire Survivors (the feel of a crowd dying), Dome Keeper (invest between assaults),
Cookie Clicker / Antimatter Dimensions (numbers that want to be bigger).

**Thesis.** The one moment is a pulse leaving the heart, a ring of bad moods dying in one ripple, the love rushing home, and one card in
the shop lighting up that makes the next ripple bigger. The player should feel a small precious thing getting sturdier and louder. On a
phone that means portrait, one thumb, tap anywhere, a shop in the thumb zone, nothing smaller than a thumb.

**Art direction, and why each choice belongs to this game and no other**
- Palette: lacquer oxblood-black ground; one red thing (the heart) and one pointed shape, so it is always findable; gold for everything that
  comes *from* the heart (pulse, love, prices, seams); sulphur / orange / blue / violet for the bad moods. Gold always means "yours", faces are never gold.
- Type: Fraunces (a soft, wonky, high-contrast serif) for the wave, love and card names: valentine and letterpress warmth against the violence
  of the horde. Embedded (subset woff2, 23 KB), so there is no flash of another face.
- Shapes: only round things attack (they are emoji); each species has its own body (round grump, jagged fret, squashed sulk, tilted squircle
  snark) and a bit of weather (a grump steams, a sulk cries). Every pair of eyes looks at the heart.
- The heart is its own health bar: its blood level drains from the top. Nothing else on screen says how you are doing.
- Motion idea: the world is on the beat. lub-dub squash, pulse ring, faces recoil with a decaying knock-back and re-advance, love flies home
  on arcs, numbers count up and bump, the shop opens by gliding the heart up, never by jumping.
- Sound idea: the heartbeat is the music. A low sine lub-dub (pitch follows bpm) and kills that arpeggiate up an A-minor pentatonic in the
  order the ring reached them, so a bigger pulse is a longer chord. No other music.
- Kintsugi: Mend (prestige) pours gold into the heart; each seam is a permanent gold vein. A pristine heart means a new player.

**Critic scores, step 3 (static mock-up, 7 rounds):** the last round, on phone and desktop frames of one beat, was first impression 6-7,
clarity 6, art direction 6.5-7, phone 6. It never reached 8; the remaining complaints were about a still of a moving game, so the game was built
and the critique carried on with filmstrips of the real page (step 8).

**Critic scores, step 8 (filmstrips of the real page, 4 rounds, harsh scale, 5 = mediocre, 8 = good):**

| round | first impression | clarity | art direction | phone | feel |
|---|---|---|---|---|---|
| 1 | 7 | 6 | 7.5 | 5.5 | 6.5 |
| 2 | 7 | 6 | 7.5 | 6 | 7 |
| 3 | 7.5 | 6 | 7.5 | 6.5 | 6.5 |
| 4 | 7 | 6 | **8** | 6 | 6 |
