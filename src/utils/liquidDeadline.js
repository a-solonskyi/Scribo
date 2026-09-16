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
export function createDeadlineInk(anchor, canvas, scale = 1) {
  const width = 300;
  const height = 210;
  const source = surface(width, height);
  const target = surface(width, height);
  const fluid = surface(width, height);
  const sourceContext = source.getContext("2d", { willReadFrequently: true });
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
      sourceContext.fillText(node.textContent[i], 40 + (letter.left - rect.left) / scale, (letter.bottom - rect.top) / scale - size * 0.2);
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
  const particles = sources.map(([x, y], i) => {
    const destination = targets[Math.floor(i / sources.length * targets.length)];
    return { x, y, tx: destination[0], ty: destination[1], lane: Math.floor(y / 18), delay: x / width * 0.11 };
  });

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
      const radius = 0.78 + swelling * 1.18 + q * 0.65;
      fluidContext.beginPath();
      fluidContext.ellipse(x, y, radius * (1 + envelope * 0.65), radius, curl * envelope, 0, Math.PI * 2);
      fluidContext.fill();
    }
    // A small blur fuses touching ribbons; no crossfade through a stock blob shape.
    context.filter = `blur(${swelling * 0.6}px)`;
    context.globalAlpha = 1 - ease((t - 0.79) / 0.21);
    context.drawImage(fluid, 0, 0);
    context.filter = "none";
    context.globalAlpha = ease((t - 0.79) / 0.21);
    context.drawImage(target, 0, 0);
    context.globalAlpha = 1;
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
