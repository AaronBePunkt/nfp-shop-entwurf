/* =========================================================
   NatureFlow Pets – Creator-Bereich (Prototyp)
   Schwestersystem zum Fachpartner-Bereich. Reine Browser-Anwendung
   mit Demodaten. Kein Server, keine echten Daten.

   Warum ein eigenes Backend und nicht dasselbe wie bei den Fachpartnern:
   Ein Creator wird anders vergütet (Honorar je Kampagne statt nur
   Beteiligung), liefert eine Leistung ab (Inhalt zum Termin) und räumt
   uns Nutzungsrechte ein, die ABLAUFEN. Genau diese drei Dinge kennt der
   Fachpartner-Bereich nicht – und das dritte ist ein echtes Haftungsrisiko:
   eine Anzeige, die mit abgelaufenen Rechten weiterläuft.
   ========================================================= */
(function () {
  'use strict';

  // ---------------------------------------------------------------
  // 1. Regelwerk – an EINER Stelle, damit es prüfbar und änderbar bleibt
  // ---------------------------------------------------------------
  var REGELN = {
    /* Stufen bewusst ANDERS benannt als bei den Fachpartnern (Gefährte /
       Begleiter / Wegbereiter) – sonst verschwimmen die zwei Programme.
       VORSCHLAG, von Aaron zu entscheiden. */
    stufen: [
      { name: 'Entdecker',   satz: 0.10, abInhalte: 0,  abUmsatz: 0 },
      { name: 'Erzähler',    satz: 0.12, abInhalte: 3,  abUmsatz: 500 },
      { name: 'Botschafter', satz: 0.15, abInhalte: 10, abUmsatz: 2500 }
    ],
    /* Niedriger als bei den Fachpartnern (10/15/20 %) – begründet:
       Creator bekommen zusätzlich Honorar und Produkt, Fachpartner nicht. */
    folgekaufFaktor: 0.5,
    folgekaufMonate: 12,
    kundenrabatt: 0.10,
    sperrfristTage: 28,          // 14 Tage Widerruf + 14 Tage Puffer
    mindestauszahlung: 25,
    maxDateiMB: 200,

    /* Honorarrahmen je Kampagne – REINER PLATZHALTER.
       Wer verhandelt, setzt die echten Werte ein.
       Dient hier nur dazu, dass der Vorschlagsrechner etwas anzeigt. */
    honorarRahmen: [
      { bis: 10000,  betrag: 150 },
      { bis: 50000,  betrag: 350 },
      { bis: 150000, betrag: 750 },
      { bis: Infinity, betrag: 1200 }
    ],
    honorarVorschlag: true,
    /* Aufschlag, wenn wir den Inhalt auch als Anzeige schalten dürfen. */
    rechteAufschlag: 0.5,
    rechteMonateStandard: 6,
    /* Ab wie vielen Tagen vor Ablauf gewarnt wird. */
    rechteWarnungTage: 30,

    /* Künstlersozialabgabe. Belegt, nicht geschätzt:
       – Satz 2026 = 4,9 % (§ 1 KSAbg2026V, BGBl. 2025 I Nr. 220)
       – Freigrenze 1.000 € Jahresentgelt (§ 24 Abs. 2 S. 2 KSVG); 2025 waren es 700 €
       – Rechtsgrund für einen eigenen Shop: § 24 Abs. 2 S. 1 Nr. 1 KSVG (Eigenwerbung)
       – Die KSK nennt Influencer ausdrücklich im Künstlerkatalog und schreibt in ihrer FAQ,
         dass Entgelte für selbst erstellte Werbefotos/-videos/-texte abgabepflichtig sind,
         Affiliate-Provisionen dagegen NICHT.
       Deshalb wird hier auf Honorare und Warenwert gerechnet, nicht auf die Beteiligung. */
    ksaSatz: 0.049,
    ksaFreigrenze: 1000
  };

  var NETZE = ['Instagram', 'TikTok', 'YouTube', 'Facebook', 'Podcast', 'Website oder Blog', 'Newsletter', 'Sonstiges'];

  /* Die vier Punkte, die vor JEDER Freigabe eines Inhalts geprüft werden.
     Sie stehen hier und nicht im Markup, damit sie an einer Stelle gepflegt
     werden – und damit der Test zählen kann, dass wirklich alle vier greifen. */
  var PRUEFPUNKTE = [
    { id: 'kennz', kurz: 'Werbekennzeichnung',
      text: '„Werbung“ oder „Anzeige“ steht am Anfang und ist ohne Scrollen oder Ausklappen erkennbar. Bei Stories: jedes Slide einzeln. Bei Video: dauerhaft eingeblendet.' },
    { id: 'heil', kurz: 'Keine Krankheitsaussagen',
      text: 'Keine Krankheitsbegriffe: kein „Arthrose“, „Schmerzen“, „entzündungshemmend“, „HD“, „heilt“, „lindert“. Erlaubt sind Erhaltungsaussagen.' },
    { id: 'musik', kurz: 'Musik und Material',
      text: 'Musik, Schrift und Fremdmaterial sind gewerblich nutzbar – Plattform-Musikbibliotheken sind es für Werbung meist NICHT.' },
    { id: 'dritte', kurz: 'Dritte und fremde Marken',
      text: 'Abgebildete Personen haben eingewilligt, keine fremden Marken oder Wettbewerbsprodukte im Bild.' }
  ];

  /* Nutzungsrechte-Kanäle. „Anzeige“ und „Whitelisting“ sind die teuren –
     und die, bei denen ein Ablauf wehtut. */
  var KANAELE = [
    { id: 'organisch', name: 'Organisch beim Creator', erklaer: 'Der Beitrag bleibt im Profil des Creators stehen.' },
    { id: 'eigenkanal', name: 'Unsere eigenen Kanäle', erklaer: 'Wir posten den Inhalt auf unseren Profilen und im Shop.' },
    { id: 'anzeige', name: 'Bezahlte Anzeige', erklaer: 'Wir schalten den Inhalt als Werbung (Meta, TikTok, YouTube).' },
    { id: 'whitelist', name: 'Whitelisting', erklaer: 'Wir schalten Anzeigen aus dem Profil des Creators heraus.' }
  ];
  var KANAL_KRITISCH = ['anzeige', 'whitelist'];

  /** Stufe aus dem bis dahin erreichten Stand (höchste erfüllte Stufe gewinnt). */
  function stufeFuer(inhalte, umsatz) {
    var treffer = REGELN.stufen[0];
    for (var i = 0; i < REGELN.stufen.length; i++) {
      var s = REGELN.stufen[i];
      if (inhalte >= s.abInhalte || umsatz >= s.abUmsatz) treffer = s;
    }
    return treffer;
  }
  function naechsteStufe(inhalte, umsatz) {
    var jetzt = stufeFuer(inhalte, umsatz);
    var idx = REGELN.stufen.indexOf(jetzt);
    if (idx >= REGELN.stufen.length - 1) return null;
    var z = REGELN.stufen[idx + 1];
    var f = Math.max(z.abInhalte ? inhalte / z.abInhalte : 0, z.abUmsatz ? umsatz / z.abUmsatz : 0);
    return {
      ziel: z, anteil: Math.max(0, Math.min(1, f)),
      fehltInhalte: Math.max(0, z.abInhalte - inhalte),
      fehltUmsatz: Math.max(0, z.abUmsatz - umsatz)
    };
  }
  /** Honorarvorschlag aus der Reichweite – bewusst grob, siehe Kommentar oben. */
  function honorarVorschlag(reichweite) {
    for (var i = 0; i < REGELN.honorarRahmen.length; i++) {
      if (reichweite <= REGELN.honorarRahmen[i].bis) return REGELN.honorarRahmen[i].betrag;
    }
    return 0;
  }

  // ---------------------------------------------------------------
  // 2. Hilfsmittel
  // ---------------------------------------------------------------
  var SPEICHER = 'nfp_creator_zustand_v1';
  var SPEICHER_BEWERBUNGEN = 'nfp_creator_bewerbungen';   // teilt sich die Landingpage

  function eur(n) {
    return (n || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  }
  function eur0(n) {
    return Math.round(n || 0).toLocaleString('de-DE') + ' €';
  }
  function zahl(n) { return (n || 0).toLocaleString('de-DE'); }
  function kurz(n) {
    n = n || 0;
    if (n >= 1000000) return (n / 1000000).toLocaleString('de-DE', { maximumFractionDigits: 1 }) + ' Mio.';
    if (n >= 1000) return (n / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 }) + ' Tsd.';
    return zahl(n);
  }
  function proz(n, stellen) {
    return (n * 100).toLocaleString('de-DE', { maximumFractionDigits: stellen == null ? 1 : stellen }) + ' %';
  }
  function datum(iso) {
    if (!iso) return '–';
    return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
  function tageHer(n) {
    var d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - n);
    return d.toISOString();
  }
  function tageHin(n) { return tageHer(-n); }
  function tageSeit(iso) { return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000); }
  function tageBis(iso) { return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000); }
  function mb(bytes) {
    if (bytes < 1048576) return Math.max(1, Math.round(bytes / 1024)).toLocaleString('de-DE') + ' KB';
    return (bytes / 1048576).toLocaleString('de-DE', { maximumFractionDigits: 1 }) + ' MB';
  }
  function dauerText(s) {
    if (!s && s !== 0) return '';
    var m = Math.floor(s / 60), r = Math.round(s % 60);
    return m + ':' + (r < 10 ? '0' : '') + r + ' min';
  }
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
    t.textContent = text; t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 3600);
  }

  // ---------------------------------------------------------------
  // 3. Demodaten
  // ---------------------------------------------------------------
  function demodaten() {
    var creator = [
      { id: 'C-2041', name: 'Lena Ostermann', kuenstlername: 'Pfotenweg', ort: 'Hamburg', plz: '20359',
        strasse: 'Wohlwillstraße 14', telefon: '040 22851907', land: 'DE',
        email: 'lena@beispiel.de', code: 'PFOTENWEG10', seit: tageHer(167),
        ueber: 'Alltag mit zwei Hunden, viel Bewegung und Ernährung. Kurze Videos, wenig Hochglanz.',
        plattformen: [
          { netz: 'Instagram', handle: '@pfotenweg', follower: 34200, engagement: 0.041, url: 'https://instagram.com/pfotenweg' },
          { netz: 'TikTok', handle: '@pfotenweg', follower: 61800, engagement: 0.058, url: 'https://tiktok.com/@pfotenweg' },
          { netz: 'YouTube', handle: 'Pfotenweg', follower: 7300, engagement: 0.022, url: 'https://youtube.com/@pfotenweg' }
        ],
        bankInhaber: 'Lena Ostermann', iban: 'DE00 XXXX XXXX XXXX XXXX XX',
        kleinunternehmer: false, ustId: 'DE327884912', gesperrt: false },

      { id: 'C-2058', name: 'Marek Dohnal', kuenstlername: 'Hundeleben Kompakt', ort: 'Leipzig', plz: '04109',
        strasse: 'Gottschedstraße 9', telefon: '0341 5589120', land: 'DE',
        email: 'marek@beispiel.de', code: 'MAREK10', seit: tageHer(94),
        ueber: 'Erklärvideos zu Hundegesundheit, ruhiger Ton, viele Senioren-Hunde in der Community.',
        plattformen: [
          { netz: 'YouTube', handle: 'Hundeleben Kompakt', follower: 128000, engagement: 0.031, url: 'https://youtube.com/@hundelebenkompakt' },
          { netz: 'Instagram', handle: '@hundeleben.kompakt', follower: 19400, engagement: 0.028, url: '' }
        ],
        bankInhaber: 'Marek Dohnal', iban: 'DE00 XXXX XXXX XXXX XXXX XX',
        kleinunternehmer: false, ustId: 'DE811223344', gesperrt: false },

      { id: 'C-2063', name: 'Sophie Bräuer', kuenstlername: 'sophie & balu', ort: 'Wien', plz: '1070',
        strasse: 'Neubaugasse 22', telefon: '+43 660 7742019', land: 'AT',
        email: 'sophie@beispiel.de', code: 'BALU10', seit: tageHer(58),
        ueber: 'Kleiner, sehr aktiver Account rund um einen Labrador mit Gelenkproblemen im Alter.',
        plattformen: [
          { netz: 'Instagram', handle: '@sophieundbalu', follower: 8900, engagement: 0.072, url: 'https://instagram.com/sophieundbalu' },
          { netz: 'TikTok', handle: '@sophieundbalu', follower: 4200, engagement: 0.065, url: '' }
        ],
        bankInhaber: 'Sophie Bräuer', iban: 'AT48 3200 0000 1234 5678',
        kleinunternehmer: true, ustId: '', gesperrt: false,
        hinweis: 'Sitz in Österreich – Reverse Charge prüfen, Gutschrift ohne deutsche Umsatzsteuer.' },

      { id: 'C-2071', name: 'Jannis Kröger', kuenstlername: 'Waldrunde', ort: 'Bremen', plz: '28195',
        strasse: 'Am Wall 121', telefon: '0421 3398124', land: 'DE',
        email: 'post@beispiel.de', code: 'WALDRUNDE10', seit: tageHer(41),
        ueber: 'Wander- und Outdoor-Content mit Hund, viele Reels aus dem Norden.',
        plattformen: [
          { netz: 'Instagram', handle: '@waldrunde', follower: 15600, engagement: 0.035, url: '' },
          { netz: 'TikTok', handle: '@waldrunde', follower: 2900, engagement: 0.048, url: '' }
        ],
        bankInhaber: 'Jannis Kröger', iban: 'DE00 XXXX XXXX XXXX XXXX XX',
        kleinunternehmer: true, ustId: '', gesperrt: false },

      { id: 'C-2079', name: 'Yara Simon', kuenstlername: 'yara.und.nala', ort: 'Köln', plz: '50667',
        strasse: 'Hohe Straße 4', telefon: '0221 4471209', land: 'DE',
        email: 'hallo@beispiel.de', code: 'NALA10', seit: tageHer(22),
        ueber: 'Zwei Windhunde, sehr junge Community, viel TikTok.',
        plattformen: [
          { netz: 'TikTok', handle: '@yara.und.nala', follower: 96400, engagement: 0.083, url: '' },
          { netz: 'Instagram', handle: '@yara.und.nala', follower: 11200, engagement: 0.039, url: '' }
        ],
        bankInhaber: 'Yara Simon', iban: 'DE00 XXXX XXXX XXXX XXXX XX',
        kleinunternehmer: true, ustId: '', gesperrt: false }
    ];

    /* -------- Kampagnen --------
       Der Kern des Unterschieds zum Fachpartner-Programm: eine Kampagne ist
       eine bestellte Leistung mit Termin, Honorar und Nutzungsrechten. */
    var kampagnen = [
      { id: 'K-118', titel: 'Gelenk-Kur im Alltag – 2 Reels', creatorId: 'C-2041',
        briefing: 'Zwei Reels à 20–30 Sekunden: Morgenroutine mit Gabe der Tabletten, und ein Vorher-Nachher-Gefühl über vier Wochen Spaziergang. Bitte KEINE Krankheitsbegriffe – wir dürfen nur von Beweglichkeit und Erhaltung sprechen. Werbekennzeichnung von der ersten Sekunde an.',
        leistungen: ['2 Reels (Instagram + TikTok)', '3 Standbilder quer', 'Story-Reihe mit Code'],
        start: tageHer(48), deadline: tageHer(21), honorar: 750,
        rechteKanaele: ['organisch', 'eigenkanal', 'anzeige'], rechteMonate: 6,
        status: 'abgenommen', abnahme: tageHer(19),
        seeding: { artikel: 'Gelenk-Tabletten 100 Stück + Gelenköl', wert: 62.90, versandAm: tageHer(52) } },

      { id: 'K-124', titel: 'Senior-Hund Aufklärung – 1 YouTube-Integration', creatorId: 'C-2058',
        briefing: 'Integration von 60–90 Sekunden im laufenden Video zum Thema Bewegung im Alter. Sachlicher Ton, offene Deklaration zeigen. Kennzeichnung als Werbung im Video und in der Beschreibung.',
        leistungen: ['1 Integration im Video', 'Link + Code in der Beschreibung'],
        start: tageHer(33), deadline: tageHer(6), honorar: 1200,
        rechteKanaele: ['organisch', 'eigenkanal'], rechteMonate: 12,
        status: 'abgenommen', abnahme: tageHer(4),
        seeding: { artikel: 'Gelenk-Tabletten 250 Stück', wert: 49.95, versandAm: tageHer(37) } },

      { id: 'K-131', titel: 'Herbststart – Reel mit Code', creatorId: 'C-2063',
        briefing: 'Ein Reel zum Thema kalte Jahreszeit und Beweglichkeit. Klein, ehrlich, im eigenen Ton. Keine Aussagen zu Erkrankungen.',
        leistungen: ['1 Reel', '2 Stories'],
        start: tageHer(16), deadline: tageHin(4), honorar: 150,
        rechteKanaele: ['organisch', 'eigenkanal'], rechteMonate: 6,
        status: 'inhalt-da',
        seeding: { artikel: 'Gelenk-Tabletten 100 Stück', wert: 27.95, versandAm: tageHer(18) } },

      { id: 'K-136', titel: 'Outdoor-Serie – 3 Reels', creatorId: 'C-2071',
        briefing: 'Drei Reels aus dem Wald: nach der Runde, Napf, Ruhephase. Produkt beiläufig, nicht als Werbeblock.',
        leistungen: ['3 Reels', '5 Standbilder'],
        start: tageHer(9), deadline: tageHin(12), honorar: 350,
        rechteKanaele: ['organisch', 'eigenkanal', 'anzeige'], rechteMonate: 6,
        status: 'zugesagt',
        seeding: { artikel: 'Gelenk-Tabletten 100 Stück + Grünlippmuschelpulver', wert: 54.90, versandAm: tageHer(7) } },

      { id: 'K-140', titel: 'TikTok-Test – 1 Video', creatorId: 'C-2079',
        briefing: 'Ein TikTok im eigenen Format. Wir testen, ob das Thema auf einer sehr jungen Community trägt.',
        leistungen: ['1 TikTok-Video'],
        start: tageHer(3), deadline: tageHin(18), honorar: 350,
        rechteKanaele: ['organisch'], rechteMonate: 6,
        status: 'angeboten',
        seeding: { artikel: 'Gelenk-Tabletten 100 Stück', wert: 27.95, versandAm: null } },

      /* Bewusst offen für die Demo-Anmeldung (Lena): Wer sich als Creatorin
         anmeldet, soll den Weg „Anfrage annehmen oder ablehnen" sehen können. */
      { id: 'K-143', titel: 'Winterrunde – 2 Reels', creatorId: 'C-2041',
        briefing: 'Zwei kurze Reels aus der kalten Jahreszeit: die erste Runde am Morgen und das Ankommen danach. Ruhiger Ton, kein Werbeblock. Bitte nur von Beweglichkeit und Erhaltung sprechen, keine Krankheitsbegriffe. Werbekennzeichnung von der ersten Sekunde an, dauerhaft eingeblendet.',
        leistungen: ['2 Reels (Instagram + TikTok)', '4 Standbilder', 'Story-Reihe mit Code'],
        start: tageHer(2), deadline: tageHin(24), honorar: 900,
        rechteKanaele: ['organisch', 'eigenkanal', 'anzeige'], rechteMonate: 6,
        status: 'angeboten',
        seeding: { artikel: 'Gelenk-Tabletten 250 Stück + Gelenköl', wert: 84.90, versandAm: null } },

      { id: 'K-109', titel: 'Sommeraktion – Reel', creatorId: 'C-2041',
        briefing: 'Ein Reel zur Sommeraktion. Abgeschlossen, dient hier als Beispiel für abgelaufene Nutzungsrechte.',
        leistungen: ['1 Reel'],
        start: tageHer(240), deadline: tageHer(220), honorar: 600,
        rechteKanaele: ['organisch', 'eigenkanal', 'anzeige'], rechteMonate: 6,
        status: 'abgenommen', abnahme: tageHer(218),
        seeding: { artikel: 'Gelenk-Tabletten 100 Stück', wert: 27.95, versandAm: tageHer(244) } }
    ];

    /* -------- Inhalte --------
       ph = Platzhalterfarbe. Der Prototyp speichert bewusst keine echten
       Dateien; hochgeladene Inhalte bekommen ein verkleinertes Vorschaubild. */
    var inhalte = [
      { id: 'M-501', creatorId: 'C-2041', kampagnenId: 'K-118', art: 'video', titel: 'Morgenroutine Reel',
        netz: 'Instagram', eingang: tageHer(24), status: 'frei', ph: '#2C4A3A', dauer: 27, groesse: 41 * 1048576,
        pruefung: { kennz: true, heil: true, musik: true, dritte: true },
        rechteKanaele: ['organisch', 'eigenkanal', 'anzeige'], rechteBis: tageHin(43),
        leistung: { aufrufe: 184300, interaktionen: 9120, klicks: 1740 } },

      { id: 'M-504', creatorId: 'C-2041', kampagnenId: 'K-118', art: 'video', titel: 'Vier Wochen später',
        netz: 'TikTok', eingang: tageHer(23), status: 'frei', ph: '#3A5240', dauer: 31, groesse: 58 * 1048576,
        pruefung: { kennz: true, heil: true, musik: true, dritte: true },
        rechteKanaele: ['organisch', 'eigenkanal', 'anzeige'], rechteBis: tageHin(43),
        leistung: { aufrufe: 412700, interaktionen: 24880, klicks: 3260 } },

      { id: 'M-507', creatorId: 'C-2041', kampagnenId: 'K-118', art: 'bild', titel: 'Standbild Napf quer',
        netz: 'Instagram', eingang: tageHer(23), status: 'frei', ph: '#7C6A4E', groesse: 2.4 * 1048576,
        pruefung: { kennz: true, heil: true, musik: true, dritte: true },
        rechteKanaele: ['organisch', 'eigenkanal', 'anzeige'], rechteBis: tageHin(43),
        leistung: { aufrufe: 0, interaktionen: 0, klicks: 0 } },

      { id: 'M-512', creatorId: 'C-2058', kampagnenId: 'K-124', art: 'video', titel: 'Integration Senior-Video',
        netz: 'YouTube', eingang: tageHer(7), status: 'frei', ph: '#24413A', dauer: 82, groesse: 186 * 1048576,
        pruefung: { kennz: true, heil: true, musik: true, dritte: true },
        rechteKanaele: ['organisch', 'eigenkanal'], rechteBis: tageHin(361),
        leistung: { aufrufe: 96400, interaktionen: 4110, klicks: 2280 } },

      { id: 'M-518', creatorId: 'C-2063', kampagnenId: 'K-131', art: 'video', titel: 'Herbstreel Balu',
        netz: 'Instagram', eingang: tageHer(2), status: 'pruefung', ph: '#4A5A44', dauer: 24, groesse: 37 * 1048576,
        pruefung: { kennz: false, heil: false, musik: false, dritte: false },
        rechteKanaele: ['organisch', 'eigenkanal'], rechteBis: null,
        leistung: { aufrufe: 0, interaktionen: 0, klicks: 0 } },

      { id: 'M-519', creatorId: 'C-2063', kampagnenId: 'K-131', art: 'bild', titel: 'Story-Standbild',
        netz: 'Instagram', eingang: tageHer(2), status: 'pruefung', ph: '#6E7A5A', groesse: 1.7 * 1048576,
        pruefung: { kennz: false, heil: false, musik: false, dritte: false },
        rechteKanaele: ['organisch', 'eigenkanal'], rechteBis: null,
        leistung: { aufrufe: 0, interaktionen: 0, klicks: 0 } },

      /* Bewusst abgelehnt – zeigt den Ablehnungsgrund im Creator-Bereich. */
      { id: 'M-497', creatorId: 'C-2079', kampagnenId: null, art: 'video', titel: 'Erster Testclip',
        netz: 'TikTok', eingang: tageHer(11), status: 'abgelehnt', ph: '#5C4A44', dauer: 18, groesse: 29 * 1048576,
        grund: 'Im Text fällt „hilft bei Arthrose“. Krankheitsbezogene Aussagen sind bei Ergänzungsfuttermitteln nicht erlaubt – bitte auf „unterstützt die Beweglichkeit“ ändern und neu hochladen. Außerdem stand die Werbekennzeichnung erst am Ende der Bildunterschrift.',
        pruefung: { kennz: false, heil: false, musik: true, dritte: true },
        rechteKanaele: [], rechteBis: null,
        leistung: { aufrufe: 0, interaktionen: 0, klicks: 0 } },

      /* ⚠️ Der wichtige Fall: freigegeben, Anzeigenrecht, aber ABGELAUFEN. */
      { id: 'M-462', creatorId: 'C-2041', kampagnenId: 'K-109', art: 'video', titel: 'Sommerreel',
        netz: 'Instagram', eingang: tageHer(222), status: 'frei', ph: '#5A6B48', dauer: 22, groesse: 44 * 1048576,
        pruefung: { kennz: true, heil: true, musik: true, dritte: true },
        rechteKanaele: ['organisch', 'eigenkanal', 'anzeige'], rechteBis: tageHer(36),
        leistung: { aufrufe: 233900, interaktionen: 11400, klicks: 2010 } }
    ];

    // [creatorId, tageHer, kundeId, bruttoWarenwert, storniert]
    var roh = [
      ['C-2041', 150, 'K-401', 79.95, false], ['C-2041', 141, 'K-404', 49.95, false],
      ['C-2041', 132, 'K-407', 27.95, false], ['C-2041', 120, 'K-401', 49.95, false],
      ['C-2041', 111, 'K-412', 114.95, false], ['C-2041', 98, 'K-415', 59.95, true],
      ['C-2041', 88, 'K-418', 84.95, false],  ['C-2041', 74, 'K-421', 169.95, false],
      ['C-2041', 61, 'K-412', 44.95, false],  ['C-2041', 47, 'K-427', 99.95, false],
      ['C-2041', 36, 'K-430', 49.95, false],  ['C-2041', 24, 'K-433', 129.95, false],
      ['C-2041', 21, 'K-436', 79.95, false],  ['C-2041', 18, 'K-439', 54.95, false],
      ['C-2041', 14, 'K-442', 89.95, false],  ['C-2041', 9,  'K-445', 44.95, false],
      ['C-2041', 5,  'K-433', 39.95, false],  ['C-2041', 2,  'K-451', 119.95, false],

      ['C-2058', 60, 'K-460', 99.95, false],  ['C-2058', 41, 'K-463', 149.95, false],
      ['C-2058', 22, 'K-466', 79.95, false],  ['C-2058', 12, 'K-469', 199.95, false],
      ['C-2058', 6,  'K-460', 59.95, false],  ['C-2058', 3,  'K-475', 89.95, false],
      ['C-2058', 1,  'K-478', 129.95, false],

      ['C-2063', 30, 'K-480', 44.95, false],  ['C-2063', 19, 'K-483', 27.95, false],
      ['C-2063', 8,  'K-486', 69.95, false],

      ['C-2071', 12, 'K-490', 49.95, false],  ['C-2071', 4, 'K-493', 79.95, false],

      ['C-2079', 15, 'K-495', 27.95, false]
    ];

    var bestellungen = roh.map(function (r, i) {
      var brutto = r[3];
      var nachRabatt = Math.round(brutto * (1 - REGELN.kundenrabatt) * 100) / 100;
      var netto = Math.round((nachRabatt / 1.19) * 100) / 100;
      return {
        id: 'B-' + (7100 + i), creatorId: r[0], datum: tageHer(r[1]), kundeId: r[2],
        brutto: brutto, nachRabatt: nachRabatt, netto: netto, storniert: r[4]
      };
    });

    var auszahlungen = [
      { id: 'GS-2026-0031', creatorId: 'C-2041', datum: tageHer(44), betrag: 812.40, beleg: 'GS-2026-0031',
        beteiligung: 62.40, honorar: 750, praemie: 0 },
      { id: 'GS-2026-0038', creatorId: 'C-2058', datum: tageHer(14), betrag: 1248.60, beleg: 'GS-2026-0038',
        beteiligung: 48.60, honorar: 1200, praemie: 0 }
    ];

    var bewerbungen = [
      { id: 'BC-9014', name: 'Nele Fricke', kuenstlername: 'nele.mit.hund', email: 'nele@beispiel.de',
        telefon: '0511 2298450', ort: 'Hannover', land: 'DE', eingang: tageHer(3), status: 'offen',
        ueber: 'Zwei Australian Shepherds, Schwerpunkt Bewegung und Hundesport. Poste seit vier Jahren.',
        wunsch: 'kooperation',
        plattformen: [
          { netz: 'Instagram', handle: '@nele.mit.hund', follower: 27400, engagement: 0.046, url: 'https://instagram.com/nele.mit.hund' },
          { netz: 'TikTok', handle: '@nelemithund', follower: 44900, engagement: 0.061, url: '' }
        ],
        beispiele: [{ name: 'mediakit-nele-2026.pdf', groesse: 3.1 * 1048576 }],
        kleinunternehmer: false },

      { id: 'BC-9016', name: 'Tobias Reh', kuenstlername: 'Rehleben', email: 'kontakt@beispiel.de',
        telefon: '0351 8874120', ort: 'Dresden', land: 'DE', eingang: tageHer(2), status: 'offen',
        ueber: 'Podcast über Hundegesundheit, dazu ein kleiner Instagram-Kanal. Publikum eher älter.',
        wunsch: 'code',
        plattformen: [
          { netz: 'Podcast', handle: 'Rehleben – der Hundepodcast', follower: 12800, engagement: 0, url: '' },
          { netz: 'Instagram', handle: '@rehleben', follower: 5200, engagement: 0.033, url: '' }
        ],
        beispiele: [], kleinunternehmer: true },

      { id: 'BC-9019', name: 'Mia Kluge', kuenstlername: 'miakluge', email: 'mia@beispiel.de',
        telefon: '', ort: 'Berlin', land: 'DE', eingang: tageHer(1), status: 'offen',
        ueber: 'Lifestyle-Account, Hund kommt gelegentlich vor. Sehr breite Zielgruppe.',
        wunsch: 'seeding',
        plattformen: [
          { netz: 'Instagram', handle: '@miakluge', follower: 148000, engagement: 0.008, url: '' }
        ],
        beispiele: [], kleinunternehmer: false,
        hinweis: 'Sehr große Reichweite bei sehr niedriger Interaktion (0,8 %) und ohne Hundebezug – genau der Fall, den wir beim letzten Anlauf zu oft hatten.' }
    ];

    return {
      creator: creator, kampagnen: kampagnen, inhalte: inhalte,
      bestellungen: bestellungen, auszahlungen: auszahlungen, bewerbungen: bewerbungen,
      belegZaehler: 39
    };
  }

  // ---------------------------------------------------------------
  // 4. Zustand
  // ---------------------------------------------------------------
  var Z = null;

  function laden() {
    try {
      var roh = localStorage.getItem(SPEICHER);
      if (roh) Z = JSON.parse(roh);
    } catch (e) { Z = null; }
    if (!Z || !Z.creator) { Z = demodaten(); speichern(); }
    if (!Z.inhalte) Z.inhalte = [];
    if (!Z.kampagnen) Z.kampagnen = [];
    Z.creator.forEach(function (c) { if (!c.plattformen) c.plattformen = []; });
    uebernehmeNeueBewerbungen();
  }
  function speichern() {
    try { localStorage.setItem(SPEICHER, JSON.stringify(Z)); return true; }
    catch (e) { return false; }
  }
  function zuruecksetzen() {
    try { localStorage.removeItem(SPEICHER); localStorage.removeItem(SPEICHER_BEWERBUNGEN); } catch (e) {}
    Z = demodaten(); speichern();
  }
  function uebernehmeNeueBewerbungen() {
    var neue = [];
    try { neue = JSON.parse(localStorage.getItem(SPEICHER_BEWERBUNGEN) || '[]'); } catch (e) { return; }
    if (!neue.length) return;
    var da = {};
    Z.bewerbungen.forEach(function (b) { da[b.id] = true; });
    var n = 0;
    neue.forEach(function (b) {
      if (da[b.id]) return;
      Z.bewerbungen.unshift({
        id: b.id, name: b.name, kuenstlername: b.kuenstlername || '', email: b.email,
        telefon: b.telefon || '', ort: b.ort || '', land: b.land || 'DE',
        ueber: b.ueber || '', wunsch: b.wunsch || '', plattformen: b.plattformen || [],
        beispiele: b.beispiele || [], kleinunternehmer: !!b.kleinunternehmer,
        eingang: b.eingang, status: 'offen', ausFormular: true
      });
      n++;
    });
    if (n) speichern();
  }

  // ---------------------------------------------------------------
  // 5. Auswertung
  // ---------------------------------------------------------------
  function creatorVon(id) {
    for (var i = 0; i < Z.creator.length; i++) if (Z.creator[i].id === id) return Z.creator[i];
    return null;
  }
  function kampagneVon(id) {
    for (var i = 0; i < Z.kampagnen.length; i++) if (Z.kampagnen[i].id === id) return Z.kampagnen[i];
    return null;
  }
  function reichweiteVon(c) {
    return (c.plattformen || []).reduce(function (s, p) { return s + (p.follower || 0); }, 0);
  }

  /** Nutzungsrechte-Zustand eines Inhalts – der Kern der Ablaufwarnung. */
  function rechteStatus(inhalt) {
    if (inhalt.status !== 'frei' || !inhalt.rechteBis) return { art: 'keine', text: 'Noch keine Rechte vereinbart' };
    var tage = tageBis(inhalt.rechteBis);
    var kritisch = (inhalt.rechteKanaele || []).some(function (k) { return KANAL_KRITISCH.indexOf(k) >= 0; });
    if (tage < 0) {
      return {
        art: kritisch ? 'abgelaufen-kritisch' : 'abgelaufen', tage: tage, kritisch: kritisch,
        text: kritisch
          ? 'Abgelaufen seit ' + Math.abs(tage) + ' Tagen – Anzeigen mit diesem Inhalt müssen gestoppt sein'
          : 'Abgelaufen seit ' + Math.abs(tage) + ' Tagen'
      };
    }
    if (tage <= REGELN.rechteWarnungTage) {
      return { art: 'laeuft-ab', tage: tage, kritisch: kritisch, text: 'Läuft in ' + tage + ' Tagen ab' };
    }
    return { art: 'gueltig', tage: tage, kritisch: kritisch, text: 'Gültig bis ' + datum(inhalt.rechteBis) };
  }

  /**
   * Rechnet einen Creator komplett durch.
   * Stufe wird aus dem Stand VOR der jeweiligen Bestellung bestimmt, damit eine
   * alte Abrechnung nachvollziehbar bleibt, auch wenn er später aufsteigt.
   */
  function berechneCreator(creatorId) {
    var liste = Z.bestellungen
      .filter(function (b) { return b.creatorId === creatorId; })
      .sort(function (a, b) { return new Date(a.datum) - new Date(b.datum); });

    /* Für die Stufe zählen freigegebene Inhalte, die VOR der Bestellung da waren. */
    var freigaben = Z.inhalte
      .filter(function (c) { return c.creatorId === creatorId && c.status === 'frei'; })
      .map(function (c) { return new Date(c.eingang).getTime(); })
      .sort(function (a, b) { return a - b; });

    var zUmsatz = 0;
    var ersterKauf = {};
    var grenzeMs = REGELN.folgekaufMonate * 30.44 * 86400000;

    var ergebnis = liste.map(function (b) {
      var t = new Date(b.datum).getTime();
      var inhalteBisDahin = freigaben.filter(function (f) { return f <= t; }).length;
      var stufe = stufeFuer(inhalteBisDahin, zUmsatz);
      var satz = stufe.satz;

      var folgekauf = false;
      if (ersterKauf[b.kundeId]) {
        if (new Date(b.datum) - new Date(ersterKauf[b.kundeId]) <= grenzeMs) folgekauf = true;
      } else {
        ersterKauf[b.kundeId] = b.datum;
      }

      var beteiligung = b.storniert ? 0 : b.netto * satz * (folgekauf ? REGELN.folgekaufFaktor : 1);
      beteiligung = Math.round(beteiligung * 100) / 100;
      if (!b.storniert) zUmsatz += b.netto;

      var alter = tageSeit(b.datum);
      var status = b.storniert ? 'storniert' : (alter >= REGELN.sperrfristTage ? 'auszahlbar' : 'in-pruefung');

      return Object.assign({}, b, {
        stufeName: stufe.name, satz: satz, folgekauf: folgekauf,
        beteiligung: beteiligung, status: status,
        auszahlbarInTagen: Math.max(0, REGELN.sperrfristTage - alter)
      });
    });

    var gueltig = ergebnis.filter(function (b) { return !b.storniert; });
    var umsatzNetto = gueltig.reduce(function (s, b) { return s + b.netto; }, 0);
    var betGesamt = ergebnis.reduce(function (s, b) { return s + b.beteiligung; }, 0);
    var betAuszahlbar = ergebnis.filter(function (b) { return b.status === 'auszahlbar'; })
                                .reduce(function (s, b) { return s + b.beteiligung; }, 0);
    var betPruefung = ergebnis.filter(function (b) { return b.status === 'in-pruefung'; })
                              .reduce(function (s, b) { return s + b.beteiligung; }, 0);

    var meineKamp = Z.kampagnen.filter(function (k) { return k.creatorId === creatorId; });
    var abgenommen = meineKamp.filter(function (k) { return k.status === 'abgenommen'; });
    var honorarGesamt = abgenommen.reduce(function (s, k) { return s + (k.honorar || 0); }, 0);

    var ausgezahlt = Z.auszahlungen
      .filter(function (a) { return a.creatorId === creatorId; })
      .reduce(function (s, a) { return s + a.betrag; }, 0);

    var meineInhalte = Z.inhalte.filter(function (c) { return c.creatorId === creatorId; });
    var frei = meineInhalte.filter(function (c) { return c.status === 'frei'; });

    var aufrufe = frei.reduce(function (s, c) { return s + (c.leistung ? c.leistung.aufrufe : 0); }, 0);
    var interakt = frei.reduce(function (s, c) { return s + (c.leistung ? c.leistung.interaktionen : 0); }, 0);
    var klicks = frei.reduce(function (s, c) { return s + (c.leistung ? c.leistung.klicks : 0); }, 0);

    /* Seeding-Quote: von wie vielen versendeten Paketen kam Inhalt zurück?
       Bei Barter-Modellen die entscheidende Zahl – und die, die keiner misst. */
    var mitVersand = meineKamp.filter(function (k) { return k.seeding && k.seeding.versandAm; });
    var mitInhalt = mitVersand.filter(function (k) {
      return Z.inhalte.some(function (c) { return c.kampagnenId === k.id; });
    });
    var seedingWert = mitVersand.reduce(function (s, k) { return s + (k.seeding.wert || 0); }, 0);

    var c = creatorVon(creatorId) || {};
    var guthaben = betGesamt + honorarGesamt;

    return {
      bestellungen: ergebnis.slice().reverse(),
      anzahl: gueltig.length,
      stornos: ergebnis.length - gueltig.length,
      umsatzNetto: umsatzNetto,
      umsatzBrutto: gueltig.reduce(function (s, b) { return s + b.nachRabatt; }, 0),
      stufe: stufeFuer(frei.length, umsatzNetto),
      naechste: naechsteStufe(frei.length, umsatzNetto),
      betGesamt: betGesamt, betAuszahlbar: betAuszahlbar, betPruefung: betPruefung,
      honorarGesamt: honorarGesamt,
      kampagnen: meineKamp,
      kampagnenOffen: meineKamp.filter(function (k) {
        return k.status === 'angeboten' || k.status === 'zugesagt' || k.status === 'inhalt-da';
      }).length,
      inhalte: meineInhalte,
      inhalteFrei: frei.length,
      inhaltePruefung: meineInhalte.filter(function (c2) { return c2.status === 'pruefung'; }).length,
      aufrufe: aufrufe, interaktionen: interakt, klicks: klicks,
      seedingVersand: mitVersand.length, seedingGeliefert: mitInhalt.length, seedingWert: seedingWert,
      reichweite: reichweiteVon(c),
      guthabenGesamt: guthaben,
      auszahlbar: Math.max(0, betAuszahlbar + honorarGesamt - ausgezahlt),
      ausgezahlt: ausgezahlt
    };
  }

  function imZeitraum(a, tage) {
    if (!tage) return { anzahl: a.anzahl, umsatz: a.umsatzNetto, beteiligung: a.betGesamt };
    var grenze = Date.now() - tage * 86400000;
    var liste = a.bestellungen.filter(function (b) {
      return !b.storniert && new Date(b.datum).getTime() >= grenze;
    });
    return {
      anzahl: liste.length,
      umsatz: liste.reduce(function (s, b) { return s + b.netto; }, 0),
      beteiligung: liste.reduce(function (s, b) { return s + b.beteiligung; }, 0)
    };
  }

  // ---------------------------------------------------------------
  // 6. Anmeldung
  // ---------------------------------------------------------------
  var ZUGAENGE = {
    'lena@beispiel.de':              { pw: 'demo1234', rolle: 'creator', creatorId: 'C-2041' },
    'creator@natureflow-pets.com':    { pw: 'demo1234', rolle: 'admin', name: 'Verwaltung' }
  };
  var sitzung = null;

  function anmelden(mail, pw) {
    var k = ZUGAENGE[String(mail || '').trim().toLowerCase()];
    if (!k || k.pw !== pw) return false;
    sitzung = Object.assign({ mail: mail }, k);
    return true;
  }
  function abmelden() {
    sitzung = null;
    el('#view-app').hidden = true;
    el('#view-login').hidden = false;
    el('#l-fehler').hidden = true;
  }

  // ---------------------------------------------------------------
  // 7. Navigation
  // ---------------------------------------------------------------
  var NAV_CREATOR = [
    { id: 'uebersicht', name: 'Übersicht', icon: 'i-dash' },
    { id: 'kampagnen', name: 'Meine Kampagnen', icon: 'i-mega' },
    { id: 'inhalte', name: 'Meine Inhalte', icon: 'i-image' },
    { id: 'code', name: 'Code und Link', icon: 'i-copy' },
    { id: 'verdienst', name: 'Verdienst', icon: 'i-euro' },
    { id: 'material', name: 'Regeln und Material', icon: 'i-doc' },
    { id: 'profil', name: 'Mein Profil', icon: 'i-person' }
  ];
  var NAV_ADMIN = [
    { id: 'a-uebersicht', name: 'Übersicht', icon: 'i-dash' },
    { id: 'a-bewerbungen', name: 'Bewerbungen', icon: 'i-inbox' },
    { id: 'a-creator', name: 'Creator', icon: 'i-users' },
    { id: 'a-kampagnen', name: 'Kampagnen', icon: 'i-mega' },
    { id: 'a-inhalte', name: 'Inhalte prüfen', icon: 'i-image' },
    { id: 'a-rechte', name: 'Nutzungsrechte', icon: 'i-shield' },
    { id: 'a-abrechnung', name: 'Abrechnung', icon: 'i-euro' },
    { id: 'a-auswertung', name: 'Auswertung', icon: 'i-chart' }
  ];

  function offeneBewerbungen() {
    return Z.bewerbungen.filter(function (b) { return b.status === 'offen'; }).length;
  }
  function offeneInhalte() {
    return Z.inhalte.filter(function (c) { return c.status === 'pruefung'; }).length;
  }
  function kritischeRechte() {
    return Z.inhalte.filter(function (c) {
      var r = rechteStatus(c);
      return r.art === 'abgelaufen-kritisch' || (r.art === 'laeuft-ab' && r.kritisch);
    }).length;
  }
  function offeneKampagnen() {
    return Z.kampagnen.filter(function (k) {
      return k.status === 'angeboten' || k.status === 'zugesagt' || k.status === 'inhalt-da';
    }).length;
  }

  function bauNavigation() {
    var liste = sitzung.rolle === 'admin' ? NAV_ADMIN : NAV_CREATOR;
    el('#side-lbl').textContent = sitzung.rolle === 'admin' ? 'Verwaltung' : 'Mein Bereich';
    el('#nav-list').innerHTML = liste.map(function (n) {
      var z = '';
      if (n.id === 'a-bewerbungen' && offeneBewerbungen()) z = offeneBewerbungen();
      if (n.id === 'a-inhalte' && offeneInhalte()) z = offeneInhalte();
      if (n.id === 'a-rechte' && kritischeRechte()) z = kritischeRechte();
      if (n.id === 'kampagnen' && sitzung.creatorId) {
        var o = Z.kampagnen.filter(function (k) {
          return k.creatorId === sitzung.creatorId &&
                 (k.status === 'angeboten' || k.status === 'zugesagt');
        }).length;
        if (o) z = o;
      }
      return '<li><button class="navlink" data-seite="' + n.id + '">' +
        '<svg viewBox="0 0 24 24" width="19" height="19"><use href="#' + n.icon + '"/></svg>' +
        '<span>' + esc(n.name) + '</span>' +
        (z ? '<span class="navlink__z">' + z + '</span>' : '') +
        '</button></li>';
    }).join('');
    alle('.navlink').forEach(function (b) {
      b.addEventListener('click', function () { zeige(b.getAttribute('data-seite')); });
    });
  }

  var aktuelleSeite = null;
  var detailCreator = null;
  var detailKampagne = null;

  function zeige(seite) {
    aktuelleSeite = seite;
    alle('.navlink').forEach(function (b) {
      b.setAttribute('data-an', b.getAttribute('data-seite') === seite ? 'true' : 'false');
    });
    var m = el('#main');
    var bauer = {
      'uebersicht': seiteUebersicht, 'kampagnen': seiteKampagnen, 'inhalte': seiteInhalte,
      'code': seiteCode, 'verdienst': seiteVerdienst, 'material': seiteMaterial, 'profil': seiteProfil,
      'a-uebersicht': seiteAdminUebersicht, 'a-bewerbungen': seiteBewerbungen, 'a-creator': seiteCreatorListe,
      'a-creator-detail': seiteCreatorDetail, 'a-kampagnen': seiteAdminKampagnen,
      'a-kampagne-detail': seiteKampagneDetail,
      'a-inhalte': seiteAdminInhalte, 'a-rechte': seiteRechte,
      'a-abrechnung': seiteAbrechnung, 'a-auswertung': seiteAuswertung
    }[seite];
    m.innerHTML = bauer ? bauer() : '<p class="empty">Nicht gefunden.</p>';
    m.scrollTop = 0;
    verdrahte();
    if (window.innerWidth <= 900) el('#side').setAttribute('data-offen', 'false');
  }

  // ---------------------------------------------------------------
  // 8. Bausteine
  // ---------------------------------------------------------------
  function kpi(label, wert, notiz, gold) {
    return '<div class="kpi' + (gold ? ' kpi--gold' : '') + '">' +
      '<p class="kpi__l">' + esc(label) + '</p><p class="kpi__v">' + wert + '</p>' +
      (notiz ? '<p class="kpi__n">' + notiz + '</p>' : '') + '</div>';
  }
  function tag(art, text) {
    return '<span class="tag tag--' + art + '">' + esc(text) + '</span>';
  }
  function netzIcon(netz) {
    var m = { 'Instagram': 'i-insta', 'TikTok': 'i-tiktok', 'YouTube': 'i-yt', 'Facebook': 'i-fb',
              'Podcast': 'i-mic', 'Website oder Blog': 'i-globe', 'Newsletter': 'i-mail' };
    return '<svg viewBox="0 0 24 24" width="15" height="15"><use href="#' + (m[netz] || 'i-globe') + '"/></svg>';
  }
  function plattformChips(liste, grenze) {
    liste = liste || [];
    var zeig = grenze ? liste.slice(0, grenze) : liste;
    var rest = liste.length - zeig.length;
    var s = zeig.map(function (p) {
      return '<span class="chip chip--sm">' + netzIcon(p.netz) +
        '<span class="chip__h">' + esc(p.handle) + '</span>' +
        '<span class="chip__f">' + kurz(p.follower) + '</span></span>';
    }).join('');
    if (rest > 0) s += '<span class="chip chip--sm chip--rest">+' + rest + '</span>';
    return '<span class="chips">' + (s || '<span class="muted">keine Angabe</span>') + '</span>';
  }
  var KAMP_STATUS = {
    'angeboten': { art: 'warn', text: 'Angeboten' },
    'zugesagt': { art: 'mute', text: 'Zugesagt' },
    'inhalt-da': { art: 'warn', text: 'Inhalt eingereicht' },
    'abgenommen': { art: 'ok', text: 'Abgenommen' },
    'abgelehnt': { art: 'err', text: 'Abgelehnt' }
  };
  function kampStatusTag(k) {
    var s = KAMP_STATUS[k.status] || { art: 'mute', text: k.status };
    return tag(s.art, s.text);
  }
  function inhaltTag(c) {
    if (c.status === 'frei') return tag('ok', 'Freigegeben');
    if (c.status === 'abgelehnt') return tag('err', 'Nicht verwendbar');
    return tag('warn', 'In Prüfung');
  }
  function rechteTag(c) {
    var r = rechteStatus(c);
    if (r.art === 'abgelaufen-kritisch') return tag('err', 'Rechte abgelaufen');
    if (r.art === 'abgelaufen') return tag('mute', 'Rechte abgelaufen');
    if (r.art === 'laeuft-ab') return tag('warn', r.tage + ' Tage Restlaufzeit');
    if (r.art === 'gueltig') return tag('ok', 'Rechte gültig');
    return tag('mute', 'Keine Rechte');
  }
  function kanalNamen(ids) {
    return (ids || []).map(function (id) {
      for (var i = 0; i < KANAELE.length; i++) if (KANAELE[i].id === id) return KANAELE[i].name;
      return id;
    });
  }
  /** Tausend-Kontakt-Preis: was kostet uns 1.000 Aufrufe über diesen Inhalt? */
  function tkp(kosten, aufrufe) {
    if (!aufrufe) return null;
    return kosten / (aufrufe / 1000);
  }

  function inhaltKachel(c, mitCreator, mitAktionen) {
    var cr = creatorVon(c.creatorId);
    var k = c.kampagnenId ? kampagneVon(c.kampagnenId) : null;
    var r = rechteStatus(c);
    var warn = (r.art === 'abgelaufen-kritisch');
    var l = c.leistung || {};
    return '<article class="med' + (warn ? ' med--warn' : '') + '" data-inhalt="' + c.id + '">' +
      '<div class="med__bild" style="background:' + (c.vorschau ? 'transparent' : esc(c.ph || '#3A5240')) + '">' +
        (c.vorschau ? '<img src="' + esc(c.vorschau) + '" alt="">' : '') +
        '<span class="med__art">' + (c.art === 'video'
          ? '<svg viewBox="0 0 24 24" width="14" height="14"><use href="#i-play"/></svg>Video'
          : '<svg viewBox="0 0 24 24" width="14" height="14"><use href="#i-image"/></svg>Bild') +
          (c.dauer ? ' · ' + dauerText(c.dauer) : '') + '</span>' +
      '</div>' +
      '<div class="med__txt">' +
        '<div class="med__kopf"><strong>' + esc(c.titel) + '</strong>' + inhaltTag(c) + '</div>' +
        '<p class="small muted">' + (mitCreator && cr ? esc(cr.kuenstlername) + ' · ' : '') +
          esc(c.netz) + ' · ' + datum(c.eingang) + ' · ' + mb(c.groesse) + '</p>' +
        (k ? '<p class="small muted">Kampagne ' + esc(k.id) + ' · ' + esc(k.titel) + '</p>' : '') +
        (c.status === 'frei'
          ? '<p class="med__rechte">' + rechteTag(c) + '<span class="small muted">' + esc(r.text) + '</span></p>' +
            (l.aufrufe ? '<p class="small">' + kurz(l.aufrufe) + ' Aufrufe · ' + kurz(l.interaktionen) +
                ' Interaktionen · ' + kurz(l.klicks) + ' Klicks</p>' : '')
          : '') +
        (c.status === 'abgelehnt' && c.grund
          ? '<p class="med__grund"><strong>Grund:</strong> ' + esc(c.grund) + '</p>' : '') +
        (mitAktionen && c.status === 'pruefung'
          ? '<div class="med__act"><button class="btn btn--sm btn--primary" data-pruef="' + c.id + '">Prüfen</button></div>'
          : '') +
      '</div></article>';
  }

  // ---------------------------------------------------------------
  // 9. Creator-Seiten
  // ---------------------------------------------------------------
  function seiteUebersicht() {
    var c = creatorVon(sitzung.creatorId);
    var a = berechneCreator(c.id);
    var n = a.naechste;
    var offen = a.kampagnen.filter(function (k) { return k.status === 'angeboten'; });

    var s = '<div class="head"><div><h1>Hallo ' + esc(c.name.split(' ')[0]) + '</h1>' +
      '<p class="muted">' + esc(c.kuenstlername) + ' · dabei seit ' + datum(c.seit) + '</p></div>' +
      '<div class="head__act"><span class="stufe__badge">' + esc(a.stufe.name) + ' · ' +
      proz(a.stufe.satz, 0) + '</span></div></div>';

    if (offen.length) {
      s += '<div class="note note--gold"><strong>' + offen.length +
        (offen.length === 1 ? ' neue Anfrage' : ' neue Anfragen') + ' für dich.</strong> ' +
        'Schau unter „Meine Kampagnen“ – du kannst zusagen oder ablehnen, ohne dich zu erklären.</div>';
    }

    s += '<div class="kpis">' +
      kpi('Auszahlbar', eur(a.auszahlbar), 'nach Ablauf der Widerrufsfrist', true) +
      kpi('Bisher verdient', eur(a.guthabenGesamt), 'Honorare und Beteiligung zusammen') +
      kpi('Vermittelte Bestellungen', zahl(a.anzahl), a.stornos ? a.stornos + ' storniert' : 'keine Stornos') +
      kpi('Freigegebene Inhalte', zahl(a.inhalteFrei), a.inhaltePruefung ? a.inhaltePruefung + ' in Prüfung' : 'nichts offen') +
      '</div>';

    s += '<div class="grid2">';
    s += '<section class="card"><div class="card__hd"><h2>Deine Stufe</h2></div>' +
      '<p class="stufe">Du bist <strong>' + esc(a.stufe.name) + '</strong> und bekommst ' +
      proz(a.stufe.satz, 0) + ' vom Warenwert deiner vermittelten Bestellungen.</p>';
    if (n) {
      s += '<div class="rank"><div class="rank__row"><span>Nächste Stufe: <strong>' + esc(n.ziel.name) +
        '</strong> mit ' + proz(n.ziel.satz, 0) + '</span><span class="muted">' + proz(n.anteil, 0) + '</span></div>' +
        '<div class="rank__bar"><div class="rank__f" style="width:' + Math.max(3, Math.round(n.anteil * 100)) + '%"></div></div>' +
        '<p class="small muted">Es fehlen noch ' + n.fehltInhalte + ' freigegebene Inhalte oder ' +
        eur0(n.fehltUmsatz) + ' Warenwert – was zuerst erreicht ist, zählt.</p></div>';
    } else {
      s += '<p class="small muted">Du bist auf der höchsten Stufe. Danke dafür.</p>';
    }
    s += '</section>';

    s += '<section class="card"><div class="card__hd"><h2>Dein Code</h2></div>' +
      '<div class="codebox"><span class="codebox__c">' + esc(c.code) + '</span>' +
      '<button class="btn btn--sm btn--ghost" data-kopier="' + esc(c.code) + '">' +
      '<svg><use href="#i-copy"/></svg>Kopieren</button></div>' +
      '<p class="small muted">10 % für deine Community, Beteiligung für dich. Funktioniert auch dort, ' +
      'wo du keinen Link setzen kannst – also im Video selbst.</p></section>';
    s += '</div>';

    if (a.aufrufe) {
      s += '<section class="card"><div class="card__hd"><h2>Was deine Inhalte bisher erreicht haben</h2>' +
        '<span class="small muted">alle freigegebenen Inhalte, Demodaten</span></div>' +
        '<div class="minis">' +
        '<div class="mini"><p class="mini__l">Aufrufe</p><p class="mini__v">' + kurz(a.aufrufe) + '</p></div>' +
        '<div class="mini"><p class="mini__l">Interaktionen</p><p class="mini__v">' + kurz(a.interaktionen) + '</p></div>' +
        '<div class="mini"><p class="mini__l">Klicks auf den Link</p><p class="mini__v">' + kurz(a.klicks) + '</p></div>' +
        '<div class="mini"><p class="mini__l">Bestellungen</p><p class="mini__v">' + zahl(a.anzahl) + '</p></div>' +
        '</div></section>';
    }
    return s;
  }

  function seiteKampagnen() {
    var c = creatorVon(sitzung.creatorId);
    var liste = Z.kampagnen.filter(function (k) { return k.creatorId === c.id; })
      .sort(function (a, b) { return new Date(b.start) - new Date(a.start); });

    var s = '<div class="head"><div><h1>Meine Kampagnen</h1>' +
      '<p class="muted">Jede Kampagne ist ein eigener Auftrag mit Termin, Honorar und vereinbarten Nutzungsrechten.</p></div></div>';

    if (!liste.length) return s + '<p class="empty">Noch keine Kampagne. Wir melden uns, sobald etwas passt.</p>';

    s += '<div class="kampliste">';
    liste.forEach(function (k) {
      var tageOffen = tageBis(k.deadline);
      var eilig = (k.status === 'zugesagt' && tageOffen >= 0 && tageOffen <= 7);
      var ueberfaellig = (k.status === 'zugesagt' && tageOffen < 0);
      s += '<article class="kamp' + (ueberfaellig ? ' kamp--warn' : '') + '">' +
        '<div class="kamp__hd"><div><h2>' + esc(k.titel) + '</h2>' +
          '<p class="small muted">' + esc(k.id) + ' · Abgabe bis ' + datum(k.deadline) +
          (k.status === 'zugesagt'
            ? (ueberfaellig ? ' · <strong>' + Math.abs(tageOffen) + ' Tage überfällig</strong>'
                            : ' · noch ' + tageOffen + ' Tage')
            : '') + '</p></div>' +
          '<div class="kamp__tags">' + kampStatusTag(k) +
          (eilig ? tag('warn', 'wird knapp') : '') + '</div></div>' +
        '<div class="kamp__grid">' +
          '<div><p class="kamp__lbl">Honorar</p><p class="kamp__val">' + eur0(k.honorar) + '</p>' +
            '<p class="small muted">zzgl. Beteiligung auf deinen Code</p></div>' +
          '<div><p class="kamp__lbl">Nutzungsrechte</p><p class="kamp__val kamp__val--sm">' +
            esc(kanalNamen(k.rechteKanaele).join(', ')) + '</p>' +
            '<p class="small muted">' + k.rechteMonate + ' Monate ab Abnahme</p></div>' +
          (k.seeding ? '<div><p class="kamp__lbl">Produkt</p><p class="kamp__val kamp__val--sm">' +
            esc(k.seeding.artikel) + '</p><p class="small muted">' +
            (k.seeding.versandAm ? 'versendet am ' + datum(k.seeding.versandAm) : 'wird versendet, sobald du zusagst') +
            '</p></div>' : '') +
        '</div>' +
        '<details class="acc"><summary>Briefing lesen</summary>' +
          '<p class="kamp__brief">' + esc(k.briefing) + '</p>' +
          '<p class="kamp__lbl" style="margin-top:1rem">Was wir brauchen</p>' +
          '<ul class="ticks ticks--sm">' + k.leistungen.map(function (t) {
            return '<li><span>' + esc(t) + '</span></li>'; }).join('') + '</ul>' +
        '</details>' +
        (k.status === 'angeboten'
          ? '<div class="kamp__act"><button class="btn btn--sm btn--primary" data-kamp-ja="' + k.id + '">Zusagen</button>' +
            '<button class="btn btn--sm btn--ghost" data-kamp-nein="' + k.id + '">Passt gerade nicht</button></div>'
          : '') +
        (k.status === 'zugesagt'
          ? '<div class="kamp__act"><button class="btn btn--sm btn--primary" data-zu-inhalten="1">Inhalt hochladen</button></div>'
          : '') +
        '</article>';
    });
    s += '</div>';
    return s;
  }

  function seiteInhalte() {
    var c = creatorVon(sitzung.creatorId);
    var meine = Z.inhalte.filter(function (x) { return x.creatorId === c.id; })
      .sort(function (a, b) { return new Date(b.eingang) - new Date(a.eingang); });
    var kamp = Z.kampagnen.filter(function (k) {
      return k.creatorId === c.id && (k.status === 'zugesagt' || k.status === 'inhalt-da');
    });

    var s = '<div class="head"><div><h1>Meine Inhalte</h1>' +
      '<p class="muted">Lade hier ab, was du produziert hast. Wir schauen es uns an und geben dir Rückmeldung.</p></div></div>';

    s += '<section class="card"><div class="card__hd"><h2>Neu hochladen</h2></div>' +
      '<div class="fld"><label for="up-kamp">Zu welcher Kampagne gehört das?</label>' +
      '<select id="up-kamp"><option value="">Ohne Kampagne – freies Material</option>' +
      kamp.map(function (k) { return '<option value="' + k.id + '">' + esc(k.id + ' · ' + k.titel) + '</option>'; }).join('') +
      '</select></div>' +
      '<div class="drop" id="up-drop" tabindex="0" role="button" aria-label="Dateien auswählen">' +
        '<svg class="drop__i"><use href="#i-upload"/></svg>' +
        '<p class="drop__t">Dateien hierher ziehen oder <span class="drop__link">auswählen</span></p>' +
        '<p class="small muted">Bilder und Videos bis ' + REGELN.maxDateiMB + ' MB</p>' +
        '<input type="file" id="up-datei" accept="image/*,video/*" multiple hidden>' +
      '</div>' +
      '<div class="queue" id="up-liste" hidden></div>' +
      '<label class="check"><input type="checkbox" id="up-rechte">' +
        '<span>Ich habe die Inhalte selbst erstellt und räume NatureFlow Pets die im Briefing genannten ' +
        'Nutzungsrechte ein. Abgebildete Personen haben eingewilligt, verwendete Musik darf gewerblich ' +
        'genutzt werden. Die Urheberrechte bleiben bei mir.</span></label>' +
      '<div class="msg msg--err" id="up-fehler" hidden role="alert"></div>' +
      '<button class="btn btn--primary" id="up-senden" disabled>Zur Prüfung einreichen</button>' +
      '<p class="small muted" style="margin-top:.7rem">Prototyp: Es wird nur ein verkleinertes Vorschaubild ' +
      'gemerkt, nicht die Datei selbst.</p></section>';

    s += '<h2 class="mt">Bisher eingereicht</h2>';
    if (!meine.length) {
      s += '<p class="empty">Noch nichts eingereicht.</p>';
    } else {
      s += '<div class="medgrid">' + meine.map(function (x) { return inhaltKachel(x, false, false); }).join('') + '</div>';
    }
    return s;
  }

  function seiteCode() {
    var c = creatorVon(sitzung.creatorId);
    var a = berechneCreator(c.id);
    var link = 'https://natureflow-pets.com/?code=' + c.code.toLowerCase();

    var s = '<div class="head"><div><h1>Code und Link</h1>' +
      '<p class="muted">Beides zahlt auf dasselbe Konto ein. Nimm, was in deinem Format funktioniert.</p></div></div>';

    s += '<div class="grid2">' +
      '<section class="card"><div class="card__hd"><h2>Dein Rabattcode</h2></div>' +
      '<div class="codebox"><span class="codebox__c">' + esc(c.code) + '</span>' +
      '<button class="btn btn--sm btn--ghost" data-kopier="' + esc(c.code) + '">' +
      '<svg><use href="#i-copy"/></svg>Kopieren</button></div>' +
      '<p class="small muted">Der Code ist der verlässlichere Weg: Er funktioniert im Video, im Podcast ' +
      'und im Gespräch – überall dort, wo niemand auf einen Link klicken kann. Und er hängt nicht ' +
      'davon ab, ob jemand Cookies zulässt.</p></section>' +

      '<section class="card"><div class="card__hd"><h2>Dein Link</h2></div>' +
      '<div class="codebox"><span class="codebox__c codebox__c--klein">' + esc(link) + '</span>' +
      '<button class="btn btn--sm btn--ghost" data-kopier="' + esc(link) + '">' +
      '<svg><use href="#i-copy"/></svg>Kopieren</button></div>' +
      '<p class="small muted">Für Linkliste, Beschreibung und Newsletter. Wenn jemand die Zustimmung ' +
      'zu Cookies ablehnt, kann die Zuordnung ausfallen – das ist kein Fehler, sondern die Technik. ' +
      'Deshalb nenne im Zweifel zusätzlich den Code.</p></section></div>';

    s += '<h2 class="mt">Deine Bestellungen</h2>';
    if (!a.bestellungen.length) {
      s += '<p class="empty">Noch keine Bestellung über deinen Code.</p>';
    } else {
      s += tabelleBestellungen(a.bestellungen.slice(0, 25));
    }
    return s;
  }

  function tabelleBestellungen(liste) {
    return '<div class="tblwrap"><table class="tbl"><thead><tr>' +
      '<th>Datum</th><th>Bestellung</th><th>Warenwert netto</th><th>Satz</th><th>Beteiligung</th><th>Status</th>' +
      '</tr></thead><tbody>' + liste.map(function (b) {
        return '<tr><td>' + datum(b.datum) + '</td><td>' + esc(b.id) +
          (b.folgekauf ? ' <span class="tag tag--mute">Folgekauf</span>' : '') + '</td>' +
          '<td>' + eur(b.netto) + '</td><td>' + proz(b.satz, 0) +
          (b.folgekauf ? ' <span class="muted">halb</span>' : '') + '</td>' +
          '<td>' + eur(b.beteiligung) + '</td><td>' +
          (b.status === 'storniert' ? tag('mute', 'storniert')
            : b.status === 'auszahlbar' ? tag('ok', 'auszahlbar')
            : tag('warn', 'noch ' + b.auszahlbarInTagen + ' Tage')) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  function seiteVerdienst() {
    var c = creatorVon(sitzung.creatorId);
    var a = berechneCreator(c.id);
    var meine = Z.auszahlungen.filter(function (x) { return x.creatorId === c.id; })
      .sort(function (x, y) { return new Date(y.datum) - new Date(x.datum); });

    var s = '<div class="head"><div><h1>Verdienst</h1>' +
      '<p class="muted">Honorare aus Kampagnen und Beteiligung auf deinen Code – getrennt ausgewiesen.</p></div></div>';

    s += '<div class="kpis">' +
      kpi('Auszahlbar', eur(a.auszahlbar), 'Mindestbetrag ' + eur0(REGELN.mindestauszahlung), true) +
      kpi('Honorare', eur(a.honorarGesamt), 'aus abgenommenen Kampagnen') +
      kpi('Beteiligung', eur(a.betGesamt), 'auf deinen Code') +
      kpi('Bereits ausgezahlt', eur(a.ausgezahlt), meine.length + ' Gutschriften') +
      '</div>';

    s += '<section class="card"><div class="card__hd"><h2>So kommt der Betrag zustande</h2></div>' +
      '<div class="crdl">' +
      '<div><span>Honorare aus abgenommenen Kampagnen</span><span>' + eur(a.honorarGesamt) + '</span></div>' +
      '<div><span>Beteiligung aus vermittelten Bestellungen</span><span>' + eur(a.betGesamt) + '</span></div>' +
      '<div><span>davon noch in der Widerrufsfrist</span><span class="muted">− ' + eur(a.betPruefung) + '</span></div>' +
      '<div><span>bereits ausgezahlt</span><span class="muted">− ' + eur(a.ausgezahlt) + '</span></div>' +
      '<div class="crdl__sum"><span>Jetzt auszahlbar</span><span>' + eur(a.auszahlbar) + '</span></div>' +
      '</div>' +
      '<p class="small muted" style="margin-top:.9rem">Beteiligung wird ' + REGELN.sperrfristTage +
      ' Tage nach der Bestellung fällig – 14 Tage Widerrufsfrist plus Puffer. Wird eine Bestellung ' +
      'zurückgeschickt, entfällt sie.</p></section>';

    s += '<section class="card"><div class="card__hd"><h2>Abrechnung und Steuer</h2></div>' +
      '<p>Wir rechnen im <strong>Gutschriftverfahren</strong> ab: Du musst keine Rechnung schreiben, ' +
      'wir erstellen die Abrechnung und du bekommst sie zugeschickt.</p>' +
      '<ul class="ticks ticks--sm" style="margin-top:.9rem">' +
      '<li><span>Auszahlung zum 15. für den Vormonat, ab ' + eur0(REGELN.mindestauszahlung) + '</span></li>' +
      '<li><span>' + (c.kleinunternehmer
        ? 'Du bist als Kleinunternehmer hinterlegt – wir weisen keine Umsatzsteuer aus.'
        : 'Umsatzsteuer wird ausgewiesen, deine Steuernummer liegt uns vor.') + '</span></li>' +
      '<li><span>Kostenlos zugesandte Produkte sind steuerlich kein Geschenk, sondern eine Gegenleistung. ' +
      'Sprich das bitte mit deinem Steuerberater durch – wir weisen den Warenwert in der Abrechnung aus.</span></li>' +
      '</ul>' +
      (c.land !== 'DE'
        ? '<div class="note note--warn" style="margin-top:1rem"><strong>Sitz außerhalb Deutschlands.</strong> ' +
          'Bei dir gelten andere Umsatzsteuer-Regeln. Wir klären das vor der ersten Auszahlung mit dir.</div>'
        : '') +
      '</section>';

    if (meine.length) {
      s += '<h2 class="mt">Bisherige Gutschriften</h2><div class="tblwrap"><table class="tbl"><thead><tr>' +
        '<th>Beleg</th><th>Datum</th><th>Honorar</th><th>Beteiligung</th><th>Summe</th></tr></thead><tbody>' +
        meine.map(function (g) {
          return '<tr><td>' + esc(g.beleg) + '</td><td>' + datum(g.datum) + '</td><td>' +
            eur(g.honorar || 0) + '</td><td>' + eur(g.beteiligung || 0) + '</td><td><strong>' +
            eur(g.betrag) + '</strong></td></tr>';
        }).join('') + '</tbody></table></div>';
    }
    return s;
  }

  function seiteMaterial() {
    var s = '<div class="head"><div><h1>Regeln und Material</h1>' +
      '<p class="muted">Zwei Seiten Text, die dir viel Ärger ersparen – und uns auch.</p></div></div>';

    s += '<div class="note note--gold"><strong>Der wichtigste Satz zuerst:</strong> Wir sind ein ' +
      'Ergänzungsfuttermittel, kein Medikament. Alles, was nach Krankheit oder Heilung klingt, ist ' +
      'verboten – nicht von uns, sondern vom Gesetz. Das gilt auch, wenn es deine ehrliche Erfahrung ist.</div>';

    s += '<div class="grid2">';
    s += '<section class="card card--ok"><div class="card__hd"><h2>So darfst du sprechen</h2></div>' +
      '<ul class="ticks ticks--sm">' +
      ['„zur Unterstützung gesunder Gelenke“',
       '„trägt zur normalen Gelenkfunktion bei“',
       '„unterstützt die Beweglichkeit“',
       '„mit Grünlippmuschel, MSM und Teufelskralle“',
       '„wir füttern es seit acht Wochen jeden Morgen“',
       '„sie ist wieder gern unterwegs“'].map(function (t) {
        return '<li><span>' + esc(t) + '</span></li>'; }).join('') + '</ul></section>';

    s += '<section class="card card--err"><div class="card__hd"><h2>Das darfst du nicht sagen</h2></div>' +
      '<ul class="crosses">' +
      ['„hilft bei Arthrose“ – auch „bei“ zählt als krankheitsbezogen',
       '„lindert Schmerzen“ oder „schmerzfrei“',
       '„entzündungshemmend“',
       '„bei HD“, „bei Hüftgelenksdysplasie“, „bei Rheuma“',
       '„heilt“, „therapiert“, „wirkt wie ein Medikament“',
       '„unterstützend bei Arthrose“ – Abschwächen hilft nicht'].map(function (t) {
        return '<li><span>' + esc(t) + '</span></li>'; }).join('') + '</ul>' +
      '<p class="small muted" style="margin-top:.9rem">Diese Formulierungen sind bei Hunde-Gelenkprodukten ' +
      'gerichtlich untersagt worden. Wenn ein Inhalt deswegen zurückkommt, liegt das nicht an dir.</p></section>';
    s += '</div>';

    s += '<section class="card"><div class="card__hd"><h2>Werbung kennzeichnen</h2></div>' +
      '<p>Sobald du von uns Geld, Produkte oder eine Beteiligung bekommst, ist dein Beitrag Werbung ' +
      'und muss als solche erkennbar sein. Nicht kleingedruckt, nicht am Ende, nicht nur auf Englisch.</p>' +
      '<ul class="ticks ticks--sm" style="margin-top:.9rem">' +
      '<li><span><strong>Am Anfang.</strong> „Werbung“ oder „Anzeige“ als erstes Wort der Bildunterschrift. ' +
      'Bei Videos dauerhaft im Bild eingeblendet, nicht nur kurz am Start.</span></li>' +
      '<li><span><strong>Auf Deutsch.</strong> „ad“, „sponsored by“, „PR sample“, „Advertorial“ und ' +
      'Abkürzungen wie „AZ“ sind ausdrücklich nicht ausreichend.</span></li>' +
      '<li><span><strong>Ohne Klick erkennbar.</strong> Nicht hinter „mehr anzeigen“, nicht in einer ' +
      'Hashtag-Wolke am Ende, nicht von Bedienelementen überlagert.</span></li>' +
      '<li><span><strong>Jedes Story-Slide einzeln.</strong> Ein Hinweis im Profil oder nur auf dem ' +
      'ersten Slide reicht nicht.</span></li>' +
      '<li><span><strong>Auch beim reinen Code.</strong> Eine Provision ist eine Gegenleistung – ' +
      'sobald du an einer Bestellung mitverdienst, ist der Beitrag Werbung.</span></li>' +
      '<li><span><strong>Auch beim geschenkten Produkt.</strong> Ein Testpaket zählt als Gegenleistung, ' +
      'unabhängig vom Wert.</span></li>' +
      '</ul>' +
      '<div class="note note--warn" style="margin-top:1rem"><strong>Zum Plattform-Schalter ' +
      '(„Bezahlte Partnerschaft“):</strong> Der Leitfaden der Medienanstalten lässt plattformeigene ' +
      'Kennzeichnungs-Werkzeuge als alleinige Kennzeichnung zu – aber nur, wenn sie wörtlich „Werbung“, ' +
      '„Anzeige“ oder „bezahlte Werbepartnerschaft“ zeigen. Instagram schreibt „Bezahlte Partnerschaft mit …“, ' +
      'also ohne „Werbe-“. Ob das genügt, hat unseres Wissens noch kein Gericht entschieden. ' +
      '<strong>Deshalb unsere Regel: Schalter gern nutzen – und zusätzlich selbst kennzeichnen.</strong></div>' +
      '<p class="small muted" style="margin-top:.9rem">Wenn du unsicher bist: lieber einmal zu viel ' +
      'kennzeichnen. Das hat noch niemandem geschadet.</p></section>';

    s += '<section class="card"><div class="card__hd"><h2>Musik, Menschen, fremde Marken</h2></div>' +
      '<ul class="ticks ticks--sm">' +
      '<li><span><strong>Musik:</strong> Die Musikbibliotheken von Instagram und TikTok sind für ' +
      'gewerbliche Beiträge meist NICHT freigegeben. Nimm lizenzfreie Musik oder gar keine – ' +
      'sonst können wir den Inhalt später nicht als Anzeige schalten.</span></li>' +
      '<li><span><strong>Menschen im Bild:</strong> Wer erkennbar zu sehen ist, muss einverstanden sein. ' +
      'Bei Kindern die Eltern.</span></li>' +
      '<li><span><strong>Fremde Marken:</strong> Kein Wettbewerbsprodukt im Bild, keine fremden Logos ' +
      'auf Napf, Leine oder Shirt.</span></li>' +
      '</ul></section>';

    s += '<section class="card"><div class="card__hd"><h2>Material zum Herunterladen</h2>' +
      '<span class="small muted">Prototyp – Dateien noch nicht hinterlegt</span></div>' +
      '<div class="files">' +
      ['Produktblatt Gelenk-Tabletten (PDF)', 'Offene Deklaration und Fütterungsempfehlung (PDF)',
       'Logo und Markenfarben (ZIP)', 'Geprüfte Textbausteine (PDF)', 'Freigegebene Produktbilder (ZIP)'
      ].map(function (n) {
        return '<div class="file"><svg><use href="#i-doc"/></svg><span class="file__n">' + esc(n) +
          '</span><span class="file__m muted">folgt</span></div>'; }).join('') +
      '</div></section>';
    return s;
  }

  function seiteProfil() {
    var c = creatorVon(sitzung.creatorId);
    var s = '<div class="head"><div><h1>Mein Profil</h1>' +
      '<p class="muted">Diese Angaben brauchen wir für Versand und Abrechnung.</p></div></div>';

    s += '<form id="form-profil"><section class="card"><div class="card__hd"><h2>Wer du bist</h2></div>' +
      '<div class="row2">' +
      fld('p-name', 'Name', c.name) + fld('p-kuenstler', 'Name deines Kanals', c.kuenstlername) +
      fld('p-mail', 'E-Mail', c.email, 'email') + fld('p-tel', 'Telefon', c.telefon, 'tel') +
      '</div>' +
      '<div class="fld"><label for="p-ueber">Worüber du postest</label><textarea id="p-ueber" rows="3">' +
      esc(c.ueber || '') + '</textarea></div></section>';

    s += '<section class="card"><div class="card__hd"><h2>Wohin wir Produkte schicken</h2></div>' +
      '<div class="row2">' + fld('p-strasse', 'Straße und Nummer', c.strasse) +
      fld('p-plz', 'PLZ', c.plz) + fld('p-ort', 'Ort', c.ort) +
      '<div class="fld"><label for="p-land">Land</label><select id="p-land">' +
      ['DE', 'AT', 'CH'].map(function (l) {
        return '<option value="' + l + '"' + (c.land === l ? ' selected' : '') + '>' +
          ({ DE: 'Deutschland', AT: 'Österreich', CH: 'Schweiz' })[l] + '</option>'; }).join('') +
      '</select></div></div></section>';

    s += '<section class="card"><div class="card__hd"><h2>Deine Kanäle</h2>' +
      '<button class="btn btn--sm btn--ghost" type="button" id="pl-plus">Kanal hinzufügen</button></div>' +
      '<p class="small muted">Die Reichweite hilft uns nur bei der Frage, welche Kampagne zu dir passt. ' +
      'Sie entscheidet <strong>nicht</strong> über die Aufnahme und nicht über deinen Beteiligungssatz.</p>' +
      '<div id="pl-liste" class="mt"></div></section>';

    s += '<section class="card"><div class="card__hd"><h2>Geld und Steuer</h2></div>' +
      '<div class="row2">' + fld('p-inhaber', 'Kontoinhaber', c.bankInhaber) +
      fld('p-iban', 'IBAN', c.iban) + fld('p-ust', 'Steuernummer oder USt-ID', c.ustId || '') + '</div>' +
      '<label class="check"><input type="checkbox" id="p-klein"' + (c.kleinunternehmer ? ' checked' : '') +
      '><span>Ich bin Kleinunternehmer nach § 19 UStG und weise keine Umsatzsteuer aus.</span></label>' +
      '</section>';

    s += '<div class="msg msg--ok" id="p-ok" hidden></div>' +
      '<button class="btn btn--primary" type="submit">Speichern</button></form>';
    return s;
  }
  function fld(id, label, wert, typ) {
    return '<div class="fld"><label for="' + id + '">' + esc(label) + '</label>' +
      '<input id="' + id + '" type="' + (typ || 'text') + '" value="' + esc(wert || '') + '"></div>';
  }

  // ---------------------------------------------------------------
  // 10. Verwaltungs-Seiten
  // ---------------------------------------------------------------
  function alleAuswertungen() {
    return Z.creator.map(function (c) {
      return { c: c, a: berechneCreator(c.id) };
    });
  }

  function seiteAdminUebersicht() {
    var alleA = alleAuswertungen();
    var aktive = alleA.filter(function (x) { return !x.c.gesperrt; });
    var umsatz = alleA.reduce(function (s, x) { return s + x.a.umsatzNetto; }, 0);
    var bestell = alleA.reduce(function (s, x) { return s + x.a.anzahl; }, 0);
    var honorar = alleA.reduce(function (s, x) { return s + x.a.honorarGesamt; }, 0);
    var beteil = alleA.reduce(function (s, x) { return s + x.a.betGesamt; }, 0);
    var seedWert = alleA.reduce(function (s, x) { return s + x.a.seedingWert; }, 0);
    var aufrufe = alleA.reduce(function (s, x) { return s + x.a.aufrufe; }, 0);
    var krit = kritischeRechte();

    var s = '<div class="head"><div><h1>Übersicht</h1>' +
      '<p class="muted">Creator-Programm · alle Zahlen aus Demodaten, Marktplatz: eigener Shop</p></div></div>';

    if (krit) {
      s += '<div class="note note--err"><strong>' + krit +
        (krit === 1 ? ' Inhalt braucht' : ' Inhalte brauchen') + ' Aufmerksamkeit bei den Nutzungsrechten.</strong> ' +
        'Wenn ein Anzeigenrecht abgelaufen ist, muss die Anzeige gestoppt werden – sonst nutzen wir ' +
        'fremdes Material ohne Grundlage. <button class="linkbtn" data-geh="a-rechte">Ansehen</button></div>';
    }

    s += '<div class="kpis">' +
      kpi('Aktive Creator', zahl(aktive.length), Z.creator.length + ' insgesamt') +
      kpi('Offene Kampagnen', zahl(offeneKampagnen()), 'angeboten, zugesagt oder eingereicht') +
      kpi('Inhalte in Prüfung', zahl(offeneInhalte()), offeneInhalte() ? 'warten auf Freigabe' : 'nichts offen', offeneInhalte() > 0) +
      kpi('Neue Bewerbungen', zahl(offeneBewerbungen()), offeneBewerbungen() ? 'noch nicht bearbeitet' : 'alles bearbeitet') +
      '</div>';

    s += '<div class="kpis">' +
      kpi('Vermittelter Umsatz netto', eur0(umsatz), zahl(bestell) + ' Bestellungen, gesamter Zeitraum') +
      kpi('Honorare', eur0(honorar), 'für abgenommene Kampagnen') +
      kpi('Beteiligung', eur0(beteil), 'auf Creator-Codes') +
      kpi('Warenwert Seeding', eur0(seedWert), 'versendete Produkte zum Verkaufspreis') +
      '</div>';

    var ksa = (honorar + seedWert) > REGELN.ksaFreigrenze ? (honorar + seedWert) * REGELN.ksaSatz : 0;
    var gesamtKosten = honorar + beteil + seedWert + ksa;
    s += '<section class="card"><div class="card__hd"><h2>Was der Kanal kostet und bringt</h2>' +
      '<span class="small muted">Demodaten, gesamter Zeitraum</span></div>' +
      '<div class="crdl">' +
      '<div><span>Honorare</span><span>' + eur0(honorar) + '</span></div>' +
      '<div><span>Beteiligung auf Codes</span><span>' + eur0(beteil) + '</span></div>' +
      '<div><span>Warenwert versendeter Produkte</span><span>' + eur0(seedWert) + '</span></div>' +
      '<div><span>Künstlersozialabgabe ' + proz(REGELN.ksaSatz) + ' auf Honorar und Ware</span><span>' +
        eur0(ksa) + '</span></div>' +
      '<div class="crdl__sum"><span>Kosten gesamt</span><span>' + eur0(gesamtKosten) + '</span></div>' +
      '<div><span>Vermittelter Umsatz netto</span><span>' + eur0(umsatz) + '</span></div>' +
      '<div><span>Kosten je vermittelter Bestellung</span><span>' +
        (bestell ? eur(gesamtKosten / bestell) : '–') + '</span></div>' +
      '<div><span>Aufrufe der freigegebenen Inhalte</span><span>' + kurz(aufrufe) + '</span></div>' +
      '<div><span>Kosten je 1.000 Aufrufe</span><span>' +
        (aufrufe ? eur(tkp(gesamtKosten, aufrufe)) : '–') + '</span></div>' +
      '</div>' +
      '<div class="note note--warn" style="margin-top:1rem"><strong>Zwei Dinge, die diese Tabelle NICHT sagt.</strong> ' +
      'Erstens sind das erfundene Demozahlen – sie stehen hier, damit die Struktur sichtbar wird, nicht als Aussage über den Kanal. ' +
      'Zweitens wäre der ehrliche Vergleich mit bezahlter Werbung erst dann belastbar, wenn er über ' +
      'denselben Zeitraum, dieselbe Attribution und einen echten Deckungsbeitrag gerechnet wird.</div>' +
      '</section>';

    return s;
  }

  function seiteBewerbungen() {
    var offen = Z.bewerbungen.filter(function (b) { return b.status === 'offen'; });
    var rest = Z.bewerbungen.filter(function (b) { return b.status !== 'offen'; });

    var s = '<div class="head"><div><h1>Bewerbungen</h1>' +
      '<p class="muted">' + offen.length + ' offen · ' + rest.length + ' bearbeitet</p></div>' +
      '<div class="head__act"><div class="suche"><svg><use href="#i-search"/></svg>' +
      '<input type="search" id="such-bew" placeholder="Name, Kanal oder Ort" aria-label="Bewerbungen durchsuchen"></div></div></div>';

    if (!offen.length && !rest.length) return s + '<p class="empty">Noch keine Bewerbung.</p>';
    s += '<div id="bew-liste">';
    s += offen.map(bewerbungKarte).join('');
    if (rest.length) {
      s += '<h2 class="mt">Bereits bearbeitet</h2>' + rest.map(bewerbungKarte).join('');
    }
    s += '</div>';
    return s;
  }

  function bewerbungKarte(b) {
    var reich = (b.plattformen || []).reduce(function (s, p) { return s + (p.follower || 0); }, 0);
    var beste = (b.plattformen || []).slice().sort(function (x, y) { return (y.follower || 0) - (x.follower || 0); })[0];
    var eng = beste ? beste.engagement : 0;
    var wunsch = { kooperation: 'Bezahlte Kampagne', code: 'Nur Code', seeding: 'Produkt testen' }[b.wunsch] || '–';
    return '<article class="bewerb" data-such="' + esc((b.name + ' ' + (b.kuenstlername || '') + ' ' + (b.ort || '')).toLowerCase()) + '">' +
      '<div class="bewerb__hd"><div><h2>' + esc(b.kuenstlername || b.name) + '</h2>' +
        '<p class="small muted">' + esc(b.name) + ' · ' + esc(b.ort || '') +
        (b.land && b.land !== 'DE' ? ' (' + esc(b.land) + ')' : '') +
        ' · eingegangen ' + datum(b.eingang) + (b.ausFormular ? ' · über das Formular' : '') + '</p></div>' +
        '<div>' + (b.status === 'offen' ? tag('warn', 'Offen')
          : b.status === 'angenommen' ? tag('ok', 'Aufgenommen') : tag('mute', 'Abgelehnt')) + '</div></div>' +
      '<div class="bewerb__meta">' +
        '<span><strong>' + kurz(reich) + '</strong> Reichweite</span>' +
        '<span><strong>' + (eng ? proz(eng) : '–') + '</strong> Interaktion' + (beste ? ' (' + esc(beste.netz) + ')' : '') + '</span>' +
        '<span><strong>' + esc(wunsch) + '</strong> gewünscht</span>' +
        (b.kleinunternehmer ? '<span>Kleinunternehmer</span>' : '') +
      '</div>' +
      '<p class="bewerb__txt">' + esc(b.ueber || '') + '</p>' +
      '<div class="mt">' + plattformChips(b.plattformen) + '</div>' +
      (b.beispiele && b.beispiele.length
        ? '<div class="files mt">' + b.beispiele.map(function (f) {
            return '<div class="file"><svg><use href="#i-doc"/></svg><span class="file__n">' + esc(f.name) +
              '</span><span class="file__m muted">' + mb(f.groesse) + '</span></div>'; }).join('') + '</div>'
        : '') +
      (b.hinweis ? '<div class="note note--warn mt">' + esc(b.hinweis) + '</div>' : '') +
      (b.status === 'offen'
        ? '<div class="bewerb__act"><button class="btn btn--sm btn--ok" data-bew-ja="' + b.id + '">Aufnehmen</button>' +
          '<button class="btn btn--sm btn--ghost" data-bew-nein="' + b.id + '">Absagen</button></div>'
        : '') +
      '</article>';
  }

  function seiteCreatorListe() {
    var liste = alleAuswertungen().sort(function (x, y) { return y.a.umsatzNetto - x.a.umsatzNetto; });
    var s = '<div class="head"><div><h1>Creator</h1><p class="muted">' + liste.length +
      ' aufgenommen · Zeile anklicken für alle Angaben</p></div>' +
      '<div class="head__act"><div class="suche"><svg><use href="#i-search"/></svg>' +
      '<input type="search" id="such-cre" placeholder="Name oder Kanal" aria-label="Creator durchsuchen"></div>' +
      '<button class="btn btn--sm btn--ghost" id="csv-creator"><svg><use href="#i-dl"/></svg>CSV</button></div></div>';

    s += '<div class="tblwrap"><table class="tbl"><thead><tr>' +
      '<th>Creator</th><th>Kanäle</th><th>Stufe</th><th>Inhalte</th><th>Bestellungen</th>' +
      '<th>Umsatz netto</th><th>Kosten</th><th>Offen</th></tr></thead><tbody>' +
      liste.map(function (x) {
        var kosten = x.a.honorarGesamt + x.a.betGesamt + x.a.seedingWert;
        return '<tr class="klick" data-creator="' + x.c.id + '" tabindex="0" data-such="' +
          esc((x.c.name + ' ' + x.c.kuenstlername).toLowerCase()) + '">' +
          '<td><strong>' + esc(x.c.kuenstlername) + '</strong><br><span class="small muted">' + esc(x.c.name) +
            (x.c.gesperrt ? ' · ' + tag('err', 'gesperrt') : '') + '</span></td>' +
          '<td>' + plattformChips(x.c.plattformen, 2) + '</td>' +
          '<td>' + esc(x.a.stufe.name) + '<br><span class="small muted">' + proz(x.a.stufe.satz, 0) + '</span></td>' +
          '<td>' + zahl(x.a.inhalteFrei) + (x.a.inhaltePruefung ? ' <span class="tag tag--warn">' + x.a.inhaltePruefung + '</span>' : '') + '</td>' +
          '<td>' + zahl(x.a.anzahl) + '</td>' +
          '<td>' + eur0(x.a.umsatzNetto) + '</td>' +
          '<td>' + eur0(kosten) + '</td>' +
          '<td>' + eur(x.a.auszahlbar) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
    return s;
  }

  function seiteCreatorDetail() {
    var c = creatorVon(detailCreator);
    if (!c) return '<p class="empty">Nicht gefunden.</p>';
    var a = berechneCreator(c.id);
    var kosten = a.honorarGesamt + a.betGesamt + a.seedingWert;

    var s = '<div class="head"><div><button class="linkbtn" data-geh="a-creator">&larr; Zur Liste</button>' +
      '<h1>' + esc(c.kuenstlername) + '</h1><p class="muted">' + esc(c.name) + ' · ' + esc(c.id) +
      ' · dabei seit ' + datum(c.seit) + '</p></div>' +
      '<div class="head__act">' +
      '<button class="btn btn--sm ' + (c.gesperrt ? 'btn--ok' : 'btn--danger') + '" data-sperre="' + c.id + '">' +
      (c.gesperrt ? 'Wieder freischalten' : 'Sperren') + '</button></div></div>';

    if (c.gesperrt) {
      s += '<div class="note note--warn"><strong>Dieser Creator ist gesperrt.</strong> Der Code funktioniert ' +
        'nicht mehr. Bereits verdiente Beträge bleiben bestehen und werden ausgezahlt.</div>';
    }
    if (c.hinweis) s += '<div class="note note--warn">' + esc(c.hinweis) + '</div>';

    s += '<div class="kpis">' +
      kpi('Reichweite', kurz(a.reichweite), (c.plattformen || []).length + ' Kanäle') +
      kpi('Umsatz netto', eur0(a.umsatzNetto), zahl(a.anzahl) + ' Bestellungen') +
      kpi('Kosten gesamt', eur0(kosten), 'Honorar, Beteiligung, Ware') +
      kpi('Offener Betrag', eur(a.auszahlbar), 'auszahlbar', a.auszahlbar > 0) +
      '</div>';

    s += '<div class="grid2">';
    s += '<section class="card"><div class="card__hd"><h2>Kontakt und Versand</h2></div><div class="crdl">' +
      '<div><span>E-Mail</span><span>' + esc(c.email) + '</span></div>' +
      '<div><span>Telefon</span><span>' + esc(c.telefon || '–') + '</span></div>' +
      '<div><span>Anschrift</span><span>' + esc(c.strasse) + ', ' + esc(c.plz) + ' ' + esc(c.ort) +
        ' (' + esc(c.land) + ')</span></div>' +
      '<div><span>Code</span><span><code>' + esc(c.code) + '</code></span></div>' +
      '</div></section>';

    s += '<section class="card"><div class="card__hd"><h2>Abrechnung</h2></div><div class="crdl">' +
      '<div><span>Kontoinhaber</span><span>' + esc(c.bankInhaber || '–') + '</span></div>' +
      '<div><span>IBAN</span><span>' + esc(c.iban || '–') + '</span></div>' +
      '<div><span>Steuernummer</span><span>' + esc(c.ustId || '–') + '</span></div>' +
      '<div><span>Kleinunternehmer</span><span>' + (c.kleinunternehmer ? 'ja' : 'nein') + '</span></div>' +
      '</div></section></div>';

    s += '<section class="card"><div class="card__hd"><h2>Kanäle</h2></div>' +
      '<div class="tblwrap"><table class="tbl"><thead><tr><th>Netzwerk</th><th>Profil</th>' +
      '<th>Follower</th><th>Interaktion</th></tr></thead><tbody>' +
      ((c.plattformen || []).length
        ? c.plattformen.map(function (p) {
            return '<tr><td>' + netzIcon(p.netz) + ' ' + esc(p.netz) + '</td><td>' + esc(p.handle) + '</td>' +
              '<td>' + zahl(p.follower) + '</td><td>' + (p.engagement ? proz(p.engagement) : '–') + '</td></tr>';
          }).join('')
        : '<tr><td colspan="4" class="muted">Keine Kanäle hinterlegt.</td></tr>') +
      '</tbody></table></div></section>';

    s += '<section class="card"><div class="card__hd"><h2>Produkte, die wir geschickt haben</h2></div>';
    if (!a.seedingVersand) {
      s += '<p class="muted">Noch nichts versendet.</p>';
    } else {
      var quote = a.seedingGeliefert / a.seedingVersand;
      s += '<div class="minis">' +
        '<div class="mini"><p class="mini__l">Pakete</p><p class="mini__v">' + a.seedingVersand + '</p></div>' +
        '<div class="mini"><p class="mini__l">davon mit Inhalt zurück</p><p class="mini__v">' + a.seedingGeliefert + '</p></div>' +
        '<div class="mini"><p class="mini__l">Quote</p><p class="mini__v">' + proz(quote, 0) + '</p></div>' +
        '<div class="mini"><p class="mini__l">Warenwert</p><p class="mini__v">' + eur0(a.seedingWert) + '</p></div>' +
        '</div>';
    }
    s += '</section>';

    s += '<section class="card"><div class="card__hd"><h2>Kampagnen</h2></div>';
    if (!a.kampagnen.length) s += '<p class="muted">Noch keine Kampagne.</p>';
    else {
      s += '<div class="tblwrap"><table class="tbl"><thead><tr><th>Kampagne</th><th>Abgabe</th>' +
        '<th>Honorar</th><th>Rechte</th><th>Status</th></tr></thead><tbody>' +
        a.kampagnen.map(function (k) {
          return '<tr class="klick" data-kampagne="' + k.id + '" tabindex="0"><td><strong>' + esc(k.titel) +
            '</strong><br><span class="small muted">' + esc(k.id) + '</span></td>' +
            '<td>' + datum(k.deadline) + '</td><td>' + eur0(k.honorar) + '</td>' +
            '<td>' + k.rechteMonate + ' Mon.<br><span class="small muted">' +
              esc(kanalNamen(k.rechteKanaele).length + ' Kanäle') + '</span></td>' +
            '<td>' + kampStatusTag(k) + '</td></tr>';
        }).join('') + '</tbody></table></div>';
    }
    s += '</section>';

    s += '<section class="card"><div class="card__hd"><h2>Inhalte</h2></div>' +
      (a.inhalte.length
        ? '<div class="medgrid">' + a.inhalte.map(function (x) { return inhaltKachel(x, false, true); }).join('') + '</div>'
        : '<p class="muted">Noch keine Inhalte.</p>') + '</section>';

    s += '<section class="card"><div class="card__hd"><h2>Letzte Bestellungen</h2></div>' +
      (a.bestellungen.length ? tabelleBestellungen(a.bestellungen.slice(0, 12)) : '<p class="muted">Keine.</p>') +
      '</section>';
    return s;
  }

  function seiteAdminKampagnen() {
    var liste = Z.kampagnen.slice().sort(function (a, b) { return new Date(b.start) - new Date(a.start); });
    var s = '<div class="head"><div><h1>Kampagnen</h1>' +
      '<p class="muted">' + offeneKampagnen() + ' offen · ' + liste.length + ' insgesamt</p></div>' +
      '<div class="head__act"><button class="btn btn--sm btn--primary" id="kamp-neu">Kampagne anlegen</button></div></div>';

    s += '<div class="tblwrap"><table class="tbl"><thead><tr><th>Kampagne</th><th>Creator</th>' +
      '<th>Abgabe</th><th>Honorar</th><th>Ware</th><th>Rechte</th><th>Status</th></tr></thead><tbody>' +
      liste.map(function (k) {
        var c = creatorVon(k.creatorId);
        var offen = tageBis(k.deadline);
        var spaet = (k.status === 'zugesagt' && offen < 0);
        return '<tr class="klick" data-kampagne="' + k.id + '" tabindex="0">' +
          '<td><strong>' + esc(k.titel) + '</strong><br><span class="small muted">' + esc(k.id) + '</span></td>' +
          '<td>' + esc(c ? c.kuenstlername : '–') + '</td>' +
          '<td>' + datum(k.deadline) + (spaet ? '<br>' + tag('err', Math.abs(offen) + ' Tage über') : '') + '</td>' +
          '<td>' + eur0(k.honorar) + '</td>' +
          '<td>' + (k.seeding ? eur0(k.seeding.wert) : '–') + '</td>' +
          '<td>' + k.rechteMonate + ' Mon.</td>' +
          '<td>' + kampStatusTag(k) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
    return s;
  }

  function seiteKampagneDetail() {
    var k = kampagneVon(detailKampagne);
    if (!k) return '<p class="empty">Nicht gefunden.</p>';
    var c = creatorVon(k.creatorId);
    var inh = Z.inhalte.filter(function (x) { return x.kampagnenId === k.id; });

    var s = '<div class="head"><div><button class="linkbtn" data-geh="a-kampagnen">&larr; Zu den Kampagnen</button>' +
      '<h1>' + esc(k.titel) + '</h1><p class="muted">' + esc(k.id) + ' · ' +
      esc(c ? c.kuenstlername : '–') + '</p></div><div class="head__act">' + kampStatusTag(k) + '</div></div>';

    s += '<div class="grid2">' +
      '<section class="card"><div class="card__hd"><h2>Auftrag</h2></div><div class="crdl">' +
      '<div><span>Start</span><span>' + datum(k.start) + '</span></div>' +
      '<div><span>Abgabe bis</span><span>' + datum(k.deadline) + '</span></div>' +
      '<div><span>Honorar</span><span>' + eur0(k.honorar) + '</span></div>' +
      '<div><span>Produkt</span><span>' + esc(k.seeding ? k.seeding.artikel : '–') + '</span></div>' +
      '<div><span>Warenwert</span><span>' + (k.seeding ? eur(k.seeding.wert) : '–') + '</span></div>' +
      '<div><span>Versendet</span><span>' + (k.seeding && k.seeding.versandAm ? datum(k.seeding.versandAm) : 'noch nicht') + '</span></div>' +
      '</div></section>' +

      '<section class="card"><div class="card__hd"><h2>Vereinbarte Nutzungsrechte</h2></div>' +
      '<ul class="ticks ticks--sm">' + kanalNamen(k.rechteKanaele).map(function (n) {
        return '<li><span>' + esc(n) + '</span></li>'; }).join('') + '</ul>' +
      '<p class="small muted" style="margin-top:.8rem">Laufzeit ' + k.rechteMonate +
      ' Monate ab Abnahme' + (k.abnahme ? ' (also bis ' +
        datum(new Date(new Date(k.abnahme).getTime() + k.rechteMonate * 30.44 * 86400000).toISOString()) + ')' : '') +
      '.</p>' +
      ((k.rechteKanaele || []).some(function (x) { return KANAL_KRITISCH.indexOf(x) >= 0; })
        ? '<div class="note note--warn" style="margin-top:.9rem">Enthält ein Anzeigenrecht. Nach Ablauf ' +
          'müssen laufende Anzeigen mit diesem Material gestoppt werden.</div>' : '') +
      '</section></div>';

    s += '<section class="card"><div class="card__hd"><h2>Briefing</h2></div>' +
      '<p class="kamp__brief">' + esc(k.briefing) + '</p>' +
      '<p class="kamp__lbl" style="margin-top:1rem">Leistungen</p><ul class="ticks ticks--sm">' +
      k.leistungen.map(function (t) { return '<li><span>' + esc(t) + '</span></li>'; }).join('') +
      '</ul></section>';

    s += '<section class="card"><div class="card__hd"><h2>Eingereichte Inhalte</h2></div>' +
      (inh.length
        ? '<div class="medgrid">' + inh.map(function (x) { return inhaltKachel(x, false, true); }).join('') + '</div>'
        : '<p class="muted">Noch nichts eingereicht.</p>') + '</section>';

    if (k.status === 'inhalt-da') {
      s += '<div class="kamp__act"><button class="btn btn--primary" data-kamp-abnehmen="' + k.id + '">' +
        'Kampagne abnehmen und Honorar freigeben</button></div>' +
        '<p class="small muted">Erst danach wird das Honorar auszahlbar.</p>';
    }
    return s;
  }

  function seiteAdminInhalte() {
    var alleI = Z.inhalte.slice().sort(function (a, b) { return new Date(b.eingang) - new Date(a.eingang); });
    var offen = alleI.filter(function (c) { return c.status === 'pruefung'; });

    var s = '<div class="head"><div><h1>Inhalte prüfen</h1>' +
      '<p class="muted">' + offen.length + ' in Prüfung · ' + alleI.length + ' insgesamt</p></div>' +
      '<div class="head__act"><div class="filts" id="med-filt">' +
      [['pruefung', 'In Prüfung'], ['frei', 'Freigegeben'], ['abgelehnt', 'Abgelehnt'], ['', 'Alle']]
        .map(function (f, i) {
          return '<button class="filt' + (i === 0 ? ' filt--an' : '') + '" data-filt="' + f[0] + '">' + f[1] + '</button>';
        }).join('') + '</div></div></div>';

    s += '<div class="note"><strong>Woran wir jeden Inhalt messen.</strong> Vier Punkte, alle müssen ' +
      'stimmen – erst dann lässt sich freigeben. Das ist keine Förmlichkeit: Sobald wir einen Inhalt ' +
      'freigeben und verwenden, ist seine Aussage <strong>unsere</strong> Werbeaussage.</div>';

    s += '<div class="medgrid" id="med-liste">' +
      alleI.map(function (c) {
        return '<div data-status="' + c.status + '">' + inhaltKachel(c, true, true) + '</div>';
      }).join('') + '</div>';
    return s;
  }

  function seiteRechte() {
    /* Eigene Seite, weil das die Frage ist, die im Alltag untergeht:
       Was dürfen wir gerade noch verwenden – und was nicht mehr? */
    var frei = Z.inhalte.filter(function (c) { return c.status === 'frei'; });
    var mitRechten = frei.map(function (c) { return { c: c, r: rechteStatus(c) }; });
    var abgelaufen = mitRechten.filter(function (x) { return x.r.art.indexOf('abgelaufen') === 0; });
    var bald = mitRechten.filter(function (x) { return x.r.art === 'laeuft-ab'; });
    var gut = mitRechten.filter(function (x) { return x.r.art === 'gueltig'; });

    var s = '<div class="head"><div><h1>Nutzungsrechte</h1>' +
      '<p class="muted">Welches Material dürfen wir wo und wie lange verwenden?</p></div></div>';

    s += '<div class="kpis">' +
      kpi('Gültig', zahl(gut.length), 'nutzbar wie vereinbart') +
      kpi('Laufen bald ab', zahl(bald.length), 'innerhalb von ' + REGELN.rechteWarnungTage + ' Tagen', bald.length > 0) +
      kpi('Abgelaufen', zahl(abgelaufen.length), 'dürfen nicht mehr verwendet werden', abgelaufen.length > 0) +
      kpi('Davon mit Anzeigenrecht', zahl(abgelaufen.filter(function (x) { return x.r.kritisch; }).length),
          'hier zuerst nachsehen') +
      '</div>';

    if (abgelaufen.some(function (x) { return x.r.kritisch; })) {
      s += '<div class="note note--err"><strong>Das ist der Punkt, an dem es teuer wird.</strong> ' +
        'Ein Inhalt, für den wir das Anzeigenrecht hatten, ist abgelaufen. Läuft die Anzeige weiter, ' +
        'nutzen wir das Werk ohne Grundlage – und der Creator hat einen Anspruch gegen uns. ' +
        'Anzeige stoppen oder Rechte verlängern.</div>';
    }

    function block(titel, liste, leer) {
      if (!liste.length) return '<section class="card"><div class="card__hd"><h2>' + titel +
        '</h2></div><p class="muted">' + leer + '</p></section>';
      return '<section class="card"><div class="card__hd"><h2>' + titel + '</h2></div>' +
        '<div class="tblwrap"><table class="tbl"><thead><tr><th>Inhalt</th><th>Creator</th>' +
        '<th>Erlaubte Kanäle</th><th>Läuft bis</th><th>Zustand</th></tr></thead><tbody>' +
        liste.map(function (x) {
          var cr = creatorVon(x.c.creatorId);
          return '<tr><td><strong>' + esc(x.c.titel) + '</strong><br><span class="small muted">' +
            esc(x.c.netz) + ' · ' + esc(x.c.id) + '</span></td>' +
            '<td>' + esc(cr ? cr.kuenstlername : '–') + '</td>' +
            '<td>' + esc(kanalNamen(x.c.rechteKanaele).join(', ') || '–') +
              (x.r.kritisch ? '<br>' + tag('warn', 'Anzeigenrecht') : '') + '</td>' +
            '<td>' + datum(x.c.rechteBis) + '</td>' +
            '<td>' + rechteTag(x.c) + '</td></tr>';
        }).join('') + '</tbody></table></div></section>';
    }

    s += block('Abgelaufen', abgelaufen, 'Nichts abgelaufen.');
    s += block('Laufen demnächst ab', bald, 'Nichts läuft in den nächsten ' + REGELN.rechteWarnungTage + ' Tagen ab.');
    s += block('Gültig', gut, 'Noch keine Rechte vereinbart.');
    return s;
  }

  function faellige() {
    return alleAuswertungen()
      .filter(function (x) { return x.a.auszahlbar >= REGELN.mindestauszahlung; })
      .sort(function (x, y) { return y.a.auszahlbar - x.a.auszahlbar; });
  }

  function seiteAbrechnung() {
    var f = faellige();
    var unter = alleAuswertungen().filter(function (x) {
      return x.a.auszahlbar > 0 && x.a.auszahlbar < REGELN.mindestauszahlung;
    });
    var summe = f.reduce(function (s, x) { return s + x.a.auszahlbar; }, 0);

    var s = '<div class="head"><div><h1>Abrechnung</h1>' +
      '<p class="muted">Gutschriftverfahren · Auszahlung zum 15. für den Vormonat</p></div>' +
      '<div class="head__act"><button class="btn btn--sm btn--ghost" id="csv-abr">' +
      '<svg><use href="#i-dl"/></svg>CSV für die Buchhaltung</button>' +
      '<button class="btn btn--sm btn--primary" id="abr-lauf"' + (f.length ? '' : ' disabled') + '>' +
      'Lauf ausführen</button></div></div>';

    s += '<div class="kpis">' +
      kpi('Fällig', eur(summe), f.length + ' Creator', true) +
      kpi('Unter der Grenze', zahl(unter.length), 'wandert in den Folgemonat') +
      kpi('Bisher ausgezahlt', eur(Z.auszahlungen.reduce(function (s2, a) { return s2 + a.betrag; }, 0)),
          Z.auszahlungen.length + ' Gutschriften') +
      '</div>';

    if (!f.length) {
      s += '<p class="empty">Gerade ist nichts fällig.</p>';
    } else {
      s += '<div class="tblwrap"><table class="tbl"><thead><tr><th>Creator</th><th>Land</th>' +
        '<th>Honorar</th><th>Beteiligung</th><th>Bereits gezahlt</th><th>Auszahlung</th><th>Steuer</th>' +
        '</tr></thead><tbody>' + f.map(function (x) {
          return '<tr><td><strong>' + esc(x.c.kuenstlername) + '</strong><br><span class="small muted">' +
            esc(x.c.iban) + '</span></td>' +
            '<td>' + esc(x.c.land) + '</td>' +
            '<td>' + eur(x.a.honorarGesamt) + '</td>' +
            '<td>' + eur(x.a.betAuszahlbar) + '</td>' +
            '<td class="muted">− ' + eur(x.a.ausgezahlt) + '</td>' +
            '<td><strong>' + eur(x.a.auszahlbar) + '</strong></td>' +
            '<td>' + (x.c.land !== 'DE' ? tag('warn', 'prüfen')
              : x.c.kleinunternehmer ? tag('mute', '§ 19') : tag('ok', 'mit USt')) + '</td></tr>';
        }).join('') + '</tbody></table></div>';
    }

    if (unter.length) {
      s += '<section class="card"><div class="card__hd"><h2>Unter der Mindestgrenze</h2></div>' +
        '<ul class="ticks ticks--sm">' + unter.map(function (x) {
          return '<li><span>' + esc(x.c.kuenstlername) + ' · ' + eur(x.a.auszahlbar) +
            ' – bleibt stehen, bis ' + eur0(REGELN.mindestauszahlung) + ' erreicht sind</span></li>';
        }).join('') + '</ul></section>';
    }

    /* ---- Künstlersozialabgabe ----
       Steht bewusst hier und nicht im Kleingedruckten: Sie ist eine echte Kostenposition,
       sie fällt zusätzlich zum Honorar an (Abwälzen auf den Creator ist nichtig, § 36a KSVG),
       und sie wird typischerweise erst bei einer Betriebsprüfung rückwirkend teuer. */
    var alleA2 = alleAuswertungen();
    var honorarJahr = alleA2.reduce(function (s2, x) { return s2 + x.a.honorarGesamt; }, 0);
    var wareJahr = alleA2.reduce(function (s2, x) { return s2 + x.a.seedingWert; }, 0);
    var ksaBasis = honorarJahr + wareJahr;
    var ksaFaellig = ksaBasis > REGELN.ksaFreigrenze;

    s += '<section class="card"><div class="card__hd"><h2>Künstlersozialabgabe</h2>' +
      '<span class="small muted">' + proz(REGELN.ksaSatz) + ' im Jahr 2026</span></div>' +
      '<div class="crdl">' +
      '<div><span>Honorare an Creator</span><span>' + eur0(honorarJahr) + '</span></div>' +
      '<div><span>Warenwert versendeter Produkte (zählt als Entgelt mit)</span><span>' + eur0(wareJahr) + '</span></div>' +
      '<div><span>Beteiligung auf Codes</span><span class="muted">zählt nicht mit</span></div>' +
      '<div class="crdl__sum"><span>Bemessungsgrundlage</span><span>' + eur0(ksaBasis) + '</span></div>' +
      '<div class="crdl__sum"><span>Abgabe ' + proz(REGELN.ksaSatz) + '</span><span>' +
        (ksaFaellig ? eur(ksaBasis * REGELN.ksaSatz) : '0,00 € (unter der Freigrenze)') + '</span></div>' +
      '</div>' +
      (ksaFaellig
        ? '<div class="note note--warn" style="margin-top:1rem"><strong>Die Freigrenze von ' +
          eur0(REGELN.ksaFreigrenze) + ' im Kalenderjahr ist überschritten.</strong> Dann ist die ' +
          '<em>gesamte</em> Entgeltsumme abgabepflichtig, nicht nur der übersteigende Teil – es ist eine ' +
          'Freigrenze, kein Freibetrag. Die Abgabe kommt <strong>zusätzlich</strong> zum Honorar und darf ' +
          'dem Creator nicht abgezogen werden.</div>'
        : '<p class="small muted" style="margin-top:.8rem">Noch unter der Freigrenze von ' +
          eur0(REGELN.ksaFreigrenze) + ' im Kalenderjahr.</p>') +
      '<p class="small muted" style="margin-top:.8rem">Rechtsgrund: § 24 Abs. 2 Satz 1 Nr. 1 KSVG ' +
      '(Werbung für das eigene Unternehmen). Die Künstlersozialkasse führt Influencer ausdrücklich in ' +
      'ihrem Katalog und stellt in ihrer FAQ klar, dass Entgelte für selbst erstellte Werbefotos, -videos ' +
      'und -texte abgabepflichtig sind, <strong>Affiliate-Provisionen dagegen nicht</strong>. Deshalb ' +
      'rechnet diese Tabelle nur Honorare und Warenwert. Zwei offene Punkte: mit welchem Wert eine ' +
      'Sachleistung anzusetzen ist (Einkaufspreis oder Verkaufspreis) – hier steht der Verkaufspreis, ' +
      'die KSK sollte dazu schriftlich gefragt werden – und dass Zahlungen an eine GmbH nicht erfasst wären.</p>' +
      '</section>';

    s += '<div class="note note--warn"><strong>Was hier bewusst NICHT passiert.</strong> Der Prototyp ' +
      'erzeugt keine Gutschriftbelege, keine SEPA-Datei und keine Steuerlogik – er exportiert eine CSV. ' +
      'Die Belege entstehen in Lexoffice oder DATEV. Drei Punkte gehören vorher mit der Steuerberatung ' +
      'geklärt: die Behandlung kostenlos versendeter Produkte (umsatzsteuerlich ein tauschähnlicher ' +
      'Umsatz nach § 3 Abs. 12 UStG – beide Seiten rechnen ab), Creator mit Sitz im Ausland ' +
      '(§ 50a EStG kann einen Steuerabzug von 15 % auf die Nutzungsrechte auslösen), und die ' +
      'Künstlersozialabgabe oben.</div>';
    return s;
  }

  function seiteAuswertung() {
    var tage = parseInt(el('#zeitraum') ? el('#zeitraum').value : '90', 10);
    var alleA = alleAuswertungen();

    var s = '<div class="head"><div><h1>Auswertung</h1>' +
      '<p class="muted">Alle Zahlen: Demodaten aus dem eigenen Shop, keine Marktplätze</p></div>' +
      '<div class="head__act"><div class="fld fld--inline"><label for="zeitraum">Zeitraum</label>' +
      '<select id="zeitraum">' +
      [[30, '30 Tage'], [90, '90 Tage'], [365, '365 Tage'], [0, 'Gesamt']].map(function (z) {
        return '<option value="' + z[0] + '"' + (z[0] === tage ? ' selected' : '') + '>' + z[1] + '</option>';
      }).join('') + '</select></div></div></div>';

    var zeitraumText = tage ? 'letzte ' + tage + ' Tage' : 'gesamter Zeitraum';
    var werte = alleA.map(function (x) { return { c: x.c, a: x.a, z: imZeitraum(x.a, tage) }; });
    var best = werte.reduce(function (s2, x) { return s2 + x.z.anzahl; }, 0);
    var ums = werte.reduce(function (s2, x) { return s2 + x.z.umsatz; }, 0);
    var bet = werte.reduce(function (s2, x) { return s2 + x.z.beteiligung; }, 0);
    var reich = alleA.reduce(function (s2, x) { return s2 + x.a.reichweite; }, 0);

    s += '<div class="kpis">' +
      kpi('Bestellungen', zahl(best), zeitraumText) +
      kpi('Umsatz netto', eur0(ums), zeitraumText) +
      kpi('Beteiligung', eur0(bet), zeitraumText) +
      kpi('Reichweite aller Creator', kurz(reich), 'Summe der Follower, Stand heute') +
      '</div>';

    /* Kanalvergleich: welches Netzwerk trägt eigentlich? */
    var proNetz = {};
    Z.inhalte.filter(function (c) { return c.status === 'frei'; }).forEach(function (c) {
      var n = proNetz[c.netz] || (proNetz[c.netz] = { inhalte: 0, aufrufe: 0, interakt: 0, klicks: 0 });
      n.inhalte++;
      n.aufrufe += c.leistung ? c.leistung.aufrufe : 0;
      n.interakt += c.leistung ? c.leistung.interaktionen : 0;
      n.klicks += c.leistung ? c.leistung.klicks : 0;
    });
    var netze = Object.keys(proNetz).sort(function (a, b) { return proNetz[b].aufrufe - proNetz[a].aufrufe; });

    s += '<section class="card"><div class="card__hd"><h2>Was auf welcher Plattform passiert</h2>' +
      '<span class="small muted">freigegebene Inhalte, gesamter Zeitraum</span></div>';
    if (!netze.length) s += '<p class="muted">Noch keine freigegebenen Inhalte.</p>';
    else {
      s += '<div class="tblwrap"><table class="tbl"><thead><tr><th>Plattform</th><th>Inhalte</th>' +
        '<th>Aufrufe</th><th>Interaktionen</th><th>Interaktionsrate</th><th>Klicks</th><th>Klickrate</th>' +
        '</tr></thead><tbody>' + netze.map(function (n) {
          var d = proNetz[n];
          return '<tr><td>' + netzIcon(n) + ' ' + esc(n) + '</td><td>' + d.inhalte + '</td>' +
            '<td>' + kurz(d.aufrufe) + '</td><td>' + kurz(d.interakt) + '</td>' +
            '<td>' + (d.aufrufe ? proz(d.interakt / d.aufrufe) : '–') + '</td>' +
            '<td>' + kurz(d.klicks) + '</td>' +
            '<td>' + (d.aufrufe ? proz(d.klicks / d.aufrufe) : '–') + '</td></tr>';
        }).join('') + '</tbody></table></div>';
    }
    s += '</section>';

    s += '<section class="card"><div class="card__hd"><h2>Creator im Vergleich</h2>' +
      '<span class="small muted">' + zeitraumText + '</span></div>' +
      '<div class="tblwrap"><table class="tbl"><thead><tr><th>Creator</th><th>Reichweite</th>' +
      '<th>Bestellungen</th><th>Umsatz netto</th><th>Kosten gesamt</th><th>Kosten je Bestellung</th>' +
      '</tr></thead><tbody>' +
      werte.sort(function (a, b) { return b.z.umsatz - a.z.umsatz; }).map(function (x) {
        var kosten = x.a.honorarGesamt + x.a.betGesamt + x.a.seedingWert;
        return '<tr><td>' + esc(x.c.kuenstlername) + '</td>' +
          '<td>' + kurz(x.a.reichweite) + '</td><td>' + zahl(x.z.anzahl) + '</td>' +
          '<td>' + eur0(x.z.umsatz) + '</td><td>' + eur0(kosten) + '</td>' +
          '<td>' + (x.a.anzahl ? eur(kosten / x.a.anzahl) : '<span class="muted">noch keine Bestellung</span>') + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<p class="small muted" style="margin-top:.8rem">Die Spalte „Kosten je Bestellung“ rechnet die ' +
      'Kosten des <strong>gesamten</strong> Zeitraums gegen die Bestellungen des gesamten Zeitraums – ' +
      'sie ändert sich also nicht mit dem Filter oben. Ein Honorar wirkt über Monate, ein 30-Tage-Ausschnitt ' +
      'würde es künstlich schlecht aussehen lassen.</p></section>';

    /* Seeding – die Zahl, die bei Barter zählt */
    var sv = alleA.reduce(function (s2, x) { return s2 + x.a.seedingVersand; }, 0);
    var sg = alleA.reduce(function (s2, x) { return s2 + x.a.seedingGeliefert; }, 0);
    var sw = alleA.reduce(function (s2, x) { return s2 + x.a.seedingWert; }, 0);
    s += '<section class="card"><div class="card__hd"><h2>Produkt gegen Inhalt</h2></div>' +
      '<div class="minis">' +
      '<div class="mini"><p class="mini__l">Pakete versendet</p><p class="mini__v">' + sv + '</p></div>' +
      '<div class="mini"><p class="mini__l">Inhalt zurückbekommen</p><p class="mini__v">' + sg + '</p></div>' +
      '<div class="mini"><p class="mini__l">Quote</p><p class="mini__v">' + (sv ? proz(sg / sv, 0) : '–') + '</p></div>' +
      '<div class="mini"><p class="mini__l">Warenwert</p><p class="mini__v">' + eur0(sw) + '</p></div>' +
      '</div>' +
      '<p class="small muted" style="margin-top:.8rem">Diese Quote ist die wichtigste Zahl, wenn wir ' +
      'Produkte verschenken – und die, die üblicherweise niemand misst. Fällt sie unter etwa die Hälfte, ' +
      'kostet das Seeding mehr, als es bringt.</p></section>';
    return s;
  }

  // ---------------------------------------------------------------
  // 11. Verdrahtung
  // ---------------------------------------------------------------
  function verdrahte() {
    alle('[data-kopier]').forEach(function (b) {
      b.addEventListener('click', function () {
        var t = b.getAttribute('data-kopier');
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t);
        toast('„' + t + '“ kopiert');
      });
    });
    alle('[data-geh]').forEach(function (b) {
      b.addEventListener('click', function () { zeige(b.getAttribute('data-geh')); });
    });
    alle('[data-creator]').forEach(function (r) {
      function auf() { detailCreator = r.getAttribute('data-creator'); zeige('a-creator-detail'); }
      r.addEventListener('click', auf);
      r.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') auf(); });
    });
    alle('[data-kampagne]').forEach(function (r) {
      function auf() { detailKampagne = r.getAttribute('data-kampagne'); zeige('a-kampagne-detail'); }
      r.addEventListener('click', auf);
      r.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') auf(); });
    });
    alle('[data-pruef]').forEach(function (b) {
      b.addEventListener('click', function (ev) {
        ev.stopPropagation();
        dialogInhalt(b.getAttribute('data-pruef'));
      });
    });
    alle('[data-bew-ja]').forEach(function (b) {
      b.addEventListener('click', function () { dialogBewerbung(b.getAttribute('data-bew-ja'), 'ja'); });
    });
    alle('[data-bew-nein]').forEach(function (b) {
      b.addEventListener('click', function () { dialogBewerbung(b.getAttribute('data-bew-nein'), 'nein'); });
    });
    alle('[data-kamp-ja]').forEach(function (b) {
      b.addEventListener('click', function () {
        var k = kampagneVon(b.getAttribute('data-kamp-ja'));
        if (!k) return;
        k.status = 'zugesagt';
        if (k.seeding && !k.seeding.versandAm) k.seeding.versandAm = new Date().toISOString();
        speichern(); bauNavigation(); zeige('kampagnen');
        toast('Zugesagt – wir schicken dir das Produkt');
      });
    });
    alle('[data-kamp-nein]').forEach(function (b) {
      b.addEventListener('click', function () {
        var k = kampagneVon(b.getAttribute('data-kamp-nein'));
        if (!k) return;
        k.status = 'abgelehnt';
        speichern(); bauNavigation(); zeige('kampagnen');
        toast('Abgesagt. Kein Problem.');
      });
    });
    alle('[data-kamp-abnehmen]').forEach(function (b) {
      b.addEventListener('click', function () {
        var k = kampagneVon(b.getAttribute('data-kamp-abnehmen'));
        if (!k) return;
        k.status = 'abgenommen';
        k.abnahme = new Date().toISOString();
        speichern(); zeige('a-kampagne-detail');
        toast('Abgenommen – Honorar ist jetzt auszahlbar');
      });
    });
    alle('[data-sperre]').forEach(function (b) {
      b.addEventListener('click', function () {
        var c = creatorVon(b.getAttribute('data-sperre'));
        if (!c) return;
        c.gesperrt = !c.gesperrt;
        speichern(); zeige('a-creator-detail');
        toast(c.gesperrt ? 'Gesperrt' : 'Wieder freigeschaltet');
      });
    });
    var zuInh = el('[data-zu-inhalten]');
    if (zuInh) zuInh.addEventListener('click', function () { zeige('inhalte'); });

    var kn = el('#kamp-neu');
    if (kn) kn.addEventListener('click', dialogKampagne);

    var sb = el('#such-bew');
    if (sb) sb.addEventListener('input', function () {
      var q = sb.value.trim().toLowerCase();
      alle('.bewerb').forEach(function (k) {
        k.hidden = !!q && (k.getAttribute('data-such') || '').indexOf(q) < 0;
      });
    });
    var sc = el('#such-cre');
    if (sc) sc.addEventListener('input', function () {
      var q = sc.value.trim().toLowerCase();
      alle('tr[data-such]').forEach(function (r) {
        r.hidden = !!q && (r.getAttribute('data-such') || '').indexOf(q) < 0;
      });
    });
    var zr = el('#zeitraum');
    if (zr) zr.addEventListener('change', function () { zeige('a-auswertung'); });

    alle('#med-filt .filt').forEach(function (b) {
      b.addEventListener('click', function () {
        alle('#med-filt .filt').forEach(function (x) { x.classList.remove('filt--an'); });
        b.classList.add('filt--an');
        var f = b.getAttribute('data-filt');
        alle('#med-liste > div').forEach(function (d) {
          d.hidden = !!f && d.getAttribute('data-status') !== f;
        });
      });
    });

    var abr = el('#abr-lauf');
    if (abr) abr.addEventListener('click', abrechnungslauf);
    var cAbr = el('#csv-abr');
    if (cAbr) cAbr.addEventListener('click', exportAbrechnung);
    var cCre = el('#csv-creator');
    if (cCre) cCre.addEventListener('click', exportCreator);

    if (el('#form-profil')) verdrahteProfil();
    if (el('#up-drop')) verdrahteUpload();
  }

  // ------- Profil -------
  function verdrahteProfil() {
    var c = creatorVon(sitzung.creatorId);
    var i = 0;
    function zeile(p) {
      var n = i++;
      var d = document.createElement('div');
      d.className = 'socrow';
      d.setAttribute('data-soc', n);
      d.innerHTML =
        '<div class="fld"><label for="pl-netz-' + n + '">Netzwerk</label>' +
        '<select id="pl-netz-' + n + '">' + NETZE.map(function (x) {
          return '<option value="' + esc(x) + '"' + (p && p.netz === x ? ' selected' : '') + '>' + esc(x) + '</option>';
        }).join('') + '</select></div>' +
        '<div class="fld"><label for="pl-handle-' + n + '">Profil</label>' +
        '<input id="pl-handle-' + n + '" type="text" value="' + esc(p ? p.handle : '') + '" placeholder="@name"></div>' +
        '<div class="fld"><label for="pl-foll-' + n + '">Follower</label>' +
        '<input id="pl-foll-' + n + '" type="number" min="0" step="1" value="' + (p ? p.follower : '') + '"></div>' +
        '<button class="socrow__x" type="button" aria-label="Kanal entfernen">' +
        '<svg viewBox="0 0 24 24" width="18" height="18"><use href="#i-x"/></svg></button>';
      el('button', d).addEventListener('click', function () {
        d.remove();
        if (!alle('.socrow').length) el('#pl-liste').appendChild(zeile(null));
      });
      return d;
    }
    var box = el('#pl-liste');
    (c.plattformen && c.plattformen.length ? c.plattformen : [null]).forEach(function (p) {
      box.appendChild(zeile(p));
    });
    el('#pl-plus').addEventListener('click', function () {
      box.appendChild(zeile(null));
      var letzte = alle('.socrow').pop();
      if (letzte) el('select', letzte).focus();
    });

    el('#form-profil').addEventListener('submit', function (ev) {
      ev.preventDefault();
      c.name = el('#p-name').value.trim() || c.name;
      c.kuenstlername = el('#p-kuenstler').value.trim() || c.kuenstlername;
      c.email = el('#p-mail').value.trim();
      c.telefon = el('#p-tel').value.trim();
      c.ueber = el('#p-ueber').value.trim();
      c.strasse = el('#p-strasse').value.trim();
      c.plz = el('#p-plz').value.trim();
      c.ort = el('#p-ort').value.trim();
      c.land = el('#p-land').value;
      c.bankInhaber = el('#p-inhaber').value.trim();
      c.iban = el('#p-iban').value.trim();
      c.ustId = el('#p-ust').value.trim();
      c.kleinunternehmer = el('#p-klein').checked;
      c.plattformen = alle('.socrow').map(function (row) {
        var n = row.getAttribute('data-soc');
        var netz = el('#pl-netz-' + n).value;
        var handle = el('#pl-handle-' + n).value.trim();
        var f = parseInt(el('#pl-foll-' + n).value, 10);
        if (!handle) return null;
        var alt = (c.plattformen || []).filter(function (x) { return x.handle === handle; })[0];
        return { netz: netz, handle: handle, follower: isNaN(f) ? 0 : Math.max(0, f),
                 engagement: alt ? alt.engagement : 0, url: alt ? alt.url : '' };
      }).filter(Boolean);
      speichern();
      var ok = el('#p-ok');
      ok.textContent = 'Gespeichert.';
      ok.hidden = false;
      toast('Profil gespeichert');
    });
  }

  // ------- Upload -------
  var warteschlange = [];
  function verdrahteUpload() {
    warteschlange = [];
    var zone = el('#up-drop'), input = el('#up-datei');
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
    zone.addEventListener('drop', function (ev) { if (ev.dataTransfer) nimmDateien(ev.dataTransfer.files); });
    input.addEventListener('change', function () { nimmDateien(input.files); input.value = ''; });
    el('#up-rechte').addEventListener('change', pruefeSendbar);
    el('#up-senden').addEventListener('click', absendenInhalte);
  }
  function pruefeSendbar() {
    var b = el('#up-senden');
    if (!b) return;
    b.disabled = !(warteschlange.length && el('#up-rechte').checked);
  }
  function nimmDateien(fl) {
    var zuGross = [];
    Array.prototype.slice.call(fl || []).forEach(function (f) {
      if (f.size > REGELN.maxDateiMB * 1048576) { zuGross.push(f.name); return; }
      var art = f.type.indexOf('video') === 0 ? 'video' : 'bild';
      var e = { schluessel: 'W' + Date.now() + Math.random().toString(36).slice(2, 7),
                name: f.name, groesse: f.size, art: art, vorschau: null, dauer: null, fertig: false };
      warteschlange.push(e);
      vorschauErzeugen(e, f);
    });
    var fehler = el('#up-fehler');
    if (zuGross.length) {
      fehler.innerHTML = '<strong>Zu groß:</strong> ' + esc(zuGross.join(', ')) +
        '. Bitte höchstens ' + REGELN.maxDateiMB + ' MB je Datei.';
      fehler.hidden = false;
    } else { fehler.hidden = true; }
    zeichneWarteschlange();
  }
  /** Verkleinert im Browser – ein einziges Handyvideo würde den Speicher sonst sprengen. */
  function vorschauErzeugen(eintrag, datei) {
    function fertig() { eintrag.fertig = true; zeichneWarteschlange(); pruefeSendbar(); }
    try {
      var url = URL.createObjectURL(datei);
      if (eintrag.art === 'bild') {
        var img = new Image();
        img.onload = function () {
          try {
            var b = 560, h = Math.round(img.height * (b / img.width));
            var cv = document.createElement('canvas');
            cv.width = b; cv.height = h;
            cv.getContext('2d').drawImage(img, 0, 0, b, h);
            eintrag.vorschau = cv.toDataURL('image/jpeg', 0.7);
          } catch (e) {}
          URL.revokeObjectURL(url); fertig();
        };
        img.onerror = function () { URL.revokeObjectURL(url); fertig(); };
        img.src = url;
      } else {
        var v = document.createElement('video');
        v.preload = 'metadata'; v.muted = true;
        v.onloadeddata = function () {
          eintrag.dauer = v.duration;
          try {
            var b2 = 560, h2 = Math.round((v.videoHeight || 315) * (b2 / (v.videoWidth || 560)));
            var cv2 = document.createElement('canvas');
            cv2.width = b2; cv2.height = h2;
            cv2.getContext('2d').drawImage(v, 0, 0, b2, h2);
            eintrag.vorschau = cv2.toDataURL('image/jpeg', 0.7);
          } catch (e) {}
          URL.revokeObjectURL(url); fertig();
        };
        v.onerror = function () { URL.revokeObjectURL(url); fertig(); };
        v.src = url;
        try { v.currentTime = 1; } catch (e) {}
      }
    } catch (e) { fertig(); }
  }
  function zeichneWarteschlange() {
    var box = el('#up-liste');
    if (!box) return;
    if (!warteschlange.length) { box.hidden = true; box.innerHTML = ''; return; }
    box.hidden = false;
    box.innerHTML = warteschlange.map(function (e, i) {
      return '<div class="qitem">' +
        (e.vorschau ? '<img src="' + e.vorschau + '" alt="">'
                    : '<span class="qitem__ph"><svg><use href="#i-' + (e.art === 'video' ? 'play' : 'image') + '"/></svg></span>') +
        '<div><strong>' + esc(e.name) + '</strong><br><span class="small muted">' + mb(e.groesse) +
        (e.dauer ? ' · ' + dauerText(e.dauer) : '') + (e.fertig ? '' : ' · wird gelesen …') + '</span></div>' +
        '<button type="button" class="socrow__x" data-q-weg="' + i + '" aria-label="Entfernen">' +
        '<svg viewBox="0 0 24 24" width="18" height="18"><use href="#i-x"/></svg></button></div>';
    }).join('');
    alle('[data-q-weg]', box).forEach(function (b) {
      b.addEventListener('click', function () {
        warteschlange.splice(parseInt(b.getAttribute('data-q-weg'), 10), 1);
        zeichneWarteschlange(); pruefeSendbar();
      });
    });
    pruefeSendbar();
  }
  function absendenInhalte() {
    if (!warteschlange.length) return;
    if (!el('#up-rechte').checked) return;
    var kampId = el('#up-kamp').value || null;
    var netz = 'Instagram';
    var c = creatorVon(sitzung.creatorId);
    if (c.plattformen && c.plattformen.length) netz = c.plattformen[0].netz;

    var farben = ['#2C4A3A', '#3A5240', '#4A5A44', '#5A6B48', '#6E7A5A', '#7C6A4E'];
    var n = 0;
    warteschlange.forEach(function (e, idx) {
      Z.inhalte.unshift({
        id: 'M-' + (600 + Z.inhalte.length + idx),
        creatorId: c.id, kampagnenId: kampId, art: e.art,
        titel: e.name.replace(/\.[a-z0-9]+$/i, ''),
        netz: netz, eingang: new Date().toISOString(), status: 'pruefung',
        ph: farben[(Z.inhalte.length + idx) % farben.length],
        vorschau: e.vorschau || null, dauer: e.dauer || null, groesse: e.groesse,
        pruefung: { kennz: false, heil: false, musik: false, dritte: false },
        rechteKanaele: [], rechteBis: null,
        leistung: { aufrufe: 0, interaktionen: 0, klicks: 0 }
      });
      n++;
    });
    if (kampId) {
      var k = kampagneVon(kampId);
      if (k && k.status === 'zugesagt') k.status = 'inhalt-da';
    }
    if (!speichern()) {
      /* Speicher voll – Vorschaubilder der ältesten Einträge wegwerfen statt abstürzen. */
      Z.inhalte.slice().reverse().some(function (x) {
        if (x.vorschau) { x.vorschau = null; return speichern(); }
        return false;
      });
      speichern();
    }
    warteschlange = [];
    el('#up-rechte').checked = false;
    bauNavigation();
    zeige('inhalte');
    toast(n + (n === 1 ? ' Inhalt' : ' Inhalte') + ' eingereicht');
  }

  // ------- Dialoge -------
  function dlgOeffne(titel, body, ft) {
    el('#dlg-titel').textContent = titel;
    el('#dlg-body').innerHTML = body;
    el('#dlg-ft').innerHTML = ft;
    el('#dlg-haupt').showModal();
  }
  function dlgSchliesse() {
    var d = el('#dlg-haupt');
    if (d.open) d.close();
  }

  function dialogInhalt(id) {
    var c = null;
    Z.inhalte.forEach(function (x) { if (x.id === id) c = x; });
    if (!c) return;
    var cr = creatorVon(c.creatorId);
    var k = c.kampagnenId ? kampagneVon(c.kampagnenId) : null;

    var body = '<p class="dlgtxt"><strong>' + esc(c.titel) + '</strong><br>' +
      '<span class="small muted">' + esc(cr ? cr.kuenstlername : '') + ' · ' + esc(c.netz) + ' · ' +
      datum(c.eingang) + ' · ' + mb(c.groesse) + (c.dauer ? ' · ' + dauerText(c.dauer) : '') + '</span></p>' +
      (k ? '<p class="small muted">Kampagne ' + esc(k.id) + ' · ' + esc(k.titel) + '</p>' : '') +
      '<div class="med__bild med__bild--dlg" style="background:' + (c.vorschau ? 'transparent' : esc(c.ph)) + '">' +
        (c.vorschau ? '<img src="' + esc(c.vorschau) + '" alt="">' : '') + '</div>' +

      '<h3 class="dlgh">Vier Punkte – alle müssen stimmen</h3>' +
      '<div class="pruef">' + PRUEFPUNKTE.map(function (p) {
        return '<label class="pruef__i"><input type="checkbox" data-pp="' + p.id + '">' +
          '<span><strong>' + esc(p.kurz) + '</strong><br><span class="small muted">' + esc(p.text) + '</span></span></label>';
      }).join('') + '</div>' +

      '<h3 class="dlgh">Wofür dürfen wir das verwenden?</h3>' +
      '<div class="pruef">' + KANAELE.map(function (kk) {
        var an = (k && (k.rechteKanaele || []).indexOf(kk.id) >= 0);
        return '<label class="pruef__i"><input type="checkbox" data-kanal="' + kk.id + '"' + (an ? ' checked' : '') + '>' +
          '<span><strong>' + esc(kk.name) + '</strong><br><span class="small muted">' + esc(kk.erklaer) + '</span></span></label>';
      }).join('') + '</div>' +
      '<div class="fld fld--inline" style="margin-top:.8rem"><label for="dlg-monate">Laufzeit in Monaten</label>' +
      '<input id="dlg-monate" type="number" min="1" max="60" value="' +
        (k ? k.rechteMonate : REGELN.rechteMonateStandard) + '"></div>' +

      '<div class="fld" style="margin-top:1rem"><label for="dlg-grund">Wenn du ablehnst: Begründung für den Creator *</label>' +
      '<textarea id="dlg-grund" rows="3" placeholder="Wird wörtlich weitergegeben. Sag genau, was zu ändern ist."></textarea></div>' +
      '<div class="msg msg--err" id="dlg-fehler" hidden role="alert"></div>';

    var ft = '<button class="btn btn--ghost" type="button" id="dlg-ab">Abbrechen</button>' +
      '<button class="btn btn--danger" type="button" id="dlg-nein">Nicht verwendbar</button>' +
      '<button class="btn btn--ok" type="button" id="dlg-ja" disabled>Freigeben</button>';

    dlgOeffne('Inhalt prüfen', body, ft);

    function stand() {
      var alleAn = PRUEFPUNKTE.every(function (p) {
        var b = el('[data-pp="' + p.id + '"]');
        return b && b.checked;
      });
      el('#dlg-ja').disabled = !alleAn;
    }
    alle('[data-pp]').forEach(function (b) { b.addEventListener('change', stand); });
    stand();

    el('#dlg-ab').addEventListener('click', dlgSchliesse);
    el('#dlg-nein').addEventListener('click', function () {
      var g = el('#dlg-grund').value.trim();
      if (!g) {
        var f = el('#dlg-fehler');
        f.textContent = 'Ohne Begründung geht das nicht – der Creator soll wissen, was zu ändern ist.';
        f.hidden = false;
        el('#dlg-grund').focus();
        return;
      }
      c.status = 'abgelehnt';
      c.grund = g;
      c.rechteKanaele = [];
      c.rechteBis = null;
      speichern(); dlgSchliesse(); bauNavigation(); zeige(aktuelleSeite);
      toast('Abgelehnt – der Creator bekommt die Begründung');
    });
    el('#dlg-ja').addEventListener('click', function () {
      var kanaele = alle('[data-kanal]').filter(function (b) { return b.checked; })
        .map(function (b) { return b.getAttribute('data-kanal'); });
      var monate = Math.max(1, parseInt(el('#dlg-monate').value, 10) || REGELN.rechteMonateStandard);
      c.status = 'frei';
      c.grund = null;
      PRUEFPUNKTE.forEach(function (p) { c.pruefung[p.id] = true; });
      c.rechteKanaele = kanaele;
      c.rechteBis = new Date(Date.now() + monate * 30.44 * 86400000).toISOString();
      speichern(); dlgSchliesse(); bauNavigation(); zeige(aktuelleSeite);
      toast('Freigegeben · Rechte bis ' + datum(c.rechteBis));
    });
  }

  function dialogBewerbung(id, art) {
    var b = null;
    Z.bewerbungen.forEach(function (x) { if (x.id === id) b = x; });
    if (!b) return;
    var reich = (b.plattformen || []).reduce(function (s, p) { return s + (p.follower || 0); }, 0);

    if (art === 'nein') {
      dlgOeffne('Absagen',
        '<p class="dlgtxt">Absage an <strong>' + esc(b.kuenstlername || b.name) + '</strong>.</p>' +
        '<div class="fld"><label for="dlg-grund">Kurze Begründung (geht an den Bewerber)</label>' +
        '<textarea id="dlg-grund" rows="3" placeholder="Freundlich bleiben – die Person ist auch Kundin."></textarea></div>',
        '<button class="btn btn--ghost" type="button" id="dlg-ab">Zurück</button>' +
        '<button class="btn btn--danger" type="button" id="dlg-nein2">Absagen</button>');
      el('#dlg-ab').addEventListener('click', dlgSchliesse);
      el('#dlg-nein2').addEventListener('click', function () {
        b.status = 'abgelehnt';
        b.antwort = el('#dlg-grund').value.trim();
        speichern(); dlgSchliesse(); bauNavigation(); zeige('a-bewerbungen');
        toast('Abgesagt');
      });
      return;
    }

    var vorschlag = codeVorschlag(b);
    var honorar = honorarVorschlag(reich);
    dlgOeffne('Aufnehmen',
      '<p class="dlgtxt"><strong>' + esc(b.kuenstlername || b.name) + '</strong> aufnehmen.</p>' +
      '<div class="fld"><label for="dlg-code">Rabattcode</label>' +
      '<input id="dlg-code" type="text" value="' + esc(vorschlag) + '"></div>' +
      '<p class="small muted">Wird auf Eindeutigkeit geprüft – zwei gleiche Codes würden dieselbe ' +
      'Bestellung zwei Creatorn zuordnen.</p>' +
      '<div class="note note--gold" style="margin-top:1rem"><strong>Honorar-Anhalt: ' + eur0(honorar) +
      ' je Kampagne.</strong><br><span class="small">Grob aus ' + kurz(reich) + ' Reichweite abgeleitet. ' +
      'Der Wert ist ein Platzhalter, kein Marktpreis – wer verhandelt, setzt ihn.</span></div>' +
      '<div class="msg msg--err" id="dlg-fehler" hidden role="alert"></div>',
      '<button class="btn btn--ghost" type="button" id="dlg-ab">Abbrechen</button>' +
      '<button class="btn btn--ok" type="button" id="dlg-ja2">Aufnehmen</button>');

    el('#dlg-ab').addEventListener('click', dlgSchliesse);
    el('#dlg-ja2').addEventListener('click', function () {
      var code = el('#dlg-code').value.trim().toUpperCase();
      var f = el('#dlg-fehler');
      if (!code) { f.textContent = 'Ohne Code geht es nicht.'; f.hidden = false; return; }
      if (Z.creator.some(function (c) { return c.code === code; })) {
        f.textContent = 'Diesen Code gibt es schon. Bitte einen anderen wählen.';
        f.hidden = false;
        return;
      }
      Z.creator.push({
        id: neueCreatorId(), name: b.name, kuenstlername: b.kuenstlername || b.name,
        ort: b.ort || '', plz: '', strasse: '', telefon: b.telefon || '', land: b.land || 'DE',
        email: b.email, code: code, seit: new Date().toISOString(),
        ueber: b.ueber || '', plattformen: b.plattformen || [],
        bankInhaber: '', iban: '', kleinunternehmer: !!b.kleinunternehmer, ustId: '', gesperrt: false
      });
      b.status = 'angenommen';
      speichern(); dlgSchliesse(); bauNavigation(); zeige('a-bewerbungen');
      toast('Aufgenommen · Code ' + code);
    });
  }

  function dialogKampagne() {
    var frei = Z.creator.filter(function (c) { return !c.gesperrt; });
    dlgOeffne('Kampagne anlegen',
      '<div class="fld"><label for="nk-creator">Creator</label><select id="nk-creator">' +
      frei.map(function (c) {
        return '<option value="' + c.id + '">' + esc(c.kuenstlername) + ' · ' + kurz(reichweiteVon(c)) + '</option>';
      }).join('') + '</select></div>' +
      '<div class="fld"><label for="nk-titel">Titel</label>' +
      '<input id="nk-titel" type="text" placeholder="z. B. Herbstserie – 2 Reels"></div>' +
      '<div class="fld"><label for="nk-brief">Briefing</label>' +
      '<textarea id="nk-brief" rows="4" placeholder="Was soll entstehen? Was ist tabu?"></textarea></div>' +
      '<div class="fld"><label for="nk-leist">Leistungen, eine je Zeile</label>' +
      '<textarea id="nk-leist" rows="3" placeholder="2 Reels&#10;3 Standbilder"></textarea></div>' +
      '<div class="row2">' +
      '<div class="fld"><label for="nk-frist">Abgabe bis</label><input id="nk-frist" type="date"></div>' +
      '<div class="fld"><label for="nk-honorar">Honorar in Euro</label>' +
      '<input id="nk-honorar" type="number" min="0" step="10" value="350"></div></div>' +
      '<h3 class="dlgh">Nutzungsrechte</h3>' +
      '<div class="pruef">' + KANAELE.map(function (kk, i) {
        return '<label class="pruef__i"><input type="checkbox" data-nk-kanal="' + kk.id + '"' +
          (i < 2 ? ' checked' : '') + '><span><strong>' + esc(kk.name) + '</strong></span></label>';
      }).join('') + '</div>' +
      '<div class="fld fld--inline" style="margin-top:.8rem"><label for="nk-monate">Laufzeit in Monaten</label>' +
      '<input id="nk-monate" type="number" min="1" max="60" value="' + REGELN.rechteMonateStandard + '"></div>' +
      '<div class="row2" style="margin-top:.6rem">' +
      '<div class="fld"><label for="nk-ware">Produkt, das wir schicken</label>' +
      '<input id="nk-ware" type="text" value="Gelenk-Tabletten 100 Stück"></div>' +
      '<div class="fld"><label for="nk-wert">Warenwert in Euro</label>' +
      '<input id="nk-wert" type="number" min="0" step="0.05" value="27.95"></div></div>' +
      '<div class="msg msg--err" id="dlg-fehler" hidden role="alert"></div>',
      '<button class="btn btn--ghost" type="button" id="dlg-ab">Abbrechen</button>' +
      '<button class="btn btn--primary" type="button" id="dlg-neu">Anlegen und anbieten</button>');

    var d = new Date(); d.setDate(d.getDate() + 21);
    el('#nk-frist').value = d.toISOString().slice(0, 10);

    el('#dlg-ab').addEventListener('click', dlgSchliesse);
    el('#dlg-neu').addEventListener('click', function () {
      var f = el('#dlg-fehler');
      var titel = el('#nk-titel').value.trim();
      var brief = el('#nk-brief').value.trim();
      if (!titel || !brief) {
        f.textContent = 'Titel und Briefing brauchen wir – ohne die weiß niemand, was gemeint ist.';
        f.hidden = false;
        return;
      }
      var kanaele = alle('[data-nk-kanal]').filter(function (b) { return b.checked; })
        .map(function (b) { return b.getAttribute('data-nk-kanal'); });
      if (!kanaele.length) {
        f.textContent = 'Mindestens ein Nutzungsrecht auswählen.';
        f.hidden = false;
        return;
      }
      var nr = 141;
      Z.kampagnen.forEach(function (k) {
        var z = parseInt(String(k.id).replace(/[^0-9]/g, ''), 10);
        if (!isNaN(z) && z >= nr) nr = z + 1;
      });
      Z.kampagnen.unshift({
        id: 'K-' + nr, titel: titel, creatorId: el('#nk-creator').value, briefing: brief,
        leistungen: el('#nk-leist').value.split('\n').map(function (t) { return t.trim(); }).filter(Boolean),
        start: new Date().toISOString(),
        deadline: new Date(el('#nk-frist').value || Date.now()).toISOString(),
        honorar: parseFloat(el('#nk-honorar').value) || 0,
        rechteKanaele: kanaele,
        rechteMonate: Math.max(1, parseInt(el('#nk-monate').value, 10) || REGELN.rechteMonateStandard),
        status: 'angeboten',
        seeding: { artikel: el('#nk-ware').value.trim(),
                   wert: parseFloat(el('#nk-wert').value) || 0, versandAm: null }
      });
      speichern(); dlgSchliesse(); bauNavigation(); zeige('a-kampagnen');
      toast('Kampagne K-' + nr + ' angelegt und angeboten');
    });
  }

  function neueCreatorId() {
    var max = 2000;
    Z.creator.forEach(function (c) {
      var z = parseInt(String(c.id).replace(/[^0-9]/g, ''), 10);
      if (!isNaN(z) && z > max) max = z;
    });
    return 'C-' + (max + 1);
  }
  function codeVorschlag(b) {
    var basis = (b.kuenstlername || b.name || 'CREATOR')
      .replace(/[^A-Za-zÄÖÜäöüß0-9]/g, '')
      .toUpperCase()
      .replace(/Ä/g, 'AE').replace(/Ö/g, 'OE').replace(/Ü/g, 'UE').replace(/SS/g, 'SS')
      .slice(0, 12) || 'CREATOR';
    var code = basis + '10', n = 2;
    while (Z.creator.some(function (c) { return c.code === code; })) {
      code = basis + '10-' + n; n++;
    }
    return code;
  }

  // ------- Abrechnung -------
  function abrechnungslauf() {
    var f = faellige();
    if (!f.length) { toast('Nichts fällig'); return; }
    var jahr = new Date().getFullYear();
    var n = 0;
    f.forEach(function (x) {
      Z.belegZaehler++;
      Z.auszahlungen.push({
        id: 'GS-' + jahr + '-' + String(Z.belegZaehler).padStart(4, '0'),
        beleg: 'GS-' + jahr + '-' + String(Z.belegZaehler).padStart(4, '0'),
        creatorId: x.c.id, datum: new Date().toISOString(),
        betrag: Math.round(x.a.auszahlbar * 100) / 100,
        honorar: Math.round(x.a.honorarGesamt * 100) / 100,
        beteiligung: Math.round((x.a.auszahlbar - x.a.honorarGesamt) * 100) / 100,
        praemie: 0
      });
      n++;
    });
    speichern();
    zeige('a-abrechnung');
    toast(n + ' Gutschriften erzeugt');
  }
  function csvHerunterladen(kopf, zeilen, name, meldung) {
    var csv = [kopf.join(';')].concat(zeilen.map(function (z) {
      return z.map(function (w) {
        var s = String(w == null ? '' : w);
        return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(';');
    })).join('\n');
    var b = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 400);
    toast(meldung);
  }
  function exportCreator() {
    csvHerunterladen(
      ['ID', 'Kanal', 'Name', 'Ort', 'Land', 'Code', 'Reichweite', 'Stufe', 'Inhalte frei',
       'Bestellungen', 'Umsatz netto', 'Honorare', 'Beteiligung', 'Warenwert', 'Auszahlbar'],
      alleAuswertungen().map(function (x) {
        return [x.c.id, x.c.kuenstlername, x.c.name, x.c.ort, x.c.land, x.c.code,
          x.a.reichweite, x.a.stufe.name, x.a.inhalteFrei, x.a.anzahl,
          x.a.umsatzNetto.toFixed(2).replace('.', ','), x.a.honorarGesamt.toFixed(2).replace('.', ','),
          x.a.betGesamt.toFixed(2).replace('.', ','), x.a.seedingWert.toFixed(2).replace('.', ','),
          x.a.auszahlbar.toFixed(2).replace('.', ',')];
      }),
      'creator-uebersicht.csv', 'CSV erzeugt');
  }
  function exportAbrechnung() {
    csvHerunterladen(
      ['Creator', 'Name', 'Land', 'Kontoinhaber', 'IBAN', 'Steuernummer', 'Kleinunternehmer',
       'Honorar', 'Beteiligung', 'Auszahlung'],
      faellige().map(function (x) {
        return [x.c.id, x.c.name, x.c.land, x.c.bankInhaber, x.c.iban, x.c.ustId,
          x.c.kleinunternehmer ? 'ja' : 'nein',
          x.a.honorarGesamt.toFixed(2).replace('.', ','),
          (x.a.auszahlbar - x.a.honorarGesamt).toFixed(2).replace('.', ','),
          x.a.auszahlbar.toFixed(2).replace('.', ',')];
      }),
      'creator-abrechnung.csv', 'CSV für die Buchhaltung erzeugt');
  }

  // ---------------------------------------------------------------
  // 12. Start
  // ---------------------------------------------------------------
  function start() {
    laden();

    el('#form-login').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var m = el('#l-mail').value, p = el('#l-pw').value;
      if (!anmelden(m, p)) {
        var f = el('#l-fehler');
        f.textContent = 'E-Mail oder Passwort stimmt nicht. Im Prototyp: demo1234.';
        f.hidden = false;
        return;
      }
      losGehts();
    });
    alle('[data-demo]').forEach(function (b) {
      b.addEventListener('click', function () {
        var r = b.getAttribute('data-demo');
        anmelden(r === 'admin' ? 'creator@natureflow-pets.com' : 'lena@beispiel.de', 'demo1234');
        losGehts();
      });
    });
    el('#btn-logout').addEventListener('click', abmelden);
    el('#btn-menu').addEventListener('click', function () {
      var s = el('#side');
      var auf = s.getAttribute('data-offen') === 'true';
      s.setAttribute('data-offen', auf ? 'false' : 'true');
      el('#btn-menu').setAttribute('aria-expanded', auf ? 'false' : 'true');
    });
    el('#btn-reset').addEventListener('click', function () {
      zuruecksetzen();
      bauNavigation();
      zeige(sitzung && sitzung.rolle === 'admin' ? 'a-uebersicht' : 'uebersicht');
      toast('Demodaten zurückgesetzt');
    });

    function losGehts() {
      laden();
      el('#view-login').hidden = true;
      el('#view-app').hidden = false;
      var c = sitzung.creatorId ? creatorVon(sitzung.creatorId) : null;
      el('#who').textContent = sitzung.rolle === 'admin' ? 'Verwaltung' : (c ? c.kuenstlername : '');
      el('#top-title').textContent = sitzung.rolle === 'admin' ? 'Creator-Verwaltung' : 'Creator-Bereich';
      bauNavigation();
      zeige(sitzung.rolle === 'admin' ? 'a-uebersicht' : 'uebersicht');
    }

    /* Marker: erst ab hier ist die Anwendung wirklich bedienbar.
       Ein Test, der vorher klickt, misst einen Zustand, den es nie gab. */
    window.__crPortalBereit = true;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
