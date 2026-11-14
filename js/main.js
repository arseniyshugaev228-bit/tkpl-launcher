// TKPL Launcher — скрипты сайта
// Анимации на Motion (motion.dev). Если CDN недоступен, сайт работает и без анимаций.

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = window.matchMedia("(pointer: fine)").matches;
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const EASE = [0.16, 1, 0.3, 1];

/* ---------- навигация: подложка и автоскрытие ---------- */
const nav = $("#nav");
let lastY = window.scrollY;
const onScroll = () => {
  const y = window.scrollY;
  nav.classList.toggle("is-scrolled", y > 24);
  if (!reduceMotion) nav.classList.toggle("is-hidden", y > lastY && y > 400);
  lastY = y;
};
onScroll();
window.addEventListener("scroll", onScroll, { passive: true });
nav.addEventListener("focusin", () => nav.classList.remove("is-hidden"));

/* ---------- пиксельный пейзаж в баннере макета ---------- */
drawTerrain($("#terrain"));

function drawTerrain(canvas) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const B = 8;
  const cols = canvas.width / B;
  const rows = canvas.height / B;

  const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, "#14324a");
  sky.addColorStop(1, "#4f8c86");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#fff4c2";
  ctx.fillRect(31 * B, 2 * B, 3 * B, 3 * B);
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  [[4, 2, 5], [6, 1, 2], [18, 3, 6], [20, 2, 3]].forEach(([x, y, w]) => ctx.fillRect(x * B, y * B, w * B, B));

  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  const ground = [];
  for (let x = 0; x < cols; x++) {
    ground.push(9 + Math.round(Math.sin(x / 4.2) * 1.6 + Math.sin(x / 1.9 + 1) * 0.8));
  }
  for (let x = 0; x < cols; x++) {
    for (let y = ground[x]; y < rows; y++) {
      const depth = y - ground[x];
      let c;
      if (depth === 0) c = rand() > 0.5 ? "#3dff7a" : "#33d966";
      else if (depth < 3) c = rand() > 0.5 ? "#6b4428" : "#5c3a22";
      else c = rand() > 0.5 ? "#6d746f" : "#5d635f";
      ctx.fillStyle = c;
      ctx.fillRect(x * B, y * B, B, B);
    }
  }
  [6, 23, 36].forEach((x) => {
    const top = ground[x];
    ctx.fillStyle = "#5c3a22";
    ctx.fillRect(x * B, (top - 3) * B, B, 3 * B);
    ctx.fillStyle = "#1f8a42";
    ctx.fillRect((x - 1) * B, (top - 6) * B, 3 * B, 3 * B);
    ctx.fillStyle = "#26a650";
    ctx.fillRect(x * B, (top - 7) * B, B, B);
  });
}

/* ---------- живая установка в макете лаунчера ---------- */
const pctEl = $(".js-pct");
const fillEl = $(".js-fill");
const stepEl = $(".js-step");
const playBtn = $(".js-playbtn");
const steps = [
  [0, "Скачиваем клиент…"],
  [22, "Скачиваем библиотеки…"],
  [55, "Скачиваем ресурсы…"],
  [82, "Ставим Fabric Loader…"],
  [96, "Почти готово…"],
];
let wasDone = false;

function setProgress(p) {
  pctEl.textContent = `${Math.round(p)}%`;
  fillEl.style.transform = `scaleX(${p / 100})`;
  const step = steps.filter(([at]) => p >= at).pop();
  const done = p >= 100;
  if (step) stepEl.textContent = done ? "Установлено. Можно играть" : step[1];
  playBtn.textContent = done ? "ИГРАТЬ" : "УСТАНОВИТЬ";
  if (done && !wasDone) window.dispatchEvent(new Event("tkpl:installed"));
  wasDone = done;
}

