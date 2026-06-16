const clay = "#c55b34";
const clayLight = "#e27a4d";
const sand = "#ead9bc";
const ink = "#160f0d";
const TAU = Math.PI * 2;

const banpoAssets = Array.from({ length: 41 }, (_, i) =>
  `./public/materials/半坡相关元素/三生艺术${i + 42}.png`
);
const fishAssets = [
  "4a7af36b41665e69061bb346e0d1b3d3.jpg",
  "505470a7efc9d08c9ce6d3e5b87564d4.jpg",
  "575ac7cc1c2fbdabda82169cda1a8843.jpg",
  "6a6f66be15c23f12580050401e616caa.jpg",
  "6c51c136db7c875a21a428e0bb74e122.jpg",
  "814d1b7478bc5162a66674fd2e738fe4.jpg",
  "cb651a41acb93660b151a3d9148701b2.jpg",
  "ebcb12af856631aa9bd70b2fd3b9670c.jpg"
].map((name) => `./public/materials/鱼/${name}`);
const particleSources = [...banpoAssets, ...fishAssets];

const qs = (selector, root = document) => root.querySelector(selector);
const qsa = (selector, root = document) => [...root.querySelectorAll(selector)];
const random = (min, max) => min + Math.random() * (max - min);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function toast(message) {
  let el = qs(".toast");
  if (!el) {
    el = document.createElement("div");
    el.className = "toast";
    document.body.append(el);
  }
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove("show"), 2200);
}

function switchMode(target) {
  qsa(".workspace").forEach((el) => el.classList.toggle("active", el.id === target));
  qsa("[data-target]").forEach((el) => el.classList.toggle("active", el.dataset.target === target));
  qs(`#${target}`).scrollIntoView({ behavior: "smooth", block: "start" });
}

qsa("[data-target]").forEach((button) => button.addEventListener("click", () => switchMode(button.dataset.target)));
qsa("[data-jump]").forEach((button) => button.addEventListener("click", () => switchMode(button.dataset.jump)));

function initBackgroundMusic() {
  const dock = qs("[data-music-dock]");
  const audio = qs("#background-music");
  const toggle = qs("#music-toggle");
  const state = qs("#music-state");
  const volume = qs("#music-volume");
  const volumeValue = qs("#music-volume-value");
  if (!dock || !audio || !toggle || !state || !volume || !volumeValue) return;

  const readSavedVolume = () => {
    try {
      return Number(localStorage.getItem("banpo-music-volume"));
    } catch {
      return NaN;
    }
  };
  const saveVolume = (value) => {
    try {
      localStorage.setItem("banpo-music-volume", String(value));
    } catch {
      // Some privacy modes block localStorage; music still works for this visit.
    }
  };
  const setVolume = (nextValue) => {
    const value = clamp(Math.round(Number(nextValue) || 0), 0, 100);
    audio.volume = value / 100;
    volume.value = value;
    volumeValue.textContent = `${value}%`;
    saveVolume(value);
  };
  const updateMusicState = () => {
    const playing = !audio.paused;
    dock.classList.toggle("is-playing", playing);
    toggle.classList.toggle("playing", playing);
    toggle.setAttribute("aria-pressed", String(playing));
    toggle.setAttribute("aria-label", playing ? "关闭背景音乐" : "打开背景音乐");
    state.textContent = playing ? "音乐开启" : "音乐关闭";
  };

  const savedVolume = readSavedVolume();
  setVolume(Number.isFinite(savedVolume) ? savedVolume : 42);
  updateMusicState();

  toggle.addEventListener("click", async () => {
    if (audio.paused) {
      try {
        toggle.disabled = true;
        await audio.play();
      } catch (error) {
        console.error(error);
        toast("音乐未能播放，请再点一次音乐按钮");
      } finally {
        toggle.disabled = false;
        updateMusicState();
      }
      return;
    }
    audio.pause();
    updateMusicState();
  });

  volume.addEventListener("input", () => {
    setVolume(volume.value);
  });
  audio.addEventListener("play", updateMusicState);
  audio.addEventListener("pause", updateMusicState);
  audio.addEventListener("error", () => toast("背景音乐加载失败，请确认音频文件仍在 public/audio 中"));
}
initBackgroundMusic();

function bindRange(id, callback) {
  const input = qs(`#${id}`);
  const output = qs(`#${id}-value`);
  input.addEventListener("input", () => {
    output.value = input.value;
    callback?.(Number(input.value));
  });
}

function downloadCanvas(canvas, name) {
  try {
    canvas.toBlob((blob) => {
      if (!blob) return toast("导出失败，请重新尝试");
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.download = `${name}-${Date.now()}.png`;
      link.href = url;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, "image/png");
  } catch {
    toast("请双击“启动网站.bat”后再下载作品");
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src.startsWith("data:") ? src : encodeURI(src);
  });
}

