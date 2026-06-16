// Banpo "Soul Mirror": local camera analysis and cultural particle rendering.
const spiritVideo = qs("#camera-video");
const spiritCanvas = qs("#expression-canvas");
const spiritContext = spiritCanvas.getContext("2d");
const spiritStage = qs("#expression-stage");
const spiritPhoto = qs("#fallback-photo");
const spiritSpriteSources = {
  fish: [44, 45, 47, 48, 49, 52, 53].map((id) => `./public/materials/derived/fish-full-${id}.png`),
  wave: Array.from({ length: 6 }, (_, index) => `./public/materials/derived/water-spiral-${index + 1}.png`)
};
const spiritSprites = { fish: [], wave: [] };
for (const [type, sources] of Object.entries(spiritSpriteSources)) {
  Promise.all(sources.map(loadImage)).then((images) => { spiritSprites[type] = images; });
}

const spiritPalettes = [
  { key: "clay", name: "红陶模式", bg: "#a94f32", ink: "#17100d", accent: "#682c22", paper: "#dfb178" },
  { key: "rubbing", name: "拓片模式", bg: "#e8dfce", ink: "#111111", accent: "#625b52", paper: "#f7f1e7" },
  { key: "earth", name: "大地模式", bg: "#b89568", ink: "#38251c", accent: "#7a3d2c", paper: "#e5d1a9" }
];

const spiritState = {
  active: false,
  stream: null,
  landmarker: null,
  particles: [],
  scores: {
    mouth: 0, smile: 0,
    browLeft: 0, browRight: 0,
    blinkLeft: 0, blinkRight: 0,
    wideLeft: 0, wideRight: 0,
    squintLeft: 0, squintRight: 0,
    gazeX: 0, gazeY: 0,
    browDownLeft: 0, browDownRight: 0,
    poseX: 0, poseY: 0
  },
  scoreHistory: [],
  eyeState: "平静凝视",
  closedSince: { left: 0, right: 0, both: 0 },
  wideSince: 0,
  squintSmileSince: 0,
  blinkEvents: [],
  previousBlink: { left: false, right: false, both: false },
  eyeEasterEgg: "",
  eyeEasterUntil: 0,
  lastVideoTime: -1,
  lastDetection: 0,
  lastExpressionAt: performance.now(),
  sessionStartedAt: 0,
  label: "平静的面具",
  palette: 0,
  density: 1,
  performanceMode: false,
  eyeStyle: "round",
  browStyle: "triangle",
  visible: { forehead: true, brows: true, eyes: true, nose: true, mouth: true },
  meditation: false,
  faceCount: 0,
  mouthOpenSince: 0,
  easterEgg: "",
  recorder: null,
  recordedChunks: [],
  recordingStartedAt: 0,
  recordingTimer: 0,
  fallbackUrl: ""
};

function spiritCategoryScore(categories, name) {
  return categories?.find((item) => item.categoryName === name)?.score || 0;
}

function addSpiritArc(points, config) {
  const {
    x, y, rx, ry, start = 0, end = TAU, count = 12,
    glyph = "dot", region = "face", size = 14, angleOffset = 0, wave = 0,
    layer = "base", tone = 1
  } = config;
  for (let i = 0; i < count; i++) {
    const t = start + (end - start) * i / Math.max(1, count - 1);
    points.push({
      x: x + Math.cos(t) * rx,
      y: y + Math.sin(t) * ry + Math.sin(t * 2) * wave,
      glyph: typeof glyph === "function" ? glyph(i) : glyph,
      region,
      size: typeof size === "function" ? size(i) : size,
      angle: t + Math.PI / 2 + angleOffset,
      layer,
      tone
    });
  }
}

function addSpiritLine(points, x1, y1, x2, y2, count, glyph, region, size = 14, layer = "base", tone = 1) {
  for (let i = 0; i < count; i++) {
    const t = i / Math.max(1, count - 1);
    points.push({
      x: x1 + (x2 - x1) * t,
      y: y1 + (y2 - y1) * t,
      glyph,
      region,
      size,
      angle: Math.atan2(y2 - y1, x2 - x1),
      layer,
      tone
    });
  }
}

function territoryMap(cx, cy) {
  const gap = 8;
  return {
    spirit: { left: cx - 38, right: cx + 38, top: cy - 154, bottom: cy - 92 },
    browLeft: { left: cx - 198, right: cx - gap, top: cy - 174, bottom: cy - 93 },
    browRight: { left: cx + gap, right: cx + 198, top: cy - 174, bottom: cy - 93 },
    eyeLeft: { left: cx - 198, right: cx - 40, top: cy - 86, bottom: cy - 17 },
    eyeRight: { left: cx + 40, right: cx + 198, top: cy - 86, bottom: cy - 17 },
    eyeTearLeft: { left: cx - 188, right: cx - 58, top: cy - 20, bottom: cy + 115 },
    eyeTearRight: { left: cx + 58, right: cx + 188, top: cy - 20, bottom: cy + 115 },
    nose: { left: cx - 32, right: cx + 32, top: cy - 28, bottom: cy + 122 },
    mouth: { left: cx - 205, right: cx + 205, top: cy + 132, bottom: cy + 235 },
    mouthBurst: { left: cx - 245, right: cx + 245, top: cy + 120, bottom: cy + 250 },
    smile: { left: cx - 245, right: cx + 245, top: cy + 122, bottom: cy + 232 }
  };
}

function applySpiritTerritories(points, cx, cy) {
  const territories = territoryMap(cx, cy);
  return points.map((point) => ({
    ...point,
    bounds: territories[point.region] || null,
    tone: point.tone ?? (
      point.region.startsWith("eye") ? 1
        : point.region.startsWith("brow") ? .82
          : ["mouth", "mouthBurst", "smile"].includes(point.region) ? .92 : .7
    )
  }));
}

function coordinatedScores(time) {
  const history = spiritState.scoreHistory;
  const snapshotAt = (delay) => {
    for (let index = history.length - 1; index >= 0; index -= 1) {
      if (history[index].time <= time - delay) return history[index].scores;
    }
    return spiritState.scores;
  };
  const eye = snapshotAt(0);
  const brow = snapshotAt(50);
  const mouth = snapshotAt(100);
  return {
    ...eye,
    browLeft: brow.browLeft,
    browRight: brow.browRight,
    browDownLeft: brow.browDownLeft,
    browDownRight: brow.browDownRight,
    mouth: mouth.mouth,
    smile: mouth.smile
  };
}

