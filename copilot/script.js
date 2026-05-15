const imagesInput = document.getElementById("imagesInput");
const audioInput = document.getElementById("audioInput");
const audioStartInput = document.getElementById("audioStart");
const audioEndInput = document.getElementById("audioEnd");
const audioInfo = document.getElementById("audioInfo");
const transitionSelect = document.getElementById("transitionSelect");
const previewCanvas = document.getElementById("previewCanvas");
const playBtn = document.getElementById("playBtn");
const pauseBtn = document.getElementById("pauseBtn");
const stopBtn = document.getElementById("stopBtn");
const exportBtn = document.getElementById("exportBtn");
const progressFill = document.getElementById("progressFill");
const timeLabel = document.getElementById("timeLabel");
const statusLabel = document.getElementById("statusLabel");
const ctx = previewCanvas.getContext("2d");

const WIDTH = previewCanvas.width;
const HEIGHT = previewCanvas.height;
const SLIDE_DURATION = 3;
const TRANSITION_DURATION = 0.75;
const MIME_OPTIONS = [
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
];

let slides = [];
let audioState = {
  file: null,
  buffer: null,
  url: null,
  duration: 0,
  trimStart: 0,
  trimEnd: 0,
};

let playback = {
  mode: "stopped",
  startTime: 0,
  offset: 0,
  rafId: 0,
  audioContext: null,
  audioSource: null,
  exportRecorder: null,
};

function formatTime(s) {
  return (s || 0).toFixed(2);
}

function setStatus(message) {
  statusLabel.textContent = message;
}

function getGlobalTransition() {
  return transitionSelect.value || "fade";
}

function getTotalDuration() {
  return slides.length * SLIDE_DURATION;
}

function getTimeline() {
  const timeline = [];
  let cursor = 0;
  for (let index = 0; index < slides.length; index += 1) {
    const slide = slides[index];
    timeline.push({
      slide,
      index,
      start: cursor,
      end: cursor + SLIDE_DURATION,
      duration: SLIDE_DURATION,
      transitionDuration: TRANSITION_DURATION,
    });
    cursor += SLIDE_DURATION;
  }
  return timeline;
}

function normalizeTrimRange() {
  const max = audioState.duration || 0;
  if (!max) {
    audioStartInput.value = "0";
    audioEndInput.value = "0";
    return { start: 0, end: 0 };
  }

  let start = Math.max(0, Number(audioStartInput.value) || 0);
  let end = Math.max(start, Number(audioEndInput.value) || max);
  start = Math.min(start, max);
  end = Math.min(end || max, max);

  audioStartInput.value = start.toFixed(2);
  audioEndInput.value = end.toFixed(2);
  audioState.trimStart = start;
  audioState.trimEnd = end;
  return { start, end };
}

function ensureAudioContext() {
  if (!playback.audioContext) {
    playback.audioContext = new (
      window.AudioContext || window.webkitAudioContext
    )();
  }
  return playback.audioContext;
}

function stopPlayback(hard = true) {
  if (playback.rafId) {
    cancelAnimationFrame(playback.rafId);
    playback.rafId = 0;
  }

  if (playback.audioSource) {
    try {
      playback.audioSource.stop();
    } catch {
      // Ignore double-stop errors.
    }
    playback.audioSource.disconnect();
    playback.audioSource = null;
  }

  if (
    hard &&
    playback.audioContext &&
    playback.audioContext.state !== "closed"
  ) {
    playback.audioContext.suspend().catch(() => {});
  }

  playback.mode = "stopped";
  playback.startTime = 0;
  playback.offset = 0;
  progressFill.style.width = "0%";
  timeLabel.textContent = `${formatTime(0)} / ${formatTime(getTotalDuration())}`;
}

async function loadImageFromFile(file) {
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.src = url;
  await image.decode();
  return { file, url, image, name: file.name };
}





