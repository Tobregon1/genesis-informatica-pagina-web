/* ==========================================================================
   0. INICIALIZACIÓN DE TEMA GUARDADO (DARK / LIGHT)
   ========================================================================== */
(function () {
  try {
    var saved = localStorage.getItem("genesis-theme");
    if (saved === "light") {
      document.documentElement.setAttribute("data-theme", "light");
      var m = document.getElementById("metaTheme");
      if (m) m.setAttribute("content", "#eef3f3");
    }
  } catch (_) {}
})();

/* ==========================================================================
   1. CONFIGURACIÓN PRINCIPAL (MISMO BACKEND DE TURNOS)
   ========================================================================== */
const CFG = {
  wa: "5493794775092",
  email: "tobiobregon87@gmail.com",
  webhook: "https://script.google.com/macros/s/AKfycbydOSJArYJH32ZYitd_YQw62VPJqtsOB36RPP3YmptiXSyUxATYSv9wpB2PEksA-N5m/exec",
  slots: ["09:00", "10:00", "11:00", "12:00", "16:00", "17:00", "18:00", "19:00"],
  closed: [0] // 0 = Domingo
};

const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const waURL = text => "https://wa.me/" + CFG.wa + (text ? "?text=" + encodeURIComponent(text) : "");

const defaultWa = waURL("Hola, quiero agendar una cita con Génesis Informática.");
["#wa", "#fab", "#waFinal", "#socWa"].forEach(id => {
  const el = $(id);
  if (el) el.href = defaultWa;
});
const asisWa = $("#asisWa");
if (asisWa) {
  asisWa.href = waURL("Hola, necesito asesoramiento con Génesis Informática.");
  asisWa.target = "_blank";
  asisWa.rel = "noopener noreferrer";
}
["#em", "#socEm"].forEach(id => {
  const el = $(id);
  if (el) el.href = "mailto:" + CFG.email;
});
$("#y").textContent = new Date().getFullYear();

/* ==========================================================================
   2. MOTOR DE FONDO TOPOGRÁFICO EN VIVO (MARCHING SQUARES + 4 LUCES)
   ========================================================================== */