function updateEyeDynamics(raw, time) {
  const leftClosed = raw.blinkLeft > .66 || spiritState.eyeStyle === "closed";
  const rightClosed = raw.blinkRight > .66 || spiritState.eyeStyle === "closed";
  const bothClosed = leftClosed && rightClosed;
  const averageWide = (raw.wideLeft + raw.wideRight) / 2;
  const averageSquint = (raw.squintLeft + raw.squintRight) / 2;

  if (bothClosed && !spiritState.previousBlink.both) {
    spiritState.blinkEvents.push({ side: "both", time });
  } else if (!bothClosed) {
    for (const [side, closed] of [["left", leftClosed], ["right", rightClosed]]) {
      if (closed && !spiritState.previousBlink[side]) {
        spiritState.blinkEvents.push({ side, time });
      }
    }
  }
  for (const [side, closed] of [["left", leftClosed], ["right", rightClosed]]) {
    spiritState.previousBlink[side] = closed;
    spiritState.closedSince[side] = closed ? spiritState.closedSince[side] || time : 0;
  }
  spiritState.previousBlink.both = bothClosed;
  spiritState.closedSince.both = bothClosed ? spiritState.closedSince.both || time : 0;
  spiritState.blinkEvents = spiritState.blinkEvents.filter((event) => time - event.time < 2400);

  const recent = spiritState.blinkEvents;
  const lastTwo = recent.slice(-2);
  if (
    lastTwo.length === 2
    && !lastTwo.some((event) => event.side === "both")
    && lastTwo[0].side !== lastTwo[1].side
    && time - lastTwo[0].time < 1250
  ) {
    spiritState.eyeEasterEgg = "dreamWatch";
    spiritState.eyeEasterUntil = time + 1500;
    spiritState.blinkEvents = [];
  } else if (recent.length >= 3 && time - recent[recent.length - 3].time < 2100) {
    spiritState.eyeEasterEgg = "twinFish";
    spiritState.eyeEasterUntil = time + 1800;
    spiritState.blinkEvents = [];
  }

  spiritState.wideSince = averageWide > .42 ? spiritState.wideSince || time : 0;
  spiritState.squintSmileSince = averageSquint > .34 && raw.smile > .42
    ? spiritState.squintSmileSince || time : 0;

  if (bothClosed && time - spiritState.closedSince.both > 15000) {
    spiritState.eyeEasterEgg = "dream";
    spiritState.eyeEasterUntil = time + 300;
  } else if (bothClosed && time - spiritState.closedSince.both > 5000) {
    spiritState.eyeEasterEgg = "closedFish";
    spiritState.eyeEasterUntil = time + 300;
  } else if (spiritState.squintSmileSince && time - spiritState.squintSmileSince > 3000) {
    spiritState.eyeEasterEgg = "waterEyes";
    spiritState.eyeEasterUntil = time + 300;
  } else if (spiritState.wideSince && time - spiritState.wideSince > 5000) {
    spiritState.eyeEasterEgg = "tears";
    spiritState.eyeEasterUntil = time + 300;
  } else if (time > spiritState.eyeEasterUntil) {
    spiritState.eyeEasterEgg = "";
  }

  const oneClosed = leftClosed !== rightClosed;
  if (bothClosed) {
    spiritState.eyeState = time - spiritState.closedSince.both > 15000
      ? "梦境鱼群"
      : time - spiritState.closedSince.both > 5000 ? "闭目内观" : "持续闭眼";
  } else if (oneClosed) {
    spiritState.eyeState = leftClosed ? "左眼单眨" : "右眼单眨";
  } else if (raw.smile > .34 && averageSquint > .14) {
    spiritState.eyeState = "月牙笑眼";
  } else if (averageWide > .32) {
    spiritState.eyeState = "警觉瞪眼";
  } else if (averageSquint > .32) {
    spiritState.eyeState = "聚焦眯眼";
  } else if (Math.abs(raw.gazeX) > .24) {
    spiritState.eyeState = raw.gazeX > 0 ? "向右侧目" : "向左侧目";
  } else {
    spiritState.eyeState = "平静凝视";
  }

  let choreography = "眼 0ms → 眉 50ms → 嘴 100ms";
  if (oneClosed) choreography = "眼区独占 400ms";
  else if (averageWide > .3 && Math.max(raw.browLeft, raw.browRight) > .28 && raw.mouth > .25) {
    choreography = "惊讶：眼 → 眉 → 嘴";
  } else if (raw.smile > .35) choreography = "喜悦：眼嘴同弧 · 眉轻扬";
  else if (averageSquint > .34 && Math.max(raw.browDownLeft, raw.browDownRight) > .28) {
    choreography = "专注：眼眉同步向内";
  }
  qs("#eye-state-label").textContent = spiritState.eyeState;
  qs("#territory-state").textContent = "五区隔离 · 留白 8px";
  qs("#choreography-state").textContent = choreography;
}

