# geoptic.js

A Javascript library for visualizing geometry processing.


## Building bundled version
First, you need `rollup.js` and the `terser` plugin
``` bash
npm install -g rollup
npm install --save-dev rollup-plugin-terser
```

Then, you can build the bundled files (everything in `build/`), via
```bash
rollup --config rollup.config.js
```