(function initTopoBackground() {
  const canvas = $("#topoCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const mascara = document.createElement("canvas");
  const mctx = mascara.getContext("2d");
  const luces = document.createElement("canvas");
  const lctx = luces.getContext("2d");

  const VELOCIDAD = 0.022;
  const PAR = 0.07;
  const ESC_LUCES = 8;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Tabla de permutación para Value-Noise 3D ultra suave
  const perm = new Uint8Array(512);
  const vals = new Float32Array(256);
  let seed = 1337;
  function rand() {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  }
  for (let i = 0; i < 256; i++) {
    perm[i] = i;
    vals[i] = rand();
  }
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = perm[i];
    perm[i] = perm[j];
    perm[j] = tmp;
  }
  for (let i = 0; i < 256; i++) perm[i + 256] = perm[i];

  function hash3(ix, iy, iz) {
    return vals[perm[(perm[(perm[ix & 255] + (iy & 255)) & 255] + (iz & 255)) & 255]];
  }

  function fade(t) {
    // Smootherstep quíntico (C2 continuo: elimina saltos al cruzar celdas)
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  function noise3(x, y, z) {
    const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
    const u = fade(x - ix);
    const v = fade(y - iy);
    const w = fade(z - iz);

    const n000 = hash3(ix, iy, iz),     n100 = hash3(ix + 1, iy, iz);
    const n010 = hash3(ix, iy + 1, iz), n110 = hash3(ix + 1, iy + 1, iz);
    const n001 = hash3(ix, iy, iz + 1), n101 = hash3(ix + 1, iy, iz + 1);
    const n011 = hash3(ix, iy + 1, iz + 1), n111 = hash3(ix + 1, iy + 1, iz + 1);

    const nx00 = n000 + u * (n100 - n000);
    const nx10 = n010 + u * (n110 - n010);
    const nx01 = n001 + u * (n101 - n001);
    const nx11 = n011 + u * (n111 - n011);

    const nxy0 = nx00 + v * (nx10 - nx00);
    const nxy1 = nx01 + v * (nx11 - nx01);

    return nxy0 + w * (nxy1 - nxy0);
  }

  function fbm(x, y, z) {
    // 2 octavas amplias y sedosas (sin micro-ondulaciones nerviosas)
    return (
      0.72 * noise3(x, y, z) +
      0.28 * noise3(x * 1.92 + 11.3, y * 1.92 + 5.7, z * 0.85)
    );
  }

  let W = 0, H = 0, dpr = 1, cell = 12, cols = 0, rows = 0, grid = new Float32Array(0);
  let smoothScroll = window.scrollY || 0;
  let elapsedSec = 0;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    W = window.innerWidth;
    H = window.innerHeight;
    cell = W < 700 ? 11 : 12;

    canvas.width = mascara.width = Math.ceil(W * dpr);
    canvas.height = mascara.height = Math.ceil(H * dpr);
    luces.width = Math.max(2, Math.ceil(W / ESC_LUCES));
    luces.height = Math.max(2, Math.ceil(H / ESC_LUCES));

    cols = Math.ceil(W / cell) + 2;
    rows = Math.ceil(H / cell) + 2;
    grid = new Float32Array(cols * rows);
  }

  function interp(a, b, level) {
    const d = b - a;
    if (Math.abs(d) < 1e-6) return 0.5;
    return Math.max(0, Math.min(1, (level - a) / d));
  }

  function drawFrame(sec) {
    const isLight = document.documentElement.getAttribute("data-theme") === "light";
    const sc = W < 700 ? 1 / 280 : 1 / 460;
    const targetScroll = window.scrollY || 0;
    smoothScroll += (targetScroll - smoothScroll) * 0.08;
    const yOff = smoothScroll * PAR * sc;
    const z = sec * VELOCIDAD;

    // Evaluar campo escalar
    let idx = 0;
    for (let r = 0; r < rows; r++) {
      const ny = r * cell * sc + yOff;
      for (let c = 0; c < cols; c++) {
        grid[idx++] = fbm(c * cell * sc, ny, z);
      }
    }

    // 1) Trazar isolíneas Marching Squares en la máscara
    mctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    mctx.clearRect(0, 0, W, H);
    mctx.strokeStyle = "#ffffff";
    mctx.lineWidth = 1.2;
    mctx.lineCap = "round";
    mctx.lineJoin = "round";
    mctx.beginPath();

    for (let L = 0.22; L <= 0.82; L += 0.052) {
      for (let r = 0; r < rows - 1; r++) {
        const rowA = r * cols;
        const rowB = rowA + cols;
        const y0 = r * cell;
        const y1 = y0 + cell;
        for (let c = 0; c < cols - 1; c++) {
          const v0 = grid[rowA + c];
          const v1 = grid[rowA + c + 1];
          const v2 = grid[rowB + c + 1];
          const v3 = grid[rowB + c];

          const code =
            (v0 >= L ? 8 : 0) |
            (v1 >= L ? 4 : 0) |
            (v2 >= L ? 2 : 0) |
            (v3 >= L ? 1 : 0);

          if (code === 0 || code === 15) continue;

          const x0 = c * cell;
          const x1 = x0 + cell;
          const tx = x0 + interp(v0, v1, L) * cell;
          const ry = y0 + interp(v1, v2, L) * cell;
          const bx = x0 + interp(v3, v2, L) * cell;
          const ly = y0 + interp(v0, v3, L) * cell;

          switch (code) {
            case 1: case 14:
              mctx.moveTo(x0, ly); mctx.lineTo(bx, y1); break;
            case 2: case 13:
              mctx.moveTo(bx, y1); mctx.lineTo(x1, ry); break;
            case 3: case 12:
              mctx.moveTo(x0, ly); mctx.lineTo(x1, ry); break;
            case 4: case 11:
              mctx.moveTo(tx, y0); mctx.lineTo(x1, ry); break;
            case 5: {
              const avg = (v0 + v1 + v2 + v3) * 0.25;
              if (avg >= L) {
                mctx.moveTo(x0, ly); mctx.lineTo(tx, y0);
                mctx.moveTo(bx, y1); mctx.lineTo(x1, ry);
              } else {
                mctx.moveTo(x0, ly); mctx.lineTo(bx, y1);
                mctx.moveTo(tx, y0); mctx.lineTo(x1, ry);
              }
              break;
            }
            case 6: case 9:
              mctx.moveTo(tx, y0); mctx.lineTo(bx, y1); break;
            case 7: case 8:
              mctx.moveTo(x0, ly); mctx.lineTo(tx, y0); break;
            case 10: {
              const avg = (v0 + v1 + v2 + v3) * 0.25;
              if (avg >= L) {
                mctx.moveTo(x0, ly); mctx.lineTo(bx, y1);
                mctx.moveTo(tx, y0); mctx.lineTo(x1, ry);
              } else {
                mctx.moveTo(x0, ly); mctx.lineTo(tx, y0);
                mctx.moveTo(bx, y1); mctx.lineTo(x1, ry);
              }
              break;
            }
          }
        }
      }
    }
    mctx.stroke();

    // 2) Pintar mapa de iluminación (base + 4 luces orbitantes celeste eléctrico/dorado Génesis)
    const lw = luces.width;
    const lh = luces.height;
    lctx.globalCompositeOperation = "source-over";
    lctx.clearRect(0, 0, lw, lh);
    lctx.fillStyle = isLight ? "rgba(10, 51, 64, 0.12)" : "rgba(180, 224, 240, 0.09)";
    lctx.fillRect(0, 0, lw, lh);

    lctx.globalCompositeOperation = isLight ? "source-over" : "lighter";
    const t = sec * 0.16;
    const lights = [
      { x: lw * (0.22 + 0.14 * Math.sin(t * 0.7)),       y: lh * (0.30 + 0.14 * Math.cos(t * 0.5)),       r: Math.max(lw, lh) * 0.54, col: isLight ? "rgba(10,118,184,0.46)" : "rgba(30,170,255,0.54)" },
      { x: lw * (0.78 + 0.12 * Math.cos(t * 0.6)),       y: lh * (0.24 + 0.14 * Math.sin(t * 0.8)),       r: Math.max(lw, lh) * 0.48, col: isLight ? "rgba(212,148,0,0.42)"  : "rgba(255,197,51,0.48)" },
      { x: lw * (0.72 + 0.15 * Math.sin(t * 0.5 + 2.1)), y: lh * (0.78 + 0.12 * Math.cos(t * 0.6 + 1.2)), r: Math.max(lw, lh) * 0.50, col: isLight ? "rgba(10,51,64,0.40)"   : "rgba(0,200,255,0.46)" },
      { x: lw * (0.28 + 0.12 * Math.cos(t * 0.45 + 3.4)),y: lh * (0.76 + 0.14 * Math.sin(t * 0.55 + 0.7)),r: Math.max(lw, lh) * 0.42, col: isLight ? "rgba(184,124,0,0.32)"  : "rgba(255,175,20,0.34)" }
    ];

    for (const l of lights) {
      const g = lctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r);
      g.addColorStop(0, l.col);
      g.addColorStop(1, "rgba(0,0,0,0)");
      lctx.fillStyle = g;
      lctx.fillRect(0, 0, lw, lh);
    }

    // 3) Componer luces estrictamente dentro de las líneas topográficas
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(mascara, 0, 0);
    ctx.globalCompositeOperation = "source-in";
    ctx.drawImage(luces, 0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = "source-over";
  }

  resize();
  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      resize();
      if (reducedMotion) drawFrame(0);
    }, 140);
  });

  window.__redrawTopo = () => drawFrame(elapsedSec);

  if (reducedMotion) {
    drawFrame(0);
    return;
  }

  let lastTs = 0;
  const FRAME_MS = 1000 / 60;
  function loop(ts) {
    requestAnimationFrame(loop);
    if (document.hidden) {
      lastTs = 0;
      return;
    }
    if (!lastTs) {
      lastTs = ts;
      drawFrame(elapsedSec);
      return;
    }
    const dt = ts - lastTs;
    if (dt < FRAME_MS - 1) return;
    lastTs = ts;
    elapsedSec += Math.min(dt, 50) * 0.001;
    drawFrame(elapsedSec);
  }
  requestAnimationFrame(loop);
})();

