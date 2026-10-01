(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const TAU = Math.PI * 2;

  /* ---------- header, nav ---------- */
  const header = $('.site-header');
  const syncHeader = () => header.classList.toggle('is-solid', window.scrollY > 8);
  syncHeader();
  addEventListener('scroll', syncHeader, { passive: true });

  const toggle = $('.nav-toggle');
  const nav = $('#nav');
  const setNav = (open) => {
    nav.classList.toggle('open', open);
    document.body.classList.toggle('nav-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? '메뉴 닫기' : '메뉴 열기');
  };
  toggle.addEventListener('click', () => setNav(!nav.classList.contains('open')));
  $$('a', nav).forEach((a) => a.addEventListener('click', () => setNav(false)));
  addEventListener('keydown', (e) => { if (e.key === 'Escape') setNav(false); });

  const navLinks = $$('a[href^="#"]', nav);
  const linkFor = new Map(navLinks.map((a) => [a.getAttribute('href').slice(1), a]));
  const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      navLinks.forEach((l) => l.removeAttribute('aria-current'));
      const l = linkFor.get(e.target.id);
      if (l) l.setAttribute('aria-current', 'true');
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  ['hero', 'about', 'products', 'process', 'facilities', 'contact'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) sectionObserver.observe(el);
  });


  /* ---------- light / dark theme ---------- */
  (() => {
    const btn = $('.theme-toggle');
    if (!btn) return;
    const root = document.documentElement;
    const meta = $('meta[name="theme-color"]');
    const apply = (mode) => {
      root.dataset.theme = mode;
      const dark = mode === 'dark';
      btn.setAttribute('aria-pressed', String(dark));
      btn.setAttribute('aria-label', dark ? '라이트 모드로 전환' : '다크 모드로 전환');
      if (meta) meta.setAttribute('content', dark ? '#061530' : '#ffffff');
    };
    apply(root.dataset.theme === 'dark' ? 'dark' : 'light');
    btn.addEventListener('click', () => {
      const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
      apply(next);
      try { localStorage.setItem('yz-theme', next); } catch (e) { /* storage unavailable: theme still switches for this visit */ }
    });
  })();

  /* ---------- product detail dialogs ---------- */
  const openDialog = (id) => {
    const dlg = document.getElementById(id);
    if (!dlg || typeof dlg.showModal !== 'function') return false;
    $$('dialog[open]').forEach((d) => d.close());
    dlg.showModal();
    dlg.scrollTop = 0;
    return true;
  };
  $$('[data-open]').forEach((el) => {
    el.addEventListener('click', (e) => {
      if (openDialog(el.dataset.open)) {
        e.preventDefault();
        setNav(false);
        if (document.activeElement && el.closest('#nav')) document.activeElement.blur();
      }
    });
  });
  $$('dialog.pdlg').forEach((dlg) => {
    $('[data-close]', dlg).addEventListener('click', () => dlg.close());
    // click on the dimmed backdrop closes the dialog
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
    // "문의하기" inside a dialog: close it, then let the #contact link scroll
    $$('a[href="#contact"]', dlg).forEach((a) => a.addEventListener('click', () => dlg.close()));
  });
  if (location.hash.startsWith('#dlg-')) openDialog(location.hash.slice(1));

  /* ---------- hero: flow cell imaging (sequencing by synthesis) ----------
     Each nanowell holds one DNA cluster with its own sequence. Every cycle the
     clusters light up in the colour of the base they incorporate, the way an
     NGS instrument images a patterned flow cell. Pointing at a cluster shows
     the bases called for it so far. */
  (() => {
    const hero = $('.hero');
    const cv = $('#flowcell');
    if (!hero || !cv) return;

    const ctx = cv.getContext('2d');
    const elCyc = $('#cyc');
    const elRead = $('#read');
    const elCl = $('#cl');

    const BASES = 'ACGT';
    const RGB = [[61, 220, 151], [77, 168, 255], [255, 201, 77], [255, 107, 107]];
    const CLS = ['b-a', 'b-c', 'b-g', 'b-t'];
    const READ_LEN = 150;
    const CYCLE_MS = 1150;
    const LEVELS = 4;

    let W = 0, H = 0, pitch = 32, rad = 7.5;
    let wells = [];
    let buckets = [];
    let sel = -1, pointerSel = false, autoTimer = 0;
    let cycle = 0, cycleStart = 0;
    let running = false, raf = 0;

    function prng(seed) {
      return () => {
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }

    function build() {
      const r = hero.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = r.width; H = r.height;
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      pitch = W < 720 ? 22 : 30;
      rad = pitch * 0.25;
      const rowH = pitch * 0.866;
      const rand = prng(20261001);
      wells = [];
      for (let j = 0; j * rowH < H + rowH; j++) {
        const off = (j & 1) ? pitch / 2 : 0;
        for (let x = off; x < W + pitch; x += pitch) {
          const occ = rand() < 0.86;
          const seq = new Uint8Array(READ_LEN);
          if (occ) for (let k = 0; k < READ_LEN; k++) seq[k] = (rand() * 4) | 0;
          wells.push({ x, y: j * rowH, occ, seq, lvl: (rand() * LEVELS) | 0 });
        }
      }
      sel = nearest(W * 0.74, H * 0.4);
      bucketize();
      paintRead();
      if (!running) draw(performance.now());
    }

    function nearest(px, py) {
      let best = -1, bd = Infinity;
      for (let i = 0; i < wells.length; i++) {
        const w = wells[i];
        if (!w.occ) continue;
        const d = (w.x - px) ** 2 + (w.y - py) ** 2;
        if (d < bd) { bd = d; best = i; }
      }
      return best;
    }

    // Group the clusters by (base this cycle, brightness level) so each frame needs only a few paths.
    function bucketize() {
      const ci = cycle % READ_LEN;
      buckets = Array.from({ length: 4 * LEVELS }, () => []);
      for (const w of wells) if (w.occ) buckets[w.seq[ci] * LEVELS + w.lvl].push(w);
    }

    function paintRead() {
      elCyc.textContent = 'Cycle ' + String(cycle + 1).padStart(3, '0');
      if (sel < 0) { elRead.textContent = ''; return; }
      const w = wells[sel];
      const end = cycle % READ_LEN;
      const start = Math.max(0, end - 23);
      let html = '';
      for (let k = start; k <= end; k++) html += '<i class="' + CLS[w.seq[k]] + '">' + BASES[w.seq[k]] + '</i>';
      elRead.innerHTML = html;
      elCl.textContent = '#' + String(sel).padStart(4, '0');
    }

    function nextCycle(now) {
      cycle++;
      cycleStart = now;
      bucketize();
      if (!pointerSel && ++autoTimer >= 12) {
        autoTimer = 0;
        sel = nearest(W * (0.6 + Math.random() * 0.32), H * (0.18 + Math.random() * 0.6));
      }
      paintRead();
    }

    const envelope = (p) => (p < 0.1 ? p / 0.1 : 1 - 0.72 * ((p - 0.1) / 0.9));

    function draw(now) {
      if (!cycleStart) cycleStart = now;
      let p = (now - cycleStart) / CYCLE_MS;
      if (p >= 1 && !reduceMotion) { nextCycle(now); p = 0; }
      const e = reduceMotion ? 1 : envelope(Math.min(p, 1));

      ctx.clearRect(0, 0, W, H);

      // the patterned substrate: every well, lit or not
      ctx.beginPath();
      for (const w of wells) { ctx.moveTo(w.x + rad, w.y); ctx.arc(w.x, w.y, rad, 0, TAU); }
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(110,140,205,.2)';
      ctx.stroke();

      // fluorescence: halo then core, one path per base and brightness level
      for (let b = 0; b < 4; b++) {
        const c = RGB[b];
        for (let l = 0; l < LEVELS; l++) {
          const list = buckets[b * LEVELS + l];
          if (!list.length) continue;
          const a = (0.08 + 0.72 * e) * (0.45 + 0.55 * (l + 1) / LEVELS);
          ctx.beginPath();
          for (const w of list) { ctx.moveTo(w.x + rad * 1.7, w.y); ctx.arc(w.x, w.y, rad * 1.7, 0, TAU); }
          ctx.fillStyle = 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (a * 0.18).toFixed(3) + ')';
          ctx.fill();
          ctx.beginPath();
          for (const w of list) { ctx.moveTo(w.x + rad * 0.9, w.y); ctx.arc(w.x, w.y, rad * 0.9, 0, TAU); }
          ctx.fillStyle = 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a.toFixed(3) + ')';
          ctx.fill();
        }
      }

      // reticle on the selected cluster
      if (sel >= 0) {
        const w = wells[sel];
        const R = pitch * 0.62;
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = 'rgba(255,255,255,.9)';
        ctx.beginPath(); ctx.arc(w.x, w.y, R, 0, TAU); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(w.x - R - 10, w.y); ctx.lineTo(w.x - R - 3, w.y);
        ctx.moveTo(w.x + R + 3, w.y); ctx.lineTo(w.x + R + 10, w.y);
        ctx.moveTo(w.x, w.y - R - 10); ctx.lineTo(w.x, w.y - R - 3);
        ctx.moveTo(w.x, w.y + R + 3); ctx.lineTo(w.x, w.y + R + 10);
        ctx.stroke();
      }
    }

    const loop = (now) => { draw(now); raf = requestAnimationFrame(loop); };
    const start = () => { if (running || reduceMotion) return; running = true; raf = requestAnimationFrame(loop); };
    const stop = () => { running = false; cancelAnimationFrame(raf); };
    new IntersectionObserver(([e]) => (e.isIntersecting ? start() : stop())).observe(hero);

    hero.addEventListener('pointermove', (e) => {
      if (e.target.closest('a, button, .readout')) return;
      const r = hero.getBoundingClientRect();
      const i = nearest(e.clientX - r.left, e.clientY - r.top);
      if (i !== sel) { sel = i; paintRead(); if (!running) draw(performance.now()); }
      pointerSel = true;
    });
    hero.addEventListener('pointerleave', () => { pointerSel = false; autoTimer = 0; });

    new ResizeObserver(build).observe(hero);
    build();
  })();

  /* ---------- production & R&D carousel ---------- */
  (() => {
    const root = $('[data-carousel]');
    if (!root) return;

    const viewport = $('.viewport', root);
    const track = $('.track', root);
    const slides = $$('.slide', root);
    const tabs = $$('[role="tab"]', root);
    const prev = $('[data-prev]', root);
    const next = $('[data-next]', root);
    const pause = $('[data-pause]', root);
    const count = $('[data-count]', root);

    const DUR = 5600;
    let i = 0, elapsed = 0, playing = !reduceMotion, hold = false, last = performance.now();

    function go(n) {
      i = (n + slides.length) % slides.length;
      elapsed = 0;
      track.style.transform = 'translateX(' + (-100 * i) + '%)';
      slides.forEach((s, k) => { s.setAttribute('aria-hidden', String(k !== i)); s.inert = k !== i; });
      tabs.forEach((t, k) => {
        const on = k === i;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        t.style.setProperty('--p', k < i ? 1 : 0);
      });
      count.textContent = (i + 1) + ' / ' + slides.length;
    }

    function setPlaying(on) {
      playing = on;
      pause.setAttribute('aria-pressed', String(!on));
      pause.setAttribute('aria-label', on ? '자동 재생 일시정지' : '자동 재생 시작');
    }

    function tick(now) {
      const dt = now - last;
      last = now;
      if (playing && !hold && !document.hidden) {
        elapsed += dt;
        tabs[i].style.setProperty('--p', Math.min(1, elapsed / DUR));
        if (elapsed >= DUR) go(i + 1);
      }
      requestAnimationFrame(tick);
    }

    prev.addEventListener('click', () => go(i - 1));
    next.addEventListener('click', () => go(i + 1));
    pause.addEventListener('click', () => setPlaying(!playing));
    tabs.forEach((t, k) => t.addEventListener('click', () => go(k)));

    $('[role="tablist"]', root).addEventListener('keydown', (e) => {
      const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      go(i + d);
      tabs[i].focus();
    });

    root.addEventListener('pointerenter', () => { hold = true; });
    root.addEventListener('pointerleave', () => { hold = false; });
    root.addEventListener('focusin', () => { hold = true; });
    root.addEventListener('focusout', () => { hold = false; });

    let sx = null;
    viewport.addEventListener('pointerdown', (e) => { sx = e.clientX; });
    viewport.addEventListener('pointercancel', () => { sx = null; });
    viewport.addEventListener('pointerup', (e) => {
      if (sx === null) return;
      const dx = e.clientX - sx;
      sx = null;
      if (Math.abs(dx) > 50) go(i + (dx < 0 ? 1 : -1));
    });

    // Slides sit off-screen horizontally, so native lazy loading never reaches them.
    // Load all of them when the carousel is about to scroll into view.
    new IntersectionObserver((entries, io) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      $$('img', root).forEach((img) => { img.loading = 'eager'; });
      io.disconnect();
    }, { rootMargin: '900px 0px' }).observe(root);

    go(0);
    if (reduceMotion) setPlaying(false);
    requestAnimationFrame(tick);
  })();

  /* ---------- product buttons preselect the inquiry form ---------- */
  const form = $('#inquiry');
  $$('a[data-product]').forEach((a) => {
    a.addEventListener('click', () => {
      const sel = form && form.elements.interest;
      if (!sel) return;
      const hit = [...sel.options].find((o) => o.textContent.trim() === a.dataset.product);
      if (hit) sel.value = hit.value || hit.textContent;
    });
  });

  /* ---------- inquiry form opens the visitor's mail app ---------- */
  if (form) {
    const err = $('#form-error');
    const TO = 'sales@yz-micronano.co.kr';

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const f = form.elements;
      const bad = [];
      [f.name, f.email, f.message].forEach((el) => {
        const empty = !el.value.trim();
        const badMail = el === f.email && !empty && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(el.value.trim());
        el.setAttribute('aria-invalid', String(empty || badMail));
        if (empty || badMail) bad.push(el);
      });
      if (bad.length) {
        err.hidden = false;
        err.textContent = bad[0] === f.email && f.email.value.trim()
          ? '이메일 주소 형식을 확인해 주세요.'
          : '성함, 이메일, 문의 내용을 입력해 주세요.';
        bad[0].focus();
        return;
      }
      err.hidden = true;

      const subject = '[홈페이지 문의] ' + f.interest.value + ' / ' + f.name.value.trim();
      const body = [
        '성함: ' + f.name.value.trim(),
        '회사·기관명: ' + f.org.value.trim(),
        '이메일: ' + f.email.value.trim(),
        '연락처: ' + f.tel.value.trim(),
        '관심 분야: ' + f.interest.value,
        '',
        '문의 내용',
        f.message.value.trim()
      ].join('\r\n');

      location.href = 'mailto:' + TO + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
    });

    $$('input, textarea', form).forEach((el) => el.addEventListener('input', () => el.removeAttribute('aria-invalid')));
  }

  /* ---------- map link, year ---------- */
  const map = $('a.map');
  if (map) map.href = 'https://map.naver.com/p/search/' + encodeURIComponent(map.dataset.address);
  const year = $('#year');
  if (year) year.textContent = new Date().getFullYear();
})();
