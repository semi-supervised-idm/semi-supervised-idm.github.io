// Semi-Supervised IDM project page

(() => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Animated overview: Supervised IDM <-> Semi-Supervised IDM ---------- */
  const card = document.getElementById("scene-card");
  if (card) {
    const scene = document.getElementById("scene");
    const toggles = [...card.querySelectorAll("[data-set-state]")];
    const playButton = document.getElementById("scene-play");

    // How long each state stays on screen, including its own build-up animation.
    const HOLD = { sup: 5600, semi: 9000 };
    const FIRST_SWITCH = 2600;

    let playing = !reduceMotion;
    let onScreen = true;
    let timer = null;

    const setState = (state) => {
      card.dataset.state = state;
      toggles.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.setState === state)));
    };

    const schedule = (delay) => {
      clearTimeout(timer);
      if (!playing || !onScreen || document.hidden) return;
      timer = setTimeout(() => {
        setState(card.dataset.state === "sup" ? "semi" : "sup");
        schedule(HOLD[card.dataset.state]);
      }, delay);
    };

    const setPlaying = (value) => {
      playing = value;
      playButton.setAttribute("aria-pressed", String(value));
      schedule(value ? 500 : 0);
    };

    toggles.forEach((b) =>
      b.addEventListener("click", () => {
        setState(b.dataset.setState);
        schedule(HOLD[card.dataset.state]); // show the chosen state, then keep looping
      })
    );
    playButton.addEventListener("click", () => setPlaying(!playing));

    // "Semi-" slides in front of "Supervised IDM": shift by its real rendered width.
    const fitTitle = () => {
      const semi = scene.querySelector(".s-title-semi");
      const width = semi.getComputedTextLength();
      if (width > 0) scene.style.setProperty("--semi-w", `${width.toFixed(1)}px`);
    };
    fitTitle();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitTitle);

    if ("IntersectionObserver" in window) {
      new IntersectionObserver(
        ([entry]) => {
          onScreen = entry.isIntersecting;
          schedule(1200);
        },
        { threshold: 0.15 }
      ).observe(card);
    }
    document.addEventListener("visibilitychange", () => schedule(1200));

    if (reduceMotion) {
      setState("semi"); // show the end result without motion
      playButton.hidden = true;
    } else {
      schedule(FIRST_SWITCH);
    }
  }

  /* ---------- Method figure: one stage at a time, once, when scrolled into view ---------- */
  const methodFigure = document.getElementById("method-figure");
  if (methodFigure) {
    const stage = document.getElementById("method-stage");
    const cards = [...document.querySelectorAll("#method-steps li")];
    const replayButton = document.getElementById("method-replay");

    // Time each stage stays in focus before the next one.
    const HOLD = { 1: 3000, 2: 3200, 3: 5200 };

    // Centre line the pseudo-actions follow, in figure coordinates: out of the frozen teacher,
    // along the dashed arrow, into the student's target slots.
    const ROUTE = [[565, 531], [694, 531], [694, 596], [813, 596]];
    const SPACING = 28; // between neighbouring squares
    const DISTANCE = 257; // covered by each square
    const TRAVEL_DELAY = 650; // Stage 2 appears first
    const TRAVEL_TIME = 1700;

    let timer = null;
    let travelTimer = null;
    let frame = null;
    let started = false;

    const pointAt = (s) => {
      for (let i = 0; i < ROUTE.length - 1; i++) {
        const [x0, y0] = ROUTE[i];
        const [x1, y1] = ROUTE[i + 1];
        const length = Math.abs(x1 - x0) + Math.abs(y1 - y0);
        if (s <= length || i === ROUTE.length - 2) {
          const t = Math.min(s / length, 1);
          return [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t];
        }
        s -= length;
      }
    };
    const easeInOut = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);

    const stopTravel = () => {
      clearTimeout(travelTimer);
      cancelAnimationFrame(frame);
      const group = methodFigure.querySelector(".mf-travel");
      if (group) group.style.opacity = 0;
    };

    // The three squares leave the teacher as a train, turn the two corners one after another,
    // and stop exactly on the target slots, which then take over.
    const sendPseudoActions = () => {
      const group = methodFigure.querySelector(".mf-travel");
      const squares = [...group.querySelectorAll("rect")];
      const place = (distance) =>
        squares.forEach((square, k) => {
          const [x, y] = pointAt(k * SPACING + distance);
          square.setAttribute("x", (x - 11).toFixed(2));
          square.setAttribute("y", (y - 11).toFixed(2));
        });
      place(0);
      group.style.opacity = 1;
      const t0 = performance.now();
      const tick = (now) => {
        const u = Math.min((now - t0) / TRAVEL_TIME, 1);
        place(DISTANCE * easeInOut(u));
        if (u < 1) {
          frame = requestAnimationFrame(tick);
          return;
        }
        methodFigure.classList.add("landed");
        group.style.opacity = 0;
      };
      frame = requestAnimationFrame(tick);
    };

    const mark = (step) => cards.forEach((c) => c.classList.toggle("is-active", c.dataset.step === String(step)));

    // Show `step`, then continue through the remaining stages to the complete figure.
    const run = (step) => {
      clearTimeout(timer);
      stopTravel();
      methodFigure.classList.remove("landed");
      methodFigure.dataset.step = step;
      mark(step);
      if (step === 3) travelTimer = setTimeout(sendPseudoActions, TRAVEL_DELAY);
      timer =
        step === "done"
          ? setTimeout(() => mark(null), 2600)
          : setTimeout(() => run(step < 3 ? step + 1 : "done"), HOLD[step]);
    };

    // Restart from the faint outline so the chosen stage fades in again.
    const playFrom = (step) => {
      clearTimeout(timer);
      stopTravel();
      methodFigure.classList.add("no-anim");
      methodFigure.dataset.step = "0";
      void methodFigure.getBoundingClientRect(); // apply the reset before animating
      methodFigure.classList.remove("no-anim");
      started = true;
      run(step);
    };

    const init = () => {
      if (reduceMotion) return; // the complete figure, without motion

      methodFigure.classList.add("no-anim");
      methodFigure.dataset.step = "0";
      void methodFigure.getBoundingClientRect();
      methodFigure.classList.remove("no-anim");

      cards.forEach((card) => {
        const step = Number(card.dataset.step);
        if (!step) return; // the last card describes the result, not a stage
        card.tabIndex = 0;
        card.setAttribute("role", "button");
        card.setAttribute("aria-label", `Replay step ${step}: ${card.querySelector("h3").textContent}`);
        card.addEventListener("click", () => playFrom(step));
        card.addEventListener("keydown", (event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          playFrom(step);
        });
      });
      replayButton.hidden = false;
      replayButton.addEventListener("click", () => playFrom(1));

      if (!("IntersectionObserver" in window)) return playFrom(1);
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (!entry.isIntersecting || started) return;
          observer.disconnect();
          playFrom(1);
        },
        { threshold: 0.45 }
      );
      observer.observe(stage);
    };

    // Swap the static image for the layered SVG. If that fails, the image simply stays.
    fetch("assets/img/method.svg")
      .then((response) => (response.ok ? response.text() : Promise.reject(new Error(response.status))))
      .then((svg) => {
        stage.innerHTML = svg;
        init();
      })
      .catch(() => {});
  }

  /* ---------- Result video filter ---------- */
  const gallery = document.getElementById("gallery");
  const filterButtons = [...document.querySelectorAll("[data-filter]")].filter((el) => el.tagName === "BUTTON");
  filterButtons.forEach((b) =>
    b.addEventListener("click", () => {
      gallery.dataset.filter = b.dataset.filter;
      filterButtons.forEach((o) => o.setAttribute("aria-pressed", String(o === b)));
    })
  );

  /* ---------- Copy BibTeX ---------- */
  const copyButton = document.getElementById("copy-bib");
  if (copyButton) {
    copyButton.addEventListener("click", async () => {
      const text = document.getElementById("bib").innerText;
      try {
        await navigator.clipboard.writeText(text);
        copyButton.textContent = "Copied";
      } catch {
        const range = document.createRange();
        range.selectNodeContents(document.getElementById("bib"));
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        copyButton.textContent = "Selected";
      }
      setTimeout(() => (copyButton.textContent = "Copy"), 1600);
    });
  }

  /* ---------- Fade sections in as they scroll into view ---------- */
  const revealItems = document.querySelectorAll(".reveal-up");
  if (reduceMotion || !("IntersectionObserver" in window)) {
    revealItems.forEach((el) => el.classList.add("is-in"));
  } else {
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-in");
          observer.unobserve(entry.target);
        }),
      { rootMargin: "0px 0px -8% 0px" }
    );
    revealItems.forEach((el) => observer.observe(el));
  }
})();