/* ==========================================================================
   3. THEME SWITCHER (OSCURO / CLARO CON PERSISTENCIA)
   ========================================================================== */
const themeBtn = $("#themeBtn");
const metaTheme = $("#metaTheme");
themeBtn.addEventListener("click", () => {
  const root = document.documentElement;
  const toLight = root.getAttribute("data-theme") !== "light";
  if (toLight) {
    root.setAttribute("data-theme", "light");
    metaTheme.setAttribute("content", "#eef3f3");
    try { localStorage.setItem("genesis-theme", "light"); } catch (_) {}
  } else {
    root.removeAttribute("data-theme");
    metaTheme.setAttribute("content", "#0a3340");
    try { localStorage.setItem("genesis-theme", "dark"); } catch (_) {}
  }
  if (window.__redrawTopo) window.__redrawTopo();
});

/* ==========================================================================
   4. NAVBAR SCROLL STATE, MENÚ MÓVIL & VOLVER ARRIBA
   ========================================================================== */
const navEl = $("#nav");
const topBtn = $("#toTop");
const burger = $("#burger");
const mobMenu = $("#mobMenu");

function onScroll() {
  const y = window.scrollY;
  navEl.classList.toggle("scrolled", y > 24);
  topBtn.classList.toggle("show", y > 320);
}
window.addEventListener("scroll", onScroll, { passive: true });
onScroll();