function makeSpiritTargets(scores, time = 0) {
  const points = [];
  const cx = 550 + scores.poseX * 48;
  const cy = 372 + scores.poseY * 24;
  const rx = 238;
  const ry = 292;
  const density = spiritState.density * (spiritState.performanceMode ? .58 : 1);
  const count = (value) => Math.max(2, Math.round(value * density));
  const pulse = Math.sin(time * .002) * 2;
  const blinkL = clamp(scores.blinkLeft * 1.35, 0, 1);
  const blinkR = clamp(scores.blinkRight * 1.35, 0, 1);
  const wideL = clamp(scores.wideLeft * 1.35, 0, 1);
  const wideR = clamp(scores.wideRight * 1.35, 0, 1);
  const squintL = clamp(scores.squintLeft * 1.35, 0, 1);
  const squintR = clamp(scores.squintRight * 1.35, 0, 1);
  const gazeX = clamp(scores.gazeX, -1, 1);
  const gazeY = clamp(scores.gazeY, -1, 1);
  const smile = clamp(scores.smile * 1.55, 0, 1);
  const mouth = clamp(scores.mouth * 1.45, 0, 1);
  const browL = clamp(scores.browLeft * 1.45, 0, 1);
  const browR = clamp(scores.browRight * 1.45, 0, 1);
  const browDownL = clamp(scores.browDownLeft * 1.4, 0, 1);
  const browDownR = clamp(scores.browDownRight * 1.4, 0, 1);

  addSpiritArc(points, {
    x: cx, y: cy, rx, ry, count: count(76),
    glyph: (i) => i % 7 === 0 ? "fish" : i % 3 === 0 ? "triangle" : "dot",
    region: "face", size: (i) => i % 7 === 0 ? 19 : 11
  });
  addSpiritLine(points, cx - 84, cy - ry + 20, cx, cy - ry - 70, count(10), "triangle", "crown", 17);
  addSpiritLine(points, cx, cy - ry - 70, cx + 84, cy - ry + 20, count(10), "triangle", "crown", 17);

  // Forehead grid: order and thought.
  if (spiritState.visible.forehead) {
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < Math.round(8 * density); col++) {
        points.push({
          x: cx - 105 + col * (210 / Math.max(1, Math.round(8 * density) - 1)) + (row % 2) * 6,
          y: cy - 222 + row * 27 + pulse,
          glyph: "grid", region: "forehead", size: 16, angle: 0
        });
      }
    }
    addSpiritArc(points, {
      x: cx, y: cy - 120, rx: 28, ry: 28, count: count(10),
      glyph: "diamond", region: "spirit", size: 16
    });
  }

  const addBrow = (x, side, value, down) => {
    const lift = value * 42 - down * 25;
    const inward = down * (side === "browLeft" ? 16 : -16);
    if (spiritState.browStyle === "straight") {
      addSpiritLine(points, x - 68 + inward, cy - 112 - lift, x + 68 + inward, cy - 112 - lift, count(17), "line", side, 13 + value * 7, "brow", .82);
      return;
    }
    const style = {
      triangle: { ry: 25, glyph: (i) => i % 3 === 0 ? "diamond" : "triangle", size: 14 },
      willow: { ry: 12, glyph: "wave", size: 12 },
      crescent: { ry: 34, glyph: "diamond", size: 12 }
    }[spiritState.browStyle];
    addSpiritArc(points, {
      x: x + inward, y: cy - 104 - lift, rx: 78 - down * 12, ry: style.ry + value * 9,
      start: Math.PI * 1.08, end: Math.PI * 1.92, count: count(18),
      glyph: style.glyph, region: side, size: style.size + value * 10, layer: "brow", tone: .82
    });
  };
  if (spiritState.visible.brows) {
    addBrow(cx - 105, "browLeft", browL, browDownL);
    addBrow(cx + 105, "browRight", browR, browDownR);
  }

  const addEye = (x, side, blink, wide, squint, isLeft) => {
    const forcedClosed = spiritState.eyeStyle === "closed";
    const closed = forcedClosed || blink > .68;
    const smiling = !closed && smile > .32;
    const narrowed = !closed && (squint > .38 || spiritState.eyeStyle === "line");
    const opened = !closed && wide > .32;
    const mode = closed ? "closed" : smiling ? "smile" : narrowed ? "squint" : opened ? "wide" : "normal";
    const heights = { round: 29, dot: 25, danfeng: 23, almond: 21, line: 8, arc: 19, closed: 3 };
    const widths = { round: 66, dot: 62, danfeng: 74, almond: 70, line: 65, arc: 68, closed: 65 };
    let eyeHeight = heights[spiritState.eyeStyle] || 26;
    let eyeWidth = widths[spiritState.eyeStyle] || 66;
    if (mode === "wide") { eyeHeight *= 1.55; eyeWidth *= 1.08; }
    if (mode === "squint") { eyeHeight *= .32; eyeWidth *= .94; }
    if (mode === "smile") eyeHeight *= .48;
    if (mode === "closed") eyeHeight = 2.5;
    const outlineCount = count(mode === "wide" ? 28 : mode === "closed" ? 8 : mode === "squint" ? 14 : 18);
    const eyeY = cy - 55;
    const outlineGlyph = spiritState.eyeStyle === "dot" ? "dot"
      : spiritState.eyeStyle === "round" ? "circle"
        : spiritState.eyeStyle === "arc" || mode === "smile" || mode === "closed" ? "arc" : "line";
    if (spiritState.eyeStyle === "danfeng" && !closed) {
      const total = outlineCount;
      for (let i = 0; i < total; i++) {
        const angle = i / Math.max(1, total - 1) * TAU;
        const outer = Math.max(0, (isLeft ? -1 : 1) * Math.cos(angle));
        points.push({
          x: x + Math.cos(angle) * eyeWidth,
          y: eyeY + Math.sin(angle) * eyeHeight - outer * 14,
          glyph: outlineGlyph, region: side, size: 12 + wide * 4 + squint * 3, angle,
          layer: "outline", tone: 1
        });
      }
    } else {
      addSpiritArc(points, {
        x, y: eyeY + (mode === "smile" ? 7 : 0), rx: eyeWidth, ry: eyeHeight,
        start: mode === "smile" || mode === "closed" ? Math.PI : 0,
        end: mode === "smile" || mode === "closed" ? TAU : TAU,
        count: outlineCount, glyph: outlineGlyph, region: side,
        size: 12 + wide * 4 + squint * 3, layer: "outline", tone: 1
      });
    }

    // Eye core: a stable soul anchor with two-step gaze displacement.
    const coreVisible = !closed;
    const coreX = x + gazeX * 24;
    const coreY = eyeY + gazeY * 11;
    if (coreVisible) {
      const coreGlyph = spiritState.eyeStyle === "round" ? "ring" : "dot";
      points.push({
        x: coreX, y: coreY, glyph: coreGlyph, region: side,
        size: mode === "wide" ? 8 : mode === "squint" ? 11 : 14,
        angle: 0, layer: "core", tone: 1.08
      });
      addSpiritArc(points, {
        x: coreX, y: coreY, rx: 18, ry: 18, count: count(5),
        glyph: "dot", region: side, size: 6, layer: "core", tone: 1.04
      });
    } else {
      points.push({
        x, y: eyeY + 2, glyph: "ring", region: side, size: 10,
        angle: 0, layer: "inner-eye", tone: .55
      });
    }

    // Eye halo: deliberately sparse and always slower than the core.
    const haloCount = count(mode === "wide" ? 7 : mode === "closed" ? 6 : 4);
    addSpiritArc(points, {
      x, y: eyeY, rx: eyeWidth + 12, ry: Math.max(12, eyeHeight + 12), count: haloCount,
      glyph: "halo", region: side, size: mode === "closed" ? 24 : 17,
      angleOffset: time * .0003 * (isLeft ? 1 : -1), layer: "halo", tone: .7
    });

    if (mode === "smile") {
      for (let i = 0; i < count(4); i++) {
        points.push({
          x: x + (isLeft ? -1 : 1) * (eyeWidth + 8 + i * 7),
          y: eyeY - 4 - i * 3, glyph: "line", region: side, size: 8,
          angle: (isLeft ? -1 : 1) * .75, layer: "smile-tail", tone: .95
        });
      }
    }
    return mode;
  };
  if (spiritState.visible.eyes) {
    addEye(cx - 112, "eyeLeft", blinkL, wideL, squintL, true);
    addEye(cx + 112, "eyeRight", blinkR, wideR, squintR, false);

    const eyeCenters = [
      { x: cx - 112, region: "eyeLeft", tearRegion: "eyeTearLeft", direction: -1 },
      { x: cx + 112, region: "eyeRight", tearRegion: "eyeTearRight", direction: 1 }
    ];
    if (spiritState.eyeEasterEgg === "twinFish") {
      for (const eye of eyeCenters) {
        for (let i = 0; i < count(6); i++) {
          const angle = i / count(6) * TAU + time * .002 * eye.direction;
          points.push({
            x: eye.x + Math.cos(angle) * 28,
            y: cy - 55 + Math.sin(angle) * 17,
            glyph: "fish", region: eye.region, size: 10, angle,
            layer: "core", tone: 1.08
          });
        }
      }
    } else if (spiritState.eyeEasterEgg === "tears") {
      for (const eye of eyeCenters) {
        for (let i = 0; i < count(7); i++) {
          const fall = (time * .055 + i * 22) % 125;
          points.push({
            x: eye.x + eye.direction * (28 + i * 5),
            y: cy - 14 + fall,
            glyph: "dot", region: eye.tearRegion, size: 7 + i % 2,
            angle: 0, layer: "halo", tone: .92
          });
        }
      }
    } else if (spiritState.eyeEasterEgg === "waterEyes") {
      for (const eye of eyeCenters) {
        addSpiritLine(points, eye.x - 55, cy - 59, eye.x + 55, cy - 51, count(12), "wave", eye.region, 9, "outline", 1.05);
      }
    } else if (["closedFish", "dream"].includes(spiritState.eyeEasterEgg)) {
      for (const eye of eyeCenters) {
        for (let i = 0; i < count(spiritState.eyeEasterEgg === "dream" ? 10 : 2); i++) {
          const angle = i / count(spiritState.eyeEasterEgg === "dream" ? 10 : 2) * TAU + time * .0008;
          points.push({
            x: eye.x + Math.cos(angle) * (40 + i % 3 * 7),
            y: cy - 54 + Math.sin(angle) * 20,
            glyph: "fish", region: eye.region, size: 9 + i % 3,
            angle, layer: "halo", tone: .86
          });
        }
      }
      if (spiritState.eyeEasterEgg === "dream") {
        points.push({
          x: cx, y: cy - 122, glyph: "arc", region: "spirit",
          size: 30, angle: Math.PI / 2, layer: "core", tone: 1
        });
      }
    } else if (spiritState.eyeEasterEgg === "dreamWatch") {
      const awakeLeft = blinkR > blinkL;
      points.push({
        x: cx + (awakeLeft ? -112 : 112), y: cy - 55,
        glyph: "ring", region: awakeLeft ? "eyeLeft" : "eyeRight",
        size: 28, angle: 0, layer: "core", tone: 1.1
      });
    }
  }

  // Nose strings: the vertical life pillar.
  if (spiritState.visible.nose) {
    addSpiritLine(points, cx - 13, cy - 25, cx - 19, cy + 105, count(13), "line", "nose", 17);
    addSpiritLine(points, cx + 13, cy - 25, cx + 19, cy + 105, count(13), "line", "nose", 17);
    addSpiritArc(points, {
      x: cx, y: cy + 108, rx: 34, ry: 13, start: 0, end: Math.PI,
      count: count(8), glyph: "diamond", region: "nose", size: 12
    });
  }

  const mouthWidth = 105 + smile * 78;
  const mouthHeight = 9 + mouth * 72 + smile * 12;
  if (spiritState.visible.mouth) {
    addSpiritArc(points, {
      x: cx, y: cy + 172 - smile * 12, rx: mouthWidth, ry: mouthHeight,
      count: count(38), glyph: (i) => i % 4 === 0 ? "fish" : "wave",
      region: "mouth", size: (i) => i % 4 === 0 ? 22 + mouth * 9 : 16,
      wave: smile * 20
    });
    if (mouth > .18) {
      addSpiritArc(points, {
        x: cx, y: cy + 172, rx: mouthWidth * .64, ry: mouthHeight * .55,
        count: count(20), glyph: (i) => i % 2 ? "fish" : "dot",
        region: "mouth", size: 17 + mouth * 12
      });
    }
  }

  const mouthBurst = spiritState.visible.mouth ? Math.round(count(45) * Math.max(0, mouth - .25)) : 0;
  for (let i = 0; i < mouthBurst; i++) {
    const angle = i / Math.max(1, mouthBurst) * TAU + time * .0007;
    const distance = 115 + mouth * 180 + (i % 5) * 18;
    points.push({
      x: cx + Math.cos(angle) * distance,
      y: cy + 172 + Math.sin(angle) * distance * .55,
      glyph: i % 3 === 0 ? "wave" : "fish", region: "mouthBurst",
      size: 16 + (i % 4) * 3, angle
    });
  }
  const smileFish = spiritState.visible.mouth ? Math.round(count(22) * smile) : 0;
  for (let i = 0; i < smileFish; i++) {
    const side = i % 2 ? -1 : 1;
    points.push({
      x: cx + side * (mouthWidth + 24 + (i % 6) * 23),
      y: cy + 150 - Math.sin(i * .7 + time * .002) * (25 + smile * 30),
      glyph: i % 3 ? "wave" : "fish", region: "smile", size: 16 + smile * 10,
      angle: side > 0 ? 0 : Math.PI
    });
  }

  if (spiritState.meditation) {
    for (let i = 0; i < count(24); i++) {
      const progress = (i / count(24) + time * .000035) % 1;
      points.push({
        x: -80 + progress * 1260,
        y: 120 + Math.sin(progress * TAU * 2) * 45,
        glyph: "fish", region: "meditation", size: 20 + (i % 4) * 3, angle: 0
      });
    }
  }
  if (spiritState.easterEgg === "fishStorm") {
    for (let i = 0; i < count(110); i++) {
      const progress = (i / count(110) + time * .00012) % 1;
      points.push({
        x: -100 + progress * 1320,
        y: 80 + (i * 67 % 600) + Math.sin(i + time * .003) * 28,
        glyph: "fish", region: "easter", size: 17 + (i % 6) * 4, angle: 0
      });
    }
  } else if (spiritState.easterEgg === "sun") {
    for (let i = 0; i < count(38); i++) {
      const angle = i / count(38) * TAU + time * .0008;
      const distance = 48 + (i % 2) * 42;
      points.push({
        x: cx + Math.cos(angle) * distance,
        y: cy - 120 + Math.sin(angle) * distance,
        glyph: i % 2 ? "triangle" : "diamond", region: "easter",
        size: 19, angle
      });
    }
  }
  return applySpiritTerritories(points, cx, cy);
}

