/* =========================================================
   NatureFlow Pets – Partnerbereich (Prototyp, Fassung 2)
   Reine Browser-Anwendung mit Demodaten. Kein Server, keine echten Daten.
   Zustand liegt im localStorage dieses Browsers.

   Fassung 2 (2026-08-10):
   – Ansprache durchgängig per du, wie im übrigen Shop
   – Stufen heißen Gefährte / Begleiter / Wegbereiter
   – NEU: Inhalte (Bilder & Videos) hochladen, prüfen, freigeben
   – NEU: Social-Profile mit Reichweite – in Bewerbung, Profil, Partnerliste
   – NEU: eigene Profilseite, Partner-Detailansicht, Abrechnungslauf,
          Sperren, Suche/Filter, Zeitraumfilter, Nachweis-Upload
   ========================================================= */
(function () {
  'use strict';

  // ---------------------------------------------------------------
  // 1. Regelwerk des Programms – an EINER Stelle, damit es prüfbar bleibt
  // ---------------------------------------------------------------
  var REGELN = {
    stufen: [
      { name: 'Gefährte',   satz: 0.10, abBestellungen: 0,  abUmsatz: 0 },
      { name: 'Begleiter',  satz: 0.15, abBestellungen: 10, abUmsatz: 500 },
      { name: 'Wegbereiter', satz: 0.20, abBestellungen: 40, abUmsatz: 2500 }
    ],
    folgekaufFaktor: 0.5,      // Folgebestellungen desselben Kunden: halbe Beteiligung
    folgekaufMonate: 12,
    kundenrabatt: 0.10,
    sperrfristTage: 28,        // 14 Tage Widerruf + 14 Tage Puffer
    mindestauszahlung: 25,
    /* VORSCHLAG, noch nicht entschieden (Aaron): Vergütung für freigegebene
       Inhalte. Steht bewusst hier oben, damit sie an einer Stelle änderbar ist
       und in der Oberfläche überall als Vorschlag gekennzeichnet werden kann. */
    materialpraemie: { bild: 10, video: 25 },
    praemieVorschlag: true,
    maxDateiMB: 200
  };

  var NETZE = ['Instagram', 'TikTok', 'YouTube', 'Facebook', 'Website oder Blog', 'Newsletter', 'Podcast', 'Sonstiges'];

  /** Stufe aus dem bis dahin erreichten Stand bestimmen (höchste erfüllte Stufe gewinnt). */
  function stufeFuer(bestellungen, umsatz) {
    var treffer = REGELN.stufen[0];
    for (var i = 0; i < REGELN.stufen.length; i++) {
      var s = REGELN.stufen[i];
      if (bestellungen >= s.abBestellungen || umsatz >= s.abUmsatz) treffer = s;
    }
    return treffer;
  }

  /** Nächste Stufe und wie weit es noch ist – für den Fortschrittsbalken. */
  function naechsteStufe(bestellungen, umsatz) {
    var jetzt = stufeFuer(bestellungen, umsatz);
    var idx = REGELN.stufen.indexOf(jetzt);
    if (idx >= REGELN.stufen.length - 1) return null;
    var z = REGELN.stufen[idx + 1];
    var fortschrittB = z.abBestellungen ? bestellungen / z.abBestellungen : 0;
    var fortschrittU = z.abUmsatz ? umsatz / z.abUmsatz : 0;
    var f = Math.max(fortschrittB, fortschrittU);
    return {
      ziel: z,
      anteil: Math.max(0, Math.min(1, f)),
      fehltBestellungen: Math.max(0, z.abBestellungen - bestellungen),
      fehltUmsatz: Math.max(0, z.abUmsatz - umsatz)
    };
  }

  // ---------------------------------------------------------------
  // 2. Hilfsmittel
  // ---------------------------------------------------------------
  var SPEICHER = 'nfp_portal_zustand_v2';
  var SPEICHER_BEWERBUNGEN = 'nfp_fachpartner_bewerbungen'; // teilt sich die Landingpage

  function eur(n) {
    return (n || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  }
  function zahl(n) { return (n || 0).toLocaleString('de-DE'); }
  /** Reichweiten kurz: 12400 -> 12,4 Tsd. */
  function kurz(n) {
    n = n || 0;
    if (n >= 1000000) return (n / 1000000).toLocaleString('de-DE', { maximumFractionDigits: 1 }) + ' Mio.';
    if (n >= 1000) return (n / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 }) + ' Tsd.';
    return zahl(n);
  }
  function datum(iso) {
    var d = new Date(iso);
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
  function tageHer(n) {
    var d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - n);
    return d.toISOString();
  }
  function tageSeit(iso) {
    return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  }
  function mb(bytes) {
    // Unter 1 MB in KB anzeigen: „0 MB" sieht wie ein Fehler aus, ist aber nur eine kleine Datei.
    if (bytes < 1048576) return Math.max(1, Math.round(bytes / 1024)).toLocaleString('de-DE') + ' KB';
    return (bytes / 1048576).toLocaleString('de-DE', { maximumFractionDigits: 1 }) + ' MB';
  }
  function dauerText(s) {
    if (!s && s !== 0) return '';
    var m = Math.floor(s / 60), r = Math.round(s % 60);
    return m + ':' + (r < 10 ? '0' : '') + r + ' min';
  }
  /** Schützt vor kaputtem Markup, wenn Demodaten oder Bewerbungstexte Sonderzeichen enthalten. */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function el(sel, wurzel) { return (wurzel || document).querySelector(sel); }
  function alle(sel, wurzel) { return Array.prototype.slice.call((wurzel || document).querySelectorAll(sel)); }

  var toastTimer = null;
  function toast(text) {
    var t = el('#toast');
    t.textContent = text;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 3600);
  }

  // ---------------------------------------------------------------
  // 3. Demodaten
  // ---------------------------------------------------------------
  function demodaten() {
    var partner = [
      { id: 'P-1042', name: 'Maike Hansen', firma: 'Physio Hund Lübeck', ort: 'Lübeck', plz: '23552',
        strasse: 'Fleischhauerstraße 42', telefon: '0451 7729140',
        email: 'm.hansen@beispiel.de', code: 'HANSEN10', seit: tageHer(214),
        taetigkeit: 'Praxis für Hundephysiotherapie, Schwerpunkt Rehabilitation nach Operationen.',
        website: 'https://physio-hund-luebeck.de',
        social: [
          { netz: 'Instagram', handle: '@physiohund.luebeck', follower: 8400, url: 'https://instagram.com/physiohund.luebeck' },
          { netz: 'Website oder Blog', handle: 'physio-hund-luebeck.de', follower: 2200, url: 'https://physio-hund-luebeck.de' }
        ],
        bankInhaber: 'Maike Hansen', iban: 'DE00 XXXX XXXX XXXX XXXX XX',
        kleinunternehmer: false, gesperrt: false },

      { id: 'P-1071', name: 'Silke Brandt', firma: 'Tierarztpraxis am Ratzeburger See', ort: 'Ratzeburg', plz: '23909',
        strasse: 'Seestraße 7', telefon: '04541 887210',
        email: 's.brandt@beispiel.de', code: 'SEEPRAXIS10', seit: tageHer(268),
        taetigkeit: 'Kleintierpraxis mit Schwerpunkt Orthopädie und Geriatrie.',
        website: 'https://tierarzt-ratzeburg.de',
        social: [
          { netz: 'Website oder Blog', handle: 'tierarzt-ratzeburg.de', follower: 3100, url: 'https://tierarzt-ratzeburg.de' }
        ],
        bankInhaber: 'Praxis Dr. Brandt', iban: 'DE00 XXXX XXXX XXXX XXXX XX',
        kleinunternehmer: false, gesperrt: false,
        hinweis: 'Tierärztin – kein Testimonial mit Berufsbezeichnung verwenden (Berufsrecht).' },

      { id: 'P-1088', name: 'Jonas Weber', firma: 'Hundeschule Weber', ort: 'Mölln', plz: '23879',
        strasse: 'Am Schulsee 12', telefon: '04542 993071',
        email: 'kontakt@beispiel.de', code: 'WEBER10', seit: tageHer(96),
        taetigkeit: 'Hundeschule mit Gruppen- und Einzeltraining, viele Junghunde und Senioren.',
        website: 'https://hundeschule-weber.de',
        social: [
          { netz: 'Instagram', handle: '@hundeschule.weber', follower: 14200, url: 'https://instagram.com/hundeschule.weber' },
          { netz: 'TikTok', handle: '@hundeschuleweber', follower: 31500, url: 'https://tiktok.com/@hundeschuleweber' },
          { netz: 'YouTube', handle: 'Hundeschule Weber', follower: 4700, url: 'https://youtube.com/@hundeschuleweber' }
        ],
        bankInhaber: 'Jonas Weber', iban: 'DE00 XXXX XXXX XXXX XXXX XX',
        kleinunternehmer: true, gesperrt: false },

      { id: 'P-1094', name: 'Claudia Reinhardt', firma: 'Napfgeflüster Ernährungsberatung', ort: 'Hamburg', plz: '22765',
        strasse: 'Bahrenfelder Straße 88', telefon: '040 5567281',
        email: 'hallo@beispiel.de', code: 'NAPF10', seit: tageHer(151),
        taetigkeit: 'Ernährungsberatung für Hunde, BARF und Rationsberechnung.',
        website: 'https://napfgefluester.de',
        social: [
          { netz: 'Instagram', handle: '@napfgefluester', follower: 22800, url: 'https://instagram.com/napfgefluester' },
          { netz: 'Newsletter', handle: 'Napfpost', follower: 5600, url: '' }
        ],
        bankInhaber: 'Claudia Reinhardt', iban: 'DE00 XXXX XXXX XXXX XXXX XX',
        kleinunternehmer: true, gesperrt: false },

      { id: 'P-1101', name: 'Tom Lindner', firma: 'Futterhaus Mölln', ort: 'Mölln', plz: '23879',
        strasse: 'Hauptstraße 3', telefon: '04542 881900',
        email: 't.lindner@beispiel.de', code: 'MOELLN10', seit: tageHer(183),
        taetigkeit: 'Inhabergeführter Zoofachhandel mit Beratungstheke.',
        website: '',
        social: [],
        bankInhaber: 'Tom Lindner e.K.', iban: 'DE00 XXXX XXXX XXXX XXXX XX',
        kleinunternehmer: false, gesperrt: false }
    ];

    // [partnerId, tageHer, kundeId, bruttoWarenwert, storniert]
    var roh = [
      ['P-1042', 198, 'K-201', 79.95, false], ['P-1042', 181, 'K-204', 49.95, false],
      ['P-1042', 174, 'K-207', 114.95, false], ['P-1042', 160, 'K-201', 49.95, false],
      ['P-1042', 152, 'K-212', 27.95, false],  ['P-1042', 139, 'K-215', 169.95, false],
      ['P-1042', 128, 'K-204', 84.95, false],  ['P-1042', 117, 'K-221', 59.95, true],
      ['P-1042', 103, 'K-224', 79.95, false],  ['P-1042', 94,  'K-227', 119.95, false],
      ['P-1042', 82,  'K-215', 49.95, false],  ['P-1042', 71,  'K-233', 249.95, false],
      ['P-1042', 60,  'K-236', 44.95, false],  ['P-1042', 47,  'K-239', 84.95, false],
      ['P-1042', 33,  'K-224', 69.95, false],  ['P-1042', 24,  'K-244', 99.95, false],
      ['P-1042', 16,  'K-247', 49.95, false],  ['P-1042', 9,   'K-250', 169.95, false],
      ['P-1042', 4,   'K-253', 79.95, false],  ['P-1042', 1,   'K-256', 114.95, false],

      ['P-1071', 249, 'K-301', 169.95, false], ['P-1071', 231, 'K-304', 249.95, false],
      ['P-1071', 212, 'K-307', 84.95, false],  ['P-1071', 197, 'K-301', 79.95, false],
      ['P-1071', 178, 'K-312', 119.95, false], ['P-1071', 164, 'K-315', 249.95, false],
      ['P-1071', 149, 'K-318', 169.95, false], ['P-1071', 131, 'K-304', 114.95, false],
      ['P-1071', 118, 'K-324', 84.95, false],  ['P-1071', 104, 'K-327', 249.95, false],
      ['P-1071', 92,  'K-330', 99.95, false],  ['P-1071', 79,  'K-315', 169.95, false],
      ['P-1071', 66,  'K-336', 139.95, false], ['P-1071', 54,  'K-339', 249.95, false],
      ['P-1071', 41,  'K-342', 84.95, false],  ['P-1071', 29,  'K-345', 179.95, false],
      ['P-1071', 19,  'K-330', 119.95, false], ['P-1071', 11,  'K-351', 249.95, false],
      ['P-1071', 6,   'K-354', 169.95, false], ['P-1071', 2,   'K-357', 99.95, false],

      ['P-1088', 74, 'K-401', 49.95, false], ['P-1088', 58, 'K-404', 27.95, false],
      ['P-1088', 43, 'K-407', 79.95, false], ['P-1088', 31, 'K-401', 44.95, false],
      ['P-1088', 18, 'K-412', 59.95, false], ['P-1088', 7,  'K-415', 49.95, false],

      ['P-1094', 142, 'K-501', 84.95, false], ['P-1094', 128, 'K-504', 119.95, false],
      ['P-1094', 111, 'K-507', 49.95, false], ['P-1094', 97,  'K-501', 69.95, false],
      ['P-1094', 84,  'K-512', 169.95, false],['P-1094', 68,  'K-515', 99.95, false],
      ['P-1094', 51,  'K-518', 84.95, false], ['P-1094', 38,  'K-504', 59.95, true],
      ['P-1094', 22,  'K-524', 114.95, false],['P-1094', 12,  'K-527', 79.95, false],
      ['P-1094', 3,   'K-530', 139.95, false],

      ['P-1101', 176, 'K-601', 49.95, false], ['P-1101', 158, 'K-604', 84.95, false],
      ['P-1101', 141, 'K-607', 27.95, false]
    ];

    var bestellungen = roh.map(function (r, i) {
      var brutto = r[3];
      var nachRabatt = brutto * (1 - REGELN.kundenrabatt);
      var netto = nachRabatt / 1.07; // 7 % Umsatzsteuer, Tierbedarf
      return {
        id: 'NF-' + (24800 + i * 7),
        partnerId: r[0],
        datum: tageHer(r[1]),
        kundeId: r[2],
        brutto: Math.round(brutto * 100) / 100,
        nachRabatt: Math.round(nachRabatt * 100) / 100,
        netto: Math.round(netto * 100) / 100,
        storniert: r[4]
      };
    });

    var bewerbungen = [
      { id: 'B-3041', name: 'Annika Voß', firma: 'Tierheilpraxis Voß', email: 'praxis@beispiel.de',
        telefon: '04541 998720', website: 'https://thp-voss.de', ort: 'Ratzeburg',
        taetigkeit: 'Tierheilpraxis seit 2016, Schwerpunkt Bewegungsapparat und Ernährung. Etwa 60 Hunde im Monat, viele davon Senioren mit Bewegungsthemen. Mitglied im Verband Deutscher Tierheilpraktiker.',
        weg: 'Im persönlichen Beratungsgespräch', kunden: '50 bis 100',
        nachricht: 'Ich empfehle bereits Grünlippmuschel, hätte aber gern eine Bezugsquelle, hinter der ich fachlich stehen kann.',
        social: [{ netz: 'Instagram', handle: '@tierheilpraxis.voss', follower: 3400, url: 'https://instagram.com/tierheilpraxis.voss' }],
        nachweise: [{ name: 'Verbandsausweis-VDT-2026.pdf', groesse: 412000 }, { name: 'Gewerbeanmeldung.pdf', groesse: 288000 }],
        kleinunternehmer: false, eingang: tageHer(2), status: 'offen' },

      { id: 'B-3038', name: 'Peer Timmermann', firma: 'Hundesport Nordlicht', email: 'info@beispiel.de',
        telefon: '', website: 'https://hundesport-nordlicht.de', ort: 'Kiel',
        taetigkeit: 'Hundesportverein mit Agility und Mantrailing, ich betreue die Trainingsgruppen. Rund 80 aktive Hunde.',
        weg: 'Mehreres davon', kunden: '50 bis 100',
        nachricht: '',
        social: [
          { netz: 'Instagram', handle: '@hundesport.nordlicht', follower: 9800, url: 'https://instagram.com/hundesport.nordlicht' },
          { netz: 'TikTok', handle: '@nordlichtdogs', follower: 46000, url: 'https://tiktok.com/@nordlichtdogs' }
        ],
        nachweise: [{ name: 'Vereinsregister-Auszug.pdf', groesse: 190000 }],
        kleinunternehmer: true, eingang: tageHer(4), status: 'offen' },

      { id: 'B-3035', name: 'Sabine Kruse', firma: 'Sparfuchs Gutscheinwelt', email: 'kontakt@beispiel.de',
        telefon: '', website: 'https://sparfuchs-gutscheinwelt.de', ort: 'Berlin',
        taetigkeit: 'Wir betreiben ein Gutscheinportal mit über 300.000 Besuchern im Monat und listen Rabattcodes für Tierbedarf.',
        weg: 'Über meine Website oder meinen Newsletter', kunden: 'Mehr als 100',
        nachricht: 'Wir würden euren Code prominent platzieren.',
        social: [{ netz: 'Website oder Blog', handle: 'sparfuchs-gutscheinwelt.de', follower: 310000, url: 'https://sparfuchs-gutscheinwelt.de' }],
        nachweise: [],
        kleinunternehmer: false, eingang: tageHer(6), status: 'offen' },

      { id: 'B-3029', name: 'Martina Lehmann', firma: 'Praxis für Tierosteopathie Lehmann', email: 'm.lehmann@beispiel.de',
        telefon: '040 5567281', website: 'https://osteo-lehmann.de', ort: 'Hamburg',
        taetigkeit: 'Tierosteopathie seit 2011, überwiegend Hunde nach Operationen.',
        weg: 'Im persönlichen Beratungsgespräch', kunden: '20 bis 50', nachricht: '',
        social: [], nachweise: [{ name: 'Osteopathie-Zertifikat.pdf', groesse: 520000 }],
        kleinunternehmer: false, eingang: tageHer(21), status: 'angenommen',
        entscheidung: 'Fachlich passend, Praxis über die Website bestätigt.', entschiedenAm: tageHer(19) },

      { id: 'B-3024', name: 'Kevin Marks', firma: '—', email: 'kevin.marks.deals@beispiel.de',
        telefon: '', website: '', ort: '', taetigkeit: 'Ich habe viele Hunde in meinem Bekanntenkreis und würde gern Geld nebenbei verdienen.',
        weg: 'Über Social Media', kunden: 'Bis 20', nachricht: '',
        social: [{ netz: 'Instagram', handle: '@kevin_deals', follower: 320, url: '' }], nachweise: [],
        kleinunternehmer: false, eingang: tageHer(34), status: 'abgelehnt',
        entscheidung: 'Keine gewerbliche oder fachliche Tätigkeit im Tierbereich nachweisbar.', entschiedenAm: tageHer(32) }
    ];

    /* Inhalte: im Prototyp ohne echte Dateien. „vorschau: null" heißt, dass die
       Kachel ein Platzhaltermotiv zeigt – echte Uploads bekommen ein verkleinertes
       Vorschaubild, das im Browser erzeugt wird. */
    var inhalte = [
      { id: 'C-7001', partnerId: 'P-1088', titel: 'Aufwärmübungen für Seniorhunde', art: 'video',
        dateiname: 'aufwaermen-senioren.mp4', groesse: 48200000, dauer: 74, vorschau: null,
        hinweis: 'Kurzes Reel aus dem Gruppentraining, ohne Musik.', rechte: true,
        hochgeladen: tageHer(5), status: 'pruefung' },
      { id: 'C-7002', partnerId: 'P-1094', titel: 'Napf mit Tagesration', art: 'bild',
        dateiname: 'napf-tagesration.jpg', groesse: 3100000, vorschau: null,
        hinweis: 'Für Rezeptbeiträge, gern auch für euren Feed.', rechte: true,
        hochgeladen: tageHer(9), status: 'frei', entschiedenAm: tageHer(7),
        entscheidung: 'Sehr schön, passt in die Bildwelt.' },
      { id: 'C-7003', partnerId: 'P-1042', titel: 'Massage nach dem Spaziergang', art: 'bild',
        dateiname: 'massage-praxis.jpg', groesse: 2400000, vorschau: null,
        hinweis: '', rechte: true, hochgeladen: tageHer(16), status: 'frei',
        entschiedenAm: tageHer(14), entscheidung: 'Freigegeben.' },
      { id: 'C-7004', partnerId: 'P-1088', titel: 'Kundenstimme Frau K.', art: 'video',
        dateiname: 'kundenstimme-frau-k.mp4', groesse: 91000000, dauer: 46, vorschau: null,
        hinweis: 'Kundin erzählt, wie es ihrem Hund geht.', rechte: true,
        hochgeladen: tageHer(23), status: 'abgelehnt', entschiedenAm: tageHer(21),
        entscheidung: 'Im Video fällt der Satz „seit der Arthrose läuft er wieder schmerzfrei" – das ist eine krankheitsbezogene Aussage und dürfen wir nicht verwenden. Gern eine neue Fassung ohne Krankheitsbegriffe.' }
    ];

    /* Die Beträge müssen UNTER der bereits auszahlbaren Provision liegen – sonst zeigt
       die Übersicht „auszahlbar 0,00 €", obwohl der Partner sichtbar vermittelt hat.
       Der Browsertest prüft diese Bedingung mit. */
    var auszahlungen = [
      { id: 'GS-9012', partnerId: 'P-1042', datum: tageHer(41), betrag: 42.80, zeitraum: 'Juni 2026' },
      { id: 'GS-9013', partnerId: 'P-1042', datum: tageHer(11), betrag: 31.60, zeitraum: 'Juli 2026' },
      { id: 'GS-9014', partnerId: 'P-1071', datum: tageHer(41), betrag: 96.40, zeitraum: 'Juni 2026' },
      { id: 'GS-9015', partnerId: 'P-1071', datum: tageHer(11), betrag: 74.20, zeitraum: 'Juli 2026' },
      { id: 'GS-9016', partnerId: 'P-1094', datum: tageHer(11), betrag: 22.50, zeitraum: 'Juli 2026' }
    ];

    return { partner: partner, bestellungen: bestellungen, bewerbungen: bewerbungen,
             auszahlungen: auszahlungen, inhalte: inhalte };
  }

  // ---------------------------------------------------------------
  // 4. Zustand laden / speichern
  // ---------------------------------------------------------------
  var Z = null;

  function laden() {
    try {
      var roh = localStorage.getItem(SPEICHER);
      if (roh) { Z = JSON.parse(roh); }
    } catch (e) { Z = null; }
    if (!Z || !Z.partner) { Z = demodaten(); speichern(); }
    // Nachrüsten, falls ein alter Zustand im Browser liegt
    if (!Z.inhalte) Z.inhalte = [];
    Z.partner.forEach(function (p) { if (!p.social) p.social = []; });
    uebernehmeNeueBewerbungen();
  }

  /** Gibt false zurück, wenn der Speicher voll ist – der Aufrufer kann dann aufräumen. */
  function speichern() {
    try { localStorage.setItem(SPEICHER, JSON.stringify(Z)); return true; }
    catch (e) { return false; }
  }
  function zuruecksetzen() {
    try { localStorage.removeItem(SPEICHER); localStorage.removeItem(SPEICHER_BEWERBUNGEN); } catch (e) {}
    Z = demodaten();
    speichern();
  }

  /** Bewerbungen, die über das Formular der Programmseite eingegangen sind, einsammeln. */
  function uebernehmeNeueBewerbungen() {
    var neue = [];
    try { neue = JSON.parse(localStorage.getItem(SPEICHER_BEWERBUNGEN) || '[]'); } catch (e) { return; }
    if (!neue.length) return;
    var vorhanden = {};
    Z.bewerbungen.forEach(function (b) { vorhanden[b.id] = true; });
    var zahl = 0;
    neue.forEach(function (b) {
      if (vorhanden[b.id]) return;
      Z.bewerbungen.unshift({
        id: b.id, name: b.name, firma: b.firma, email: b.email, telefon: b.telefon || '',
        website: b.website || '', ort: b.ort || '', taetigkeit: b.taetigkeit || '', weg: b.weg || '',
        kunden: b.kunden || '', nachricht: b.nachricht || '',
        social: b.social || [], nachweise: b.nachweise || [],
        kleinunternehmer: !!b.kleinunternehmer, eingang: b.eingang, status: 'offen', ausFormular: true
      });
      zahl++;
    });
    if (zahl) speichern();
  }

  // ---------------------------------------------------------------
  // 5. Auswertung: Provision je Bestellung, chronologisch
  // ---------------------------------------------------------------
  /**
   * Rechnet alle Bestellungen eines Partners durch und hängt an jede an:
   * satz, folgekauf, provision, status.
   * Die Stufe wird aus dem Stand VOR der jeweiligen Bestellung bestimmt –
   * so bleibt eine alte Abrechnung nachvollziehbar, auch wenn der Partner später aufsteigt.
   */
  function berechnePartner(partnerId) {
    var liste = Z.bestellungen
      .filter(function (b) { return b.partnerId === partnerId; })
      .sort(function (a, b) { return new Date(a.datum) - new Date(b.datum); });

    var zaehlerBestellungen = 0, zaehlerUmsatz = 0;
    var ersterKauf = {}; // kundeId -> ISO-Datum des Erstkaufs
    var grenzeMs = REGELN.folgekaufMonate * 30.44 * 86400000;

    var ergebnis = liste.map(function (b) {
      var stufe = stufeFuer(zaehlerBestellungen, zaehlerUmsatz);
      var satz = stufe.satz;

      var folgekauf = false;
      if (ersterKauf[b.kundeId]) {
        var abstand = new Date(b.datum) - new Date(ersterKauf[b.kundeId]);
        if (abstand <= grenzeMs) folgekauf = true;
      } else {
        ersterKauf[b.kundeId] = b.datum;
      }

      var provision = b.storniert ? 0 : b.netto * satz * (folgekauf ? REGELN.folgekaufFaktor : 1);
      provision = Math.round(provision * 100) / 100;

      if (!b.storniert) { zaehlerBestellungen++; zaehlerUmsatz += b.netto; }

      var alter = tageSeit(b.datum);
      var status = b.storniert ? 'storniert' : (alter >= REGELN.sperrfristTage ? 'auszahlbar' : 'in-pruefung');

      return Object.assign({}, b, {
        stufeName: stufe.name, satz: satz, folgekauf: folgekauf,
        provision: provision, status: status,
        auszahlbarInTagen: Math.max(0, REGELN.sperrfristTage - alter)
      });
    });

    var ausgezahlt = Z.auszahlungen
      .filter(function (a) { return a.partnerId === partnerId; })
      .reduce(function (s, a) { return s + a.betrag; }, 0);

    var gueltig = ergebnis.filter(function (b) { return !b.storniert; });
    var provGesamt = ergebnis.reduce(function (s, b) { return s + b.provision; }, 0);
    var provAuszahlbar = ergebnis.filter(function (b) { return b.status === 'auszahlbar'; })
                                 .reduce(function (s, b) { return s + b.provision; }, 0);
    var provPruefung = ergebnis.filter(function (b) { return b.status === 'in-pruefung'; })
                               .reduce(function (s, b) { return s + b.provision; }, 0);

    // Freigegebene Inhalte zählen als Prämie mit in das Guthaben
    var meineInhalte = Z.inhalte.filter(function (c) { return c.partnerId === partnerId; });
    var freigegeben = meineInhalte.filter(function (c) { return c.status === 'frei'; });
    var praemien = freigegeben.reduce(function (s, c) {
      return s + (REGELN.materialpraemie[c.art] || 0);
    }, 0);

    var umsatzNetto = gueltig.reduce(function (s, b) { return s + b.netto; }, 0);
    var letzte = gueltig.length ? gueltig[gueltig.length - 1].datum : null;

    var p = partnerVon(partnerId) || {};
    var reichweite = (p.social || []).reduce(function (s, x) { return s + (x.follower || 0); }, 0);

    return {
      bestellungen: ergebnis.slice().reverse(), // neueste zuerst für die Anzeige
      anzahl: gueltig.length,
      stornos: ergebnis.length - gueltig.length,
      umsatzNetto: umsatzNetto,
      umsatzBrutto: gueltig.reduce(function (s, b) { return s + b.nachRabatt; }, 0),
      stufe: stufeFuer(gueltig.length, umsatzNetto),
      naechste: naechsteStufe(gueltig.length, umsatzNetto),
      provGesamt: provGesamt,
      praemien: praemien,
      inhalteGesamt: meineInhalte.length,
      inhalteFrei: freigegeben.length,
      inhaltePruefung: meineInhalte.filter(function (c) { return c.status === 'pruefung'; }).length,
      reichweite: reichweite,
      guthabenGesamt: provGesamt + praemien,
      provAuszahlbar: Math.max(0, provAuszahlbar + praemien - ausgezahlt),
      provPruefung: provPruefung,
      ausgezahlt: ausgezahlt,
      letzteBestellung: letzte,
      tageInaktiv: letzte ? tageSeit(letzte) : null
    };
  }

  /** Kennzahlen eines Partners eingeschränkt auf die letzten N Tage (0 = alles). */
  function imZeitraum(a, tage) {
    if (!tage) {
      return { anzahl: a.anzahl, umsatz: a.umsatzNetto, provision: a.provGesamt };
    }
    var grenze = Date.now() - tage * 86400000;
    var liste = a.bestellungen.filter(function (b) {
      return !b.storniert && new Date(b.datum).getTime() >= grenze;
    });
    return {
      anzahl: liste.length,
      umsatz: liste.reduce(function (s, b) { return s + b.netto; }, 0),
      provision: liste.reduce(function (s, b) { return s + b.provision; }, 0)
    };
  }

  // ---------------------------------------------------------------
  // 6. Anmeldung
  // ---------------------------------------------------------------
  var ZUGAENGE = {
    'm.hansen@beispiel.de': { pw: 'demo1234', rolle: 'partner', partnerId: 'P-1042' },
    'partner@natureflow-pets.com':     { pw: 'demo1234', rolle: 'admin', name: 'Verwaltung' }
  };
  var sitzung = null;

  function anmelden(mail, pw) {
    var k = ZUGAENGE[String(mail || '').trim().toLowerCase()];
    if (!k || k.pw !== pw) return false;
    sitzung = k;
    el('#view-login').hidden = true;
    el('#view-app').hidden = false;
    var name = k.rolle === 'admin' ? 'Verwaltung' : (partnerVon(k.partnerId) || {}).name;
    el('#who').textContent = name + (k.rolle === 'admin' ? ' · Verwaltung' : '');
    el('#side-lbl').textContent = k.rolle === 'admin' ? 'Verwaltung' : 'Mein Bereich';
    bauNavigation();
    zeige(k.rolle === 'admin' ? 'bewerbungen' : 'uebersicht');
    return true;
  }
  function abmelden() {
    sitzung = null;
    detailPartner = null;
    el('#view-app').hidden = true;
    el('#view-login').hidden = false;
    el('#l-fehler').hidden = true;
    el('#side').setAttribute('data-open', 'false');
    el('#btn-menu').setAttribute('aria-expanded', 'false');
  }
  function partnerVon(id) {
    return Z.partner.filter(function (p) { return p.id === id; })[0];
  }

  // ---------------------------------------------------------------
  // 7. Navigation
  // ---------------------------------------------------------------
  var SEITEN_PARTNER = [
    { id: 'uebersicht',   label: 'Übersicht',       icon: 'i-dash' },
    { id: 'bestellungen', label: 'Bestellungen',    icon: 'i-list' },
    { id: 'inhalte',      label: 'Meine Inhalte',   icon: 'i-image' },
    { id: 'auszahlungen', label: 'Auszahlungen',    icon: 'i-euro' },
    { id: 'material',     label: 'Material & Texte', icon: 'i-doc' },
    { id: 'profil',       label: 'Mein Profil',     icon: 'i-person' }
  ];
  var SEITEN_ADMIN = [
    { id: 'bewerbungen',  label: 'Bewerbungen', icon: 'i-inbox' },
    { id: 'medien',       label: 'Inhalte',     icon: 'i-image' },
    { id: 'partner',      label: 'Partner',     icon: 'i-users' },
    { id: 'abrechnung',   label: 'Abrechnung',  icon: 'i-euro' },
    { id: 'auswertung',   label: 'Auswertung',  icon: 'i-chart' }
  ];

  function offeneBewerbungen() {
    return Z.bewerbungen.filter(function (b) { return b.status === 'offen'; });
  }
  function offeneInhalte() {
    return Z.inhalte.filter(function (c) { return c.status === 'pruefung'; });
  }

  function bauNavigation() {
    var seiten = sitzung.rolle === 'admin' ? SEITEN_ADMIN : SEITEN_PARTNER;
    var ul = el('#nav-list');
    ul.innerHTML = seiten.map(function (s) {
      var offen = 0;
      if (s.id === 'bewerbungen') offen = offeneBewerbungen().length;
      if (s.id === 'medien') offen = offeneInhalte().length;
      if (s.id === 'abrechnung') offen = faelligeAuszahlungen().length;
      return '<li><button class="navlink" type="button" data-seite="' + s.id + '">' +
             '<svg><use href="#' + s.icon + '"/></svg><span>' + esc(s.label) + '</span>' +
             (offen ? '<span class="tag tag--warn navlink__z">' + offen + '</span>' : '') +
             '</button></li>';
    }).join('');
    alle('.navlink', ul).forEach(function (b) {
      b.addEventListener('click', function () {
        detailPartner = null;
        zeige(b.getAttribute('data-seite'));
        if (window.matchMedia('(max-width:860px)').matches) {
          el('#side').setAttribute('data-open', 'false');
          el('#btn-menu').setAttribute('aria-expanded', 'false');
        }
      });
    });
  }

  var aktuelleSeite = null;
  var detailPartner = null;   // Partner-ID, wenn die Verwaltung eine Detailansicht offen hat

  function zeige(seite) {
    aktuelleSeite = seite;
    alle('.navlink').forEach(function (b) {
      if (b.getAttribute('data-seite') === seite && !detailPartner) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    });
    var m = el('#main');
    var titel = { uebersicht: 'Übersicht', bestellungen: 'Bestellungen', auszahlungen: 'Auszahlungen',
                  material: 'Material & Texte', inhalte: 'Meine Inhalte', profil: 'Mein Profil',
                  bewerbungen: 'Bewerbungen', partner: 'Partner', medien: 'Inhalte',
                  abrechnung: 'Abrechnung', auswertung: 'Auswertung',
                  partnerdetail: 'Partner' }[seite] || 'Partnerbereich';
    el('#top-title').textContent = titel;

    if (seite === 'uebersicht')          m.innerHTML = seiteUebersicht();
    else if (seite === 'bestellungen')   m.innerHTML = seiteBestellungen();
    else if (seite === 'auszahlungen')   m.innerHTML = seiteAuszahlungen();
    else if (seite === 'material')       m.innerHTML = seiteMaterial();
    else if (seite === 'inhalte')        m.innerHTML = seiteInhaltePartner();
    else if (seite === 'profil')         m.innerHTML = seiteProfil();
    else if (seite === 'bewerbungen')    m.innerHTML = seiteBewerbungen();
    else if (seite === 'medien')         m.innerHTML = seiteMedienAdmin();
    else if (seite === 'partner')        m.innerHTML = seitePartner();
    else if (seite === 'partnerdetail')  m.innerHTML = seitePartnerDetail();
    else if (seite === 'abrechnung')     m.innerHTML = seiteAbrechnung();
    else if (seite === 'auswertung')     m.innerHTML = seiteAuswertung();

    verdrahte();
    m.scrollTop = 0;
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  // ---------------------------------------------------------------
  // 8. Bausteine
  // ---------------------------------------------------------------
  function kpi(label, wert, notiz, gold) {
    return '<div class="kpi' + (gold ? ' kpi--gold' : '') + '">' +
           '<p class="kpi__l">' + esc(label) + '</p>' +
           '<p class="kpi__v">' + wert + '</p>' +
           (notiz ? '<p class="kpi__n">' + notiz + '</p>' : '') + '</div>';
  }
  function tag(art, text, icon) {
    return '<span class="tag tag--' + art + '">' +
           (icon ? '<svg><use href="#' + icon + '"/></svg>' : '') + esc(text) + '</span>';
  }
  function statusTag(b) {
    if (b.status === 'storniert')  return tag('err', 'storniert', 'i-x');
    if (b.status === 'auszahlbar') return tag('ok', 'auszahlbar', 'i-check');
    return tag('warn', 'in Prüfung');
  }
  function inhaltTag(c) {
    if (c.status === 'frei')     return tag('ok', 'freigegeben', 'i-check');
    if (c.status === 'abgelehnt') return tag('err', 'nicht verwendbar', 'i-x');
    return tag('warn', 'in Prüfung');
  }
  function netzIcon(netz) {
    var m = { 'Instagram': 'i-insta', 'TikTok': 'i-tiktok', 'YouTube': 'i-yt',
              'Facebook': 'i-fb', 'Newsletter': 'i-mail', 'Podcast': 'i-mic' };
    return m[netz] || 'i-globe';
  }
  /**
   * Social-Profile kompakt – gleiche Darstellung in Bewerbung, Partnerliste und Detailansicht.
   * In Tabellen wird auf `grenze` Chips gekürzt (sonst wird die Zeile bei drei Profilen sehr hoch);
   * die Gesamtzahl bleibt über den Zähler und die Reichweiten-Spalte erkennbar.
   */
  function socialChips(social, klein, grenze) {
    social = social || [];
    if (!social.length) return '<span class="small muted">keine Profile angegeben</span>';
    var rest = 0;
    if (grenze && social.length > grenze) {
      rest = social.length - grenze;
      social = social.slice(0, grenze);
    }
    return '<div class="chips">' + social.map(function (s) {
      var inhalt = '<svg><use href="#' + netzIcon(s.netz) + '"/></svg>' +
        '<span class="chip__h">' + esc(s.handle || s.netz) + '</span>' +
        (s.follower ? '<span class="chip__f">' + kurz(s.follower) + '</span>' : '');
      return s.url
        ? '<a class="chip' + (klein ? ' chip--sm' : '') + '" href="' + esc(s.url) + '" target="_blank" rel="noopener noreferrer" title="' + esc(s.netz) + '">' + inhalt + '</a>'
        : '<span class="chip' + (klein ? ' chip--sm' : '') + '" title="' + esc(s.netz) + '">' + inhalt + '</span>';
    }).join('') +
    (rest ? '<span class="chip chip--sm chip--rest" title="weitere Profile in der Detailansicht">+' + rest + '</span>' : '') +
    '</div>';
  }
  function reichweiteVon(p) {
    return ((p && p.social) || []).reduce(function (s, x) { return s + (x.follower || 0); }, 0);
  }
  /** Kachel für einen Inhalt – gleiche Darstellung bei Partner und Verwaltung. */
  function inhaltKachel(c, mitPartner, mitAktionen) {
    var p = partnerVon(c.partnerId);
    var bild = c.vorschau
      ? '<img src="' + esc(c.vorschau) + '" alt="Vorschau: ' + esc(c.titel) + '" loading="lazy">'
      : '<span class="med__ph"><svg><use href="#' + (c.art === 'video' ? 'i-play' : 'i-image') + '"/></svg></span>';
    return '<article class="med" data-inhalt="' + esc(c.id) + '">' +
      '<div class="med__bild">' + bild +
        '<span class="med__art"><svg><use href="#' + (c.art === 'video' ? 'i-play' : 'i-image') + '"/></svg>' +
        (c.art === 'video' ? 'Video' : 'Bild') + '</span>' +
      '</div>' +
      '<div class="med__txt">' +
        '<div class="med__kopf"><h3>' + esc(c.titel || c.dateiname) + '</h3>' + inhaltTag(c) + '</div>' +
        (mitPartner && p ? '<p class="small muted">' + esc(p.name) + ' · ' + esc(p.firma) + '</p>' : '') +
        '<p class="small muted">' + esc(c.dateiname) + ' · ' + mb(c.groesse) +
          (c.dauer ? ' · ' + dauerText(c.dauer) : '') + ' · ' + datum(c.hochgeladen) + '</p>' +
        (c.hinweis ? '<p class="med__hinweis">' + esc(c.hinweis) + '</p>' : '') +
        (c.status === 'frei' && REGELN.materialpraemie[c.art]
          ? '<p class="small"><strong>' + eur(REGELN.materialpraemie[c.art]) + '</strong> Materialprämie gutgeschrieben</p>' : '') +
        (c.status === 'abgelehnt' && c.entscheidung
          ? '<div class="med__grund"><strong>Warum wir es nicht verwenden:</strong> ' + esc(c.entscheidung) + '</div>' : '') +
        (mitAktionen
          ? '<div class="med__act">' +
            '<button class="btn btn--sm btn--ok" type="button" data-inh-frei="' + esc(c.id) + '"><svg><use href="#i-check"/></svg>Freigeben</button>' +
            '<button class="btn btn--sm btn--danger" type="button" data-inh-ab="' + esc(c.id) + '"><svg><use href="#i-x"/></svg>Ablehnen</button>' +
            '</div>' : '') +
      '</div></article>';
  }

  // ---------------------------------------------------------------
  // 9. Partner-Ansichten
  // ---------------------------------------------------------------
  function seiteUebersicht() {
    var p = partnerVon(sitzung.partnerId);
    var a = berechnePartner(p.id);
    var n = a.naechste;

    var fortschritt = '';
    if (n) {
      var fehlt = [];
      if (n.fehltBestellungen > 0) fehlt.push(n.fehltBestellungen + ' Bestellungen');
      if (n.fehltUmsatz > 0) fehlt.push(eur(n.fehltUmsatz) + ' Umsatz');
      fortschritt =
        '<div class="bar"><span class="bar__f" style="width:' + (n.anteil * 100).toFixed(1) + '%"></span></div>' +
        '<div class="bar__t"><span>' + esc(a.stufe.name) + ' · ' + (a.stufe.satz * 100) + ' %</span>' +
        '<span>' + esc(n.ziel.name) + ' · ' + (n.ziel.satz * 100) + ' %</span></div>' +
        '<p class="small muted mt">Dir fehlen noch ' + fehlt.join(' <em>oder</em> ') + ', dann bist du ' + esc(n.ziel.name) + '.</p>';
    } else {
      fortschritt = '<p class="small muted mt">Du bist Wegbereiter – das ist die höchste Stufe. Danke dafür.</p>';
    }

    var letzte = a.bestellungen.slice(0, 5);

    return '' +
    '<div class="head"><div><h1>Moin, ' + esc(p.name.split(' ')[0]) + '</h1>' +
    '<p>Dein Partnerkonto seit ' + datum(p.seit) + ' · Partnernummer ' + esc(p.id) + '</p></div>' +
    '<div class="stufe"><span class="stufe__badge"><svg width="14" height="14"><use href="#i-check"/></svg>' +
    esc(a.stufe.name) + ' · ' + (a.stufe.satz * 100) + ' %</span></div></div>' +

    '<div class="kpis">' +
      kpi('Vermittelte Bestellungen', a.anzahl, a.stornos ? a.stornos + ' storniert' : 'keine Stornos') +
      kpi('Vermittelter Umsatz', eur(a.umsatzNetto), 'netto, nach deinem Kundenrabatt') +
      kpi('Auszahlbar', eur(a.provAuszahlbar), 'nächste Zahlung am 15.', true) +
      kpi('In Prüfung', eur(a.provPruefung), 'bis die Widerrufsfrist um ist') +
    '</div>' +

    '<div class="grid2">' +
      '<div class="card"><div class="card__hd"><div><h2>Deine Stufe</h2>' +
      '<p>Deine Beteiligung steigt automatisch, sobald du eine Schwelle erreichst.</p></div></div>' +
      fortschritt + '</div>' +

      '<div class="card"><div class="card__hd"><div><h2>Dein Empfehlungscode</h2>' +
      '<p>Funktioniert im Gespräch und im Shop. Deine Kundschaft spart 10 %.</p></div></div>' +
      '<div class="codebox"><code class="codebox__c" id="mein-code">' + esc(p.code) + '</code>' +
      '<button class="btn btn--sm btn--ghost" type="button" data-copy="' + esc(p.code) + '">' +
      '<svg><use href="#i-copy"/></svg>Kopieren</button></div>' +
      '<p class="small muted mt">Dein Empfehlungslink:<br><code>natureflow-pets.com/?ref=' + esc(p.code.toLowerCase()) + '</code></p>' +
      '</div>' +
    '</div>' +

    '<div class="grid2">' +
      '<div class="card"><div class="card__hd"><div><h2>Deine Inhalte</h2>' +
      '<p>Bilder und Videos, die wir mit deiner Erlaubnis verwenden dürfen.</p></div>' +
      '<button class="btn btn--sm btn--ghost" type="button" data-goto="inhalte">Hochladen</button></div>' +
      '<div class="minis">' +
        '<div class="mini"><span class="mini__v">' + a.inhalteFrei + '</span><span class="mini__l">freigegeben</span></div>' +
        '<div class="mini"><span class="mini__v">' + a.inhaltePruefung + '</span><span class="mini__l">in Prüfung</span></div>' +
        '<div class="mini"><span class="mini__v">' + eur(a.praemien) + '</span><span class="mini__l">Materialprämie</span></div>' +
      '</div></div>' +

      '<div class="card"><div class="card__hd"><div><h2>Deine Profile</h2>' +
      '<p>Danach richtet sich, welche Inhalte wir bei dir anfragen.</p></div>' +
      '<button class="btn btn--sm btn--ghost" type="button" data-goto="profil">Bearbeiten</button></div>' +
      socialChips(p.social) +
      '<p class="small muted mt">Gesamtreichweite nach deinen Angaben: <strong>' + kurz(a.reichweite) + '</strong></p>' +
      '</div>' +
    '</div>' +

    '<div class="card"><div class="card__hd"><div><h2>Zuletzt vermittelt</h2></div>' +
    '<button class="btn btn--sm btn--ghost" type="button" data-goto="bestellungen">Alle ansehen</button></div>' +
    tabelleBestellungen(letzte) + '</div>' +

    '<div class="note">Alle Angaben sind Demodaten eines Prototyps. Beträge, Bestellungen und Auszahlungen sind erfunden und dienen nur der Ansicht.</div>';
  }

  function tabelleBestellungen(liste) {
    if (!liste.length) return '<div class="empty"><h3>Noch keine Bestellungen</h3><p>Sobald jemand deinen Code nutzt, erscheint die Bestellung hier.</p></div>';
    return '<div class="tblwrap"><table class="tbl">' +
      '<thead><tr><th>Bestellung</th><th>Datum</th><th class="num">Warenwert netto</th>' +
      '<th class="num">Satz</th><th class="num">Deine Beteiligung</th><th>Status</th></tr></thead><tbody>' +
      liste.map(function (b) {
        return '<tr data-bestellung="' + esc(b.id) + '"><td><code>' + esc(b.id) + '</code>' +
          (b.folgekauf ? '<br><span class="small muted">Folgebestellung · halber Satz</span>' : '') + '</td>' +
          '<td>' + datum(b.datum) + '</td>' +
          '<td class="num">' + eur(b.netto) + '</td>' +
          '<td class="num">' + (b.satz * 100) + ' %' + (b.folgekauf ? ' ÷ 2' : '') + '</td>' +
          '<td class="num"><strong>' + eur(b.provision) + '</strong></td>' +
          '<td>' + statusTag(b) + (b.status === 'in-pruefung' ? '<br><span class="small muted">noch ' + b.auszahlbarInTagen + ' Tage</span>' : '') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  function seiteBestellungen() {
    var a = berechnePartner(sitzung.partnerId);
    return '<div class="head"><div><h1>Bestellungen</h1>' +
      '<p>Jede Bestellung, die über deinen Code oder deinen Link zustande kam.</p></div></div>' +
      '<div class="kpis">' +
        kpi('Gesamt', a.anzahl + a.stornos, a.stornos + ' davon storniert') +
        kpi('Beteiligung gesamt', eur(a.provGesamt), 'einschließlich schon ausgezahlt') +
        kpi('Auszahlbar', eur(a.provAuszahlbar), 'inkl. Materialprämie', true) +
      '</div>' +
      '<div class="card">' + tabelleBestellungen(a.bestellungen) + '</div>' +
      '<div class="note"><strong>Warum manche Bestellungen den halben Satz haben:</strong> Bestellt dieselbe Kundin oder derselbe Kunde erneut, ' +
      'vergüten wir dauerhaft die Hälfte – auch ohne deinen Code. So lohnt sich deine Betreuung, ohne dass wir Bestandskunden doppelt bezahlen. ' +
      '<strong>Stornierte Bestellungen</strong> entstehen bei Widerruf oder Rücksendung – dafür entfällt die Beteiligung.</div>';
  }

  function seiteAuszahlungen() {
    var p = partnerVon(sitzung.partnerId);
    var a = berechnePartner(p.id);
    var liste = Z.auszahlungen.filter(function (x) { return x.partnerId === p.id; })
                              .sort(function (x, y) { return new Date(y.datum) - new Date(x.datum); });
    return '<div class="head"><div><h1>Auszahlungen</h1>' +
      '<p>Monatlich zum 15. für den Vormonat, ab ' + eur(REGELN.mindestauszahlung) + ' Guthaben.</p></div></div>' +
      '<div class="kpis">' +
        kpi('Schon ausgezahlt', eur(a.ausgezahlt), liste.length + ' Zahlungen') +
        kpi('Offen und auszahlbar', eur(a.provAuszahlbar), 'Beteiligung + Prämien', true) +
        kpi('Noch in Prüfung', eur(a.provPruefung), 'Widerrufsfrist läuft') +
      '</div>' +
      '<div class="card"><div class="card__hd"><div><h2>Woraus sich dein Guthaben zusammensetzt</h2></div></div>' +
      '<div class="tblwrap"><table class="tbl" style="min-width:0"><tbody>' +
      '<tr><th>Beteiligung an Bestellungen</th><td class="num">' + eur(a.provGesamt) + '</td></tr>' +
      '<tr><th>Materialprämie für ' + a.inhalteFrei + ' freigegebene Inhalte</th><td class="num">' + eur(a.praemien) + '</td></tr>' +
      '<tr><th>Bereits ausgezahlt</th><td class="num">− ' + eur(a.ausgezahlt) + '</td></tr>' +
      '<tr><th>Noch gesperrt (Widerrufsfrist)</th><td class="num">− ' + eur(a.provPruefung) + '</td></tr>' +
      '<tr><th><strong>Auszahlbar</strong></th><td class="num"><strong>' + eur(a.provAuszahlbar) + '</strong></td></tr>' +
      '</tbody></table></div></div>' +
      '<div class="card"><div class="card__hd"><div><h2>Deine bisherigen Gutschriften</h2></div></div>' +
      (liste.length ?
        '<div class="tblwrap"><table class="tbl"><thead><tr><th>Beleg</th><th>Zeitraum</th><th>Datum</th><th class="num">Betrag</th><th></th></tr></thead><tbody>' +
        liste.map(function (x) {
          return '<tr><td><code>' + esc(x.id) + '</code></td><td>' + esc(x.zeitraum) + '</td><td>' + datum(x.datum) + '</td>' +
                 '<td class="num"><strong>' + eur(x.betrag) + '</strong></td>' +
                 '<td class="num"><button class="btn btn--sm btn--ghost" type="button" data-beleg="' + esc(x.id) + '"><svg><use href="#i-dl"/></svg>Gutschrift</button></td></tr>';
        }).join('') + '</tbody></table></div>'
        : '<div class="empty"><h3>Noch keine Auszahlung</h3></div>') +
      '</div>' +
      '<div class="note"><strong>Du musst keine Rechnung schreiben.</strong> Wir rechnen im Gutschriftverfahren nach § 14 Abs. 2 UStG ab und legen dir die Abrechnung hier ab.' +
      (p.kleinunternehmer ? ' Für dich weisen wir keine Umsatzsteuer aus (Kleinunternehmerregelung nach § 19 UStG).' : '') + '</div>';
  }

  function seiteMaterial() {
    var dateien = [
      ['Produktübersicht und Zusammensetzung', 'PDF · 8 Seiten'],
      ['Dosierungstabelle nach Gewichtsklasse', 'PDF · 2 Seiten'],
      ['Studienlage Grünlippmuschel und Kollagen', 'PDF · 14 Seiten'],
      ['Produktfotos für deine Website', 'ZIP · 12 Bilder'],
      ['Kartenaufsteller für deinen Beratungsraum', 'PDF · Druckvorlage']
    ];
    return '<div class="head"><div><h1>Material & Texte</h1>' +
      '<p>Fachunterlagen für deine Beratung – und geprüfte Formulierungen, die du bedenkenlos verwenden darfst.</p></div></div>' +

      '<div class="card"><div class="card__hd"><div><h2>Zum Herunterladen</h2></div></div>' +
      '<div class="files">' + dateien.map(function (d) {
        return '<div class="file"><svg><use href="#i-doc"/></svg><div><p class="file__n">' + esc(d[0]) + '</p>' +
               '<p class="file__m">' + esc(d[1]) + '</p></div>' +
               '<button class="btn btn--sm btn--ghost" type="button" data-datei="' + esc(d[0]) + '"><svg><use href="#i-dl"/></svg>Laden</button></div>';
      }).join('') + '</div></div>' +

      '<div class="card"><div class="card__hd"><div><h2>Was du sagen darfst</h2>' +
      '<p>Unsere Produkte sind Ergänzungsfuttermittel, keine Arzneimittel. Krankheitsbezogene Aussagen sind gesetzlich untersagt – auch gut gemeinte.</p></div></div>' +
      '<h3 class="mt">Passt</h3>' +
      ['zur Unterstützung gesunder Gelenke',
       'trägt zur normalen Gelenkfunktion bei',
       'unterstützt die Beweglichkeit',
       'mit Grünlippmuschel, Glucosamin und MSM',
       'begleitend zu Bewegung und passender Ernährung'
      ].map(function (s) { return '<p class="satz satz--ja">„' + esc(s) + '"</p>'; }).join('') +
      '<h3 class="mt">Bitte nicht</h3>' +
      ['hilft bei Arthrose',
       'lindert Gelenkschmerzen',
       'entzündungshemmend',
       'bei Lahmheit oder Gelenksteifigkeit',
       'beugt Gelenkschäden vor',
       'unterstützend bei Hüftgelenksdysplasie'
      ].map(function (s) { return '<p class="satz satz--nein">„' + esc(s) + '"</p>'; }).join('') +
      '<div class="note mt">Auch Abschwächungen wie „unterstützend bei" oder „begleitend bei" gelten rechtlich als krankheitsbezogen. ' +
      'Wenn du unsicher bist, frag uns – wir formulieren das gern gemeinsam. Das gilt genauso für alles, was du uns als Video schickst.</div>' +
      '</div>';
  }

  // ---------------- Inhalte: Partnersicht ----------------
  function seiteInhaltePartner() {
    var p = partnerVon(sitzung.partnerId);
    var a = berechnePartner(p.id);
    var meine = Z.inhalte.filter(function (c) { return c.partnerId === p.id; })
                         .sort(function (x, y) { return new Date(y.hochgeladen) - new Date(x.hochgeladen); });

    return '<div class="head"><div><h1>Meine Inhalte</h1>' +
      '<p>Lade Bilder und Videos aus deinem Alltag hoch. Wir schauen sie durch und dürfen sie – wenn du zustimmst – für unsere Kanäle nutzen.</p></div></div>' +

      '<div class="kpis">' +
        kpi('Hochgeladen', a.inhalteGesamt, 'insgesamt') +
        kpi('Freigegeben', a.inhalteFrei, 'dürfen wir verwenden') +
        kpi('In Prüfung', a.inhaltePruefung, 'meist innerhalb von 3 Werktagen') +
        kpi('Materialprämie', eur(a.praemien), 'fließt in deine Auszahlung', true) +
      '</div>' +

      '<div class="card"><div class="card__hd"><div><h2>Neu hochladen</h2>' +
      '<p>Bilder als JPG oder PNG, Videos als MP4 oder MOV – bis ' + REGELN.maxDateiMB + ' MB pro Datei.</p></div></div>' +

      '<div class="drop" id="drop" tabindex="0" role="button" aria-label="Dateien auswählen oder hierher ziehen">' +
        '<svg class="drop__i"><use href="#i-upload"/></svg>' +
        '<p class="drop__t">Dateien hierher ziehen</p>' +
        '<p class="small muted">oder <span class="drop__link">auswählen</span></p>' +
        '<input type="file" id="datei" accept="image/*,video/*" multiple hidden>' +
      '</div>' +
      '<div id="warteschlange" class="queue" hidden></div>' +

      '<div class="fld mt"><label for="c-titel">Worum geht es? (gilt für die Auswahl)</label>' +
      '<input id="c-titel" type="text" placeholder="Zum Beispiel: Aufwärmübungen vor dem Spaziergang"></div>' +
      '<div class="fld"><label for="c-hinweis">Möchtest du uns etwas dazu sagen? (freiwillig)</label>' +
      '<textarea id="c-hinweis" style="min-height:80px" placeholder="Wo aufgenommen, wer ist zu sehen, worauf sollen wir achten?"></textarea></div>' +

      '<label class="check" for="c-rechte"><input type="checkbox" id="c-rechte"><span>' +
      'Ich habe die Aufnahmen selbst gemacht und darf über sie verfügen. Ich räume NatureFlow Pets ein einfaches, ' +
      'zeitlich und räumlich unbeschränktes Nutzungsrecht für Website, Shop, Newsletter, Social Media und Werbung ein. ' +
      'Abgebildete Personen sind einverstanden, fremde Musik ist nicht enthalten. *</span></label>' +

      '<div id="c-fehler" class="msg msg--err" hidden role="alert"></div>' +
      '<button class="btn btn--primary" type="button" id="btn-upload" style="margin-top:1rem"><svg><use href="#i-upload"/></svg>Zur Prüfung schicken</button>' +
      '</div>' +

      '<div class="note"><strong>Was wir gut gebrauchen können:</strong> echte Situationen aus deinem Alltag – Übungen, Handgriffe, ' +
      'ein Hund im Verlauf, dein Beratungsraum. <strong>Was wir nicht verwenden dürfen:</strong> alles mit Krankheitsbegriffen ' +
      '(„Arthrose", „Schmerzen", „Entzündung"), fremde Musik, erkennbare Personen ohne deren Einverständnis, fremde Marken im Bild.' +
      '</div>' +

      (REGELN.praemieVorschlag
        ? '<div class="note note--warn"><strong>Noch nicht entschieden:</strong> Die Materialprämie von ' +
          eur(REGELN.materialpraemie.bild) + ' je Bild und ' + eur(REGELN.materialpraemie.video) +
          ' je Video ist ein Vorschlag aus dem Prototyp. Ob und in welcher Höhe es sie gibt, entscheidet die Geschäftsführung.</div>'
        : '') +

      '<h2 class="mt" style="margin-top:2.2rem">Deine Uploads</h2>' +
      (meine.length
        ? '<div class="medgrid">' + meine.map(function (c) { return inhaltKachel(c, false, false); }).join('') + '</div>'
        : '<div class="card"><div class="empty"><h3>Noch nichts hochgeladen</h3>' +
          '<p>Ein Foto vom Beratungsalltag reicht für den Anfang.</p></div></div>');
  }

  // ---------------- Profil: Partnersicht ----------------
  function seiteProfil() {
    var p = partnerVon(sitzung.partnerId);
    var reich = reichweiteVon(p);

    return '<div class="head"><div><h1>Mein Profil</h1>' +
      '<p>Deine Stammdaten, deine Profile und deine Auszahlungsdaten. Änderungen sehen wir sofort.</p></div></div>' +

      '<div class="grid2">' +
      '<div class="card"><div class="card__hd"><div><h2>Stammdaten</h2></div></div>' +
        '<div class="fld"><label for="p-name">Name</label><input id="p-name" type="text" value="' + esc(p.name) + '"></div>' +
        '<div class="fld"><label for="p-firma">Praxis, Firma oder Tätigkeitsname</label><input id="p-firma" type="text" value="' + esc(p.firma) + '"></div>' +
        '<div class="fld"><label for="p-strasse">Straße und Hausnummer</label><input id="p-strasse" type="text" value="' + esc(p.strasse || '') + '"></div>' +
        '<div class="row2">' +
          '<div class="fld"><label for="p-plz">PLZ</label><input id="p-plz" type="text" value="' + esc(p.plz || '') + '"></div>' +
          '<div class="fld"><label for="p-ort">Ort</label><input id="p-ort" type="text" value="' + esc(p.ort || '') + '"></div>' +
        '</div>' +
        '<div class="fld"><label for="p-tel">Telefon</label><input id="p-tel" type="tel" value="' + esc(p.telefon || '') + '"></div>' +
        '<div class="fld"><label for="p-web">Website</label><input id="p-web" type="url" value="' + esc(p.website || '') + '"></div>' +
      '</div>' +

      '<div class="card"><div class="card__hd"><div><h2>Auszahlung & Steuer</h2>' +
      '<p>Wir rechnen im Gutschriftverfahren ab – du musst keine Rechnung schreiben.</p></div></div>' +
        '<div class="fld"><label for="p-inh">Kontoinhaber</label><input id="p-inh" type="text" value="' + esc(p.bankInhaber || '') + '"></div>' +
        '<div class="fld"><label for="p-iban">IBAN</label><input id="p-iban" type="text" value="' + esc(p.iban || '') + '"></div>' +
        '<label class="check" for="p-klein"><input type="checkbox" id="p-klein"' + (p.kleinunternehmer ? ' checked' : '') + '>' +
        '<span>Ich bin Kleinunternehmerin oder Kleinunternehmer nach § 19 UStG – bitte keine Umsatzsteuer ausweisen.</span></label>' +
        '<div class="note mt">Deine Bankdaten sehen nur du und unsere Buchhaltung. Im Prototyp bleiben sie in diesem Browser.</div>' +
      '</div>' +
      '</div>' +

      '<div class="card"><div class="card__hd"><div><h2>Deine Profile und deine Reichweite</h2>' +
      '<p>Freiwillig. Wir nutzen das nur, um passende Anfragen an dich zu richten – für die Aufnahme ins Programm spielt Reichweite keine Rolle.</p></div>' +
      '<span class="stufe__badge stufe__badge--ruhig">Reichweite ' + kurz(reich) + '</span></div>' +
      '<div id="social-liste">' + socialZeilen(p.social) + '</div>' +
      '<button class="btn btn--sm btn--ghost" type="button" id="btn-social-plus" style="margin-top:.8rem">Profil hinzufügen</button>' +
      '</div>' +

      '<div id="p-ok" class="msg msg--ok" hidden role="status"></div>' +
      '<button class="btn btn--primary" type="button" id="btn-profil-speichern"><svg><use href="#i-check"/></svg>Änderungen speichern</button>';
  }

  function socialZeilen(social) {
    social = social || [];
    if (!social.length) social = [{ netz: '', handle: '', follower: '', url: '' }];
    return social.map(function (s, i) {
      return '<div class="socrow" data-soc="' + i + '">' +
        '<div class="fld"><label for="s-netz-' + i + '">Netzwerk</label>' +
        '<select id="s-netz-' + i + '">' + '<option value="">Bitte wählen</option>' +
        NETZE.map(function (n) { return '<option' + (n === s.netz ? ' selected' : '') + '>' + esc(n) + '</option>'; }).join('') +
        '</select></div>' +
        '<div class="fld"><label for="s-handle-' + i + '">Profilname</label>' +
        '<input id="s-handle-' + i + '" type="text" value="' + esc(s.handle || '') + '" placeholder="@meinprofil"></div>' +
        '<div class="fld"><label for="s-foll-' + i + '">Follower</label>' +
        '<input id="s-foll-' + i + '" type="number" min="0" step="1" value="' + esc(s.follower || '') + '" placeholder="z. B. 2400"></div>' +
        '<div class="fld"><label for="s-url-' + i + '">Link</label>' +
        '<input id="s-url-' + i + '" type="url" value="' + esc(s.url || '') + '" placeholder="https://"></div>' +
        '<button class="iconbtn socrow__x" type="button" data-soc-weg="' + i + '" aria-label="Profil entfernen">' +
        '<svg viewBox="0 0 24 24" width="18" height="18"><use href="#i-x"/></svg></button>' +
        '</div>';
    }).join('');
  }

  function leseSocial() {
    return alle('.socrow').map(function (row) {
      var i = row.getAttribute('data-soc');
      var netz = el('#s-netz-' + i).value;
      var handle = el('#s-handle-' + i).value.trim();
      var foll = parseInt(el('#s-foll-' + i).value, 10);
      var url = el('#s-url-' + i).value.trim();
      if (!netz && !handle) return null;
      return { netz: netz || 'Sonstiges', handle: handle, follower: isNaN(foll) ? 0 : Math.max(0, foll), url: url };
    }).filter(Boolean);
  }

  // ---------------------------------------------------------------
  // 10. Verwaltungs-Ansichten
  // ---------------------------------------------------------------
  var filterBewerbung = '';
  var filterPartner = '';
  var filterMedien = 'pruefung';
  var zeitraumTage = 0;

  function seiteBewerbungen() {
    var such = filterBewerbung.toLowerCase();
    function passt(b) {
      if (!such) return true;
      return (b.name + ' ' + b.firma + ' ' + b.email + ' ' + (b.ort || '') + ' ' + b.taetigkeit).toLowerCase().indexOf(such) >= 0;
    }
    var offen = Z.bewerbungen.filter(function (b) { return b.status === 'offen'; }).filter(passt);
    var erledigt = Z.bewerbungen.filter(function (b) { return b.status !== 'offen'; }).filter(passt)
                                .sort(function (a, b) { return new Date(b.entschiedenAm || b.eingang) - new Date(a.entschiedenAm || a.eingang); });

    return '<div class="head"><div><h1>Bewerbungen</h1>' +
      '<p>Jede Bewerbung wird persönlich geprüft. Wer aufgenommen wird, spricht später mit unserer Stimme.</p></div>' +
      '<div class="suche"><svg><use href="#i-search"/></svg>' +
      '<input type="search" id="such-bewerbung" placeholder="Name, Betrieb, Ort …" value="' + esc(filterBewerbung) + '" aria-label="Bewerbungen durchsuchen"></div></div>' +

      '<div class="kpis">' +
        kpi('Offen', offeneBewerbungen().length, offeneBewerbungen().length ? 'wartet auf Prüfung' : 'nichts zu tun', offeneBewerbungen().length > 0) +
        kpi('Angenommen', Z.bewerbungen.filter(function (b) { return b.status === 'angenommen'; }).length, 'insgesamt') +
        kpi('Abgelehnt', Z.bewerbungen.filter(function (b) { return b.status === 'abgelehnt'; }).length, 'insgesamt') +
      '</div>' +

      '<h2 class="mt">Zu prüfen</h2>' +
      (offen.length ? offen.map(bewerbungKarte).join('') :
        '<div class="card"><div class="empty"><h3>' + (filterBewerbung ? 'Kein Treffer' : 'Alles bearbeitet') + '</h3>' +
        '<p>' + (filterBewerbung ? 'Für diese Suche liegt keine offene Bewerbung vor.' : 'Derzeit liegt keine offene Bewerbung vor.') + '</p></div></div>') +

      '<h2 class="mt" style="margin-top:2.2rem">Bereits entschieden</h2>' +
      '<div class="tblwrap"><table class="tbl"><thead><tr><th>Name</th><th>Betrieb</th><th>Profile</th><th>Eingang</th><th>Status</th><th>Begründung</th></tr></thead><tbody>' +
      (erledigt.length ? erledigt.map(function (b) {
        return '<tr><td>' + esc(b.name) + '</td><td>' + esc(b.firma) + '</td>' +
          '<td>' + socialChips(b.social, true, 2) + '</td>' +
          '<td>' + datum(b.eingang) + '</td>' +
          '<td>' + (b.status === 'angenommen' ? tag('ok', 'angenommen', 'i-check') : tag('err', 'abgelehnt', 'i-x')) + '</td>' +
          '<td class="small">' + esc(b.entscheidung || '—') + '</td></tr>';
      }).join('') : '<tr><td colspan="6" class="muted">Noch keine Entscheidungen.</td></tr>') +
      '</tbody></table></div>';
  }

  function bewerbungKarte(b) {
    var reich = (b.social || []).reduce(function (s, x) { return s + (x.follower || 0); }, 0);
    return '<article class="bewerb" data-bewerbung="' + esc(b.id) + '">' +
      '<div class="bewerb__hd"><div><h3>' + esc(b.name) + '</h3>' +
      '<p class="bewerb__meta">' + esc(b.firma) + (b.ort ? ' · ' + esc(b.ort) : '') + ' · Eingang ' + datum(b.eingang) +
      (b.ausFormular ? ' · <strong>über das Formular</strong>' : '') + '</p></div>' +
      tag('warn', 'offen') + '</div>' +
      '<dl class="dl mt">' +
      '<dt>E-Mail</dt><dd>' + esc(b.email) + '</dd>' +
      (b.telefon ? '<dt>Telefon</dt><dd>' + esc(b.telefon) + '</dd>' : '') +
      (b.website ? '<dt>Website</dt><dd><a href="' + esc(b.website) + '" target="_blank" rel="noopener noreferrer">' + esc(b.website) + '</a></dd>' : '') +
      '<dt>Empfehlungsweg</dt><dd>' + esc(b.weg || '—') + '</dd>' +
      (b.kunden ? '<dt>Beratungen im Monat</dt><dd>' + esc(b.kunden) + '</dd>' : '') +
      '<dt>Umsatzsteuer</dt><dd>' + (b.kleinunternehmer ? 'Kleinunternehmer nach § 19 UStG' : 'regelbesteuert') + '</dd>' +
      '<dt>Profile</dt><dd>' + socialChips(b.social) +
        (reich ? '<p class="small muted" style="margin-top:.4rem">Angegebene Reichweite zusammen: <strong>' + kurz(reich) + '</strong></p>' : '') + '</dd>' +
      '<dt>Nachweise</dt><dd>' + (b.nachweise && b.nachweise.length
        ? '<div class="nw">' + b.nachweise.map(function (n) {
            return '<button class="nw__f" type="button" data-nachweis="' + esc(n.name) + '">' +
              '<svg><use href="#i-doc"/></svg><span>' + esc(n.name) + '</span>' +
              '<span class="small muted">' + mb(n.groesse) + '</span></button>';
          }).join('') + '</div>'
        : '<span class="small muted">keine hochgeladen</span>') + '</dd>' +
      '</dl>' +
      '<p class="bewerb__txt">' + esc(b.taetigkeit) + '</p>' +
      (b.nachricht ? '<p class="bewerb__txt"><strong>Nachricht:</strong> ' + esc(b.nachricht) + '</p>' : '') +
      '<div class="bewerb__act">' +
      '<button class="btn btn--sm btn--ok" type="button" data-annehmen="' + esc(b.id) + '"><svg><use href="#i-check"/></svg>Annehmen</button>' +
      '<button class="btn btn--sm btn--danger" type="button" data-ablehnen="' + esc(b.id) + '"><svg><use href="#i-x"/></svg>Ablehnen</button>' +
      '</div></article>';
  }

  // ---------------- Inhalte: Verwaltungssicht ----------------
  function seiteMedienAdmin() {
    var alleInh = Z.inhalte.slice().sort(function (x, y) { return new Date(y.hochgeladen) - new Date(x.hochgeladen); });
    var gefiltert = filterMedien === 'alle' ? alleInh : alleInh.filter(function (c) { return c.status === filterMedien; });
    var frei = alleInh.filter(function (c) { return c.status === 'frei'; });
    var praemieSumme = frei.reduce(function (s, c) { return s + (REGELN.materialpraemie[c.art] || 0); }, 0);

    function knopf(wert, text) {
      return '<button class="filt' + (filterMedien === wert ? ' filt--an' : '') + '" type="button" data-medfilter="' + wert + '">' + text + '</button>';
    }

    return '<div class="head"><div><h1>Inhalte</h1>' +
      '<p>Bilder und Videos, die Partner hochgeladen haben. Freigegebene Inhalte dürfen wir verwenden – die Rechte hat der Partner beim Hochladen eingeräumt.</p></div></div>' +

      '<div class="kpis">' +
        kpi('In Prüfung', offeneInhalte().length, offeneInhalte().length ? 'wartet auf dich' : 'nichts zu tun', offeneInhalte().length > 0) +
        kpi('Freigegeben', frei.length, frei.filter(function (c) { return c.art === 'video'; }).length + ' Videos, ' +
            frei.filter(function (c) { return c.art === 'bild'; }).length + ' Bilder') +
        kpi('Abgelehnt', alleInh.filter(function (c) { return c.status === 'abgelehnt'; }).length, 'mit Begründung') +
        kpi('Materialprämie gesamt', eur(praemieSumme), REGELN.praemieVorschlag ? 'Vorschlag, noch nicht entschieden' : 'gutgeschrieben') +
      '</div>' +

      '<div class="filts">' + knopf('pruefung', 'In Prüfung') + knopf('frei', 'Freigegeben') +
      knopf('abgelehnt', 'Abgelehnt') + knopf('alle', 'Alle') + '</div>' +

      (gefiltert.length
        ? '<div class="medgrid">' + gefiltert.map(function (c) {
            return inhaltKachel(c, true, c.status === 'pruefung');
          }).join('') + '</div>'
        : '<div class="card"><div class="empty"><h3>Nichts in dieser Ansicht</h3>' +
          '<p>Für diesen Filter liegt gerade kein Inhalt vor.</p></div></div>') +

      '<div class="note mt"><strong>Worauf beim Prüfen zu achten ist:</strong> krankheitsbezogene Aussagen im Ton oder im Bild ' +
      '(„Arthrose", „Schmerzen", „entzündungshemmend"), fremde Musik, erkennbare Personen ohne Einwilligung, fremde Marken im Bild. ' +
      'Bei Ablehnung ist die Begründung Pflicht – sie geht so an den Partner.</div>';
  }

  function seitePartner() {
    var such = filterPartner.toLowerCase();
    var zeilen = Z.partner.map(function (p) {
      return { p: p, a: berechnePartner(p.id) };
    }).filter(function (r) {
      if (!such) return true;
      return (r.p.name + ' ' + r.p.firma + ' ' + r.p.code + ' ' + (r.p.ort || '')).toLowerCase().indexOf(such) >= 0;
    }).sort(function (x, y) { return y.a.umsatzNetto - x.a.umsatzNetto; });

    return '<div class="head"><div><h1>Partner</h1><p>' + Z.partner.length + ' aufgenommene Partner. Klick auf eine Zeile für alle Angaben.</p></div>' +
      '<div class="head__act">' +
      '<div class="suche"><svg><use href="#i-search"/></svg>' +
      '<input type="search" id="such-partner" placeholder="Name, Betrieb, Code …" value="' + esc(filterPartner) + '" aria-label="Partner durchsuchen"></div>' +
      '<button class="btn btn--sm btn--ghost" type="button" id="btn-export"><svg><use href="#i-dl"/></svg>CSV</button></div></div>' +

      '<div class="tblwrap"><table class="tbl"><thead><tr>' +
      '<th>Partner</th><th>Code</th><th>Profile</th><th class="num">Reichweite</th><th>Stufe</th><th class="num">Bestellungen</th>' +
      '<th class="num">Umsatz netto</th><th class="num">Beteiligung</th><th>Letzte Vermittlung</th>' +
      '</tr></thead><tbody>' +
      (zeilen.length ? zeilen.map(function (r) {
        var inaktiv = r.a.tageInaktiv !== null && r.a.tageInaktiv > 90;
        return '<tr class="klick" data-partner="' + esc(r.p.id) + '" tabindex="0">' +
          '<td><strong>' + esc(r.p.name) + '</strong>' + (r.p.gesperrt ? ' ' + tag('err', 'gesperrt') : '') +
          '<br><span class="small muted">' + esc(r.p.firma) + '</span></td>' +
          '<td><code>' + esc(r.p.code) + '</code></td>' +
          '<td>' + socialChips(r.p.social, true, 2) + '</td>' +
          '<td class="num">' + (r.a.reichweite ? kurz(r.a.reichweite) : '—') + '</td>' +
          '<td>' + esc(r.a.stufe.name) + '<br><span class="small muted">' + (r.a.stufe.satz * 100) + ' %</span></td>' +
          '<td class="num">' + r.a.anzahl + (r.a.stornos ? '<br><span class="small muted">' + r.a.stornos + ' storniert</span>' : '') + '</td>' +
          '<td class="num">' + eur(r.a.umsatzNetto) + '</td>' +
          '<td class="num">' + eur(r.a.provGesamt) + '</td>' +
          '<td>' + (r.a.letzteBestellung ? datum(r.a.letzteBestellung) : '—') +
          (inaktiv ? '<br>' + tag('warn', 'seit ' + r.a.tageInaktiv + ' Tagen still') : '') + '</td></tr>';
      }).join('') : '<tr><td colspan="9" class="muted">Kein Partner passt zu dieser Suche.</td></tr>') +
      '</tbody></table></div>' +
      '<div class="note mt">Partner, die seit mehr als 90 Tagen nichts vermittelt haben, sind markiert. Erfahrungsgemäß fehlt dort schlicht Material – ein Anruf lohnt sich mehr als eine Erinnerungsmail.</div>';
  }

  function seitePartnerDetail() {
    var p = partnerVon(detailPartner);
    if (!p) return '<div class="empty"><h3>Partner nicht gefunden</h3></div>';
    var a = berechnePartner(p.id);
    var meine = Z.inhalte.filter(function (c) { return c.partnerId === p.id; })
                         .sort(function (x, y) { return new Date(y.hochgeladen) - new Date(x.hochgeladen); });
    var zahlungen = Z.auszahlungen.filter(function (x) { return x.partnerId === p.id; })
                                  .sort(function (x, y) { return new Date(y.datum) - new Date(x.datum); });

    return '<p><button class="linkbtn" type="button" data-goto="partner">&larr; Zurück zur Partnerliste</button></p>' +
      '<div class="head"><div><h1>' + esc(p.name) + '</h1>' +
      '<p>' + esc(p.firma) + (p.ort ? ' · ' + esc(p.ort) : '') + ' · Partner seit ' + datum(p.seit) + ' · ' + esc(p.id) + '</p></div>' +
      '<div class="head__act">' +
      '<span class="stufe__badge">' + esc(a.stufe.name) + ' · ' + (a.stufe.satz * 100) + ' %</span>' +
      '<button class="btn btn--sm ' + (p.gesperrt ? 'btn--ok' : 'btn--danger') + '" type="button" data-sperren="' + esc(p.id) + '">' +
      (p.gesperrt ? 'Wieder freischalten' : 'Sperren') + '</button></div></div>' +

      (p.gesperrt ? '<div class="msg msg--err">Dieser Partner ist gesperrt. Der Code ist im Shop deaktiviert, bereits verdiente Beteiligungen bleiben bestehen.</div>' : '') +
      (p.hinweis ? '<div class="note note--warn"><strong>Achtung:</strong> ' + esc(p.hinweis) + '</div>' : '') +

      '<div class="kpis">' +
        kpi('Bestellungen', a.anzahl, a.stornos + ' storniert') +
        kpi('Umsatz netto', eur(a.umsatzNetto), 'seit Aufnahme') +
        kpi('Beteiligung gesamt', eur(a.provGesamt), 'inkl. ausgezahlt') +
        kpi('Offen auszahlbar', eur(a.provAuszahlbar), 'inkl. Prämien', true) +
        kpi('Reichweite', a.reichweite ? kurz(a.reichweite) : '—', (p.social || []).length + ' Profile') +
      '</div>' +

      '<div class="grid2">' +
        '<div class="card"><div class="card__hd"><div><h2>Kontakt & Stammdaten</h2></div></div>' +
        '<dl class="dl">' +
        '<dt>E-Mail</dt><dd>' + esc(p.email) + '</dd>' +
        (p.telefon ? '<dt>Telefon</dt><dd>' + esc(p.telefon) + '</dd>' : '') +
        (p.strasse ? '<dt>Anschrift</dt><dd>' + esc(p.strasse) + '<br>' + esc(p.plz || '') + ' ' + esc(p.ort || '') + '</dd>' : '') +
        (p.website ? '<dt>Website</dt><dd><a href="' + esc(p.website) + '" target="_blank" rel="noopener noreferrer">' + esc(p.website) + '</a></dd>' : '') +
        '<dt>Code</dt><dd><code>' + esc(p.code) + '</code></dd>' +
        '<dt>Umsatzsteuer</dt><dd>' + (p.kleinunternehmer ? 'Kleinunternehmer nach § 19 UStG' : 'regelbesteuert') + '</dd>' +
        '<dt>Bankverbindung</dt><dd>' + esc(p.bankInhaber || '—') + '<br><span class="small muted">' + esc(p.iban || '') + '</span></dd>' +
        '</dl>' +
        '<p class="bewerb__txt">' + esc(p.taetigkeit || '') + '</p></div>' +

        '<div class="card"><div class="card__hd"><div><h2>Profile und Reichweite</h2>' +
        '<p>Selbst gepflegt im Partnerbereich. Zahlen sind Eigenangaben, nicht geprüft.</p></div></div>' +
        socialChips(p.social) +
        ((p.social || []).length
          ? '<div class="tblwrap mt"><table class="tbl" style="min-width:0"><thead><tr><th>Netzwerk</th><th>Profil</th><th class="num">Follower</th></tr></thead><tbody>' +
            p.social.map(function (s) {
              return '<tr><th>' + esc(s.netz) + '</th><td>' + (s.url
                ? '<a href="' + esc(s.url) + '" target="_blank" rel="noopener noreferrer">' + esc(s.handle) + '</a>'
                : esc(s.handle)) + '</td><td class="num">' + zahl(s.follower) + '</td></tr>';
            }).join('') + '</tbody></table></div>'
          : '') +
        '</div>' +
      '</div>' +

      '<div class="card"><div class="card__hd"><div><h2>Inhalte dieses Partners</h2>' +
      '<p>' + a.inhalteFrei + ' freigegeben · ' + a.inhaltePruefung + ' in Prüfung</p></div>' +
      '<button class="btn btn--sm btn--ghost" type="button" data-goto="medien">Alle Inhalte</button></div>' +
      (meine.length
        ? '<div class="medgrid">' + meine.map(function (c) { return inhaltKachel(c, false, c.status === 'pruefung'); }).join('') + '</div>'
        : '<div class="empty"><h3>Noch nichts hochgeladen</h3></div>') +
      '</div>' +

      '<div class="card"><div class="card__hd"><div><h2>Letzte Bestellungen</h2></div></div>' +
      tabelleBestellungen(a.bestellungen.slice(0, 8)) + '</div>' +

      '<div class="card"><div class="card__hd"><div><h2>Gutschriften</h2></div></div>' +
      (zahlungen.length
        ? '<div class="tblwrap"><table class="tbl"><thead><tr><th>Beleg</th><th>Zeitraum</th><th>Datum</th><th class="num">Betrag</th></tr></thead><tbody>' +
          zahlungen.map(function (x) {
            return '<tr><td><code>' + esc(x.id) + '</code></td><td>' + esc(x.zeitraum) + '</td><td>' + datum(x.datum) + '</td><td class="num"><strong>' + eur(x.betrag) + '</strong></td></tr>';
          }).join('') + '</tbody></table></div>'
        : '<div class="empty"><h3>Noch keine Auszahlung</h3></div>') +
      '</div>';
  }

  /** Partner, bei denen genug Guthaben für eine Auszahlung zusammengekommen ist. */
  function faelligeAuszahlungen() {
    return Z.partner.map(function (p) { return { p: p, a: berechnePartner(p.id) }; })
      .filter(function (r) { return r.a.provAuszahlbar >= REGELN.mindestauszahlung; });
  }

  function seiteAbrechnung() {
    var faellig = faelligeAuszahlungen();
    var unterGrenze = Z.partner.map(function (p) { return { p: p, a: berechnePartner(p.id) }; })
      .filter(function (r) { return r.a.provAuszahlbar > 0 && r.a.provAuszahlbar < REGELN.mindestauszahlung; });
    var summe = faellig.reduce(function (s, r) { return s + r.a.provAuszahlbar; }, 0);
    var jetzt = new Date();
    var vormonat = new Date(jetzt.getFullYear(), jetzt.getMonth() - 1, 1);
    var zeitraum = vormonat.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });

    return '<div class="head"><div><h1>Abrechnung</h1>' +
      '<p>Monatlicher Lauf: alle Partner mit mindestens ' + eur(REGELN.mindestauszahlung) + ' Guthaben bekommen eine Gutschrift. ' +
      'Beträge darunter bleiben stehen und wandern in den Folgemonat.</p></div></div>' +

      '<div class="kpis">' +
        kpi('Zur Auszahlung fällig', faellig.length + ' Partner', 'ab ' + eur(REGELN.mindestauszahlung)) +
        kpi('Auszahlungssumme', eur(summe), 'Beteiligung + Prämien', true) +
        kpi('Unter der Grenze', unterGrenze.length + ' Partner', 'wandern in den Folgemonat') +
        kpi('Abrechnungszeitraum', zeitraum, 'Vormonat') +
      '</div>' +

      '<div class="card"><div class="card__hd"><div><h2>Diese Gutschriften würden entstehen</h2>' +
      '<p>Gutschriftverfahren nach § 14 Abs. 2 UStG – der Partner schreibt keine Rechnung.</p></div>' +
      '<div class="head__act">' +
      '<button class="btn btn--sm btn--ghost" type="button" id="btn-sepa"><svg><use href="#i-dl"/></svg>Als CSV</button>' +
      '<button class="btn btn--sm btn--primary" type="button" id="btn-lauf"' + (faellig.length ? '' : ' disabled') + '>' +
      '<svg><use href="#i-check"/></svg>Lauf ausführen</button></div></div>' +

      (faellig.length
        ? '<div class="tblwrap"><table class="tbl"><thead><tr><th>Partner</th><th>Steuer</th><th>IBAN</th>' +
          '<th class="num">Beteiligung</th><th class="num">Prämien</th><th class="num">Auszahlung</th></tr></thead><tbody>' +
          faellig.map(function (r) {
            return '<tr><td><strong>' + esc(r.p.name) + '</strong><br><span class="small muted">' + esc(r.p.firma) + '</span></td>' +
              '<td class="small">' + (r.p.kleinunternehmer ? 'ohne USt (§ 19)' : '7 % USt') + '</td>' +
              '<td class="small"><code>' + esc(r.p.iban || '—') + '</code></td>' +
              '<td class="num">' + eur(r.a.provAuszahlbar - r.a.praemien > 0 ? r.a.provAuszahlbar - r.a.praemien : 0) + '</td>' +
              '<td class="num">' + eur(r.a.praemien) + '</td>' +
              '<td class="num"><strong>' + eur(r.a.provAuszahlbar) + '</strong></td></tr>';
          }).join('') +
          '<tr><th colspan="5">Zusammen</th><td class="num"><strong>' + eur(summe) + '</strong></td></tr>' +
          '</tbody></table></div>'
        : '<div class="empty"><h3>Nichts fällig</h3><p>Derzeit erreicht kein Partner die Auszahlungsgrenze von ' + eur(REGELN.mindestauszahlung) + '.</p></div>') +
      '</div>' +

      (unterGrenze.length
        ? '<div class="card"><div class="card__hd"><div><h2>Bleiben stehen</h2>' +
          '<p>Guthaben unter ' + eur(REGELN.mindestauszahlung) + ' – wird im nächsten Lauf mitgenommen.</p></div></div>' +
          '<div class="tblwrap"><table class="tbl" style="min-width:0"><tbody>' +
          unterGrenze.map(function (r) {
            return '<tr><th>' + esc(r.p.name) + '</th><td class="num">' + eur(r.a.provAuszahlbar) + '</td></tr>';
          }).join('') + '</tbody></table></div></div>'
        : '') +

      '<div class="note"><strong>Was der Prototyp nicht kann:</strong> Er erzeugt keine echten Gutschriftbelege mit Umsatzsteuerausweis ' +
      'und keine SEPA-Datei. Genau das kann auch keine der sechs geprüften Affiliate-Apps – die Abrechnung läuft in jedem Fall über ' +
      'Lexoffice oder DATEV. Der CSV-Export hier ist die Übergabestelle dorthin.</div>';
  }

  function seiteAuswertung() {
    var daten = Z.partner.map(function (p) { return { p: p, a: berechnePartner(p.id) }; });
    var zr = daten.map(function (r) { return { p: r.p, a: r.a, z: imZeitraum(r.a, zeitraumTage) }; });

    var gesamtUmsatz = zr.reduce(function (s, r) { return s + r.z.umsatz; }, 0);
    var gesamtProv = zr.reduce(function (s, r) { return s + r.z.provision; }, 0);
    var gesamtBest = zr.reduce(function (s, r) { return s + r.z.anzahl; }, 0);
    var stornos = daten.reduce(function (s, r) { return s + r.a.stornos; }, 0);
    var aktive = daten.filter(function (r) { return r.a.tageInaktiv !== null && r.a.tageInaktiv <= 90; }).length;
    var reichweite = daten.reduce(function (s, r) { return s + r.a.reichweite; }, 0);
    var inhalteFrei = Z.inhalte.filter(function (c) { return c.status === 'frei'; }).length;
    var schnitt = gesamtBest ? gesamtUmsatz / gesamtBest : 0;
    var quote = gesamtUmsatz ? (gesamtProv / gesamtUmsatz * 100) : 0;

    var sortiert = zr.slice().sort(function (x, y) { return y.z.umsatz - x.z.umsatz; });
    var max = sortiert.length ? sortiert[0].z.umsatz : 1;
    var zrText = zeitraumTage ? 'letzte ' + zeitraumTage + ' Tage' : 'seit Programmstart';

    function knopf(wert, text) {
      return '<button class="filt' + (zeitraumTage === wert ? ' filt--an' : '') + '" type="button" data-zeitraum="' + wert + '">' + text + '</button>';
    }

    return '<div class="head"><div><h1>Auswertung</h1><p>Gesamtbild des Partnerkanals · Zeitraum: <strong>' + zrText + '</strong> · Shop natureflow-pets.com</p></div></div>' +

      '<div class="filts">' + knopf(30, '30 Tage') + knopf(90, '90 Tage') + knopf(365, '12 Monate') + knopf(0, 'Gesamt') + '</div>' +

      '<div class="kpis">' +
        kpi('Vermittelter Umsatz', eur(gesamtUmsatz), 'netto · ' + zrText) +
        kpi('Ausgeschüttete Beteiligung', eur(gesamtProv), quote.toFixed(1) + ' % vom Umsatz', true) +
        kpi('Bestellungen', gesamtBest, zrText) +
        kpi('Ø Warenkorb', eur(schnitt), 'netto je Bestellung') +
        kpi('Aktive Partner', aktive + ' von ' + daten.length, 'in den letzten 90 Tagen') +
        kpi('Reichweite im Netz', kurz(reichweite), 'Eigenangaben aller Partner') +
        kpi('Freigegebene Inhalte', inhalteFrei, 'Bilder und Videos') +
      '</div>' +

      '<div class="card"><div class="card__hd"><div><h2>Umsatz je Partner</h2>' +
      '<p>Netto, nach Kundenrabatt, ohne stornierte Bestellungen · ' + zrText + '.</p></div></div>' +
      '<div class="rank">' + sortiert.map(function (r) {
        var name = '<span>' + esc(r.p.name) + '<br><span class="small muted">' + esc(r.a.stufe.name) + '</span></span>';
        // Ohne Umsatz gibt es nichts zu zeigen – ein 0-px-Balken sieht aus wie ein Fehler.
        if (r.z.umsatz <= 0) {
          return '<div class="rank__row">' + name +
            '<span class="small muted">in diesem Zeitraum nichts vermittelt</span>' +
            '<span class="num muted">—</span></div>';
        }
        // Mindestens 2 % Breite, damit auch kleine Beiträge sichtbar bleiben.
        var breite = Math.max(2, max ? (r.z.umsatz / max * 100) : 0);
        return '<div class="rank__row">' + name +
          '<span class="rank__bar"><span class="rank__f" style="width:' + breite.toFixed(1) + '%"></span></span>' +
          '<span class="num"><strong>' + eur(r.z.umsatz) + '</strong></span></div>';
      }).join('') + '</div></div>' +

      '<div class="grid2">' +
        '<div class="card"><div class="card__hd"><div><h2>Was der Kanal kostet</h2></div></div>' +
        '<div class="tblwrap"><table class="tbl" style="min-width:0"><tbody>' +
        '<tr><th>Beteiligung an Partner</th><td class="num">' + eur(gesamtProv) + '</td></tr>' +
        '<tr><th>Kundenrabatt (10 %)</th><td class="num">' + eur(gesamtUmsatz * 0.1111) + '</td></tr>' +
        '<tr><th>Zusammen je Bestellung</th><td class="num"><strong>' + eur(gesamtBest ? (gesamtProv + gesamtUmsatz * 0.1111) / gesamtBest : 0) + '</strong></td></tr>' +
        '</tbody></table></div>' +
        '<div class="note mt"><strong>Vorsicht beim Vergleichen:</strong> Alle Umsätze und Warenkörbe auf dieser Seite sind ' +
        '<em>erfundene Demodaten</em> und liegen bewusst über dem echten Shop-Durchschnitt. Real belastbar ist nur die ' +
        'Einordnung, dass über bezahlte Werbung zuletzt rund <strong>32 € Akquiseaufwand je Bestellung</strong> anfielen ' +
        '(Klar-Auswertung Januar bis Juni 2026). Die Aussage des Prototyps ist die <em>Struktur</em> der Auswertung, nicht ihre Höhe.</div></div>' +

        '<div class="card"><div class="card__hd"><div><h2>Verteilung nach Stufe</h2></div></div>' +
        '<div class="tblwrap"><table class="tbl" style="min-width:0"><thead><tr><th>Stufe</th><th class="num">Partner</th><th class="num">Umsatzanteil</th></tr></thead><tbody>' +
        REGELN.stufen.map(function (s) {
          var inStufe = zr.filter(function (r) { return r.a.stufe.name === s.name; });
          var u = inStufe.reduce(function (x, r) { return x + r.z.umsatz; }, 0);
          return '<tr><th>' + esc(s.name) + '<br><span class="small muted">' + (s.satz * 100) + ' %</span></th>' +
            '<td class="num">' + inStufe.length + '</td>' +
            '<td class="num">' + (gesamtUmsatz ? (u / gesamtUmsatz * 100).toFixed(0) : 0) + ' %</td></tr>';
        }).join('') + '</tbody></table></div>' +
        '<div class="note mt">Stornoquote insgesamt: ' + stornos + ' von ' + (gesamtBest + stornos) + ' Bestellungen.</div></div>' +
      '</div>';
  }

  // ---------------------------------------------------------------
  // 11. Verdrahtung nach jedem Seitenaufbau
  // ---------------------------------------------------------------
  function verdrahte() {
    alle('[data-copy]').forEach(function (b) {
      b.addEventListener('click', function () {
        var t = b.getAttribute('data-copy');
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(t).then(function () { toast('Code „' + t + '" kopiert'); },
                                                function () { toast('Kopieren nicht möglich – bitte manuell markieren'); });
        } else { toast('Kopieren nicht möglich – bitte manuell markieren'); }
      });
    });
    alle('[data-goto]').forEach(function (b) {
      b.addEventListener('click', function () {
        detailPartner = null;
        zeige(b.getAttribute('data-goto'));
        bauNavigation();
      });
    });
    alle('[data-datei]').forEach(function (b) {
      b.addEventListener('click', function () { toast('Prototyp: „' + b.getAttribute('data-datei') + '" wäre hier hinterlegt'); });
    });
    alle('[data-nachweis]').forEach(function (b) {
      b.addEventListener('click', function () { toast('Prototyp: „' + b.getAttribute('data-nachweis') + '" würde sich öffnen'); });
    });
    alle('[data-beleg]').forEach(function (b) {
      b.addEventListener('click', function () { toast('Prototyp: Gutschrift ' + b.getAttribute('data-beleg') + ' als PDF'); });
    });
    alle('[data-annehmen]').forEach(function (b) {
      b.addEventListener('click', function () { dialogBewerbung(b.getAttribute('data-annehmen'), 'annehmen'); });
    });
    alle('[data-ablehnen]').forEach(function (b) {
      b.addEventListener('click', function () { dialogBewerbung(b.getAttribute('data-ablehnen'), 'ablehnen'); });
    });
    alle('[data-inh-frei]').forEach(function (b) {
      b.addEventListener('click', function () { entscheideInhalt(b.getAttribute('data-inh-frei'), true); });
    });
    alle('[data-inh-ab]').forEach(function (b) {
      b.addEventListener('click', function () { dialogInhaltAblehnen(b.getAttribute('data-inh-ab')); });
    });
    alle('[data-medfilter]').forEach(function (b) {
      b.addEventListener('click', function () { filterMedien = b.getAttribute('data-medfilter'); zeige('medien'); });
    });
    alle('[data-zeitraum]').forEach(function (b) {
      b.addEventListener('click', function () { zeitraumTage = parseInt(b.getAttribute('data-zeitraum'), 10); zeige('auswertung'); });
    });
    alle('[data-partner]').forEach(function (tr) {
      function oeffne() { detailPartner = tr.getAttribute('data-partner'); zeige('partnerdetail'); }
      tr.addEventListener('click', oeffne);
      tr.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); oeffne(); }
      });
    });
    alle('[data-sperren]').forEach(function (b) {
      b.addEventListener('click', function () {
        var p = partnerVon(b.getAttribute('data-sperren'));
        if (!p) return;
        p.gesperrt = !p.gesperrt;
        speichern();
        zeige('partnerdetail');
        toast(p.gesperrt ? p.name + ' gesperrt – der Code ist deaktiviert' : p.name + ' wieder freigeschaltet');
      });
    });

    var sb = el('#such-bewerbung');
    if (sb) sb.addEventListener('input', function () {
      filterBewerbung = sb.value;
      var pos = sb.selectionStart;
      zeige('bewerbungen');
      var neu = el('#such-bewerbung');
      if (neu) { neu.focus(); try { neu.setSelectionRange(pos, pos); } catch (e) {} }
    });
    var sp = el('#such-partner');
    if (sp) sp.addEventListener('input', function () {
      filterPartner = sp.value;
      var pos = sp.selectionStart;
      zeige('partner');
      var neu = el('#such-partner');
      if (neu) { neu.focus(); try { neu.setSelectionRange(pos, pos); } catch (e) {} }
    });

    var exp = el('#btn-export');
    if (exp) exp.addEventListener('click', exportCsv);
    var sepa = el('#btn-sepa');
    if (sepa) sepa.addEventListener('click', exportAbrechnung);
    var lauf = el('#btn-lauf');
    if (lauf) lauf.addEventListener('click', abrechnungslauf);

    verdrahteProfil();
    verdrahteUpload();
  }

  // ---------------------------------------------------------------
  // 12. Profil speichern
  // ---------------------------------------------------------------
  function verdrahteProfil() {
    var plus = el('#btn-social-plus');
    if (plus) plus.addEventListener('click', function () {
      var liste = leseSocial();
      liste.push({ netz: '', handle: '', follower: '', url: '' });
      el('#social-liste').innerHTML = socialZeilen(liste);
      verdrahteSocialWeg();
      var letzte = alle('.socrow').pop();
      if (letzte) el('select', letzte).focus();
    });
    verdrahteSocialWeg();

    var sp = el('#btn-profil-speichern');
    if (!sp) return;
    sp.addEventListener('click', function () {
      var p = partnerVon(sitzung.partnerId);
      p.name = el('#p-name').value.trim() || p.name;
      p.firma = el('#p-firma').value.trim();
      p.strasse = el('#p-strasse').value.trim();
      p.plz = el('#p-plz').value.trim();
      p.ort = el('#p-ort').value.trim();
      p.telefon = el('#p-tel').value.trim();
      p.website = el('#p-web').value.trim();
      p.bankInhaber = el('#p-inh').value.trim();
      p.iban = el('#p-iban').value.trim();
      p.kleinunternehmer = el('#p-klein').checked;
      p.social = leseSocial();
      speichern();
      el('#who').textContent = p.name;
      var ok = el('#p-ok');
      ok.textContent = 'Gespeichert. Deine Angaben sind jetzt auch in der Verwaltung sichtbar.';
      ok.hidden = false;
      toast('Profil gespeichert');
    });
  }
  function verdrahteSocialWeg() {
    alle('[data-soc-weg]').forEach(function (b) {
      b.addEventListener('click', function () {
        var liste = leseSocial();
        var i = parseInt(b.getAttribute('data-soc-weg'), 10);
        liste.splice(i, 1);
        el('#social-liste').innerHTML = socialZeilen(liste);
        verdrahteSocialWeg();
      });
    });
  }

  // ---------------------------------------------------------------
  // 13. Inhalte hochladen
  // ---------------------------------------------------------------
  var warteschlange = []; // {file, art, vorschau, dauer}

  function verdrahteUpload() {
    var zone = el('#drop');
    if (!zone) return;
    var input = el('#datei');

    zone.addEventListener('click', function () { input.click(); });
    zone.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); input.click(); }
    });
    ['dragenter', 'dragover'].forEach(function (n) {
      zone.addEventListener(n, function (ev) { ev.preventDefault(); zone.setAttribute('data-an', 'true'); });
    });
    ['dragleave', 'drop'].forEach(function (n) {
      zone.addEventListener(n, function (ev) { ev.preventDefault(); zone.setAttribute('data-an', 'false'); });
    });
    zone.addEventListener('drop', function (ev) {
      if (ev.dataTransfer && ev.dataTransfer.files) nimmDateien(ev.dataTransfer.files);
    });
    input.addEventListener('change', function () { nimmDateien(input.files); input.value = ''; });

    el('#btn-upload').addEventListener('click', absendenInhalte);
  }

  function nimmDateien(fileList) {
    var dateien = Array.prototype.slice.call(fileList || []);
    var abgelehnt = [];
    dateien.forEach(function (f) {
      var istBild = /^image\//.test(f.type);
      var istVideo = /^video\//.test(f.type);
      if (!istBild && !istVideo) { abgelehnt.push(f.name + ' (kein Bild und kein Video)'); return; }
      if (f.size > REGELN.maxDateiMB * 1048576) { abgelehnt.push(f.name + ' (größer als ' + REGELN.maxDateiMB + ' MB)'); return; }
      var eintrag = { file: f, art: istVideo ? 'video' : 'bild', vorschau: null, dauer: null, fertig: false };
      warteschlange.push(eintrag);
      vorschauErzeugen(eintrag, zeichneWarteschlange);
    });
    if (abgelehnt.length) {
      var f = el('#c-fehler');
      f.innerHTML = '<strong>Nicht übernommen:</strong><ul style="margin:.4rem 0 0;padding-left:1.1rem;list-style:disc">' +
        abgelehnt.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>';
      f.hidden = false;
    }
    zeichneWarteschlange();
  }

  /**
   * Erzeugt ein kleines Vorschaubild. Bilder werden über ein Canvas verkleinert,
   * bei Videos wird ein Standbild aus der ersten Sekunde geholt.
   * Wichtig: Ohne Verkleinern sprengt schon ein einziges Handyfoto den localStorage.
   */
  function vorschauErzeugen(eintrag, fertig) {
    var MAX = 560;
    function abschluss() { eintrag.fertig = true; fertig(); }

    if (eintrag.art === 'bild') {
      var leser = new FileReader();
      leser.onload = function () {
        var bild = new Image();
        bild.onload = function () {
          try {
            var s = Math.min(1, MAX / Math.max(bild.width, bild.height));
            var c = document.createElement('canvas');
            c.width = Math.round(bild.width * s);
            c.height = Math.round(bild.height * s);
            c.getContext('2d').drawImage(bild, 0, 0, c.width, c.height);
            eintrag.vorschau = c.toDataURL('image/jpeg', 0.72);
          } catch (e) { eintrag.vorschau = null; }
          abschluss();
        };
        bild.onerror = abschluss;
        bild.src = leser.result;
      };
      leser.onerror = abschluss;
      leser.readAsDataURL(eintrag.file);
      return;
    }

    // Video: Standbild aus der ersten Sekunde. Klappt nicht bei jedem Codec – dann Platzhalter.
    var url = URL.createObjectURL(eintrag.file);
    var v = document.createElement('video');
    var aufgeraeumt = false;
    function aufraeumen() {
      if (aufgeraeumt) return;
      aufgeraeumt = true;
      URL.revokeObjectURL(url);
      abschluss();
    }
    v.preload = 'metadata';
    v.muted = true;
    v.playsInline = true;
    v.onloadedmetadata = function () {
      eintrag.dauer = isFinite(v.duration) ? v.duration : null;
      try { v.currentTime = Math.min(1, (v.duration || 2) / 3); } catch (e) { aufraeumen(); }
    };
    v.onseeked = function () {
      try {
        var s = Math.min(1, MAX / Math.max(v.videoWidth || MAX, v.videoHeight || MAX));
        var c = document.createElement('canvas');
        c.width = Math.round((v.videoWidth || MAX) * s);
        c.height = Math.round((v.videoHeight || MAX) * s);
        c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
        eintrag.vorschau = c.toDataURL('image/jpeg', 0.7);
      } catch (e) { eintrag.vorschau = null; }
      aufraeumen();
    };
    v.onerror = aufraeumen;
    setTimeout(aufraeumen, 6000); // hängt der Decoder, geht es ohne Vorschau weiter
    v.src = url;
  }

  function zeichneWarteschlange() {
    var box = el('#warteschlange');
    if (!box) return;
    if (!warteschlange.length) { box.hidden = true; box.innerHTML = ''; return; }
    box.hidden = false;
    box.innerHTML = warteschlange.map(function (e, i) {
      return '<div class="qitem">' +
        (e.vorschau ? '<img src="' + esc(e.vorschau) + '" alt="">'
                    : '<span class="qitem__ph"><svg><use href="#' + (e.art === 'video' ? 'i-play' : 'i-image') + '"/></svg></span>') +
        '<div><p class="file__n">' + esc(e.file.name) + '</p>' +
        '<p class="file__m">' + (e.art === 'video' ? 'Video' : 'Bild') + ' · ' + mb(e.file.size) +
        (e.dauer ? ' · ' + dauerText(e.dauer) : '') + (e.fertig ? '' : ' · wird vorbereitet …') + '</p></div>' +
        '<button class="iconbtn" type="button" data-q-weg="' + i + '" aria-label="Aus der Auswahl entfernen">' +
        '<svg viewBox="0 0 24 24" width="18" height="18"><use href="#i-x"/></svg></button></div>';
    }).join('');
    alle('[data-q-weg]', box).forEach(function (b) {
      b.addEventListener('click', function () {
        warteschlange.splice(parseInt(b.getAttribute('data-q-weg'), 10), 1);
        zeichneWarteschlange();
      });
    });
  }

  function absendenInhalte() {
    var fehler = el('#c-fehler');
    fehler.hidden = true;
    if (!warteschlange.length) {
      fehler.innerHTML = '<strong>Es ist noch keine Datei ausgewählt.</strong> Zieh ein Bild oder Video in das Feld oben.';
      fehler.hidden = false;
      return;
    }
    if (!el('#c-rechte').checked) {
      fehler.innerHTML = '<strong>Wir brauchen noch dein Häkchen bei den Nutzungsrechten.</strong> Ohne das dürfen wir deine Aufnahmen nicht verwenden.';
      fehler.hidden = false;
      return;
    }
    var titel = el('#c-titel').value.trim();
    var hinweis = el('#c-hinweis').value.trim();
    var neu = warteschlange.map(function (e, i) {
      return {
        id: 'C-' + Date.now().toString(36).toUpperCase() + '-' + i,
        partnerId: sitzung.partnerId,
        titel: titel || e.file.name.replace(/\.[^.]+$/, ''),
        art: e.art,
        dateiname: e.file.name,
        groesse: e.file.size,
        dauer: e.dauer,
        vorschau: e.vorschau,
        hinweis: hinweis,
        rechte: true,
        hochgeladen: new Date().toISOString(),
        status: 'pruefung'
      };
    });
    neu.forEach(function (n) { Z.inhalte.unshift(n); });

    /* Der localStorage ist knapp. Passt es nicht, werfen wir die Vorschaubilder weg
       statt den Upload zu verlieren – die Kachel zeigt dann das Platzhaltermotiv. */
    if (!speichern()) {
      neu.forEach(function (n) { n.vorschau = null; });
      if (!speichern()) {
        neu.forEach(function (n) {
          var i = Z.inhalte.indexOf(n);
          if (i >= 0) Z.inhalte.splice(i, 1);
        });
        fehler.innerHTML = '<strong>Der Speicher dieses Browsers ist voll.</strong> Im Prototyp hilft „Demodaten zurücksetzen" unten links.';
        fehler.hidden = false;
        return;
      }
      toast(neu.length + (neu.length === 1 ? ' Datei übernommen' : ' Dateien übernommen') + ' – ohne Vorschaubild, der Speicher war knapp');
    } else {
      toast(neu.length === 1 ? 'Datei ist zur Prüfung unterwegs' : neu.length + ' Dateien sind zur Prüfung unterwegs');
    }

    warteschlange = [];
    bauNavigation();
    zeige('inhalte');
  }

  function entscheideInhalt(id, frei, grund) {
    var c = Z.inhalte.filter(function (x) { return x.id === id; })[0];
    if (!c) return;
    c.status = frei ? 'frei' : 'abgelehnt';
    c.entscheidung = grund || (frei ? 'Freigegeben.' : '');
    c.entschiedenAm = new Date().toISOString();
    speichern();
    bauNavigation();
    zeige(detailPartner ? 'partnerdetail' : 'medien');
    var p = partnerVon(c.partnerId);
    toast(frei
      ? '„' + c.titel + '" freigegeben' + (REGELN.materialpraemie[c.art] ? ' · ' + eur(REGELN.materialpraemie[c.art]) + ' gutgeschrieben' : '')
      : '„' + c.titel + '" abgelehnt' + (p ? ' · ' + p.name + ' bekommt die Begründung' : ''));
  }

  // ---------------------------------------------------------------
  // 14. Dialoge
  // ---------------------------------------------------------------
  function dialogInhaltAblehnen(id) {
    var c = Z.inhalte.filter(function (x) { return x.id === id; })[0];
    if (!c) return;
    var dlg = el('#dlg-bewerbung');
    el('#dlg-titel').textContent = 'Inhalt ablehnen';
    el('#dlg-body').innerHTML =
      '<p style="margin-top:0"><strong>' + esc(c.titel) + '</strong> · ' + esc(c.dateiname) + '</p>' +
      '<div class="fld mt"><label for="d-grund">Warum können wir es nicht verwenden? *</label>' +
      '<textarea id="d-grund" placeholder="Die Begründung geht genau so an den Partner. Sei konkret – meistens lässt sich eine neue Fassung machen."></textarea></div>' +
      '<div class="msg msg--err" id="d-fehler" hidden role="alert"></div>' +
      '<div class="note">Häufigster Grund: eine krankheitsbezogene Aussage im Ton. Dann bitte dazuschreiben, welcher Satz gemeint ist.</div>';
    el('#dlg-ft').innerHTML =
      '<button class="btn btn--sm btn--ghost" type="button" data-dlg-abbruch>Abbrechen</button>' +
      '<button class="btn btn--sm btn--danger" type="button" data-dlg-ok>Ablehnen und Begründung senden</button>';

    el('[data-dlg-abbruch]', dlg).addEventListener('click', function () { dlg.close(); });
    el('[data-dlg-ok]', dlg).addEventListener('click', function () {
      var grund = (el('#d-grund').value || '').trim();
      if (!grund) {
        var f = el('#d-fehler');
        f.textContent = 'Bitte schreib eine Begründung – sie geht an den Partner.';
        f.hidden = false;
        el('#d-grund').setAttribute('aria-invalid', 'true');
        return;
      }
      dlg.close();
      entscheideInhalt(id, false, grund);
    });
    dlg.showModal();
  }

  function dialogBewerbung(id, art) {
    var b = Z.bewerbungen.filter(function (x) { return x.id === id; })[0];
    if (!b) return;
    var dlg = el('#dlg-bewerbung');
    var annehmen = art === 'annehmen';

    el('#dlg-titel').textContent = annehmen ? 'Bewerbung annehmen' : 'Bewerbung ablehnen';
    el('#dlg-body').innerHTML =
      '<p style="margin-top:0"><strong>' + esc(b.name) + '</strong> · ' + esc(b.firma) + '</p>' +
      (annehmen
        ? '<div class="fld mt"><label for="d-code">Empfehlungscode vergeben</label>' +
          '<input id="d-code" type="text" value="' + esc(codeVorschlag(b)) + '">' +
          '<p class="small muted">Der Code muss eindeutig sein – vergebene Codes weisen wir ab.</p></div>' +
          '<div class="fld"><label for="d-notiz">Interne Notiz (freiwillig)</label>' +
          '<textarea id="d-notiz" placeholder="Warum passt die Bewerbung?"></textarea></div>' +
          '<div class="msg msg--err" id="d-fehler" hidden role="alert"></div>' +
          '<div class="note">Der Partner bekommt Zugangsdaten, das Willkommenspaket und die Textbausteine. Startstufe ist <strong>Gefährte mit 10 %</strong>.</div>'
        : '<div class="fld mt"><label for="d-grund">Begründung für die Absage *</label>' +
          '<textarea id="d-grund" placeholder="Wird in der Akte vermerkt. Die Absage-Mail formulieren wir freundlich und ohne Details."></textarea></div>' +
          '<div class="msg msg--err" id="d-fehler" hidden role="alert"></div>' +
          '<div class="note">Absagen bekommen immer eine Antwort – die Person bleibt potenzielle Kundin oder potenzieller Kunde.</div>');

    el('#dlg-ft').innerHTML =
      '<button class="btn btn--sm btn--ghost" type="button" data-dlg-abbruch>Abbrechen</button>' +
      '<button class="btn btn--sm ' + (annehmen ? 'btn--ok' : 'btn--danger') + '" type="button" data-dlg-ok>' +
      (annehmen ? 'Annehmen und Zugang anlegen' : 'Endgültig ablehnen') + '</button>';

    el('[data-dlg-abbruch]', dlg).addEventListener('click', function () { dlg.close(); });
    el('[data-dlg-ok]', dlg).addEventListener('click', function () {
      if (annehmen) {
        var code = (el('#d-code').value || '').trim().toUpperCase();
        if (!code) code = codeVorschlag(b);
        // Doppelte Codes würden im Shop zwei Partnern dieselbe Bestellung zuordnen.
        var belegt = Z.partner.some(function (p) { return p.code.toUpperCase() === code; });
        if (belegt) {
          var f0 = el('#d-fehler');
          f0.textContent = 'Der Code „' + code + '" ist schon vergeben. Bitte einen anderen wählen.';
          f0.hidden = false;
          el('#d-code').setAttribute('aria-invalid', 'true');
          return;
        }
        b.status = 'angenommen';
        b.entscheidung = (el('#d-notiz').value || '').trim() || 'Angenommen.';
        b.entschiedenAm = new Date().toISOString();
        Z.partner.push({
          id: neuePartnerId(), name: b.name, firma: b.firma, ort: b.ort || '', plz: '', strasse: '',
          telefon: b.telefon || '', email: b.email, code: code, seit: new Date().toISOString(),
          taetigkeit: b.taetigkeit, website: b.website || '', social: b.social || [],
          bankInhaber: '', iban: '',
          kleinunternehmer: !!b.kleinunternehmer, gesperrt: false
        });
        speichern();
        dlg.close();
        bauNavigation();
        zeige('bewerbungen');
        toast(b.name + ' aufgenommen · Code ' + code);
      } else {
        var grund = (el('#d-grund').value || '').trim();
        if (!grund) {
          var f = el('#d-fehler');
          f.textContent = 'Bitte gib eine Begründung an – sie wird in der Akte vermerkt.';
          f.hidden = false;
          el('#d-grund').setAttribute('aria-invalid', 'true');
          return;
        }
        b.status = 'abgelehnt';
        b.entscheidung = grund;
        b.entschiedenAm = new Date().toISOString();
        speichern();
        dlg.close();
        bauNavigation();
        zeige('bewerbungen');
        toast('Bewerbung von ' + b.name + ' abgelehnt');
      }
    });

    dlg.showModal();
  }

  /** Immer höher als jede vergebene Nummer – „Anzahl + x" kollidiert, sobald jemand fehlt. */
  function neuePartnerId() {
    var max = 1100;
    Z.partner.forEach(function (p) {
      var n = parseInt(String(p.id).replace(/[^0-9]/g, ''), 10);
      if (!isNaN(n) && n > max) max = n;
    });
    return 'P-' + (max + 1);
  }

  function codeVorschlag(b) {
    var basis = (b.firma && b.firma !== '—' ? b.firma : b.name)
      .toUpperCase()
      .replace(/Ä/g, 'AE').replace(/Ö/g, 'OE').replace(/Ü/g, 'UE').replace(/ß/g, 'SS')
      .replace(/[^A-Z]/g, '');
    var vorschlag = (basis.slice(0, 8) || 'PARTNER') + '10';
    // Bei Kollision durchzählen, damit der Vorschlag direkt benutzbar ist.
    var n = 2;
    while (Z.partner.some(function (p) { return p.code.toUpperCase() === vorschlag; })) {
      vorschlag = (basis.slice(0, 7) || 'PARTNER') + n + '10';
      n++;
      if (n > 20) break;
    }
    return vorschlag;
  }

  // ---------------------------------------------------------------
  // 15. Abrechnung und Export
  // ---------------------------------------------------------------
  function abrechnungslauf() {
    var faellig = faelligeAuszahlungen();
    if (!faellig.length) { toast('Derzeit ist nichts fällig'); return; }
    var jetzt = new Date();
    var vormonat = new Date(jetzt.getFullYear(), jetzt.getMonth() - 1, 1);
    var zeitraum = vormonat.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
    var nr = 9016;
    Z.auszahlungen.forEach(function (a) {
      var n = parseInt(String(a.id).replace(/[^0-9]/g, ''), 10);
      if (!isNaN(n) && n > nr) nr = n;
    });
    var summe = 0;
    faellig.forEach(function (r) {
      nr++;
      summe += r.a.provAuszahlbar;
      Z.auszahlungen.push({
        id: 'GS-' + nr, partnerId: r.p.id, datum: new Date().toISOString(),
        betrag: Math.round(r.a.provAuszahlbar * 100) / 100, zeitraum: zeitraum
      });
    });
    speichern();
    bauNavigation();
    zeige('abrechnung');
    toast(faellig.length + ' Gutschriften über ' + eur(summe) + ' erzeugt');
  }

  function csvHerunterladen(kopf, zeilen, name, meldung) {
    var csv = [kopf].concat(zeilen)
      .map(function (r) { return r.map(function (f) { return '"' + String(f).replace(/"/g, '""') + '"'; }).join(';'); })
      .join('\r\n');
    var blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    toast(meldung);
  }

  function exportCsv() {
    var kopf = ['Partner-ID', 'Name', 'Betrieb', 'Ort', 'Code', 'Stufe', 'Satz', 'Bestellungen', 'Stornos',
                'Umsatz netto', 'Beteiligung gesamt', 'Materialpraemie', 'Ausgezahlt', 'Offen auszahlbar',
                'Reichweite', 'Profile', 'Kleinunternehmer', 'Gesperrt'];
    var zeilen = Z.partner.map(function (p) {
      var a = berechnePartner(p.id);
      return [p.id, p.name, p.firma, p.ort || '', p.code, a.stufe.name, (a.stufe.satz * 100) + '%',
              a.anzahl, a.stornos, a.umsatzNetto.toFixed(2), a.provGesamt.toFixed(2), a.praemien.toFixed(2),
              a.ausgezahlt.toFixed(2), a.provAuszahlbar.toFixed(2), a.reichweite,
              (p.social || []).map(function (s) { return s.netz + ' ' + s.handle + ' (' + s.follower + ')'; }).join(' | '),
              p.kleinunternehmer ? 'ja' : 'nein', p.gesperrt ? 'ja' : 'nein'];
    });
    csvHerunterladen(kopf, zeilen, 'nfp-partner-uebersicht.csv', 'CSV mit allen Partnern erzeugt');
  }

  function exportAbrechnung() {
    var faellig = faelligeAuszahlungen();
    var kopf = ['Partner-ID', 'Name', 'Betrieb', 'Kontoinhaber', 'IBAN', 'Steuerstatus',
                'Beteiligung', 'Materialpraemie', 'Auszahlungsbetrag', 'Verwendungszweck'];
    var jetzt = new Date();
    var vormonat = new Date(jetzt.getFullYear(), jetzt.getMonth() - 1, 1);
    var zeitraum = vormonat.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
    var zeilen = faellig.map(function (r) {
      return [r.p.id, r.p.name, r.p.firma, r.p.bankInhaber || '', r.p.iban || '',
              r.p.kleinunternehmer ? 'Kleinunternehmer § 19 UStG' : 'regelbesteuert 7 %',
              (r.a.provAuszahlbar - r.a.praemien).toFixed(2), r.a.praemien.toFixed(2),
              r.a.provAuszahlbar.toFixed(2), 'Gutschrift Partnerprogramm ' + zeitraum];
    });
    csvHerunterladen(kopf, zeilen, 'nfp-abrechnung.csv',
      faellig.length ? 'Abrechnungsliste für die Buchhaltung erzeugt' : 'Liste ist leer – derzeit ist nichts fällig');
  }

  // ---------------------------------------------------------------
  // 16. Start
  // ---------------------------------------------------------------
  function start() {
    laden();

    el('#form-login').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var ok = anmelden(el('#l-mail').value, el('#l-pw').value);
      if (!ok) {
        var f = el('#l-fehler');
        f.textContent = 'E-Mail oder Passwort stimmt nicht. Nimm die Demozugänge unten.';
        f.hidden = false;
      }
    });
    alle('[data-demo]').forEach(function (b) {
      b.addEventListener('click', function () {
        var rolle = b.getAttribute('data-demo');
        var mail = rolle === 'admin' ? 'partner@natureflow-pets.com' : 'm.hansen@beispiel.de';
        el('#l-mail').value = mail;
        el('#l-pw').value = 'demo1234';
        anmelden(mail, 'demo1234');
      });
    });
    el('#btn-logout').addEventListener('click', abmelden);
    el('#btn-reset').addEventListener('click', function () {
      zuruecksetzen();
      warteschlange = [];
      detailPartner = null;
      bauNavigation();
      zeige(aktuelleSeite && aktuelleSeite !== 'partnerdetail' ? aktuelleSeite : (sitzung.rolle === 'admin' ? 'bewerbungen' : 'uebersicht'));
      toast('Demodaten zurückgesetzt');
    });
    el('#btn-menu').addEventListener('click', function () {
      var s = el('#side');
      var offen = s.getAttribute('data-open') === 'true';
      s.setAttribute('data-open', offen ? 'false' : 'true');
      el('#btn-menu').setAttribute('aria-expanded', offen ? 'false' : 'true');
    });

    // Für automatisierte Prüfungen zugänglich machen
    window.NFP = {
      regeln: REGELN, stufeFuer: stufeFuer, naechsteStufe: naechsteStufe,
      berechnePartner: berechnePartner, zustand: function () { return Z; },
      anmelden: anmelden, zeige: zeige, zuruecksetzen: function () { zuruecksetzen(); },
      entscheideInhalt: entscheideInhalt, faellige: faelligeAuszahlungen,
      detail: function (id) { detailPartner = id; zeige('partnerdetail'); }
    };
    window.__portalBereit = true;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
