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


## Second pass (after playing it)

Player feedback: the heartbeat was unnerving, the game was safe from about wave 9 and went idle, the horde needed more depth, the background
was static, and there was no settings screen, skill tree, cursor attack or way to hurry.

- **Heartbeat**: the lub-dub is now a soft low sine with slow attack, quieter and lower than before; it has its own switch, and the music
  (a slow generative pad that follows the chapter) another.
- **Settings**: volume slider; switches for sound effects, heartbeat, music, damage numbers, screen shake, bright flashes, zoom-out and
  vibration; best wave; hold-to-start-over.
- **Depth**: a twelve-skill tree in four branches (Touch, Rhythm, Guard, Fortune) opens at wave 5 and is given back on a Mend. The first
  skill, Swipe, brings the cursor attack back: drag across faces to cut them, paid in a focus meter that refills.
- **Losing is possible**: faces that are hit repeatedly build up resistance to knock-back, a wave that drags on turns restless and sends more,
  every fifth wave is a surge, ghosts fade in and out from wave 12, and enemy hp grows 1.235x a wave.
- **Zoom**: the camera backs away as the crowd grows (switchable).
- **Backgrounds**: a new chapter every ten waves with its own ground, weather and ambient motion, and an ECG trace along the shore of the field.
- **Rush**: from wave 6 a button (or R) brings the next wave in now, on top of the current one, up to three ahead. Each rushed wave counts
  at once, its faces keep their own wave's strength and pay 40% more love per wave rushed, and a break counts from the wave reached, so
  rushing is a bet on your heart. It needs a heart above half health and is not offered into or during a boss wave.
- **Keepsakes**: after every tantrum (waves 10, 20, ...) the heart is offered one of three keepsakes out of ten (Locket, Ribbon, Lucky Coin,
  Feather, Candle, Clear Glass, Umbrella, Metronome, Lantern, Spark) that last until a Mend, so two hearts at wave 30 are no longer the same
  heart. An offer that is closed waits behind a pill until it is taken.
- **Focus meter**: moved from a faint bar in the middle of the field to a labelled gauge at the bottom left, opposite Rush, that glows when full
  and turns red when you reach for it empty. **Heartbeat trace**: now crosses the whole field at any width instead of fading out.