class SpiritParticle {
  constructor(target) {
    this.x = 550 + random(-170, 170);
    this.y = 380 + random(-170, 170);
    this.vx = random(-1, 1);
    this.vy = random(-1, 1);
    this.seed = random(0, 1000);
    this.opacity = random(.55, 1);
    this.setTarget(target);
  }

  setTarget(target) {
    this.targetX = target.x;
    this.targetY = target.y;
    this.glyph = target.glyph;
    this.region = target.region;
    this.size = target.size;
    this.angle = target.angle || 0;
    this.bounds = target.bounds;
    this.layer = target.layer || "base";
    this.tone = target.tone ?? 1;
  }

  draw(context, time) {
    const active = ["mouthBurst", "smile", "easter"].includes(this.region);
    const layerStiffness = {
      core: .105,
      outline: .07,
      "inner-eye": .08,
      "smile-tail": .06,
      brow: .055,
      halo: .026
    }[this.layer];
    const stiffness = layerStiffness || (active ? .034 : spiritState.meditation ? .018 : .06);
    this.vx += (this.targetX - this.x) * stiffness;
    this.vy += (this.targetY - this.y) * stiffness;
    this.vx *= active ? .86 : .78;
    this.vy *= active ? .86 : .78;
    this.x += this.vx;
    this.y += this.vy;
    const drift = this.layer === "core" ? .45 : this.layer === "halo" ? 3.5 : spiritState.meditation ? 4 : 2.2;
    const breathe = Math.sin(time * .0017 + this.seed) * drift;
    const drawX = this.x + Math.cos(this.seed) * breathe;
    const drawY = this.y + Math.sin(this.seed) * breathe;
    let territoryOpacity = 1;
    if (this.bounds) {
      if (
        drawX <= this.bounds.left || drawX >= this.bounds.right
        || drawY <= this.bounds.top || drawY >= this.bounds.bottom
      ) {
        territoryOpacity = 0;
      } else {
        const edgeDistance = Math.min(
          drawX - this.bounds.left,
          this.bounds.right - drawX,
          drawY - this.bounds.top,
          this.bounds.bottom - drawY
        );
        territoryOpacity = clamp(edgeDistance / 7, 0, 1);
      }
    }
    if (!territoryOpacity) return;
    drawSpiritGlyph(
      context,
      this.glyph,
      drawX,
      drawY,
      this.size * (1 + Math.sin(time * .002 + this.seed) * .05),
      this.angle,
      clamp(this.opacity * territoryOpacity * this.tone, 0, 1)
    );
  }
}

