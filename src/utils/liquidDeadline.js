// The existing Paper cut silhouette, shared by the liquid renderer and its final SVG.
export const deadlineBottlePath = "M40 14 Q30 15 28 26 L16 58 Q11 69 22 77 L80 113 Q93 120 104 115 L114 110 L139 126 L139 130 L153 139 L163 121 L148 112 L144 114 L120 98 L118 83 Q117 73 105 66 L55 19 Q49 14 40 14 Z";
export const clamp = (value) => Math.max(0, Math.min(1, value));
export const ease = (value) => { const t = clamp(value); return t * t * (3 - 2 * t); };

function surface(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function inkPoints(canvas) {
  const { data } = canvas.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, canvas.width, canvas.height);
  const points = [];
  for (let x = 0; x < canvas.width; x += 1.5) {
    for (let y = 0; y < canvas.height; y += 1.5) {
      if (data[(Math.floor(y) * canvas.width + Math.floor(x)) * 4 + 3] > 90) points.push([x, y]);
    }
  }
  return points;
}

// Capture real glyph positions, including wrapping and the user's font settings.
// Their ink is advected directly into the final silhouette; there is no intermediary icon.
function captureDeadlineInk(anchor, canvas, scale = 1) {
  const width = 300;
  const height = 210;
  const source = surface(width, height);
  const target = surface(width, height);
  const fluid = surface(width, height);
  const sourceContext = source.getContext("2d", { willReadFrequently: true });
  const glyphs = [];
  const rect = anchor.getBoundingClientRect();
  const text = anchor.querySelector(".deadline-field-text");
  const walker = document.createTreeWalker(text, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    const style = getComputedStyle(node.parentElement);
    const size = Number.parseFloat(style.fontSize) / scale;
    sourceContext.font = `${style.fontStyle} ${style.fontWeight} ${size}px ${style.fontFamily}`;
    sourceContext.fillStyle = "black";
    sourceContext.textBaseline = "alphabetic";
    for (let i = 0; i < node.textContent.length; i++) {
      const range = document.createRange();
      range.setStart(node, i);
      range.setEnd(node, i + 1);
      const letter = range.getBoundingClientRect();
      const x = 40 + (letter.left - rect.left) / scale;
      const y = (letter.bottom - rect.top) / scale - size * 0.2;
      sourceContext.fillText(node.textContent[i], x, y);
      if (node.textContent[i].trim()) glyphs.push({ text: node.textContent[i], x, y, font: sourceContext.font, size, width: letter.width / scale });
    }
  }
  const targetContext = target.getContext("2d", { willReadFrequently: true });
  targetContext.translate(5, 0);
  targetContext.fillStyle = "black";
  targetContext.strokeStyle = "black";
  targetContext.lineWidth = 1.8;
  targetContext.lineJoin = "round";
  const bottle = new Path2D(deadlineBottlePath);
  targetContext.fill(bottle);
  targetContext.stroke(bottle);
  targetContext.globalCompositeOperation = "destination-out";
  targetContext.fill(new Path2D("M47 33 L98 77 L78 99 L28 64 Z"));
  targetContext.lineWidth = 2;
  targetContext.stroke(new Path2D("M143 115 L157 124"));
  targetContext.globalCompositeOperation = "source-over";
  targetContext.beginPath();
  targetContext.arc(62, 66, 9, 0, Math.PI * 2);
  targetContext.fill();

  const sources = inkPoints(source);
  const targets = inkPoints(target);
  const context = canvas.getContext("2d");
  const fluidContext = fluid.getContext("2d");
  const density = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = width * density;
  canvas.height = height * density;
  context.scale(density, density);
  const count = Math.max(sources.length, targets.length);
  const particles = Array.from({ length: count }, (_, i) => {
    const [x, y] = sources[Math.floor(i / count * sources.length)];
    const destination = targets[Math.floor(i / count * targets.length)];
    return { x, y, tx: destination[0], ty: destination[1], lane: Math.floor(y / 18), delay: x / width * 0.11 };
  });

  return { width, height, source, target, fluid, context, fluidContext, particles, glyphs, targets };
}

