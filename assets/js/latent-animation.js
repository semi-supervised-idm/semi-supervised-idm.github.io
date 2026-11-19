// Each point connects the same sample in independently fitted final embeddings.
// Intermediate positions are a visual interpolation, never training checkpoints.
(() => {
  const figure = document.getElementById("latent-figure");
  if (!figure) return;
  const root = document.getElementById("latent-animation");
  const staticPlots = document.getElementById("latent-static");
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const buttons = [...root.querySelectorAll("[data-latent-state]")];
  const play = document.getElementById("latent-play");
  const title = document.getElementById("latent-stage-title");
  const description = document.getElementById("latent-stage-description");
  const status = document.getElementById("latent-status");
  const canvases = [...root.querySelectorAll("canvas")];
  let data, contexts;
  let position = 0, startPosition = 0, target = 1;
  let elapsed = 0, delay = 1400, duration = 3000;
  let running = false, started = false, visible = false;
  let frame = null, lastTime = null;
  const ease = (t) => t * t * (3 - 2 * t);

  function draw() {
    canvases.forEach((canvas, panel) => {
      const ctx = contexts[panel];
      const width = canvas.clientWidth, height = canvas.clientHeight;
      const side = Math.min(width, height) - 16;
      const ox = (width - side) / 2, oy = (height - side) / 2;
      ctx.clearRect(0, 0, width, height);
      const { teacher, student } = data.views[panel];
      // Retain the original interleaved draw order so neither domain hides the other.
      const radius = Math.max(1.35, side * 0.006);
      ctx.globalAlpha = 0.85;
      for (let i = 0; i < data.pointCount; i++) {
        const a = teacher.points[i], b = student.points[i];
        const x = a[0] + (b[0] - a[0]) * position;
        const y = a[1] + (b[1] - a[1]) * position;
        ctx.fillStyle = data.domains[i] ? "#9ebadc" : "#f2cc5b";
        ctx.beginPath();
        ctx.arc(ox + x * side, oy + y * side, radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    });
  }

  function resize() {
    if (!data) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvases.forEach((canvas, i) => {
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
      contexts[i].setTransform(dpr, 0, 0, dpr, 0, 0);
    });
    draw();
  }

  function label(state) {
    const endpoint = state === 0 || state === 1;
    figure.dataset.latentState = endpoint ? (state === 0 ? "teacher" : "student") : "transition";
    buttons.forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.latentState) === state)));
    root.querySelectorAll("[data-latent-metric]").forEach((el) => {
      el.classList.toggle("is-active", Number(el.dataset.latentMetric) === state);
    });
    title.textContent = state === 0 ? "Trained on robot data only"
      : state === 1 ? "Co-trained on robot and human data" : "From teacher to student";
    description.textContent = state === 0 ? "Human and robot latents remain more separated."
      : state === 1 ? "The two domains are more mixed for matched actions."
        : "Comparing representations of the same human and robot windows.";
    if (!endpoint && target === 0) title.textContent = "Returning to the teacher";
    status.textContent = endpoint ? `${state === 0 ? "Teacher" : "Student"} embeddings` : "Visual transition between models";
    canvases.forEach((canvas, i) => canvas.setAttribute("aria-label",
      `${data.views[i].label} ${endpoint ? (state === 0 ? "teacher" : "student") : "teacher-to-student transition"} t-SNE of human and robot latents`));
  }

  function updatePlay() {
    play.textContent = running ? "Pause animation" : position > 0 && position < 1 ? "Resume animation" : "Replay animation";
  }

  function stopFrame() {
    cancelAnimationFrame(frame);
    frame = null;
    lastTime = null;
  }

  function schedule() {
    stopFrame();
    if (running && visible && !document.hidden) frame = requestAnimationFrame(tick);
  }

  function tick(now) {
    if (lastTime !== null) elapsed += Math.min(now - lastTime, 80);
    lastTime = now;
    if (elapsed >= delay) {
      const t = Math.min((elapsed - delay) / duration, 1);
      if (figure.dataset.latentState !== "transition" && t < 1) label(null);
      position = startPosition + (target - startPosition) * ease(t);
      draw();
      if (t === 1) {
        running = false;
        label(target);
        updatePlay();
        stopFrame();
        return;
      }
    }
    frame = requestAnimationFrame(tick);
  }

  function go(to, hold = 0) {
    started = true;
    target = to;
    startPosition = position;
    elapsed = 0;
    delay = hold;
    duration = Math.max(500, 3000 * Math.abs(target - position));
    if (motion.matches || position === target) {
      running = false;
      position = target;
      label(target);
      draw();
    } else {
      running = true;
      if (!hold) label(null);
    }
    updatePlay();
    schedule();
  }

  function replay() {
    position = 0;
    label(0);
    draw();
    go(1, 1400);
  }

  async function init() {
    try {
      const response = await fetch("assets/data/latent-animation.json");
      if (!response.ok) throw new Error("Latent data unavailable");
      data = await response.json();
      contexts = canvases.map((canvas) => canvas.getContext("2d"));
      if (contexts.some((ctx) => !ctx)) throw new Error("Canvas unavailable");
      root.hidden = false;
      resize();
      position = motion.matches ? 1 : 0;
      label(position);
      draw();
      // Keep the original image visible if data or canvas initialization fails.
      staticPlots.open = false;
      figure.classList.add("latent-ready");
      buttons.forEach((button) => button.addEventListener("click", () => go(Number(button.dataset.latentState))));
      play.addEventListener("click", () => {
        if (running) {
          running = false;
          stopFrame();
        } else if (position > 0 && position < 1) {
          running = true;
          schedule();
        } else replay();
        updatePlay();
      });
      if ("ResizeObserver" in window) new ResizeObserver(resize).observe(root);
      else window.addEventListener("resize", resize);
      document.addEventListener("visibilitychange", schedule);
      motion.addEventListener("change", () => {
        if (motion.matches) go(1);
      });
      if ("IntersectionObserver" in window) {
        new IntersectionObserver(([entry]) => {
          visible = entry.isIntersecting;
          if (visible && !started && !motion.matches) replay();
          else schedule();
        }, { threshold: 0.15 }).observe(root);
      } else {
        visible = true; // Still usable manually without scroll observation.
      }
    } catch {
      stopFrame();
      root.hidden = true;
      staticPlots.open = true;
      figure.classList.remove("latent-ready");
    }
  }

  // Do not load the point data until the analysis section is near the viewport.
  if ("IntersectionObserver" in window) {
    const loader = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      loader.disconnect();
      init();
    }, { rootMargin: "500px 0px" });
    loader.observe(figure);
  } else init();
})();