async function createParticleTiles() {
  const loaded = await Promise.allSettled(banpoAssets.map(loadImage));
  return loaded
    .filter((item) => item.status === "fulfilled")
    .map((item, index) => {
      const image = item.value;
      // Browsers treat local file images as cross-origin. They can still be
      // rendered, but their pixels cannot be read for trimming and recoloring.
      if (location.protocol === "file:") {
        return {
          canvas: image,
          aspect: image.naturalWidth / image.naturalHeight
        };
      }
      const working = document.createElement("canvas");
      working.width = 256;
      working.height = 256;
      const context = working.getContext("2d", { willReadFrequently: true });
      const scale = Math.min(244 / image.width, 244 / image.height);
      const w = image.width * scale;
      const h = image.height * scale;
      context.drawImage(image, (256 - w) / 2, (256 - h) / 2, w, h);
      const pixels = context.getImageData(0, 0, 256, 256);
      let minX = 256;
      let minY = 256;
      let maxX = -1;
      let maxY = -1;
      for (let i = 0; i < pixels.data.length; i += 4) {
        const r = pixels.data[i];
        const g = pixels.data[i + 1];
        const b = pixels.data[i + 2];
        const sourceAlpha = pixels.data[i + 3] / 255;
        const darkness = 255 - (r * .3 + g * .56 + b * .14);
        const redness = Math.max(0, r - (g + b) / 2);
        const alpha = sourceAlpha * clamp((darkness + redness * 1.4 - 25) * 3, 0, 255);
        pixels.data[i] = index % 4 === 0 ? 231 : 197;
        pixels.data[i + 1] = index % 4 === 0 ? 119 : 83;
        pixels.data[i + 2] = index % 4 === 0 ? 73 : 47;
        pixels.data[i + 3] = alpha;
        if (alpha > 12) {
          const pixelIndex = i / 4;
          const x = pixelIndex % 256;
          const y = Math.floor(pixelIndex / 256);
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
      context.clearRect(0, 0, 256, 256);
      context.putImageData(pixels, 0, 0);
      if (maxX < minX || maxY < minY) return null;
      const padding = 2;
      const cropX = Math.max(0, minX - padding);
      const cropY = Math.max(0, minY - padding);
      const cropWidth = Math.min(256 - cropX, maxX - minX + 1 + padding * 2);
      const cropHeight = Math.min(256 - cropY, maxY - minY + 1 + padding * 2);
      const canvas = document.createElement("canvas");
      canvas.width = cropWidth;
      canvas.height = cropHeight;
      canvas.getContext("2d").drawImage(
        working,
        cropX,
        cropY,
        cropWidth,
        cropHeight,
        0,
        0,
        cropWidth,
        cropHeight
      );
      return {
        canvas,
        aspect: cropWidth / cropHeight
      };
    })
    .filter(Boolean);
}

let tiles = [];
const tileReady = createParticleTiles().then((result) => {
  tiles = result;
  return result;
});

class Particle {
  constructor(x, y, size = random(13, 28), targetX = x, targetY = y) {
    this.x = x;
    this.y = y;
    this.targetX = targetX;
    this.targetY = targetY;
    this.baseX = targetX;
    this.baseY = targetY;
    this.size = size;
    this.rotation = random(-Math.PI, Math.PI);
    this.spin = random(-.002, .002);
    this.phase = random(0, TAU);
    this.speed = random(.0007, .002);
    this.tile = Math.floor(Math.random() * Math.max(1, tiles.length));
    this.tint = Math.random() > .82 ? sand : clay;
  }

  draw(context, time, scale = 1) {
    this.x += (this.targetX - this.x) * .075;
    this.y += (this.targetY - this.y) * .075;
    this.rotation += this.spin;
    const pulse = .55 + Math.sin(time * this.speed + this.phase) * .32;
    const driftX = Math.sin(time * .00055 + this.phase) * 2.5;
    const driftY = Math.cos(time * .00045 + this.phase) * 2.5;
    context.save();
    context.globalAlpha = clamp(pulse, .18, .92);
    context.translate(this.x + driftX, this.y + driftY);
    context.rotate(this.rotation);
    const size = this.size * scale * (.92 + pulse * .12);
    const tile = tiles[this.tile % Math.max(1, tiles.length)];
    if (tile) {
      const aspectScale = Math.sqrt(clamp(tile.aspect, .18, 5.5));
      const width = size * aspectScale;
      const height = size / aspectScale;
      context.drawImage(tile.canvas, -width / 2, -height / 2, width, height);
    } else {
      context.fillStyle = this.tint;
      context.beginPath();
      context.arc(0, 0, size * .2, 0, TAU);
      context.fill();
    }
    context.restore();
  }
}

function renderBackground(context, width, height) {
  context.fillStyle = ink;
  context.fillRect(0, 0, width, height);
  const glow = context.createRadialGradient(width / 2, height / 2, 20, width / 2, height / 2, width * .6);
  glow.addColorStop(0, "rgba(190,82,47,.12)");
  glow.addColorStop(1, "rgba(22,15,13,0)");
  context.fillStyle = glow;
  context.fillRect(0, 0, width, height);
}

function fillArchive() {
  const root = qs("#asset-marquee");
  [...banpoAssets.slice(0, 22), ...fishAssets.slice(0, 4)].forEach((src, index) => {
    const card = document.createElement("div");
    card.className = "asset-card";
    card.innerHTML = `<img src="${encodeURI(src)}" alt="半坡纹样 ${String(index + 1).padStart(2, "0")}" loading="lazy"><span>BP-${String(index + 1).padStart(3, "0")}</span>`;
    root.append(card);
  });
}
fillArchive();

if (location.protocol === "file:") {
  window.addEventListener("load", () => {
    toast("当前为直接预览模式；完整功能请双击“启动网站.bat”");
  });
}

// Collage mode
const portraitCanvas = qs("#portrait-canvas");
const portraitContext = portraitCanvas.getContext("2d");
const collageLibrary = (window.vectorMotifs || []).map((asset) => ({ ...asset, image: null }));
const palettes = {
  classic: { background: "#a94f32", ink: "#17120f", grid: "rgba(24,18,15,.1)", filter: "brightness(0)" },
  rubbing: { background: "#eee9dc", ink: "#151515", grid: "rgba(20,20,20,.08)", filter: "brightness(0)" },
  earth: { background: "#ddc59d", ink: "#813f2d", grid: "rgba(91,58,42,.09)", filter: "none" }
};
const collageState = {
  items: [],
  selected: -1,
  interaction: null,
  images: new Map(),
  skeleton: "ring",
  palette: "classic",
  history: [],
  historyIndex: -1,
  restoring: false
};
const arrayDefaults = {
  arrayType: "single",
  arrayCount: 5,
  arraySpacing: 110,
  arrayAngle: 0,
  arrayRadius: 150,
  arrayArc: 360,
  arrayRotate: "fixed",
  arrayColumns: 3,
  arrayRows: 3,
  arraySpacingX: 115,
  arraySpacingY: 100
};

function ensureArrayParams(item) {
  item.params = { ...arrayDefaults, ...(item.params || {}) };
  return item;
}

function appendCollageLibraryAsset(asset) {
  const button = document.createElement("button");
  button.className = "collage-asset";
  button.draggable = true;
  button.dataset.assetId = asset.id;
  button.innerHTML = `<img src="${asset.src}" alt="${asset.label}"><b>${asset.label}</b><small>${asset.note}</small>${asset.badge ? `<i class="asset-badge">${asset.badge}</i>` : ""}`;
  button.addEventListener("click", () => addCollageAsset(asset.id));
  button.addEventListener("dragstart", (event) => {
    event.dataTransfer.setData("text/banpo-asset", asset.id);
    event.dataTransfer.effectAllowed = "copy";
  });
  qs(`#${asset.group}-assets`).append(button);
  loadImage(asset.src).then((image) => {
    asset.image = image;
    collageState.images.set(asset.id, image);
  });
}

function populateCollageLibrary() {
  for (const asset of collageLibrary) appendCollageLibraryAsset(asset);
}

function readLocalMotif(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

qs("#custom-motif-upload").addEventListener("change", async (event) => {
  const files = [...(event.target.files || [])].slice(0, 12);
  if (!files.length) return;
  const added = [];
  for (const [index, file] of files.entries()) {
    if (!file.type.startsWith("image/")) continue;
    if (file.size > 8 * 1024 * 1024) {
      toast(`${file.name} 超过 8MB，已跳过`);
      continue;
    }
    const src = await readLocalMotif(file);
    const asset = {
      id: `custom-${Date.now()}-${index}`,
      label: `自定义 · ${file.name.replace(/\.[^.]+$/, "").slice(0, 12) || "纹样"}`,
      note: "用户本地上传",
      group: "motif",
      family: "custom",
      badge: "自定义",
      src,
      image: null
    };
    collageLibrary.push(asset);
    appendCollageLibraryAsset(asset);
    added.push(asset);
  }
  if (added.length) {
    activateLibrary("motif");
    await addCollageAsset(added[0].id);
    toast(`已加入 ${added.length} 个本地纹样`);
  }
  event.target.value = "";
});

qsa(".library-tabs button").forEach((button) => button.addEventListener("click", () => {
  qsa(".library-tabs button").forEach((item) => item.classList.toggle("active", item === button));
  qsa(".generator-library .collage-assets").forEach((tray) => tray.classList.toggle("active", tray.id === `${button.dataset.library}-assets`));
}));

function activateLibrary(group) {
  qsa(".library-tabs button").forEach((button) => button.classList.toggle("active", button.dataset.library === group));
  qsa(".generator-library .collage-assets").forEach((tray) => tray.classList.toggle("active", tray.id === `${group}-assets`));
}

function setWorkflowStep(step) {
  qsa(".creation-progress button").forEach((button) => button.classList.toggle("active", button.dataset.step === String(step)));
  if (step === 2) activateLibrary("motif");
  if (step === 3) activateLibrary("geometry");
  if (step === 4) activateLibrary("border");
}

qsa(".creation-progress button").forEach((button) => button.addEventListener("click", () => {
  const step = Number(button.dataset.step);
  setWorkflowStep(step);
  if (step === 1) qs(".workflow-panel").scrollIntoView({ behavior: "smooth", block: "center" });
  if (step >= 2 && step <= 4) qs(".generator-library").scrollIntoView({ behavior: "smooth", block: "center" });
}));

function canvasPoint(event) {
  const rect = portraitCanvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) / rect.width * portraitCanvas.width,
    y: (event.clientY - rect.top) / rect.height * portraitCanvas.height
  };
}

async function addCollageAsset(id, x = random(260, 640), y = random(190, 490), options = {}) {
  const autoPlace = arguments.length < 2;
  const asset = collageLibrary.find((entry) => entry.id === String(id));
  if (!asset) return;
  const image = asset.image || await loadImage(asset.src);
  asset.image = image;
  collageState.images.set(asset.id, image);
  const maxSide = asset.group === "motif" ? 220 : asset.group === "border" ? 270 : 175;
  const ratio = image.naturalWidth / image.naturalHeight;
  let baseWidth = ratio >= 1 ? maxSide : maxSide * ratio;
  let baseHeight = ratio >= 1 ? maxSide / ratio : maxSide;
  if (ratio > 3.5) {
    baseWidth = asset.group === "motif" ? 280 : 250;
    baseHeight = baseWidth / ratio;
  }
  collageState.items.push({
    assetId: asset.id,
    label: asset.label,
    image,
    x,
    y,
    baseWidth,
    baseHeight,
    scale: options.scale ?? 100,
    rotation: options.rotation ?? random(-12, 12) * Math.PI / 180,
    flip: options.flip ?? 1
    ,
    group: asset.group,
    params: {
      abstraction: options.abstraction ?? 0,
      faceEyes: options.faceEyes ?? "line",
      faceMouth: options.faceMouth ?? "line",
      deerMode: options.deerMode ?? "full",
      bend: options.bend ?? 45,
      density: options.density ?? 5,
      alternate: options.alternate ?? "single",
      thickness: options.thickness ?? 50,
      arrayType: options.arrayType ?? "single",
      arrayCount: options.arrayCount ?? 5,
      arraySpacing: options.arraySpacing ?? 110,
      arrayAngle: options.arrayAngle ?? 0,
      arrayRadius: options.arrayRadius ?? 150,
      arrayArc: options.arrayArc ?? 360,
      arrayRotate: options.arrayRotate ?? "fixed",
      arrayColumns: options.arrayColumns ?? 3,
      arrayRows: options.arrayRows ?? 3,
      arraySpacingX: options.arraySpacingX ?? 115,
      arraySpacingY: options.arraySpacingY ?? 100
    }
  });
  selectCollageItem(collageState.items.length - 1);
  setWorkflowStep(asset.group === "motif" ? 2 : asset.group === "geometry" ? 3 : 4);
  qs("#portrait-empty").classList.add("hidden");
  if (autoPlace) layoutCollageItems(false);
  updateSymbolReading();
  if (!options.silent) commitHistory();
}

function selectedCollageItem() {
  return collageState.items[collageState.selected] || null;
}

function selectCollageItem(index) {
  collageState.selected = index;
  const item = selectedCollageItem();
  qs("#parameter-empty").hidden = Boolean(item);
  qs("#parameter-content").hidden = !item;
  if (item) renderParameterPanel(ensureArrayParams(item));
}

function parameterRange(label, key, min, max, value, suffix = "") {
  return `<div class="parameter-control"><label>${label}<output>${Math.round(value)}${suffix}</output></label><input type="range" min="${min}" max="${max}" value="${value}" data-param="${key}" data-suffix="${suffix}"></div>`;
}

function arrayParameterControls(item) {
  const type = item.params.arrayType || "single";
  let controls = "";
  if (type === "linear") {
    controls = `
      ${parameterRange("阵列数量", "arrayCount", 2, 16, item.params.arrayCount)}
      ${parameterRange("元素间距", "arraySpacing", 30, 260, item.params.arraySpacing, "px")}
      ${parameterRange("阵列方向", "arrayAngle", -180, 180, item.params.arrayAngle, "°")}`;
  } else if (type === "ring") {
    controls = `
      ${parameterRange("环形数量", "arrayCount", 3, 20, item.params.arrayCount)}
      ${parameterRange("阵列半径", "arrayRadius", 45, 300, item.params.arrayRadius, "px")}
      ${parameterRange("覆盖角度", "arrayArc", 30, 360, item.params.arrayArc, "°")}
      <div class="parameter-control"><label>元素朝向</label><div class="segmented">
        <button data-mode="arrayRotate" data-value="fixed" class="${item.params.arrayRotate === "fixed" ? "active" : ""}">保持原向</button>
        <button data-mode="arrayRotate" data-value="path" class="${item.params.arrayRotate === "path" ? "active" : ""}">沿圆环旋转</button>
      </div></div>`;
  } else if (type === "grid") {
    controls = `
      ${parameterRange("横向数量", "arrayColumns", 2, 8, item.params.arrayColumns)}
      ${parameterRange("纵向数量", "arrayRows", 2, 8, item.params.arrayRows)}
      ${parameterRange("横向间距", "arraySpacingX", 30, 240, item.params.arraySpacingX, "px")}
      ${parameterRange("纵向间距", "arraySpacingY", 30, 220, item.params.arraySpacingY, "px")}`;
  }
  return `
    <div class="array-control">
      <label>阵列方式<small>整体移动、缩放与旋转</small></label>
      <div class="segmented array-types">
        <button data-mode="arrayType" data-value="single" class="${type === "single" ? "active" : ""}">单体</button>
        <button data-mode="arrayType" data-value="linear" class="${type === "linear" ? "active" : ""}">直线</button>
        <button data-mode="arrayType" data-value="ring" class="${type === "ring" ? "active" : ""}">环形</button>
        <button data-mode="arrayType" data-value="grid" class="${type === "grid" ? "active" : ""}">网格</button>
      </div>
    </div>
    <div class="array-parameters">${controls}</div>`;
}

function renderParameterPanel(item) {
  const asset = collageLibrary.find((entry) => entry.id === item.assetId);
  let specific = "";
  if (["fish", "fish-part", "face", "face-part"].includes(asset?.family)) {
    specific += parameterRange("抽象度", "abstraction", 0, 100, item.params.abstraction, "%");
  } else if (item.assetId === "deer") {
    specific += `<div class="parameter-control"><label>呈现模式</label><div class="segmented"><button data-mode="deerMode" data-value="full" class="${item.params.deerMode === "full" ? "active" : ""}">完整姿态</button><button data-mode="deerMode" data-value="antler" class="${item.params.deerMode === "antler" ? "active" : ""}">仅鹿角</button></div></div>`;
  } else if (item.assetId === "frog") {
    specific += parameterRange("屈曲度", "bend", 0, 100, item.params.bend, "%");
  } else if (item.group === "geometry") {
    specific += parameterRange("重复密度", "density", 1, 9, item.params.density);
    specific += `<div class="parameter-control"><label>排列模式</label><div class="segmented"><button data-mode="alternate" data-value="single" class="${item.params.alternate === "single" ? "active" : ""}">单一重复</button><button data-mode="alternate" data-value="alternate" class="${item.params.alternate === "alternate" ? "active" : ""}">AB 交替</button></div></div>`;
  } else if (item.group === "border") {
    specific += parameterRange("边框粗细", "thickness", 15, 100, item.params.thickness, "%");
  }
  qs("#parameter-content").innerHTML = `
    <div class="parameter-heading"><span>${item.group === "motif" ? "生物母题" : item.group === "geometry" ? "几何装饰" : "边框分隔"}</span><b>${item.label}</b><small>${asset?.note || "纹样积木"}</small></div>
    ${parameterRange("尺寸", "scale", 20, 260, item.scale, "%")}
    ${parameterRange("旋转", "rotation", -180, 180, item.rotation * 180 / Math.PI, "°")}
    ${arrayParameterControls(item)}
    ${specific}`;
  qsa("#parameter-content [data-param]").forEach((control) => control.addEventListener("input", () => {
    const current = selectedCollageItem();
    if (!current) return;
    const key = control.dataset.param;
    let value = control.value;
    if (control.type === "range") value = Number(value);
    if (key === "scale") current.scale = value;
    else if (key === "rotation") current.rotation = value * Math.PI / 180;
    else current.params[key] = value;
    keepItemInCanvas(current);
    const output = control.parentElement.querySelector("output");
    if (output) output.textContent = `${Math.round(value)}${control.dataset.suffix || ""}`;
  }));
  qsa("#parameter-content [data-param]").forEach((control) => control.addEventListener("change", commitHistory));
  qsa("#parameter-content [data-mode]").forEach((button) => button.addEventListener("click", () => {
    const current = selectedCollageItem();
    if (!current) return;
    current.params[button.dataset.mode] = button.dataset.value;
    keepItemInCanvas(current);
    renderParameterPanel(current);
    commitHistory();
  }));
}

function unitDimensions(item) {
  return {
    width: item.baseWidth * item.scale / 100,
    height: item.baseHeight * item.scale / 100
  };
}

function arrayPlacements(item) {
  ensureArrayParams(item);
  const type = item.params.arrayType || "single";
  const scaleFactor = item.scale / 100;
  if (type === "linear") {
    const count = Math.max(2, Math.round(item.params.arrayCount || 5));
    const spacing = (item.params.arraySpacing || 110) * scaleFactor;
    const angle = (item.params.arrayAngle || 0) * Math.PI / 180;
    return Array.from({ length: count }, (_, index) => {
      const offset = (index - (count - 1) / 2) * spacing;
      return { x: Math.cos(angle) * offset, y: Math.sin(angle) * offset, rotation: 0 };
    });
  }
  if (type === "ring") {
    const count = Math.max(3, Math.round(item.params.arrayCount || 5));
    const radius = (item.params.arrayRadius || 150) * scaleFactor;
    const arc = clamp(item.params.arrayArc || 360, 30, 360) * Math.PI / 180;
    const fullCircle = arc >= TAU - .001;
    const start = fullCircle ? -Math.PI / 2 : -Math.PI / 2 - arc / 2;
    const divisor = fullCircle ? count : Math.max(1, count - 1);
    return Array.from({ length: count }, (_, index) => {
      const angle = start + arc * index / divisor;
      return {
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
        rotation: item.params.arrayRotate === "path" ? angle + Math.PI / 2 : 0
      };
    });
  }
  if (type === "grid") {
    const columns = Math.max(2, Math.round(item.params.arrayColumns || 3));
    const rows = Math.max(2, Math.round(item.params.arrayRows || 3));
    const spacingX = (item.params.arraySpacingX || 115) * scaleFactor;
    const spacingY = (item.params.arraySpacingY || 100) * scaleFactor;
    const placements = [];
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        placements.push({
          x: (column - (columns - 1) / 2) * spacingX,
          y: (row - (rows - 1) / 2) * spacingY,
          rotation: 0
        });
      }
    }
    return placements;
  }
  return [{ x: 0, y: 0, rotation: 0 }];
}

