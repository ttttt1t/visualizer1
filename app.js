/* ============================
   Feature configuration
   ============================ */

const FEATURE_LIST = [
  "centroid",
  "energy",
  "flux",
  "flatness",
  "rolloff",
  "spread",
  "entropy",
  "crest",
  "slope",
  "density"
];

const BASE_GAIN = {
  centroid: 1,
  energy: 300,
  flux: 600,
  flatness: 1,
  rolloff: 1,
  spread: 1,
  entropy: 1,
  crest: 0.001,
  slope: -1000000,
  density: 1000
};

/* Visual settings live in JS and are edited via debug UI */
const VISUAL = {
  blurRadius: 3.6,
  blurIterations: 3,
  threshold: 245,
  edgeCushion: 20
};

/* Current X/Y feature selections */
let currentXFeature = "centroid";
let currentYFeature = "energy";

/* ============================
   DOM references
   ============================ */

const fileInput = document.getElementById("file-input");
const playBtn = document.getElementById("play-btn");
const stopBtn = document.getElementById("stop-btn");
const clearBtn = document.getElementById("clear-btn");

const xScaleSlider = document.getElementById("x-scale");
const yScaleSlider = document.getElementById("y-scale");
const inertiaSlider = document.getElementById("inertia");

// These labels no longer exist in HTML but are harmless; not used
const xScaleLabel = document.getElementById("x-scale-value");
const yScaleLabel = document.getElementById("y-scale-value");
const inertiaLabel = document.getElementById("inertia-value");

const debugGrid = document.getElementById("debug-grid");
const postGainGrid = document.getElementById("postgain-grid");
const debugToggleBtn = document.getElementById("debug-toggle");

const drawCanvas = document.getElementById("draw-canvas");
const drawCtx = drawCanvas.getContext("2d");


resizeDrawCanvas();
window.addEventListener("resize", resizeDrawCanvas);
function resizeDrawCanvas() {
  const size = drawCanvas.clientWidth; // visible width
  drawCanvas.width = size;             // internal width
  drawCanvas.height = size;            // internal height (square)
}

resizeDrawCanvas();
window.addEventListener("resize", resizeDrawCanvas);



const featureMatrixBody = document.getElementById("feature-matrix-body");

/* Debug visual controls */
const blurRadiusSlider = document.getElementById("blur-radius-slider");
const blurRadiusInput  = document.getElementById("blur-radius-input");

const blurIterationsSlider = document.getElementById("blur-iterations-slider");
const blurIterationsInput  = document.getElementById("blur-iterations-input");

const thresholdSlider = document.getElementById("threshold-slider");
const thresholdInput  = document.getElementById("threshold-input");

const edgeCushionSlider = document.getElementById("edge-cushion-slider");
const edgeCushionInput  = document.getElementById("edge-cushion-input");

const featureGainControlsContainer = document.getElementById("feature-gain-controls");

const spectrumCanvas = document.getElementById("spectrum-canvas");
const spectrumCtx = spectrumCanvas.getContext("2d");



/* Offscreen low-res + blur canvases */
const lowResSizeX = 512;
const lowResSizeY = 480;
const lowCanvas = document.createElement("canvas");
lowCanvas.width = lowResSizeX;
lowCanvas.height = lowResSizeY;
const lowCtx = lowCanvas.getContext("2d");

const blurCanvas = document.createElement("canvas");
blurCanvas.width = lowResSizeX;
blurCanvas.height = lowResSizeY;
const blurCtx = blurCanvas.getContext("2d");

/* ============================
   Dynamic UI setup
   ============================ */

/* Feature matrix: one column of feature names, X/Y radios */
function createFeatureMatrix() {
  FEATURE_LIST.forEach(feature => {
    const row = document.createElement("div");
    row.className = "feature-matrix-row";

    const label = document.createElement("span");
    label.textContent = feature;

    const xRadio = document.createElement("input");
    xRadio.type = "radio";
    xRadio.name = "x-feature-group";
    xRadio.value = feature;

    const yRadio = document.createElement("input");
    yRadio.type = "radio";
    yRadio.name = "y-feature-group";
    yRadio.value = feature;

    if (feature === currentXFeature) xRadio.checked = true;
    if (feature === currentYFeature) yRadio.checked = true;

    xRadio.addEventListener("change", () => {
      if (xRadio.checked) currentXFeature = feature;
    });

    yRadio.addEventListener("change", () => {
      if (yRadio.checked) currentYFeature = feature;
    });

    row.appendChild(label);
    row.appendChild(xRadio);
    row.appendChild(yRadio);

    featureMatrixBody.appendChild(row);
  });
}

