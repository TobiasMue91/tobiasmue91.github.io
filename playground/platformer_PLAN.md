# Plan: ein Jump'n'Run à la Super Mario Bros.

Stand 2026-09-27. Dieses Dokument ist der Bauplan und zugleich die Übergabe: Eine spätere Sitzung
ohne Zugriff auf diese Unterhaltung soll damit weiterbauen können. Offene Entscheidungen stehen
gesammelt in **Abschnitt 11**. Der Nutzer hat dem Plan als Ganzem zugestimmt, also gelten dort die
empfohlenen Antworten.

**Wo das Projekt steht:** M1 (Graubox) und M2 (Figuren, Validator, Level 1-1) sind gebaut. Danach
hat der Nutzer das Konzept „SMB1 mit neuem Anstrich“ verworfen: Die Steuerung fühlt sich gut an,
aber dafür fehlt der Bedarf. Es braucht eine eigene Identität. Aus vier Konzepten hat er zwei
gewählt, die jetzt als spielbare Prototypen nebeneinander liegen: **A „Vier Jahreszeiten“** und
**C „Tempo“**. Beide sind in **Abschnitt 15** beschrieben. Nach dem Vergleich am Handy hat der
Nutzer **Tempo gewählt** (Abschnitt 16): Jahreszeiten sei „mega kreativ“, Tempo gefalle vom
Gameplay besser, und darauf lasse sich langfristig besser aufbauen. Weitergebaut wird
`playground/underfoot_tempo.html`. **T1 ist gebaut** (Abschnitt 17): Das Rutschen kostet kein Tempo
mehr, und es gibt drei Level mit drei Arten von Flucht (Uhr, steigendes Wasser, wegbrechendes
Ufer). Das wartet auf das Urteil des Nutzers. Die Abschnitte 1 bis 12 beschreiben noch den ursprünglichen SMB-Plan. Steuerung,
Fairness-Schicht, Levelformat und Testweise gelten weiter.

**Was der Nutzer nach M1 gesagt hat (gilt für alles Weitere):** Die Maus „rutscht ständig über den
Boden“. Gewünscht ist eine reaktionsschnellere Steuerung wie bei **Hollow Knight**: schnelles
Reagieren auf Richtungswechsel am Boden und in der Luft, weniger Rutschen. Und: „Grafiktechnisch
ist noch viel Luft nach oben.“ Deshalb ist die horizontale Bewegung seit M2 ein eigenes Profil
(3.3), und die Sprünge bleiben die des ROMs.

Die Seite selbst wird englisch (wie alle Seiten im Katalog). Dieses Dokument ist deutsch, weil der
Nutzer deutsch schreibt.

---

## 0. Kurzfassung

- **Was:** ein seitlich scrollender Plattformer mit festen, von Hand gebauten Levels. Laufen, rennen,
  springen, Gegner zerstampfen, Blöcke von unten anstoßen, Power-ups, Röhren, Geheimnisse und eine
  Zielfahne. Das Spielgefühl von Super Mario Bros. (1985), aber in einer **eigenen Welt mit eigenen
  Figuren**, ohne Namen, Grafik oder Musik von Nintendo.
- **Warum:** `IDEAS.md` führt den Plattformer seit Jahren als offen: *„the climbers are built, a
  level-based side-scroller is not“* (`Games`-Backlog und „A known genre, done properly“). Es ist der
  größte klassische Genre-Baustein, der im Katalog fehlt.
- **Der Kern ist die Steuerung.** Die Sprünge übernehmen die Physiktabellen von SMB1 **wörtlich**
  (aus dem disassemblierten Original gelesen, Abschnitt 3.1). Die horizontale Bewegung ist seit
  M2 auf Wunsch des Nutzers ein reaktionsschnelles Profil; das Original bleibt als „1985 momentum“
  wählbar. Darauf kommt eine moderne Fairness-Schicht mit Coyote Time, Sprungpuffer und
  Eckenkorrektur. Alles wird gemessen, nicht geschätzt.
- **Der Plan wird in Stufen gebaut, jede davon spielbar**, zuerst als Graubox nur mit der Steuerung.
  Sie muss sich auf Handy **und** Tastatur richtig anfühlen, bevor irgendetwas anderes gebaut wird.
- **Empfohlene Welt:** *Underfoot*. Ein Garten aus der Sicht einer Maus: Grashalme als Plattformen,
  Erdklumpen als Ziegel, Schnecken, deren Häuschen man kickt. Das Setting ist ein Vorschlag, die
  Alternativen stehen in 4.1.

---

## 1. Wie das Projekt zu `IDEAS.md` passt

`IDEAS.md` verlangt, die Achsen offen zu benennen, statt nur eine Lücke zu nennen. Also:

| Achse | Wo das Projekt steht | Kommentar |
|---|---|---|
| Neu ↔ **bekannte Sache, gut gemacht** | ganz rechts | Ausdrücklich ein Hauptthema der Sammlung. SMB1 ist ein fest definiertes Ziel mit veröffentlichten Zahlen, also lässt sich messen, wie nah wir herankommen (wie bei Worms und Scatter). |
| Tief ↔ **sofort** | sofort, mit Tiefe darunter | 1-1 ist in drei Sekunden verstanden und braucht keinen Text. Die Tiefe liegt in Tempo, Geheimnissen und Bestzeiten. |
| Nur Bildschirm ↔ **Gerät** | Gamepad, Touch, Vibration | Die Gamepad-API ist hier zum ersten Mal wirklich zu Hause. |
| Systeme ↔ **Schreiben** | eine **Welt** | `IDEAS.md`: *„A game with a world — somewhere to be rather than somebody to be — is open.“* |
| **Allein** ↔ mit jemandem | allein (v1) | Bewusst so gewählt. Eine billige Zwei-Spieler-Option steht in 11. |
| **Groß** ↔ klein | groß, Ziel 150–250 KB | Auch das ist eine Entscheidung und kein Zufall: Levels und Grafik *sind* hier das Produkt. |

**Die Prüfung passt zur Behauptung** („Verification should fit the claim“). Der Test mit der
„dummen lokalen Heuristik“ ist für Optimierungsspiele gemacht und sagt über einen Plattformer
nichts. Dieses Projekt behauptet drei andere Dinge, und jedes bekommt seine eigene Prüfung:

1. *Die Steuerung fühlt sich an wie SMB, nur fairer.* Geprüft wird das mit einem Test, der die
   Konstanten gegen die Originaltabelle festnagelt (wie der „Coffin“-Test bei Worms), und damit,
   dass der Nutzer es auf dem Handy spielt.
2. *Jedes Level ist fair.* Ein Validator sucht einen Weg durch jedes Level und **misst das
   Zeitfenster** jedes Pflichtsprungs. „Es gibt einen Weg“ reicht nicht, das ist die
   Ass-Fenster-Lehre aus `nine_holes`.
3. *Es sieht großartig aus und bleibt lesbar.* Dafür gibt es Screenshots, Kontaktbögen aller Figuren
   und eine gemessene Kontrastprüfung zwischen Spielebene und Hintergrund.

**Die Content-Decke** (die Lehre aus *Toast*: Material geteilt durch Verbrauch pro Durchgang):
16 Levels zu je 2–4 Minuten beim ersten Spielen ergeben 45–60 Minuten Neuland. Danach wirkt
ein Level anders als ein Witz: SMB 1-1 wird seit 40 Jahren wiedergespielt, weil man
*besser* wird und nicht, weil es neu ist. Die Wiederholung tragen deshalb Bestzeiten mit Geist,
versteckte goldene Samen und Medaillen. Ein Leveleditor mit Teilen-Link wäre die einzige echte
Content-Erneuerung. Er steht als Ausbau in 7.4 und gehört nicht zu v1.

---

## 2. Vier Säulen (sie entscheiden jeden Konflikt)

1. **Steuerung zuerst.** Schlägt sich eine Grafik- oder Leveldesign-Entscheidung mit dem
   Spielgefühl, gewinnt das Spielgefühl.
2. **Ein Level, eine Idee.** Jedes Level hat einen Einzeiler, der vor dem Bauen geschrieben wird.
   Es folgt dem Viertakt Einführen → Entwickeln → Wendung → Prüfung (Kishōtenketsu, so baut Nintendo
   seine Levels). Was die Idee nicht trägt, fliegt raus.
3. **Lesbarkeit vor Schmuck.** Der Spieler erkennt in jedem Frame, was fest ist, was gefährlich ist
   und was er stampfen darf. Aus `blind_crest`: *Art can silently delete a mechanic.* Nach jedem
   Grafikdurchgang laufen die Messungen deshalb neu.
4. **Das Handy ist kein Nachgedanke.** Der Nutzer testet am Telefon. Touch bekommt einen eigenen
   Meilenstein und eine eigene Messung.

---

## 3. Steuerung und Physik

### 3.1 Die Originalzahlen

Die Werte stammen aus der C-Portierung des disassemblierten SMB1-Codes
(`MitchellSternke/SuperMarioBros-C`, `source/SMB/SMBData.cpp` und `SMB.cpp`). Sie wurden in dieser
Sitzung dort gelesen und nicht aus dem Gedächtnis übernommen. Einheiten: 1 Kachel = 16 px,
60 Frames/s. Horizontale Geschwindigkeit wird im Original in 1/16 px/Frame gezählt,
Beschleunigungen in 1/4096 px/Frame².

**Horizontal** (`MaxRightXSpdData`, `FrictionData`)

| Größe | Rohwert | px/Frame bzw. px/Frame² | anschaulich |
|---|---|---|---|
| Höchsttempo Gehen | `$18` | 1,5 | 5,6 Kacheln/s |
| Höchsttempo Rennen (B gehalten) | `$28` | 2,5 | 9,4 Kacheln/s |
| Höchsttempo unter Wasser | `$10` | 1,0 | |
| Beschleunigung Gehen | `$98` | 0,0371 | 0 → Gehen in 40 Frames (erster Schritt `$130`) |
| Beschleunigung Rennen | `$E4` | 0,0557 | 0 → Rennen in 45 Frames, 3,6 Kacheln Anlauf |
| Abbremsen (Richtung losgelassen / aus dem Rennen) | `$D0` | 0,0508 | |
| Schlittern (Gegenrichtung) | doppelter Wert, z. B. `$1A0` | 0,1016 | aus vollem Lauf bis zur Wende in 21 Frames |
| Nachlauf nach Loslassen von B | `RunningTimer = $0A` | | 10 Frames bleibt Renntempo erlaubt |

**Vertikal** (`JumpMForceData`, `FallMForceData`, `PlayerYSpdData`). Die Zeile hängt davon ab,
wie schnell man beim Absprung ist:

| Absprungtempo | Startgeschw. | Schwerkraft bei gehaltenem Knopf, steigend | Schwerkraft sonst |
|---|---|---|---|
| < 1,0 px/F (Stand, langsam) | −4 px/F | `$20` = 0,125 | `$70` = 0,4375 |
| 1,0 – 1,56 px/F (Gehen) | −4 | `$1E` = 0,117 | `$60` = 0,375 |
| ≥ 1,56 px/F (schneller als Gehen) | −5 | `$28` = 0,156 | `$90` = 0,5625 |
| Schwimmen | −1,5 | `$0D` = 0,051 | `$0A` = 0,039 |

