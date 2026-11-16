/* Portfolio site. All content comes from the Google Sheet set in config.js.
   Tabs: Settings, Clips, Stats, Projects, Toolkit, Links. */
(function () {
  "use strict";

  var CFG = window.PORTFOLIO_CONFIG || {};
  var TABS = ["Settings", "Clips", "Stats", "Projects", "Toolkit", "Links"];
  var CACHE_KEY = "portfolio-sheet-v1";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* Fallback content, used only if the sheet can't be reached. */
  var DEFAULTS = {
    Settings: {
      site_title: "Portfolio", name: "[Your Name]", nav_button_label: "Contact",
      eyebrow: "Video Production · Editing · Producing", headline: "Stories, cut\nto the frame.",
      intro: "[One line about you]", showreel_label: "SHOWREEL", showreel_specs: "3840 × 2160 · 24 fps",
      showreel_duration: "01:02", cuts_title: "Selected cuts.", about_label: "BACKGROUND",
      about_title: "From the timeline\nto the final frame.", projects_label: "PROJECTS",
      projects_title: "Work I've been part of.", research_label: "RESEARCH", research_title: "Toolkit",
      research_button: "Open the toolkit", contact_title: "Let's make\nsomething.",
      cv_button: "View CV", cv_download_label: "Download PDF", accent_color: "#ffffff",
      show_cuts: "yes", show_about: "yes", show_projects: "yes", show_research: "yes"
    },
    Clips: [], Stats: [], Projects: [], Toolkit: [], Links: []
  };

  /* ---------- helpers ---------- */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  // "VFX, SFX" or "VFX · SFX" → "VFX · SFX"
  function dots(s) { return String(s || "").split(/\s*[,·;]\s*/).map(function (x) { return x.trim(); }).filter(Boolean).join(" · "); }
  function lines(s) { return esc(s).replace(/\r?\n/g, "<br>"); }
  function truthy(v) {
    if (v === undefined || v === null || v === "") return true; // empty = shown
    return /^(true|yes|y|1|да|on|x|✓)$/i.test(String(v).trim());
  }
  function safeUrl(u) {
    u = String(u || "").trim();
    if (!u) return "";
    if (/^(https?:|mailto:|tel:|#|\/)/i.test(u)) return u;
    if (/^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(u)) return "https://" + u;
    return "";
  }
  function store(get, val) {
    try {
      if (get) return JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
      localStorage.setItem(CACHE_KEY, JSON.stringify(val));
    } catch (e) { return null; }
  }

  /* CSV parser that handles quotes, commas and newlines inside cells */
  function parseCSV(text) {
    var rows = [], row = [], cell = "", q = false, i, c;
    for (i = 0; i < text.length; i++) {
      c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
        else cell += c;
      } else if (c === '"') q = true;
      else if (c === ",") { row.push(cell); cell = ""; }
      else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
      else if (c !== "\r") cell += c;
    }
    if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }
  function toObjects(rows) {
    if (!rows.length) return [];
    var head = rows[0].map(function (h) { return h.trim().toLowerCase(); });
    return rows.slice(1).map(function (r) {
      var o = {};
      head.forEach(function (h, i) { if (h) o[h] = (r[i] || "").trim(); });
      return o;
    }).filter(function (o) {
      return Object.keys(o).some(function (k) { return k !== "show" && o[k]; });
    });
  }

  function fetchTab(name) {
    var url = "https://docs.google.com/spreadsheets/d/" + encodeURIComponent(CFG.sheetId) +
      "/gviz/tq?tqx=out:csv&headers=1&sheet=" + encodeURIComponent(name) + "&_=" + Date.now();
    return fetch(url, { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error(name + ": HTTP " + r.status);
      return r.text();
    }).then(function (t) {
      if (/^\s*<!doctype|<html/i.test(t)) throw new Error(name + ": sheet is not shared");
      return toObjects(parseCSV(t));
    });
  }

  function loadSheet() {
    if (!CFG.sheetId) return Promise.reject(new Error("No sheetId in config.js"));
    return Promise.all(TABS.map(function (t) {
      return fetchTab(t).catch(function (e) { console.warn("[portfolio]", e.message); return null; });
    })).then(function (res) {
      if (res.every(function (r) { return r === null; })) throw new Error("Sheet unreachable. Share it: Anyone with the link → Viewer.");
      var data = {};
      TABS.forEach(function (t, i) { data[t] = res[i] || []; });
      var s = {};
      data.Settings.forEach(function (r) { if (r.key) s[r.key] = r.value || ""; });
      data.Settings = s;
      return data;
    });
  }

  /* ---------- video links ---------- */
  function parseVideo(raw) {
    var u = String(raw || "").trim(), m;
    if (!u) return null;
    if ((m = u.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})/i))) {
      return { type: "youtube", id: m[1],
        embed: "https://www.youtube-nocookie.com/embed/" + m[1] + "?autoplay=1&rel=0&modestbranding=1&playsinline=1",
        thumb: "https://i.ytimg.com/vi/" + m[1] + "/hqdefault.jpg",
        thumbHi: "https://i.ytimg.com/vi/" + m[1] + "/maxresdefault.jpg" };
    }
    if ((m = u.match(/vimeo\.com\/(?:.*\/)?(?:video\/)?(\d+)(?:\/([\da-f]{6,}))?/i))) {
      var h = m[2] || ((u.match(/[?&]h=([\da-f]+)/i) || [])[1]);
      return { type: "vimeo", id: m[1],
        embed: "https://player.vimeo.com/video/" + m[1] + "?autoplay=1&dnt=1&title=0&byline=0&portrait=0" + (h ? "&h=" + h : ""),
        thumb: "https://vumbnail.com/" + m[1] + ".jpg" };
    }
    if ((m = u.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:.*&)?id=)([\w-]{10,})/i))) {
      return { type: "drive", id: m[1],
        embed: "https://drive.google.com/file/d/" + m[1] + "/preview",
        thumb: "https://drive.google.com/thumbnail?id=" + m[1] + "&sz=w1280" };
    }
    if (/dropbox\.com\//i.test(u) && !/raw=1/.test(u)) {
      u = u.replace(/([?&])dl=\d&?/, "$1").replace(/[?&]$/, "");
      u += (u.indexOf("?") > -1 ? "&" : "?") + "raw=1";
    }
    if (/\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(u) || /dropbox\.com\/.*raw=1/i.test(u)) {
      return { type: "file", src: safeUrl(u) };
    }
    return { type: "link", src: safeUrl(u) };
  }

  function playerHTML(v, title) {
    if (!v) return '<div class="empty-video">Video link not set yet</div>';
    if (v.type === "file") return '<video src="' + esc(v.src) + '" controls autoplay playsinline></video>';
    if (v.embed) return '<iframe src="' + esc(v.embed) + '" title="' + esc(title || "Video") + '" allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowfullscreen></iframe>';
    return '<div class="empty-video">Unsupported link</div>';
  }

  /* ---------- render ---------- */
  var S = {};
  function t(k) { return S[k] == null ? "" : S[k]; }

  function render(data) {
    S = data.Settings || {};
    document.title = t("site_title") || t("name") || "Portfolio";
    var md = $('meta[name="description"]'); if (md) md.setAttribute("content", t("meta_description"));
    var og = $('meta[property="og:title"]'); if (og) og.setAttribute("content", document.title);
    var od = $('meta[property="og:description"]'); if (od) od.setAttribute("content", t("meta_description"));
    if (/^#[\da-f]{3,8}$/i.test(t("accent_color"))) document.documentElement.style.setProperty("--accent", t("accent_color"));

    $$("[data-k]").forEach(function (el) {
      var v = t(el.getAttribute("data-k"));
      el.innerHTML = el.hasAttribute("data-multiline") ? lines(v) : esc(v);
    });

    // sections on/off + auto numbering
    var n = 0;
    $$("[data-section]").forEach(function (sec) {
      var on = truthy(S[sec.getAttribute("data-section")]);
      if (sec.id === "work") on = on && data.Clips.some(function (c) { return truthy(c.show); });
      sec.hidden = !on;
      var lab = $("[data-label]", sec);
      if (lab && on && sec.id !== "work") {
        n++;
        lab.textContent = (n < 10 ? "0" : "") + n + " — " + t(lab.getAttribute("data-label"));
      }
    });

    // nav
    var navItems = [["work", "Work"], ["about", "About"], ["projects", "Projects"], ["research", "Research"]];
    $("#navLinks").innerHTML = navItems.filter(function (i) { var s = document.getElementById(i[0]); return s && !s.hidden; })
      .map(function (i) { return '<a href="#' + i[0] + '" data-nav="' + i[0] + '">' + i[1] + "</a>"; }).join("");
    var navCv = $("#navCv");
    if (!t("nav_button_label")) navCv.textContent = "Contact";

    renderReel();
    renderLatest();
    renderCuts(data.Clips.filter(function (c) { return truthy(c.show); }));
    renderAbout(data.Stats);
    renderProjects(data.Projects.filter(function (p) { return truthy(p.show); }));
    renderResearch(data.Toolkit.filter(function (p) { return truthy(p.show); }));
    renderContact(data.Links.filter(function (l) { return truthy(l.show); }));

    observeReveal();
    observeNav();
    document.body.classList.remove("is-loading");
    if (location.hash === "#cv" && cvSource() && $("#cvView").hidden) openCv();
  }

  function renderReel() {
    var v = parseVideo(t("showreel_url"));
    var poster = safeUrl(t("showreel_poster")) || (v && (v.thumbHi || v.thumb)) || "";
    var media = $("#reelMedia");
    var frame = $("#reelFrame");
    frame.classList.remove("is-playing");
    if (v && v.type === "file" && !poster) {
      // no poster: show the first frame only; the full file loads on Play
      media.innerHTML = '<video src="' + esc(v.src) + '#t=0.1" muted playsinline preload="metadata"></video>';
    } else if (poster) {
      media.innerHTML = '<img src="' + esc(poster) + '" alt="" loading="eager">';
      var im = $("img", media);
      if (v && v.thumbHi) im.onerror = function () { if (im.src !== v.thumb) im.src = v.thumb; };
      im.onload = function () { if (im.naturalWidth <= 120 && v && v.thumb && im.src !== v.thumb) im.src = v.thumb; };
    } else {
      media.innerHTML = "";
    }
    var play = $("#reelPlay");
    play.onclick = function () {
      if (!v) { flash(play); return; }
      if (v.type === "link") { window.open(v.src, "_blank", "noopener"); return; }
      media.innerHTML = playerHTML(v, t("showreel_label"));
      var vid = $("video", media); if (vid) vid.classList.add("is-playing");
      frame.classList.add("is-playing");
    };
    var link = $("#reelLink"), lu = safeUrl(t("showreel_link_url"));
    link.hidden = !(lu && t("showreel_link_label"));
    if (lu) link.href = lu;
  }

  /* ---------- latest video (pink card) + VFX breakdown ---------- */
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function fmtDate(raw) {
    var s = String(raw || "").trim(), m, d = null;
    if (!s) return "";
    if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) d = new Date(+m[1], +m[2] - 1, +m[3]);
    else if ((m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})/))) {
      // gviz exports dates as M/D/YYYY; a typed 07.11.2026 is D.M.YYYY
      d = s.indexOf("/") > -1 ? new Date(+m[3], +m[1] - 1, +m[2]) : new Date(+m[3], +m[2] - 1, +m[1]);
    }
    if (!d || isNaN(d)) return s; // free text stays as typed
    return MONTHS[d.getMonth()] + " " + d.getDate() + ", " + d.getFullYear();
  }
  function num(n) { return Number(n || 0).toLocaleString("en-US"); }
  function plural(n, w) { return num(n) + " " + w + (Number(n) === 1 ? "" : "s"); }

  var statsTimer = null, statsFor = "";
  function renderLatest() {
    var sec = $("#latest");
    if (sec.hidden) { clearInterval(statsTimer); statsTimer = null; statsFor = ""; return; }
    if (/^#[\da-f]{3,8}$/i.test(t("latest_color"))) document.documentElement.style.setProperty("--pink", t("latest_color"));

    // left: pink card → YouTube
    var v = parseVideo(t("latest_url"));
    var card = $("#latestCard");
    var href = v && v.type === "youtube" ? "https://youtu.be/" + v.id : safeUrl(t("latest_url"));
    if (href) card.href = href; else card.removeAttribute("href");
    var img = $("#latestThumb");
    var thumb = safeUrl(t("latest_thumbnail")) || (v && (v.thumbHi || v.thumb)) || "";
    if (thumb && img.getAttribute("src") !== thumb) img.src = thumb;
    img.hidden = !thumb;
    img.onerror = function () { if (v && v.thumb && img.src !== v.thumb) img.src = v.thumb; };
    img.onload = function () { if (img.naturalWidth <= 120 && v && v.thumb && img.src !== v.thumb) img.src = v.thumb; };
    $("#latestDate").textContent = fmtDate(t("latest_date"));

    if (v && v.type === "youtube") {
      if (statsFor !== v.id) {
        statsFor = v.id;
        $("#latestStats").innerHTML = "&nbsp;";
        clearInterval(statsTimer);
        loadStats(v.id);
        statsTimer = setInterval(function () { if (!document.hidden) loadStats(v.id); }, 60000);
      }
    } else {
      clearInterval(statsTimer); statsTimer = null; statsFor = "";
      $("#latestStats").innerHTML = "&nbsp;";
    }

    // right: breakdown video, or a placeholder while it's in the edit
    var b = parseVideo(t("breakdown_url"));
    var frame = $("#breakdownFrame");
    var poster = safeUrl(t("breakdown_poster")) || (b && (b.thumbHi || b.thumb)) || "";
    $("#breakdownTag").textContent = t("breakdown_duration");
    if (!b) {
      frame.classList.remove("is-ready");
      frame.onclick = null;
      frame.removeAttribute("role"); frame.removeAttribute("tabindex");
      frame.innerHTML = '<div class="latest__ph"><span class="latest__ph-dot"></span><span>' + esc(t("breakdown_placeholder") || "In the edit · coming soon") + "</span></div>";
      return;
    }
    frame.classList.add("is-ready");
    frame.setAttribute("role", "button");
    frame.setAttribute("tabindex", "0");
    frame.setAttribute("aria-label", "Play " + (t("breakdown_title") || "VFX breakdown"));
    frame.innerHTML = (poster ? '<img src="' + esc(poster) + '" alt="" loading="lazy">'
        : (b.type === "file" ? '<video src="' + esc(b.src) + '#t=0.1" muted playsinline preload="metadata"></video>' : "")) +
      '<span class="latest__yt" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24"><path d="M8 5.5v13l10.5-6.5z" fill="#fff"/></svg></span>';
    var play = function () {
      if (b.type === "link") { window.open(b.src, "_blank", "noopener"); return; }
      frame.classList.remove("is-ready");
      frame.onclick = null;
      frame.innerHTML = playerHTML(b, t("breakdown_title"));
    };
    frame.onclick = play;
    frame.onkeydown = function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); play(); } };
  }

  // Live numbers. With Settings → youtube_api_key: exact views + comments from the YouTube Data API.
  // Without a key: views + likes from the public Return YouTube Dislike API (no comments there).
  function loadStats(id) {
    var key = t("youtube_api_key").trim();
    var p = key
      ? fetch("https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=" + encodeURIComponent(id) + "&key=" + encodeURIComponent(key))
          .then(function (r) { if (!r.ok) throw new Error("YouTube API " + r.status); return r.json(); })
          .then(function (j) {
            var it = j.items && j.items[0];
            if (!it) throw new Error("video not found");
            if (!t("latest_date") && it.snippet && it.snippet.publishedAt) $("#latestDate").textContent = fmtDate(it.snippet.publishedAt);
            var s = it.statistics || {};
            var parts = [plural(s.viewCount, "view")];
            if (s.commentCount != null) parts.push(plural(s.commentCount, "comment"));
            return parts;
          })
      : Promise.reject(new Error("no key"));
    p.catch(function (e) {
      if (key) console.warn("[portfolio] stats", e.message);
      return fetch("https://returnyoutubedislikeapi.com/votes?videoId=" + encodeURIComponent(id))
        .then(function (r) { if (!r.ok) throw new Error("RYD " + r.status); return r.json(); })
        .then(function (j) { return [plural(j.viewCount, "view"), plural(j.likes, "like")]; });
    }).then(function (parts) {
      if (statsFor !== id) return;
      $("#latestStats").innerHTML = '<span class="latest__live" aria-hidden="true"></span>' + esc(parts.join("  ·  "));
    }).catch(function (e) { console.warn("[portfolio] stats", e.message); });
  }

  function flash(el) {
    el.animate && el.animate([{ transform: "translate(-50%,-50%) translateX(0)" }, { transform: "translate(-50%,-50%) translateX(-4px)" },
      { transform: "translate(-50%,-50%) translateX(4px)" }, { transform: "translate(-50%,-50%) translateX(0)" }], { duration: 300 });
  }

  var currentFilter = "all";
  function catKey(s) { return String(s || "").trim().toLowerCase(); }
  // a clip can sit in several categories: "Edits, Gaming"
  function catList(s) { return String(s || "").split(/\s*[,·;]\s*/).map(function (x) { return x.trim(); }).filter(Boolean); }
  function renderCuts(clips) {
    // categories: typed freely in the sheet, matched case-insensitively.
    // Optional Settings → clip_categories sets the order of the filter buttons.
    var labels = {}, present = [];
    clips.forEach(function (c) {
      catList(c.category).forEach(function (lab) {
        var k = catKey(lab);
        if (k && !labels[k]) { labels[k] = lab; present.push(k); }
      });
    });
    var order = t("clip_categories").split(",").map(function (x) { return x.trim(); }).filter(Boolean);
    var cats = [];
    order.forEach(function (lab) { var k = catKey(lab); if (labels[k] && cats.indexOf(k) < 0) { labels[k] = lab; cats.push(k); } });
    present.forEach(function (k) { if (cats.indexOf(k) < 0) cats.push(k); });
    if (currentFilter !== "all" && cats.indexOf(currentFilter) < 0) currentFilter = "all";
    var f = $("#filters");
    f.hidden = cats.length < 2;
    f.innerHTML = ["all"].concat(cats).map(function (k) {
      var on = k === currentFilter;
      return '<button class="filter' + (on ? " is-on" : "") + '" role="tab" aria-selected="' + on + '" data-f="' + esc(k) + '">' + esc(k === "all" ? (t("filter_all_label") || "All") : labels[k]) + "</button>";
    }).join("");

    var grid = $("#cuts");
    grid.innerHTML = clips.map(function (c, i) {
      var v = parseVideo(c.video_url);
      var thumb = safeUrl(c.thumbnail_url) || (v && v.thumb) || "";
      var inner = "";
      if (thumb) inner += '<img src="' + esc(thumb) + '" alt="" loading="lazy">';
      if (v && v.type === "file") inner += '<video src="' + esc(v.src) + '#t=0.1" muted loop playsinline preload="' + (thumb ? "none" : "metadata") + '"></video>';
      var empty = !thumb && !(v && v.type === "file");
      return '<button class="clip reveal" data-i="' + i + '" data-cat="|' + esc(catList(c.category).map(catKey).join("|")) + '|" aria-label="Play ' + esc(c.title) + '">' +
        '<span class="clip__frame' + (empty ? " is-empty" : "") + '">' + inner +
        '<svg class="clip__icon" width="34" height="34" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="rgba(0,0,0,.35)" stroke="rgba(255,255,255,.55)" stroke-width=".8"/><path d="M10 8v8l6-4z" fill="#fff"/></svg>' +
        (c.duration ? '<span class="clip__dur">' + esc(c.duration) + "</span>" : "") + "</span>" +
        '<span class="clip__meta"><span>' + esc(c.title) + '</span><span class="clip__n">' + (i < 9 ? "0" : "") + (i + 1) + "</span></span>" +
        (c.subtitle ? '<span class="clip__sub">' + esc(dots(c.subtitle)) + "</span>" : "") +
        (c.roles ? '<span class="clip__roles">' + esc(dots(c.roles)) + "</span>" : "") + "</button>";
    }).join("");

    // video file: if first frame shows, hide the static thumb only when there is none
    $$(".clip", grid).forEach(function (el) {
      var c = clips[+el.getAttribute("data-i")], v = parseVideo(c.video_url);
      var vid = $("video", el);
      if (vid) {
        if (!$("img", el)) vid.style.opacity = 1;
        el.addEventListener("mouseenter", function () { el.classList.add("is-previewing"); vid.play().catch(function () {}); });
        el.addEventListener("mouseleave", function () { el.classList.remove("is-previewing"); vid.pause(); });
      }
      el.addEventListener("click", function () { openLightbox(v, c); });
    });
    applyFilter();

    $$(".filter", f).forEach(function (b) {
      b.addEventListener("click", function () {
        currentFilter = b.getAttribute("data-f");
        $$(".filter", f).forEach(function (x) { var on = x === b; x.classList.toggle("is-on", on); x.setAttribute("aria-selected", on); });
        applyFilter(true);
      });
    });
  }
  function applyFilter(animate) {
    $$("#cuts .clip").forEach(function (el, i) {
      var show = currentFilter === "all" || el.getAttribute("data-cat").indexOf("|" + currentFilter + "|") > -1;
      if (!animate) { el.hidden = !show; return; }
      if (show) {
        el.hidden = false; el.classList.add("is-out");
        setTimeout(function () { el.classList.remove("is-out"); }, 30 + (i % 8) * 40);
      } else { el.hidden = true; }
    });
  }

  function renderAbout(stats) {
    var txt = t("about_text").split(/\n\s*\n|\n/).filter(Boolean);
    $("#aboutText").innerHTML = txt.map(function (p) { return "<p>" + esc(p) + "</p>"; }).join("");
    var st = $("#stats");
    st.hidden = !stats.length;
    st.innerHTML = stats.map(function (s) {
      return '<div><div class="stat__v">' + esc(s.value) + '</div><div class="stat__l">' + esc(s.label) + "</div></div>";
    }).join("");
    var skills = t("skills").split(",").map(function (s) { return s.trim(); }).filter(Boolean);
    var sk = $("#skills");
    sk.hidden = !skills.length;
    sk.innerHTML = skills.map(function (s) { return '<span class="chip">' + esc(s) + "</span>"; }).join("");
  }

  var ARROW = '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8" fill="none" stroke="#f5f5f7" stroke-width="1.2"/></svg>';
  function renderProjects(items) {
    $("#projectList").innerHTML = items.map(function (p) {
      var u = safeUrl(p.link_url);
      var tag = u ? 'a href="' + esc(u) + '" target="_blank" rel="noopener"' : "div";
      return "<" + tag + ' class="project reveal"><span class="project__y">' + esc(p.year) + '</span><span class="project__t">' + esc(p.title) +
        '</span><span class="project__r">' + esc(p.role) + '</span><span class="project__a">' + (u ? ARROW : "") + "</span></" + (u ? "a" : "div") + ">";
    }).join("");
  }

  function renderResearch(items) {
    var u = safeUrl(t("research_url"));
    var b = $("#researchBtn");
    b.hidden = !u;
    if (u) b.href = u;
    var tk = $("#toolkit");
    tk.hidden = !items.length;
    tk.innerHTML = items.map(function (it) {
      var lu = safeUrl(it.link_url);
      var tag = lu ? 'a href="' + esc(lu) + '" target="_blank" rel="noopener"' : "div";
      return "<" + tag + ' class="tool reveal">' + (it.tag ? '<div class="tool__tag">' + esc(it.tag) + "</div>" : "") +
        '<div class="tool__t">' + esc(it.title) + '</div><div class="tool__d">' + esc(it.description) + "</div>" +
        (lu ? '<div class="tool__go">Open →</div>' : "") + "</" + (lu ? "a" : "div") + ">";
    }).join("");
  }

  function renderContact(links) {
    var m = $("#mail"), e = t("email");
    m.hidden = !e;
    m.textContent = e;
    m.href = "mailto:" + e;
    var ph = $("#phone"), pv = t("phone");
    ph.hidden = !pv;
    ph.textContent = pv;
    ph.href = "tel:" + pv.replace(/[^\d+]/g, "");
    var cv = cvSource();
    $("#cvBtn").hidden = !cv;
    $("#cvBtn").onclick = openCv;
    var dl = $("#cvDownload");
    dl.hidden = !cv || !t("cv_download_label");
    if (cv) dl.href = cv.download;
    $("#cv").hidden = !cv;
    $("#socials").innerHTML = links.map(function (l) {
      var u = safeUrl(l.url);
      return u ? '<a href="' + esc(u) + '" target="_blank" rel="noopener">' + esc(l.label) + "</a>" : "";
    }).join("");
    $("#year").textContent = new Date().getFullYear();
  }

  /* ---------- lightbox ---------- */
  var lastFocus = null;
  function openLightbox(v, c) {
    if (v && v.type === "link") { window.open(v.src, "_blank", "noopener"); return; }
    lastFocus = document.activeElement;
    var lb = $("#lightbox");
    $("#lightboxFrame").innerHTML = playerHTML(v, c.title);
    $("#lightboxCaption").textContent = [c.title, dots(c.roles), dots(c.subtitle)].filter(Boolean).join("   /   ");
    lb.hidden = false;
    requestAnimationFrame(function () { lb.classList.add("is-open"); });
    document.documentElement.style.overflow = "hidden";
    $("#lightboxClose").focus();
  }
  function closeLightbox() {
    var lb = $("#lightbox");
    if (lb.hidden) return;
    lb.classList.remove("is-open");
    document.documentElement.style.overflow = "";
    setTimeout(function () { lb.hidden = true; $("#lightboxFrame").innerHTML = ""; }, 350);
    if (lastFocus) lastFocus.focus();
  }
  $("#lightboxClose").addEventListener("click", closeLightbox);
  $("#lightbox").addEventListener("click", function (e) { if (e.target.id === "lightbox") closeLightbox(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeLightbox(); });


  /* ---------- CV viewer (full screen) ---------- */
  var PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/";
  var cvLoaded = "", cvFocus = null;
  function cvSource() {
    var u = safeUrl(t("cv_url")), m;
    if (!u) return null;
    if ((m = u.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:.*&)?id=)([\w-]{10,})/i))) {
      return { kind: "drive", view: "https://drive.google.com/file/d/" + m[1] + "/preview",
        download: "https://drive.google.com/uc?export=download&id=" + m[1] };
    }
    return { kind: "pdf", view: u, download: u };
  }
  function loadScript(src) {
    return new Promise(function (ok, fail) {
      if (window.pdfjsLib) return ok();
      var s = document.createElement("script");
      s.src = src; s.onload = ok; s.onerror = fail;
      document.head.appendChild(s);
    });
  }
  function cvMsg(html) { $("#cvViewBody").innerHTML = '<div class="cvview__msg">' + html + "</div>"; }
  function cvFrame(src) { $("#cvViewBody").innerHTML = '<iframe class="cvview__frame" src="' + esc(src) + '" title="CV"></iframe>'; }
  function renderCv(src) {
    if (cvLoaded === src.view) return;
    cvLoaded = src.view;
    if (src.kind === "drive") { cvFrame(src.view); return; }
    cvMsg('<div class="cvview__spin"></div>Loading CV');
    loadScript(PDFJS + "pdf.min.js").then(function () {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + "pdf.worker.min.js";
      return window.pdfjsLib.getDocument(src.view).promise;
    }).then(function (pdf) {
      var body = $("#cvViewBody");
      body.innerHTML = "";
      var width = Math.min(900, body.clientWidth - 20);
      var dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      var chain = Promise.resolve();
      for (var i = 1; i <= pdf.numPages; i++) (function (n) {
        chain = chain.then(function () { return pdf.getPage(n); }).then(function (page) {
          var base = page.getViewport({ scale: 1 });
          var vp = page.getViewport({ scale: (width / base.width) * dpr });
          var cnv = document.createElement("canvas");
          cnv.className = "cvview__page";
          cnv.width = vp.width; cnv.height = vp.height;
          cnv.setAttribute("aria-label", "CV page " + n);
          body.appendChild(cnv);
          return page.render({ canvasContext: cnv.getContext("2d"), viewport: vp }).promise;
        });
      })(i);
      return chain;
    }).catch(function (e) {
      console.warn("[portfolio] CV", e);
      cvLoaded = "";
      cvFrame(src.view); // browser's own PDF viewer as a fallback
    });
  }
  function openCv() {
    var src = cvSource();
    if (!src) return;
    cvFocus = document.activeElement;
    var v = $("#cvView");
    $("#cvViewDownload").href = src.download;
    v.hidden = false;
    requestAnimationFrame(function () { v.classList.add("is-open"); });
    document.documentElement.style.overflow = "hidden";
    $("#cvViewClose").focus();
    renderCv(src);
    if (location.hash !== "#cv") history.replaceState(null, "", "#cv");
  }
  function closeCv() {
    var v = $("#cvView");
    if (v.hidden) return;
    v.classList.remove("is-open");
    document.documentElement.style.overflow = "";
    setTimeout(function () { v.hidden = true; }, 400);
    if (location.hash === "#cv") history.replaceState(null, "", location.pathname + location.search);
    if (cvFocus) cvFocus.focus();
  }
  $("#cvViewClose").addEventListener("click", closeCv);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeCv(); });

  /* ---------- small motion details ---------- */
  var revealObs = null;
  function observeReveal() {
    var els = $$(".reveal:not(.is-in)");
    if (!("IntersectionObserver" in window)) { els.forEach(function (e) { e.classList.add("is-in"); }); return; }
    if (!revealObs) revealObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("is-in"); revealObs.unobserve(en.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });
    els.forEach(function (e, i) {
      if (e.classList.contains("clip") || e.classList.contains("tool")) {
        // stagger left → right inside each row of the grid
        var parent = e.parentNode;
        var sibs = Array.prototype.filter.call(parent.children, function (c) { return !c.hidden; });
        var cols = Math.max(1, Math.round(parent.clientWidth / (e.offsetWidth || parent.clientWidth)));
        e.style.transitionDelay = (sibs.indexOf(e) % cols) * 80 + "ms";
      }
      revealObs.observe(e);
    });
  }

  var navObs = null;
  function observeNav() {
    if (!("IntersectionObserver" in window)) return;
    if (navObs) navObs.disconnect();
    navObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        $$("#navLinks a").forEach(function (a) { a.classList.toggle("is-active", a.getAttribute("data-nav") === en.target.id); });
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    ["work", "about", "projects", "research", "contact"].forEach(function (id) {
      var el = document.getElementById(id); if (el && !el.hidden) navObs.observe(el);
    });
  }

  // scroll progress hairline + showreel timecode follows scroll
  var bar = $("#progress"), reelTc = $("#reelTc"), ticking = false;
  window.addEventListener("scroll", function () {
    if (ticking) return; ticking = true;
    requestAnimationFrame(function () {
      var h = document.documentElement.scrollHeight - innerHeight;
      var p = h > 0 ? scrollY / h : 0;
      bar.style.transform = "scaleX(" + p + ")";
      var secs = Math.floor(p * 62);
      reelTc.textContent = "00:" + pad(Math.floor(secs / 60)) + ":" + pad(secs % 60);
      ticking = false;
    });
  }, { passive: true });

  // live footer timecode at 24 fps
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  var tc = $("#tc");
  setInterval(function () {
    var d = new Date();
    tc.textContent = pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds()) + ":" + pad(Math.floor(d.getMilliseconds() / 1000 * 24));
  }, 1000 / 24);

  /* ---------- boot ---------- */
  var cached = store(true);
  if (cached) render(cached);
  var fallbackTimer = setTimeout(function () { if (!cached) render(DEFAULTS); }, 5000);

  loadSheet().then(function (data) {
    clearTimeout(fallbackTimer);
    var fresh = JSON.stringify(data);
    if (!cached || JSON.stringify(cached) !== fresh) render(data);
    store(false, data);
  }).catch(function (e) {
    clearTimeout(fallbackTimer);
    console.warn("[portfolio]", e.message);
    if (!cached) render(DEFAULTS);
  });
})();