topBtn.addEventListener("click", () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
});

burger.addEventListener("click", () => {
  const open = mobMenu.classList.toggle("open");
  burger.setAttribute("aria-expanded", String(open));
});

mobMenu.addEventListener("click", e => {
  if (e.target.closest("a")) {
    mobMenu.classList.remove("open");
    burger.setAttribute("aria-expanded", "false");
  }
});

/* ==========================================================================
   5. REVELADO EN CASCADA AL HACER SCROLL (.rv -> .rv.in)
   ========================================================================== */
const rvNodes = $$(".rv");
if ("IntersectionObserver" in window) {
  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("in");
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08, rootMargin: "0px 0px -30px 0px" });
  rvNodes.forEach(el => io.observe(el));
} else {
  rvNodes.forEach(el => el.classList.add("in"));
}

/* ==========================================================================
   6. SLIDER BENTO ASIMÉTRICO CON AUTO-ROTACIÓN Y PAUSA EN HOVER
   ========================================================================== */
(function initBentoSlider() {
  const track = $("#slTrack");
  const slides = $$("#slTrack .slide");
  const dots = $$("#slDots .sl-dot");
  const prevBtn = $("#slPrev");
  const nextBtn = $("#slNext");
  const shell = $("#slider");
  if (!track || !slides.length) return;

  let cur = 0;
  let timer = null;

  function goTo(index) {
    cur = (index + slides.length) % slides.length;
    track.style.transform = `translate3d(-${cur * 100}%, 0, 0)`;
    slides.forEach((s, i) => s.classList.toggle("on", i === cur));
    dots.forEach((d, i) => d.classList.toggle("on", i === cur));
  }

  function startAuto() {
    stopAuto();
    timer = setInterval(() => goTo(cur + 1), 6500);
  }

  function stopAuto() {
    if (timer) clearInterval(timer);
  }

  prevBtn.addEventListener("click", () => { goTo(cur - 1); startAuto(); });
  nextBtn.addEventListener("click", () => { goTo(cur + 1); startAuto(); });
  dots.forEach(d => d.addEventListener("click", () => {
    goTo(Number(d.dataset.slide));
    startAuto();
  }));

  shell.addEventListener("mouseenter", stopAuto);
  shell.addEventListener("mouseleave", startAuto);

  // Swipe táctil
  let touchX = 0;
  shell.addEventListener("touchstart", e => { touchX = e.touches[0].clientX; stopAuto(); }, { passive: true });
  shell.addEventListener("touchend", e => {
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 45) goTo(dx < 0 ? cur + 1 : cur - 1);
    startAuto();
  }, { passive: true });

  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    startAuto();
  }
})();

