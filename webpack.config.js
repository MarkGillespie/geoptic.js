const path = require("path");

module.exports = {
  entry: "./src/geoptic.js",
  output: {
    filename: "geoptic.bundle.js",
    path: path.resolve(__dirname, "build"),
  },
  target: "es5",
  mode: "production",
  externalsType: "script",
  externals: {
    Vector3: "Vector3@https://unpkg.com/three@0.125.1/build/three.module.js",
    BufferAttribute:
      "BufferAttribute@https://unpkg.com/three@0.125.1/build/three.module.js",
  },
  optimization: { usedExports: false },
};
