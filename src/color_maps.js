import { Color } from "https://unpkg.com/three@0.125.1/build/three.module.js";

const availableColorMaps = [
  "viridis",
  "plasma",
  "magma",
  "inferno",
  "coolwarm",
  "blues",
  "piyg",
  "spectral",
  "rainbow",
  "jet",
  "reds",
  "hsv",
  "rdpu",
];

function applyColorMap(name, value, min, max) {
  let map = colorMaps[name];
  let alpha = (value - min) / (max - min);

  let prevIdx = Math.floor(alpha * (map.length - 1));
  let t = alpha * (map.length - 1) - prevIdx;
  let prevColor = new Color(map[prevIdx]);
  let nextColor = new Color(map[prevIdx + 1]);

  return prevColor.lerp(nextColor, t);
}

export { availableColorMaps, applyColorMap };