Die maximale Fallgeschwindigkeit liegt bei 4,5 px/F; wird sie überschritten, setzt das Original
auf 4,0 zurück. Beim Stampfen federt man mit −4 px/F ab (`SBnce: lda #$fc`).

Drei Eigenheiten machen das Gefühl aus und werden **übernommen**:

- **Die Sprunghöhe regelt die Schwerkraft, nicht ein Abbruch.** Wer den Knopf loslässt, bekommt ab
  sofort die hohe Fall-Schwerkraft. Deshalb fühlt sich ein kurzer Hüpfer knackig an und kein Sprung
  wird abrupt gekappt.
- **Tempo kauft Höhe.** Wer schneller als Gehtempo abspringt, springt eine Kachel höher. Dasselbe
  Prinzip trägt schon `icy_tower`, und es macht Anlauf zu einer Entscheidung.
- **In der Luft gibt es keine Reibung.** Horizontale Kräfte wirken nur, solange eine Richtung
  gedrückt ist. Der Schwung bleibt also erhalten, man kann aber gegenlenken. Das Tempolimit in der
  Luft richtet sich nach dem Absprung: Wer gehend abspringt, kann in der Luft nicht auf Renntempo
  kommen.

### 3.2 Was daraus folgt: die Sprunghüllkurve

Simuliert aus den obigen Tabellen (`envelope.py`, liegt in dieser Sitzung im Scratchpad; der
Physiktest ersetzt es später):

| Sprung (Knopf voll gehalten) | Scheitel | Flugzeit | Weite auf gleicher Höhe |
|---|---|---|---|
| aus dem Stand | 4,1 Kacheln | 53 F (0,88 s) | 0 |
| aus vollem Gehen (1,5 px/F) | 4,4 Kacheln | 57 F | 5,3 Kacheln |
| aus vollem Rennen (2,5 px/F) | 5,2 Kacheln | 55 F | 8,6 Kacheln |

Horizontale Reichweite bis zu einem Absatz, der dy Kacheln höher (+) oder tiefer (−) liegt:

| dy | −4 | −2 | 0 | +1 | +2 | +3 | +4 | +5 |
|---|---|---|---|---|---|---|---|---|
| gehend | 6,8 | 6,0 | 5,3 | 5,1 | 4,7 | 4,4 | 3,9 | – |
| rennend | 10,9 | 9,7 | 8,6 | 8,1 | 7,5 | 7,0 | 6,4 | 5,6 |

Scheitelhöhe in Kacheln, abhängig davon, wie viele Frames der Knopf gehalten wird:

| gehalten | 1 F | 4 F | 8 F | 12 F | 16 F | 24 F | 32 F |
|---|---|---|---|---|---|---|---|
| Stand | 1,45 | 1,94 | 2,52 | 3,01 | 3,41 | 3,95 | 4,13 |
| Rennen | 1,77 | 2,39 | 3,13 | 3,75 | 4,26 | 4,93 | 5,16 |

**Daraus ergibt sich die Grammatik fürs Leveldesign.** Das sind Obergrenzen; der Validator prüft
zusätzlich das Zeitfenster.

| Abschnitt | Lücken | Stufen hoch | verlangt |
|---|---|---|---|
| Welt 1 | ≤ 3 Kacheln | ≤ 3 | nie Rennen, nie Präzision unter 2 Kacheln Landefläche |
| Welt 2 | ≤ 5 | ≤ 4 | Rennen erstmals mit ≥ 6 Kacheln Anlauf |
| Welt 3–4 | ≤ 7 | ≤ 5 (nur mit Anlauf) | Landeflächen bis 1 Kachel |
| nie | ≥ 8 | ≥ 6 | Lücken, die nur mit dem Maximum gehen (8,6 ist das Limit) |

### 3.3 Wo wir vom Original abweichen, und warum

**Seit M2 das Wichtigste zuerst: die horizontale Bewegung.** Nach dem Spieltest von M1 ist das
Standardprofil „responsive“. Die Geschwindigkeit läuft mit festen Raten auf ihr Ziel zu, am Boden
wie in der Luft (`FEEL.snappy` im Kern):

| | 1985 (ROM) | responsive (Standard) |
|---|---|---|
| Stand → Gehtempo | 40 Frames | 3 Frames |
| Stand → Renntempo | 45 Frames | 11 Frames |
| Loslassen aus Gehtempo | 41 Frames, rutscht 30 px | 3 Frames, 1,5 px |
| Loslassen aus Renntempo | 60 Frames, rutscht 68 px | 5 Frames, 5 px |
| Wende aus dem Gehen (volles Gehtempo in Gegenrichtung) | 51 Frames | 5 Frames |
| Wende aus dem Rennen bis Gehtempo in Gegenrichtung | 48 Frames | 6 Frames |
| Wende in der Luft (Geh-/Renntempo) | schafft sie vor der Landung nicht | 6 / 10 Frames |
| in der Luft ohne Richtung | Schwung bleibt ganz | läuft in 20 Frames aus (Renntempo) |

(Alles gemessen mit dem Kern der Seite, nicht geschätzt.)

Gleich geblieben sind alle Sprünge: Höhe je Absprungtempo, Schwerkraftwechsel beim Loslassen,
Fallgrenze. Ein Test prüft, dass sie im neuen Profil Frame für Frame die des ROMs sind. Weiter gilt:
Das Tempolimit in der Luft richtet sich nach dem Absprung.

Die übrigen Abweichungen:

Übernommen wird das Gefühl, nicht jede Macke. Jede Abweichung wird im Test als Schalter gebaut,
damit man ihren Effekt messen kann (Bot mit menschlicher Reaktionszeit, mit und ohne Schalter):

| Abweichung | Wert (Startpunkt) | Grund |
|---|---|---|
| **Coyote Time**: Springen ist kurz nach dem Verlassen einer Kante noch erlaubt | 6 Frames | SMB1 hat das nicht. Die häufigste „Ich hab doch gedrückt!“-Frustration |
| **Sprungpuffer**: ein zu früher Druck vor der Landung zählt | 6 Frames | dasselbe am anderen Ende des Sprungs |
| **Eckenkorrektur**: stößt man mit dem Kopf nur die Ecke eines Blocks, wird man seitlich vorbeigeschoben | ≤ 4 px | Anstoßen an einer Ecke fühlt sich wie ein Fehler des Spiels an |
| **Großzügiges Stampfen**: zählt, wenn man fällt und die Füße im Frame davor über der Gegnermitte waren | | Gegner-Hitbox für Schaden kleiner als die Grafik, fürs Stampfen größer |
| **Höher abfedern**: wer beim Stampfen den Knopf hält, federt höher | | Das kam mit SMB3/SMW und ist heute erwartet |
| **Blickrichtung in der Luft** folgt dem Stick | | SMB1 friert sie ein, was modern falsch wirkt |
| **Getrennte Subpixel** für Tempo und Position | | Im Original teilen sie sich ein Byte, was reines Rauschen ist |
| **B loslassen im Rennen**: sanft mit `$D0` auf Gehtempo abbremsen | 20 Frames | Das ROM kappt nach 10 Frames Nachlauf sofort auf Gehtempo, ein Ruck von 60 px/s |
| Kein Mondlauf, kein Wand-Zipping, keine anderen Glitches | | |

**Nicht** hinzukommen: Wandsprung, Doppelsprung, Dash. Das wäre ein anderes Spiel.

### 3.4 Takt, Determinismus, Eingabe-Latenz

- **Feste 60-Hz-Simulation mit Ganzzahl-Arithmetik** (Positionen und Tempo in 1/4096 px als
  Integer; so ist jeder Tabellenwert des ROMs exakt), damit jeder Durchlauf auf jedem Gerät
  identisch ist. Gerendert wird mit der Bildwiederholrate des
  Displays, zwischen zwei Simulationsschritten interpoliert (bei 120-Hz-Handys wichtig). Nach einem
  Hänger werden höchstens 5 Schritte nachgeholt, damit sich nichts aufschaukelt.
- **Determinismus ist Voraussetzung, keine Kür.** Er ermöglicht Wiederholungen, einen Geist der
  eigenen Bestzeit (nur ein Eingabe-Log) und Tests mit goldenen Tabellen (wie `moorhuhn`,
  `pingu_throw`).
- **Kein Tastendruck geht verloren.** Tastatur- und Touch-Ereignisse kommen in eine Warteschlange und
  werden zu Beginn des nächsten Schritts gelesen. Wer innerhalb eines Frames drückt und wieder
  loslässt, springt trotzdem.

### 3.5 Kollision

- Kacheln sind achsenparallele Rechtecke. Aufgelöst wird getrennt nach Achsen (erst x, dann y). Bei
  höchstens 4,5 px pro Frame und 16-px-Kacheln kann nichts durch eine Wand tunneln. Ein Test
  bestätigt das mit 100.000 Zufallsschritten: niemand steckt je in einem festen Block.
- Die Spielfigur hat einen Hitbox-Sarg wie bei Worms, nur kleiner als die Grafik. Klein: 12×14 px,
  groß: 12×28 px, geduckt: 12×14 px. So ist es seit M1 umgesetzt.
- Dazu kommen Plattformen, durch die man von unten springt (Grashalme, Wurzeln), und bewegliche
  Plattformen, die einen mitnehmen (erst in Welt 3–4).
- **Keine Schrägen in v1.** SMB1 kommt ohne aus, und Schrägen sind die klassische Zeitfalle bei der
  Kollision. Wenn überhaupt, kommen sie später.

### 3.6 Kamera

- Die Sichthöhe ist fest: **15 Kacheln**. Die Breite hängt vom Bildschirm ab und liegt zwischen
  **16 Kacheln** (Hochformat, genau die Breite von SMB1) und **26 Kacheln** (Querformat).
  **Jedes Level muss schon bei 16 Kacheln fair sein.** Das prüft der Validator.
- Horizontal: ein Totbereich mit Vorausschau in Laufrichtung, die mit dem Tempo wächst. Rennt man,
  sieht man weiter nach vorn.
- Vertikal: Die Kamera rastet auf Plattformhöhen ein (wie in Super Mario World). Sie bewegt sich
  erst nach der Landung auf einer neuen Höhe oder wenn man den Bildrand erreicht, und springt
  deshalb nicht bei jedem Hüpfer mit.
- **Fällt man unter die letzte Standhöhe, eilt die Kamera voraus** und hält die Figur bei 45 % der
  Bildhöhe. So sieht man, wo man landet. Das kam in M1 dazu: Vorher klebte die Figur beim Fallen
  am unteren Rand.
- Anders als SMB1 darf man zurücklaufen. Die Levels laufen trotzdem fast immer nach rechts.
- **Keine Sprünge ins Ungewisse:** Beim Absprung muss die Landestelle zu sehen sein. Auch das prüft
  der Validator.

