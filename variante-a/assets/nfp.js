/* ============================================================================
   NatureFlow Pets · Shop-Entwurf „Naturmanufaktur"
   Klickbare Shop-Logik: Warenkorb-Drawer, Gratisversand-Fortschritt, Varianten,
   Galerie, Filter/Sortierung, Klappmenü, Toast.
   Umgesetzt nach Master-SOP Conversion & Retention (Shopify D2C) v2.0:
   B4.4 (Progressbar + Cross-Sell), B3.3 (Platzierungs-Matrix), A4.3 (Anker).
   Reiner Frontend-Entwurf: Zustand liegt in localStorage, kein Backend.
   ============================================================================ */
(function () {
  'use strict';

  /* --------------------------------------------------------------- Daten
     Preise, Größen und Wirkstoffzeilen sind ECHTE Shopify-Daten
     (Abruf 2026-07-14). Keine Streichpreise: Positionierung ist
     „Premium-Only ohne Rabatt-Abhängigkeit" (Brand-Spektrum E). */
  var FREE_SHIPPING = 49; /* ANNAHME – echte Versandschwelle mit Kai/Evi klären */

  var PRODUCTS = {
    'gelenk-tabletten': {
      name: 'Gelenk-Tabletten', cat: 'Gelenke & Bewegung', href: 'produkt-gelenk-tabletten.html',
      img: 'img/p-gelenk-tabletten.webp', alt: 'img/pdp-lifestyle.webp',
      ing: 'Grünlippmuschel · MSM · Ingwer · Teufelskralle · Bierhefe',
      unit: 'Tablette',
      variants: [
        { id: '100', label: '100 Tabletten', sub: 'ca. 1 Monat', price: 27.95, per: 100 },
        { id: '200', label: '200 Tabletten', sub: '2 × 100 Stück', price: 49.95, per: 200, best: true },
        { id: '400', label: '400 Tabletten', sub: '4 × 100 Stück', price: 84.95, per: 400 }
      ]
    },
    'gruenlippmuschelpulver': {
      name: 'Grünlippmuschelpulver', cat: 'Gelenke & Bewegung', href: '#',
      img: 'img/p-gruenlippmuschelpulver.webp', alt: 'img/zutaten-flatlay.webp',
      ing: '100 % Perna canaliculus, ohne Zusätze', unit: 'g',
      variants: [
        { id: '500', label: '500 g', sub: '', price: 32.95, per: 500 },
        { id: '1000', label: '1.000 g', sub: '', price: 59.95, per: 1000, best: true },
        { id: '2000', label: '2.000 g', sub: '2 × 1.000 g', price: 99.95, per: 2000 }
      ]
    },
    'gelenk-kollagen': {
      name: 'Gelenk Kollagen', cat: 'Gelenke & Bewegung', href: '#',
      img: 'img/p-gelenk-kollagen.webp', alt: 'img/pdp-macro.webp',
      ing: 'Kollagen-Peptide für Knorpel & Bindegewebe', unit: 'g',
      variants: [
        { id: '250', label: '250 g', sub: '', price: 47.95, per: 250 },
        { id: '500', label: '500 g', sub: '2 × 250 g', price: 79.95, per: 500, best: true },
        { id: '1000', label: '1.000 g', sub: '4 × 250 g', price: 139.99, per: 1000 }
      ]
    },
    'gelenkoel': {
      name: 'Gelenköl', cat: 'Gelenke & Bewegung', href: '#',
      img: 'img/p-gelenkoel.webp', alt: 'img/zutaten-flatlay.webp',
      ing: 'Öl-Mischung zum Untermischen ins Futter', unit: 'ml',
      variants: [
        { id: '500', label: '500 ml', sub: '', price: 24.95, per: 500 },
        { id: '1000', label: '1.000 ml', sub: '2 × 500 ml', price: 44.95, per: 1000, best: true },
        { id: '2000', label: '2.000 ml', sub: '4 × 500 ml', price: 79.95, per: 2000 }
      ]
    },
    'teufelskralle-liquid': {
      name: 'Teufelskralle Liquid', cat: 'Gelenke & Bewegung', href: '#',
      img: 'img/p-teufelskralle-liquid.webp', alt: 'img/zutaten-flatlay.webp',
      ing: 'Tropfen zum Untermischen', unit: 'ml',
      variants: [
        { id: '100', label: '100 ml', sub: '', price: 19.95, per: 100 },
        { id: '300', label: '300 ml', sub: '', price: 49.95, per: 300 },
        { id: '500', label: '500 ml', sub: '', price: 69.95, per: 500, best: true }
      ]
    },
    'relax-calm-tabletten': {
      name: 'Relax Calm Tabletten', cat: 'Ruhe & Nerven', href: '#',
      img: 'img/p-relax-calm-tabletten.webp', alt: 'img/pdp-macro.webp',
      ing: 'Mit L-Tryptophan, Hanf & Passionsblume', unit: 'Tablette',
      variants: [
        { id: '60', label: '60 Tabletten', sub: '', price: 29.95, per: 60 },
        { id: '120', label: '120 Tabletten', sub: '', price: 49.95, per: 120, best: true },
        { id: '240', label: '240 Tabletten', sub: '', price: 84.95, per: 240 }
      ]
    },
    'praebiotikum-probiotikum': {
      name: 'Präbiotikum & Probiotikum', cat: 'Verdauung & Immunsystem', href: '#',
      img: 'img/p-praebiotikum-probiotikum.webp', alt: 'img/pdp-macro.webp',
      ing: 'Für eine stabile Darmflora', unit: 'Tablette',
      variants: [
        { id: '120', label: '120 Tabletten', sub: '', price: 24.95, per: 120 },
        { id: '240', label: '240 Tabletten', sub: '2 × 120', price: 44.95, per: 240, best: true },
        { id: '480', label: '480 Tabletten', sub: '4 × 120', price: 79.95, per: 480 }
      ]
    },
    'gelenk-kur-s': {
      name: 'Gelenk-Kur S', cat: 'Gelenke & Bewegung', href: '#',
      img: 'img/p-gelenk-tabletten.webp', alt: 'img/pdp-scale.webp',
      ing: 'Komplett-Kur für Hunde bis 10 kg', unit: 'Kur',
      variants: [{ id: 's', label: 'Kur für bis 10 kg', sub: '', price: 79.95, per: 1 }]
    },
    'gelenk-kur-m': {
      name: 'Gelenk-Kur M', cat: 'Gelenke & Bewegung', href: '#',
      img: 'img/p-gelenk-kollagen.webp', alt: 'img/pdp-scale.webp',
      ing: 'Komplett-Kur für Hunde 11–25 kg', unit: 'Kur',
      variants: [{ id: 'm', label: 'Kur für 11–25 kg', sub: '', price: 169.95, per: 1 }]
    },
    'gelenk-kur-l': {
      name: 'Gelenk-Kur L', cat: 'Gelenke & Bewegung', href: '#',
      img: 'img/p-gruenlippmuschelpulver.webp', alt: 'img/pdp-scale.webp',
      ing: 'Komplett-Kur für Hunde 26–50 kg', unit: 'Kur',
      variants: [{ id: 'l', label: 'Kur für 26–50 kg', sub: '', price: 249.95, per: 1 }]
    }
  };

  /* Cross-Sell im Drawer: günstige Add-ons, die die Versandschwelle erreichbar
     machen (SOP B3.3: Add-on 8–15 €; hier die günstigsten echten Artikel). */
  var XSELL = ['teufelskralle-liquid', 'praebiotikum-probiotikum', 'gelenkoel'];

  /* ------------------------------------------------------------- Helfer */
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var eur = function (n) { return n.toFixed(2).replace('.', ',') + ' €'; };

  function unitPrice(p, v) {
    if (v.per <= 1) return '';
    var val = v.price / v.per;
    if (p.unit === 'Tablette') return eur(val) + ' pro Tablette';
    if (p.unit === 'g' || p.unit === 'ml') {
      var base = p.unit === 'g' ? 1000 : 1000;
      return eur(v.price / v.per * base) + ' pro ' + (p.unit === 'g' ? 'kg' : 'l');
    }
    return '';
  }
  function findVariant(key, vid) {
    var p = PRODUCTS[key]; if (!p) return null;
    for (var i = 0; i < p.variants.length; i++) if (p.variants[i].id === vid) return p.variants[i];
    return p.variants[0];
  }

  /* ------------------------------------------------------ Warenkorb-Zustand */
  var KEY = 'nfp-cart-v1';
  var cart = [];
  try { cart = JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { cart = []; }

  function save() { try { localStorage.setItem(KEY, JSON.stringify(cart)); } catch (e) {} }
  function totalQty() { return cart.reduce(function (s, l) { return s + l.qty; }, 0); }
  function subtotal() {
    return cart.reduce(function (s, l) {
      var v = findVariant(l.key, l.vid); return s + (v ? v.price * l.qty : 0);
    }, 0);
  }

  function addToCart(key, vid, qty) {
    var p = PRODUCTS[key]; if (!p) return;
    var v = findVariant(key, vid); if (!v) return;
    var line = null;
    for (var i = 0; i < cart.length; i++) if (cart[i].key === key && cart[i].vid === v.id) line = cart[i];
    if (line) line.qty += (qty || 1); else cart.push({ key: key, vid: v.id, qty: qty || 1 });
    save(); render();
    toast(p.name + ' · ' + v.label + ' hinzugefügt');
    openDrawer();
  }
  function setQty(idx, q) {
    if (q <= 0) cart.splice(idx, 1); else cart[idx].qty = q;
    save(); render();
  }

  /* ----------------------------------------------------------- Rendering */
  function render() {
    var q = totalQty();
    $$('[data-cart-count]').forEach(function (b) {
      b.textContent = String(q);
      if (q > 0) b.removeAttribute('hidden'); else b.setAttribute('hidden', '');
    });

    var body = $('[data-cart-body]'); if (!body) return;
    var ft = $('[data-cart-foot]');

    if (!cart.length) {
      body.innerHTML =
        '<div class="empty">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M6 7h12l-1.1 12.2a1.8 1.8 0 0 1-1.8 1.6H8.9a1.8 1.8 0 0 1-1.8-1.6L6 7z"/>' +
        '<path d="M9.2 7V5.6a2.8 2.8 0 0 1 5.6 0V7"/></svg>' +
        '<p>Dein Warenkorb ist noch leer.</p>' +
        '<p style="margin-top:.6rem"><a href="sortiment.html" style="text-decoration:underline">Sortiment ansehen</a></p></div>';
      if (ft) ft.setAttribute('hidden', '');
      return;
    }
    if (ft) ft.removeAttribute('hidden');

    var html = '';
    cart.forEach(function (l, i) {
      var p = PRODUCTS[l.key], v = findVariant(l.key, l.vid);
      if (!p || !v) return;
      html +=
        '<div class="ci">' +
        '<div class="ci__fig"><img src="' + p.img + '" alt="' + p.name + '" width="74" height="74" loading="lazy"></div>' +
        '<div><h3>' + p.name + '</h3>' +
        '<p class="ci__var">' + v.label + '</p>' +
        '<p class="ci__price">' + eur(v.price * l.qty) + '</p>' +
        '<div class="qty">' +
        '<button type="button" data-dec="' + i + '" aria-label="Menge verringern">&minus;</button>' +
        '<span aria-live="polite">' + l.qty + '</span>' +
        '<button type="button" data-inc="' + i + '" aria-label="Menge erhöhen">+</button>' +
        '</div></div>' +
        '<button type="button" class="ci__rm" data-rm="' + i + '">Entfernen</button>' +
        '</div>';
    });

    /* Cross-Sell: nur Artikel, die nicht schon im Korb liegen */
    var inCart = cart.map(function (l) { return l.key; });
    var offers = XSELL.filter(function (k) { return inCart.indexOf(k) === -1; }).slice(0, 2);
    if (offers.length) {
      html += '<div class="xsell"><h3>Passt dazu</h3>';
      offers.forEach(function (k) {
        var p = PRODUCTS[k], v = p.variants[0];
        html +=
          '<div class="xsell__i">' +
          '<img src="' + p.img + '" alt="' + p.name + '" width="52" height="52" loading="lazy">' +
          '<div><p>' + p.name + '</p><span>' + v.label + ' · ' + eur(v.price) + '</span></div>' +
          '<button type="button" class="btn btn--ghost btn--sm" data-add="' + k + '" data-var="' + v.id + '">Dazu</button>' +
          '</div>';
      });
      html += '</div>';
    }
    body.innerHTML = html;

    /* Gratisversand-Fortschritt (SOP B4.4 / A4.3 Loss Aversion) */
    var sub = subtotal(), rest = Math.max(0, FREE_SHIPPING - sub);
    var fill = $('[data-ship-fill]'), txt = $('[data-ship-txt]');
    if (fill) fill.style.width = Math.min(100, (sub / FREE_SHIPPING) * 100) + '%';
    if (txt) {
      txt.innerHTML = rest > 0
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h11v8H3zM14 10h4l3 3v2h-7z"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/></svg>' +
          'Noch <b>' + eur(rest) + '</b> bis zum kostenlosen Versand'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5l5 5 11-11"/></svg>' +
          '<b>Versand kostenlos</b> – Schwelle erreicht';
    }
    var st = $('[data-subtotal]'); if (st) st.textContent = eur(sub);
  }

  /* --------------------------------------------------------- Drawer / Scrim */
  function openDrawer() {
    var d = $('[data-drawer]'), s = $('[data-scrim]');
    if (!d) return;
    d.setAttribute('data-open', 'true'); if (s) s.setAttribute('data-open', 'true');
    d.setAttribute('aria-hidden', 'false');
    var c = $('[data-drawer-close]'); if (c) c.focus();
  }
  function closeDrawer() {
    var d = $('[data-drawer]'), s = $('[data-scrim]');
    if (!d) return;
    d.setAttribute('data-open', 'false'); if (s) s.setAttribute('data-open', 'false');
    d.setAttribute('aria-hidden', 'true');
  }

  /* ------------------------------------------------------------------ Toast */
  var toastTimer = null;
  function toast(msg) {
    var t = $('[data-toast]'); if (!t) return;
    $('[data-toast-msg]', t).textContent = msg;
    t.setAttribute('data-show', 'true');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.setAttribute('data-show', 'false'); }, 2600);
  }

  /* ------------------------------------------------------- Globale Klicks */
  document.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest('[data-add],[data-inc],[data-dec],[data-rm],[data-cart-open],[data-drawer-close],[data-scrim],[data-thumb],[data-scroll-to]') : null;
    if (!t) return;

    if (t.hasAttribute('data-add')) {
      e.preventDefault();
      var key = t.getAttribute('data-add');
      var vid = t.getAttribute('data-var');
      if (!vid) {
        var checked = $('input[name="variant"]:checked');
        vid = checked ? checked.value : null;
      }
      var qEl = $('[data-qty-val]');
      var qty = qEl ? parseInt(qEl.textContent, 10) || 1 : 1;
      addToCart(key, vid, t.hasAttribute('data-var') ? 1 : qty);
      return;
    }
    if (t.hasAttribute('data-inc')) { var i = +t.getAttribute('data-inc'); setQty(i, cart[i].qty + 1); return; }
    if (t.hasAttribute('data-dec')) { var j = +t.getAttribute('data-dec'); setQty(j, cart[j].qty - 1); return; }
    if (t.hasAttribute('data-rm')) { setQty(+t.getAttribute('data-rm'), 0); return; }
    if (t.hasAttribute('data-cart-open')) { e.preventDefault(); openDrawer(); return; }
    if (t.hasAttribute('data-drawer-close') || t.hasAttribute('data-scrim')) { closeDrawer(); return; }

    if (t.hasAttribute('data-thumb')) {
      var main = $('[data-gal-main]');
      if (main) {
        main.src = t.getAttribute('data-thumb');
        main.alt = t.getAttribute('data-alt') || main.alt;
      }
      $$('[data-thumb]').forEach(function (b) { b.setAttribute('aria-current', 'false'); });
      t.setAttribute('aria-current', 'true');
      return;
    }
    if (t.hasAttribute('data-scroll-to')) {
      e.preventDefault();
      var el = document.getElementById(t.getAttribute('data-scroll-to'));
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
  });

  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDrawer(); });

  /* ---------------------------------------------------------- Klappmenü */
  var burger = $('[data-burger]'), nav = $('[data-nav]');
  if (burger && nav) {
    burger.addEventListener('click', function () {
      var open = nav.getAttribute('data-open') === 'true';
      nav.setAttribute('data-open', String(!open));
      burger.setAttribute('aria-expanded', String(!open));
      burger.setAttribute('aria-label', !open ? 'Menü schließen' : 'Menü öffnen');
    });
    nav.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') {
        nav.setAttribute('data-open', 'false');
        burger.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* ------------------------------------------------------- Sticky-Header */
  var hdr = $('[data-hdr]');
  if (hdr) {
    var onScroll = function () { hdr.classList.toggle('is-stuck', window.scrollY > 8); };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ------------------------------------------- PDP: Varianten & Menge */
  var priceEl = $('[data-price]'), unitEl = $('[data-unit]'), satcP = $('[data-satc-price]');
  function syncPrice() {
    var checked = $('input[name="variant"]:checked');
    if (!checked) return;
    var key = checked.getAttribute('data-key');
    var v = findVariant(key, checked.value), p = PRODUCTS[key];
    if (!v || !p) return;
    if (priceEl) priceEl.textContent = eur(v.price);
    if (unitEl) unitEl.textContent = unitPrice(p, v);
    if (satcP) satcP.innerHTML = eur(v.price) + '<small>' + v.label + '</small>';
  }
  $$('input[name="variant"]').forEach(function (r) { r.addEventListener('change', syncPrice); });
  syncPrice();

  var qv = $('[data-qty-val]');
  var qm = $('[data-qty-minus]');
  var qp = $('[data-qty-plus]');
  if (qv && qm && qp) {
    qm.addEventListener('click', function () {
      var n = Math.max(1, (parseInt(qv.textContent, 10) || 1) - 1); qv.textContent = n;
    });
    qp.addEventListener('click', function () {
      var n = Math.min(99, (parseInt(qv.textContent, 10) || 1) + 1); qv.textContent = n;
    });
  }

  /* -------------------------------------------- Listing: Filter & Sortierung */
  var grid = $('[data-grid]');
  if (grid) {
    var chips = $$('[data-filter]'), sortSel = $('[data-sort]'), countEl = $('[data-count]');
    function apply() {
      var active = chips.filter(function (c) { return c.getAttribute('aria-pressed') === 'true'; })
                        .map(function (c) { return c.getAttribute('data-filter'); });
      var cards = $$('[data-card]', grid);
      var shown = 0;
      cards.forEach(function (c) {
        var cat = c.getAttribute('data-cat');
        var ok = !active.length || active.indexOf(cat) !== -1;
        c.hidden = !ok;
        if (ok) shown++;
      });
      if (countEl) countEl.textContent = shown + (shown === 1 ? ' Produkt' : ' Produkte');

      if (sortSel) {
        var mode = sortSel.value;
        var visible = cards.filter(function (c) { return !c.hidden; });
        visible.sort(function (a, b) {
          var pa = parseFloat(a.getAttribute('data-price')), pb = parseFloat(b.getAttribute('data-price'));
          if (mode === 'preis-auf') return pa - pb;
          if (mode === 'preis-ab') return pb - pa;
          if (mode === 'name') return a.getAttribute('data-name').localeCompare(b.getAttribute('data-name'), 'de');
          return parseFloat(a.getAttribute('data-rank')) - parseFloat(b.getAttribute('data-rank'));
        });
        visible.forEach(function (c) { grid.appendChild(c); });
      }
    }
    chips.forEach(function (c) {
      c.addEventListener('click', function () {
        c.setAttribute('aria-pressed', c.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
        apply();
      });
    });
    if (sortSel) sortSel.addEventListener('change', apply);
    apply();
  }

  /* ------------------------------------------------------------ Newsletter */
  var nlForm = $('[data-nl]');
  if (nlForm) {
    nlForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var ok = $('[data-nl-ok]');
      if (ok) ok.removeAttribute('hidden');
      nlForm.reset();
    });
  }

  render();
})();
