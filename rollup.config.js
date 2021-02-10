import { terser } from "rollup-plugin-terser";

export default [
  {
    input: "src/geoptic.js",
    output: [
      {
        format: "umd",
        name: "geoptic",
        file: "build/geoptic.min.js",
        plugins: [terser()],
      },
      {
        format: "umd",
        name: "geoptic",
        file: "build/geoptic.js",
      },
      {
        format: "esm",
        file: "build/geoptic.module.min.js",
        plugins: [terser()],
      },
      {
        format: "esm",
        file: "build/geoptic.module.js",
      },
    ],
  },
];