function itemBounds(item) {
  const { width, height } = unitDimensions(item);
  const placements = arrayPlacements(item);
  const corners = [
    [-width / 2, -height / 2],
    [width / 2, -height / 2],
    [width / 2, height / 2],
    [-width / 2, height / 2]
  ];
  const bounds = { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity };
  for (const placement of placements) {
    const cos = Math.cos(placement.rotation);
    const sin = Math.sin(placement.rotation);
    for (const [cornerX, cornerY] of corners) {
      const x = placement.x + cornerX * cos - cornerY * sin;
      const y = placement.y + cornerX * sin + cornerY * cos;
      bounds.left = Math.min(bounds.left, x);
      bounds.right = Math.max(bounds.right, x);
      bounds.top = Math.min(bounds.top, y);
      bounds.bottom = Math.max(bounds.bottom, y);
    }
  }
  return bounds;
}

function itemDimensions(item) {
  const bounds = itemBounds(item);
  return {
    width: bounds.right - bounds.left,
    height: bounds.bottom - bounds.top,
    centerX: (bounds.left + bounds.right) / 2,
    centerY: (bounds.top + bounds.bottom) / 2,
    ...bounds
  };
}

function keepItemInCanvas(item, margin = 22) {
  const bounds = itemBounds(item);
  const corners = [
    [bounds.left, bounds.top],
    [bounds.right, bounds.top],
    [bounds.right, bounds.bottom],
    [bounds.left, bounds.bottom]
  ].map(([x, y]) => transformedPoint(item, x, y));
  const world = {
    left: Math.min(...corners.map((point) => point.x)),
    right: Math.max(...corners.map((point) => point.x)),
    top: Math.min(...corners.map((point) => point.y)),
    bottom: Math.max(...corners.map((point) => point.y))
  };
  const availableWidth = portraitCanvas.width - margin * 2;
  const availableHeight = portraitCanvas.height - margin * 2;
  if (world.right - world.left > availableWidth) item.x += portraitCanvas.width / 2 - (world.left + world.right) / 2;
  else if (world.left < margin) item.x += margin - world.left;
  else if (world.right > portraitCanvas.width - margin) item.x -= world.right - (portraitCanvas.width - margin);
  if (world.bottom - world.top > availableHeight) item.y += portraitCanvas.height / 2 - (world.top + world.bottom) / 2;
  else if (world.top < margin) item.y += margin - world.top;
  else if (world.bottom > portraitCanvas.height - margin) item.y -= world.bottom - (portraitCanvas.height - margin);
}