function drawSpiritGlyph(context, glyph, x, y, size, angle, opacity) {
  const palette = spiritPalettes[spiritState.palette];
  context.save();
  context.translate(x, y);
  context.rotate(angle);
  context.globalAlpha = opacity;
  if (glyph === "halo") {
    const halo = context.createRadialGradient(0, 0, 0, 0, 0, size);
    halo.addColorStop(0, `${palette.paper}88`);
    halo.addColorStop(.45, `${palette.paper}35`);
    halo.addColorStop(1, `${palette.paper}00`);
    context.fillStyle = halo;
    context.fillRect(-size, -size, size * 2, size * 2);
    context.restore();
    return;
  }
  if ((glyph === "fish" || glyph === "wave") && spiritSprites[glyph].length) {
    const sprites = spiritSprites[glyph];
    const index = Math.abs(Math.floor(x * .17 + y * .11 + size)) % sprites.length;
    const image = sprites[index];
    const aspect = image.naturalWidth / Math.max(1, image.naturalHeight);
    const width = glyph === "fish" ? size * 2.8 : size * 2.15;
    const height = Math.min(size * 1.45, width / Math.max(.35, aspect));
    context.filter = spiritState.palette === 0
      ? "brightness(.24) saturate(.65)"
      : spiritState.palette === 1 ? "grayscale(1) brightness(.16)" : "sepia(.6) brightness(.52)";
    context.drawImage(image, -width / 2, -height / 2, width, height);
    context.restore();
    return;
  }
  context.strokeStyle = palette.ink;
  context.fillStyle = glyph === "wave" || glyph === "diamond" ? palette.accent : palette.ink;
  context.lineWidth = Math.max(1.4, size * .12);
  context.lineCap = "round";
  context.lineJoin = "round";
  context.beginPath();
  if (glyph === "fish") {
    context.moveTo(-size * .55, 0);
    context.quadraticCurveTo(0, -size * .38, size * .45, 0);
    context.quadraticCurveTo(0, size * .38, -size * .55, 0);
    context.moveTo(size * .42, 0);
    context.lineTo(size * .78, -size * .36);
    context.lineTo(size * .78, size * .36);
    context.closePath();
    context.stroke();
    context.beginPath();
    context.arc(-size * .28, -size * .04, Math.max(1.2, size * .07), 0, TAU);
    context.fill();
  } else if (glyph === "wave") {
    context.moveTo(-size, 0);
    context.quadraticCurveTo(-size * .5, -size * .5, 0, 0);
    context.quadraticCurveTo(size * .5, size * .5, size, 0);
    context.stroke();
  } else if (glyph === "triangle") {
    context.moveTo(0, -size * .55);
    context.lineTo(size * .52, size * .45);
    context.lineTo(-size * .52, size * .45);
    context.closePath();
    context.fill();
  } else if (glyph === "diamond") {
    context.moveTo(0, -size * .6);
    context.lineTo(size * .5, 0);
    context.lineTo(0, size * .6);
    context.lineTo(-size * .5, 0);
    context.closePath();
    context.fill();
  } else if (glyph === "circle" || glyph === "ring" || glyph === "dot") {
    context.arc(0, 0, glyph === "dot" ? size * .24 : size * .48, 0, TAU);
    glyph === "dot" ? context.fill() : context.stroke();
    if (glyph === "ring") {
      context.beginPath();
      context.arc(0, 0, size * .2, 0, TAU);
      context.stroke();
    }
  } else if (glyph === "line") {
    context.moveTo(0, -size * .7);
    context.lineTo(0, size * .7);
    context.stroke();
  } else if (glyph === "arc") {
    context.moveTo(-size * .65, size * .18);
    context.quadraticCurveTo(0, -size * .5, size * .65, size * .18);
    context.stroke();
  } else if (glyph === "grid") {
    context.rect(-size * .55, -size * .55, size * 1.1, size * 1.1);
    context.moveTo(-size * .55, 0);
    context.lineTo(size * .55, 0);
    context.moveTo(0, -size * .55);
    context.lineTo(0, size * .55);
    context.stroke();
  }
  context.restore();
}

function updateSpiritParticles(targets) {
  const limitedTargets = targets.slice(0, spiritState.performanceMode ? 1500 : 5000);
  const old = spiritState.particles;
  spiritState.particles = limitedTargets.map((target, index) => {
    const particle = old[index] || new SpiritParticle(target);
    particle.setTarget(target);
    return particle;
  });
}