// Kept only for the live comparison: the previous refinement uses the same
// bottle, glass, pour and overflow, isolating the change to the text morph.
export function createPreviousDeadlineInk(anchor, canvas, scale = 1) {
  const { width, height, source, target, fluid, context, fluidContext, particles } = captureDeadlineInk(anchor, canvas, scale);

  return function drawInk(amount) {
    const t = clamp(amount);
    context.clearRect(0, 0, width, height);
    if (t <= 0.015) { context.drawImage(source, 0, 0); return; }
    if (t >= 1) { context.drawImage(target, 0, 0); return; }
    fluidContext.clearRect(0, 0, width, height);
    fluidContext.fillStyle = "black";
    fluidContext.strokeStyle = "black";
    fluidContext.lineCap = "round";
    const swelling = Math.sin(Math.PI * t);
    for (const point of particles) {
      const q = ease((t - point.delay) / (1 - point.delay));
      const envelope = Math.sin(q * Math.PI);
      // Adjacent glyph fragments share a flowing curl, so ink joins in ribbons.
      const curl = Math.sin(q * 5.7 + point.lane * 0.72);
      const x = point.x + (point.tx - point.x) * q + envelope * curl * 15;
      const y = point.y + (point.ty - point.y) * q + envelope * (12 + Math.sin(q * 7 + point.x / 70) * 10);
      const radius = 0.78 + swelling * 1.95 + q * 0.65;
      // Viscous tails keep the letter ink connected as it stretches, rather than
      // breaking into a particle cloud. Tails retract into the bottle at the end.
      const tailQ = clamp(q - envelope * 0.13);
      const tailEnvelope = Math.sin(tailQ * Math.PI);
      const tailX = point.x + (point.tx - point.x) * tailQ + tailEnvelope * Math.sin(tailQ * 5.7 + point.lane * 0.72) * 15;
      const tailY = point.y + (point.ty - point.y) * tailQ + tailEnvelope * (12 + Math.sin(tailQ * 7 + point.x / 70) * 10);
      fluidContext.lineWidth = radius * 1.7;
      fluidContext.beginPath();
      fluidContext.moveTo(tailX, tailY);
      fluidContext.quadraticCurveTo((tailX + x) / 2 + envelope * curl * 2, (tailY + y) / 2, x, y);
      fluidContext.stroke();
      fluidContext.beginPath();
      fluidContext.ellipse(x, y, radius * (1 + envelope * 0.65), radius, curl * envelope, 0, Math.PI * 2);
      fluidContext.fill();
    }
    // A small blur fuses touching ribbons; no crossfade through a stock blob shape.
    context.filter = `blur(${swelling * 0.6}px)`;
    context.globalAlpha = 1 - ease((t - 0.93) / 0.07);
    context.drawImage(fluid, 0, 0);
    context.filter = "none";
    context.globalAlpha = ease((t - 0.79) / 0.14);
    context.drawImage(target, 0, 0);
    context.globalAlpha = 1;
  };
}

