# Übergabe: Glühwürmchen als vollwertiges Incremental

Dieses Dokument ist für eine Claude-Code-Sitzung, die **keinen Zugriff** auf die Unterhaltung hat,
in der es entstanden ist. Alles Nötige steht hier oder im Repo. Wer es liest, übernimmt das
Spiel von hier an: Konzept schärfen, mit dem Nutzer abstimmen, bauen, balancieren und in den
Katalog bringen.

Der Nutzer schreibt Deutsch und testet viel auf dem Handy in der Claude-App. Er mag
Incrementals und hat klare Vorstellungen. Er gibt gern die Verantwortung ab, erwartet aber
ehrliche Rückmeldung und Ergebnisse, die er sofort spielen kann.

---

## 1. Wie es dazu kam

Der Nutzer wollte ein „richtiges Megaprojekt“ für gptgames.dev: ein Incremental mit einfacher
Grundmechanik, viel Interaktivität, sinnvoll skalierenden Skills, einem Prestige-System, das das
Spiel nicht künstlich streckt, einem schön anzusehenden Skill-Baum sowie guter Grafik und UI.
Seine Vorbilder sind **Scritchy Scratchy, What the Buck?!, Bills Must Be Paid, Fishing Inc und
Keep on Mining!**.

Ablauf bisher:
1. Recherche zu den fünf Spielen und sechs Spielideen.
2. Der Nutzer wählte drei davon für Prototypen: **Lawine** (Katamari-artiger Schneeball),
   **Luftpolster** (Luftpolsterfolie ploppen) und **Glühwürmchen**.
3. Alle drei wurden als Prototypen gebaut, mit Bots durchgespielt und dem Nutzer vorgelegt.
4. Sein Urteil:
   - **Lawine** ist verworfen: Motion Sickness, schwächste Optik, kein spürbares Wachstum.
   - **Luftpolster** wird gerade in einer anderen Sitzung zum vollen Spiel ausgebaut.
     **Die Dateien `playground/luftpolster*.html` und alles zu diesem Spiel bitte nicht
     anfassen.**
   - **Glühwürmchen** ist geparkt, soll aber als Cozy-Incremental weiterleben. Das ist dein
     Auftrag.

## 2. Was der Nutzer zu Glühwürmchen gesagt hat

Sinngemäß:
- „Das Glühwürmchen-Spiel sieht von allen Prototypen am besten aus.“
- „Es kann sehr schnell frustrierend sein, dass die Glühwürmchen sich nur fangen lassen, wenn
  sie gerade aufleuchten. Ich sehe das Leuchten, gehe mit der Maus hin und muss dann warten, bis
  ich es überhaupt fangen kann. Das Gameplay leidet sehr darunter.“
- „Ansonsten hat das Spiel Potenzial als Cozy-Incremental.“

Allgemeine Rückmeldungen aus der Luftpolster-Runde, die auch hier gelten:
- **Spieler wollen ihren Drang, schnell zu spielen, nicht zügeln müssen.** Eine Mechanik, die
  zum Warten oder Langsamsein zwingt, kam schlecht an. Das ist genau der Kern der Kritik oben.
- Melodische Begleittöne zu jeder Aktion fand er „fragwürdig“. Natürliche Geräusche kamen gut an.
  In Glühwürmchen sind die Fang-Töne pentatonische Glöckchen. Das passt zum Cozy-Ton eher als ein
  Tonleiter-Combo, sollte aber zurückhaltend bleiben und mit ihm geprüft werden.
- Zu schneller Fortschritt fühlt sich billig an. Die ersten Runden dürfen nicht sofort einen
  halben Baum kaufen.
- Endgame: Er wünscht sich die incremental-typische **Eskalation**, also absurde Größe und
  absurdes Tempo am Ende.

## 3. Der Prototyp

**Datei:** `playground/gluehwuermchen.html` auf dem Branch **`claude/epic-franklin-jgrcz1`**.
Auf `main` liegt sie nicht. So holst du sie dir:

```sh
git fetch origin claude/epic-franklin-jgrcz1
git checkout origin/claude/epic-franklin-jgrcz1 -- playground/gluehwuermchen.html playground/gluehwuermchen_HANDOFF.md
```

Arbeite auf deinem eigenen Branch, **nicht** auf `claude/epic-franklin-jgrcz1`.

Was drin ist (eine Datei, etwa 600 Zeilen, keine Assets):
- **Szene:** Himmel von der Dämmerung über die Nacht bis zum Morgengrauen, Sterne, Mond,
  Hügel- und Baumsilhouetten, wiegendes Gras. Eine Laterne links unten und eine Lichterkette
  zwischen den Bäumen, deren Birnen mit jeder gekauften Stufe angehen. Alles prozedural auf Canvas,
  die Glühwürmchen als additiv geblendete Glüh-Sprites.