createFeatureMatrix();

/* Debug fields for raw and post-gain */
const debugFields = {};
const postGainFields = {};

FEATURE_LIST.forEach(f => {
  const dbg = document.createElement("div");
  dbg.className = "debug-item";
  dbg.innerHTML = `<span class="label">${f}:</span> <span id="debug-${f}">–</span>`;
  debugGrid.appendChild(dbg);
  debugFields[f] = dbg.querySelector(`#debug-${f}`);

  const pg = document.createElement("div");
  pg.className = "debug-item";
  pg.innerHTML = `<span class="label">${f}:</span> <span id="postgain-${f}">–</span>`;
  postGainGrid.appendChild(pg);
  postGainFields[f] = pg.querySelector(`#postgain-${f}`);
});

/* Feature gain controls (number inputs only) */
const featureGainInputs = {};

FEATURE_LIST.forEach(f => {
  const label = document.createElement("div");
  label.className = "feature-gain-label";
  label.textContent = `${f} gain`;

  const input = document.createElement("input");
  input.type = "number";
  input.className = "feature-gain-input";
  input.step = "0.001";
  input.value = BASE_GAIN[f];

  input.addEventListener("input", () => {
    const val = parseFloat(input.value);
    if (!isNaN(val)) {
      BASE_GAIN[f] = val;
    }
  });

  featureGainControlsContainer.appendChild(label);
  featureGainControlsContainer.appendChild(input);

  featureGainInputs[f] = input;
});

/* ============================
   Debug mode toggle
   ============================ */

function toggleDebugMode() {
  document.body.classList.toggle("debug-mode");
}

debugToggleBtn.addEventListener("click", toggleDebugMode);

window.addEventListener("keydown", (e) => {
  if (e.key === "d" || e.key === "D") {
    toggleDebugMode();
  }
});

/* ============================
   Bind VISUAL <-> debug controls
   ============================ */

function clamp(val, min, max) {
  return Math.min(max, Math.max(min, val));
}

function initVisualControl(slider, number, options) {
  const { get, set, min, max, step } = options;

  slider.min = String(min);
  slider.max = String(max);
  slider.step = String(step);

  number.step = String(step);

  const initial = clamp(get(), min, max);
  slider.value = String(initial);
  number.value = String(initial);

  slider.addEventListener("input", () => {
    const v = clamp(parseFloat(slider.value), min, max);
    set(v);
    number.value = String(v);
  });

  number.addEventListener("input", () => {
    const vRaw = parseFloat(number.value);
    if (isNaN(vRaw)) return;
    const v = clamp(vRaw, min, max);
    set(v);
    slider.value = String(v);
    number.value = String(v);
  });
}

/* Visual controls binding */
initVisualControl(blurRadiusSlider, blurRadiusInput, {
  get: () => VISUAL.blurRadius,
  set: v => { VISUAL.blurRadius = v; },
  min: 0,
  max: 10,
  step: 0.1
});

initVisualControl(blurIterationsSlider, blurIterationsInput, {
  get: () => VISUAL.blurIterations,
  set: v => { VISUAL.blurIterations = Math.round(v); },
  min: 1,
  max: 12,
  step: 1
});

initVisualControl(thresholdSlider, thresholdInput, {
  get: () => VISUAL.threshold,
  set: v => { VISUAL.threshold = Math.round(v); },
  min: 0,
  max: 255,
  step: 1
});

initVisualControl(edgeCushionSlider, edgeCushionInput, {
  get: () => VISUAL.edgeCushion,
  set: v => { VISUAL.edgeCushion = Math.round(v); },
  min: 0,
  max: 100,
  step: 1
});

/* ============================
   Slider <-> number binding
   ============================ */

function bindSliderAndNumber(slider, number, min, max, step) {
  slider.min = min;
  slider.max = max;
  slider.step = step;

  number.min = min;
  number.max = max;
  number.step = step;

  number.value = slider.value;

  slider.addEventListener("input", () => {
    number.value = slider.value;
  });

  number.addEventListener("input", () => {
    if (!isNaN(parseFloat(number.value))) {
      slider.value = number.value;
    }
  });
}

bindSliderAndNumber(
  document.getElementById("x-scale"),
  document.getElementById("x-scale-input"),
  "0.1", "50", "0.05"
);