function localPoint(point, item) {
  const dx = point.x - item.x;
  const dy = point.y - item.y;
  const cos = Math.cos(-item.rotation);
  const sin = Math.sin(-item.rotation);
  return {
    x: dx * cos - dy * sin,
    y: dx * sin + dy * cos
  };
}

function transformedPoint(item, localX, localY) {
  const cos = Math.cos(item.rotation);
  const sin = Math.sin(item.rotation);
  return {
    x: item.x + localX * cos - localY * sin,
    y: item.y + localX * sin + localY * cos
  };
}

function findCollageItem(point) {
  for (let index = collageState.items.length - 1; index >= 0; index -= 1) {
    const item = collageState.items[index];
    const local = localPoint(point, item);
    const bounds = itemBounds(item);
    if (
      local.x >= bounds.left && local.x <= bounds.right
      && local.y >= bounds.top && local.y <= bounds.bottom
    ) return index;
  }
  return -1;
}

function handleAt(point, item) {
  const bounds = itemBounds(item);
  const resize = transformedPoint(item, bounds.right, bounds.bottom);
  const rotate = transformedPoint(item, (bounds.left + bounds.right) / 2, bounds.top - 34);
  if (Math.hypot(point.x - resize.x, point.y - resize.y) < 18) return "resize";
  if (Math.hypot(point.x - rotate.x, point.y - rotate.y) < 18) return "rotate";
  return null;
}

function drawParametricMotif(item, width, height, palette) {
  const ctx = portraitContext;
  const id = item.assetId;
  ctx.strokeStyle = palette.ink;
  ctx.fillStyle = palette.ink;
  ctx.lineWidth = Math.max(2, Math.min(width, height) * .035);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (id === "fish" || id === "fish-head") {
    const t = item.params.abstraction / 100;
    if (id === "fish-head") {
      ctx.beginPath();
      ctx.moveTo(-width * .4, 0); ctx.lineTo(width * .2, -height * (.42 - t * .16)); ctx.lineTo(width * .2, height * (.42 - t * .16)); ctx.closePath();
      ctx.moveTo(width * .2, -height * .42); ctx.lineTo(width * .46, 0); ctx.lineTo(width * .2, height * .42);
      ctx.stroke();
      ctx.beginPath(); ctx.arc(-width * .18, -height * .04, Math.max(3, height * .05), 0, TAU); ctx.fill();
      return true;
    }
    ctx.beginPath();
    if (t < .78) {
      ctx.moveTo(-width * .42, 0);
      ctx.quadraticCurveTo(-width * .12, -height * (.42 - t * .17), width * .28, -height * .18);
      ctx.lineTo(width * .46, -height * .38);
      ctx.lineTo(width * .46, height * .38);
      ctx.lineTo(width * .28, height * .18);
      ctx.quadraticCurveTo(-width * .12, height * (.42 - t * .17), -width * .42, 0);
      ctx.stroke();
    } else {
      ctx.moveTo(-width * .44, 0); ctx.lineTo(width * .05, -height * .35); ctx.lineTo(width * .05, height * .35); ctx.closePath();
      ctx.moveTo(width * .05, 0); ctx.lineTo(width * .45, -height * .34); ctx.lineTo(width * .45, height * .34); ctx.closePath();
      ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(-width * .23, -height * .05, Math.max(3, height * .045), 0, TAU); ctx.fill();
    return true;
  }
  if (id === "face") {
    ctx.beginPath(); ctx.arc(0, height * .06, Math.min(width, height) * .34, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-width * .17, -height * .25); ctx.lineTo(0, -height * .48); ctx.lineTo(width * .17, -height * .25); ctx.stroke();
    if (item.params.faceEyes === "dot") {
      ctx.beginPath(); ctx.arc(-width * .12, 0, height * .035, 0, TAU); ctx.arc(width * .12, 0, height * .035, 0, TAU); ctx.fill();
    } else {
      ctx.beginPath(); ctx.moveTo(-width * .2, 0); ctx.lineTo(-width * .06, 0); ctx.moveTo(width * .06, 0); ctx.lineTo(width * .2, 0); ctx.stroke();
    }
    ctx.beginPath();
    if (item.params.faceMouth === "x") {
      ctx.moveTo(-width * .14, height * .2); ctx.lineTo(width * .14, height * .34); ctx.moveTo(-width * .14, height * .34); ctx.lineTo(width * .14, height * .2);
    } else if (item.params.faceMouth === "teeth") {
      ctx.rect(-width * .16, height * .18, width * .32, height * .14);
      for (let x = -.1; x <= .1; x += .1) { ctx.moveTo(width * x, height * .18); ctx.lineTo(width * x, height * .32); }
    } else { ctx.moveTo(-width * .16, height * .25); ctx.lineTo(width * .16, height * .25); }
    ctx.stroke();
    return true;
  }
  if (id === "deer") {
    ctx.beginPath();
    ctx.moveTo(-width * .28, -.06 * height); ctx.lineTo(-width * .34, -height * .42);
    ctx.moveTo(-width * .34, -height * .3); ctx.lineTo(-width * .48, -height * .45);
    ctx.moveTo(-width * .34, -height * .25); ctx.lineTo(-width * .17, -height * .48);
    ctx.moveTo(-width * .4, -height * .35); ctx.lineTo(-width * .5, -height * .26);
    if (item.params.deerMode === "full") {
      ctx.moveTo(-width * .29, 0); ctx.quadraticCurveTo(0, -height * .18, width * .3, .02 * height);
      ctx.lineTo(width * .42, height * .37); ctx.moveTo(-width * .18, height * .1); ctx.lineTo(-width * .25, height * .44);
      ctx.moveTo(width * .18, height * .1); ctx.lineTo(width * .22, height * .44);
    }
    ctx.stroke(); return true;
  }
  if (id === "frog") {
    const bend = .18 + item.params.bend / 100 * .27;
    ctx.beginPath(); ctx.arc(0, 0, Math.min(width, height) * .2, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, -height * .28, height * .08, 0, TAU); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-width * .14, -.04 * height); ctx.lineTo(-width * bend, -height * .28); ctx.lineTo(-width * .48, -.08 * height);
    ctx.moveTo(-width * .14, .05 * height); ctx.lineTo(-width * bend, height * .3); ctx.lineTo(-width * .48, .1 * height);
    ctx.moveTo(width * .14, -.04 * height); ctx.lineTo(width * bend, -height * .28); ctx.lineTo(width * .48, -.08 * height);
    ctx.moveTo(width * .14, .05 * height); ctx.lineTo(width * bend, height * .3); ctx.lineTo(width * .48, .1 * height);
    ctx.stroke(); return true;
  }
  return false;
}