// Liquid typography: the glyphs soften first, then stretch into rounded bridges.
// A density contour fuses the ink into one opaque surface, rather than exposing
// the underlying samples as grains. Small satellites pinch off and return.
export function createDeadlineInk(anchor, canvas, scale = 1) {
  const { width, height, source, target, context, particles, glyphs, targets } = captureDeadlineInk(anchor, canvas, scale);
  const resolution = 2;
  const field = surface(width * resolution, height * resolution);
  const blurred = surface(field.width, field.height);
  const contour = surface(field.width, field.height);
  const fieldContext = field.getContext("2d");
  const blurContext = blurred.getContext("2d", { willReadFrequently: true });
  const contourContext = contour.getContext("2d");
  fieldContext.scale(resolution, resolution);
  const drops = Array.from({ length: 6 }, (_, i) => {
    const glyph = glyphs[Math.min(glyphs.length - 1, Math.floor((i + 0.5) / 6 * glyphs.length))];
    const destination = targets[Math.floor((i + 0.5) / 6 * targets.length)];
    return { x: glyph?.x || 70, y: (glyph?.y || 40) - 5, tx: destination?.[0] || 80, ty: destination?.[1] || 70,
      start: 0.25 + i * 0.022, end: 0.82 + i * 0.018, side: i % 2 ? 1 : -1, radius: 2.4 + i % 3 * 0.35 };
  });

  function position(point, q) {
    const stretch = Math.sin(q * Math.PI);
    const roll = Math.sin(q * 5.2 + point.lane * 0.68);
    const x = point.x + (point.tx - point.x) * q + stretch * roll * 17;
    const y = point.y + (point.ty - point.y) * q + stretch * (11 + Math.sin(q * 5.8 + point.x / 85) * 7);
    const flowingSpine = 46 + Math.sin(x / 35 - q * 4) * 7;
    const spine = flowingSpine + (x * 0.64 + 8 - flowingSpine) * ease(q);
    return [x + (95 - x) * stretch * 0.13, y + (spine - y) * stretch * 0.4];
  }

  return function drawInk(amount) {
    const t = clamp(amount);
    context.clearRect(0, 0, width, height);
    if (t === 0) { context.drawImage(source, 0, 0); return; }
    if (t >= 1) { context.drawImage(target, 0, 0); return; }
    fieldContext.clearRect(0, 0, width, height);
    fieldContext.fillStyle = "black";
    fieldContext.strokeStyle = "black";
    fieldContext.lineCap = "round";
    fieldContext.lineJoin = "round";

    // Readable letterforms gently swell and lean before releasing their ink.
    // Motion is staggered across the words, like a pressure wave through fluid.
    if (t < 0.28) {
      const wet = Math.sin(Math.PI * clamp(t / 0.3));
      fieldContext.globalAlpha = 1 - ease((t - 0.13) / 0.15);
      glyphs.forEach((glyph, i) => {
        const wave = Math.sin(i * 0.38 - t * 19);
        fieldContext.save();
        fieldContext.font = glyph.font;
        fieldContext.translate(glyph.x + glyph.width / 2, glyph.y);
        fieldContext.transform(1 + wet * 0.025, wet * wave * 0.025, wet * wave * 0.06, 1 + wet * 0.065, 0, wet * wave * 0.85);
        fieldContext.lineWidth = wet * 0.65;
        fieldContext.strokeText(glyph.text, -glyph.width / 2, 0);
        fieldContext.fillText(glyph.text, -glyph.width / 2, 0);
        fieldContext.restore();
      });
    }

    // Samples remain an internal material representation; the density pass below
    // turns them into smooth connected contours with round, tapering necks.
    const gathering = ease((t - 0.11) / 0.17);
    const settling = ease((t - 0.77) / 0.2);
    fieldContext.globalAlpha = gathering * (1 - settling);
    if (t > 0.11 && t < 0.97) {
      const phase = clamp((t - 0.14) / 0.8);
      const swelling = Math.sin(Math.PI * phase);
      for (const point of particles) {
        const q = ease((phase - point.delay) / (1 - point.delay));
        const envelope = Math.sin(q * Math.PI);
        const [x, y] = position(point, q);
        const [tailX, tailY] = position(point, clamp(q - envelope * 0.2));
        const radius = 0.83 + swelling * 1.5 + q * 0.55;
        fieldContext.lineWidth = radius * 1.7;
        fieldContext.beginPath();
        fieldContext.moveTo(tailX, tailY);
        fieldContext.quadraticCurveTo((tailX + x) / 2 + envelope * 3, (tailY + y) / 2 - envelope * 2, x, y);
        fieldContext.stroke();
        fieldContext.beginPath();
        fieldContext.ellipse(x, y, radius * (1 + envelope * 0.45), radius, envelope * 0.45, 0, Math.PI * 2);
        fieldContext.fill();
      }
    }

    // Resolve the label as negative space inside the same contour. This is an
    // opaque field interpolation, not a visible image crossfade or icon swap.
    fieldContext.globalAlpha = settling;
    const recoil = Math.sin(clamp((t - 0.77) / 0.23) * Math.PI * 2) * (1 - ease((t - 0.8) / 0.2));
    fieldContext.save();
    fieldContext.translate(85, 75);
    fieldContext.scale(1 + recoil * 0.018, 1 - recoil * 0.016);
    fieldContext.drawImage(target, -85, -75);
    fieldContext.restore();
    fieldContext.globalAlpha = 1;

    drops.forEach((drop, i) => {
      if (t <= drop.start || t >= drop.end) return;
      const u = (t - drop.start) / (drop.end - drop.start);
      const travel = ease(u);
      const arc = Math.sin(Math.PI * u);
      const x = drop.x + (drop.tx - drop.x) * travel + drop.side * arc * (15 + i * 1.7);
      const y = drop.y + (drop.ty - drop.y) * travel - arc * (18 + i % 3 * 7);
      const radius = drop.radius * Math.sin(Math.PI * u) ** 0.45;
      fieldContext.beginPath();
      fieldContext.ellipse(x, y, radius * (1 - arc * 0.12), radius * (1 + arc * 0.28), drop.side * arc * 0.5, 0, Math.PI * 2);
      fieldContext.fill();
    });

    // Blur + a narrow alpha isocontour produces smooth surface-tension joins.
    // All output pixels remain black; only the antialiased perimeter has alpha.
    const fusion = ease((t - 0.07) / 0.2) * (1 - ease((t - 0.84) / 0.16));
    blurContext.clearRect(0, 0, field.width, field.height);
    blurContext.filter = `blur(${0.15 + fusion * 4.8}px)`;
    blurContext.drawImage(field, 0, 0);
    blurContext.filter = "none";
    const pixels = blurContext.getImageData(0, 0, field.width, field.height);
    const thresholdMix = ease((t - 0.07) / 0.17) * (1 - ease((t - 0.9) / 0.1));
    const center = 0.3 + (1 - fusion) * 0.05;
    for (let index = 3; index < pixels.data.length; index += 4) {
      const alpha = pixels.data[index] / 255;
      const opaque = ease((alpha - center + 0.065) / 0.13);
      pixels.data[index] = Math.round((alpha + (opaque - alpha) * thresholdMix) * 255);
    }
    contourContext.putImageData(pixels, 0, 0);
    context.drawImage(contour, 0, 0, width, height);
  };
}

// A closed liquid ribbon: curvature and width travel down the stream together.
export function deadlineStreamPath(surfaceY, phase) {
  const left = [];
  const right = [];
  for (let i = 0; i <= 48; i++) {
    const t = i / 48;
    const envelope = Math.sin(Math.PI * t);
    const x = 123 - t * 2 + envelope * (Math.sin(t * 5.3 - phase) * 3 + 3.5);
    const y = 138 + (surfaceY - 138) * t;
    const halfWidth = 0.82 + 0.42 * Math.sin(t * 9 - phase * 1.8) + 0.3 * (1 - t);
    left.push(`${(x - halfWidth).toFixed(2)},${y.toFixed(2)}`);
    right.unshift(`${(x + halfWidth).toFixed(2)},${y.toFixed(2)}`);
  }
  return `M${left.join(" L")} L${right.join(" L")} Z`;
}