### 3.7 Eingabegeräte

**Tastatur:** Pfeile oder WASD bewegen. Springen liegt auf Leertaste, Z oder K, Rennen und Werfen
auf Shift, X oder J (wie B bei SMB: ein Knopf für beides). Ducken und in Röhren steigen geht mit
Pfeil runter. Die Tasten lassen sich neu belegen (M6).

**Gamepad** (Standard-Mapping der Gamepad-API): A springt, B oder X rennt und wirft. Bewegt wird mit
D-Pad oder linkem Stick (Totzone 0,3). Optional rennt man automatisch, wenn der Stick weit
ausgelenkt ist.

**Touch.** Das ist der schwierigste Teil und bekommt deshalb am meisten Sorgfalt:

- **Hochformat im Game-Boy-Layout:** oben das Spiel mit 16×15 Kacheln, unten die Bedienfläche.
  Nichts verdeckt das Spielfeld, und die Daumen haben reichlich Platz.
  **Querformat:** Die Bedienung liegt als halbtransparente Zonen über dem Bild, das Spielfeld wird
  voll genutzt.
- **Linker Daumen: ein schwebender Stick.** Wo der Daumen aufsetzt, ist die Mitte. Bis ±10 px Weg
  passiert nichts, bis ±40 px geht man, darüber rennt man (mit Hysterese). Das ist dieselbe Lehre
  wie in `blind_crest`: *Binary steering is why a driving game feels bad on a phone.* Mit Tempo
  proportional zur Daumenposition braucht Touch keinen eigenen Renn-Knopf. Nach unten gezogen duckt
  man sich oder steigt in eine Röhre.
- **Rechter Daumen:** eine große Sprungzone (die ganze untere rechte Fläche) und darüber ein kleiner
  Wurf-Knopf. Wie hoch man springt, bestimmt wie auf der Tastatur die Drückdauer.
- Multitouch ist Pflicht. Kurze Vibration beim Stampfen und Landen gibt es, wo das Gerät sie kann
  (Android; iOS ignoriert sie).
- **Messung** wie bei `blind_crest`: Der Bot spielt einmal über das Touch-Eingabemodell und einmal
  über die Tastatur, beide mit gleicher Reaktionszeit. Beide müssen auf dieselbe Todesrate kommen.
  Erst dann ist Touch fertig.

---

## 4. Welt und Inhalt

### 4.1 Setting: drei Möglichkeiten, eine Empfehlung

Die Welt muss eigenständig sein: keine Pilze, keine Schildkröten, keine Klempner. Wie in SMB soll
aber jeder Leveltyp eine natürliche Entsprechung haben.

| | **A) Underfoot – ein Garten aus Mäuseperspektive** (Empfehlung) | B) Spielzeugkiste im Kinderzimmer | C) klassisches Fantasy-Königreich |
|---|---|---|---|
| Blöcke | Erdklumpen (zerbröseln), Honigwaben (?-Block) | Bauklötze, Geschenkkartons | Steinziegel, Truhen |
| Röhren | Regenrinnen, hohle Bambusstäbe, Blechdosen | Papprollen | Röhren |
| Gegner | Käfer, Schnecken, Igel, Maulwürfe, Wespen, Frösche | Zinnsoldaten, Aufziehfiguren | Schleime, Goblins |
| Welten | Beet, Wurzelwerk, Teich, Gewächshaus bei Nacht | Teppich, unterm Bett, Badewanne, Dachboden | Wiese, Höhle, See, Burg |
| Stärke | natürliche Vielfalt; weiche, prozedurale Vektorgrafik (Gras, Licht, Tau) liegt der Seite; eine echte Welt | extrem gut lesbar, kantige Formen sind leicht zu zeichnen | niemand muss etwas erklärt bekommen |
| Schwäche | Maßstab muss konsequent bleiben | Welten weniger abwechslungsreich | generisch, am nächsten an „Mario ohne Mario“ |

**Warum A:** Die Welt ist ein Ort, an dem man sein will. Alltägliches wird riesig: ein
Tautropfen, der das Licht bricht, ein Blumentopf als Burg. Jede Welt bringt eine eigene Mechanik
mit, die aus dem Ort kommt und nicht aufgesetzt ist.

### 4.2 Held, Power-ups, Sammelzeug (für Setting A)

- **Held:** eine kleine Feldmaus mit Eichelhut als Helm. Der Hut ist das Erkennungszeichen wie
  Marios Mütze und macht die Silhouette unverwechselbar. Ohren und Schwanz schwingen nach. Einen
  Namen gibt es noch nicht.
- **Erdbeere → groß** (entspricht dem Pilz): Sie rollt wirklich, springt an Röhren zurück und
  kullert Kanten hinunter.
- **Erbsenschote → Erbsen werfen** (entspricht der Feuerblume): Die Erbsen hüpfen über den Boden wie
  Feuerbälle, höchstens zwei gleichzeitig.
- **Glühwürmchen → leuchten und unverwundbar** (entspricht dem Stern, etwa 10 s): Es hüpft davon und
  muss gefangen werden. Nebenbei ein Gruß an `firefly_jar`.
- **Samen** sind die Münzen. **Drei goldene Samen** pro Level liegen versteckt (wie die Sternmünzen
  in New Super Mario Bros.) und sind der Hauptgrund, ein Level wiederzuspielen.
- **Die Zielfahne ist ein Sonnenblumenstängel.** Je höher man ihn anspringt, desto mehr Samen.
- Die kleine Geschichte: Die Elster hat die goldenen Samen des Gartens gestohlen. Sie wird nur über
  Umgebung, Schilder und Endgegner erzählt, nie mit Text vor dem Spielen.

### 4.3 Gegner: jeder mit genau einer Regel

Das ist die Lehre aus `scatter`: *Die Gegner-KI ist kein Schwierigkeits-, sondern ein
Lesbarkeitssystem.* Deshalb hat jeder Gegner eine unverwechselbare Silhouette und eine Farbe. Er
kündigt an, was er gleich tut, und hat genau eine Regel, die man nach einer Begegnung kennt.

| Gegner | entspricht | Regel |
|---|---|---|
| Laufkäfer | Gumba | läuft, dreht an Wänden um, fällt von Kanten; wird zerstampft |
| Schnecke (gelb / rot) | Koopa | Gestampft zieht sie sich ins Haus zurück. Das Haus lässt sich kicken, schlittert, prallt an Wänden ab und räumt Gegner in Serie ab. Es trifft aber auch dich. Die rote Schnecke dreht an Kanten um |
| Igelchen | Stachi | nicht stampfbar; zu besiegen mit Haus, Erbse oder einem Stoß von unten |
| Marienkäfer | fliegender Koopa | hüpft oder fliegt; einmal gestampft verliert er die Flügel |
| Maulwurf | Piranha-Pflanze | kommt aus Rinnen und Löchern; **nie, solange du direkt daneben stehst** (die SMB-Regel) |
| Wespe | – | fliegt auf einer festen Schleife; ihre Bahn ist als Spur im Gras sichtbar |
| Frosch (Welt 3) | Cheep-Cheep | springt in Bögen aus dem Wasser |
| Elster | Bowser | ein Endgegner pro Welt, jedes Mal mit einem neuen Trick |

### 4.4 Welten und Levels

Das Ziel sind **4 Welten mit je 4 Levels** (3 Außenlevels und eine Festung). Jede Welt führt eine
Mechanik ein, die zum Ort gehört. Titel und Einzeiler sind ein Entwurf:

**Welt 1: Das Beet** (Grundlagen)
- 1-1 *Morning Dew*: alles, was Welt 1 braucht, ohne ein Wort Text. Der erste Käfer kommt, während
  eine Honigwabe über dir hängt. Die Erdbeere rollt nach rechts, prallt an einer Rinne ab und kommt
  zu dir zurück. Wie im Original ist das Level selbst die Anleitung.
- 1-2 *Beneath the Beds*: unter der Erde. Erdklumpen zerbröseln, wenn du groß bist, die Decken
  sind niedrig, und irgendwo steckt eine geheime Abkürzung durch eine Rinne.
- 1-3 *Tall Grass*: Grashalme sind Plattformen, durch die man von unten springt, und **biegen sich
  unter deinem Gewicht**. Zum ersten Mal Schnecken und ihre Häuser.
- 1-4 *The Compost Heap* (Festung): warme Dampfstöße im Takt (entsprechen den Feuerstangen) und das
  erste Treffen mit der Elster.

**Welt 2: Wurzelwerk** (unter der Erde): Maulwürfe, Wurzeln als Plattformen, **Ameisenstraßen als
Förderbänder** und rieselnde Kiesel mit Vorwarnung. Leuchtpilze sind die Lichtquelle, aber
Dunkelheit versteckt nie eine Gefahr.

**Welt 3: Der Teich**: Schwimmen (mit den Schwimmzeilen der SMB-Tabelle), **Seerosenblätter, die
langsam sinken**, Wasserläufer als bewegte Plattformen, Frösche und Libellen, Schilfsprünge.

**Welt 4: Gewächshaus bei Nacht**: hängende Blumentöpfe an Schnüren (Waagen-Plattformen wie in SMB),
Sprinkler, Wespen, Igel und der Endkampf gegen die Elster.

Jedes Level bekommt einen Kontrollpunkt in der Mitte, drei goldene Samen und die Zielfahne.

**Wo man kürzen kann, falls nötig:** v1 mit den Welten 1–3 (12 Levels), Welt 4 als zweiter Schub.
Leveldesign kann kein Bot beurteilen. Jede Welt geht deshalb erst an den Nutzer zum Spielen, bevor
die nächste gebaut wird.

---

## 5. Grafik und Präsentation

### 5.1 Stil

**Empfehlung: eine prozedurale Vektor-Diorama-Optik**, keine Pixel-Art. Figuren und Kacheln bestehen
aus Formen, Verläufen und weichem Licht, direkt in Canvas gezeichnet. Die Gründe:

- Das kann die Seite nachweislich gut (`downhill_dreamer`, `firefly_jar`, `nine_holes`). Von einem
  Sprachmodell gezeichnete Pixel-Art ist dagegen eine bekannte Schwachstelle: Jeder
  Animationsframe ist ein handgemaltes Raster, und dabei sieht es schnell billig aus.
- Animation per Rig statt per Einzelbild. Die Maus besteht aus Körper, Kopf, Ohren, Schwanz und
  Beinen und wird mit Squash & Stretch bewegt. So entstehen beliebig viele flüssige Zustände
  (Stehen und Atmen, Gehen, Rennen in Vorlage, Schlittern, Sprung gestreckt, Landung gestaucht,
  Ducken, Umdrehen, Wachsen, Röhre).
- Die Grafik bleibt auf jedem hochauflösenden Display scharf.

Die Alternative, Pixel-Art im NES/SNES-Stil (16×16, Paletten als Zeichenketten im Code), wäre
authentischer, aber aufwendiger und riskanter. Sie steht zur Wahl in Abschnitt 11.

### 5.2 Ebenen

