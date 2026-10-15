/* ============================================================
   MORIMORSELS JDOT — SCRIPT
   ============================================================ */

(function () {
  'use strict';

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const isMobile = () => window.innerWidth < 640;

  /* ================= MOBILE NAV ================= */
  function initMobileNav() {
    const toggle = $('.nav-toggle');
    const links = $('.nav-links');
    if (!toggle || !links) return;

    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      links.classList.toggle('active');
      toggle.textContent = links.classList.contains('active') ? '✕' : '☰';
    });

    $$('a', links).forEach((a) =>
      a.addEventListener('click', () => {
        links.classList.remove('active');
        toggle.textContent = '☰';
      })
    );

    document.addEventListener('click', (e) => {
      if (!links.contains(e.target) && !toggle.contains(e.target)) {
        links.classList.remove('active');
        toggle.textContent = '☰';
      }
    });
  }

  /* ================= SMOOTH SCROLL ================= */
  function initSmoothScroll() {
    $$('a[href^="#"]').forEach((anchor) => {
      anchor.addEventListener('click', (e) => {
        const id = anchor.getAttribute('href');
        if (!id || id === '#') return;
        const target = document.querySelector(id);
        if (!target) return;
        e.preventDefault();
        const offset = $('.navbar')?.offsetHeight || 68;
        window.scrollTo({
          top: target.getBoundingClientRect().top + window.pageYOffset - offset,
          behavior: 'smooth'
        });
      });
    });
  }

  /* ================= SONG FILTER ================= */
  function initSongFilter() {
    const filterBtns = $$('.filter-btn');
    const songRows = $$('.song-row');
    if (!filterBtns.length || !songRows.length) return;

    filterBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const filter = btn.getAttribute('data-filter');
        filterBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');

        songRows.forEach((row) => {
          const type = row.getAttribute('data-type');
          const show = filter === 'all' || type === filter;
          row.style.display = show ? 'grid' : 'none';

          // Also hide/show the details panel
          const details = row.nextElementSibling;
          if (details && details.classList.contains('song-details')) {
            if (!show) details.classList.remove('open');
            const expandBtn = row.querySelector('.song-expand');
            if (expandBtn) expandBtn.classList.remove('open');
          }
        });
      });
    });
  }

  /* ================= SONG EXPAND/COLLAPSE ================= */
  function initSongExpand() {
    const expandBtns = $$('.song-expand');
    if (!expandBtns.length) return;

    expandBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const row = btn.closest('.song-row');
        const details = row.nextElementSibling;
        if (!details || !details.classList.contains('song-details')) return;

        const isOpen = details.classList.contains('open');
        // Close all others
        $$('.song-details.open').forEach((d) => d.classList.remove('open'));
        $$('.song-expand.open').forEach((b) => b.classList.remove('open'));

        if (!isOpen) {
          details.classList.add('open');
          btn.classList.add('open');
        }
      });
    });
  }

  /* ================= PARTICLES ================= */
  function initParticles() {
    const canvas = $('#particles');
    if (!canvas) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      canvas.style.display = 'none';
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let W = 0, H = 0, particles = [], rafId = null, paused = false;
    const COLORS = { main: { r: 139, g: 0, b: 0 }, glow: { r: 100, g: 0, b: 0 }, core: { r: 180, g: 80, b: 80 } };

    function resize() { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; }
    function createParticle(randomY = true) {
      return {
        x: Math.random() * W, y: randomY ? Math.random() * H : H + 10,
        r: Math.random() * 2.2 + 0.4, vx: (Math.random() - 0.5) * 0.35,
        vy: -Math.random() * 0.5 - 0.15, a: Math.random() * 0.5 + 0.2,
        pulse: Math.random() * Math.PI * 2, pulseSpeed: 0.015 + Math.random() * 0.025
      };
    }
    function buildParticles() {
      particles = [];
      const count = isMobile() ? 35 : 90;
      for (let i = 0; i < count; i++) particles.push(createParticle(true));
    }
    function drawParticle(p) {
      p.x += p.vx; p.y += p.vy; p.pulse += p.pulseSpeed;
      if (p.y < -20) { p.y = H + 20; p.x = Math.random() * W; }
      if (p.x < -20) p.x = W + 20;
      if (p.x > W + 20) p.x = -20;
      const pulseFactor = 0.7 + 0.3 * Math.sin(p.pulse);
      const alpha = p.a * pulseFactor;
      const rad = p.r * (1 + 0.4 * Math.sin(p.pulse));
      const { main, glow, core } = COLORS;
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rad * 8);
      grad.addColorStop(0, `rgba(${main.r}, ${main.g}, ${main.b}, ${alpha})`);
      grad.addColorStop(0.4, `rgba(${glow.r}, ${glow.g}, ${glow.b}, ${alpha * 0.3})`);
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(p.x, p.y, rad * 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(${core.r}, ${core.g}, ${core.b}, ${alpha})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, rad, 0, Math.PI * 2); ctx.fill();
    }
    function loop() {
      if (paused) return;
      ctx.clearRect(0, 0, W, H);
      for (let i = 0; i < particles.length; i++) drawParticle(particles[i]);
      rafId = requestAnimationFrame(loop);
    }
    function start() { if (rafId) return; paused = false; loop(); }
    function stop() { paused = true; if (rafId) { cancelAnimationFrame(rafId); rafId = null; } }

    let resizeTimer = null;
    window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { resize(); buildParticles(); }, 200); });
    document.addEventListener('visibilitychange', () => { document.hidden ? stop() : start(); });

    resize(); buildParticles(); start();
  }

  /* ================= NAVBAR SCROLL ================= */
  function initNavScroll() {
    const nav = $('.navbar');
    if (!nav) return;
    let ticking = false;
    function update() {
      if (window.scrollY > 40) {
        nav.style.background = 'rgba(5, 5, 5, 0.92)';
        nav.style.borderBottomColor = 'rgba(179, 0, 0, 0.35)';
      } else {
        nav.style.background = 'rgba(5, 5, 5, 0.65)';
        nav.style.borderBottomColor = 'rgba(139, 0, 0, 0.25)';
      }
      ticking = false;
    }
    window.addEventListener('scroll', () => { if (!ticking) { requestAnimationFrame(update); ticking = true; } });
    update();
  }

  /* ================= FORM ================= */
  function initForm() {
    const form = $('.contact-form');
    if (!form) return;
    const btn = form.querySelector('button[type="submit"]');
    if (!btn) return;
    form.addEventListener('submit', () => {
      const original = btn.textContent;
      btn.textContent = 'Sending...';
      btn.disabled = true;
      setTimeout(() => { btn.textContent = original; btn.disabled = false; }, 5000);
    });
  }

  /* ================= INIT ================= */
  function init() {
    initMobileNav();
    initSmoothScroll();
    initSongFilter();
    initSongExpand();
    initParticles();
    initNavScroll();
    initForm();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();