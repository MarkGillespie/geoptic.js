import { TextureLoader } from "https://unpkg.com/three@0.125.1/build/three.module.js";

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

const colorMaps = {};

function getColorMap(gp, cm) {
  if (!colorMaps[cm]) {
    colorMaps[cm] = new TextureLoader().load(
      gp.geopticPath + "/img/colormaps/" + cm + ".png"
    );
  }
  return colorMaps[cm];
}

export { availableColorMaps, getColorMap };