Von hinten nach vorn:

1. **Himmel** mit Tageszeit je Level.
2. **Ferne Parallaxe:** Zaun, Hausmauer, Baumkronen. Wird einmal in breite Streifen gebacken.
3. **Nahe Parallaxe:** riesige Grashalme, Blüten, Bokeh-Lichtflecken.
4. **Spielebene:** Kacheln, **pro Chunk in eine Offscreen-Canvas gebacken**. Das ist die Lehre aus
   `nine_holes`: gebackene Ebene plus Live-Ebene.
5. **Figuren und Objekte.**
6. **Wenige Vordergrund-Elemente:** nie über dem Weg, nie über einer Gefahr.
7. **Partikel und HUD.**

**Lesbarkeitsregeln, gemessen statt geschätzt:** Feste Kacheln haben Kontur und eine helle
Oberkante. Die Hintergrundebenen sind entsättigt und zum Himmel hin verschoben (Luftperspektive).
Ein Test misst den Luminanzkontrast zwischen Spielebene und Hintergrund in jedem Welt-Farbschema,
wie `strata` seine Palette per ΔE gemessen hat.

### 5.3 Saft, aber dosiert

Staub bei Landung, Schlittern und Wenden; ein Funkeln bei Samen. Stößt man einen Block an, hüpft er,
und Gegner auf ihm fliegen mit. Erdklumpen zerbröseln in Brocken. Ein zertretener Gegner wird platt,
dazu erscheint die Serienzahl. Beim Stampfen gibt es 2–3 Frames Hitstop, Bildschirmwackeln nur bei
großen Ereignissen, und bei vollem Tempo zieht die Maus leichte Nachbilder.

### 5.4 Leistung

- Kein `shadowBlur` pro Frame. Aus `jigsaw`: *158 ms pro Frame auf dem Desktop.* Schatten werden
  deshalb gebacken.
- Die Pixeldichte ist auf 2 begrenzt, Vignetten und Verläufe über den ganzen Bildschirm werden
  gebacken.
- Gemessen wird, indem man einzelne Zeichenschritte weglässt und vergleicht. Aus `blind_crest`:
  Timing mit canvas2d misst nichts, und die echte Bildrate eines Handys lässt sich von hier nicht
  messen. Das erledigt der Nutzer in der Claude-App.

---

## 6. Ton und Musik

- **Soundeffekte mit Web Audio**, eher weich und natürlich als schrille NES-Rechtecke: ein
  hölzernes Klopfen am Block, ein Plopp beim Stampfen, ein gläsernes Zupfen beim Samen, ein
  gedämpftes Bröseln bei Erdklumpen. Aus der Glühwürmchen-Runde weiß man: Melodische Töne bei
  *jeder* Aktion kamen schlecht an, natürliche Geräusche gut. Nur der Sprung darf ein kurzes, leises
  „Hüpf“ haben.
- **Pro Welt ein geschriebenes Thema**, keine dahinplätschernden Schleifen (so kam es bei
  Firefly Jar gut an). Dazu Varianten für Festung, Unterwasser und Unverwundbarkeit, Jingles für
  Ziel und Tod. Alles ist eigene Musik; von Nintendo wird keine Note zitiert.
- Lautstärke und Stummschalten sind im HUD jederzeit erreichbar.

---

## 7. Fortschritt und Meta

### 7.1 Leben oder nicht (Empfehlung: modern)

Kein Game Over, unbegrenzte Versuche, Kontrollpunkt in der Levelmitte. Der Zähler zählt Tode statt
Leben. SMB-Leben, der Timer mit Zeitlimit und der Punktestand bestrafen heute mehr, als sie
Spannung erzeugen. Die Uhr läuft stattdessen **aufwärts** und zählt nur für Medaillenzeiten. Das HUD
zeigt also nur: Samen, goldene Samen und Zeit. (Offene Entscheidung, siehe 11.)

### 7.2 Speichern

`localStorage`: freigeschaltete Levels, goldene Samen, Bestzeiten, der Geist der Bestzeit (ein
Eingabe-Log von wenigen KB) und die Optionen. Jeder Zugriff steckt in `try/catch`; das Spiel läuft
auch ohne Speicher.

### 7.3 Weltkarte und Wiederspielen

- Eine kleine **Weltkarte** mit Pfad und Knoten: Levelauswahl, gesammelte goldene Samen,
  Medaillen.
- **Zeitfahren gegen den eigenen Geist**, drei Medaillenzeiten pro Level. Die Zeiten kommen aus den
  Bot-Messungen, nicht aus dem Bauch.
- Ein Hilfsmodus wird erst gebaut, **nachdem** die Bots gezeigt haben, woran Menschen scheitern. Aus
  `scatter`: *Eine Hilfe, die auf das Falsche zielt (dort das Tempo), bewirkt nichts.* Bei
  Plattformern sind es fast immer die Abgründe.

### 7.4 Ausbau nach v1 (nicht Teil des Plans, nur notiert)

- **Leveleditor mit Teilen-Link:** das Level komprimiert in der URL, ohne Server, passend zu „ein
  Seed in der URL ist ein teilbares Artefakt“. Der einzige Weg, die Content-Decke wirklich zu heben.
- **Geister-Duell:** zwei Spieler, ein Gerät. Man läuft abwechselnd, der Geist des anderen läuft mit.
  Das wäre billiges „mit jemandem“.

---

## 8. Technik

### 8.1 Aufbau der Datei

Eine Datei, `games/<id>.html`. Die id hängt vom Setting ab; mit Setting A wäre es `underfoot`. Sie
hat drei Skriptblöcke:

1. `<script id="core">`, **ohne DOM**: Ganzzahl-Physik, Kollision, Gegnerlogik, Items, Levelparser
   und Regeln. Eingabe → Zustand, sonst nichts. Das Muster von `downhill_dreamer` und `bubble_break`:
   Der Test führt genau diesen Block in Node aus.
2. `<script id="levels">`: die Leveldaten.
3. Präsentation: Rendering, Rig-Animation, Partikel, Audio, Eingabegeräte, Menüs.

Nützliche URL-Parameter: `?level=2-3` startet direkt dort. `?debug` blendet Hitboxen und die
Sprungvorschau ein, erlaubt Frame-für-Frame-Stepping und zeigt die Kamerazonen.

### 8.2 Levelformat

ASCII-Zeilen, 15 hoch, mit Legende. Figuren sind Buchstaben. Das lässt sich diffen, vom Autor lesen
und im Review prüfen, bei etwa 3 KB pro Level. Skizze:

```js
{ id: '1-1', name: 'Morning Dew', theme: 'bed', music: 'bed',
  idea: 'Walk, jump, stomp — everything World 1 needs, without a word of text.',
  rows: [
    '..................................................................',
    '.........................o.o.o....................................',
    '.....................?...................................?B?B.....',
    '..................................................................',
    '.................................()...............................',
    '.........?.....B?B?B.............[].........()....................',
    '.................................[].........[]....................',
    '..@.............b................[]....b....[].......b.s..........',
    '=================================================..=======....====',
    '#################################################..#######....####',
  ] }
// @ Start  = Grasnarbe  # Erde  ? Samenblock  * Erdbeerblock  B Erdklumpen  X Stein
// ( ) Rinnenkopf  [ ] Rinnenschaft  - Plattform von unten  o Samen  G goldener Samen
// b Laufkäfer  s Schnecke  r rote Schnecke (dreht an Kanten)  ! Kontrollpunkt  F Ziel
```

### 8.3 Tests (`test/<id>.mjs`, reines Node)

| Suite | prüft |
|---|---|
| `physics` | Die Konstanten gegen die Tabelle in 3.1: Sprunghöhen 4,125 / 4,39 / 5,16 Kacheln, 40 und 45 Frames Anlauf, 21 Frames Schlittern bis zur Wende, Fallgrenze. Legt das Gefühl fest wie der Coffin-Test bei Worms |
| `collision` | Nichts tunnelt, bei 100.000 Zufallsschritten steckt die Figur nie im Block, Eckenkorrektur an den Grenzfällen (3/4/5 px), Plattformen von unten durchspringbar, Mitnahme auf bewegten Plattformen |
| `levels` | **Der Validator.** Eine Suche (A* über Makro-Eingaben mit der echten Physik) findet für jedes Level einen Weg ins Ziel, **klein und groß**, denn Ziegel dürfen den kleinen Helden nie aussperren. Für jeden Pflichtsprung misst sie, **wie viele Frames Absprungfenster** bleiben (Welt 1 ≥ 10 F, später ≥ 5 F). Dazu: keine Softlocks (von jeder erreichbaren Stelle geht es zum Ziel oder man kann sterben), jeder goldene Samen ist erreichbar, und die Landestelle ist beim Absprung schon bei 16 Kacheln Sichtbreite zu sehen |
| `bots` | Ein Bot mit menschlichen Grenzen (Reaktionszeit 150/250/400 ms, Zittern im Timing von σ ≈ 2 F) spielt jedes Level viele Male. Heraus kommen Todesrate, Todesursache und die Schwierigkeitskurve. Die Levelreihenfolge richtet sich nach der **gemessenen** Schwierigkeit (wie der Par in `nine_holes`) |
| `input` | Touch-Modell gegen Tastatur bei gleicher Reaktionszeit: gleiche Todesrate |
| `replay` | Eingabe-Log abspielen ergibt den identischen Zustands-Hash; alte Speicherstände laden |

Zwei Regeln aus `IDEAS.md` gehören direkt dazu:

- **Einen Validator muss man etwas ablehnen sehen, bevor man ihm glaubt** (aus `blind_crest`). Ein
  Testlevel mit einer Lücke von 11 Kacheln und einer Softlock-Grube muss durchfallen.
- **Bots messen, ob gutes Spiel belohnt wird, nie, ob schlechtes bestraft wird** (aus *Toast*).
  Deshalb wird jede Welt auch von Hand gespielt.

---

## 9. Meilensteine

Jeder Meilenstein endet mit etwas, das der Nutzer auf dem Handy spielen kann, und mit einem Urteil
von ihm.