function setSpiritReading(scores) {
  let name = spiritState.meditation ? "平静的面具" : "庄重的人面";
  let detail = spiritState.meditation ? "静止五秒，鱼群进入冥想巡游" : "纹样随呼吸轻微浮动";
  let reading = "庄重的人面纹缓慢呼吸，等待你的情绪唤醒鱼群与几何符号。";
  const oneEye = Math.abs(scores.blinkLeft - scores.blinkRight) > .42
    && Math.max(scores.blinkLeft, scores.blinkRight) > .55;
  if (spiritState.faceCount > 1) {
    name = "双生鱼灵";
    detail = "两张面孔让鱼群彼此游动";
    reading = "双人模式已开启，鱼群穿行于两张面孔之间，象征交流与相遇。";
  } else if (spiritState.easterEgg === "fishStorm") {
    name = "鱼灵出游";
    detail = "持续张嘴唤醒了全屏鱼群";
    reading = "口衔鱼的古老意象被完全激活，鱼群从表达之门涌出并巡游归来。";
  } else if (spiritState.easterEgg === "sun") {
    name = "太阳之眼";
    detail = "微笑与挑眉共同点亮眉心";
    reading = "喜悦与发现叠加，眉心菱形裂变为太阳放射纹，象征丰收与力量。";
  } else if (scores.mouth > .42) {
    name = "吞吐的鱼灵";
    detail = "鱼形粒子从口部扩散";
    reading = "呼应人面鱼纹中口衔鱼的姿态，表达与滋养化作向外游动的鱼群。";
  } else if (scores.smile > .3) {
    name = "欢乐的游鱼";
    detail = "水波上扬，鱼纹从嘴角游出";
    reading = "喜悦如游鱼般灵动，水波沿嘴角上扬，形成生命流动的节奏。";
  } else if (scores.browLeft > .35 || scores.browRight > .35) {
    name = "警觉的三角";
    detail = "眉部三角纹上浮并放大";
    reading = "三角纹从眉部升起，回应先民面对自然时的警觉、观察与发现。";
  } else if (oneEye) {
    name = "单目的巫面";
    detail = "一侧眼纹化为旋转圆圈";
    reading = "不对称的单目纹制造神秘的通灵状态，是眨一只眼触发的隐藏面具。";
  } else if (scores.blinkLeft > .42 || scores.blinkRight > .42) {
    name = "灵光一现";
    detail = "眼部圆圈纹聚拢后回弹";
    reading = "圆目在闭合瞬间聚拢，又迅速恢复，像短暂出现的灵光。";
  }
  spiritState.label = name;
  qs("#expression-name").textContent = name;
  qs("#expression-detail").textContent = detail;
  qs("#mirror-reading-title").textContent = name;
  qs("#mirror-reading-copy").textContent = reading;
  qs("#session-emotion").textContent = name;
}

async function initSpiritLandmarker() {
  if (spiritState.landmarker) return spiritState.landmarker;
  qs("#expression-detail").textContent = "正在载入面部识别组件…";
  const visionTasks = await import(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/+esm"
  );
  const vision = await visionTasks.FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm"
  );
  const options = {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task",
      delegate: "GPU"
    },
    outputFaceBlendshapes: true,
    runningMode: "VIDEO",
    numFaces: 2
  };
  try {
    spiritState.landmarker = await visionTasks.FaceLandmarker.createFromOptions(vision, options);
  } catch {
    options.baseOptions.delegate = "CPU";
    spiritState.landmarker = await visionTasks.FaceLandmarker.createFromOptions(vision, options);
  }
  return spiritState.landmarker;
}

function stopSpiritCamera() {
  spiritState.stream?.getTracks().forEach((track) => track.stop());
  spiritState.stream = null;
  spiritState.active = false;
  spiritVideo.srcObject = null;
  qs("#camera-off").classList.remove("hidden");
  qs("#expression-dot").classList.remove("live");
  qs("#camera-toggle").innerHTML = "开启灵魂镜像 <span>●</span>";
}

async function toggleSpiritCamera() {
  const button = qs("#camera-toggle");
  if (spiritState.active) {
    stopSpiritCamera();
    qs("#expression-name").textContent = "平静的面具";
    qs("#expression-detail").textContent = "摄像头已关闭，面具仍在呼吸";
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    toast("当前浏览器不支持摄像头访问，可上传照片体验");
    return;
  }
  try {
    button.disabled = true;
    button.textContent = "正在准备…";
    await initSpiritLandmarker();
    spiritState.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false
    });
    spiritVideo.srcObject = spiritState.stream;
    await spiritVideo.play();
    spiritState.active = true;
    spiritState.sessionStartedAt = performance.now();
    spiritState.lastExpressionAt = performance.now();
    spiritPhoto.classList.remove("visible");
    qs("#camera-off").classList.add("hidden");
    qs("#mirror-intro").classList.add("hidden");
    qs("#expression-dot").classList.add("live");
    button.innerHTML = "关闭摄像头 <span>■</span>";
    toast("摄像头已开启，试试微笑、眨眼、挑眉或张嘴");
  } catch (error) {
    console.error(error);
    toast(error.name === "NotAllowedError" ? "未获得摄像头权限，可上传照片体验" : "摄像头或识别模型启动失败");
    qs("#expression-name").textContent = "未连接";
    qs("#expression-detail").textContent = "请检查权限，或上传正面照片";
    button.innerHTML = "重新开启 <span>●</span>";
  } finally {
    button.disabled = false;
  }
}

