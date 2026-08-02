/* ============================================================================
   NatureFlow Pets · Fassung B4.5 — zwei Dialoge
   1. Beratungs-Rechner: fragt Gewicht, Alter, Anliegen und Beobachtungen ab
      und empfiehlt daraus Produkte bzw. Kombinationen, inklusive Tagesmenge,
      passender Packungsgröße und Abo-Intervall.
   2. Abo-Hinweis: rechnet beim Einmalkauf die Ersparnis eines Abos vor und
      bietet den Wechsel mit einem Klick an.

   Haltung, die den Regeln dieses Shops folgt:
   · Der Rechner darf auch ABRATEN. Beim Junghund und beim gesunden
     erwachsenen Hund ohne Anzeichen empfiehlt er nichts zu kaufen.
   · Sichtbarer Schmerz oder Lahmheit führt IMMER zuerst zur Tierärztin,
     nicht zu einem Produkt.
   · Alle Dosierungen stammen aus der amtlichen Deklaration der Produkte,
     keine geschätzten Mengen.
   · Der Abo-Hinweis hat keine Dunkelmuster: kein Countdown, keine
     Schuldsprache, und der Knopf „Einmalig kaufen" ist gleich gut erreichbar.
   ============================================================================ */
(function () {
  'use strict';
  var N = window.NFP;
  if (!N) return;

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  /* ---------------------------------------------------------------- Dosierung
     Werte 1:1 aus den Fütterungsempfehlungen der Produkte (Live-Shop). */
  var DOSING = {
    'gelenk-tabletten':        { perKg: 0.1,   min: 1,   unit: 'Tablette',  unitPl: 'Tabletten', dez: 0,
                                 quelle: '1 Tablette je 10 kg, einmal täglich' },
    'relax-calm-tabletten':    { perKg: 0.1,   min: 1,   unit: 'Tablette',  unitPl: 'Tabletten', dez: 0,
                                 quelle: '1 Tablette je 10 kg Körpergewicht' },
    'praebiotikum-probiotikum':{ perKg: 0.1,   min: 1,   unit: 'Tablette',  unitPl: 'Tabletten', dez: 0,
                                 quelle: '1 Tablette je 10 kg, bis zu 4 Wochen' },
    'gruenlippmuschelpulver':  { perKg: 0.25,  min: 2.5, unit: 'g',         unitPl: 'g',         dez: 1,
                                 quelle: '2,5 g je 10 kg Körpergewicht' },
    'gelenk-kollagen':         { perKg: 0.25,  min: 2.5, unit: 'g',         unitPl: 'g',         dez: 1,
                                 quelle: '5 g je 20 kg (1 Messlöffel)' },
    'gelenkoel':               { perKg: 0.25,  min: 2.5, unit: 'ml',        unitPl: 'ml',        dez: 1,
                                 quelle: '½ Teelöffel (2,5 ml) je 10 kg' },
    'teufelskralle-liquid':    { perKg: 0.25,  min: 2.5, unit: 'ml',        unitPl: 'ml',        dez: 1,
                                 quelle: '½ Teelöffel (2,5 ml) je 10 kg' }
  };

  function tagesmenge(key, kg) {
    var d = DOSING[key]; if (!d) return null;
    var m = Math.max(d.min, kg * d.perKg);
    if (d.dez === 0) m = Math.max(d.min, Math.ceil(kg * d.perKg));
    else m = Math.round(m * 10) / 10;
    return m;
  }
  function mengeText(key, kg) {
    var d = DOSING[key], m = tagesmenge(key, kg);
    var z = d.dez === 0 ? String(m) : String(m).replace('.', ',');
    if (d.unit === 'Tablette') return z + ' ' + (m === 1 ? d.unit : d.unitPl);
    return z + ' ' + d.unit;
  }
  /* Reichweite einer Packung in Tagen */
  function reichweite(key, vid, kg) {
    var v = N.findVariant(key, vid), m = tagesmenge(key, kg);
    if (!v || !m) return 0;
    return Math.floor(v.per / m);
  }
  /* Packungsgröße wählen: die kleinste, die mindestens acht Wochen reicht.
     Reicht keine so weit, die größte nehmen. Acht Wochen, weil die Wirkung
     erst nach drei bis sechs Wochen beurteilbar ist – eine Packung, die
     vorher leer ist, führt zum Abbruch aus dem falschen Grund. */
  function packung(key, kg) {
    var p = N.PRODUCTS[key];
    var ziel = 56, gewaehlt = null;
    for (var i = 0; i < p.variants.length; i++) {
      var t = reichweite(key, p.variants[i].id, kg);
      if (t >= ziel) { gewaehlt = p.variants[i]; break; }
    }
    if (!gewaehlt) gewaehlt = p.variants[p.variants.length - 1];
    return gewaehlt;
  }
  /* Abo-Intervall: das größte, das die Packung noch sicher überdauert –
     lieber etwas Vorrat als eine Lücke. */
  function intervall(tage) {
    var w = Math.floor(tage / 7);
    if (w >= 12) return '12';
    if (w >= 8) return '8';
    if (w >= 6) return '6';
    return '4';
  }

  /* ================================================================ 1. RECHNER
     Fragen als Daten, damit sich Reihenfolge und Wortlaut ändern lassen,
     ohne die Anzeige anzufassen. `when` blendet Folgefragen ein. */
  var STEPS = [
    { id: 'thema', typ: 'check', frage: 'Worum geht es dir?',
      hinweis: 'Mehrfachauswahl möglich. Wenn nichts davon zutrifft, wähle den letzten Punkt.',
      opts: [
        { v: 'gelenke',   t: 'Bewegung und Gelenke', s: 'Steifheit, Treppen, kürzere Runden' },
        { v: 'verdauung', t: 'Verdauung und Immunsystem', s: 'Weicher Kot, Blähungen, nach Antibiotika' },
        { v: 'nerven',    t: 'Nervosität und Anspannung', s: 'Silvester, Gewitter, Autofahren, Alleinbleiben' },
        { v: 'vorbeugen', t: 'Nichts Konkretes – ich will vorbeugen', s: 'Es ist alles in Ordnung, ich denke voraus' }
      ] },

    { id: 'gelenk', typ: 'check', frage: 'Was fällt dir an seiner Bewegung auf?',
      hinweis: 'Mehrfachauswahl. Je genauer, desto passender die Empfehlung.',
      when: function (a) { return has(a.thema, 'gelenke'); },
      opts: [
        { v: 'steif',   t: 'Steif nach dem Liegen', s: 'Läuft sich in den ersten Minuten frei' },
        { v: 'treppe',  t: 'Zögert vor Treppe, Auto oder Sofa', s: 'Nimmt Anlauf oder braucht Hilfe' },
        { v: 'kurz',    t: 'Die Runden werden kürzer', s: 'Bleibt öfter stehen, dreht früher um' },
        { v: 'sport',   t: 'Er ist sportlich stark gefordert', s: 'Agility, Zugsport, lange Touren' },
        { v: 'befund',  t: 'Es gibt einen Befund', s: 'HD, ED, Arthrose, operiertes Kreuzband' },
        { v: 'schmerz', t: 'Er lahmt oder zeigt Schmerzen', s: 'Belastet ein Bein nicht, jault, ist berührungsempfindlich' }
      ] },

    { id: 'verdauung', typ: 'check', frage: 'Was beobachtest du bei der Verdauung?',
      when: function (a) { return has(a.thema, 'verdauung'); },
      opts: [
        { v: 'weich',   t: 'Weicher Kot oder Durchfall', s: 'Immer wieder, ohne klaren Auslöser' },
        { v: 'blaeh',   t: 'Blähungen oder Magengeräusche', s: '' },
        { v: 'anti',    t: 'Nach einer Antibiotikagabe', s: 'Die Darmflora soll sich erholen' },
        { v: 'umstell', t: 'Futterumstellung steht an oder war gerade', s: '' },
        { v: 'haut',    t: 'Juckreiz oder stumpfes Fell', s: 'Kann mit dem Darm zusammenhängen' },
        { v: 'blut',    t: 'Blut im Kot oder anhaltendes Erbrechen', s: 'Seit mehreren Tagen' }
      ] },

    { id: 'nerven', typ: 'check', frage: 'Wann ist er angespannt?',
      when: function (a) { return has(a.thema, 'nerven'); },
      opts: [
        { v: 'silvester', t: 'Silvester oder Gewitter', s: 'Laute Geräusche' },
        { v: 'auto',      t: 'Autofahrten', s: '' },
        { v: 'allein',    t: 'Beim Alleinbleiben', s: '' },
        { v: 'dauer',     t: 'Grundsätzlich unruhig', s: 'Kommt schwer zur Ruhe, auch ohne Anlass' }
      ] },

    { id: 'kg', typ: 'zahl', frage: 'Wie viel wiegt dein Hund?',
      hinweis: 'Die Dosierung aller Produkte richtet sich nach dem Gewicht. Eine grobe Schätzung genügt – auf ein, zwei Kilo kommt es nicht an.' },

    { id: 'alter', typ: 'radio', frage: 'Wie alt ist er?',
      hinweis: 'Ab wann ein Hund als Senior gilt, hängt von seiner Größe ab. Das rechnen wir mit ein.',
      opts: [
        { v: 'welpe',    t: 'Unter 1 Jahr',  s: 'Welpe oder Junghund im Wachstum' },
        { v: 'jung',     t: '1 bis 6 Jahre', s: 'Erwachsen' },
        { v: 'reif',     t: '7 bis 9 Jahre', s: 'Beginnendes Seniorenalter' },
        { v: 'senior',   t: '10 Jahre oder älter', s: 'Senior' }
      ] },

    { id: 'form', typ: 'radio', frage: 'Wie bekommt er es am ehesten?',
      hinweis: 'Das entscheidet oft mehr über den Erfolg als die Rezeptur – was nicht gefressen wird, wirkt nicht.',
      opts: [
        { v: 'tablette', t: 'Tabletten nimmt er problemlos', s: 'Aus der Hand oder im Futter versteckt' },
        { v: 'futter',   t: 'Lieber Pulver oder Öl ins Futter', s: 'Tabletten spuckt er aus oder sortiert sie heraus' },
        { v: 'egal',     t: 'Beides geht', s: '' }
      ] },

    { id: 'schon', typ: 'radio', frage: 'Gibst du schon etwas für die Gelenke?',
      when: function (a) { return has(a.thema, 'gelenke'); },
      opts: [
        { v: 'nein',    t: 'Nein, noch nichts', s: '' },
        { v: 'nfp',     t: 'Ja, die Gelenk-Tabletten von euch', s: 'Ich möchte gezielt aufstocken' },
        { v: 'anderes', t: 'Ja, ein anderes Präparat', s: '' }
      ] }
  ];

  function has(arr, v) { return !!arr && arr.indexOf(v) !== -1; }

  /* ------------------------------------------------ Empfehlungs-Logik ------
     Gibt Hinweise (flags) und bis zu drei Produkte mit Begründung zurück.
     Jede Begründung bezieht sich auf die Antworten – eine Empfehlung ohne
     erkennbaren Grund ist keine Beratung, sondern Werbung. */
  function empfehlung(a) {
    var kg = a.kg, flags = [], recs = [], hinweisText = '';
    var seniorisch = a.alter === 'senior' || (a.alter === 'reif' && kg >= 25);
    var gelenkSignale = (a.gelenk || []).filter(function (v) {
      return v === 'steif' || v === 'treppe' || v === 'kurz';
    }).length;
    var add = function (key, rank, why) {
      if (recs.length >= 3) return;
      for (var i = 0; i < recs.length; i++) if (recs[i].key === key) return;
      recs.push({ key: key, rank: rank, why: why });
    };

    /* --- Abbruchgründe zuerst: hier geht es nicht um ein Produkt --- */
    if (has(a.gelenk, 'schmerz')) {
      flags.push({ typ: 'vet', ic: 'ic-vet', t: 'Bitte zuerst zur Tierärztin',
        p: 'Sichtbare Lahmheit oder Schmerz gehört untersucht – dahinter kann alles von einer Zerrung bis zu einem Kreuzbandriss stecken. Ein Ergänzungsfuttermittel ist hier keine Antwort und kostet nur Zeit. Was unten steht, ist als <b>Begleitung nach der Abklärung</b> gedacht, nicht als Ersatz dafür.' });
    }
    if (has(a.verdauung, 'blut')) {
      flags.push({ typ: 'vet', ic: 'ic-vet', t: 'Das gehört heute noch abgeklärt',
        p: 'Blut im Kot oder anhaltendes Erbrechen sind keine Fälle für ein Ergänzungsfuttermittel. Bitte zeitnah tierärztlich abklären lassen – wir empfehlen dazu bewusst nichts.' });
      return { flags: flags, recs: [], stop: true };
    }
    if (a.alter === 'welpe') {
      flags.push({ typ: 'info', ic: 'ic-paw', t: 'Beim Junghund raten wir ab',
        p: 'In der Wachstumsphase ist das Wichtigste, was man <b>nicht</b> tut: nicht überfüttern, nicht eigenmächtig mit Calcium ergänzen, Belastung dosieren. Eine Gelenkergänzung bringt hier nach heutigem Stand nichts und kann in ungünstigen Fällen sogar stören. Wenn du unsicher bist, ist das Gespräch bei der nächsten Impfung der bessere Weg als eine Bestellung.' });
      if (has(a.thema, 'verdauung') && !has(a.verdauung, 'blut')) {
        add('praebiotikum-probiotikum', 'Einzige Ausnahme',
          'Bei Verdauungsthemen ist eine Darmunterstützung auch beim Junghund vertretbar – etwa nach einer Antibiotikagabe oder bei einer Futterumstellung. Sprich die Gabe trotzdem beim nächsten Termin kurz an.');
      }
      return { flags: flags, recs: recs, stop: recs.length === 0 };
    }

    /* --- Gelenke --- */
    if (has(a.thema, 'gelenke')) {
      var stark = gelenkSignale >= 2 || has(a.gelenk, 'befund') || seniorisch;
      var grund = has(a.gelenk, 'befund') ? ', weil ein Befund vorliegt'
        : gelenkSignale >= 2 ? ', weil du gleich mehrere Anzeichen beschreibst'
        : seniorisch ? ', weil er altersbedingt zur Gruppe mit erhöhtem Bedarf gehört'
        : has(a.gelenk, 'sport') ? ', weil er sportlich stark gefordert wird'
        : ' als Einstieg';

      if (a.schon === 'nfp') {
        /* Wer die Tabletten schon gibt, braucht keine zweite Tablette,
           sondern einen anderen Ansatzpunkt. */
        add('gelenkoel', 'Sinnvollste Ergänzung',
          'Du gibst die Gelenk-Tabletten bereits. Der nächste Schritt ist kein weiteres Tablettenprodukt, sondern ein anderer Wirkweg: Omega-3 hat von allen Stoffen in unserem Sortiment die beste Studienlage und ergänzt die Tablette, statt sie zu wiederholen.');
        if (stark) add('gelenk-kollagen', 'Für den Bindegewebs-Anteil',
          'Kollagenhydrolysat setzt am Bindegewebe an und deckt damit einen Bereich ab, den Grünlippmuschel und Glucosamin nicht abdecken. Sinnvoll' + grund + '.');
        else add('gruenlippmuschelpulver', 'Wenn du die Muschel-Dosis erhöhen willst',
          'Reines Pulver ohne Zusätze – damit hebst du gezielt die Grünlippmuschel-Menge an, ohne alle anderen Stoffe mitzuerhöhen.');
      } else if (a.form === 'futter') {
        add('gruenlippmuschelpulver', 'Unsere Empfehlung',
          'Weil Tabletten bei euch schwierig sind: reines Grünlippmuschelpulver wird unters Futter gemischt und enthält sonst nichts. Passt' + grund + '.');
        if (stark) add('gelenkoel', 'Gut kombinierbar',
          'Öl lässt sich genauso einfach untermischen und bringt Omega-3 dazu – der Stoff mit der besten Datenlage bei Gelenkbeschwerden.');
        if (gelenkSignale >= 2 && recs.length < 3) add('teufelskralle-liquid', 'Flüssig und tropfengenau',
          'Wenn du zusätzlich einen pflanzlichen Begleitstoff geben möchtest: flüssig, hochkonzentriert und exakt dosierbar. Nicht für tragende Hündinnen.');
      } else {
        add('gelenk-tabletten', 'Unsere Empfehlung',
          'Vier Gelenkstoffe in einer Gabe – 300 mg Grünlippmuschel, 75 mg Glucosamin, 75 mg MSM und 15 mg Chondroitin je Tablette. Feste Dosierung nach Gewicht, kein Abmessen. Passt' + grund + '.');
        if (stark) add('gelenkoel', 'Sinnvolle Ergänzung',
          'Omega-3 aus fünf Ölen. Von allen Stoffen in diesem Sortiment hat es die beste Studienlage – und es wirkt über einen anderen Weg als die Tablette, ergänzt sie also wirklich.');
      }
    }

    /* --- Verdauung --- */
    if (has(a.thema, 'verdauung')) {
      var vGrund = has(a.verdauung, 'anti') ? 'Nach einer Antibiotikagabe ist der Aufbau der Darmflora der klassische Anwendungsfall.'
        : has(a.verdauung, 'umstell') ? 'Bei einer Futterumstellung hilft es, den Darm in der Übergangszeit zu begleiten.'
        : has(a.verdauung, 'haut') ? 'Juckreiz und stumpfes Fell hängen häufiger mit dem Darm zusammen, als man denkt – deshalb ist das der richtige Ansatzpunkt.'
        : 'Bei wiederkehrenden Verdauungsthemen ist das der Ansatzpunkt.';
      add('praebiotikum-probiotikum', has(a.thema, 'gelenke') ? 'Für das zweite Thema' : 'Unsere Empfehlung',
        vGrund + ' Enthält Bacillus subtilis als Probiotikum und mit FOS, MOS, Pektin und Flohsamenschalen gleich vier präbiotische Bestandteile. Gedacht als Kur über bis zu vier Wochen.');
    }

    /* --- Nerven --- */
    if (has(a.thema, 'nerven')) {
      var nGrund = has(a.nerven, 'silvester')
        ? 'Wichtig dabei: Das ist kein Mittel für den Abend selbst. In den Bewertungen beschreiben Halter immer wieder, dass zwei Wochen Vorlauf zu knapp waren – rechne mit vier bis sechs Wochen vor dem Termin.'
        : has(a.nerven, 'auto') ? 'Für wiederkehrende Situationen wie Autofahrten geben Halter es meist dauerhaft und nicht nur am Tag selbst.'
        : has(a.nerven, 'dauer') ? 'Bei grundsätzlicher Unruhe ist die tägliche Gabe über mehrere Wochen der übliche Weg.'
        : 'Gib es über mehrere Wochen, nicht nur am Tag des Anlasses.';
      add('relax-calm-tabletten', has(a.thema, 'gelenke') || has(a.thema, 'verdauung') ? 'Für das zweite Thema' : 'Unsere Empfehlung',
        'Mit L-Tryptophan, Ashwagandha, Hanf, Passionsblume, Hopfen und Baldrian. ' + nGrund);
    }

    /* --- Nur vorbeugen: ehrlich abraten, wenn es nichts zu tun gibt --- */
    if (has(a.thema, 'vorbeugen') && !recs.length) {
      if (a.alter === 'jung' && kg < 25) {
        flags.push({ typ: 'ok', ic: 'ic-check', t: 'Ehrlich gesagt: Du brauchst gerade nichts',
          p: 'Ein erwachsener Hund unter 25 kg ohne Befund, ohne Anzeichen und ohne sportliche Dauerbelastung profitiert nach heutigem Stand nicht messbar von einer Gelenkergänzung. Wir könnten dir hier etwas verkaufen – sinnvoller ist: Gewicht knapp halten, regelmäßig gleichmäßig bewegen, rutschige Böden entschärfen. Das wirkt nachweislich und kostet nichts.' });
        hinweisText = 'Wenn du trotzdem etwas tun möchtest, ist Omega-3 der Stoff mit der besten Datenlage – aber es eilt nicht.';
      } else {
        var vorGrund = seniorisch ? ', weil er altersbedingt zur Gruppe mit erhöhtem Bedarf gehört'
          : kg >= 25 ? ', weil große und schwere Hunde früher betroffen sind als kleine'
          : ' als vorbeugende Grundlage';
        add('gelenkoel', 'Wenn vorbeugen, dann hiermit',
          'Omega-3 aus fünf Ölen hat von allen Stoffen in diesem Sortiment die beste Studienlage – und ist damit die vernünftigste Wahl, wenn es noch keine Beschwerden gibt. Sinnvoll' + vorGrund + '.');
      }
    }

    /* --- Erwartungsmanagement, wenn etwas empfohlen wird --- */
    if (recs.length && !has(a.gelenk, 'schmerz')) {
      flags.push({ typ: 'info', ic: 'ic-clock', t: 'Was du wann erwarten kannst',
        p: 'Die ersten zwei Wochen sind Gewöhnung. Erste Unterschiede im Alltag beschreiben Halter typischerweise nach <b>drei bis sechs Wochen</b>. Deshalb ist die Packungsgröße unten so gewählt, dass sie mindestens acht Wochen reicht – und deshalb gibt es 120 Tage Geld zurück statt 14.' });
    }
    return { flags: flags, recs: recs, hinweisText: hinweisText, stop: false };
  }

  /* ------------------------------------------------------- Anzeige Rechner */
  var dlg = null, idx = 0, ant = {};

  function sichtbareSteps() {
    return STEPS.filter(function (s) { return !s.when || s.when(ant); });
  }

  function render() {
    var steps = sichtbareSteps();
    if (idx >= steps.length) return renderErgebnis();
    var s = steps[idx];
    var body = $('[data-wiz-body]', dlg), ft = $('[data-wiz-ft]', dlg);

    var bar = '<div class="wiz__bar" aria-hidden="true">';
    for (var i = 0; i < steps.length; i++) bar += '<i class="' + (i <= idx ? 'on' : '') + '"></i>';
    bar += '</div>';
    /* Vor der ersten Antwort steht die Gesamtzahl noch nicht fest (die
       Folgefragen hängen an „thema"). Dann wird sie auch nicht behauptet. */
    var kennt = ant.thema !== undefined;
    $('[data-wiz-progress]', dlg).innerHTML =
      '<span class="wiz__step">Schritt ' + (idx + 1) + (kennt ? ' von ' + steps.length : '') +
      '</span>' + (kennt ? bar : '');

    var h = '<p class="q__t" id="wiz-frage">' + s.frage + '</p>';
    if (s.hinweis) h += '<p class="q__h">' + s.hinweis + '</p>';

    if (s.typ === 'zahl') {
      var kg = ant.kg || 20;
      h += '<div class="kg">' +
           '<label class="vh" for="wiz-kg">Gewicht in Kilogramm</label>' +
           '<input id="wiz-kg" type="number" min="1" max="90" step="1" value="' + kg + '" data-kg inputmode="numeric">' +
           '<span class="kg__u">kg</span>' +
           '<input type="range" min="1" max="90" step="1" value="' + kg + '" data-kgr aria-label="Gewicht schieben">' +
           '<p class="kg__hint">Von 1 kg bis 90 kg. Bei Mischlingen im Zweifel eher etwas nach oben schätzen.</p>' +
           '</div>';
    } else {
      var mehrfach = s.typ === 'check';
      h += '<div class="opts' + (s.opts.length > 4 ? '' : '') + '" role="' + (mehrfach ? 'group' : 'radiogroup') + '" aria-labelledby="wiz-frage">';
      s.opts.forEach(function (o) {
        var gewaehlt = mehrfach ? has(ant[s.id], o.v) : ant[s.id] === o.v;
        h += '<label class="opt">' +
          '<input type="' + (mehrfach ? 'checkbox' : 'radio') + '" name="wiz-' + s.id + '" value="' + o.v + '"' +
          (gewaehlt ? ' checked' : '') + '>' +
          '<span class="opt__m opt__m--' + (mehrfach ? 'c' : 'r') + '" aria-hidden="true"></span>' +
          '<span class="opt__t"><b>' + o.t + '</b>' + (o.s ? '<span>' + o.s + '</span>' : '') + '</span>' +
          '</label>';
      });
      h += '</div>';
    }
    body.innerHTML = h;

    ft.innerHTML =
      (idx > 0 ? '<button class="btn btn--ghost" type="button" data-wiz-back>Zurück</button>' : '<span class="grow"></span>') +
      '<button class="btn btn--primary" type="button" data-wiz-next>' +
      (idx === steps.length - 1 ? 'Empfehlung anzeigen' : 'Weiter') +
      ' <svg><use href="#ic-arrow"/></svg></button>';

    var first = $('input', body); if (first) first.focus();
  }

  function lese() {
    var steps = sichtbareSteps(), s = steps[idx];
    if (!s) return true;
    if (s.typ === 'zahl') {
      var el = $('[data-kg]', dlg);
      var v = parseInt(el.value, 10);
      if (!v || v < 1 || v > 90) { el.focus(); el.reportValidity && el.reportValidity(); return false; }
      ant.kg = v; return true;
    }
    var sel = $$('input[name="wiz-' + s.id + '"]', dlg).filter(function (i) { return i.checked; });
    if (!sel.length) { N.toast('Bitte wähle mindestens eine Antwort.'); return false; }
    ant[s.id] = s.typ === 'check' ? sel.map(function (i) { return i.value; }) : sel[0].value;
    return true;
  }

  function renderErgebnis() {
    var r = empfehlung(ant);
    var body = $('[data-wiz-body]', dlg), ft = $('[data-wiz-ft]', dlg);
    $('[data-wiz-progress]', dlg).innerHTML = '<span class="wiz__step">Deine Empfehlung</span>';

    var h = '';
    r.flags.forEach(function (f) {
      h += '<div class="flag flag--' + f.typ + '"><svg><use href="#' + f.ic + '"/></svg>' +
           '<div><b>' + f.t + '</b>' + f.p + '</div></div>';
    });

    if (!r.recs.length) {
      h += '<p class="rec__lead">' + (r.hinweisText || 'Wir empfehlen dir an dieser Stelle bewusst kein Produkt. Wenn sich das ändert, sind wir da.') + '</p>';
      body.innerHTML = h;
      ft.innerHTML = '<button class="btn btn--ghost" type="button" data-wiz-restart>Noch einmal</button>' +
                     '<a class="btn btn--primary" href="blog.html">Zum Ratgeber <svg><use href="#ic-arrow"/></svg></a>';
      return;
    }

    var kg = ant.kg, summe = 0, zeilen = [];
    h += '<p class="rec__lead">Für einen <b>' + kg + '-kg-Hund</b>' +
         (ant.alter === 'senior' ? ' im Seniorenalter' : ant.alter === 'reif' ? ' ab sieben Jahren' : '') +
         ' passt ' + (r.recs.length === 1 ? 'dieses Produkt' : 'diese Kombination') +
         '. Die Mengen unten sind aus der amtlichen Deklaration gerechnet, nicht geschätzt.</p>';

    r.recs.forEach(function (rec, i) {
      var p = N.PRODUCTS[rec.key];
      var v = packung(rec.key, kg);
      var tage = reichweite(rec.key, v.id, kg);
      var iv = intervall(tage);
      var preis = N.linePrice(v, false);
      summe += preis;
      zeilen.push({ key: rec.key, vid: v.id, iv: iv });
      h += '<article class="rec' + (i === 0 ? ' rec--main' : '') + '">' +
        '<img src="' + p.img + '" alt="" width="88" height="88" loading="lazy">' +
        '<div>' +
        '<p class="rec__rank">' + rec.rank + '</p>' +
        '<h3>' + (p.href !== '#' ? '<a href="' + p.href + '">' + p.name + '</a>' : p.name) + '</h3>' +
        '<p class="rec__why">' + rec.why + '</p>' +
        '<div class="rec__dose">' +
        '<span>Tagesmenge<b>' + mengeText(rec.key, kg) + '</b></span>' +
        '<span>Empfohlene Größe<b>' + v.label + '</b></span>' +
        '<span>Reicht etwa<b>' + tage + ' Tage</b></span>' +
        '<span>Passendes Abo<b>' + N.intervalText(iv) + '</b></span>' +
        '</div>' +
        '<div class="rec__buy"><span class="rec__price">' + N.eur(preis) +
        '<small>' + (N.unitPrice(p, v, false) || 'je Packung') + '</small></span></div>' +
        '</div></article>';
    });

    h += '<div class="rec__sum"><span>' + (r.recs.length === 1 ? 'Preis' : 'Summe für ' + r.recs.length + ' Produkte') +
         '</span><b>' + N.eur(summe) + '</b></div>';
    h += '<p class="aboad__fine">Ergänzungsfuttermittel für Hunde. Diese Empfehlung ersetzt keine tierärztliche Beratung und keine Diagnose. Bei trächtigen oder säugenden Hündinnen, bestehender Medikation oder bekannten Vorerkrankungen bitte vorher mit der Tierärztin sprechen.</p>';

    body.innerHTML = h;
    body.scrollTop = 0;
    dlg.__zeilen = zeilen;

    var sparen = summe * N.SUB_DISCOUNT;
    /* Reihenfolge im Markup = Reihenfolge am Schirm: Haupt-Knopf zuletzt,
       damit er mobil unten (Daumen) und am Schreibtisch rechts steht. */
    ft.innerHTML =
      '<button class="btn btn--ghost" type="button" data-wiz-restart>Noch einmal</button>' +
      '<button class="btn btn--ghost" type="button" data-wiz-add-abo>Als Abo, ' + N.eur(sparen) + ' sparen</button>' +
      '<button class="btn btn--primary" type="button" data-wiz-add>' +
      (r.recs.length === 1 ? 'In den Warenkorb' : 'Alle ' + r.recs.length + ' in den Warenkorb') + '</button>';
  }

  function oeffneRechner() {
    dlg = $('[data-wiz]'); if (!dlg) return;
    idx = 0; ant = {};
    dlg.showModal();
    render();
  }

  /* --------------------------------------------------------- Ereignisse */
  document.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest(
      '[data-open-wiz],[data-wiz-next],[data-wiz-back],[data-wiz-restart],[data-wiz-add],[data-wiz-add-abo],[data-dlg-close]') : null;
    if (!t) return;

    if (t.hasAttribute('data-open-wiz')) { e.preventDefault(); oeffneRechner(); return; }
    if (t.hasAttribute('data-dlg-close')) {
      e.preventDefault();
      var d = t.closest('dialog'); if (d) d.close();
      return;
    }
    if (t.hasAttribute('data-wiz-next')) { if (lese()) { idx++; render(); } return; }
    if (t.hasAttribute('data-wiz-back')) { idx = Math.max(0, idx - 1); render(); return; }
    if (t.hasAttribute('data-wiz-restart')) { idx = 0; ant = {}; render(); return; }
    if (t.hasAttribute('data-wiz-add') || t.hasAttribute('data-wiz-add-abo')) {
      var abo = t.hasAttribute('data-wiz-add-abo');
      (dlg.__zeilen || []).forEach(function (z) {
        N.addToCart(z.key, z.vid, 1, abo ? z.iv : null);
      });
      dlg.close();
      return;
    }
  });

  /* Gewichtsfeld und Schieberegler synchron halten */
  document.addEventListener('input', function (e) {
    if (!dlg || !dlg.open) return;
    var kg = $('[data-kg]', dlg), kr = $('[data-kgr]', dlg);
    if (!kg || !kr) return;
    if (e.target === kg) kr.value = kg.value;
    if (e.target === kr) kg.value = kr.value;
  });

  /* ============================================================ 2. ABO-HINWEIS
     Erscheint einmal je Sitzung, wenn im Einmalkauf in den Warenkorb gelegt
     wird. Kein Countdown, keine Schuldsprache – nur die Zahlen und zwei
     gleichwertige Knöpfe. */
  var SKEY = 'nfp-abo-hinweis-gesehen';
  var offen = null;

  window.NFP_beforeAdd = function (key, vid, qty) {
    var d = $('[data-aboad]');
    if (!d) return false;
    try { if (sessionStorage.getItem(SKEY)) return false; } catch (e) { return false; }

    var p = N.PRODUCTS[key], v = N.findVariant(key, vid);
    if (!p || !v) return false;

    var einzel = v.price * qty;
    var imAbo = N.linePrice(v, true) * qty;
    var proLieferung = einzel - imAbo;

    /* Wie oft im Jahr? Aus der Reichweite der gewählten Packung bei einem
       mittleren Hund – ohne Gewicht können wir nicht genauer sein, deshalb
       rechnen wir mit dem gewählten Intervall der Seite. */
    var iv = parseInt(N.currentInterval(), 10) || 6;
    var proJahr = Math.round(52 / iv);
    var jahr = proLieferung * proJahr;

    $('[data-aboad-produkt]', d).textContent = p.name + ' · ' + v.label + (qty > 1 ? ' · ' + qty + '×' : '');
    $('[data-aboad-einzel]', d).textContent = N.eur(einzel);
    $('[data-aboad-abo]', d).textContent = N.eur(imAbo);
    $('[data-aboad-jahr]', d).textContent = N.eur(jahr);
    $('[data-aboad-jahrtext]', d).textContent = 'bei Lieferung ' + N.intervalText(String(iv));
    $('[data-aboad-versand]', d).innerHTML = einzel < N.FREE_SHIPPING
      ? 'Dazu kommt: Im Abo ist der Versand <b>immer</b> frei. Bei ' + N.eur(einzel) + ' liegst du sonst unter der Schwelle von ' + N.eur(N.FREE_SHIPPING) + '.'
      : 'Dazu kommt: Im Abo ist der Versand immer frei – unabhängig vom Bestellwert.';

    /* Intervallwahl im Dialog auf den Stand der Seite bringen */
    $$('input[name="aboad-iv"]', d).forEach(function (r) { r.checked = (r.value === String(iv)); });

    offen = { key: key, vid: vid, qty: qty };
    try { sessionStorage.setItem(SKEY, '1'); } catch (e) {}
    d.showModal();
    return true; /* wir haben übernommen */
  };

  document.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest('[data-aboad-yes],[data-aboad-no]') : null;
    if (!t || !offen) return;
    var d = $('[data-aboad]');
    if (t.hasAttribute('data-aboad-yes')) {
      var sel = $$('input[name="aboad-iv"]', d).filter(function (r) { return r.checked; })[0];
      var iv = sel ? sel.value : '6';
      N.setMode('sub', iv);
      N.addToCart(offen.key, offen.vid, offen.qty, iv);
    } else {
      N.addToCart(offen.key, offen.vid, offen.qty, null);
    }
    offen = null;
    d.close();
  });

  /* Wird der Dialog per Esc oder Klick daneben geschlossen, ohne dass eine
     der beiden Wahlmöglichkeiten gedrückt wurde, landet der Artikel trotzdem
     als Einmalkauf im Korb – der Kunde wollte ihn ja kaufen. */
  var ad = $('[data-aboad]');
  if (ad) {
    ad.addEventListener('close', function () {
      if (offen) { N.addToCart(offen.key, offen.vid, offen.qty, null); offen = null; }
    });
    ad.addEventListener('click', function (e) {
      if (e.target === ad) ad.close(); /* Klick auf den Hintergrund */
    });
  }
  var wz = $('[data-wiz]');
  if (wz) wz.addEventListener('click', function (e) { if (e.target === wz) wz.close(); });
})();