| # | Inhalt | Prüfstein |
|---|---|---|
| **M1 Graubox** (gebaut, siehe 13) | Core-Physik, Kollision und Kamera. Ein Testlevel aus grauen Blöcken mit Lücken, Treppen, Decken und einem Block-Parcours. Tastatur, Gamepad, Touch (beide Layouts), Debug-Ansicht, `physics`- und `collision`-Suite | **Der Nutzer spielt und beurteilt das Gefühl.** Erst wenn das sitzt, geht es weiter. |
| **M2 Werkzeuge** (gebaut, siehe 14) | Levelformat, Validator samt Nachweis, dass er ablehnt, Bots; Käfer und Schnecke mit Haus, Blöcke, Erdbeere; 1-1 als Graubox | Validator und Bots laufen; 1-1 ist in Graubox spielbar |
| **M3 Vertikalschnitt** | Stil: Rig der Maus, Kacheln der Welt 1, Parallaxe, HUD, Soundeffekte, Thema der Welt 1. 1-1 fertig gestaltet | **Urteil des Nutzers über den Look.** Kontaktbogen und Screenshots |
| **M4 Welt 1** | 1-2 bis 1-4, Titelbild, Weltkarte, Speichern, goldene Samen | Welt 1 von vorn bis hinten spielbar |
| **M5 Welten 2–4** | je Welt: ihre Mechanik, 2–3 Gegner, Musik, Elster-Kampf | Nach jeder Welt spielt der Nutzer |
| **M6 Politur** | Zeitfahren mit Geist, Medaillen, Optionen und Tastenbelegung, Hilfsmodus falls die Bots einen rechtfertigen, Leistung auf dem Handy | |
| **M7 Veröffentlichung** | Die fünf Katalog-Schritte aus `CLAUDE.md` (Seite, `games.json`, `sidebar.html`, `sitemap.xml`, Screenshot). Test-Suite in `package.json` und `CLAUDE.md`. `IDEAS.md`: Lücke als gefüllt markieren und die Erkenntnisse eintragen | |

Bis M7 lebt die Seite unter `playground/`. In den Katalog kommt sie erst, wenn sie fertig ist.

---

## 10. Risiken

| Risiko | Wie es früh sichtbar wird |
|---|---|
| Touch fühlt sich schlecht an | eigener Prüfstein in M1 und die Suite `input` |
| Die vom Modell gezeichnete Grafik wirkt billig | Vertikalschnitt in M3 **vor** dem restlichen Content; Kontaktbögen |
| Levels sind handwerklich korrekt, aber langweilig | „Eine Idee pro Level“ wird vor dem Bauen geschrieben; der Nutzer spielt jede Welt; kein Bot beurteilt das |
| Schwierigkeit springt statt zu steigen | Bot-Kurve und Reihenfolge nach Messung |
| Leistung auf alten Handys | gebackene Ebenen, Phasen-Profil, Messung durch den Nutzer auf dem Gerät |
| Umfang wächst davon | feste Meilensteine; Schnittlinie „v1 = Welten 1–3“ |
| Nintendo-Rechte | eigene Figuren, Namen, Grafik und Musik. Die Physik-**Zahlen** übernehmen wir als Messwerte, so wie Worms die WA-Konstanten übernommen hat; Code, Grafik und Musik kopieren wir nicht. Die Beschreibung darf „in the tradition of Super Mario Bros.“ sagen, der Titel nicht |

---

## 11. Offene Entscheidungen für den Nutzer

Bis zur Antwort gilt jeweils die **fett** markierte Empfehlung.

1. **Setting:** **A) Garten aus Mäuseperspektive („Underfoot“)**, B) Spielzeugkiste, C) klassisches
   Fantasy-Reich oder ein eigener Vorschlag.
2. **Grafikstil:** **prozedurale Vektor-Diorama-Optik** oder Pixel-Art im NES/SNES-Stil.
3. **Leben:** **modern (keine Game Overs, Kontrollpunkte, Uhr nur für Medaillen)** oder klassisch
   (Leben, Zeitlimit, Punkte).
4. **Umfang v1:** **4 Welten × 4 Levels** oder zuerst 3 Welten, die vierte später.
5. **Zwei Spieler:** **nicht in v1**, später vielleicht das Geister-Duell.

---

## 12. Quellen

- Physiktabellen: `MitchellSternke/SuperMarioBros-C` (C-Portierung der SMB1-Disassemblierung),
  `source/SMB/SMBData.cpp` (`JumpMForceData`, `FallMForceData`, `PlayerYSpdData`,
  `InitMForceData`, `MaxLeftXSpdData`, `MaxRightXSpdData`, `FrictionData`) und `source/SMB/SMB.cpp`
  (`ProcJumping`, `X_Physics`, `ImposeFriction`, `JumpSwimSub`, `ImposeGravity`).
- `IDEAS.md`: „Read this first“, „Axes, not categories“, die Abschnitte zu `blind_crest`, `worms`,
  `nine_holes`, `scatter`, `jigsaw` und *Toast*.
- `playground/gluehwuermchen_HANDOFF.md`: was dem Nutzer bei früheren Spielen wichtig war.

---

## 13. Stand: M1, die Graubox (2026-09-27)

### Was es gibt

- **`playground/underfoot.html`** (rund 80 KB, eine Datei, keine Assets). Öffnen über einen lokalen
  Server (`npx http-server -p 8099`, dann `/playground/underfoot.html`) oder nach dem Merge unter
  gptgames.dev/playground/underfoot.html. URL-Parameter: `?debug` (Debug-Ansicht), `?big` (groß
  starten), `?pure` (Fairness-Schicht aus), `?menu` (mit offenem Menü starten).
- Drei Skriptblöcke wie in 8.1 geplant: `core` (ohne DOM), `levels` (der Testparcours als ASCII),
  und die Darstellung.
- **Der Testparcours** ist rund 320 Kacheln lang, mit beschrifteten Stationen: Anlauf und Schlittern,
  Stufen, Lücken 2/3/4 (gehend) und 5/6/7 (rennend), Kontrollpunkt, Blöcke, Decke mit Löchern von
  1/1/2 Kacheln (für die Eckenkorrektur), Tunnel, ein Turm aus Plattformen mit Sprung nach unten
  (Kamera), Wände von 4 Kacheln (aus dem Stand) und 5 Kacheln (nur mit Anlauf), Röhren 2/3/4,
  Säulen über einer Grube, Treppe und Fahne. Der Generator dafür lag in dieser Sitzung im
  Scratchpad. Neue Levels schreibt man ohnehin direkt als ASCII.
- **Steuerung:** Tastatur, Gamepad (Standard-Mapping) und Touch in beiden Layouts. Hochformat:
  Bedienfeld unter dem Bild. Querformat: halbtransparente Zonen über dem Bild. Der Stick sitzt dort,
  wo der Daumen aufsetzt: Gehen ab 9 px Weg, Rennen ab 44 px (zurück ab 36 px), und bei mehr als
  70 px Überschuss wandert die Mitte mit.
- **Menü:** die drei Schalter der Fairness-Schicht (einzeln oder alle auf einmal: „wie 1985“),
  klein/groß, Debug-Ansicht, Zeitlupe (¼), „immer rennen“, Ton, Vibration. Die Einstellungen
  bleiben im Browser gespeichert (`localStorage`, Schlüssel `underfoot_m1`).
- **Debug-Ansicht:** Hitbox; Tempo in px/F und Kacheln/s; welche Sprungzeile und welche Schwerkraft
  gerade gilt; Höhe und Weite des letzten Sprungs; die Sprungbahn für voll gehaltenen und für kurz
  getippten Sprung (blau und orange) samt Landestelle; Kachelnummern; und kurze Einblendungen, wenn
  die Fairness-Schicht eingegriffen hat („coyote +3f“, „buffer 4f“, „corner 2px“).
- **Platzhalter-Töne** (Web Audio, leise): Sprung, Block, Samen, Bröseln, Fahne. Die richtigen
  kommen mit M3.

### Tests: `node test/underfoot.mjs` (etwa 7 s, reines Node)

60 Prüfungen in vier Suiten, alle grün:

- `physics`: Die Konstanten der Seite sind die ROM-Bytes. Sprünge, Anlauf, Schlittern, Loslassen und
  die Höhe je Haltedauer stimmen **exakt** mit einem Referenzmodell überein, das getrennt von der
  Seite direkt aus den Bytes gerechnet wird. Außerdem: kein Luftwiderstand ohne Eingabe, ein
  gehender Sprung erreicht in der Luft kein Renntempo, die Fallgrenze liegt bei 4,5 px/F, und ein
  Kopfstoß setzt 1 px/F nach unten.
- `assists`: Coyote Time erlaubt genau 6 Frames, der Sprungpuffer genau 6 Frames, und die
  Eckenkorrektur verschiebt bei 1–4 px und lässt 5–6 px stoßen, auf beiden Seiten. Ausgeschaltet
  ist jeweils kein Frame und kein Pixel Nachsicht übrig. Wer den Sprungknopf durch eine Landung
  hält, springt nicht erneut.
- `collision`: kein Tunneln, bündiger Stopp an Wänden, Plattformen von unten durchspringbar und von
  der Seite durchlaufbar, groß passt durch den Tunnel, Wachsen unter niedriger Decke wird
  verweigert. Dazu 100.000 Zufallsframes über den ganzen Parcours, klein und groß, ohne dass die
  Figur je in einem Block steckt, und Determinismus: 20.000 Eingaben ergeben zweimal denselben
  Zustand.
- `course`: Der Parcours ist gültig. Die Kamera hält die Figur bei 16, 20 und 26 Kacheln
  Sichtbreite immer im Bild. Und **ein Bot springt vom Start bis zur Fahne, klein und ohne
  Fairness-Schicht.** Jeder seiner Sprünge hat mindestens 6 Frames Absprungfenster; die engsten
  sind die Blöcke (6 F), die Deckenlöcher (7 F), die Stufen (10 F) und die Säulen (11 F).

Die Suite wurde geprüft, indem Fehler in die Seite eingebaut wurden. Eine verstellte Beschleunigung,
Coyote Time 5 statt 6, Eckenkorrektur 5 statt 4 px, ein vertauschter Schwerkraftwechsel und eine
Eckenkorrektur, die die Figur nicht wirklich verschiebt: Jeder dieser Fehler lässt mindestens eine
Prüfung durchfallen.

Im Browser (Playwright/Chromium) geprüft: keine Konsolenfehler, Tastatur, simuliertes Gamepad und
echte Touch-Ereignisse (Gehen 1,5, Rennen 2,5 px/F, Springen mit dem zweiten Daumen, Menüknopf),
Zeitlupe mit genau 15 Simulationsschritten pro Sekunde, Erdklumpen zerbröseln nur groß, und die
Fahne führt zur Auswertung und zum Neustart.

### Was M1 gelehrt hat (Kandidaten für `IDEAS.md`, wenn das Spiel erscheint)

- **Rechne in der Einheit des Originals, dann sind seine Zahlen exakt.** Bei 1/4096 px ist jeder Wert
  der SMB-Tabellen eine ganze Zahl. Die Seite lässt sich dann auf den Frame genau gegen ein
  unabhängig geschriebenes Modell prüfen. Nachgiebige Toleranzen hätten zum Beispiel übersehen,
  dass das ROM den Kopfstoß *nach* der Schwerkraft setzt. Die erste Fassung addierte im selben
  Frame noch einmal Schwerkraft (1,44 statt 1 px/F).
- **Ein Sprungfenster, gemessen an der weitesten Landung, misst die Gier des Bots.** Die erste
  Messung zählte, wie viele Absprung-Frames genau dort landen, wo der weiteste Sprung landet. Das
  ergab überall 1 bis 3 Frames, weil der weiteste Sprung per Definition am Rand liegt. Richtig ist:
  Absprünge zählen, die auf *derselben Plattform* landen, und den Bot wie einen vorsichtigen
  Menschen die weiteste Plattform wählen lassen, die mit 6 Frames Reserve erreichbar ist. Danach
  lag kein Sprung mehr unter 6 Frames.
