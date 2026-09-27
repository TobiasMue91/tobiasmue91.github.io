# Plan: ein Jump'n'Run à la Super Mario Bros.

Stand 2026-09-27. Dieses Dokument ist der Bauplan und zugleich die Übergabe: Eine spätere Sitzung
ohne Zugriff auf diese Unterhaltung soll damit weiterbauen können. Offene Entscheidungen stehen
gesammelt in **Abschnitt 11**. Bis sie getroffen sind, gelten die dort empfohlenen Antworten.

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
- **Der Kern ist die Steuerung.** Die Bewegung übernimmt die Physiktabellen von SMB1 **wörtlich**
  (aus dem disassemblierten Original gelesen, Abschnitt 3.1). Darauf kommt eine moderne
  Fairness-Schicht mit Coyote Time, Sprungpuffer und Eckenkorrektur. Beides wird gemessen, nicht
  geschätzt.
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
| Beschleunigung Gehen | `$98` | 0,0371 | 0 → Gehen in 41 Frames |
| Beschleunigung Rennen | `$E4` | 0,0557 | 0 → Rennen in 45 Frames, 3,6 Kacheln Anlauf |
| Abbremsen (Richtung losgelassen / aus dem Rennen) | `$D0` | 0,0508 | |
| Schlittern (Gegenrichtung) | doppelter Wert, z. B. `$1A0` | 0,1016 | Stopp aus vollem Lauf in 25 Frames |
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
| Stand | 1,45 | 1,94 | 2,52 | 3,01 | 3,41 | 3,95 | 4,12 |
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
| Kein Mondlauf, kein Wand-Zipping, keine anderen Glitches | | |

**Nicht** hinzukommen: Wandsprung, Doppelsprung, Dash. Das wäre ein anderes Spiel.

### 3.4 Takt, Determinismus, Eingabe-Latenz

- **Feste 60-Hz-Simulation mit Ganzzahl-Arithmetik** (Positionen in 1/256 px als Integer), damit
  jeder Durchlauf auf jedem Gerät identisch ist. Gerendert wird mit der Bildwiederholrate des
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
  groß: 12×28 px, geduckt: 12×14 px. Diese Werte werden in M1 festgezurrt.
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
    '.........?.....B?B?B.............||.........()....................',
    '.................................||.........||....................',
    '..@.............b................||....b....||.......b.s..........',
    '=================================================..=======....====',
    '#################################################..#######....####',
  ] }
// @ Start  = Grasnarbe  # Erde  ? Honigwabe  B Erdklumpen  () || Rinne
// b Laufkäfer  s Schnecke  o Samen  G goldener Samen  | Kontrollpunkt  F Ziel
```

### 8.3 Tests (`test/<id>.mjs`, reines Node)

| Suite | prüft |
|---|---|
| `physics` | Die Konstanten gegen die Tabelle in 3.1: Sprunghöhen 4,12 / 4,39 / 5,16 Kacheln, 41 und 45 Frames Anlauf, 25 Frames Schlittern, Fallgrenze. Legt das Gefühl fest wie der Coffin-Test bei Worms |
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
| **M1 Graubox** | Core-Physik, Kollision und Kamera. Ein Testlevel aus grauen Blöcken mit Lücken, Treppen, Decken und einem Block-Parcours. Tastatur, Gamepad, Touch (beide Layouts), Debug-Ansicht, `physics`- und `collision`-Suite | **Der Nutzer spielt und beurteilt das Gefühl.** Erst wenn das sitzt, geht es weiter. |
| **M2 Werkzeuge** | Levelformat, Validator samt Nachweis, dass er ablehnt, Bots; Käfer und Schnecke mit Haus, Blöcke, Erdbeere; 1-1 als Graubox | Validator und Bots laufen; 1-1 ist in Graubox spielbar |
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