function drawCollageUnit(item, width, height, palette, asset) {
  const handled = ["deer", "frog"].includes(item.assetId) ? drawParametricMotif(item, width, height, palette) : false;
  if (!handled) {
    const repeat = item.group === "geometry" ? Math.max(1, Math.round(item.params.density)) : 1;
    const isBitmapMotif = ["fish", "fish-part", "face", "face-part"].includes(asset?.family);
    const abstraction = isBitmapMotif ? item.params.abstraction / 100 : 0;
    const drawHeight = item.group === "border"
      ? height * item.params.thickness / 50
      : height * (1 - abstraction * .22);
    portraitContext.filter = palette.filter;
    portraitContext.globalAlpha = 1 - abstraction * .12;
    portraitContext.imageSmoothingEnabled = abstraction < .72;
    for (let index = 0; index < repeat; index += 1) {
      const unitWidth = width / repeat;
      portraitContext.save();
      if (item.params.alternate === "alternate" && index % 2) portraitContext.scale(1, -1);
      portraitContext.drawImage(item.image, -width / 2 + index * unitWidth, -drawHeight / 2, unitWidth, drawHeight);
      portraitContext.restore();
    }
    portraitContext.filter = "none";
  }
}

function drawCollageItem(item) {
  const { width, height } = unitDimensions(item);
  const palette = palettes[collageState.palette];
  const asset = collageLibrary.find((entry) => entry.id === item.assetId);
  portraitContext.save();
  portraitContext.translate(item.x, item.y);
  portraitContext.rotate(item.rotation);
  for (const placement of arrayPlacements(item)) {
    portraitContext.save();
    portraitContext.translate(placement.x, placement.y);
    portraitContext.rotate(placement.rotation);
    portraitContext.scale(item.flip, 1);
    drawCollageUnit(item, width, height, palette, asset);
    portraitContext.restore();
  }
  portraitContext.restore();
}

function drawCollageSelection(item, time) {
  const bounds = itemBounds(item);
  const width = bounds.right - bounds.left;
  const height = bounds.bottom - bounds.top;
  const centerX = (bounds.left + bounds.right) / 2;
  const centerY = (bounds.top + bounds.bottom) / 2;
  const pulse = .72 + Math.sin(time * .004) * .2;
  portraitContext.save();
  portraitContext.translate(item.x, item.y);
  portraitContext.rotate(item.rotation);
  portraitContext.strokeStyle = `rgba(232,216,187,${pulse})`;
  portraitContext.lineWidth = 1.5;
  portraitContext.setLineDash([7, 5]);
  portraitContext.strokeRect(bounds.left - 8, bounds.top - 8, width + 16, height + 16);
  portraitContext.setLineDash([]);
  portraitContext.fillStyle = clayLight;
  portraitContext.fillRect(bounds.right - 6, bounds.bottom - 6, 12, 12);
  portraitContext.beginPath();
  portraitContext.moveTo(centerX, bounds.top - 8);
  portraitContext.lineTo(centerX, bounds.top - 34);
  portraitContext.stroke();
  portraitContext.beginPath();
  portraitContext.arc(centerX, bounds.top - 38, 7, 0, TAU);
  portraitContext.fill();
  portraitContext.restore();
}

function renderCollage(time = 0, showSelection = true, showGuide = true) {
  const palette = palettes[collageState.palette];
  portraitContext.fillStyle = palette.background;
  portraitContext.fillRect(0, 0, portraitCanvas.width, portraitCanvas.height);
  portraitContext.fillStyle = palette.grid;
  for (let x = 0; x < portraitCanvas.width; x += 45) portraitContext.fillRect(x, 0, 1, portraitCanvas.height);
  for (let y = 0; y < portraitCanvas.height; y += 45) portraitContext.fillRect(0, y, portraitCanvas.width, 1);
  if (showGuide) drawSkeletonGuide(portraitContext, collageState.skeleton, palette);
  collageState.items.forEach(drawCollageItem);
  const selected = selectedCollageItem();
  if (showSelection && selected) drawCollageSelection(selected, time);
}

function drawSkeletonGuide(context, skeleton, palette) {
  context.save();
  context.strokeStyle = collageState.palette === "rubbing" ? "rgba(20,20,20,.12)" : "rgba(245,225,195,.16)";
  context.lineWidth = 1;
  context.setLineDash([8, 8]);
  context.beginPath();
  if (skeleton === "ring") context.ellipse(450, 340, 290, 190, 0, 0, TAU);
  else if (skeleton === "radial") {
    context.arc(450, 340, 190, 0, TAU);
    for (let angle = 0; angle < TAU; angle += Math.PI / 4) { context.moveTo(450, 340); context.lineTo(450 + Math.cos(angle) * 270, 340 + Math.sin(angle) * 230); }
  } else if (skeleton === "diagonal") {
    context.moveTo(100, 580); context.lineTo(800, 100); context.moveTo(60, 500); context.lineTo(740, 40);
  } else context.arc(450, 340, 180, 0, TAU);
  context.stroke(); context.restore();
}

portraitCanvas.addEventListener("pointerdown", (event) => {
  const point = canvasPoint(event);
  const selected = selectedCollageItem();
  let mode = selected ? handleAt(point, selected) : null;
  let index = collageState.selected;
  if (!mode) {
    index = findCollageItem(point);
    selectCollageItem(index);
    mode = index >= 0 ? "move" : null;
  }
  if (!mode) return;
  const item = collageState.items[index];
  collageState.interaction = {
    mode,
    start: point,
    startX: item.x,
    startY: item.y,
    startScale: item.scale,
    startRotation: item.rotation,
    startDistance: Math.max(1, Math.hypot(point.x - item.x, point.y - item.y)),
    startAngle: Math.atan2(point.y - item.y, point.x - item.x)
  };
  portraitCanvas.setPointerCapture(event.pointerId);
});

portraitCanvas.addEventListener("pointermove", (event) => {
  if (!collageState.interaction) return;
  const item = selectedCollageItem();
  if (!item) return;
  const point = canvasPoint(event);
  const interaction = collageState.interaction;
  if (interaction.mode === "move") {
    item.x = clamp(interaction.startX + point.x - interaction.start.x, -100, portraitCanvas.width + 100);
    item.y = clamp(interaction.startY + point.y - interaction.start.y, -100, portraitCanvas.height + 100);
  } else if (interaction.mode === "resize") {
    const distance = Math.hypot(point.x - item.x, point.y - item.y);
    item.scale = clamp(interaction.startScale * distance / interaction.startDistance, 20, 260);
    const slider = qs('#parameter-content [data-param="scale"]');
    if (slider) slider.value = item.scale;
  } else if (interaction.mode === "rotate") {
    const angle = Math.atan2(point.y - item.y, point.x - item.x);
    item.rotation = interaction.startRotation + angle - interaction.startAngle;
    const slider = qs('#parameter-content [data-param="rotation"]');
    if (slider) slider.value = Math.round(item.rotation * 180 / Math.PI);
  }
});

const finishCollageInteraction = () => {
  if (collageState.interaction) commitHistory();
  collageState.interaction = null;
};
portraitCanvas.addEventListener("pointerup", finishCollageInteraction);
portraitCanvas.addEventListener("pointercancel", finishCollageInteraction);

const collageDropzone = qs("#collage-dropzone");
collageDropzone.addEventListener("dragover", (event) => {
  event.preventDefault();
  collageDropzone.classList.add("drag-over");
});
collageDropzone.addEventListener("dragleave", () => collageDropzone.classList.remove("drag-over"));
collageDropzone.addEventListener("drop", (event) => {
  event.preventDefault();
  collageDropzone.classList.remove("drag-over");
  const id = event.dataTransfer.getData("text/banpo-asset");
  const point = canvasPoint(event);
  addCollageAsset(id, point.x, point.y);
});

qs("#collage-flip").addEventListener("click", () => {
  const item = selectedCollageItem();
  if (item) { item.flip *= -1; commitHistory(); }
});
qs("#collage-front").addEventListener("click", () => {
  const index = collageState.selected;
  if (index < 0 || index === collageState.items.length - 1) return;
  const [item] = collageState.items.splice(index, 1);
  collageState.items.push(item);
  selectCollageItem(collageState.items.length - 1);
  commitHistory();
});
qs("#collage-back").addEventListener("click", () => {
  const index = collageState.selected;
  if (index <= 0) return;
  const [item] = collageState.items.splice(index, 1);
  collageState.items.unshift(item);
  selectCollageItem(0);
  commitHistory();
});
qs("#collage-duplicate").addEventListener("click", () => {
  const item = selectedCollageItem();
  if (!item) return;
  collageState.items.push({ ...item, params: { ...item.params }, x: item.x + 28, y: item.y + 28 });
  selectCollageItem(collageState.items.length - 1);
  commitHistory();
});
qs("#collage-delete").addEventListener("click", () => {
  if (collageState.selected < 0) return;
  collageState.items.splice(collageState.selected, 1);
  selectCollageItem(Math.min(collageState.selected, collageState.items.length - 1));
  qs("#portrait-empty").classList.toggle("hidden", collageState.items.length > 0);
  updateSymbolReading();
  commitHistory();
});

function clearCollage() {
  collageState.items = [];
  selectCollageItem(-1);
  qs("#portrait-empty").classList.remove("hidden");
  updateSymbolReading();
  commitHistory();
}
qs("#collage-clear").addEventListener("click", clearCollage);
qs("#collage-clear-secondary").addEventListener("click", clearCollage);