- **Die Kamera muss beim Fallen vorauseilen.** Die Regel „nie den Bildrand verlassen“ hielt die Figur
  beim Fallen genau am unteren Rand, wo sie nichts unter sich sieht. Mit der vorauseilenden Kamera
  kommt der Boden bei einem Sprung von 12 Kacheln nach der Hälfte des Falls ins Bild.
- **Ein Zufallstest, der stirbt, testet nur den Anfang.** Er kam nie über Kachel 90 hinaus, weil der
  zufällige Spieler in jede Lücke fiel. Setzt man ihn regelmäßig an zufälliger Stelle neu ab,
  deckt er den ganzen Parcours ab.

### Worauf der Nutzer beim Spielen achten soll

1. **Handy, Hochformat:** Reicht der Stick? Ist die Rennschwelle (44 px) zu nah oder zu weit? Fühlt
   sich der Sprung mit dem rechten Daumen direkt an?
2. **Handy, Querformat:** Stören die Zonen über dem Bild?
3. **Einmal mit „wie 1985“ und einmal mit allem an:** Merkt man den Unterschied, und fühlt sich
   die moderne Fassung fair an, ohne weich zu wirken?
4. **Wände 4 und 5, Lücke 7, Deckenlöcher:** Sind sie fordernd, aber fair?
5. **Kamera:** Sieht man beim Rennen genug nach vorn? Ist beim Sprung vom Turm etwas unangenehm?

### Als Nächstes: M2

Levelformat mit Figuren, der richtige Validator (A* über Makro-Eingaben, klein und groß,
Softlock-Suche, Sichtbarkeit der Landestelle bei 16 Kacheln), der Bot mit menschlicher
Reaktionszeit, Laufkäfer und Schnecke mit Haus, Erdbeere, und 1-1 als Graubox. Der
Jump-and-Measure-Bot aus `course` ist der Anfang des Validators.

---

## 14. Stand: M2, Figuren, Validator und Level 1-1 (2026-09-27)

### Was dazugekommen ist

- **Reaktionsschnelle Bewegung als Standard** (siehe 3.3), nach der Rückmeldung zu M1. Im Menü
  unter „Movement“ lässt sich auf „1985 momentum“ zurückschalten; die Sprünge sind in beiden
  Profilen die des ROMs.
- **Figuren im Kern:** Laufkäfer (0,5 px/F, wie der Gumba), Schnecke und rote Schnecke. Gestampft
  bleibt ein Haus liegen; ein Kick oder ein Sprung darauf schickt es mit 3 px/F los, schneller als
  man rennt. Es prallt an Wänden ab, räumt Gegner in Serie ab und trifft einen auf dem Rückweg
  selbst. Nach 7 Sekunden kommt die Schnecke wieder heraus. Dazu die Erdbeere aus dem `*`-Block:
  Sie klettert heraus, rollt nach rechts, prallt ab und macht groß; groß gibt der Block einen
  Samen. Wer einen Block von unten anstößt, schlägt Gegner darauf aus dem Spiel und lässt eine
  Erdbeere hüpfen.
- **Treffer und Tod:** Ein Treffer macht aus groß klein und gibt 2 s Blinken; klein ist er tödlich,
  mit einem kurzen Hüpfer aus dem Bild. Man startet am letzten Kontrollpunkt neu, klein, und das
  Level steht wieder so da wie beim Erreichen des Kontrollpunkts: Blöcke, Samen, Gegner.
- **Stampfen ist großzügig:** Es zählt, wenn man fällt und die Füße im Frame davor über der Mitte
  des Gegners waren. Wer den Sprungknopf hält, federt einen vollen Sprung hoch, sonst einen
  kleinen Hüpfer. Figuren wachen erst auf, wenn man 16 Kacheln nah ist, egal wie breit der
  Bildschirm ist. So spielt sich das Spiel auf jedem Gerät gleich.
- **Level 1-1 „Morning Dew“** (212 Kacheln, 15 hoch): Nach dem ersten Block kommt der Blockcluster
  mit Erdbeere, unter dem der erste Käfer ankommt. Die Erdbeere prallt an der ersten Rinne ab und
  kommt zurück. Rinnen 2/3/4/3 mit Käfern im Tal, drei Gruben, ein Regal aus Erdklumpen mit Samen,
  der Kontrollpunkt, eine Schnecke vor zwei Käfern (zum Kicken), eine rote Schnecke auf einem
  Sims, zwei Stufenpyramiden (die zweite mit Lücke) und die große Treppe zur Fahne. Drei goldene
  Samen: auf dem obersten Block, hoch über der zweiten Grube (nur mit Anlauf) und hoch über der
  Lücke zwischen den Pyramiden. Der Generator lag in dieser Sitzung im Scratchpad; das Level steht
  als ASCII in der Seite.
- **Darstellung:** Käfer, Schnecke, Haus (dreht sich beim Schlittern, wackelt vor dem Aufwachen),
  Erdbeere und goldener Same sind gezeichnet, dazu ein Morgenhimmel mit Hügeln und Wolken in drei
  Parallaxe-Ebenen, Erde mit Grasnarbe und Einblendungen für Serien („×2“) und goldene Samen. Das
  HUD zeigt die goldenen Samen. Im Menü gibt es jetzt die Levelauswahl. Der Rest der Grafik ist M3.
- **Kamera:** Die Füße sitzen jetzt bei 60 % statt 80 % der Bildhöhe, man sieht also 6 Kacheln nach
  unten. Der Validator hatte gezeigt, dass man vorher von einer 5er-Wand den eigenen Landeplatz
  nicht sah.

### Der Validator (`node test/underfoot.mjs levels`)

`node test/underfoot.mjs` hat jetzt 138 Prüfungen in fünf Suiten und läuft etwa 30 s: `physics`
(beide Profile), `assists`, `collision`, `creatures` (Käfer, Schnecken, Häuser, Erdbeere, Stampfen,
Treffer, Neustart; per Mutationstest geprüft, dass sie Fehler finden) und `levels`.

- **Der vorsichtige Bot** spielt jedes Level klein und ohne Fairness-Schicht. Er nimmt die weiteste
  Plattform, die mit mindestens 8 Frames Spielraum erreichbar ist (6 im Testparcours), springt aus
  der Mitte dieses Fensters und nie auf einen Fleck, von dem kein Weg weiterführt. Gemessen wird
  jedes Sprungfenster, und zwar vom hinteren Ende der Plattform aus, wie ein Mensch mit Anlauf.
  Außerdem wird geprüft, dass die Landestelle beim Absprung auf einem 16 Kacheln breiten
  Bildschirm zu sehen ist.
- **Der Erreichbarkeitsgraph** lässt die Figuren weg. Von jedem erreichbaren Stück Boden aus
  probiert er Züge in beide Richtungen und prüft, dass man überall entweder zum Ziel kommt oder
  wenigstens in eine Grube fallen und neu anfangen kann. Außerdem, dass jeder goldene Same
  erreichbar ist.
- **Beide Werkzeuge müssen erst ablehnen:** eine Lücke von 11 Kacheln und eine ummauerte Grube, in
  die man fallen, aus der man aber nie heraus kann. Beide werden abgewiesen.
- **Ergebnis für 1-1:** Der Bot kommt ohne Tod ins Ziel. Jeder Pflichtsprung hat mindestens
  10 Frames Spielraum, jede Landestelle ist im Bild, es gibt keine Sackgasse, und alle drei
  goldenen Samen sind erreichbar.

**Was der Validator am Level geändert hat:** Das Tal zwischen zwei 4er-Rinnen mit zwei Käfern ließ
nur 3 Frames Spielraum. Jetzt ist es breiter, die zweite Rinne 3 hoch, und die Käfer stehen weiter
auseinander. Die Landefläche nach der Pyramidenlücke war nur eine Kachel breit, jetzt sind es
zwei. Drei Käfer im Gleichschritt direkt nach der Schnecke waren die Stelle, an der der Bot mit
ungenauer Hand fast alle Tode und Hänger hatte; jetzt sind es zwei mit Abstand.

### Die ungenaue Hand (`node test/underfoot.mjs hands`, langsam, etwa 3 Minuten)

Derselbe Plan, aber jeder Absprung und jedes Loslassen landet zufällig um ±1, ±2 oder ±3 Frames
daneben (Normalverteilung). Der Bot spielt nach einem Tod vom Kontrollpunkt aus weiter. Je 6 Läufe:

| Streuung | Fairness aus: Tode in 6 Läufen | Fairness an: Tode in 6 Läufen | ins Ziel |
|---|---|---|---|
| ±1 Frame | 0 | 1 | immer |
| ±2 Frames | 1 | 2 | immer |
| ±3 Frames | 4 | 2 | immer |

Die Tode liegen an der zweiten Grube unter dem Erdklumpen-Regal (Kachel 88), bei den Käfern nach
der Schnecke (118) und am Sims mit der roten Schnecke (126). Die Fairness-Schicht macht in *diesem*
Modell keinen messbaren Unterschied, und das liegt am Modell. Der Bot irrt symmetrisch um die Mitte
eines Fensters. Menschen irren typisch in eine Richtung, zu spät von der Kante oder zu früh vor der
Landung, und genau das fangen Coyote Time und Sprungpuffer auf. Ein Bot mit dieser Schieflage wäre
die nächste Verfeinerung.

Das ist eine Messung der *Ausführung*, nicht der Reaktion. Wie schnell ein Mensch auf einen Käfer
reagiert, misst sie nicht, denn der Bot plant mit vollem Wissen. Er kickt außerdem nie absichtlich
ein Haus. Beides gehört zu dem, was erst der Nutzer beim Spielen beurteilen kann.

### Lehren aus M2

- **Ein Bot, der nur vorwärts kann, bleibt dort hängen, wo ein Mensch kurz wartet.** Vor dem
  Käferpulk fand er keinen sicheren Vorwärtszug. Erst Ausweichzüge (warten, auf der Stelle hüpfen,
  zurückweichen) machten die Messung brauchbar. Sie zählen nicht als Sprünge des Levels.
- **Das Sprungfenster gehört dem Level, nicht der Stelle, an der der Bot zufällig steht.** Direkt an
  der Kante gemessen, schrumpfte ein bequemer Pyramidensprung auf 6 Frames. Vom Anfang der Plattform
  aus gemessen sind es 10 oder mehr.
- **Kamerarahmen und Leveldesign sind dieselbe Frage.** Die Regel „Landestelle beim Absprung im
  Bild“ hat einen Kamerafehler gefunden und keinen Levelfehler.

---

## 15. Neuausrichtung: vier Konzepte, zwei Prototypen (2026-09-27)

### Was der Nutzer nach M2 gesagt hat

„Okay, fühlt sich gut an. Aber wir brauchen glaube ich ein anderes Konzept abseits von ‚SMB1 mit
neuem Anstrich‘. Da fehlt absolut der Bedarf für. Etwas mehr Alleinstellungsmerkmale oder eine
speziellere Identität wären gut. Oder wir orientieren uns grundsätzlich eher an moderneren
Jump'n'Runs.“

