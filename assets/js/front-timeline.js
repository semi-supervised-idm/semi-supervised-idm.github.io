// Video time is the only clock: sample i belongs to encoded frame i at 10 Hz.
(() => {
  const root = document.getElementById('front-timeline');
  if (!root) return;
  const video = document.getElementById('ft-video');
  const play = document.getElementById('ft-play');
  const seek = document.getElementById('ft-seek');
  const clock = document.getElementById('ft-clock');
  const badge = document.getElementById('ft-badge');
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const tabs = [...root.querySelectorAll('[data-front-case]')];
  const ns = 'http://www.w3.org/2000/svg';
  const chartSpecs = [
    { id: 'ft-feature-chart', field: 'features', max: 150, ticks: [0, 50, 100, 150], color: '#3a6bd8' },
    { id: 'ft-front-chart', field: 'front', max: 35, ticks: [0, 10, 20, 30], color: '#c14e3d' },
  ];
  let dataset, current, charts = [], visible = false, started = false;
  let raf = null, videoFrame = null;
  const x = (time) => 42 + time / 15 * 442;
  const y = (value, max) => 142 - value / max * 126;

  function svgElement(tag, attributes, parent, text) {
    const node = document.createElementNS(ns, tag);
    Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
    if (text !== undefined) node.textContent = text;
    parent.appendChild(node);
    return node;
  }

  function buildChart(spec) {
    const svg = document.getElementById(spec.id);
    svg.replaceChildren();
    const defs = svgElement('defs', {}, svg);
    const clip = svgElement('clipPath', { id: spec.id + '-past' }, defs);
    const past = svgElement('rect', { x: 42, y: 0, width: 0, height: 150 }, clip);
    spec.ticks.forEach((tick) => {
      const yy = y(tick, spec.max);
      svgElement('line', { x1: 42, x2: 484, y1: yy, y2: yy, stroke: '#e6e7eb', 'stroke-width': 1 }, svg);
      svgElement('text', { x: 32, y: yy + 5, 'text-anchor': 'end', fill: '#666a73', 'font-size': 14 }, svg, tick + (spec.field === 'front' ? '%' : ''));
    });
    [0, 5, 10, 15].forEach((tick) => svgElement('text', {
      x: x(tick), y: 167, 'text-anchor': 'middle', fill: '#666a73', 'font-size': 14,
    }, svg, tick + 's'));
    let path = '', disconnected = true;
    current.samples.forEach((sample) => {
      const value = sample[spec.field];
      if (value === null) { disconnected = true; return; }
      path += `${disconnected ? 'M' : 'L'}${x(sample.time).toFixed(2)},${y(value, spec.max).toFixed(2)} `;
      disconnected = false;
    });
    svgElement('path', { d: path, fill: 'none', stroke: spec.color, 'stroke-opacity': .25, 'stroke-width': 1.7 }, svg);
    svgElement('path', { d: path, fill: 'none', stroke: spec.color, 'stroke-width': 2, 'clip-path': `url(#${spec.id}-past)` }, svg);
    const figure = current.samples[current.figureIndex];
    svgElement('line', { x1: x(figure.time), x2: x(figure.time), y1: 12, y2: 143, stroke: '#767c88', 'stroke-width': 1.3, 'stroke-dasharray': '3 4' }, svg);
    const cursor = svgElement('line', { x1: 42, x2: 42, y1: 12, y2: 143, stroke: '#1f2a44', 'stroke-width': 1.5 }, svg);
    const dot = svgElement('circle', { cx: 42, cy: 142, r: 4.5, fill: spec.color, stroke: '#fff', 'stroke-width': 1.5 }, svg);
    return { ...spec, past, cursor, dot };
  }

  function updatePlay() {
    play.textContent = !video.paused ? 'Pause' : video.ended ? 'Replay' : 'Play';
  }

  function pause() {
    video.pause();
    updatePlay();
  }

  function startPlayback() {
    started = true;
    video.play().catch(() => { updatePlay(); });
  }

  function render(time = video.currentTime) {
    if (!current) return;
    const i = Math.min(current.samples.length - 1, Math.max(0, Math.floor(time * current.fps + .0001)));
    const sample = current.samples[i];
    root.dataset.sample = i;
    root.dataset.case = current.id;
    document.getElementById('ft-feature-value').textContent = sample.features;
    document.getElementById('ft-front-value').textContent = sample.front === null ? 'Low motion' : sample.front.toFixed(1) + '%';
    seek.value = sample.time;
    clock.textContent = `${sample.time.toFixed(1)} / ${current.duration.toFixed(1)} s`;
    seek.setAttribute('aria-valuetext', `${sample.time.toFixed(1)} seconds; ${sample.features} wrist features; ${sample.front === null ? 'low motion' : sample.front.toFixed(1) + ' percent front contribution'}`);
    charts.forEach((chart) => {
      const xx = x(sample.time), value = sample[chart.field];
      chart.cursor.setAttribute('x1', xx);
      chart.cursor.setAttribute('x2', xx);
      chart.past.setAttribute('width', xx - 42 + .2);
      chart.dot.style.display = value === null ? 'none' : '';
      chart.dot.setAttribute('cx', xx);
      if (value !== null) chart.dot.setAttribute('cy', y(value, chart.max));
    });
    const figure = i === current.figureIndex;
    const state = figure ? 'figure' : 'normal';
    if (badge.dataset.state !== state) {
      badge.dataset.state = state;
      badge.textContent = figure ? 'Original figure frame' : 'Front-view evidence over time';
      badge.classList.toggle('is-figure', figure);
    }
  }

  function inspect(index) {
    pause();
    started = true;
    video.currentTime = current.samples[index].time;
    render(video.currentTime);
  }

  function loadCase(index) {
    pause();
    current = dataset.cases[index];
    started = false;
    tabs.forEach((tab) => tab.setAttribute('aria-pressed', String(Number(tab.dataset.frontCase) === index)));
    document.getElementById('ft-title').textContent = current.title;
    document.getElementById('ft-description').textContent = `${current.arm === 'left' ? 'Left' : 'Right'} arm · 15 seconds at original speed`;
    const momentText = (i) => {
      const s = current.samples[i];
      return `${s.time.toFixed(1)} s · ${s.features} features · ${s.front.toFixed(1)}% front`;
    };
    document.getElementById('ft-figure-value').textContent = momentText(current.figureIndex);
    charts = chartSpecs.map(buildChart);
    render(0);
    video.poster = current.poster;
    video.setAttribute('aria-label', `${current.title}: wrist videos and front-only Integrated Gradients heatmap`);
    video.src = current.video;
    video.load();
  }

  async function init() {
    try {
      const response = await fetch('assets/data/front-view-timeline.json');
      if (!response.ok) throw new Error('Timeline unavailable');
      dataset = await response.json();
      root.querySelector('.ft-tabs').hidden = false;
      root.querySelector('.ft-interactive').hidden = false;
      video.controls = false;
      tabs.forEach((tab) => tab.addEventListener('click', () => loadCase(Number(tab.dataset.frontCase))));
      play.addEventListener('click', () => {
        if (!video.paused) pause();
        else {
          if (video.ended) video.currentTime = 0;
          startPlayback();
        }
      });
      seek.addEventListener('input', () => inspect(Math.round(Number(seek.value) * current.fps)));
      document.getElementById('ft-figure').addEventListener('click', () => inspect(current.figureIndex));
      video.addEventListener('loadedmetadata', () => {
        render(0);
        if (visible && !started && !motion.matches) startPlayback();
      });
      ['play', 'pause', 'ended'].forEach((event) => video.addEventListener(event, updatePlay));
      ['seeked', 'timeupdate'].forEach((event) => video.addEventListener(event, () => render(video.currentTime)));
      video.addEventListener('error', () => {
        pause();
        badge.textContent = 'Video unavailable — see the static figure below';
      });
      if ('requestVideoFrameCallback' in video) {
        const onFrame = (_, metadata) => {
          render(metadata.mediaTime);
          videoFrame = video.requestVideoFrameCallback(onFrame);
        };
        videoFrame = video.requestVideoFrameCallback(onFrame);
      } else {
        const tick = () => {
          render(video.currentTime);
          if (!video.paused) raf = requestAnimationFrame(tick);
        };
        video.addEventListener('play', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(tick); });
        video.addEventListener('pause', () => cancelAnimationFrame(raf));
      }
      document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
      motion.addEventListener('change', () => { if (motion.matches) pause(); });
      loadCase(0);
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(([entry]) => {
          visible = entry.isIntersecting;
          if (!visible) pause();
          else if (!started && !motion.matches && video.readyState >= 1) startPlayback();
        }, { threshold: .15 }).observe(root);
      } else visible = true;
      root.dataset.ready = 'true';
    } catch {
      pause();
      if (videoFrame !== null && video.cancelVideoFrameCallback) video.cancelVideoFrameCallback(videoFrame);
      cancelAnimationFrame(raf);
      video.controls = true;
      root.querySelector('.ft-tabs').hidden = true;
      root.querySelector('.ft-interactive').hidden = true;
    }
  }

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      init();
    }, { rootMargin: '400px 0px' });
    observer.observe(root);
  } else init();
})();
