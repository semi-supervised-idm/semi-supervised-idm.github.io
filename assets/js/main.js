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