function serializeCollage() {
  return JSON.stringify({
    skeleton: collageState.skeleton,
    palette: collageState.palette,
    items: collageState.items.map(({ image, ...item }) => ({ ...item, params: { ...item.params } }))
  });
}

function commitHistory() {
  if (collageState.restoring) return;
  const snapshot = serializeCollage();
  if (collageState.history[collageState.historyIndex] === snapshot) return;
  collageState.history = collageState.history.slice(0, collageState.historyIndex + 1);
  collageState.history.push(snapshot);
  if (collageState.history.length > 40) collageState.history.shift();
  collageState.historyIndex = collageState.history.length - 1;
  qs("#collage-undo").disabled = collageState.historyIndex <= 0;
  qs("#collage-redo").disabled = true;
}

function restoreSnapshot(snapshot) {
  if (!snapshot) return;
  collageState.restoring = true;
  const data = JSON.parse(snapshot);
  collageState.skeleton = data.skeleton;
  collageState.palette = data.palette;
  collageState.items = data.items.map((item) => ({
    ...item,
    params: { ...arrayDefaults, ...item.params },
    image: collageState.images.get(item.assetId)
  })).filter((item) => item.image);
  selectCollageItem(-1);
  qs("#portrait-empty").classList.toggle("hidden", collageState.items.length > 0);
  qsa(".skeleton-card").forEach((button) => button.classList.toggle("active", button.dataset.skeleton === collageState.skeleton));
  qsa(".palette-button").forEach((button) => button.classList.toggle("active", button.dataset.palette === collageState.palette));
  qs("#skeleton-label").textContent = skeletonName(collageState.skeleton);
  updateSymbolReading();
  collageState.restoring = false;
}

qs("#collage-undo").addEventListener("click", () => {
  if (collageState.historyIndex <= 0) return;
  collageState.historyIndex -= 1;
  restoreSnapshot(collageState.history[collageState.historyIndex]);
  qs("#collage-undo").disabled = collageState.historyIndex <= 0;
  qs("#collage-redo").disabled = false;
});
qs("#collage-redo").addEventListener("click", () => {
  if (collageState.historyIndex >= collageState.history.length - 1) return;
  collageState.historyIndex += 1;
  restoreSnapshot(collageState.history[collageState.historyIndex]);
  qs("#collage-redo").disabled = collageState.historyIndex >= collageState.history.length - 1;
  qs("#collage-undo").disabled = false;
});

const skeletonName = (type) => ({
  ring: "环形带状骨架", radial: "扇形旋转骨架", diagonal: "对角线分割骨架", central: "中央独立符号"
}[type]);

function layoutCollageItems(commit = true) {
  const count = collageState.items.length;
  if (!count) return;
  collageState.items.forEach((item, index) => {
    const angle = index / count * TAU - Math.PI / 2;
    if (collageState.skeleton === "ring") {
      item.x = 450 + Math.cos(angle) * 285;
      item.y = 340 + Math.sin(angle) * 185;
      item.rotation = angle + Math.PI / 2;
      item.scale = Math.min(item.scale, 90);
    } else if (collageState.skeleton === "radial") {
      item.x = 450 + Math.cos(angle) * (90 + (index % 2) * 125);
      item.y = 340 + Math.sin(angle) * (75 + (index % 2) * 105);
      item.rotation = angle;
    } else if (collageState.skeleton === "diagonal") {
      const t = count === 1 ? .5 : index / (count - 1);
      item.x = 150 + t * 600;
      item.y = 540 - t * 400 + (index % 2 ? 65 : -35);
      item.rotation = -Math.PI / 5;
    } else {
      if (index === 0) { item.x = 450; item.y = 340; item.scale = Math.max(130, item.scale); item.rotation = 0; }
      else { item.x = 450 + Math.cos(angle) * 245; item.y = 340 + Math.sin(angle) * 175; item.scale = Math.min(75, item.scale); }
    }
  });
  if (commit) commitHistory();
}

qsa(".skeleton-card").forEach((button) => button.addEventListener("click", () => {
  collageState.skeleton = button.dataset.skeleton;
  qsa(".skeleton-card").forEach((item) => item.classList.toggle("active", item === button));
  qs("#skeleton-label").textContent = skeletonName(collageState.skeleton);
  layoutCollageItems();
}));
qs("#collage-layout").addEventListener("click", () => layoutCollageItems());

qsa(".palette-button").forEach((button) => button.addEventListener("click", () => {
  collageState.palette = button.dataset.palette;
  qsa(".palette-button").forEach((item) => item.classList.toggle("active", item === button));
  qsa(".creation-progress button").forEach((item) => item.classList.toggle("active", item.dataset.step === "5"));
  commitHistory();
}));

function updateSymbolReading() {
  const motifAssets = collageState.items
    .filter((item) => item.group === "motif")
    .map((item) => collageLibrary.find((asset) => asset.id === item.assetId));
  const families = new Set(motifAssets.map((asset) => asset?.family));
  let title = "等待你的第一个母题";
  let copy = "选择鱼、人面、鹿或蛙纹，系统会根据组合生成纹样解读。";
  const hasFish = families.has("fish") || families.has("fish-part");
  const hasFace = families.has("face") || families.has("face-part");
  if (hasFace && hasFish) {
    title = "生命之水 · 鱼灵系列";
    copy = "人面与鱼纹相遇，以水为媒，表达生命循环、群体记忆与先祖守护。";
  } else if (families.has("deer") && hasFish) {
    title = "水陆共生 · 丰饶系列";
    copy = "鹿的生长力量与鱼的水域生命并置，象征迁徙、繁衍与自然馈赠。";
  } else if (families.has("frog")) {
    title = "雨生万物 · 蛙灵系列";
    copy = "屈曲的四肢呼应水波与降雨，寓意土地苏醒和丰收愿望。";
  } else if (hasFace) {
    title = "先祖之面 · 守护系列";
    copy = "圆形面廓、冠饰与凝视构成中心符号，强调身份、共同体与精神守护。";
  } else if (hasFish) {
    title = "逐水而居 · 鱼纹系列";
    copy = "鱼纹连接水域生活与生殖崇拜，象征丰足、延续和生命流动。";
  } else if (families.has("deer")) {
    title = "枝角向天 · 鹿灵系列";
    copy = "多叉鹿角如生长的树枝，象征自然力量、季节轮回与蓬勃生命。";
  }
  qs("#symbol-title").textContent = title;
  qs("#symbol-copy").textContent = copy;
}
qs("#collage-random").addEventListener("click", async () => {
  collageState.items = [];
  const core = collageLibrary.filter((asset) => asset.group === "motif");
  const geometry = collageLibrary.filter((asset) => asset.group === "geometry");
  const border = collageLibrary.filter((asset) => asset.group === "border");
  const choices = [pick(core), pick(core), ...Array.from({ length: 4 }, () => pick(geometry)), pick(border), pick(border)];
  for (let index = 0; index < choices.length; index += 1) {
    await addCollageAsset(
      choices[index].id,
      450,
      340,
      { scale: random(65, 115), rotation: 0, silent: true }
    );
  }
  layoutCollageItems(false);
  updateSymbolReading();
  commitHistory();
  toast("已生成一组随机半坡拼贴");
});
qs("#portrait-download").addEventListener("click", () => {
  renderCollage(performance.now(), false, false);
  downloadCanvas(portraitCanvas, "半坡拼贴");
});

qs("#pattern-export").addEventListener("click", () => {
  renderCollage(performance.now(), false, false);
  const output = document.createElement("canvas");
  output.width = 1800; output.height = 1360;
  const context = output.getContext("2d");
  for (let y = 0; y < 2; y += 1) for (let x = 0; x < 2; x += 1) context.drawImage(portraitCanvas, x * 900, y * 680);
  downloadCanvas(output, "半坡四方连续");
});

qs("#save-design").addEventListener("click", () => {
  localStorage.setItem("banpo-design", serializeCollage());
  toast("设计已保存到当前浏览器");
});
qs("#load-design").addEventListener("click", () => {
  const saved = localStorage.getItem("banpo-design");
  if (!saved) return toast("还没有保存过设计");
  restoreSnapshot(saved); commitHistory(); toast("已读取上次设计");
});

qs("#keyword-generate").addEventListener("click", async () => {
  const keyword = qs("#keyword-input").value.trim();
  if (!keyword) return toast("先输入一个灵感关键词");
  const ids = [];
  if (/水|生命|流动|海|河/.test(keyword)) ids.push("fish", "wave", "circle");
  if (/太阳|光|祖先|守护/.test(keyword)) ids.push("face", "circle", "triangle-solid");
  if (/力量|生长|森林|迁徙/.test(keyword)) ids.push("deer", "zigzag", "strings");
  if (/丰收|雨|土地|种子/.test(keyword)) ids.push("frog", "dot", "grid");
  if (!ids.length) ids.push(pick(["fish", "face", "deer", "frog"]), pick(["zigzag", "wave", "grid"]), "double-line");
  collageState.items = [];
  for (const id of ids) await addCollageAsset(id, 450, 340, { scale: random(75, 120), silent: true });
  layoutCollageItems(false); updateSymbolReading(); commitHistory();
  toast(`已将“${keyword}”转译为半坡纹样`);
});

