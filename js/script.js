(function () {
  const DEFAULT_PRIZES = [
    { name: "น้ำมันเครื่อง ECSTAR V7000", weight: 4 },
    { name: "เสื้อชูชีพ SUZUKI", weight: 5 },
    { name: "หมุนอีกครั้ง", weight: 10 },
    { name: "หมวก SUZUKI", weight: 5 },
    { name: "สายคล้องคอ SUZUKI", weight: 10 },
    { name: "เสื้อแขนยาว SUZUKI", weight: 5 },
    { name: "เสื้อโปโล SUZUKI", weight: 5 }
  ];

  const PALETTE = [
    "#1e6fe8", "#e5174a", "#ffffff", "#123a8f",
    "#ff6f91", "#0a2a5e", "#38bdf8", "#c81046",
    "#e6ecf7", "#0d3b8f", "#ff9db3", "#163f78"
  ];

  let prizes = [];
  let rotation = 0; // current wheel rotation in degrees
  let spinning = false;

  const canvas = document.getElementById("wheelCanvas");
  const ctx = canvas.getContext("2d");
  const size = canvas.width;
  const center = size / 2;
  const radius = size / 2 - 6;

  const listEl = document.getElementById("prizeList");
  const addBtn = document.getElementById("addBtn");
  const shuffleBtn = document.getElementById("shuffleBtn");
  const spinHub = document.getElementById("spinHub");
  const totalLabel = document.getElementById("totalWeightLabel");
  const resetBtn = document.getElementById("resetBtn");
  const wheelStage = document.querySelector(".wheel-stage");
  const confettiLayer = document.getElementById("confettiLayer");
  const paperShootLayer = document.getElementById("paperShootLayer");
  const winnerOverlay = document.getElementById("winnerOverlay");
  const winnerName = document.getElementById("winnerName");
  const winnerClose = document.getElementById("winnerClose");
  const winnerReceived = document.getElementById("winnerReceived");
  const cheerAudio = document.getElementById("cheerAudio");
  let currentWinner = null;
  const toggleDetailsBtn = document.getElementById("toggleDetailsBtn");
  const prizeDetails = document.getElementById("prizeDetails");

  const titleMain = document.getElementById("titleMain");
  const titleSub = document.getElementById("titleSub");

  function loadPageTitle() {
    try {
      const savedMain = localStorage.getItem("prizeWheel.titleMain");
      const savedSub = localStorage.getItem("prizeWheel.titleSub");
      if (savedMain && savedMain.trim()) titleMain.textContent = savedMain;
      if (savedSub && savedSub.trim()) titleSub.textContent = savedSub;
    } catch (e) { /* ignore, keep default */ }
  }

  function savePageTitle() {
    try {
      localStorage.setItem("prizeWheel.titleMain", titleMain.textContent.trim());
      localStorage.setItem("prizeWheel.titleSub", titleSub.textContent.trim());
    } catch (e) { /* storage unavailable, ignore */ }
  }

  function setupTitleEditor(element, defaultText) {
    element.addEventListener("blur", () => {
      if (!element.textContent.trim()) element.textContent = defaultText;
      savePageTitle();
    });
    element.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        element.blur();
      }
    });
    element.addEventListener("paste", (e) => {
      e.preventDefault();
      const text = (e.clipboardData || window.clipboardData).getData("text/plain");
      document.execCommand("insertText", false, text);
    });
  }

  setupTitleEditor(titleMain, "X-SEA KHANON");
  setupTitleEditor(titleSub, "FISHING COMP. #1");

  function loadPrizes() {
    try {
      const raw = localStorage.getItem("prizeWheel.prizes");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) { /* ignore, fall back to defaults */ }
    return DEFAULT_PRIZES.map(p => ({ ...p }));
  }

  function savePrizes() {
    try {
      localStorage.setItem("prizeWheel.prizes", JSON.stringify(prizes));
    } catch (e) { /* storage unavailable, ignore */ }
  }

  function colorFor(i) {
    return PALETTE[i % PALETTE.length];
  }

  function contrastTextFor(hex) {
    const c = hex.replace("#", "");
    const r = parseInt(c.substring(0, 2), 16);
    const g = parseInt(c.substring(2, 4), 16);
    const b = parseInt(c.substring(4, 6), 16);
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 150 ? "#0e213f" : "#ffffff";
  }

  function totalWeight() {
    return prizes.reduce((sum, p) => sum + (Number(p.weight) || 0), 0);
  }

  function renderList() {
    listEl.innerHTML = "";
    prizes.forEach((p, i) => {
      const row = document.createElement("div");
      row.className = "prize-row";

      const swatch = document.createElement("div");
      swatch.className = "swatch";
      swatch.style.background = colorFor(i);

      const nameInput = document.createElement("input");
      nameInput.type = "text";
      nameInput.value = p.name;
      nameInput.maxLength = 40;
      nameInput.setAttribute("aria-label", "Prize name");
      nameInput.addEventListener("input", (e) => {
        prizes[i].name = e.target.value;
        savePrizes();
        drawWheel();
      });

      const weightField = document.createElement("div");
      weightField.className = "weight-field";
      const weightInput = document.createElement("input");
      weightInput.type = "number";
      weightInput.min = "1";
      weightInput.max = "999";
      weightInput.value = p.weight;
      weightInput.setAttribute("aria-label", "Segment weight");
      weightInput.addEventListener("input", (e) => {
        let v = parseInt(e.target.value, 10);
        if (isNaN(v) || v < 1) v = 1;
        prizes[i].weight = v;
        savePrizes();
        drawWheel();
        updateTotalLabel();
      });
      weightField.appendChild(weightInput);

      const removeBtn = document.createElement("button");
      removeBtn.className = "remove-btn";
      removeBtn.innerHTML = "&times;";
      removeBtn.setAttribute("aria-label", "Remove prize");
      removeBtn.disabled = prizes.length <= 2;
      removeBtn.addEventListener("click", () => {
        if (prizes.length <= 2) return;
        prizes.splice(i, 1);
        savePrizes();
        renderList();
        drawWheel();
        updateTotalLabel();
      });

      row.appendChild(swatch);
      row.appendChild(nameInput);
      row.appendChild(weightField);
      row.appendChild(removeBtn);
      listEl.appendChild(row);
    });
    updateTotalLabel();
  }

  function updateTotalLabel() {
    totalLabel.textContent = prizes.length + (prizes.length === 1 ? " prize" : " prizes");
  }

  function wrapLabel(text, maxChars) {
    if (text.length <= maxChars) return [text];
    const words = text.split(" ");
    const lines = [];
    let cur = "";
    words.forEach(w => {
      if ((cur + " " + w).trim().length > maxChars && cur) {
        lines.push(cur.trim());
        cur = w;
      } else {
        cur = (cur + " " + w).trim();
      }
    });
    if (cur) lines.push(cur);
    return lines.slice(0, 2);
  }

  function drawWheel() {
    ctx.clearRect(0, 0, size, size);
    const total = totalWeight() || 1;
    let startAngle = -Math.PI / 2; // 12 o'clock

    prizes.forEach((p, i) => {
      const weight = Number(p.weight) || 0;
      const sliceAngle = (weight / total) * Math.PI * 2;
      const endAngle = startAngle + sliceAngle;
      const sliceColor = colorFor(i);

      // slice
      ctx.beginPath();
      ctx.moveTo(center, center);
      ctx.arc(center, center, radius, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = sliceColor;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#ffffff33";
      ctx.stroke();

      // label
      ctx.save();
      ctx.translate(center, center);
      ctx.rotate(startAngle + sliceAngle / 2);
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillStyle = contrastTextFor(sliceColor);
      const fontSize = Math.max(13, Math.min(20, 320 / prizes.length));
      ctx.font = "400 " + fontSize + "px 'Bungee', sans-serif";
      const maxChars = sliceAngle < 0.35 ? 8 : 14;
      const lines = wrapLabel(p.name || "Prize", maxChars);
      const lineHeight = fontSize * 1.1;
      const startY = -((lines.length - 1) * lineHeight) / 2;
      lines.forEach((line, li) => {
        ctx.fillText(line, radius - 18, startY + li * lineHeight);
      });
      ctx.restore();

      startAngle = endAngle;
    });
  }

  function pickWeightedIndex() {
    const total = totalWeight();
    let r = Math.random() * total;
    for (let i = 0; i < prizes.length; i++) {
      r -= Number(prizes[i].weight) || 0;
      if (r <= 0) return i;
    }
    return prizes.length - 1;
  }

  function angleForIndex(index) {
    // returns the angle (degrees, from 12 o'clock clockwise) of the slice's center
    const total = totalWeight() || 1;
    let acc = 0;
    for (let i = 0; i < index; i++) {
      acc += Number(prizes[i].weight) || 0;
    }
    const weight = Number(prizes[index].weight) || 0;
    const sliceStart = (acc / total) * 360;
    const sliceSize = (weight / total) * 360;
    return sliceStart + sliceSize / 2;
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function spin() {
    if (spinning || prizes.length < 2) return;
    spinning = true;
    spinHub.classList.add("disabled");
    winnerOverlay.classList.remove("active");

    const winnerIndex = pickWeightedIndex();
    const targetSliceAngle = angleForIndex(winnerIndex);
    // The pointer sits at 0deg (12 o'clock). We want the winning slice's
    // center to land at 0deg after rotation, accounting for a slight
    // random jitter within the slice so it doesn't feel robotic.
    const total = totalWeight() || 1;
    const sliceSizeDeg = ((Number(prizes[winnerIndex].weight) || 0) / total) * 360;
    const jitter = (Math.random() - 0.5) * Math.min(sliceSizeDeg * 0.6, 20);

    const currentMod = ((rotation % 360) + 360) % 360;
    const extraSpins = 6 + Math.floor(Math.random() * 3); // 6-8 full turns
    // we need final rotation R such that (R + targetSliceAngle) % 360 == 0
    // i.e. R mod 360 == (360 - targetSliceAngle) mod 360
    const neededMod = ((360 - targetSliceAngle - jitter) % 360 + 360) % 360;
    let delta = neededMod - currentMod;
    if (delta < 0) delta += 360;
    const finalRotation = rotation + extraSpins * 360 + delta;

    const duration = 3600 + Math.random() * 2200; // 3.6s - 5.8s, varies each spin
    const startTime = performance.now();
    const startRotation = rotation;
    const spinDistance = finalRotation - startRotation;
    let lastTickBoundary = Math.floor(startRotation / TICK_STEP_DEG);

    function frame(now) {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      const eased = easeOutCubic(t);
      rotation = startRotation + spinDistance * eased;
      canvas.style.transform = "rotate(" + rotation + "deg)";

      const currentBoundary = Math.floor(rotation / TICK_STEP_DEG);
      if (currentBoundary > lastTickBoundary) {
        const ticksPassed = Math.min(currentBoundary - lastTickBoundary, 8);
        for (let k = 0; k < ticksPassed; k++) playTick();
        lastTickBoundary = currentBoundary;
      }

      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        rotation = finalRotation;
        spinning = false;
        spinHub.classList.remove("disabled");
        announceWinner(prizes[winnerIndex]);
        celebrate();
      }
    }
    requestAnimationFrame(frame);
  }

  function announceWinner(prize) {
    currentWinner = prize;
    winnerName.textContent = prize.name || "Prize";
    winnerOverlay.classList.add("active");
  }

  function celebrate() {
    wheelStage.classList.add("celebrate");
    setTimeout(() => wheelStage.classList.remove("celebrate"), 1600);
    launchConfetti();
    launchPaperShoot();
    playCheerSound();
  }

  let audioUnlocked = false;
  const TICK_STEP_DEG = 24; // simulated peg spacing, independent of slice count

  let tickAudioCtx = null;
  function ensureTickAudio() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!tickAudioCtx) {
      try { tickAudioCtx = new AC(); } catch (e) { return null; }
    }
    if (tickAudioCtx.state === "suspended") {
      tickAudioCtx.resume().catch(() => {});
    }
    return tickAudioCtx;
  }

  let tickNoiseBuffer = null;
  function getTickNoiseBuffer(ctx) {
    if (tickNoiseBuffer) return tickNoiseBuffer;
    const dur = 0.05;
    const size = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, size, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < size; i++) {
      const decay = Math.pow(1 - i / size, 2.2);
      data[i] = (Math.random() * 2 - 1) * decay;
    }
    tickNoiseBuffer = buffer;
    return buffer;
  }

  function playTick() {
    const ctx = tickAudioCtx;
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const buffer = getTickNoiseBuffer(ctx);
      const src = ctx.createBufferSource();
      src.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 2200 + Math.random() * 500;
      filter.Q.value = 5;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.45, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

      src.connect(filter).connect(gain).connect(ctx.destination);
      src.start(now);
      src.stop(now + 0.05);
    } catch (e) { /* audio not available, ignore */ }
  }
  function unlockAudio() {
    if (audioUnlocked) return;
    try {
      const p = cheerAudio.play();
      if (p && typeof p.then === "function") {
        p.then(() => {
          cheerAudio.pause();
          cheerAudio.currentTime = 0;
          audioUnlocked = true;
        }).catch(() => {});
      } else {
        cheerAudio.pause();
        cheerAudio.currentTime = 0;
        audioUnlocked = true;
      }
    } catch (e) { /* audio not available, ignore */ }
  }

  function playCheerSound() {
    try {
      cheerAudio.currentTime = 0;
      cheerAudio.play().catch(() => {});
    } catch (e) { /* audio not available, ignore */ }
  }

  function launchPaperShoot() {
    const prefersReduced = window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;

    paperShootLayer.innerHTML = "";
    const stageRect = wheelStage.getBoundingClientRect();
    const stageSize = stageRect.width || 300;
    const perSide = 26;
    const cannons = [
      { originLeft: "0%", dir: 1 },
      { originLeft: "100%", dir: -1 }
    ];

    cannons.forEach(cannon => {
      for (let i = 0; i < perSide; i++) {
        const piece = document.createElement("div");
        piece.className = "paper-piece";

        const horizontalSpeed = stageSize * (0.55 + Math.random() * 1.15);
        const verticalRise = stageSize * (0.55 + Math.random() * 0.95);
        const px = cannon.dir * horizontalSpeed;
        const py = -verticalRise;
        const ex = px + cannon.dir * stageSize * (0.15 + Math.random() * 0.4);
        const ey = py + stageSize * (0.9 + Math.random() * 0.6);
        const pr = (Math.random() * 300 - 150) + "deg";
        const er = (Math.random() * 720 - 360) + "deg";
        const duration = 1300 + Math.random() * 800;
        const delay = Math.random() * 220;

        piece.style.left = cannon.originLeft;
        piece.style.setProperty("--px", px + "px");
        piece.style.setProperty("--py", py + "px");
        piece.style.setProperty("--ex", ex + "px");
        piece.style.setProperty("--ey", ey + "px");
        piece.style.setProperty("--pr", pr);
        piece.style.setProperty("--er", er);
        piece.style.animationDuration = duration + "ms";
        piece.style.animationDelay = delay + "ms";
        piece.style.background = colorFor(Math.floor(Math.random() * PALETTE.length));
        piece.style.width = (5 + Math.random() * 5) + "px";
        piece.style.height = (11 + Math.random() * 8) + "px";
        if (Math.random() > 0.6) piece.style.borderRadius = "50%";
        paperShootLayer.appendChild(piece);
      }
    });

    setTimeout(() => { paperShootLayer.innerHTML = ""; }, 2400);
  }

  function launchConfetti() {
    const prefersReduced = window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;

    confettiLayer.innerHTML = "";
    const pieceCount = 46;
    for (let i = 0; i < pieceCount; i++) {
      const piece = document.createElement("div");
      piece.className = "confetti-piece";
      const angle = Math.random() * Math.PI * 2;
      const dist = 90 + Math.random() * 140;
      const dist_x = Math.cos(angle) * dist;
      const fall = Math.sin(angle) * dist * 0.6 + 60 + Math.random() * 60;
      const rot = (Math.random() * 720 - 360) + "deg";
      const duration = 900 + Math.random() * 700;
      const delay = Math.random() * 120;
      piece.style.setProperty("--dist", dist_x + "px");
      piece.style.setProperty("--fall", fall + "px");
      piece.style.setProperty("--rot", rot);
      piece.style.animationDuration = duration + "ms";
      piece.style.animationDelay = delay + "ms";
      piece.style.background = colorFor(Math.floor(Math.random() * PALETTE.length));
      if (Math.random() > 0.5) piece.style.borderRadius = "50%";
      confettiLayer.appendChild(piece);
    }
    setTimeout(() => { confettiLayer.innerHTML = ""; }, 1900);
  }

  function shuffleOrder() {
    if (spinning) return;
    for (let i = prizes.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [prizes[i], prizes[j]] = [prizes[j], prizes[i]];
    }
    savePrizes();
    renderList();
    drawWheel();
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function addPrize() {
    prizes.push({ name: "New Prize", weight: 3 });
    savePrizes();
    renderList();
    drawWheel();
  }

  function resetPrizes() {
    prizes = DEFAULT_PRIZES.map(p => ({ ...p }));
    rotation = 0;
    canvas.style.transition = "none";
    canvas.style.transform = "rotate(0deg)";
    requestAnimationFrame(() => { canvas.style.transition = ""; });
    savePrizes();
    renderList();
    drawWheel();
    winnerOverlay.classList.remove("active");
  }

  addBtn.addEventListener("click", addPrize);
  shuffleBtn.addEventListener("click", shuffleOrder);
  spinHub.addEventListener("click", () => {
    unlockAudio();
    ensureTickAudio();
    spin();
  });
  spinHub.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
      e.preventDefault();
      unlockAudio();
      ensureTickAudio();
      spin();
    }
  });
  resetBtn.addEventListener("click", resetPrizes);
  winnerClose.addEventListener("click", () => winnerOverlay.classList.remove("active"));
  winnerReceived.addEventListener("click", () => {
    if (!currentWinner) {
      winnerOverlay.classList.remove("active");
      return;
    }
    const idx = prizes.indexOf(currentWinner);
    if (idx !== -1) {
      const remaining = (Number(currentWinner.weight) || 0) - 1;
      if (remaining <= 0) {
        prizes.splice(idx, 1);
      } else {
        prizes[idx].weight = remaining;
      }
      savePrizes();
      renderList();
      drawWheel();
    }
    currentWinner = null;
    winnerOverlay.classList.remove("active");
  });
  toggleDetailsBtn.addEventListener("click", () => {
    const nowHidden = prizeDetails.classList.toggle("hidden");
    toggleDetailsBtn.textContent = nowHidden ? "Show details" : "Hide details";
  });

  canvas.style.transformOrigin = "50% 50%";

  prizes = loadPrizes();
  loadPageTitle();
  renderList();
  drawWheel();
})();