Die Steuerung aus M2 (reaktionsschnelles Profil, SMB-Sprünge, Fairness-Schicht) bleibt also.
Gesucht ist, *wofür* man sie benutzt.

### Die vier Konzepte

| | Konzept | Kern | Prototyp |
|---|---|---|---|
| **A** | Vier Jahreszeiten | ein zusammenhängender Garten statt einer Levelreihe; die Jahreszeit verwandelt dieselbe Karte | ein kleines Gebiet in mehreren Jahreszeiten |
| B | Tandem, zwei Mäuse am Faden | je ein Daumen pro Maus, allein oder zu zweit | Faden-Physik und Zwei-Daumen-Steuerung |
| **C** | Tempo | kurze Level mit Schwung, am Ende die Flucht zurück gegen die Uhr | ein Level mit Rückweg |
| D | Zurückspulen statt sterben | Fehler zurückspulen, Rätsel mit Dingen außerhalb der Zeit | drei kleine Zeiträtsel |

**Gewählt: A und C**, als kleine spielbare Prototypen zum Vergleich am Handy. B und D sind nicht
verworfen, nur nicht gebaut.

Beide Prototypen sind eigene Seiten unter `playground/`. Sie kopieren den M2-Kern und ändern ihn
dort, wo das Konzept es verlangt. `underfoot.html` bleibt der M2-Stand. Welche Seite weiterlebt,
entscheidet der Nutzer. Den Kern danach wieder zusammenzuführen ist Arbeit für die Zeit nach der
Wahl.

### Prototyp A: `playground/underfoot_seasons.html`

- **Ein Garten, 110 × 44 Kacheln:** Rasen, Teich, Schuppen, Zaun und Apfelbaum, oben im Baum das
  Nest als Ziel. An einem **Baumstumpf** wechselt man mit ↑ die Jahreszeit. Dieselbe Karte ändert
  sich dann:
  - im **Sommer** wächst Laub als Stufen am Baum hoch;
  - im **Herbst** treiben Blätter als Flöße auf dem Teich, und neben dem Schuppen steigt Wind auf;
  - im **Winter** friert der Teich zu, und Schnee weht gegen den Baum.
- **Jahreszeiten muss man erst finden:** Das Herbstblatt liegt im Sommer erreichbar, der
  Winterkristall erst im Herbst.
- **Schwimmen** nutzt die Schwimmzeilen von SMB, mit einem festen Sprung über zwei Kacheln an der
  Oberfläche.
- **Präsentation:** eine Palette und ein Wetter je Jahreszeit; ein kreisförmiger Übergang vom
  Stumpf aus; eine Karte mit dem, was man gesehen hat (M, Knopf oder Select).
- **Test:** `node test/underfoot_seasons.mjs`, 41 Prüfungen, etwa 11 s. Ein Erreichbarkeitsgraph
  über (Jahreszeit, Bodenstück) spielt mit der echten Physik, wechselt nur an Stümpfen und nur mit
  gefundenem Token. Ergebnis:
  - Sommer erreicht 60 % des Bodens, mit Herbst 71 %, mit Winter 100 %;
  - das Nest nur mit Winter;
  - keine Sackgasse;
  - alle drei goldenen Samen erreichbar.

  Der Graph hat unterwegs drei Löcher in der Karte gefunden, alle behoben.

### Prototyp C: `playground/underfoot_tempo.html`

**Ein Level, hin und zurück.** Man läuft vom Mauseloch den Gartenweg entlang und über eine Bank
zum Samensack am anderen Ende. Der Sack liegt auf einem losen Brett. Nimmt man ihn, gibt das Brett
nach, man fällt auf den Weg unter der Bank, und die **Flucht** beginnt: 30 Sekunden Uhr zurück zum
Mauseloch. Der Rückweg führt durch das, was auf dem Hinweg verschlossen war. Die Bretter unter der
Bank (`n`) fallen weg, dafür liegen Kisten (`e`) als Hürden auf dem Weg, die man vorher nur als
gestrichelten Umriss sah. Der Himmel wird abendrot, ein Herzschlag beschleunigt sich, und in den
letzten zehn Sekunden pulsiert der Rand.

**Schwung in Stufen** (`TIERS`: 2,5 / 3,25 / 4 px/f):
- **Aufbau:** Wer ohne Halt voll läuft, wird nach 0,90 s schneller („dash“) und nach 1,73 s noch
  einmal („blaze“). Nachbilder und Tempo-Anzeige färben sich orange, dann rot.
- **Wirkung ab der ersten Stufe:** Erdklumpen zerplatzen, Käfer werden umgeworfen (das zählt für
  die Kombo).
- **Was die Stufe nimmt:**
  - loslassen, umdrehen oder den Rennknopf loslassen;
  - in der Luft umkehren;
  - ein Treffer;
  - ein Crash: Wer ab der ersten Stufe auf den Füßen gegen eine Wand rennt, wird zurückgeworfen und
    ist kurz benommen.
- **Was die Stufe hält:** ein Sprung (die Luftgeschwindigkeit bleibt) und ein Rutschen. Eine Wand
  in der Luft ist kein Crash, man rutscht an ihr herunter und kann mit der Stufe abspringen.
- **Kein Tempo geschenkt:** Tempo ohne Stufe (aus einem Rutschen oder Crash) lässt sich nicht durch
  Hüpfen halten. Die Luftgeschwindigkeit ist auf die Stufe begrenzt. Das hat der Such-Bot als
  Lücke gefunden.

**Wandsprung, Rutschen, Kriechen:**
- **Wand:** Man rutscht höchstens 1,5 px/f schnell herunter. Sprung beim Berühren (bis 6 Frames
  vorher gedrückt) stößt mit Lauftempo oder Stufentempo ab. 10 Frames lang zieht der Stick einen
  nicht zurück. Ein 4 Kacheln breiter Schacht lässt sich im Zickzack hochklettern.
- **Rutschen:** ↓ im Lauf, einmal tippen reicht. Es läuft 40 Frames mit dem Anfangstempo und endet
  nicht, solange über einem kein Platz zum Aufstehen ist. So kommt man durch jeden Tunnel von einer
  Kachel Höhe. Ein Sprung beendet es. Geduckt mit Richtung kriecht man.

**Keine Tode.**
- Ein Käfer wirft einen zurück und kostet Stufe und Kombo.
- Eine Grube setzt einen auf den letzten Boden zurück; auf dem Rückweg kostet das 3 s.
- Läuft die Uhr ab, beginnt die Flucht neu am Sack, mit dem Level so, wie es beim Nehmen war.

**Ränge und Geist.**
- Ränge nach Gesamtzeit: S bis 30 s, A bis 38 s, B bis 55 s, sonst C.
- Der eigene Bestlauf wird als Eingabefolge gespeichert und läuft als Geist mit. Er ist framegenau,
  weil der Kern deterministisch ist, und wird verworfen, sobald sich Kern oder Level ändern.
- Wahlweise läuft stattdessen die schnellste Linie des Such-Bots mit, um zu zeigen, was geht.

**Steuerung:** „Immer rennen“ ist hier voreingestellt. Am Handy: Daumen links in die Richtung
schieben, nach unten ziehen zum Rutschen; rechts springen.

**Test:** `node test/underfoot_tempo.mjs`, 62 Prüfungen, etwa 55 s.
- `moves`: Stufen, was sie nimmt und hält, Wandrutschen und Wandsprung samt Puffer und Sperre,
  Schachtklettern, Rutschen durch 30 Kacheln Tunnel, Kriechen, Klumpen, Crash, Käfer, Gruben.
- `escape`: Sack, Bretter und Kisten, Falltür, Uhr, Neustart mit wiederhergestelltem Level,
  Kosten einer Grube, Mauseloch.
- `route`: zwei Strahlsuch-Bots auf dem echten Level:

| Bot | gesamt | hin | zurück |
|---|---|---|---|
| schnellste Linie | 24,85 s | 13,15 s | 11,70 s |
| nie schneller als Laufen (Stufen abgeschaltet) | 37,08 s | 18,80 s | 18,28 s |

Daraus folgen die Ränge und die Uhr:
- S (30 s) braucht die Stufen.
- A (38 s) ist ein fehlerfreier Lauf ohne sie.
- Auch ohne Stufen bleiben auf dem Rückweg fast 12 s der Uhr für Fehler.
- Die schnellste Linie nutzt jeden Zug: Stufen, Wandsprung, Rutschen, Klumpen, Käfer.

`--record` gibt nach einer Änderung an Kern oder Level eine neue Linie für den Geist aus. Der Test
prüft, dass die gespeicherte Linie noch framegenau ins Ziel kommt. Mutationsproben (neun
absichtlich eingebaute Regelfehler) werden alle erkannt.

### Was die Prototypen *nicht* beantworten

- **Die Uhr ist aus Bots abgeleitet, nicht aus Menschen.** Ob 30 Sekunden Flucht beim ersten Mal
  spannend oder frustrierend sind, zeigt erst das Spielen. Das ist die wichtigste Frage an den
  Nutzer.
- **Grafik:** Beide sind über der M2-Graubox, aber noch kein M3.
- **Umfang:** A ist eine Karte, C ist ein Level. Wie viele Level oder Gebiete ein ganzes Spiel
  trüge, ist offen.

### Worauf der Nutzer beim Vergleich achten soll

- **A:** Macht es Spaß, dieselbe Stelle in einer anderen Jahreszeit wiederzuerkennen? Ist das
  Suchen der Jahreszeiten ein Ziel oder ein Umweg?
- **C:** Fühlt sich der Schwung verdient an? Tut der Verlust einer Stufe weh, aber nicht zu sehr?
  Reicht die Uhr? Will man nach dem Rang noch einmal laufen?
- **Beide:** Welche Welt will man auf dem Handy länger als fünf Minuten spielen?

---

## 16. Entscheidung: Tempo (2026-09-27)

„Also Seasons ist mega kreativ, aber vom Gameplay gefällt mir Tempo besser. Ich glaub auf Tempo
lässt sich auf lange Sicht besser aufbauen.“

### 16.1 Was aus den Jahreszeiten wird

Der Prototyp bleibt unter `playground/` liegen, samt Test. Verworfen ist er nicht, nur als
*Struktur* (eine offene Karte, die sich verwandelt). Seine Einfälle passen gut als **Welten** in
Tempo. Jede Jahreszeit bringt eine Eigenheit mit, die das Tempo verändert:
- **Frühling:** der Gartenweg von heute.
- **Sommer:** der Teich, mit Wasser, das bremst, und Seerosen als Trittsteinen.
- **Herbst:** Wind, der einen im Lauf nach oben trägt, und Laubhaufen, die etwas verstecken.
- **Winter:** Eis, auf dem der Schwung nicht abreißt, aber auch nicht bremst.

So bleibt das Kreative, und das Spielgefühl, das der Nutzer mag, bleibt der Kern.