- **Runde = eine Nacht**, 40 s plus 6 s pro Stufe „Lange Nacht“.
- **Fangen:** Das Glas folgt Maus oder Finger (bei Touch 46 px über dem Finger). Glühwürmchen
  blinken mit einer eigenen Phase und Periode (2,2 bis 3,6 s, leuchtend in 38 % davon) und lassen
  sich **nur fangen, solange sie leuchten**. Genau das ist der Frustpunkt.
- **Glas und Laterne:** Das Glas fasst 6 (+4 pro Stufe). Voll heißt: zur Laterne und leeren.
  Bei Sonnenaufgang fliegt davon, was noch im Glas ist (das Upgrade „Späte Heimkehr“ behält 50
  bzw. 100 %).
- **Besonderheiten:**
  - Blaue Geister: glimmen dauerhaft, fliegen tief und langsam, bringen ×4.
  - Goldene Königin: selten und schnell, bringt ×25 und einen Schwarm.
  - Sternschnuppen: mit dem Glas durchfahren gibt einen Licht-Bonus.
  - Einmachgläser im Gras: fangen passiv.
  - Lockduft: zieht Glühwürmchen zum Glas.
  - Nachtsicht: erlaubt Fänge schon beim Aufglimmen bzw. jederzeit.
  - **Gleichtakt:** ein Kuramoto-Modell, die Phasen ziehen sich zum Mittelwert. Das ist ein echtes
    Naturphänomen und optisch das Schönste im Spiel. Fänge, während über 60 % gleichzeitig
    leuchten, bringen einen Bonus.
- **Lichterbaum:** Der Skill-Baum ist wörtlich ein Baum. Äste sind SVG-Beziers, die zur Wurzel hin
  dicker werden, und Knoten sind hängende Laternen, die nach dem Kauf glühen. Er hat 15 Knoten,
  einer davon ist der Prestige-Teaser „Jahreszeiten“. Unter 560 px wird die x-Achse auf 60 %
  gestaucht, damit die Knoten tippbar bleiben. Ein Tipp zeigt einen Knoten, ein zweiter kauft ihn.
- **Speicherstand:** `localStorage` unter dem Schlüssel `gluehwuermchen_proto_v1`.
- **Test-Hülle:** `window.GLOW_GAME` mit `update(dt)`, `startRun()`, `ptr`, `flies`, `jar`,
  `NODES` usw. Damit lief ein Playwright-Bot. Er fängt gezielt, leert bei vollem Glas und
  rechtzeitig vor Sonnenaufgang. Mit ihm ist das Tempo eingestellt: Baum voll nach etwa 10
  Minuten Bot-Zeit, Nächte 40 bis 70 s.

Balance-Lehren aus allen drei Prototypen:
- Alles, was eine Runde **verlängert** (Bonuszeit, Schwung nachfüllen), braucht abnehmenden
  Ertrag oder ein Budget. Sonst endet eine gute Runde nie, und das passiert immer genau dann, wenn
  die Upgrades zusammenkommen. Der Bot hat das jedes Mal gefunden.
- Multiplikatoren, die sich gegenseitig füttern (Wachstum → Tempo → mehr Beute), kippen in einen
  Sprung statt in eine Kurve. Prüfe das mit einem Bot, der lange genug spielt.
- Ein Bot ist übermenschlich präzise. Gib ihm eine Reaktionszeit und eine begrenzte
  Zeigergeschwindigkeit, und rechne für Menschen mit etwa 1,5-facher Bot-Zeit.

## 4. Was die Recherche ergeben hat (Kurzfassung)

Die fünf Vorbilder folgen alle dem Muster, das *Nodebuster* bekannt gemacht hat:
- **Eine Aktion aus dem echten Leben**, die man ohne Tutorial versteht.
- **Kurze Runden** (30 bis 90 s) mit **festem Ende** durch Uhr, Ausdauer oder Geld, dazwischen
  der **Skill-Baum**, der als große Karte zugleich der Fortschrittsbalken ist. Gesperrte Knoten
  sieht man als Umriss.
- **Effekte, die sich steigern.**
- **Humor oder ein klares Gefühl** als Thema.
- **Kurz, mit echtem Ende:** 3 bis 10 h auf Steam. Im Browser eher 2 bis 3 h.

Die Kritik in negativen Reviews ist die eigentliche Anleitung:
- Automatisierung nimmt dem Spieler die Aktion weg (Scritchy Scratchy). Sie sollte seine
  **Rolle ändern**, nicht die Aktion abschaffen.
