/* ============================================================
   MERIDIAN STUDIO — main.js
   Hand-written vanilla JS. No libraries, no build step.
   Modules: utils, clock, preloader, smoke, header, menu,
   cursor, reveals, magnetic, drag-scroll, compare, stack,
   marquee, accordion, modal player, form, rails & progress.
   ============================================================ */
(() => {
  "use strict";

  /* ---------- utils ---------- */
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const PRM = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const FINE = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  const pad2 = (n) => String(n).padStart(2, "0");
  const toSec = (str) => {
    const p = String(str).split(":").map(Number);
    return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1];
  };
  const toClock = (s) => `${Math.floor(s / 60)}:${pad2(Math.floor(s % 60))}`;

  /* ---------- live clocks ---------- */
  const clocks = $$("[data-clock]");
  if (clocks.length) {
    const tick = () => {
      const d = new Date();
      const t = `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
      clocks.forEach((c) => (c.textContent = t));
    };
    tick();
    setInterval(tick, 1000);
  }

  /* ---------- volumetric-ish smoke (2D canvas) ---------- */
  class Smoke {
    constructor(canvas, density = 34, alpha = 0.05) {
      this.c = canvas;
      this.ctx = canvas.getContext("2d");
      this.n = density;
      this.alpha = alpha;
      this.parts = [];
      this.raf = null;
      this.resize = this.resize.bind(this);
      this.loop = this.loop.bind(this);
      window.addEventListener("resize", this.resize, { passive: true });
      this.resize();
      for (let i = 0; i < this.n; i++) this.parts.push(this.spawn(true));
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) this.stop();
        else this.start();
      });
    }
    resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.6);
      this.w = this.c.clientWidth;
      this.h = this.c.clientHeight;
      this.c.width = this.w * dpr;
      this.c.height = this.h * dpr;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    spawn(anywhere = false) {
      const r = 90 + Math.random() * 200;
      return {
        x: Math.random() * this.w,
        y: anywhere ? Math.random() * this.h : this.h + r * 0.4,
        r,
        vy: 0.12 + Math.random() * 0.35,
        vx: (Math.random() - 0.5) * 0.2,
        a: 0,
        am: this.alpha * (0.5 + Math.random() * 0.8),
        ph: Math.random() * Math.PI * 2,
        hue: Math.random() < 0.18,
      };
    }
    loop() {
      const { ctx, w, h } = this;
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < this.parts.length; i++) {
        const p = this.parts[i];
        p.ph += 0.004;
        p.x += p.vx + Math.sin(p.ph) * 0.3;
        p.y -= p.vy;
        p.a = Math.min(p.am, p.a + 0.0009);
        if (p.y < -p.r) this.parts[i] = this.spawn();
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
        const base = p.hue ? "201,162,75" : "190,196,214";
        g.addColorStop(0, `rgba(${base},${p.a})`);
        g.addColorStop(1, `rgba(${base},0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      this.raf = requestAnimationFrame(this.loop);
    }
    start() { if (!this.raf && !PRM) this.raf = requestAnimationFrame(this.loop); }
    stop() { if (this.raf) cancelAnimationFrame(this.raf), (this.raf = null); }
  }

  /* ---------- preloader ---------- */
  const intro = $("#intro");
  const hero = $("[data-hero]");
  const body = document.body;

  body.classList.add("is-locked");

  const begin = () => {
    if (!intro && !document.body.classList.contains("is-locked")) { /* already open */ }
    if (intro) {
      if (intro.classList.contains("is-done")) return;
      intro.classList.add("is-done");
      setTimeout(() => intro.remove(), 1400);
    }
    body.classList.remove("is-locked");
    if (hero) {
      hero.classList.add("in");
      // staged reveal of hero copy once the opening plate lifts
      $$("[data-reveal]", hero).forEach((el) => el.classList.add("in"));
    }
    try { sessionStorage.setItem("mrd-seen", "1"); } catch (e) {}
  };

  if (intro) {
    const pctEl = $("#introPct");
    const barEl = $("#introBar");
    const smoke = new Smoke($("#introCanvas"), 40, 0.06);
    smoke.start();

    let seen = false;
    try { seen = sessionStorage.getItem("mrd-seen") === "1"; } catch (e) {}

    const finish = () => { smoke.stop(); begin(); };
    $("#skipIntro").addEventListener("click", finish);

    if (seen || PRM) {
      // returning visitors skip straight to the site
      pctEl.textContent = "100%";
      barEl.style.transform = "scaleX(1)";
      setTimeout(finish, 250);
    } else {
      // preload the hero plate while the counter runs — min 2.8s, max 6s
      const plate = new Image();
      plate.src = $("[data-hero-src]").src;
      let pct = 0, loaded = false;
      plate.onload = plate.onerror = () => (loaded = true);
      const t0 = performance.now();
      const run = () => {
        const elapsed = performance.now() - t0;
        const target = loaded ? 100 : 72;
        pct = Math.min(target, pct + (target - pct) * 0.045 + 0.3);
        pctEl.textContent = `${Math.floor(pct)}%`;
        barEl.style.transform = `scaleX(${pct / 100})`;
        if (pct > 99.4 && elapsed > 2800) return finish();
        if (elapsed > 6000) return finish();
        requestAnimationFrame(run);
      };
      requestAnimationFrame(run);
    }
  } else {
    hero && hero.classList.add("in");
    body.classList.remove("is-locked");
  }

  const heroSmokeEl = $("#heroSmoke");
  if (heroSmokeEl && !PRM) new Smoke(heroSmokeEl, 22, 0.035).start();

  /* ---------- header ---------- */
  const header = $("[data-header]");
  let lastY = 0;
  const onScrollHeader = () => {
    const y = window.scrollY;
    header.classList.toggle("is-scrolled", y > 40);
    header.classList.toggle("is-hidden", y > 500 && y > lastY && !menu.classList.contains("is-open"));
    lastY = y;
  };

  /* ---------- menu overlay ---------- */
  const menu = $("#menu");
  const menuBtn = $("#menuBtn");
  const setMenu = (open) => {
    menu.classList.toggle("is-open", open);
    menuBtn.classList.toggle("is-open", open);
    menuBtn.setAttribute("aria-expanded", open);
    menu.setAttribute("aria-hidden", !open);
    body.classList.toggle("is-locked", open);
    $(".menu-btn .lbl", menuBtn).textContent = open ? "Close" : "Menu";
  };
  menuBtn.addEventListener("click", () => setMenu(!menu.classList.contains("is-open")));
  $$(".menu__link", menu).forEach((a) =>
    a.addEventListener("click", () => setMenu(false))
  );
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && menu.classList.contains("is-open")) setMenu(false);
  });

  /* ---------- custom cursor ---------- */
  if (FINE && !PRM) {
    const dot = document.createElement("div");
    const ring = document.createElement("div");
    dot.className = "cursor-dot";
    ring.className = "cursor-ring";
    ring.innerHTML = `<span class="cursor-tag"></span>`;
    document.body.append(dot, ring);
    const tag = $(".cursor-tag", ring);

    let mx = innerWidth / 2, my = innerHeight / 2;
    let dx = mx, dy = my, rx = mx, ry = my;
    addEventListener("mousemove", (e) => { mx = e.clientX; my = e.clientY; }, { passive: true });

    (function raf() {
      dx = lerp(dx, mx, 0.55); dy = lerp(dy, my, 0.55);
      rx = lerp(rx, mx, 0.16); ry = lerp(ry, my, 0.16);
      dot.style.transform = `translate(${dx}px,${dy}px) translate(-50%,-50%)`;
      ring.style.transform = `translate(${rx}px,${ry}px) translate(-50%,-50%)`;
      requestAnimationFrame(raf);
    })();

    const hoverSel = "a, button, [data-cursor], input, select, textarea, label";
    document.addEventListener("mouseover", (e) => {
      const t = e.target.closest(hoverSel);
      ring.classList.toggle("is-active", !!t);
      const tagged = e.target.closest("[data-cursor]");
      if (tagged) {
        tag.textContent = tagged.dataset.cursor;
        ring.classList.add("has-tag");
      } else ring.classList.remove("has-tag");
    });
    document.addEventListener("mouseleave", () => {
      dot.classList.add("is-hidden");
      ring.classList.add("is-hidden");
    });
    document.addEventListener("mouseenter", () => {
      dot.classList.remove("is-hidden");
      ring.classList.remove("is-hidden");
    });
  }

  /* ---------- scroll reveals ---------- */
  const io = new IntersectionObserver(
    (entries) => entries.forEach((en) => {
      if (en.isIntersecting) {
        en.target.classList.add("in");
        io.unobserve(en.target);
      }
    }),
    { threshold: 0.18, rootMargin: "0px 0px -6% 0px" }
  );
  $$("[data-reveal], .section__title").forEach((el) => {
    if (el.closest("[data-hero]")) return; // hero is choreographed by begin()
    io.observe(el);
  });

  /* ---------- magnetic elements ---------- */
  if (FINE && !PRM) {
    $$("[data-magnetic]").forEach((el) => {
      const strength = 0.32;
      el.addEventListener("mousemove", (e) => {
        const r = el.getBoundingClientRect();
        const x = e.clientX - r.left - r.width / 2;
        const y = e.clientY - r.top - r.height / 2;
        el.style.transition = "transform .15s ease-out";
        el.style.transform = `translate(${x * strength}px, ${y * strength}px)`;
      });
      el.addEventListener("mouseleave", () => {
        el.style.transition = "transform .6s cubic-bezier(.22,1,.36,1)";
        el.style.transform = "";
      });
    });
  }

  /* ---------- drag-to-scroll rows ---------- */
  const makeDraggable = (track, onScroll) => {
    if (!track) return;
    let down = false, startX = 0, startL = 0, moved = 0;
    track.addEventListener("pointerdown", (e) => {
      down = true; moved = 0;
      startX = e.clientX;
      startL = track.scrollLeft;
      track.classList.add("is-dragging");
    });
    track.addEventListener("pointermove", (e) => {
      if (!down) return;
      const d = e.clientX - startX;
      moved = Math.max(moved, Math.abs(d));
      track.scrollLeft = startL - d;
    });
    const up = () => { down = false; track.classList.remove("is-dragging"); };
    track.addEventListener("pointerup", up);
    track.addEventListener("pointercancel", up);
    track.addEventListener("pointerleave", up);
    // swallow the click after a real drag so cards don't open
    track.addEventListener("click", (e) => { if (moved > 8) { e.preventDefault(); e.stopPropagation(); } }, true);
    const update = () => onScroll && onScroll(track);
    track.addEventListener("scroll", update, { passive: true });
    addEventListener("resize", update, { passive: true });
    update();
  };

  /* films row + progress */
  const filmsTrack = $("#filmsTrack");
  makeDraggable(filmsTrack, (t) => {
    const bar = $("#filmsProgress");
    if (!bar) return;
    const max = t.scrollWidth - t.clientWidth;
    const p = max > 0 ? t.scrollLeft / max : 0;
    const thumb = clamp(t.clientWidth / t.scrollWidth, 0.12, 1);
    bar.style.width = `${thumb * 100}%`;
    bar.style.transform = `translateX(${(p * (1 - thumb)) / thumb * 100}%)`;
  });

  /* verticals row + counter */
  const vTrack = $("#verticalsTrack");
  const vFrom = $("#vFrom");
  const vTotal = $("#vTotal");
  const vPrev = $("#vPrev");
  const vNext = $("#vNext");
  if (vTrack) {
    const cards = $$(":scope > .v-card, :scope > .v-group", vTrack);
    if (vTotal) vTotal.textContent = pad2(cards.reduce((n, c) => n + (c.classList.contains("v-group") ? $$(".v-card", c).length : 1), 0));
    const cardW = () => ($(".v-card", vTrack) || vTrack).getBoundingClientRect().width + 20;
    makeDraggable(vTrack, (t) => {
      const max = t.scrollWidth - t.clientWidth;
      const p = max > 0 ? t.scrollLeft / max : 0;
      const steps = cards.length;
      const cur = clamp(Math.round(p * (steps - 1)) + 1, 1, steps);
      if (vFrom) vFrom.textContent = pad2(cur);
      vPrev.disabled = t.scrollLeft <= 4;
      vNext.disabled = t.scrollLeft >= max - 4;
    });
    vPrev.addEventListener("click", () => vTrack.scrollBy({ left: -cardW(), behavior: "smooth" }));
    vNext.addEventListener("click", () => vTrack.scrollBy({ left: cardW(), behavior: "smooth" }));
  }

  /* ---------- compare slider ---------- */
  const compare = $("#compare");
  if (compare) {
    const setX = (p, animate = true) => {
      p = clamp(p, 4, 96);
      if (animate && !PRM) {
        compare.style.transition = "--x .8s cubic-bezier(.65,.05,0,1)";
        compare.style.setProperty("--x", `${p}%`);
        setTimeout(() => (compare.style.transition = ""), 850);
      } else compare.style.setProperty("--x", `${p}%`);
    };
    let dragging = false;
    const fromEvent = (e) => {
      const r = compare.getBoundingClientRect();
      return ((e.clientX - r.left) / r.width) * 100;
    };
    compare.addEventListener("pointerdown", (e) => {
      dragging = true;
      compare.setPointerCapture(e.pointerId);
      setX(fromEvent(e), false);
    });
    compare.addEventListener("pointermove", (e) => dragging && setX(fromEvent(e), false));
    ["pointerup", "pointercancel"].forEach((ev) =>
      compare.addEventListener(ev, () => (dragging = false))
    );

    const steps = $$(".engine__step");
    const count = $("#engineCount");
    const activate = (i) => {
      steps.forEach((s, j) => s.classList.toggle("is-active", i === j));
      if (count) count.textContent = `${pad2(i + 1)} / ${pad2(steps.length)}`;
      setX([8, 55, 94][i] ?? 55);
    };
    steps.forEach((s, i) => s.addEventListener("click", () => activate(i)));
    activate(1);
  }

  /* ---------- clients marquee ---------- */
  const marquee = $("#clientsMarquee");
  const mToggle = $("#marqueeToggle");
  if (marquee && mToggle) {
    mToggle.addEventListener("click", () => {
      const paused = marquee.classList.toggle("is-paused");
      mToggle.setAttribute("aria-pressed", paused);
      $(".state", mToggle).textContent = paused ? "Play motion" : "Pause motion";
      $(".glyph", mToggle).textContent = paused ? "▶" : "Ⅱ";
    });
  }

  /* ---------- FAQ accordion ---------- */
  $$(".faq__item").forEach((item) => {
    const btn = $(".faq__q", item);
    btn.addEventListener("click", () => {
      const open = item.classList.contains("is-open");
      $$(".faq__item.is-open").forEach((o) => {
        o.classList.remove("is-open");
        $(".faq__q", o).setAttribute("aria-expanded", "false");
      });
      if (!open) {
        item.classList.add("is-open");
        btn.setAttribute("aria-expanded", "true");
      }
    });
  });

  /* ---------- film modal (cinematic poster preview) ---------- */
  const modal = $("#filmModal");
  let mRaf = null, mT = 0, mDur = 0, mPlaying = false, mLast = 0;

  const mEls = modal ? {
    poster: $("#mPoster"),
    title: $("#mTitle"),
    meta: $("#mMeta"),
    time: $("#mTime"),
    dur: $("#mDur"),
    scrub: $("#mScrub"),
    fill: $("#mFill"),
    toggle: $("#mToggle"),
  } : {};

  const mRender = () => {
    mEls.time.textContent = toClock(mT);
    mEls.fill.style.width = `${(mT / mDur) * 100}%`;
  };
  const mLoop = (ts) => {
    if (!mPlaying) return;
    if (!mLast) mLast = ts;
    mT += (ts - mLast) / 1000;
    mLast = ts;
    if (mT >= mDur) { mT = mDur; mPlaying = false; mEls.toggle.textContent = "▶"; modal.classList.add("is-paused"); }
    mRender();
    mRaf = requestAnimationFrame(mLoop);
  };
  const mSetPlay = (play) => {
    mPlaying = play;
    mLast = 0;
    mEls.toggle.textContent = play ? "❚❚" : "▶";
    modal.classList.toggle("is-paused", !play);
    cancelAnimationFrame(mRaf);
    if (play) {
      if (mT >= mDur) mT = 0;
      mRaf = requestAnimationFrame(mLoop);
    }
  };
  const openModal = (data) => {
    mEls.poster.src = data.poster;
    mEls.poster.alt = `${data.title} — film poster`;
    mEls.title.textContent = data.title;
    mEls.meta.textContent = data.meta;
    mDur = toSec(data.duration);
    mT = 0;
    mEls.dur.textContent = data.duration;
    mRender();
    modal.classList.toggle("is-portrait", data.orientation === "portrait");
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    body.classList.add("is-locked");
    mSetPlay(true);
    $("#mClose").focus({ preventScroll: true });
  };
  const closeModal = () => {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    body.classList.remove("is-locked");
    mSetPlay(false);
    mT = 0;
  };
  if (modal) {
    $$("[data-film]").forEach((card) =>
      card.addEventListener("click", (e) => {
        e.preventDefault();
        openModal(card.dataset);
      })
    );
    $$("[data-close]", modal).forEach((el) => el.addEventListener("click", closeModal));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modal.classList.contains("is-open")) closeModal();
      if (e.key === " " && modal.classList.contains("is-open") && e.target === document.body) {
        e.preventDefault();
        mSetPlay(!mPlaying);
      }
    });
    mEls.toggle.addEventListener("click", () => mSetPlay(!mPlaying));
    mEls.scrub.addEventListener("click", (e) => {
      const r = mEls.scrub.getBoundingClientRect();
      mT = clamp(((e.clientX - r.left) / r.width) * mDur, 0, mDur);
      mRender();
    });
  }

  /* ---------- contact form ---------- */
  const form = $("#briefForm");
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (form.checkValidity() === false) return form.reportValidity();
      if ($(".hp input", form).value) return; // honeypot tripped — silently bail
      const btn = $("button[type=submit]", form);
      btn.disabled = true;
      $(".btn-label", btn).textContent = "Sending…";
      setTimeout(() => {
        form.classList.add("is-sent");
        $("#formStamp").focus && $("#formStamp").focus({ preventScroll: true });
      }, 1100);
    });
    $("#formReset").addEventListener("click", () => {
      form.reset();
      form.classList.remove("is-sent");
      const btn = $("button[type=submit]", form);
      btn.disabled = false;
      $(".btn-label", btn).textContent = "Send project brief";
    });
  }

  /* ---------- scroll furniture: hairline, to-top, rail ---------- */
  const scrollFill = $("#scrollLine");
  const toTop = $("#toTop");
  const railLinks = $$("#rail a");
  const sections = railLinks
    .map((a) => $(a.getAttribute("href")))
    .filter(Boolean);

  const railIO = new IntersectionObserver(
    (entries) => entries.forEach((en) => {
      if (en.isIntersecting) {
        railLinks.forEach((a) =>
          a.classList.toggle("is-active", a.getAttribute("href") === `#${en.target.id}`)
        );
      }
    }),
    { threshold: 0.3 }
  );
  sections.forEach((s) => railIO.observe(s));

  const onScrollFurniture = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    const p = max > 0 ? window.scrollY / max : 0;
    if (scrollFill) scrollFill.style.transform = `scaleX(${p})`;
    if (toTop) {
      toTop.classList.toggle("is-visible", window.scrollY > innerHeight * 1.6);
      toTop.style.setProperty("--p", p.toFixed(4));
    }
  };
  addEventListener("scroll", () => { onScrollHeader(); onScrollFurniture(); }, { passive: true });
  onScrollHeader();
  onScrollFurniture();
  toTop && toTop.addEventListener("click", () => scrollTo({ top: 0, behavior: PRM ? "auto" : "smooth" }));

  /* ---------- footer year ---------- */
  const yr = $("#year");
  if (yr) yr.textContent = new Date().getFullYear();
})();
