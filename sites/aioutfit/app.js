/* AI Outfit Finder — deterministic rule engine, 100% client-side.
 * Every input matters: height/weight -> fit notes, budget -> tier variants + total check,
 * occasion -> smart overrides, season -> layering & fabric advice.
 * Prices are rough Indian-market estimates (₹). No backend, no tracking.
 */
(function () {
  "use strict";

  /* ---------------- Catalogue ---------------- */
  // Per style, per slot: variants for each budget tier [name, price, note?]
  var DB = {
    Streetwear: {
      top: {
        budget: [["Oversized graphic tee", 499], ["Drop-shoulder acid-wash tee", 599]],
        midrange: [["Heavyweight boxy tee", 1299], ["Oversized pullover hoodie", 1799]],
        premium: [["Loop-knit premium hoodie", 3999], ["Designer graphic crew", 3499]]
      },
      bottom: {
        budget: [["Black cargo pants", 899], ["Baggy washed jeans", 999]],
        midrange: [["Parachute cargos", 1899], ["Wide-leg denim", 2199]],
        premium: [["Techwear utility cargos", 4499], ["Selvedge loose denim", 4999]]
      },
      shoes: {
        budget: [["Canvas high-tops", 799], ["Chunky sneakers", 1199]],
        midrange: [["Retro court sneakers", 2999], ["Skate shoes", 2499]],
        premium: [["Hyped retro runners", 8999], ["Leather high-tops", 7499]]
      },
      accessory: {
        budget: [["Silver-tone chain", 249], ["Ribbed beanie", 299]],
        midrange: [["Cap + chain set", 699], ["Crossbody bag", 999]],
        premium: [["Statement Cuban chain", 1899], ["Designer cap", 2499]]
      },
      layer: {
        budget: [["Coach jacket", 999]],
        midrange: [["Varsity jacket", 2499]],
        premium: [["Wool-blend varsity", 5999]]
      },
      palette: [["Jet", "#111111"], ["Washed grey", "#6b7280"], ["Signal red", "#b91c1c"], ["Bone", "#f5f5f4"]],
      tips: [
        "Keep one loud piece per look — let the sneakers or the top talk, not both.",
        "Cuff or stack the hem once; break at the ankle keeps cargos intentional.",
        "Match metals: silver chain, silver rings, silver hardware."
      ]
    },
    Minimal: {
      top: {
        budget: [["Supima crew tee — white", 499], ["Bone crew tee", 449]],
        midrange: [["Mercerised cotton tee", 1199], ["Fine-knit polo", 1499]],
        premium: [["Silk-cotton tee", 2999], ["Cashmere-blend crew", 4999]]
      },
      bottom: {
        budget: [["Slim dark jeans", 999], ["Stone chinos", 899]],
        midrange: [["Tailored trousers", 1999], ["Straight denim", 2299]],
        premium: [["Italian-wool trousers", 5499], ["Selvedge straight denim", 4999]]
      },
      shoes: {
        budget: [["White leather-look sneakers", 999], ["Tan loafers", 1099]],
        midrange: [["Minimal leather sneakers", 3299], ["Suede loafers", 2799]],
        premium: [["Full-grain leather sneakers", 8999], ["Hand-finished loafers", 7999]]
      },
      accessory: {
        budget: [["Matte steel watch", 399], ["Slim belt", 299]],
        midrange: [["Leather-strap watch", 1499], ["Woven belt", 699]],
        premium: [["Sapphire-glass watch", 4999], ["Full-grain belt", 1499]]
      },
      layer: {
        budget: [["Unstructured overshirt", 899]],
        midrange: [["Harrington jacket", 2299]],
        premium: [["Merino overcoat", 6999]]
      },
      palette: [["Bone", "#f8f7f4"], ["Stone", "#d6d3d1"], ["Charcoal", "#292524"], ["Taupe", "#78716c"]],
      tips: [
        "Three colours max — tonal dressing reads expensive at any price.",
        "Fit is the whole game: shoulder seam exactly on the shoulder bone.",
        "Steam or iron everything; crisp fabric is 50% of the minimal look."
      ]
    },
    Formal: {
      top: {
        budget: [["Crisp dress shirt — white", 699], ["Sky-blue dress shirt", 749]],
        midrange: [["Wrinkle-free dress shirt", 1599], ["Fine-twill shirt", 1899]],
        premium: [["Two-ply cotton shirt", 3999], ["Sea-island cotton shirt", 4499]]
      },
      bottom: {
        budget: [["Slim formal trousers", 999], ["Charcoal trousers", 1099]],
        midrange: [["Wool-blend trousers", 2299], ["Tapered dress pants", 2499]],
        premium: [["Pure-wool trousers", 5499], ["Made-to-measure trousers", 6999]]
      },
      shoes: {
        budget: [["Derby shoes", 1299], ["Black oxfords", 1499]],
        midrange: [["Leather oxfords", 3499], ["Monk straps", 3799]],
        premium: [["Goodyear-welted oxfords", 9999], ["Patent wholecuts", 11999]]
      },
      accessory: {
        budget: [["Tie + pocket square", 349], ["Leather-look belt", 299]],
        midrange: [["Silk tie set", 899], ["Leather belt + watch", 1799]],
        premium: [["Silk tie + onyx studs", 2499], ["Dress watch", 5999]]
      },
      layer: {
        budget: [["Poly-blend blazer", 1999]],
        midrange: [["Tailored wool-blend blazer", 4499]],
        premium: [["Half-canvas wool jacket", 10999]]
      },
      palette: [["Midnight", "#0f172a"], ["White", "#f8fafc"], ["Slate", "#475569"], ["Oxblood", "#7f1d1d"]],
      tips: [
        "Belt and shoes must match — black with black, brown with brown.",
        "Show 1–2 cm of shirt cuff past the jacket sleeve.",
        "Trouser break: one soft fold at the shoe, never a puddle."
      ]
    },
    Gym: {
      top: {
        budget: [["Dry-fit training tee", 399], ["Compression tee", 499]],
        midrange: [["Seamless training tee", 999], ["Ventilated tank", 899]],
        premium: [["Premium compression top", 2499], ["Sweat-wicking long sleeve", 2199]]
      },
      bottom: {
        budget: [["Athletic shorts", 399], ["Training joggers", 599]],
        midrange: [["2-in-1 training shorts", 1199], ["Tapered gym joggers", 1399]],
        premium: [["Compression tights + shorts", 2999], ["Tech joggers", 3499]]
      },
      shoes: {
        budget: [["Basic trainers", 899], ["Entry running shoes", 1199]],
        midrange: [["Cushioned runners", 2999], ["Cross-training shoes", 2699]],
        premium: [["Carbon-plate runners", 8999], ["Lifting shoes", 6999]]
      },
      accessory: {
        budget: [["Gym gloves", 199], ["Shaker bottle", 149]],
        midrange: [["Lifting straps + belt", 799], ["Duffel bag", 999]],
        premium: [["Leather lifting belt", 2499], ["Smart bottle + duffel", 2999]]
      },
      layer: {
        budget: [["Track jacket", 699]],
        midrange: [["Training hoodie", 1599]],
        premium: [["Tech-fleece hoodie", 3999]]
      },
      palette: [["Black", "#0a0a0a"], ["Volt blue", "#2563eb"], ["Volt", "#a3e635"], ["Grey", "#e5e7eb"]],
      tips: [
        "Flat soles for lifting, cushioned for running — don't mix them.",
        "Synthetic beats cotton: cotton holds sweat and gets heavy.",
        "One bright accent (shoes or tee) against black keeps it sharp."
      ]
    },
    "Old Money": {
      top: {
        budget: [["Piqué polo — navy", 699], ["Cream cable-knit sweater", 899]],
        midrange: [["Cotton-cashmere polo", 1999], ["Merino crew", 2499]],
        premium: [["Luxury knit polo", 5999], ["Cashmere cable-knit", 7999]]
      },
      bottom: {
        budget: [["Beige chinos", 999], ["White tennis trousers", 1099]],
        midrange: [["Pleated linen trousers", 2299], ["Tailored cream chinos", 2499]],
        premium: [["Linen-wool trousers", 5999], ["Flannel trousers", 6499]]
      },
      shoes: {
        budget: [["Penny loafers", 1299], ["Boat shoes", 1399]],
        midrange: [["Suede loafers", 3299], ["Leather boat shoes", 2999]],
        premium: [["Hand-stitched loafers", 8999], ["Minimal court sneakers", 7999]]
      },
      accessory: {
        budget: [["Tortoise-shell sunglasses", 399], ["Silk scarf", 349]],
        midrange: [["Polarised sunglasses", 1499], ["Pearl studs", 999]],
        premium: [["Acetate designer shades", 4999], ["Vintage-style watch", 6999]]
      },
      layer: {
        budget: [["Cricket sweater (drape)", 899]],
        midrange: [["Navy blazer", 3999]],
        premium: [["Cashmere overcoat", 11999]]
      },
      palette: [["Navy", "#1e3a5f"], ["Cream", "#f5f0e6"], ["Camel", "#8a6d3b"], ["Forest", "#3f6212"]],
      tips: [
        "No visible logos — the fabric and fit do the talking.",
        "Tuck the polo, add a leather belt, loafer socks stay invisible.",
        "Cream + navy + camel is the whole formula. Repeat it forever."
      ]
    },
    Party: {
      top: {
        budget: [["Satin-finish shirt — black", 799], ["Textured party shirt", 899]],
        midrange: [["Silk-blend shirt", 1999], ["Sheen knit polo", 1699]],
        premium: [["Pure silk shirt", 4999], ["Sequined bomber top", 5499]]
      },
      bottom: {
        budget: [["Black slim jeans", 999], ["Tailored black trousers", 1099]],
        midrange: [["Tapered wool trousers", 2299], ["Coated denim", 2499]],
        premium: [["Tuxedo trousers", 5499], ["Leather-touch pants", 6499]]
      },
      shoes: {
        budget: [["Chelsea boots", 1499], ["Party loafers", 1299]],
        midrange: [["Leather chelseas", 3499], ["Patent loafers", 2999]],
        premium: [["Designer chelseas", 9999], ["Velvet loafers", 7999]]
      },
      accessory: {
        budget: [["Minimal chain", 249], ["Ring set", 199]],
        midrange: [["Layered chains", 799], ["Statement watch", 1999]],
        premium: [["Cuban chain", 3999], ["Designer ring", 2999]]
      },
      layer: {
        budget: [["Bomber jacket", 1199]],
        midrange: [["Satin bomber", 2499]],
        premium: [["Velvet blazer", 7999]]
      },
      palette: [["Jet", "#0a0a0a"], ["Gold", "#d4af37"], ["Deep red", "#7f1d1d"], ["Silver", "#c0c0c0"]],
      tips: [
        "Sheen reads party: satin, silk or velvet — pick exactly one.",
        "All-black base + one metallic accent photographs perfectly.",
        "Light fragrance, not loud: two sprays, pulse points only."
      ]
    }
  };

  var SLOT_META = {
    top: ["Top", "👕"],
    bottom: ["Bottom", "👖"],
    shoes: ["Shoes", "👟"],
    layer: ["Layer", "🧥"],
    accessory: ["Accessory", "⌚"]
  };
  var TIER_RANGE = { budget: [0, 5000], midrange: [5000, 15000], premium: [12000, Infinity] };
  var TIER_LABEL = { budget: "Budget", midrange: "Midrange", premium: "Premium" };

  /* ---------------- Helpers ---------------- */
  function $(id) { return document.getElementById(id); }
  function inr(n) { return "₹" + n.toLocaleString("en-IN"); }
  function mulberry32(a) {
    return function () {
      var t = (a += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function autoSeason() {
    var m = new Date().getMonth() + 1; // India-centric default
    if (m >= 11 || m <= 2) return "winter";
    if (m >= 7 && m <= 10) return "monsoon";
    return "summer";
  }

  /* ---------------- Fit notes ---------------- */
  function fitNotes(h, w) {
    var notes = [];
    if (!h && !w) {
      notes.push("Add height & weight above to unlock personal fit tuning.");
      return notes;
    }
    if (h) {
      if (h < 163) notes.push("Height " + h + " cm: monochrome columns and slightly cropped tops stretch the line — skip long oversized layers.");
      else if (h > 188) notes.push("Height " + h + " cm: relaxed and wide-leg cuts balance your height; layering adds welcome structure.");
      else notes.push("Height " + h + " cm: a versatile range — regular and relaxed fits both sit clean.");
    }
    if (h && w) {
      var bmi = w / Math.pow(h / 100, 2);
      if (bmi < 18.5) notes.push("Lean build: structured fabrics (denim, twill, knits) add presence; layering works in your favour.");
      else if (bmi < 25) notes.push("Balanced proportions: choose silhouette by vibe, not by rule — most cuts work on you.");
      else if (bmi < 30) notes.push("Solid build: straight and relaxed fits skim cleanly; matte fabrics and vertical lines sharpen the silhouette.");
      else notes.push("Fuller build: structured shoulders + straight-leg bottoms draw a clean line; avoid clingy jersey head-to-toe.");
    } else if (w) {
      notes.push("Weight noted — add height too for precise proportion advice.");
    }
    return notes;
  }

  /* ---------------- Engine ---------------- */
  function buildLook(input, seed) {
    var rnd = mulberry32(seed);
    var style = input.style, tier = input.budget, season = input.season, occasion = input.occasion;
    var notices = [];

    // Smart occasion overrides
    if (occasion === "Interview" && (style === "Gym" || style === "Party")) {
      notices.push("Interview detected — switched " + style + " → Formal. The gym fit can wait for the offer letter.");
      style = "Formal";
    }
    if (occasion === "Gym" && style !== "Gym") {
      notices.push("Gym session detected — switched " + style + " → Gym so you can actually move.");
      style = "Gym";
    }

    var cat = DB[style];
    var slots = ["top", "bottom", "shoes"];
    var wantLayer = season === "winter" || occasion === "Interview" || (season === "monsoon" && style !== "Gym");
    if (wantLayer) slots.push("layer");
    slots.push("accessory");

    var items = slots.map(function (slot) {
      var variants = cat[slot][tier];
      var v = variants[Math.floor(rnd() * variants.length)];
      var note = "";
      if (slot === "shoes" && season === "monsoon") note = "Monsoon: skip suede, wipe dry after wear.";
      if (slot === "layer" && season === "monsoon") note = "Light water-resistant layer for showers.";
      if (slot === "layer" && occasion === "Interview") note = "Blazer on for the interview — non-negotiable.";
      if (slot === "accessory" && occasion === "Festival") note = "Festival: swap in an ethnic-print accent if you have one.";
      if (slot === "accessory" && occasion === "Date") note = "Date: a clean watch beats stacked chains.";
      return { slot: slot, name: v[0], price: v[1], note: note };
    });

    var total = items.reduce(function (s, it) { return s + it.price; }, 0);
    var range = TIER_RANGE[tier];

    // Budget-aware pass: if the look runs over the tier, step items down to their
    // cheapest variant (priciest first) until it fits — layering shouldn't break the bank.
    if (total > range[1]) {
      var swapped = false;
      items.slice().sort(function (a, b) { return b.price - a.price; }).forEach(function (it) {
        if (total <= range[1]) return;
        var cheapest = cat[it.slot][tier].reduce(function (m, v) { return v[1] < m[1] ? v : m; });
        if (cheapest[1] < it.price) {
          total -= it.price - cheapest[1];
          it.name = cheapest[0]; it.price = cheapest[1];
          swapped = true;
        }
      });
      if (swapped && total <= range[1]) notices.push("Trimmed a few pieces to their budget variants so the whole look stays in your tier.");
    }

    var within = total >= range[0] && total <= range[1];
    if (!within && total > range[1]) {
      if (occasion === "Interview") {
        notices.push("The blazer pushes this " + inr(total - range[1]) + " past the " + TIER_LABEL[tier] + " tier — for an interview, that's money well spent.");
      } else {
        notices.push("Total runs " + inr(total - range[1]) + " over the " + TIER_LABEL[tier] + " tier — drop the layer or shuffle for cheaper variants.");
      }
    }
    if (!within && total < range[0]) {
      notices.push("Total lands under the " + TIER_LABEL[tier] + " tier — shuffle, or step the shoes up a notch.");
    }

    var tips = cat.tips.slice();
    if (season === "summer") tips.unshift("Summer: cotton/linen only, light shades, breathable everything.");
    if (season === "monsoon") tips.unshift("Monsoon: quick-dry fabrics, dark bottoms, grippy soles.");
    if (season === "winter") tips.unshift("Winter: layer thin-to-thick — tee, knit, jacket — trap warm air.");
    if (occasion === "College") tips.push("College: one statement piece, rest quiet — you'll repeat this look weekly.");
    if (occasion === "Date") tips.push("Date: groom > brand. Fresh fade, trimmed nails, ironed collar.");
    if (occasion === "Festival") tips.push("Festival: jewel tones photograph beautifully under lights.");

    return {
      style: style, tier: tier, season: season, occasion: occasion,
      items: items, total: total, within: within,
      notices: notices, tips: tips.slice(0, 4),
      palette: cat.palette, fit: fitNotes(input.height, input.weight)
    };
  }

  /* ---------------- Render ---------------- */
  var lastLook = null, lastInput = null;

  function render(look) {
    lastLook = look;
    $("result-title").textContent = look.style + " · " + TIER_LABEL[look.tier];
    $("result-sub").textContent = look.occasion + " · " + look.season.charAt(0).toUpperCase() + look.season.slice(1) +
      " · " + look.items.length + " pieces";

    var notice = $("notice");
    if (look.notices.length) { notice.hidden = false; notice.innerHTML = ""; look.notices.forEach(function (n) { var p = document.createElement("p"); p.textContent = n; notice.appendChild(p); }); }
    else notice.hidden = true;

    var ul = $("items"); ul.innerHTML = "";
    look.items.forEach(function (it) {
      var li = document.createElement("li"); li.className = "item";
      var meta = SLOT_META[it.slot];
      var ico = document.createElement("span"); ico.className = "ico"; ico.textContent = meta[1]; ico.setAttribute("aria-hidden", "true");
      var mid = document.createElement("div");
      var slot = document.createElement("div"); slot.className = "slot"; slot.textContent = meta[0];
      var name = document.createElement("div"); name.className = "name"; name.textContent = it.name;
      mid.appendChild(slot); mid.appendChild(name);
      if (it.note) { var note = document.createElement("div"); note.className = "note"; note.textContent = it.note; mid.appendChild(note); }
      var price = document.createElement("span"); price.className = "price"; price.textContent = inr(it.price);
      li.appendChild(ico); li.appendChild(mid); li.appendChild(price);
      ul.appendChild(li);
    });

    $("total").textContent = inr(look.total);
    var badge = $("budget-badge");
    badge.textContent = look.within ? "within " + TIER_LABEL[look.tier] + " range" : "outside " + TIER_LABEL[look.tier] + " range";
    badge.className = "badge " + (look.within ? "ok" : "warn");

    var fit = $("fit-notes"); fit.innerHTML = "";
    look.fit.forEach(function (n) { var li = document.createElement("li"); li.textContent = n; fit.appendChild(li); });

    var pal = $("palette"); pal.innerHTML = "";
    look.palette.forEach(function (p) {
      var d = document.createElement("div"); d.className = "swatch"; d.style.background = p[1]; d.title = p[0];
      var s = document.createElement("span"); s.textContent = p[0]; d.appendChild(s);
      pal.appendChild(d);
    });

    var tips = $("tips"); tips.innerHTML = "";
    look.tips.forEach(function (t) { var li = document.createElement("li"); li.textContent = t; tips.appendChild(li); });

    $("result").hidden = false;
    $("shuffle").hidden = false;
    $("result").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function readInput() {
    var h = parseFloat($("height").value), w = parseFloat($("weight").value);
    var ok = true;
    $("height-err").hidden = true; $("weight-err").hidden = true;
    if ($("height").value !== "" && (!(h >= 100 && h <= 250))) { $("height-err").hidden = false; ok = false; }
    if ($("weight").value !== "" && (!(w >= 30 && w <= 200))) { $("weight-err").hidden = false; ok = false; }
    if (!ok) return null;
    var season = $("season").value;
    return {
      height: $("height").value === "" ? null : h,
      weight: $("weight").value === "" ? null : w,
      style: $("style").value,
      budget: $("budget").value,
      occasion: $("occasion").value,
      season: season === "auto" ? autoSeason() : season
    };
  }

  /* ---------------- Wire-up ---------------- */
  $("outfit-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var input = readInput();
    if (!input) return;
    lastInput = input;
    render(buildLook(input, (Date.now() % 100000) + 7));
  });

  $("shuffle").addEventListener("click", function () {
    if (!lastInput) return;
    lastInput = readInput() || lastInput;
    render(buildLook(lastInput, Math.floor(Math.random() * 1e9)));
  });

  $("copy").addEventListener("click", function () {
    if (!lastLook) return;
    var L = lastLook;
    var lines = ["MY OUTFIT — " + L.style + " (" + TIER_LABEL[L.tier] + ", " + L.occasion + ", " + L.season + ")"];
    L.items.forEach(function (it) { lines.push("• " + SLOT_META[it.slot][0] + ": " + it.name + " — " + inr(it.price)); });
    lines.push("Total ≈ " + inr(L.total));
    lines.push("Palette: " + L.palette.map(function (p) { return p[0]; }).join(" / "));
    lines.push("— built with AI Outfit Finder");
    var text = lines.join("\n");
    var btn = $("copy");
    function ok() { btn.textContent = "Copied ✓"; btn.classList.add("done"); setTimeout(function () { btn.textContent = "Copy this outfit"; btn.classList.remove("done"); }, 1600); }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok, fallback); else fallback();
    function fallback() {
      var ta = document.createElement("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); ok(); } catch (e) {}
      document.body.removeChild(ta);
    }
  });

  // Cross-links (hub vs standalone GitHub Pages)
  var REPOS = { heavenly: "Heaven", "heavenly-site": "Heavenly-site", thatminecraft: "Heavenly-", maxxing: "maxxing", aioutfit: "AiOutfit", legagme: "LegaGMe" };
  var inHub = location.pathname.indexOf("/sites/") > -1;
  document.querySelectorAll("[data-xlink]").forEach(function (a) {
    var k = a.getAttribute("data-xlink");
    a.href = k === "hub"
      ? (inHub ? "../../" : "https://kbugga230209-png.github.io/API/")
      : (inHub ? "../" + k + "/" : "https://kbugga230209-png.github.io/" + REPOS[k] + "/");
  });
})();