function drawMockupVessel(type, context, canvas) {
  context.clearRect(0, 0, canvas.width, canvas.height);
  const gradient = context.createRadialGradient(350, 250, 30, 350, 250, 310);
  gradient.addColorStop(0, "#d78557");
  gradient.addColorStop(1, "#71301f");
  context.fillStyle = gradient;
  context.beginPath();
  if (type === "pointed-bottle") {
    context.moveTo(310, 45);
    context.quadraticCurveTo(350, 28, 390, 45);
    context.lineTo(397, 135);
    context.bezierCurveTo(500, 185, 515, 335, 420, 410);
    context.quadraticCurveTo(365, 455, 350, 505);
    context.quadraticCurveTo(335, 455, 280, 410);
    context.bezierCurveTo(185, 335, 200, 185, 303, 135);
    context.closePath();
  } else if (type === "fish-bowl") {
    context.moveTo(150, 130);
    context.bezierCurveTo(165, 335, 220, 440, 350, 465);
    context.bezierCurveTo(480, 440, 535, 335, 550, 130);
    context.closePath();
  } else {
    context.moveTo(115, 155);
    context.bezierCurveTo(155, 350, 235, 425, 350, 440);
    context.bezierCurveTo(465, 425, 545, 350, 585, 155);
    context.closePath();
  }
  context.fill();
  context.save();
  context.clip();
  context.globalAlpha = .94;
  if (type === "pointed-bottle") context.drawImage(portraitCanvas, 205, 175, 290, 220);
  else if (type === "fish-bowl") context.drawImage(portraitCanvas, 145, 205, 410, 205);
  else context.drawImage(portraitCanvas, 115, 190, 470, 210);
  context.restore();
  context.strokeStyle = "#32150f";
  context.lineWidth = 16;
  context.beginPath();
  if (type === "pointed-bottle") {
    context.ellipse(350, 48, 42, 12, 0, 0, TAU);
    context.moveTo(255, 220); context.quadraticCurveTo(195, 250, 245, 305);
    context.moveTo(445, 220); context.quadraticCurveTo(505, 250, 455, 305);
  } else {
    context.ellipse(350, type === "fish-bowl" ? 132 : 156, type === "fish-bowl" ? 200 : 235, 28, 0, 0, TAU);
  }
  context.stroke();
}

function openMockupPreview() {
  let modal = qs("#mockup-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "mockup-modal";
    modal.className = "mockup-modal";
    modal.innerHTML = `<div class="mockup-dialog"><button class="mockup-close">×</button><div class="mockup-copy"><span class="chapter">应用预览</span><h3>半坡代表陶器</h3><p>选择器形，将当前画布实时映射到器物腹部。预览采用半坡遗址中最具代表性的三类陶器。</p><div class="vessel-options"><button class="active" data-vessel="face-basin"><b>人面鱼纹彩陶盆</b><small>半坡代表性彩陶盆</small></button><button data-vessel="pointed-bottle"><b>小口尖底瓶</b><small>半坡汲水器代表</small></button><button data-vessel="fish-bowl"><b>鱼纹彩陶钵</b><small>鱼纹生活器代表</small></button></div></div><canvas width="700" height="520"></canvas></div>`;
    document.body.append(modal);
    qs(".mockup-close", modal).addEventListener("click", () => modal.classList.remove("show"));
    qsa("[data-vessel]", modal).forEach((button) => button.addEventListener("click", () => {
      qsa("[data-vessel]", modal).forEach((item) => item.classList.toggle("active", item === button));
      renderCollage(performance.now(), false, false);
      drawMockupVessel(button.dataset.vessel, qs("canvas", modal).getContext("2d"), qs("canvas", modal));
    }));
  }
  modal.classList.add("show");
  renderCollage(performance.now(), false, false);
  const canvas = qs("canvas", modal);
  const context = canvas.getContext("2d");
  const selected = qs("[data-vessel].active", modal)?.dataset.vessel || "face-basin";
  drawMockupVessel(selected, context, canvas);
}
qs("#mockup-open").addEventListener("click", openMockupPreview);

function animatePortrait(time) {
  renderCollage(time, true);
  requestAnimationFrame(animatePortrait);
}

populateCollageLibrary();
selectCollageItem(-1);
commitHistory();

// Drawing mode
if (false) {
const drawCanvas = qs("#draw-canvas");
const drawContext = drawCanvas.getContext("2d");
const drawMask = document.createElement("canvas");
drawMask.width = drawMask.height = 190;
const drawMaskContext = drawMask.getContext("2d", { willReadFrequently: true });
const drawState = { drawing: false, brush: 72, density: 58, particles: [], last: null, dirty: false };

function pointerPosition(event) {
  const rect = drawCanvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) / rect.width * 190,
    y: (event.clientY - rect.top) / rect.height * 190
  };
}

function drawStroke(from, to) {
  drawMaskContext.strokeStyle = "#fff";
  drawMaskContext.lineWidth = drawState.brush / 4;
  drawMaskContext.lineCap = "round";
  drawMaskContext.lineJoin = "round";
  drawMaskContext.beginPath();
  drawMaskContext.moveTo(from.x, from.y);
  drawMaskContext.lineTo(to.x, to.y);
  drawMaskContext.stroke();
  drawState.dirty = true;
}

function rebuildDrawParticles() {
  const pixels = drawMaskContext.getImageData(0, 0, 190, 190).data;
  const points = [];
  const stride = Math.max(3, Math.round(9 - drawState.density / 14));
  for (let y = 1; y < 189; y += stride) {
    for (let x = 1; x < 189; x += stride) {
      if (pixels[(y * 190 + x) * 4 + 3] > 20 && Math.random() < .86) points.push({ x, y });
    }
  }
  const previous = drawState.particles;
  drawState.particles = points.slice(0, 720).map((point, index) => {
    const targetX = point.x / 190 * 760;
    const targetY = point.y / 190 * 760;
    const existing = previous[index];
    if (existing) {
      existing.targetX = targetX;
      existing.targetY = targetY;
      existing.baseX = targetX;
      existing.baseY = targetY;
      return existing;
    }
    return new Particle(targetX + random(-18, 18), targetY + random(-18, 18), random(12, 26), targetX, targetY);
  });
}

drawCanvas.addEventListener("pointerdown", (event) => {
  drawState.drawing = true;
  drawState.last = pointerPosition(event);
  drawCanvas.setPointerCapture(event.pointerId);
  qs("#draw-hint").classList.add("hidden");
});
drawCanvas.addEventListener("pointermove", (event) => {
  if (!drawState.drawing) return;
  const point = pointerPosition(event);
  drawStroke(drawState.last, point);
  drawState.last = point;
});
const finishDrawing = () => {
  if (!drawState.drawing) return;
  drawState.drawing = false;
  rebuildDrawParticles();
};
drawCanvas.addEventListener("pointerup", finishDrawing);
drawCanvas.addEventListener("pointercancel", finishDrawing);

function clearDrawing() {
  drawMaskContext.clearRect(0, 0, 190, 190);
  drawState.particles = [];
  qs("#draw-hint").classList.remove("hidden");
}

function templatePath(type) {
  clearDrawing();
  drawMaskContext.save();
  drawMaskContext.strokeStyle = "#fff";
  drawMaskContext.fillStyle = "#fff";
  drawMaskContext.lineWidth = 12;
  drawMaskContext.lineCap = "round";
  drawMaskContext.lineJoin = "round";
  if (type === "fish") {
    drawMaskContext.beginPath();
    drawMaskContext.ellipse(93, 96, 58, 31, 0, 0, TAU);
    drawMaskContext.moveTo(38, 96);
    drawMaskContext.lineTo(12, 69);
    drawMaskContext.lineTo(12, 123);
    drawMaskContext.closePath();
    drawMaskContext.stroke();
    drawMaskContext.beginPath();
    drawMaskContext.arc(130, 88, 4, 0, TAU);
    drawMaskContext.fill();
  } else if (type === "spiral") {
    drawMaskContext.beginPath();
    for (let t = 0; t < TAU * 3; t += .08) {
      const radius = 5 + t * 4;
      const x = 95 + Math.cos(t) * radius;
      const y = 95 + Math.sin(t) * radius;
      t === 0 ? drawMaskContext.moveTo(x, y) : drawMaskContext.lineTo(x, y);
    }
    drawMaskContext.stroke();
  } else if (type === "pot") {
    drawMaskContext.beginPath();
    drawMaskContext.moveTo(48, 47);
    drawMaskContext.quadraticCurveTo(42, 126, 71, 150);
    drawMaskContext.quadraticCurveTo(95, 163, 119, 150);
    drawMaskContext.quadraticCurveTo(148, 126, 142, 47);
    drawMaskContext.closePath();
    drawMaskContext.stroke();
    drawMaskContext.beginPath();
    drawMaskContext.ellipse(95, 48, 47, 11, 0, 0, TAU);
    drawMaskContext.stroke();
  }
  drawMaskContext.restore();
  rebuildDrawParticles();
  qs("#draw-hint").classList.add("hidden");
}