function drawCover(image, ctxTarget, x, y, width, height) {
  const scale = Math.max(width / image.width, height / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  const drawX = x + (width - drawWidth) / 2;
  const drawY = y + (height - drawHeight) / 2;
  ctxTarget.drawImage(image, drawX, drawY, drawWidth, drawHeight);
}

function drawSlideFrame(ctxTarget, slide, options = {}) {
  const {
    alpha = 1,
    offsetX = 0,
    scale = 1,
    width = WIDTH,
    height = HEIGHT,
  } = options;
  const image = slide?.image;

  ctxTarget.save();
  ctxTarget.globalAlpha = alpha;
  ctxTarget.fillStyle = "#000";
  ctxTarget.fillRect(0, 0, width, height);
  if (image) {
    ctxTarget.translate(width / 2, height / 2);
    ctxTarget.scale(scale, scale);
    ctxTarget.translate(-width / 2 + offsetX, -height / 2);
    drawCover(image, ctxTarget, 0, 0, width, height);
  }
  ctxTarget.restore();
}

function renderFrame(time) {
  const timeline = getTimeline();
  const totalDuration = timeline.length ? timeline[timeline.length - 1].end : 0;

  ctx.save();
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  if (!timeline.length) {
    ctx.fillStyle = "#8aa0c3";
    ctx.font = 'bold 42px "Trebuchet MS", sans-serif';
    ctx.textAlign = "center";
    ctx.fillText("Import images to begin", WIDTH / 2, HEIGHT / 2);
    ctx.restore();
    progressFill.style.width = "0%";
    timeLabel.textContent = `${formatTime(0)} / ${formatTime(0)}`;
    return;
  }

  const clampedTime = Math.max(0, Math.min(time, totalDuration));
  let current = timeline[timeline.length - 1];
  for (const entry of timeline) {
    if (clampedTime < entry.end) {
      current = entry;
      break;
    }
  }

  const previous = timeline[Math.max(0, current.index - 1)];
  const transitionDuration = current.transitionDuration;
  const timeInSlide = clampedTime - current.start;
  const transitionProgress =
    transitionDuration > 0
      ? Math.min(Math.max(timeInSlide / transitionDuration, 0), 1)
      : 1;
  const inTransition = current.index > 0 && timeInSlide < transitionDuration;

  if (inTransition && previous) {
    const type = getGlobalTransition();
    if (type === "cut") {
      drawSlideFrame(ctx, current.slide, {
        alpha: 1,
        width: WIDTH,
        height: HEIGHT,
      });
    } else if (type === "slide") {
      const incomingX = WIDTH * (1 - transitionProgress);
      const outgoingX = -WIDTH * transitionProgress;
      drawSlideFrame(ctx, previous.slide, {
        offsetX: outgoingX,
        width: WIDTH,
        height: HEIGHT,
      });
      drawSlideFrame(ctx, current.slide, {
        offsetX: incomingX,
        width: WIDTH,
        height: HEIGHT,
      });
    } else if (type === "zoom") {
      const incomingScale = 0.85 + 0.15 * transitionProgress;
      const outgoingScale = 1 + 0.05 * transitionProgress;
      drawSlideFrame(ctx, previous.slide, {
        alpha: 1 - transitionProgress,
        scale: outgoingScale,
        width: WIDTH,
        height: HEIGHT,
      });
      drawSlideFrame(ctx, current.slide, {
        alpha: transitionProgress,
        scale: incomingScale,
        width: WIDTH,
        height: HEIGHT,
      });
    } else {
      drawSlideFrame(ctx, previous.slide, {
        alpha: 1 - transitionProgress,
        width: WIDTH,
        height: HEIGHT,
      });
      drawSlideFrame(ctx, current.slide, {
        alpha: transitionProgress,
        width: WIDTH,
        height: HEIGHT,
      });
    }
  } else {
    const animType = getGlobalTransition();
    const introProgress =
      transitionDuration > 0
        ? Math.min(timeInSlide / transitionDuration, 1)
        : 1;
    if (animType === "cut") {
      drawSlideFrame(ctx, current.slide, {
        alpha: 1,
        width: WIDTH,
        height: HEIGHT,
      });
    } else if (animType === "slide") {
      drawSlideFrame(ctx, current.slide, {
        offsetX: WIDTH * (1 - introProgress),
        width: WIDTH,
        height: HEIGHT,
      });
    } else if (animType === "zoom") {
      drawSlideFrame(ctx, current.slide, {
        scale: 0.85 + 0.15 * introProgress,
        width: WIDTH,
        height: HEIGHT,
      });
    } else {
      drawSlideFrame(ctx, current.slide, {
        alpha: introProgress,
        width: WIDTH,
        height: HEIGHT,
      });
    }
  }

  ctx.restore();
  const progress = totalDuration > 0 ? (clampedTime / totalDuration) * 100 : 0;
  progressFill.style.width = `${progress}%`;
  timeLabel.textContent = `${formatTime(clampedTime)} / ${formatTime(totalDuration)}`;
}

function tick() {
  if (playback.mode !== "playing") {
    return;
  }

  const elapsed =
    playback.offset + (performance.now() - playback.startTime) / 1000;
  const totalDuration = getTotalDuration();
  renderFrame(elapsed);

  if (elapsed >= totalDuration) {
    stopPlayback(false);
    renderFrame(totalDuration);
    setStatus("Playback complete.");
    return;
  }

  playback.rafId = requestAnimationFrame(tick);
}

async function startAudioPlayback(offsetSeconds = 0) {
  if (!audioState.buffer) {
    return null;
  }

  const { start, end } = normalizeTrimRange();
  const trimmedStart = Math.min(start + offsetSeconds, end);
  const remaining = Math.max(0, end - trimmedStart);
  if (remaining <= 0) {
    return null;
  }

  const audioContext = ensureAudioContext();
  if (audioContext.state === "suspended") {
    await audioContext.resume();
  }

  const source = audioContext.createBufferSource();
  source.buffer = audioState.buffer;
  source.connect(audioContext.destination);
  source.start(0, trimmedStart, remaining);
  playback.audioSource = source;
  return source;
}

imagesInput.addEventListener("change", (e) => {
  const files = Array.from(e.target.files || []);
  if (!files.length) {
    return;
  }

  const loadPromises = files.map((file) => loadImageFromFile(file));
  Promise.all(loadPromises)
    .then((loadedImages) => {
      loadedImages.forEach((loaded, index) => {
        slides.push({
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}-${index}`,
          file: loaded.file,
          url: loaded.url,
          image: loaded.image,
          name: loaded.name,
        });
      });
      renderFrame(0);
      setStatus(
        `${files.length} image${files.length === 1 ? "" : "s"} loaded.`,
      );
      e.target.value = "";
    })
    .catch(() => {
      setStatus("One or more images could not be loaded.");
    });
});



playBtn.addEventListener("click", () => {
  if (!slides.length) {
    setStatus("Add at least one image before playing.");
    return;
  }

  if (playback.mode === "playing") {
    return;
  }

  const resumeOffset = playback.mode === "paused" ? playback.offset : 0;
  playback.offset = resumeOffset;
  playback.startTime = performance.now();
  playback.mode = "playing";
  playback.audioSource = null;
  startAudioPlayback(resumeOffset).catch(() => {
    setStatus("Audio playback could not start.");
  });
  setStatus("Playing preview.");
  tick();
});

pauseBtn.addEventListener("click", () => {
  if (playback.mode !== "playing") {
    return;
  }

  playback.offset += (performance.now() - playback.startTime) / 1000;
  playback.mode = "paused";
  if (playback.rafId) {
    cancelAnimationFrame(playback.rafId);
    playback.rafId = 0;
  }
  if (playback.audioSource) {
    try {
      playback.audioSource.stop();
    } catch {
      // Ignore stop errors.
    }
    playback.audioSource.disconnect();
    playback.audioSource = null;
  }
  setStatus("Paused.");
});

stopBtn.addEventListener("click", () => {
  stopPlayback();
  renderFrame(0);
  setStatus("Stopped.");
});



audioInput.addEventListener("change", async (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) {
    return;
  }

  if (audioState.url) {
    URL.revokeObjectURL(audioState.url);
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const audioContext = ensureAudioContext();
    audioState.buffer = await audioContext.decodeAudioData(
      arrayBuffer.slice(0),
    );
    audioState.file = file;
    audioState.url = URL.createObjectURL(file);
    audioState.duration = audioState.buffer.duration;
    audioState.trimStart = 0;
    audioState.trimEnd = audioState.duration;
    audioStartInput.min = "0";
    audioStartInput.max = audioState.duration.toFixed(2);
    audioEndInput.min = "0";
    audioEndInput.max = audioState.duration.toFixed(2);
    audioStartInput.value = "0.00";
    audioEndInput.value = audioState.duration.toFixed(2);
    normalizeTrimRange();
    audioInfo.textContent = `${file.name} loaded. Duration: ${formatTime(audioState.duration)}s`;
    setStatus("Audio loaded.");
  } catch {
    audioState.buffer = null;
    audioState.file = null;
    audioInfo.textContent = "Audio could not be decoded.";
    setStatus("Audio load failed.");
  }
});

[audioStartInput, audioEndInput].forEach((input) => {
  input.addEventListener("change", () => {
    if (!audioState.duration) {
      return;
    }
    normalizeTrimRange();
    renderFrame(playback.mode === "playing" ? playback.offset : 0);
  });
});

function getRecorderMimeType() {
  return (
    MIME_OPTIONS.find((candidate) =>
      MediaRecorder.isTypeSupported(candidate),
    ) || "video/webm"
  );
}

async function startExport() {
  if (!slides.length) {
    setStatus("Add images before exporting.");
    return;
  }

  stopBtn.click();
  const totalDuration = getTotalDuration();
  const audioRange = normalizeTrimRange();
  const recorderStream = previewCanvas.captureStream(30);
  let audioContext = null;
  let audioDestination = null;
  let audioSource = null;

  if (audioState.buffer && audioRange.end > audioRange.start) {
    audioContext = ensureAudioContext();
    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }
    audioDestination = audioContext.createMediaStreamDestination();
    audioSource = audioContext.createBufferSource();
    audioSource.buffer = audioState.buffer;
    audioSource.connect(audioDestination);
  }

  const combinedStream = audioDestination
    ? new MediaStream([
        ...recorderStream.getVideoTracks(),
        ...audioDestination.stream.getAudioTracks(),
      ])
    : recorderStream;

  const recorder = new MediaRecorder(combinedStream, {
    mimeType: getRecorderMimeType(),
  });
  const chunks = [];

  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      chunks.push(event.data);
    }
  };

  recorder.onstop = () => {
    if (audioSource) {
      try {
        audioSource.stop();
      } catch {
        // Ignore stop errors.
      }
      audioSource.disconnect();
    }

    const blob = new Blob(chunks, { type: recorder.mimeType || "video/webm" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "copilot-video-studio.webm";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    setStatus("Export complete.");
    renderFrame(0);
  };

  playback.mode = "exporting";
  playback.exportRecorder = recorder;
  recorder.start();

  if (audioSource) {
    audioSource.start(0, audioRange.start, audioRange.end - audioRange.start);
  }

  const renderStart = performance.now();
  const exportFrame = () => {
    const elapsed = (performance.now() - renderStart) / 1000;
    renderFrame(elapsed);
    if (elapsed < totalDuration) {
      playback.rafId = requestAnimationFrame(exportFrame);
      return;
    }

    renderFrame(totalDuration);
    recorder.stop();
    playback.mode = "stopped";
  };

  setStatus("Exporting video...");
  exportFrame();
}

exportBtn.addEventListener("click", () => {
  startExport().catch(() => {
    setStatus("Export failed in this browser.");
  });
});

window.addEventListener("beforeunload", () => {
  slides.forEach((slide) => {
    if (slide.url) {
      URL.revokeObjectURL(slide.url);
    }
  });
  if (audioState.url) {
    URL.revokeObjectURL(audioState.url);
  }
});

transitionSelect.addEventListener("change", () => {
  renderFrame(playback.mode === "playing" ? playback.offset : 0);
});

renderFrame(0);