- „+3 %“-Upgrades langweilen (Fishing Inc). Etwa alle zehn Knoten sollte sich ändern, *wie*
  man spielt.
- Lineare Bäume („all roads lead to Rome“, Bills Must Be Paid) brauchen echte Entscheidungen.
- Das Spiel stirbt hinten heraus (Keep on Mining, Fishing Inc). Jede Prestige-Stufe braucht etwas
  Neues.
- Ein passiver Teil, der sich nie lohnt, ist totes Gewicht (die Mine in Keep on Mining).

Daraus abgeleitet:
- Das erste Prestige kommt nach etwa 20 bis 30 Minuten, danach geht der Wiederaufstieg 3- bis
  5-mal schneller.
- Höchstens zwei Ebenen: die Runde und das Prestige.
- Die Spielzeit liegt bei 2 bis 3 h, mit einem Abspann.
- Maus **und** Touch müssen funktionieren.

## 5. Vorschlag für die volle Version

Das sind Vorschläge, keine Vorgaben. Stimme sie mit dem Nutzer ab, bevor du groß baust.

**Den Frust lösen.** Es gibt mehrere Wege. Ich würde einen kleinen A/B-Test auf einer Seite
bauen, so wie das „Noppen-Labor“ für Luftpolster, und den Nutzer fühlen lassen:
- a) **Jederzeit fangbar, aber Leuchten zählt:** Ein Fang im Aufleuchten bringt ×3 und einen
  hellen Klang, ein Fang im Dunkeln ×1. Niemand muss warten, und Timing lohnt sich trotzdem.
  Das ist meine Empfehlung.
- b) Dunkle Glühwürmchen sind fangbar, fliehen aber. Leuchtende sind träge.
- c) Leuchtende Glühwürmchen ziehen zum Glas hin, statt dass dunkle blockiert sind.

Im Labor zu Luftpolster hat sich gezeigt: Eine Variante, die bremst, verliert klar, auch wenn
sie „Sinn ergibt“.

**Prestige = Jahreszeiten** (war als Teaser angelegt). Mit jeder Jahreszeit kommt eine neue
Mechanik, keine bloßen Multiplikatoren. Mögliche Richtungen:
- Sommer: Glühwürmchen.
- Herbst: Irrlichter über dem Moor, die Wege bilden.
- Winter: Polarlicht und Eiskristalle, die Licht brechen.
- Frühling: Knospen, die Licht speichern.

Der Lichterbaum behält seine Laternen, oder eine zweite Baumkrone wächst dazu.

**Eskalation im Endgame.** Aus der Wiese wird ein Wald voller Lichter, dann ein Himmel, am Ende
vielleicht eine ganze Milchstraße aus Glühwürmchen. Absurde Zahlen, ein Bildschirm voller Licht
und ein Abspann.

**Name im Katalog:** Die Seite ist englisch. Mögliche Namen sind „Firefly Jar“ oder „Lantern
Meadow“. Das Luftpolster-Spiel bekommt englische Texte mit deutscher Übersetzung, die sich nach
der Browsersprache richtet und umschaltbar ist. Mach es hier genauso, damit beide Spiele gleich
funktionieren.

## 6. Repo-Konventionen (Kurzfassung von `CLAUDE.md`, bitte trotzdem selbst lesen)

- Jede Seite ist **eine eigenständige `.html`-Datei** in `games/`, mit CSS und JS inline, ohne
  Bundler und ohne Assets. Klang über Web Audio, Grafik über Canvas oder CSS.
- **Keine neuen Backends:** kein Firebase, keine Datenbank. Das ist eine feste Entscheidung.
- Der schwebende Logo-Button (`<script src="../logo.js"></script>`) ist optional.
- **Fünf Schritte für den Katalog:**
  1. `games/<id>.html` anlegen, mit `<title>` und `<meta name="description">`.
  2. `data/games.json` ergänzen (Kategorien und Tags aus den Listen oben in
     `util/new_entry.py`). **`featured` ist standardmäßig false.**
  3. `sidebar.html`: ein `<li>` vor `<!-- end -->`.
  4. `sitemap.xml`: alphabetisch einsortieren.
  5. Screenshot unter `screenshots/screenshot_<n>.webp`: 800×800 ohne Logo aufnehmen, auf 260×260
     verkleinern, verlustfrei als WebP speichern.
- **Screenshot-Nummern sind reserviert, damit sich die beiden Spiele nicht in die Quere kommen:**
  Luftpolster nimmt **344**, Glühwürmchen **345**. Prüf vor dem Eintragen, ob 345 noch frei ist.