/* ==========================================================================
   7. TABS DE CATEGORÍAS DE SERVICIOS
   ========================================================================== */
const tabButtons = $$(".gi-gal-tabs button");
const svcCards = $$("#svcGrid .gi-bs-card");

tabButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    const cat = btn.dataset.cat;
    tabButtons.forEach(b => b.setAttribute("aria-selected", String(b === btn)));
    let delayIdx = 0;
    svcCards.forEach(card => {
      const match = cat === "todos" || card.dataset.cat === cat;
      card.classList.toggle("hidden-card", !match);
      if (match) {
        card.classList.add("in");
        card.classList.remove("anim-in");
        void card.offsetWidth;
        card.style.animationDelay = (delayIdx * 45) + "ms";
        card.classList.add("anim-in");
        delayIdx++;
      }
    });
  });
});

/* ==========================================================================
   8. TRACK DE RESEÑAS ARRASTRABLE CON MOUSE (CLICK & DRAG)
   ========================================================================== */
(function initDragReviews() {
  const track = $("#gi-revs-track");
  if (!track) return;
  let isDown = false, startX = 0, scrollLeft = 0;

  track.addEventListener("mousedown", e => {
    if (e.target.closest("a")) return;
    isDown = true;
    track.classList.add("dragging");
    startX = e.pageX - track.offsetLeft;
    scrollLeft = track.scrollLeft;
  });
  window.addEventListener("mouseup", () => {
    isDown = false;
    track.classList.remove("dragging");
  });
  track.addEventListener("mousemove", e => {
    if (!isDown) return;
    e.preventDefault();
    const x = e.pageX - track.offsetLeft;
    track.scrollLeft = scrollLeft - (x - startX) * 1.4;
  });
})();

/* ==========================================================================
   9. ACORDEÓN DE PREGUNTAS FRECUENTES
   ========================================================================== */
$$(".gi-faq-question").forEach(btn => {
  btn.addEventListener("click", () => {
    const item = btn.closest(".gi-faq-item");
    const willOpen = !item.classList.contains("open");
    item.classList.toggle("open", willOpen);
    btn.setAttribute("aria-expanded", String(willOpen));
  });
});

/* ==========================================================================
   10. PRESELECCIÓN DE SERVICIO AL HACER CLIC EN CUALQUIER TARJETA
   ========================================================================== */
const servicioSelect = $("#servicio");
$$("[data-pick]").forEach(el => {
  el.addEventListener("click", () => {
    const val = el.getAttribute("data-pick");
    if (servicioSelect && val) {
      servicioSelect.value = val;
    }
  });
});

/* ==========================================================================
   11. MODALES LEGALES & FORMULARIO DE TURNOS SEGURO
   ========================================================================== */
$$("[data-modal]").forEach(trigger => {
  trigger.addEventListener("click", () => {
    const dlg = document.getElementById(trigger.getAttribute("data-modal"));
    if (dlg && typeof dlg.showModal === "function") dlg.showModal();
  });
});

$$("dialog.gi-modal").forEach(dlg => {
  dlg.addEventListener("click", e => {
    if (e.target === dlg || e.target.closest("[data-close-modal]")) {
      dlg.close();
    }
  });
});

// Poblar horarios de forma segura (sin innerHTML)
const horaSelect = $("#hora");
const defaultOpt = document.createElement("option");
defaultOpt.value = "";
defaultOpt.textContent = "Elegí un horario";
horaSelect.appendChild(defaultOpt);
CFG.slots.forEach(s => {
  const opt = document.createElement("option");
  opt.value = s;
  opt.textContent = s + " hs";
  horaSelect.appendChild(opt);
});

const now = new Date();
now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
const todayStr = now.toISOString().slice(0, 10);
$("#fecha").min = todayStr;

