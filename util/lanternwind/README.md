# Lanternwind test tools

Headless renders of `games/lanternwind.html` for checking looks and hunting one-frame artefacts. They drive the
game frame by frame through `window.__lw` (set `window.__lwManual = true` and call `__lw.frame(dt, freeze, noRender)`),
so nothing depends on the wall clock. Chromium + Playwright as preinstalled; SwiftShader is slow, a few seconds a frame.

- `film.js` – a filmstrip from a start position and time of day (options in its header).
- `sheet.py` – a contact sheet of a filmstrip (needs `pillow`).
- `hunt.js` – flies and counts pixels the page's own detectors mark; finds flashes that last one frame.
- `gull.js` – follows one gull at arm's length through its wingbeat (the gulls are too rare to film from the glider).
- `orbit.js` – close-ups of any point from chosen distances and angles (masonry, rock, the tower's plaster).

## The standard round (what the critic rounds looked at)

```sh
node util/lanternwind/film.js out/arch '{"n":8,"every":15,"warm":90,"hud":true,"pos":[-86,58,1428],"yaw":0.18,"setup":"L.S.taught=null;document.querySelector(\"#hint\").style.opacity=0;"}'
node util/lanternwind/film.js out/forest '{"pos":[650,95,880],"yaw":-2.75,"pitch":-0.1,"n":8,"every":4,"warm":90,"hud":true,"setup":"L.S.taught=null;window.dispatchEvent(new KeyboardEvent(\"keydown\",{code:\"KeyD\"}))"}'
node util/lanternwind/film.js out/ignite '{"n":8,"every":8,"warm":84,"hud":true,"setup":"L.S.taught=null;const b=L.beacons[0];L.teleport(b.target.x,b.target.y+30,b.target.z+130+84*1.15,0,-0.04);window._ig=0;","eval":"if(!window._ig&&L.U.uTime.value>102.75){window._ig=1;L.ignite(0);}"}'
node util/lanternwind/film.js out/fin '{"tod":1.0,"n":8,"every":45,"hud":true,"setup":"for(let i=0;i<8;i++)L.ignite(i);L.U.uTime.value+=30;L.frame(1/30);L.ignite(8);"}'
node util/lanternwind/film.js out/phone '{"mobile":true,"w":390,"h":844,"dpr":1.5,"q":"medium","n":8,"every":4,"hud":true,"pos":[-640,40,1800],"yaw":0.1}'
node util/lanternwind/film.js out/title '{"mode":"title","n":1,"hud":true}'
python util/lanternwind/sheet.py out/forest out/forest_sheet.jpg
```

Useful places: the lighthouse stands at about (-6, 271, 6), `L.beacons[8]` is it (`central`); close views of tower and
cottage from `"pos":[22,280,30],"yaw":0.62,"pitch":-0.2` and `"pos":[-25,330,45],"yaw":-0.4`. Light the lamp for a
night shot with `setup` `const c=L.beacons.find(b=>b.central);c.obj.userData.glassU.value=1;c.obj.userData.beamU.value=1;`.
`L.ground(x, z)` gives the terrain height; a teleport into a tree, a stack or a slope gives useless frames.

## Flashes

The page has two detectors, also reachable in a browser with `?flashdebug`:
the pre-bloom filter (`rayPass.comp`, uniform `uHunt`) marks lone overbright pixels and anything above its ceiling,
the water (`ocean.mat`, uniform `uHuntW`) marks reflection values above the threshold. Calibrate first: `"hw":0.6`
must mark almost all water, `"hv":2` almost everything; normal frames mark nothing at `"hw":3`.

The flashes the player saw on the water came from the sea's half-size mirror: leaves lit from behind by the low sun
turned single mirror texels hot for one frame, and the sea magnified them into a glowing block. Fixed by a cleaning
pass over the mirror (`Ocean.cleanMat`), the leaves' backlight kept soft while the mirror is drawn (`uMirror`), and
the sharp mirror held to its blurred copy.