bindSliderAndNumber(
  document.getElementById("y-scale"),
  document.getElementById("y-scale-input"),
  "0.1", "50", "0.05"
);

bindSliderAndNumber(
  document.getElementById("inertia"),
  document.getElementById("inertia-input"),
  "0.5", "0.98", "0.02"
);

bindSliderAndNumber(
  document.getElementById("volume-slider"),
  document.getElementById("volume-input"),
  "0", "1", "0.01"
);

/* ============================
   Canvas helpers
   ============================ */

function clearMainCanvas() {
  drawCtx.fillStyle = "#ffffff";
  drawCtx.fillRect(0, 0, drawCanvas.width, drawCanvas.height);
}
function clearLowCanvas() {
  lowCtx.fillStyle = "#ffffff";
  lowCtx.fillRect(0, 0, lowCanvas.width, lowCanvas.height);
}
function clearBlurCanvas() {
  blurCtx.clearRect(0, 0, blurCanvas.width, blurCanvas.height);
}
function clearSpectrumCanvas() {
  spectrumCtx.fillStyle = "#ffffff";
  spectrumCtx.fillRect(0, 0, spectrumCanvas.width, spectrumCanvas.height);
}

clearMainCanvas();
clearLowCanvas();
clearBlurCanvas();
clearSpectrumCanvas();

/* ============================
   Audio setup
   ============================ */

const fftSize = 2048;

let audioContext = null;
let analyser = null;
let sourceNode = null;
let audioBuffer = null;
let volumeNode = null;

let freqData = null;
let prevMag = null;

function initAudio() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();

    // Master volume
    volumeNode = audioContext.createGain();
    volumeNode.gain.value = 1;

    // Analyser
    analyser = audioContext.createAnalyser();
    analyser.fftSize = fftSize;
    analyser.smoothingTimeConstant = 0.7;

    freqData = new Float32Array(analyser.frequencyBinCount);
    prevMag = new Float32Array(analyser.frequencyBinCount);

     // analyser is visual-only
    // volumeNode is audio-only
    volumeNode.connect(audioContext.destination);

  }
}

// Volume slider controls master gain
const volumeSlider = document.getElementById("volume-slider");
volumeSlider.addEventListener("input", () => {
  if (!volumeNode) return;
  const v = parseFloat(volumeSlider.value);
  if (!isNaN(v)) {
    volumeNode.gain.value = v;
  }
});

/* ============================
   Animation / drawing state
   ============================ */

let isPlaying = false;
let animationId = null;

const margin = 40;
let prevX = null;
let prevY = null;

function resetCursor() {
  prevX = null;
  prevY = null;
}

const smoothed = {};
FEATURE_LIST.forEach(f => smoothed[f] = 0);

/* ============================
   Feature computation
   ============================ */

function computeFeatures() {
  if (!analyser || !freqData || !audioContext) return null;

  analyser.getFloatFrequencyData(freqData);

  const n = freqData.length;
  const mags = new Float32Array(n);

  for (let i = 0; i < n; i++) {
    mags[i] = Math.pow(10, freqData[i] / 20);
  }

  const nyquist = audioContext.sampleRate / 2;

  // Centroid
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    const freq = (i / n) * nyquist;
    num += freq * mags[i];
    den += mags[i];
  }
  const centroidNorm = den > 0 ? (num / den) / nyquist : 0;

  // Energy
  let energyRaw = 0;
  for (let i = 0; i < n; i++) energyRaw += mags[i] * mags[i];
  const energy = Math.log10(1 + energyRaw);

  // Flux
  let fluxRaw = 0;
  if (!prevMag) prevMag = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const diff = mags[i] - prevMag[i];
    if (diff > 0) fluxRaw += diff * diff;
  }
  prevMag.set(mags);
  const flux = Math.log10(1 + 10 * fluxRaw);

  // Flatness
  let geo = 0, arith = 0;
  for (let i = 0; i < n; i++) {
    const m = mags[i] + 1e-12;
    geo += Math.log(m);
    arith += m;
  }
  geo = Math.exp(geo / n);
  arith /= n;
  const flatness = geo / (arith + 1e-12);

  // Rolloff
  const totalMag = mags.reduce((a, b) => a + b, 0);
  let cumulative = 0;
  let rolloff = 1;
  for (let i = 0; i < n; i++) {
    cumulative += mags[i];
    if (cumulative >= totalMag * 0.85) {
      rolloff = i / n;
      break;
    }
  }

  // Spread
  const centroidHz = centroidNorm * nyquist;
  let spreadNum = 0;
  for (let i = 0; i < n; i++) {
    const freq = (i / n) * nyquist;
    const diff = freq - centroidHz;
    spreadNum += mags[i] * diff * diff;
  }
  const spread = Math.sqrt(spreadNum / (den || 1)) / nyquist;

  // Entropy
  let entropy = 0;
  for (let i = 0; i < n; i++) {
    const p = mags[i] / (totalMag + 1e-12);
    if (p > 0) entropy -= p * Math.log2(p);
  }
  entropy /= Math.log2(n);

  // Crest
  let maxMag = 0;
  for (let i = 0; i < n; i++) {
    if (mags[i] > maxMag) maxMag = mags[i];
  }
  const crest = maxMag / (arith + 1e-12);

  // Slope
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (let i = 0; i < n; i++) {
    const x = i;
    const y = mags[i];
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  }
  const slope = (n * sumXY - sumX * sumY) /
                (n * sumXX - sumX * sumX + 1e-12);

  // Density
  let densityRaw = 0;
  for (let i = 0; i < n; i++) densityRaw += mags[i] * mags[i];
  const density = Math.log10(1 + densityRaw);

  return {
    centroid: centroidNorm,
    energy,
    flux,
    flatness,
    rolloff,
    spread,
    entropy,
    crest,
    slope,
    density
  };
}