### 16.2 Vorschlag für den Weg zum fertigen Spiel

| Stufe | Inhalt | Beantwortet |
|---|---|---|
| **T1** | Feinschliff nach dem Feedback des Nutzers; toten SMB-Code aus dem Tempo-Kern entfernen (Fahne, Erdbeere, klein/groß); dazu zwei weitere kurze Level mit je einer **anderen Flucht** (z. B. der Weg bricht hinter einem weg, Wasser steigt, das Licht geht aus) und eine Levelauswahl mit Rang je Level | Trägt die Schleife „hin, nehmen, fliehen“ über mehrere Level, oder nutzt sie sich ab? |
| T2 | eine Welt von vier bis fünf Leveln, am Ende eine Verfolgung (die Katze?) statt einer Uhr | Ist das genug Abwechslung für eine ganze Welt? |
| T3 | Grafik (das alte M3) und Ton: Figuren, Kacheln, Hintergründe, Musik für die Flucht | Sieht es aus wie ein Spiel aus einem Guss? |
| T4 | weitere Welten nach 16.1, jede mit ihrer Eigenheit | Wie groß wird das Spiel? |
| T5 | Veröffentlichung unter `games/`, mit Katalogeintrag, Bildschirmfoto, Sitemap | – |

Die Empfehlung ist T1 zuerst. Die größte offene Frage ist, ob die Flucht auch beim dritten Mal
noch überrascht. Das lässt sich mit drei grauen Leveln billiger klären als mit einem schönen.

### 16.3 Was vom Nutzer noch fehlt

- **Die Uhr:** Waren 30 Sekunden Flucht beim ersten Versuch spannend, zu knapp oder zu locker?
- **Die Stufen:** Stimmt das Tempo, in dem sie kommen (0,9 s und 1,7 s)? Tut ein Verlust weh,
  aber nicht zu sehr?
- **Was gestört hat:** Steuerung am Handy, Crash, Rutschen, Wandsprung, Lesbarkeit bei hohem
  Tempo.

---

## 17. Stand: T1, drei Fluchten (2026-09-27)

### Was der Nutzer zu Tempo gesagt hat

- Die 30 Sekunden Uhr seien ihm „gar nicht so bewusst aufgefallen“.
- Das Tempo der Stufen passe, und es sei „punishing genug“.
- Frustrierend war nur, beim Rutschen unter den Blöcken das Tempo zu verlieren.

### Rutschen kostet nichts mehr

Ein Rutschen lief 40 Frames und hielt einen dann an, wenn unten noch gedrückt war, samt Verlust der
Stufe. Mit dem Daumen passiert genau das: Zieht man ihn etwas zu früh nach unten, kriecht man durch
den Tunnel; hält man ihn etwas zu lange, bleibt man direkt dahinter stehen.

Jetzt gilt:
- Ein Rutschen läuft mindestens 40 Frames.
- Es läuft weiter, solange unten gehalten wird oder über einem kein Platz zum Aufstehen ist.
- Man kommt mit dem Tempo und der Stufe heraus, mit denen man hineinging.

Zwei Prüfungen machen es so, wie ein Daumen es tut, und scheitern an der alten Regel.

### Der Kern, aufgeräumt

Aus dem Tempo-Kern ist alles SMB-Erbe entfernt, das Tempo nicht braucht:
- klassische Beschleunigung;
- Fahne und Mast;
- Erdbeeren und Fragezeichenblöcke;
- Röhren;
- klein und groß (die Maus ist immer zwei Kacheln hoch);
- Tod und Kontrollpunkte.

Eine **Flucht** ist jetzt Teil der Leveldefinition:

| Art | Parameter | Gefahr |
|---|---|---|
| `clock` | `time` | Uhr |
| `water` | `from`, `delay`, `speed`, `gap` | Wasser steigt von unten, nie mehr als `gap` Kacheln unter einem (sonst holt es dreimal so schnell auf) |
| `crumble` | `from`, `delay`, `speed`, `gap` | Das Ufer bricht hinter einem weg, Richtung Zuhause; Stein bleibt stehen |

- **Eingeholt oder zu spät:** Die Flucht beginnt neu am Gegenstand, mit dem Level, wie es beim
  Nehmen war.
- **`danger()`** sagt, wie nah die Gefahr ist: Sekunden auf der Uhr oder Kacheln bis zum Wasser oder
  zur Kante. Die Anzeige, der Herzschlag, die Vignette und das Beben hängen daran.
- **Kamera:** Die Vorausschau ist auf 30 % der Bildbreite begrenzt. Hochkant am Handy schob sie
  die Maus bei Höchsttempo sonst an den Bildrand.

### Die drei Level

| # | Level | Gegenstand | Flucht | Form |
|---|---|---|---|---|
| 1 | The seed sack | Samensack | Uhr, 30 s | waagerecht, 176 × 20; über die Bank hin, darunter zurück |
| 2 | The drain | Knopf | Wasser steigt (0,27 px/f, höchstens 7 Kacheln unter einem) | senkrecht, 40 × 58; fünf Gänge übereinander |
| 3 | The river bank | Erdbeere | Ufer bricht weg (2 px/f, höchstens 12 Kacheln hinter einem) | waagerecht, 168 × 20; über einen Kamm hin, darunter zurück |

**The drain:**
- **Aufbau:** Fünf Gänge, acht Reihen übereinander, an wechselnden Enden verbunden.
- **Hinweg:** Man fällt durch ein Loch am Ende eines Gangs in einen Schacht und rutscht unter einer
  hängenden Wand heraus in den nächsten Gang.
- **Rückweg:** Dieselben Schächte, andersherum. Man rutscht unter der Wand hinein und springt
  zwischen ihr und der Außenwand im Zickzack hoch.
- Unterwegs liegen Kisten als Hürden.

**The river bank:**
- **Hinweg:** Man rutscht unter einem Stamm durch und springt zwischen ihm und einem Baumstumpf
  auf einen Kamm.
- **Rückweg:** Man läuft unter dem Kamm zurück, wo auf dem Hinweg Bretter waren, und rutscht unter
  einem umgestürzten Stamm durch.

Jedes Level hat:
- einen goldenen Samen abseits der Linie;
- eigene Ränge;
- einen eigenen Bestlauf-Geist;
- eine eigene Bot-Linie.

### Die Seite

- **Levelauswahl im Menü:** Rang und Bestzeit je Level. Die Siegtafel bietet „Next level“ an.
- **Bestläufe:** Sie werden je Level mit einem Fingerabdruck aus Kern und Level gespeichert.
  Ändert sich eines davon, verfällt nur dieser Bestlauf.
- **Hintergründe:**
  - Garten;
  - Abfluss: Erde und alte Ziegel unter dem Rasen;
  - Ufer: der Fluss in den Lücken.
- **Wasser:** Eine steigende Wasseroberfläche mit Blasen.
- **Die bröckelnde Kante:** ein Vorhang aus fallender Erde; Brocken fallen aus jeder Spalte.
- **Anzeige oben in der Mitte:** Uhr, Kacheln über dem Wasser oder Kacheln vor der Kante.
- **Geräusche:** Rauschen beim Wassereinbruch, Blubbern, wenn es nah ist, Grollen des Ufers,
  ein heller Ton für den goldenen Samen.

### Messungen (`node test/underfoot_tempo.mjs route`, einige Minuten)

Je Level drei Strahlsuch-Bots:
- **schnellste Linie:** alle Züge erlaubt;
- **ohne Stufen:** nie schneller als Laufen;
- **ohne Stufen, mit Pausen:** Auf dem Rückweg ist jeder fünfte Zug erzwungenes Stehenbleiben.
  Weil jede Pause auch wieder anlaufen kostet, ist das eher 40 % als 20 % langsamer als
  fehlerfrei.

| Level | schnellste Linie | ohne Stufen | ohne Stufen, mit Pausen | Ränge S / A / B |
|---|---|---|---|---|
| Seed sack (Uhr 30 s) | 24,55 s (18,6 s Uhr übrig) | 37,28 s (11,5 s übrig) | 38,93 s (9,9 s übrig) | 30 / 38 / 55 |
| Drain (Wasser) | 33,98 s (nie näher als 3,3 Kacheln) | 47,67 s (2,5 Kacheln) | 49,30 s (1,9 Kacheln) | 41 / 48 / 70 |
| River bank (Ufer) | 23,52 s (7,5 Kacheln) | 33,52 s (7,4 Kacheln) | 34,52 s (2,9 Kacheln) | 29 / 34 / 50 |

Beim Ufer gilt: Wer fehlerfrei läuft (2,5 px/f), ist schneller als die Kante (2,4 px/f) und
verliert nie Boden. Wer stockt, verliert welchen. Mit 2,0 px/f kam selbst der Bot mit Pausen der
Kante nie näher als sieben Kacheln, die Kante war also nur Kulisse. Deshalb ist sie jetzt
schneller.

**Regeln für Ränge und Gefahr:**
- S liegt bei etwa dem 1,2-Fachen der schnellsten Linie.
- A ist die Zeit ohne Stufen, aufgerundet.
- B ist A mal 1,45.
- Die Gefahr ist so eingestellt, dass auch der Bot mit Pausen heimkommt. Das ist die
  Fairness-Messlatte: wer nie schneller als Laufen wird und öfter stockt, schafft es trotzdem.

Die gespeicherten Linien (die Geister auf der Seite) prüft die schnelle Suite `lines` bei jedem
Lauf: Kommt jede noch framegenau heim? Ist S damit erreichbar? Nutzt sie Stufen, Wandsprung,
Rutschen und Käfer?

### Tests: `node test/underfoot_tempo.mjs`, 91 Prüfungen, unter einer Sekunde

- **`moves`:** wie bisher, dazu das Rutschen, wie ein Daumen es tut.
- **`escape`:**
  - je Level: Gegenstand, Heimweg, drei Ränge, eine Linie;
  - Sack: Uhr, Falltür, Neustart, Kosten einer Grube;
  - Wasser: wartet, steigt, holt auf, holt einen ein, beginnt neu;
  - Ufer: bricht bis ganz unten weg, lässt Stein stehen, holt einen ein, steht wieder ganz da.
- **`lines`:** die gespeicherten Linien.
- **Mutationsproben:** Sieben absichtlich eingebaute Fehler an den Fluchten werden alle erkannt.

### Was T1 beantworten soll, und was der Nutzer beurteilen muss

Die Frage aus 16.2 war, ob „hin, nehmen, fliehen“ über mehrere Level trägt. Die drei Fluchten
spielen sich messbar verschieden:
- **Uhr:** eine Zahl, die drängt.
- **Wasser:** senkrecht, man muss klettern.
- **Ufer:** Man darf nie stehen bleiben.

Ob sie sich auch verschieden *anfühlen*, und welche am meisten Lust auf mehr macht, kann nur der
Nutzer sagen. Außerdem ist offen, ob die Kante hinter einem genug sichtbar ist. Hochkant liegt sie
oft außerhalb des Bildes; dann sagen nur Zahl, Beben und Grollen, wie nah sie ist.