function detectSpiritExpression(time) {
  if (!spiritState.active || !spiritState.landmarker || spiritVideo.readyState < 2) return;
  const interval = spiritState.performanceMode ? 66 : 40;
  if (time - spiritState.lastDetection < interval || spiritVideo.currentTime === spiritState.lastVideoTime) return;
  spiritState.lastDetection = time;
  spiritState.lastVideoTime = spiritVideo.currentTime;
  const result = spiritState.landmarker.detectForVideo(spiritVideo, time);
  spiritState.faceCount = result.faceLandmarks?.length || 0;
  const categories = result.faceBlendshapes?.[0]?.categories;
  if (!categories) {
    qs("#expression-name").textContent = "寻找面孔";
    qs("#expression-detail").textContent = "请面向镜头并保持适当距离";
    return;
  }
  const landmarks = result.faceLandmarks?.[0];
  const left = landmarks?.[234];
  const right = landmarks?.[454];
  const top = landmarks?.[10];
  const bottom = landmarks?.[152];
  const nose = landmarks?.[1];
  const faceMidX = left && right ? (left.x + right.x) / 2 : .5;
  const faceMidY = top && bottom ? (top.y + bottom.y) / 2 : .5;
  const faceWidth = left && right ? Math.max(.01, right.x - left.x) : 1;
  const faceHeight = top && bottom ? Math.max(.01, bottom.y - top.y) : 1;
  const raw = {
    smile: (spiritCategoryScore(categories, "mouthSmileLeft") + spiritCategoryScore(categories, "mouthSmileRight")) / 2,
    mouth: spiritCategoryScore(categories, "jawOpen"),
    browLeft: Math.max(spiritCategoryScore(categories, "browOuterUpLeft"), spiritCategoryScore(categories, "browInnerUp")),
    browRight: Math.max(spiritCategoryScore(categories, "browOuterUpRight"), spiritCategoryScore(categories, "browInnerUp")),
    browDownLeft: spiritCategoryScore(categories, "browDownLeft"),
    browDownRight: spiritCategoryScore(categories, "browDownRight"),
    blinkLeft: spiritCategoryScore(categories, "eyeBlinkLeft"),
    blinkRight: spiritCategoryScore(categories, "eyeBlinkRight"),
    wideLeft: spiritCategoryScore(categories, "eyeWideLeft"),
    wideRight: spiritCategoryScore(categories, "eyeWideRight"),
    squintLeft: spiritCategoryScore(categories, "eyeSquintLeft"),
    squintRight: spiritCategoryScore(categories, "eyeSquintRight"),
    gazeX: clamp((
      spiritCategoryScore(categories, "eyeLookOutLeft")
      + spiritCategoryScore(categories, "eyeLookInRight")
      - spiritCategoryScore(categories, "eyeLookInLeft")
      - spiritCategoryScore(categories, "eyeLookOutRight")
    ) / 2, -1, 1),
    gazeY: clamp((
      spiritCategoryScore(categories, "eyeLookDownLeft")
      + spiritCategoryScore(categories, "eyeLookDownRight")
      - spiritCategoryScore(categories, "eyeLookUpLeft")
      - spiritCategoryScore(categories, "eyeLookUpRight")
    ) / 2, -1, 1),
    poseX: nose ? clamp((nose.x - faceMidX) / faceWidth * 3.2, -1, 1) : 0,
    poseY: nose ? clamp((nose.y - faceMidY) / faceHeight * 2.7, -1, 1) : 0
  };
  for (const key of Object.keys(raw)) {
    spiritState.scores[key] += (raw[key] - spiritState.scores[key]) * .35;
  }
  spiritState.scoreHistory.push({ time, scores: { ...spiritState.scores } });
  spiritState.scoreHistory = spiritState.scoreHistory.filter((entry) => time - entry.time < 650);
  updateEyeDynamics(raw, time);
  const activity = Math.max(
    raw.smile, raw.mouth, raw.browLeft, raw.browRight,
    raw.blinkLeft, raw.blinkRight, raw.wideLeft, raw.wideRight,
    raw.squintLeft, raw.squintRight, raw.browDownLeft, raw.browDownRight
  );
  if (activity > .18) spiritState.lastExpressionAt = time;
  spiritState.meditation = time - spiritState.lastExpressionAt > 5000;
  qs("#meditation-badge").classList.toggle("show", spiritState.meditation);
  if (raw.mouth > .62) {
    if (!spiritState.mouthOpenSince) spiritState.mouthOpenSince = time;
  } else {
    spiritState.mouthOpenSince = 0;
  }
  spiritState.easterEgg = spiritState.mouthOpenSince && time - spiritState.mouthOpenSince > 3000
    ? "fishStorm"
    : raw.smile > .42 && (raw.browLeft > .38 || raw.browRight > .38) ? "sun" : "";
  setSpiritReading(spiritState.scores);
}

function updateSpiritMeters() {
  const scoreMap = {
    "meter-mouth": spiritState.scores.mouth,
    "meter-smile": spiritState.scores.smile,
    "meter-brow-left": spiritState.scores.browLeft,
    "meter-brow-right": spiritState.scores.browRight,
    "meter-blink-left": spiritState.scores.blinkLeft,
    "meter-blink-right": spiritState.scores.blinkRight,
    "meter-pose": Math.max(Math.abs(spiritState.scores.poseX), Math.abs(spiritState.scores.poseY))
  };
  for (const [id, value] of Object.entries(scoreMap)) {
    qs(`#${id}`).style.width = `${clamp(value, 0, 1) * 100}%`;
  }
}

function renderSpiritBackground(context, time) {
  const palette = spiritPalettes[spiritState.palette];
  context.fillStyle = palette.bg;
  context.fillRect(0, 0, spiritCanvas.width, spiritCanvas.height);
  const glow = context.createRadialGradient(550, 370, 60, 550, 370, 540);
  glow.addColorStop(0, `${palette.paper}44`);
  glow.addColorStop(1, `${palette.ink}16`);
  context.fillStyle = glow;
  context.fillRect(0, 0, spiritCanvas.width, spiritCanvas.height);
  context.save();
  context.globalAlpha = .075;
  context.strokeStyle = palette.ink;
  context.lineWidth = 1;
  const shift = time * .002 % 32;
  for (let x = -32 + shift; x < 1132; x += 32) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x + 90, 760);
    context.stroke();
  }
  for (let y = 20; y < 760; y += 44) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(1100, y);
    context.stroke();
  }
  context.restore();
}

function animateSpiritMirror(time) {
  renderSpiritBackground(spiritContext, time);
  detectSpiritExpression(time);
  const scores = coordinatedScores(time);
  updateSpiritParticles(makeSpiritTargets(scores, time));
  spiritState.particles.forEach((particle) => particle.draw(spiritContext, time));
  updateSpiritMeters();
  if (spiritState.sessionStartedAt) {
    const elapsed = Math.floor((time - spiritState.sessionStartedAt) / 1000);
    qs("#session-time").textContent = `已对话 ${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`;
  }
  requestAnimationFrame(animateSpiritMirror);
}

function captureSpiritMirror() {
  const output = document.createElement("canvas");
  output.width = spiritCanvas.width;
  output.height = spiritCanvas.height;
  const context = output.getContext("2d");
  context.drawImage(spiritCanvas, 0, 0);
  const palette = spiritPalettes[spiritState.palette];
  context.strokeStyle = palette.ink;
  context.lineWidth = 16;
  context.strokeRect(16, 16, output.width - 32, output.height - 32);
  context.strokeStyle = palette.paper;
  context.lineWidth = 3;
  context.strokeRect(31, 31, output.width - 62, output.height - 62);
  context.fillStyle = palette.ink;
  context.font = "700 24px serif";
  context.fillText(`半坡观相 · ${spiritState.label}`, 52, output.height - 50);
  downloadCanvas(output, "半坡观相");
}