qsa(".template-btn").forEach((button) => button.addEventListener("click", () => {
  qsa(".template-btn").forEach((item) => item.classList.toggle("active", item === button));
  if (button.dataset.template === "free") clearDrawing();
  else templatePath(button.dataset.template);
}));
bindRange("brush-size", (value) => { drawState.brush = value; });
bindRange("draw-density", (value) => { drawState.density = value; rebuildDrawParticles(); });
qs("#draw-clear").addEventListener("click", clearDrawing);
qs("#draw-download").addEventListener("click", () => downloadCanvas(drawCanvas, "半坡造形"));

function animateDraw(time) {
  renderBackground(drawContext, 760, 760);
  drawState.particles.forEach((particle) => particle.draw(drawContext, time));
  if (drawState.drawing && drawState.dirty) {
    drawState.dirty = false;
    rebuildDrawParticles();
  }
  requestAnimationFrame(animateDraw);
}

// Camera expression mode
if (false) {
const cameraVideo = qs("#camera-video");
const expressionCanvas = qs("#expression-canvas");
const expressionContext = expressionCanvas.getContext("2d");
const expressionState = {
  active: false,
  stream: null,
  landmarker: null,
  particles: [],
  scores: { smile: 0, mouth: 0, blinkLeft: 0, blinkRight: 0 },
  lastVideoTime: -1,
  label: "静候"
};

function categoryScore(categories, name) {
  return categories?.find((item) => item.categoryName === name)?.score || 0;
}

function makeFaceTargets(scores) {
  const points = [];
  const cx = 450;
  const cy = 330;
  const rx = 225;
  const ry = 275;
  const addArc = (x, y, rX, rY, start, end, count, curve = 0) => {
    for (let i = 0; i < count; i++) {
      const t = start + (end - start) * i / Math.max(1, count - 1);
      points.push({ x: x + Math.cos(t) * rX, y: y + Math.sin(t) * rY + Math.sin(t * 2) * curve });
    }
  };
  addArc(cx, cy, rx, ry, 0, TAU, 90);
  addArc(cx, cy + 5, rx * .78, ry * .82, .18, Math.PI - .18, 34);
  const blinkL = clamp(scores.blinkLeft * 1.8, 0, 1);
  const blinkR = clamp(scores.blinkRight * 1.8, 0, 1);
  const eye = (x, y, blink) => {
    const eyeRy = 28 * (1 - blink) + 3;
    addArc(x, y, 55, eyeRy, 0, TAU, 22);
  };
  eye(360, 285, blinkL);
  eye(540, 285, blinkR);
  addArc(360, 225, 66, 18, Math.PI * 1.12, Math.PI * 1.88, 13);
  addArc(540, 225, 66, 18, Math.PI * 1.12, Math.PI * 1.88, 13);
  addArc(cx, 350, 25, 62, .15, Math.PI - .15, 13);
  const smile = clamp(scores.smile * 1.7, 0, 1);
  const mouthOpen = clamp(scores.mouth * 1.8, 0, 1);
  const mouthY = 455;
  const mouthWidth = 90 + smile * 70;
  const mouthHeight = 10 + mouthOpen * 65 + smile * 14;
  addArc(cx, mouthY - smile * 6, mouthWidth, mouthHeight, 0, TAU, 34, smile * 18);
  if (mouthOpen > .22) addArc(cx, mouthY, mouthWidth * .66, mouthHeight * .55, 0, TAU, 18);
  return points;
}

function updateExpressionParticles(targets) {
  const old = expressionState.particles;
  expressionState.particles = targets.map((target, index) => {
    const particle = old[index] || new Particle(450 + random(-100, 100), 340 + random(-100, 100), random(13, 28));
    particle.targetX = target.x;
    particle.targetY = target.y;
    particle.baseX = target.x;
    particle.baseY = target.y;
    return particle;
  });
}

function setExpressionLabel(scores) {
  let name = "平静";
  let detail = "纹样随呼吸轻微浮动";
  if (scores.mouth > .42) { name = "惊讶"; detail = "嘴部张开，粒子向外扩展"; }
  else if (scores.smile > .32) { name = "微笑"; detail = "嘴角上扬，鱼纹舒展"; }
  else if (scores.blinkLeft > .42 || scores.blinkRight > .42) { name = "眨眼"; detail = "眼部纹样短暂收拢"; }
  expressionState.label = name;
  qs("#expression-name").textContent = name;
  qs("#expression-detail").textContent = detail;
}

async function initFaceLandmarker() {
  if (expressionState.landmarker) return expressionState.landmarker;
  qs("#expression-detail").textContent = "正在载入面部识别组件…";
  const visionTasks = await import(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/+esm"
  );
  const vision = await visionTasks.FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm"
  );
  expressionState.landmarker = await visionTasks.FaceLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task",
      delegate: "GPU"
    },
    outputFaceBlendshapes: true,
    runningMode: "VIDEO",
    numFaces: 1
  });
  return expressionState.landmarker;
}

async function toggleCamera() {
  const button = qs("#camera-toggle");
  if (expressionState.active) {
    expressionState.stream?.getTracks().forEach((track) => track.stop());
    expressionState.active = false;
    cameraVideo.srcObject = null;
    qs("#camera-off").classList.remove("hidden");
    qs("#expression-dot").classList.remove("live");
    button.innerHTML = "开启摄像头 <span>●</span>";
    qs("#expression-name").textContent = "静候";
    qs("#expression-detail").textContent = "等待面部信号";
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    toast("当前浏览器不支持摄像头访问");
    return;
  }
  try {
    button.disabled = true;
    button.textContent = "正在准备…";
    await initFaceLandmarker();
    expressionState.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false
    });
    cameraVideo.srcObject = expressionState.stream;
    await cameraVideo.play();
    expressionState.active = true;
    qs("#camera-off").classList.add("hidden");
    qs("#expression-dot").classList.add("live");
    button.innerHTML = "关闭摄像头 <span>■</span>";
    toast("摄像头已开启，试试微笑或眨眼");
  } catch (error) {
    console.error(error);
    toast(error.name === "NotAllowedError" ? "未获得摄像头权限" : "摄像头或识别模型启动失败");
    qs("#expression-name").textContent = "未连接";
    qs("#expression-detail").textContent = "请检查权限后重试";
    button.innerHTML = "重新开启 <span>●</span>";
  } finally {
    button.disabled = false;
  }
}
qs("#camera-toggle").addEventListener("click", toggleCamera);
window.addEventListener("beforeunload", () => expressionState.stream?.getTracks().forEach((track) => track.stop()));

function detectExpression(time) {
  if (!expressionState.active || !expressionState.landmarker || cameraVideo.readyState < 2) return;
  if (cameraVideo.currentTime === expressionState.lastVideoTime) return;
  expressionState.lastVideoTime = cameraVideo.currentTime;
  const result = expressionState.landmarker.detectForVideo(cameraVideo, time);
  const categories = result.faceBlendshapes?.[0]?.categories;
  if (!categories) {
    qs("#expression-name").textContent = "寻找面孔";
    qs("#expression-detail").textContent = "请面向镜头并保持适当距离";
    return;
  }
  const raw = {
    smile: (categoryScore(categories, "mouthSmileLeft") + categoryScore(categories, "mouthSmileRight")) / 2,
    mouth: categoryScore(categories, "jawOpen"),
    blinkLeft: categoryScore(categories, "eyeBlinkLeft"),
    blinkRight: categoryScore(categories, "eyeBlinkRight")
  };
  for (const key of Object.keys(raw)) expressionState.scores[key] += (raw[key] - expressionState.scores[key]) * .35;
  setExpressionLabel(expressionState.scores);
}

function animateExpression(time) {
  renderBackground(expressionContext, 900, 680);
  detectExpression(time);
  const targets = makeFaceTargets(expressionState.scores);
  updateExpressionParticles(targets);
  expressionState.particles.forEach((particle) => particle.draw(expressionContext, time, 1.05));
  expressionContext.strokeStyle = "rgba(226,122,77,.16)";
  expressionContext.lineWidth = 1;
  expressionContext.beginPath();
  expressionContext.arc(450, 330, 305 + Math.sin(time * .001) * 5, 0, TAU);
  expressionContext.stroke();
  requestAnimationFrame(animateExpression);
}
}

}
tileReady.then(() => {
  requestAnimationFrame(animatePortrait);
});