/* ============================
   Mapping & drawing
   ============================ */

function ema(prev, value, inertia) {
  return inertia * prev + (1 - inertia) * value;
}

function mapToCoords(features) {
  const inertia = parseFloat(inertiaSlider.value);

  FEATURE_LIST.forEach(f => {
    const raw = features[f];
    const postGain = raw * BASE_GAIN[f];
    smoothed[f] = ema(smoothed[f], postGain, inertia);
  });

  const xF = currentXFeature;
  const yF = currentYFeature;

  const xVal = smoothed[xF] * parseFloat(xScaleSlider.value);
  const yVal = smoothed[yF] * parseFloat(yScaleSlider.value);

  const xNorm = Math.min(1, Math.max(0, xVal));
  const yNorm = Math.min(1, Math.max(0, yVal));

  const edgeCushion = VISUAL.edgeCushion;

  const minX = margin + edgeCushion;
  const maxX = drawCanvas.width - margin - edgeCushion;
  const minY = margin + edgeCushion;
  const maxY = drawCanvas.height - margin - edgeCushion;

  const x = minX + xNorm * (maxX - minX);
  const y = maxY - yNorm * (maxY - minY);

  return { x, y };
}

function drawLineLowRes(x, y) {
  const lx = x / drawCanvas.width * lowCanvas.width;
  const ly = y / drawCanvas.height * lowCanvas.height;

  if (prevX === null || prevY === null) {
    prevX = lx;
    prevY = ly;
    return;
  }

  const baseWidth = 0.4 * (lowCanvas.width / drawCanvas.width);

  lowCtx.strokeStyle = "#000000";
  lowCtx.lineWidth = baseWidth;
  lowCtx.lineCap = "round";
  lowCtx.beginPath();
  lowCtx.moveTo(prevX, prevY);
  lowCtx.lineTo(lx, ly);
  lowCtx.stroke();

  lowCtx.lineWidth = baseWidth * 0.4;
  lowCtx.beginPath();
  lowCtx.moveTo(prevX, prevY);
  lowCtx.lineTo(lx, ly);
  lowCtx.stroke();

  prevX = lx;
  prevY = ly;
}

/* ============================
   Composite render
   ============================ */

function renderComposite() {
  clearBlurCanvas();

  // 1. Blur low-res canvas directly
  blurCtx.filter = VISUAL.blurRadius > 0 ? `blur(${VISUAL.blurRadius}px)` : "none";
  blurCtx.drawImage(lowCanvas, 0, 0);
  blurCtx.filter = "none";

  // 2. Upscale to main canvas
  clearMainCanvas();
  drawCtx.imageSmoothingEnabled = true;
  drawCtx.imageSmoothingQuality = "high";

  drawCtx.drawImage(
    blurCanvas,
    0, 0, blurCanvas.width, blurCanvas.height,
    0, 0, drawCanvas.width, drawCanvas.height
  );

  // 3. Threshold
  const threshold = VISUAL.threshold;
  const imgData = drawCtx.getImageData(0, 0, drawCanvas.width, drawCanvas.height);
  const data = imgData.data;

  for (let i = 0; i < data.length; i += 4) {
    const v = data[i];
    const out = v > threshold ? 255 : 0;
    data[i] = data[i+1] = data[i+2] = out;
  }

  drawCtx.putImageData(imgData, 0, 0);
}

