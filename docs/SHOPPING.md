# Einkaufsbereich /einkaufen

## Bestandsaufnahme 08.11.2026
Vite/React 19; bestehendes AuthGate mit bestätigtem Konto und app_owner-Freigabe. Server-APIs nutzen requireOwner. Supabase: 66 Zutaten, 57 Produkte, 55 Preise, 3 Kassenbons, 6 Rezepte. Alle vorhandenen Lebensmittel-Tabellen haben RLS. Das Datenmodell bleibt unverändert.

Dublettenprüfung: Speisestärke (dry/powder) und Ingwer (raw/grated) dürfen bei gleicher Basiseinheit im Einkauf zusammenlaufen. Knoblauch/Knoblauchzehen nur als Gramm, nicht als Stück (Knolle vs. Zehe). Umsetzung ist ein Einkaufsadapter; keine Stammdaten gelöscht oder Produkte zusammengelegt. Unterschiedliche Produktgrößen bleiben eigene Datensätze.

## Speicherung und Zugriff
Additive Migration database/shopping.sql: persönliche shopping_lists, shopping_operations, shopping_price_cache. Gleiche app_owner-Zuordnung und RLS mit USING/WITH CHECK; kein Zugriff für anon. shopping_mutate ist SECURITY INVOKER. Listenänderungen werden je Liste serialisiert und mit operation_id dedupliziert. Alias-IDs erhalten nach dem Zusammenrechnen nachfolgende Offline-Bearbeitungen.

## Schlechter Empfang
Änderungen werden zuerst im geräte- und nutzergebundenen lokalen Speicher abgelegt, danach synchronisiert. Bei Speicherfehlern wird nichts als gespeichert dargestellt. Wiederholungen sind idempotent; Metadaten und Artikel werden als Einzelaktionen übertragen. Synchronisierung bei Wiederverbindung und alle 20 Sekunden. Die bereits geöffnete Ansicht bleibt offline bedienbar. Ein vollständiger Neustart benötigt weiterhin eine erfolgreiche bestehende Login-Prüfung; kein Offline-Bypass des AuthGate. Lokaler Cache ist Browser-Speicher, kein Backup. Andere Nutzerkonten erhalten einen eigenen Cache-Key. Keine persönlichen Daten in öffentlichen Assets oder Service-Worker-Caches.

## Preisberechnung
1. Aktueller, unbedingter EUR-Preis des gewählten Händlers für ein passendes Produkt und eine bestätigte Packungsgröße.
2. Gespeicherte recherchierte Onlinepreise, danach vorhandene Online-Vergleichspreise mit Quelle.
3. Allgemeine Richtpreise mit ausdrücklich angenommener Packung.

Ganze Packungen werden aufgerundet. Gesamtpreis enthält auch abgehakte Artikel. „Noch einzukaufen“ nur offene Artikel. Bekanntes Pfand wird separat genannt und addiert; unbekanntes Pfand wird als unbekannt ausgewiesen. Keine Umrechnung fremder Währungen als deutscher Ladenpreis. Keine Mitglieds-/Couponpreise, abgelaufenen Angebote oder unbekannten Packungszählungen als Gewichts-/Volumenpreise. Preisdetails zeigen Quelle, Datum, Packung und Preisart. Richtpreise haben kein erfundenes Beobachtungsdatum.

Online-Recherche nutzt ausschließlich den bereits eingerichteten serverseitigen Anthropic-Zugang mit Websuche. Nur Artikelname, Einheit, Händler und optional Produkt/Packung werden übertragen. Keine Rezept-, Ernährungs- oder Kontodaten. Quellen müssen vom Websuchwerkzeug zitiert worden sein. Ergebnisse und Fehlversuche werden persönlich gespeichert. Treffer 7 Tage, Fehlversuche 1 Tag, laufende Claims 2 Minuten; maximal 40 unterschiedliche Abfragen je Nutzer und Tag. Zwei Suchaufrufe pro Artikel. Bei deaktiviertem/fehlendem Provider, Zeitüberschreitung oder fehlendem Nachweis bleibt der Richtpreis sichtbar. Recherche läuft bei geöffneter Liste im Hintergrund und benötigt Internet; kein unbeaufsichtigter Cronjob.

## Bedienung
Eigene Listen erstellen/umbenennen/archivieren/wiederherstellen; Supermarkt je Liste. Artikel suchen, frei erfassen, Mengen/Einheit setzen, bearbeiten und abhaken. Kategorien werden vorgeschlagen; manuelle Zuordnung und Reihenfolge über Auf/Ab-Knöpfe. Rezepte skalieren mit recipe.servings; optionale/Vorratszutaten werden vorab abgewählt. Nicht quantifizierte Zutaten erscheinen als 1 Einkaufsartikel mit sichtbarem „Menge prüfen“. Letzte Artikel in 20er Schritten. Desktop mit Seitennavigation, mobil mit horizontalem Listenwechsel. Bestehende q-card/q-energy/InfoTip/ProfileMenu/Icon werden wiederverwendet. Nutrition-CI ist gemäß Anforderung blau-grau (abweichend vom Life-OS-Orange).

## Prüfung
34 Tests mit node --test tests/*.test.js; Babel-Parse aller Quellmodule; isolierter UI-Bundle. Supabase-Transaktion mit anschließendem ROLLBACK testet Ownerzugriff und idempotente Wiederholung, fremde Testidentität sieht null Zeilen. Bestehender Hinweis „Leaked Password Protection disabled“ bleibt unverändert; keine neue RLS-Warnung. Vercel-Preview erfolgreich gebaut. Visueller Desktop-/Mobil- und angemeldeter End-to-End-Test stehen noch aus: Vorschauzugriff durch Vercel-SSO blockiert. Kein Schutz wurde dafür deaktiviert.