if (reduceMotion) {
  setProgress(100);
} else {
  const DURATION = 6000;
  const HOLD = 2800;
  let start = performance.now();
  const loop = (now) => {
    const t = now - start;
    if (t < DURATION) {
      const x = t / DURATION;
      setProgress(Math.min(100, (x + Math.sin(x * 9) * 0.03) * 100));
    } else if (t < DURATION + HOLD) {
      setProgress(100);
    } else {
      start = now;
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

/* ---------- наклон окна за курсором ---------- */
const app = $("#app");
const visual = $(".hero__visual");
if (!reduceMotion && finePointer) {
  visual.addEventListener("pointermove", (e) => {
    const r = visual.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    app.style.setProperty("--ry", `${-10 + x * 12}deg`);
    app.style.setProperty("--rx", `${4 - y * 8}deg`);
  });
  visual.addEventListener("pointerleave", () => {
    app.style.removeProperty("--ry");
    app.style.removeProperty("--rx");
  });
}

/* ---------- плитки: наклон за курсором ---------- */
if (!reduceMotion && finePointer) {
  $$("[data-tilt]").forEach((tile) => {
    tile.addEventListener("pointermove", (e) => {
      const r = tile.getBoundingClientRect();
      const rx = ((e.clientY - r.top) / r.height - 0.5) * -6;
      const ry = ((e.clientX - r.left) / r.width - 0.5) * 6;
      tile.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg) translateZ(0)`;
    });
    tile.addEventListener("pointerleave", () => { tile.style.transform = ""; });
  });
}

/* ---------- кнопки-магниты ---------- */
if (!reduceMotion && finePointer) {
  $$(".js-magnet").forEach((btn) => {
    btn.addEventListener("pointermove", (e) => {
      const r = btn.getBoundingClientRect();
      const x = (e.clientX - r.left - r.width / 2) * 0.25;
      const y = (e.clientY - r.top - r.height / 2) * 0.35;
      btn.style.transform = `translate(${x}px, ${y - 2}px)`;
    });
    btn.addEventListener("pointerleave", () => { btn.style.transform = ""; });
  });
}

/* ---------- сборки по очереди подсвечиваются ---------- */
const builds = $$(".mini-builds li");
if (builds.length && !reduceMotion) {
  let i = 0;
  builds[0].classList.add("is-active");
  setInterval(() => {
    builds[i].classList.remove("is-active");
    i = (i + 1) % builds.length;
    builds[i].classList.add("is-active");
  }, 1800);
}

/* ---------- частицы в первом экране ---------- */
const hero = $(".hero");
if (!reduceMotion) startParticles($("#particles"), hero);

function startParticles(canvas, area) {
  const ctx = canvas.getContext("2d");
  let w = 0, h = 0, dpr = 1, running = true, parts = [];

  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = area.clientWidth;
    h = area.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.round(Math.min(60, w / 22));
    parts = Array.from({ length: count }, () => spawn(true));
  };
  const spawn = (anywhere) => ({
    x: Math.random() * w,
    y: anywhere ? Math.random() * h : h + 10,
    s: 2 + Math.floor(Math.random() * 3) * 2,          // 2, 4 или 6 px — «пиксели»
    v: 0.15 + Math.random() * 0.45,
    drift: (Math.random() - 0.5) * 0.25,
    a: 0.15 + Math.random() * 0.5,
    phase: Math.random() * Math.PI * 2,
  });

  const tick = (t) => {
    if (!running) return;
    ctx.clearRect(0, 0, w, h);
    for (const p of parts) {
      p.y -= p.v;
      p.x += p.drift + Math.sin(t / 1400 + p.phase) * 0.15;
      if (p.y < -10) Object.assign(p, spawn(false));
      const twinkle = 0.6 + Math.sin(t / 500 + p.phase) * 0.4;
      ctx.fillStyle = `rgba(61,255,122,${p.a * twinkle})`;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s);
    }
    requestAnimationFrame(tick);
  };

  resize();
  window.addEventListener("resize", resize);
  // не тратим кадры, когда первый экран не виден
  new IntersectionObserver(([entry]) => {
    const wasRunning = running;
    running = entry.isIntersecting;
    if (running && !wasRunning) requestAnimationFrame(tick);
  }).observe(area);
  requestAnimationFrame(tick);
}

/* ---------- разбивка заголовков на слова и буквы ---------- */
function splitText(el, mode) {
  if (!el.hasAttribute("aria-label")) el.setAttribute("aria-label", el.innerText.replace(/\s+/g, " ").trim());
  const walk = (node) => {
    [...node.childNodes].forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        const frag = document.createDocumentFragment();
        child.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.append(" "); return; }
          const word = document.createElement("span");
          word.className = "word";
          word.setAttribute("aria-hidden", "true");
          if (mode === "chars") {
            [...part].forEach((ch) => {
              const c = document.createElement("span");
              c.className = "char";
              c.textContent = ch;
              word.append(c);
            });
          } else {
            word.textContent = part;
          }
          frag.append(word);
        });
        child.replaceWith(frag);
      } else if (child.nodeType === Node.ELEMENT_NODE && child.tagName !== "BR") {
        walk(child);
      }
    });
  };
  walk(el);
  return mode === "chars" ? $$(".char", el) : $$(".word", el);
}

/* ---------- конфетти из блоков ---------- */
function burst(x, y, animate) {
  const layer = $("#burst-layer");
  const colors = ["#3dff7a", "#2fd062", "#6b4428", "#5c3a22", "#e8f0ea"];
  for (let i = 0; i < 28; i++) {
    const b = document.createElement("i");
    b.style.left = `${x}px`;
    b.style.top = `${y}px`;
    b.style.background = colors[i % colors.length];
    const size = 6 + Math.round(Math.random() * 3) * 3;
    b.style.width = b.style.height = `${size}px`;
    layer.append(b);
    const angle = Math.random() * Math.PI * 2;
    const dist = 80 + Math.random() * 180;
    animate(
      b,
      {
        x: [0, Math.cos(angle) * dist, Math.cos(angle) * dist * 1.1],
        y: [0, Math.sin(angle) * dist - 60, Math.sin(angle) * dist + 220],
        rotate: [0, (Math.random() - 0.5) * 540],
        opacity: [1, 1, 0],
      },
      { duration: 1.3 + Math.random() * 0.5, ease: "easeOut" }
    ).then(() => b.remove());
  }
}
let motionAnimate = null;

/* ---------- Motion ---------- */
if (!reduceMotion) {
  import("https://cdn.jsdelivr.net/npm/motion@11.11.13/+esm")
    .then(({ animate, inView, scroll, stagger }) => {
      motionAnimate = animate;
      document.documentElement.classList.add("motion-ready");

      // заголовок первого экрана — буквы выкатываются по одной
      const chars = splitText($("#hero-title"), "chars");
      animate(
        chars,
        { opacity: [0, 1], y: ["0.6em", "0em"], rotateX: [-80, 0], filter: ["blur(8px)", "blur(0px)"] },
        { duration: 0.8, delay: stagger(0.035, { startDelay: 0.15 }), ease: EASE }
      );

      // заголовки секций — слова поднимаются лесенкой
      $$(".section-head h2, .pain h2, .feedback__copy h2, .final h2").forEach((h) => {
        h.removeAttribute("data-reveal");
        const words = splitText(h, "words");
        words.forEach((w) => (w.style.opacity = 0));
        inView(h, () => {
          animate(words, { opacity: [0, 1], y: [40, 0], rotate: [4, 0] }, { duration: 0.9, delay: stagger(0.07), ease: EASE });
        }, { amount: 0.4 });
      });

      // всё остальное — плавное появление лесенкой
      $$("[data-reveal]").forEach((el) => {
        const siblings = [...el.parentElement.children].filter((n) => n.hasAttribute("data-reveal"));
        const delay = Math.min(siblings.indexOf(el), 6) * 0.09;
        inView(el, () => {
          animate(el, { opacity: [0, 1], y: [36, 0], scale: [0.97, 1] }, { duration: 0.9, delay, ease: EASE });
        }, { amount: 0.15 });
      });

      // макет лаунчера выезжает с разворотом
      animate($("[data-reveal-visual]"),
        { opacity: [0, 1], scale: [0.85, 1], y: [80, 0], rotateY: [-25, 0] },
        { duration: 1.4, delay: 0.3, ease: EASE });

      // парящие блоки
      $$(".cube").forEach((cube, i) => {
        animate(cube, { scale: [0, 1] }, { type: "spring", stiffness: 260, damping: 14, delay: 0.9 + i * 0.15 });
        animate(cube,
          { y: [0, -18, 0], rotate: [0, i % 2 ? 8 : -8, 0] },
          { duration: 4 + i * 0.9, delay: i * 0.4, repeat: Infinity, ease: "easeInOut" });
      });

      // кнопка «Играть» в макете подпрыгивает, когда установка закончилась
      window.addEventListener("tkpl:installed", () => {
        animate(playBtn, { scale: [1, 1.18, 1] }, { type: "spring", stiffness: 400, damping: 10 });
      });

      // параллакс первого экрана
      const cubes = $$(".cube");
      scroll((p) => {
        app.style.setProperty("--py", `${p * -90}px`);
        cubes.forEach((c, i) => c.style.setProperty("--py", `${p * -(160 + i * 90)}px`));
      }, { target: hero, offset: ["start start", "end start"] });

      // счётчики
      $$(".js-count").forEach((el) => {
        const to = parseFloat(el.dataset.to);
        const dec = Number(el.dataset.dec || 0);
        el.textContent = (0).toFixed(dec);
        inView(el, () => {
          animate(0, to, { duration: 1.8, ease: EASE, onUpdate: (v) => (el.textContent = v.toFixed(dec)) });
        });
      });

      // бегущая строка
      animate($("#marquee"), { x: ["0%", "-50%"] }, { duration: 38, repeat: Infinity, ease: "linear" });

      // боль → решение: красный крестик переворачивается в зелёную галочку,
      // под проблемой выезжает, как TKPL её решает
      const painItems = $$(".pain__item");
      const answer = $("#pain-answer");
      inView($(".pain__list"), () => {
        painItems.forEach((li, i) => {
          const at = 1 + i * 0.55;
          const icon = $(".pain__icon", li);
          animate(icon, { rotateY: [0, 90] }, { duration: 0.18, delay: at, ease: "easeIn" }).then(() => {
            li.classList.add("is-solved");
            animate(icon, { rotateY: [-90, 0], scale: [1, 1.25, 1] }, { type: "spring", stiffness: 420, damping: 14 });
          });
          animate($(".pain__fix", li), { opacity: [0, 1], x: [-16, 0] }, { duration: 0.6, delay: at + 0.12, ease: EASE });
        });
        animate(answer,
          { opacity: [0, 1], y: [24, 0], scale: [0.9, 1] },
          { type: "spring", stiffness: 300, damping: 18, delay: 1 + painItems.length * 0.55 + 0.1 });
      }, { amount: 0.4 });

      // чипы загрузчиков выпрыгивают
      const chips = $$(".chips li");
      chips.forEach((c) => (c.style.opacity = 0));
      inView($(".chips"), () => {
        animate(chips, { opacity: [0, 1], scale: [0.4, 1], y: [20, 0] },
          { type: "spring", stiffness: 380, damping: 16, delay: stagger(0.08, { startDelay: 0.3 }) });
      });

      // иконки плиток
      $$(".tile__ico").forEach((ico) => {
        inView(ico, () => {
          animate(ico, { rotate: [-90, 0], scale: [0, 1] }, { type: "spring", stiffness: 260, damping: 15, delay: 0.25 });
        });
      });

      // шаги: линия заполняется при скролле, номера загораются
      const stepFill = $("#steps-fill");
      const stepNums = $$(".step__num");
      scroll((p) => {
        stepFill.style.transform = `scaleX(${p})`;
        stepNums.forEach((n, i) => n.classList.toggle("is-lit", p >= (i + 0.15) / stepNums.length));
      }, { target: $(".steps"), offset: ["start 85%", "end 55%"] });

      // финал: блоки земли падают сверху
      const ground = $("#final-ground");
      const fillGround = () => {
        ground.innerHTML = "";
        const n = Math.ceil(window.innerWidth / 64) + 1;
        for (let i = 0; i < n; i++) {
          const g = document.createElement("span");
          g.className = "gblock";
          g.style.opacity = 0;
          ground.append(g);
        }
        return $$(".gblock", ground);
      };
      const blocks = fillGround();
      inView($(".final"), () => {
        blocks.forEach((b) => {
          animate(b, { opacity: [0, 1], y: [-500, 0] },
            { type: "spring", stiffness: 220, damping: 18, delay: 0.1 + Math.random() * 0.9 });
        });
      }, { amount: 0.3 });
    })
    .catch(() => {
      document.documentElement.classList.remove("motion-ready");
    });
}

/* ---------- форма обратной связи ---------- */
const form = $("#feedback-form");
const statusEl = $("#f-status");
const submitBtn = $("#f-submit");

function setError(id, text) {
  const input = document.getElementById(id);
  const err = document.getElementById(`${id}-err`);
  input.closest(".field").classList.toggle("has-error", Boolean(text));
  input.setAttribute("aria-invalid", text ? "true" : "false");
  if (text) input.setAttribute("aria-describedby", `${id}-err`);
  err.textContent = text || "";
  if (text && motionAnimate) motionAnimate(input, { x: [0, -8, 8, -5, 5, 0] }, { duration: 0.4 });
}

// На GitHub Pages нет Python-сервера, поэтому там отзывы уходят через Web3Forms.
// Локально (python py/server.py) форма по-прежнему шлёт их на /api/feedback.
// Ключ берётся на web3forms.com, он публичный по задумке сервиса.
const WEB3FORMS_KEY = "e3db0de3-7fb1-4ffb-b0c1-e92e013af4af";
const USE_WEB3FORMS = location.hostname.endsWith("github.io");

function validate(data) {
  let ok = true;
  if (data.name.length < 2) { setError("f-name", "Напиши ник, хотя бы 2 символа"); ok = false; }
  else setError("f-name", "");
  if (data.message.length < 5) { setError("f-message", "Сообщение слишком короткое"); ok = false; }
  else setError("f-message", "");
  return ok;
}

["f-name", "f-message"].forEach((id) =>
  document.getElementById(id).addEventListener("input", () => setError(id, ""))
);

function setStatus(text, kind) {
  statusEl.textContent = text;
  statusEl.className = `form__status ${kind ? `is-${kind}` : ""}`;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(form);
  const data = {
    name: String(fd.get("name") || "").trim(),
    contact: String(fd.get("contact") || "").trim(),
    rating: fd.get("rating") ? Number(fd.get("rating")) : null,
    message: String(fd.get("message") || "").trim(),
    website: String(fd.get("website") || ""),
  };

  if (!validate(data)) {
    form.querySelector('[aria-invalid="true"]')?.focus();
    return;
  }

  if (data.website) return; // ловушка для ботов

  if (USE_WEB3FORMS && !WEB3FORMS_KEY) {
    setStatus("Форма скоро заработает, загляни чуть позже.", "err");
    return;
  }

  if (!USE_WEB3FORMS && location.protocol === "file:") {
    setStatus("Форма работает, только когда сайт запущен через сервер (py/server.py).", "err");
    return;
  }

  submitBtn.disabled = true;
  submitBtn.querySelector(".btn__label").textContent = "Отправляем…";
  setStatus("", "");

  try {
    let ok, errorText;
    if (USE_WEB3FORMS) {
      const res = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          access_key: WEB3FORMS_KEY,
          subject: `Отзыв о TKPL Launcher от ${data.name}`,
          from_name: "Сайт TKPL Launcher",
          "Ник": data.name,
          "Контакт": data.contact || "—",
          "Оценка": data.rating ? `${data.rating} из 5` : "—",
          "Сообщение": data.message,
        }),
      });
      const json = await res.json().catch(() => ({}));
      ok = res.ok && json.success;
      errorText = json.message;
    } else {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json().catch(() => ({}));
      ok = res.ok && json.ok;
      errorText = json.error;
    }
    if (!ok) throw new Error(errorText || "Не получилось отправить. Попробуй ещё раз.");
    form.reset();
    setStatus("Спасибо! Сообщение улетело автору.", "ok");
    if (motionAnimate) {
      const r = submitBtn.getBoundingClientRect();
      burst(r.left + r.width / 2, r.top + r.height / 2, motionAnimate);
    }
  } catch (err) {
    const offline = err instanceof TypeError;
    setStatus(offline ? "Нет связи с сервером. Попробуй позже." : err.message, "err");
  } finally {
    submitBtn.disabled = false;
    submitBtn.querySelector(".btn__label").textContent = "Отправить";
  }
});
