# Plapper

Browser-Prototyp ohne Installation oder externe Abhängigkeiten. Audio bleibt im Browser und wird nicht hochgeladen.

Im Verzeichnis `papagei` starten:

```sh
python3 -m http.server 8080 --bind 127.0.0.1 --directory dist
```

Zwei getrennte Ansichten verwenden dieselbe Audioverarbeitung:

- **http://localhost:8080/**: Benutzeroberfläche mit einem wandernden, lautstärkereaktiven Wurm, Start und Stop. Ein gewellter Kopf zieht einen aus 36 sich verjüngenden Konturen bestehenden Schweif hinter sich her. Grün zeigt Zuhören, Orange die Wiedergabe an. Im Ruhezustand gleitet und atmet der Wurm sanft; Wurm und Sterne bewegen sich unabhängig von der Systemeinstellung für reduzierte Bewegung. Der Produktionsmodus würfelt bei jedem Satz automatisch Werte aus den festgelegten Bereichen aus. Keine Regler oder Entwicklungsbedienelemente.
- **http://localhost:8080/develop/**: Stimmenlabor mit allen Reglern, Modusauswahl und Wiederholen-Taste.

Eine Ansicht öffnen, Start drücken und Mikrofon erlauben. Sprechen und etwa eine Sekunde pausieren. Während der Wiedergabe und des kurzen Hallausklangs werden keine neuen Sätze aufgenommen. Stop beendet Wiedergabe und Mikrofonzugriff und verwirft die Aufnahme.

## Regler

- Geschwindigkeit: 0,5–2,0-fach, Startwert 0,8. Keine zufälligen Schwankungen im Stimmenlabor.
- Tonhöhe: −12 bis +20 Halbtöne, Startwert +4. Die Tonhöhenänderung durch das Tempo wird kompensiert, sodass beide Regler unabhängig sind. Die WSOLA-Verarbeitung ist eine Näherung und kann bei extremen Einstellungen hörbare Artefakte erzeugen.
- Hall / Chorus: 0–200 %, startet ausgeschaltet. Aus Paul-Revers übernommen: zwei modulierte Stimmkopien und ein wanderndes kurzes Echo.
- Verzerrung: 0–200 %, startet ausgeschaltet. Aus Paul-Revers übernommen: Sprachbandfilter und Sättigung mit Pegelabgleich; vor dem Hall.

Tempo und Tonhöhe werden beim nächsten Abspielen übernommen. Hall und Verzerrung wirken live. Die Modusauswahl ersetzt die bisherige Checkbox:

- Individuell: Alle Wiedergaben verwenden die manuell eingestellten Werte.
- Beim Wiederholen zufällig einstellen (Standard): Nur der Knopf „Satz noch einmal hören“ würfelt neue Werte aus. Automatisches Nachplappern verwendet die aktuellen Werte.
- Produktionsmodus: Jede Wiedergabe würfelt neu, sowohl automatisches Nachplappern als auch manuelles Wiederholen.

Zufallsbereiche: Geschwindigkeit 0,75–0,90 (in 0,05-Schritten), Tonhöhe +12–16 Halbtöne, Hall 20–40 % und Verzerrung 10–30 %. Alle Grenzen sind eingeschlossen. Die Regler und Zahlen zeigen die gewählten Werte an. Ein Moduswechsel allein verändert keine Werte und startet keine Wiedergabe. Eine neue Aufnahme ersetzt die vorherige. Der vorherige feste Nasalfilter ist im Stimmenlabor nicht aktiv.

Aktueller Browser mit AudioWorklet erforderlich; Mikrofonzugriff braucht localhost oder HTTPS. Die Lautstärkeerkennung funktioniert am besten in ruhiger Umgebung. Sätze werden auf höchstens 20 Sekunden begrenzt. Keine Spracherkennung, kein Server für Audio.

Beim Laden und bei der Rückkehr zur Seite wird die HTML-Einstiegsseite ohne Cache geprüft. Haben sich die eingebundenen Skript- oder Stylesheet-Versionen geändert, lädt die App die neue Seite automatisch. Eine laufende Audiositzung wird erst nach Stop aktualisiert. Das gilt auch beim Öffnen über den Homebildschirm; eine ältere Version ohne diese Prüfung muss einmal regulär neu geladen werden. Bei Änderungen weiterhin die `?v=`-Version der betroffenen Dateien und ihrer importierenden Skripte bis zur HTML-Seite aktualisieren.

Prüfungen: `node --test tests/*.test.mjs`

Manuell prüfen: Mikrofon erlauben/ablehnen; Satz und Sprechpause; denselben Satz bei verschiedenen Reglerstellungen wiederholen; Hall/Verzerrung live ändern; Stop während Aufnahme, Wiedergabe und Hallausklang; erneut starten. Sprachqualität und Layout müssen im Browser geprüft werden.