const COOLDOWN_MS = 60000;

function setStatusError(el, text) {
  el.classList.add("err");
  el.textContent = text;
}

$("#f").addEventListener("submit", async e => {
  e.preventDefault();
  const form = e.target;
  const status = $("#st");
  const submitBtn = form.querySelector('button[type="submit"]');
  const originalBtnText = submitBtn.textContent;
  const raw = Object.fromEntries(new FormData(form));

  status.classList.remove("err");
  status.textContent = "";

  // 1) Freno honeypot anti-bots
  if (String(raw.website || "").trim() !== "") {
    form.reset();
    return;
  }

  // 2) Validaciones seguras de entrada
  const nombre = String(raw.nombre || "").trim().slice(0, 80);
  const telefono = String(raw.telefono || "").trim().slice(0, 30);
  const email = String(raw.email || "").trim().slice(0, 100);
  const servicio = String(raw.servicio || "").trim().slice(0, 60);
  const fecha = String(raw.fecha || "").trim().slice(0, 10);
  const hora = String(raw.hora || "").trim().slice(0, 5);
  const detalle = String(raw.detalle || "").trim().slice(0, 500);

  if (nombre.length < 2) {
    return setStatusError(status, "Ingresá tu nombre y apellido.");
  }
  if (telefono.replace(/\D/g, "").length < 7) {
    return setStatusError(status, "Ingresá un número de WhatsApp válido (al menos 7 dígitos).");
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return setStatusError(status, "Revisá el formato del correo electrónico.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || fecha < todayStr) {
    return setStatusError(status, "Elegí una fecha válida a partir de hoy.");
  }
  if (CFG.closed.includes(new Date(fecha + "T12:00").getDay())) {
    return setStatusError(status, "Los domingos no atendemos. Elegí otra fecha de lunes a sábado.");
  }
  if (!CFG.slots.includes(hora)) {
    return setStatusError(status, "Elegí uno de los horarios disponibles.");
  }
  if (!$("#consentimiento").checked) {
    return setStatusError(status, "Aceptá la Política de Privacidad y los Términos para enviar tu turno.");
  }

  // 3) Protección anti-spam (cooldown de 60 s por sesión)
  try {
    const lastSent = Number(sessionStorage.getItem("gi-last-submit") || "0");
    const remaining = Math.ceil((COOLDOWN_MS - (Date.now() - lastSent)) / 1000);
    if (remaining > 0) {
      return setStatusError(status, `Ya enviaste una solicitud recién. Esperá ${remaining} segundos para volver a intentar.`);
    }
  } catch (_) {}

  submitBtn.disabled = true;
  submitBtn.textContent = "Enviando solicitud...";

  const payload = {
    nombre,
    telefono,
    email,
    servicio,
    fecha,
    hora,
    detalle,
    creado: new Date().toISOString()
  };

  const msg = `Hola, soy ${nombre}. Quiero un turno para ${servicio} el ${fecha} a las ${hora}.${detalle ? " " + detalle : ""}`;

  let sent = false;
  if (CFG.webhook) {
    try {
      await fetch(CFG.webhook, {
        method: "POST",
        mode: "no-cors",
        body: new URLSearchParams(payload)
      });
      sent = true;
      try { sessionStorage.setItem("gi-last-submit", String(Date.now())); } catch (_) {}
    } catch (_) {}
  }

  submitBtn.disabled = false;
  submitBtn.textContent = originalBtnText;

  // Render seguro sin innerHTML (prevención XSS)
  status.textContent = "";
  status.appendChild(document.createTextNode(
    (sent ? "✓ Recibimos tu solicitud. " : "") + "Confirmá tu turno por WhatsApp: "
  ));
  const waLink = document.createElement("a");
  waLink.href = waURL(msg);
  waLink.target = "_blank";
  waLink.rel = "noopener noreferrer";
  waLink.textContent = "enviar mensaje ahora";
  status.appendChild(waLink);
  status.appendChild(document.createTextNode("."));

  if (sent) {
    form.reset();
  }
});
