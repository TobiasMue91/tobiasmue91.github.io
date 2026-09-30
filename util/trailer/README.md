# The trailer

A 96-second trailer for gptgames.dev, told through its own time travel bar: the home page
on every one of the days `timeline_data.json` can visit, each model's era landing on a bar
of the music, one page stepping through all its versions, first versions wiped into their
latest, the commit log quoted like the critics on a poster, and everything there is today.
Nothing in it is mocked up: every picture is the site as git has it, and every date, count
and commit message is read from the history.

The music is synthesised by `music.py` (120 BPM, A minor) and cut to the same timeline, so
the slider clicks through each day it passes and every version of the snake plays a note.

## Building it

```sh
node util/trailer/shoot.mjs      # 1. screenshots from git: every day of the home page, and the pages
python util/trailer/plan.py      # 2. build/plan.json, pictures as JPEG, the site's fonts
python util/trailer/music.py     # 3. build/soundtrack.wav
node util/trailer/render.mjs     # 4. build/gptgames_trailer.mp4 (1920 x 1080, 30 fps)
```

Everything it makes goes to `build/`, which is not committed. It needs a full clone (not a
shallow one), Playwright, ffmpeg with libx264, and `numpy`, `scipy` and `pillow`. Step 1
takes about ten minutes and keeps what it has already taken (`--force` retakes it); step 4
about ten more.

The oldest home pages load Font Awesome, jQuery and toastr from CDNs, and Flappy Bird p5.
`shoot.mjs` serves them from `build/node_modules` when they are there, and the pages go
without them otherwise:

```sh
npm i --no-save --prefix util/trailer/build @fortawesome/fontawesome-free@6.4.0 jquery@3.6.0 toastr@2.1.4 p5@1.4.2
```

While working on a scene, `node util/trailer/render.mjs --stills 17,30.5,62` draws single
frames and `--from 58 --to 66` films a stretch of it with its sound.

## The timeline

| time | what happens |
|---|---|
| 0 - 8 s | Two lines on black; today's home page; the tab opens and the slider flies back to day one |
| 8 - 16 s | 5 Feb 2023, the first two commits typed out, then the slider starts to move |
| 16 - 48 s | Every day of the site, each model's name landing on a bar line |
| 48 - 58 s | "Every page keeps every version": the snake's 19 versions, in time with the music |
| 58 - 66 s | Five games wiped from their first version into their latest |
| 66 - 74 s | The reviews are in: four commit messages and a star rating that climbs |
| 74 - 84 s | Every entry on the site, and the numbers: entries, commits, page versions, models |
| 84 - 96 s | Back to today, the logo, the address |

`plan.py` holds the choices - which eras land when, the snake's timing, the five pairs and
the four quotes - and both `trailer.html` and `music.py` follow it. A new model on the time
travel bar needs a slot in `ERAS`; with none free, the scrub between 16 and 48 s is the
place to make room.