function cycleSpiritPalette() {
  spiritState.palette = (spiritState.palette + 1) % spiritPalettes.length;
  const palette = spiritPalettes[spiritState.palette];
  qs("#expression-palette").textContent = palette.name;
  spiritStage.classList.toggle("palette-rubbing", palette.key === "rubbing");
  spiritStage.classList.toggle("palette-earth", palette.key === "earth");
  toast(`已切换为${palette.name}`);
}

function cycleSpiritDensity(direction = 1) {
  const values = [.65, 1, 1.35];
  const current = values.reduce((best, value, index) =>
    Math.abs(value - spiritState.density) < Math.abs(values[best] - spiritState.density) ? index : best, 0);
  spiritState.density = values[(current + direction + values.length) % values.length];
  qs("#expression-density").textContent = `粒子 ${Math.round(spiritState.density * 100)}%`;
}

function startSpiritRecording() {
  if (spiritState.recorder?.state === "recording") return;
  if (!window.MediaRecorder || !spiritCanvas.captureStream) return toast("当前浏览器暂不支持画面录制");
  spiritState.recordedChunks = [];
  const stream = spiritCanvas.captureStream(30);
  const type = MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm";
  spiritState.recorder = new MediaRecorder(stream, { mimeType: type });
  spiritState.recorder.ondataavailable = (event) => {
    if (event.data.size) spiritState.recordedChunks.push(event.data);
  };
  spiritState.recorder.onstop = () => {
    const blob = new Blob(spiritState.recordedChunks, { type });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `半坡观相-${Date.now()}.webm`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  spiritState.recorder.start();
  spiritState.recordingStartedAt = performance.now();
  qs("#recording-badge").classList.add("show");
  qs("#expression-record").textContent = "停止";
  spiritState.recordingTimer = window.setInterval(() => {
    const seconds = Math.floor((performance.now() - spiritState.recordingStartedAt) / 1000);
    qs("#recording-badge span").textContent =
      `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  }, 250);
}

function stopSpiritRecording() {
  if (spiritState.recorder?.state !== "recording") return;
  spiritState.recorder.stop();
  clearInterval(spiritState.recordingTimer);
  qs("#recording-badge").classList.remove("show");
  qs("#expression-record").textContent = "录制";
}

function toggleSpiritRecording() {
  spiritState.recorder?.state === "recording" ? stopSpiritRecording() : startSpiritRecording();
}

qs("#camera-toggle").addEventListener("click", toggleSpiritCamera);
qs("#expression-capture").addEventListener("click", captureSpiritMirror);
qs("#expression-record").addEventListener("click", toggleSpiritRecording);
qs("#expression-palette").addEventListener("click", cycleSpiritPalette);
qs("#expression-density").addEventListener("click", () => cycleSpiritDensity(1));
qs("#expression-performance").addEventListener("click", () => {
  spiritState.performanceMode = !spiritState.performanceMode;
  qs("#expression-performance").textContent = spiritState.performanceMode ? "性能：低耗" : "性能：自动";
  toast(spiritState.performanceMode ? "已启用低耗模式" : "已恢复自动性能");
});
qs("#eye-style").addEventListener("change", (event) => {
  spiritState.eyeStyle = event.target.value;
  qs("#mirror-intro").classList.add("hidden");
  if (spiritState.active || event.target.value === "closed") {
    updateEyeDynamics(spiritState.scores, performance.now());
  } else {
    spiritState.eyeState = event.target.selectedOptions[0].textContent;
    qs("#eye-state-label").textContent = spiritState.eyeState;
  }
  toast(`眼型已切换为${event.target.selectedOptions[0].textContent}`);
});
qs("#brow-style").addEventListener("change", (event) => {
  spiritState.browStyle = event.target.value;
  qs("#mirror-intro").classList.add("hidden");
  toast(`眉型已切换为${event.target.selectedOptions[0].textContent}`);
});
qsa("[data-feature]").forEach((control) => control.addEventListener("change", () => {
  spiritState.visible[control.dataset.feature] = control.checked;
  qs("#mirror-intro").classList.add("hidden");
  const hidden = qsa("[data-feature]").filter((item) => !item.checked).map((item) => item.nextElementSibling.textContent);
  qs("#expression-detail").textContent = hidden.length
    ? `已隐去：${hidden.join("、")}，其余区域继续响应表情`
    : "五官已全部显现";
}));
qs("#expression-close").addEventListener("click", () => {
  stopSpiritRecording();
  stopSpiritCamera();
  switchMode("portrait");
  toast(`本次主要情绪：${spiritState.label}`);
});

let spiritClickTimer = 0;
spiritStage.addEventListener("click", () => {
  clearTimeout(spiritClickTimer);
  spiritClickTimer = window.setTimeout(captureSpiritMirror, 230);
});
spiritStage.addEventListener("dblclick", (event) => {
  event.preventDefault();
  clearTimeout(spiritClickTimer);
  cycleSpiritPalette();
});
spiritStage.addEventListener("wheel", (event) => {
  event.preventDefault();
  cycleSpiritDensity(event.deltaY > 0 ? -1 : 1);
}, { passive: false });

window.addEventListener("keydown", (event) => {
  if (!qs("#expression").classList.contains("active")) return;
  if (event.code === "Space" && !event.repeat) {
    event.preventDefault();
    startSpiritRecording();
  } else if (event.key === "Escape") {
    qs("#expression-close").click();
  }
});
window.addEventListener("keyup", (event) => {
  if (event.code === "Space" && qs("#expression").classList.contains("active")) {
    event.preventDefault();
    stopSpiritRecording();
  }
});

qs("#expression-photo").addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  stopSpiritCamera();
  if (spiritState.fallbackUrl) URL.revokeObjectURL(spiritState.fallbackUrl);
  spiritState.fallbackUrl = URL.createObjectURL(file);
  spiritPhoto.src = spiritState.fallbackUrl;
  spiritPhoto.classList.add("visible");
  qs("#camera-off").classList.add("hidden");
  qs("#mirror-intro").classList.add("hidden");
  qs("#expression-dot").classList.add("live");
  spiritState.sessionStartedAt = performance.now();
  spiritState.scores.smile = .18;
  spiritState.scores.mouth = .08;
  setSpiritReading(spiritState.scores);
  qs("#expression-detail").textContent = "静态照片已转化为平静的半坡面具";
  toast("照片只在本地显示，已生成静态面具");
});

window.addEventListener("beforeunload", () => {
  stopSpiritCamera();
  if (spiritState.fallbackUrl) URL.revokeObjectURL(spiritState.fallbackUrl);
});

updateSpiritParticles(makeSpiritTargets(spiritState.scores, 0));
requestAnimationFrame(animateSpiritMirror);