- Bei Tests hat sich im Repo ein Muster bewährt: Die DOM-freie Spiellogik steht in einem
  `<script id="core">`-Block, und eine Suite unter `test/` führt ihn in Node über `vm` aus
  (siehe `test/downhill_dreamer.mjs` und `test/minesweeper.mjs`, beide mit `README`-Eintrag und
  `npm`-Skript). Für ein Incremental heißt das: Bots mit menschlichen Grenzen spielen das ganze
  Spiel durch, und die Suite prüft Tempo-Ziele (erstes Prestige, Gesamtdauer, keine endlosen
  Runden). Das lohnt sich hier, weil jede Zahl an allem zieht.
- Lies auch `IDEAS.md`, zuerst den Abschnitt **Read this first**. Er erklärt, wie der Katalog
  schmaler wurde. Ein Cozy-Incremental mit Stimmung ist dort ausdrücklich willkommen.

## 7. Zusammenarbeit mit der Luftpolster-Sitzung

- Beide Sitzungen hängen am Ende Einträge an `data/games.json`, `sidebar.html` und
  `sitemap.xml` an. Das gibt beim Mergen leichte Konflikte, die man per Hand auflöst, indem man
  beide Einträge behält. Screenshot-Nummern siehe oben.
- Fass keine Dateien von Luftpolster an, auch nicht den Branch `claude/epic-franklin-jgrcz1`.
- GitHub Pages veröffentlicht nur `main`. Zum Spielen vor dem Merge haben sich private
  **Artifacts** bewährt: dieselbe Datei ohne `<!DOCTYPE>`, `<html>`, `<head>`, `<body>` und ohne
  die `charset`- und `viewport`-Metas, dann veröffentlichen. So spielt der Nutzer sofort am
  Handy. `localStorage` funktioniert dort.

## 8. Vorschlag für den Ablauf

1. Diese Datei und `CLAUDE.md` lesen, dann den Prototyp lokal öffnen (`npx http-server -p 8099`)
   und selbst anspielen.
2. Dem Nutzer ein kurzes Konzept vorlegen: Lösung für das Fangen (als A/B-Labor zum Anfassen),
   Jahreszeiten-Prestige, Eskalation und ein Name. Auf sein Go warten.
3. Die volle Version in `games/<id>.html` bauen: Core-Block, Bot-Suite unter `test/`,
   Tempo-Ziele, Handy und Desktop.
4. Zwischendurch Artifacts zum Anspielen veröffentlichen und nach Feedback nachbessern.
5. Katalogeintrag (fünf Schritte), PR nur, wenn der Nutzer ihn möchte.

## 9. Stand (2026-09-25)

Umgesetzt auf Branch `claude/vibrant-galileo-7uobv0`:
- **Fang-Labor:** `playground/gluehwuermchen_labor.html`. Der Nutzer hat **Variante A** gewählt: jederzeit
  fangbar, im Leuchten ×3.
- **Volles Spiel:** `games/firefly_jar.html`, „Firefly Jar“, nur auf Englisch (Wunsch des Nutzers, wie die
  übrigen Spiele). Katalogeintrag mit Screenshot 345 ist drin, `featured` steht auf false.
- **Jahreszeiten:** Sommer (Glühwürmchen), Herbst (Irrlicht-Pfade), Winter (Eiszapfen-Strahlen, Polarlicht),
  Frühling (Knospen mit Zins), Hochsommer (Eskalation bis zur Milchstraße, danach Abspann). Beim Wechsel
  erlischt die Krone. Angezündete Laternen kosten beim Wiederanzünden ein Viertel, Ringe kaufen Wurzeln.
- **Tests:** `test/firefly_jar.mjs` (`npm run test:firefly`), README-Abschnitt in `test/README.md`. Die
  Preise stammen aus einem Tuner, der jede Jahreszeit auf ihre Zieldauer gebracht hat. Bot-Zeit:
  Handy etwa 82 min, Desktop etwa 69 min, Menschen etwa das 1,5-Fache.

Offen: Feedback des Nutzers vom Handy, besonders zu Klang (Glas-Klirren statt Glöckchen), Tempo und
Lesbarkeit des Baums am Handy.

### Version 2 (auch 2026-09-25)

- Der Leuchtbonus (×3) ist weg. Der Nutzer wischt einfach, und ein Blitz ist zu kurz, um ihn gezielt zu
  treffen. Das Leuchten ist jetzt nur noch Stimmung. Keen Eye, Synchrony, Glow Hunter, Morning Dew und
  Heartwood haben neue Wirkungen.
- Neue echte Arten mit echtem Leuchtverhalten und ein Feldtagebuch mit 11 Seiten (+4 % Licht je Seite).
  Die Wirtschaft ist danach komplett neu abgestimmt.
- Die Fichte besteht jetzt aus hängenden Zweigen, und die dunklen Glühwürmchen sind besser sichtbar.