/* ============================
   Spectrum visualization
   ============================ */

function drawSpectrum() {
  if (!analyser) return;

  const w = spectrumCanvas.width;
  const h = spectrumCanvas.height;
  spectrumCtx.fillStyle = "#ffffff";
  spectrumCtx.fillRect(0, 0, w, h);

  const bufferLength = analyser.frequencyBinCount;
  const barWidth = (w / bufferLength) * 2.5;
  let x = 0;

  const byteData = new Uint8Array(bufferLength);
  analyser.getByteFrequencyData(byteData);

  for (let i = 0; i < bufferLength; i++) {
    const v = byteData[i] / 255;
    const barHeight = v * h;

    spectrumCtx.fillStyle = `rgba(30,136,229,${0.2 + 0.8 * v})`;
    spectrumCtx.fillRect(x, h - barHeight, barWidth, barHeight);

    x += barWidth + 1;
    if (x > w) break;
  }
}

/* ============================
   Animation loop
   ============================ */

function step() {
  if (isPlaying && analyser && freqData) {
    const features = computeFeatures();
    if (features) {
      const coords = mapToCoords(features);

      drawLineLowRes(coords.x, coords.y);
      drawSpectrum();

      FEATURE_LIST.forEach(f => {
        const raw = features[f];
        const postGain = raw * BASE_GAIN[f];

        debugFields[f].textContent = isFinite(raw) ? raw.toFixed(4) : "NaN";
        postGainFields[f].textContent = isFinite(postGain) ? postGain.toFixed(4) : "NaN";
      });
    }
  }

  renderComposite();
  animationId = requestAnimationFrame(step);
}

/* ============================
   Audio control
   ============================ */

async function loadAudioFromFile(file) {
  initAudio();  // ensure audioContext, volumeNode, analyser, freqData exist

  if (sourceNode) {
    try { sourceNode.stop(); } catch (e) {}
    sourceNode.disconnect();
    sourceNode = null;
  }

  const arrayBuffer = await file.arrayBuffer();
  audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  playBtn.disabled = false;
  stopBtn.disabled = true;
}

function stopPlayback() {
  if (sourceNode) {
    try { sourceNode.stop(); } catch (e) {}
    sourceNode.disconnect();
    sourceNode = null;
  }
  isPlaying = false;
  stopBtn.disabled = true;
  playBtn.disabled = !audioBuffer;
}

function resetForPlayback() {
  FEATURE_LIST.forEach(f => smoothed[f] = 0);
  prevMag = null;
  resetCursor();
  clearSpectrumCanvas();
}

function startPlayback() {
  if (!audioBuffer) return;

  initAudio();        // ensure audioContext, analyser, volumeNode exist

  stopPlayback();
  resetForPlayback();

  // 1. Create a fresh source node
  sourceNode = audioContext.createBufferSource();
  sourceNode.buffer = audioBuffer;

  // 2. SPLIT THE SIGNAL HERE (this is the part you asked about)
  // Raw signal → analyser (for visuals)
  sourceNode.connect(analyser);

  // Raw signal → volume → speakers
  sourceNode.connect(volumeNode);

  // 3. End handler
  sourceNode.onended = () => {
    isPlaying = false;
    stopBtn.disabled = true;
    playBtn.disabled = false;
  };

  // 4. Start playback
  sourceNode.start(0);
  isPlaying = true;
  playBtn.disabled = true;
  stopBtn.disabled = false;
}


/* ============================
   Event listeners
   ============================ */

fileInput.addEventListener("change", async e => {
  const file = e.target.files[0];
  if (!file) return;
  stopPlayback();
  try {
    await loadAudioFromFile(file);
  } catch (err) {
    console.error(err);
    alert("Error loading audio file.");
  }
});

playBtn.addEventListener("click", () => {
  initAudio();
  if (audioContext.state === "suspended") {
    audioContext.resume();
  }
  startPlayback();
});

stopBtn.addEventListener("click", () => {
  stopPlayback();
});

clearBtn.addEventListener("click", () => {
  clearLowCanvas();
  clearBlurCanvas();
  clearMainCanvas();
  clearSpectrumCanvas();
  resetCursor();
});

/* ============================
   Start animation
   ============================ */

animationId = requestAnimationFrame(step);
