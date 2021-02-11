(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('https://unpkg.com/three@0.125.1/build/three.module.js'), require('https://unpkg.com/three@0.125.1/examples/jsm/controls/TrackballControls.js'), require('https://unpkg.com/three@0.125.1/examples/jsm/WebGL.js'), require('https://unpkg.com/three@0.125.1/examples/jsm/objects/Reflector.js'), require('https://unpkg.com/three@0.125.1/examples/jsm/loaders/RGBELoader.js'), require('https://unpkg.com/three@0.125.1/examples/jsm/libs/stats.module.js')) :
  typeof define === 'function' && define.amd ? define(['exports', 'https://unpkg.com/three@0.125.1/build/three.module.js', 'https://unpkg.com/three@0.125.1/examples/jsm/controls/TrackballControls.js', 'https://unpkg.com/three@0.125.1/examples/jsm/WebGL.js', 'https://unpkg.com/three@0.125.1/examples/jsm/objects/Reflector.js', 'https://unpkg.com/three@0.125.1/examples/jsm/loaders/RGBELoader.js', 'https://unpkg.com/three@0.125.1/examples/jsm/libs/stats.module.js'], factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.geoptic = {}, global.THREE, global.TrackballControls_js, global.WebGL_js, global.Reflector_js, null, global.Stats));
}(this, (function (exports, THREE, TrackballControls_js, WebGL_js, Reflector_js, RGBELoader_js, Stats) { 'use strict';

  function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

  var Stats__default = /*#__PURE__*/_interopDefaultLegacy(Stats);

  let common = `
        float getEdgeFactor(vec3 UVW, vec3 edgeReal, float width) {

            // The Nick Sharp Edge Function (tm). There are many like it, but this one is his.
            float slopeWidth = 1.;

            vec3 fw = fwidth(UVW);
            vec3 realUVW = max(UVW, 1. - edgeReal.yzx);
            vec3 baryWidth = slopeWidth * fw;

            vec3 end = width * fw;
            vec3 dist = smoothstep(end - baryWidth, end, realUVW);

            float e = 1.0 - min(min(dist.x, dist.y), dist.z);
            return e;
        }
`;

  function createMatCapMaterial(tex_r, tex_g, tex_b, tex_k) {
    let vertexShader = `
        attribute vec3 barycoord;

        varying vec2 Point;
        varying vec3 Barycoord;

        void main()
        {
            vec3 vNormal = ( mat3( modelViewMatrix ) * normal );
            vNormal = normalize(vNormal);

            // pull slightly inward, to reduce sampling artifacts near edges
            Point.x = 0.93 * vNormal.x * 0.5 + 0.5;
            Point.y = 0.93 * vNormal.y * 0.5 + 0.5;

            Barycoord = barycoord;

            gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

        }
    `;

    let fragmentShader = `
        uniform sampler2D Matcap_r; // Matcap texture
        uniform sampler2D Matcap_g; // Matcap texture
        uniform sampler2D Matcap_b; // Matcap texture
        uniform sampler2D Matcap_k; // Matcap texture
        uniform vec3 color;
        uniform vec3 edgeColor;
        uniform float edgeWidth;

        varying vec2 Point;
        varying vec3 Barycoord;

        ${common}

        void main(void){


            float alpha = getEdgeFactor(Barycoord, vec3(1.,1.,1.), edgeWidth);
            vec2 coord = Point;

            vec4 mat_r = sRGBToLinear(texture2D(Matcap_r, coord));
            vec4 mat_g = sRGBToLinear(texture2D(Matcap_g, coord));
            vec4 mat_b = sRGBToLinear(texture2D(Matcap_b, coord));
            vec4 mat_k = sRGBToLinear(texture2D(Matcap_k, coord));

            vec4 colorCombined = color.r * mat_r + color.g * mat_g + color.b * mat_b +
                                (1. - color.r - color.g - color.b) * mat_k;

            vec4 edgeColorCombined = edgeColor.r * mat_r + edgeColor.g * mat_g + edgeColor.b * mat_b +
                                (1. - edgeColor.r - edgeColor.g - edgeColor.b) * mat_k;

            gl_FragColor = (1.-alpha) * colorCombined + alpha * edgeColorCombined;
            gl_FragColor = LinearTosRGB( gl_FragColor );
        }
    `;

    let Material = new THREE.ShaderMaterial({
      uniforms: {
        Matcap_r: { value: tex_r },
        Matcap_g: { value: tex_g },
        Matcap_b: { value: tex_b },
        Matcap_k: { value: tex_k },
        color: { value: new THREE.Vector3(1, 0, 1) },
        edgeColor: { value: new THREE.Vector3(0, 0, 0) },
        edgeWidth: { value: 0 },
      },
      vertexShader,
      fragmentShader,
    });

    return Material;
  }

  function createVertexScalarFunctionMaterial(tex_r, tex_g, tex_b, tex_k) {
    let vertexShader = `
        attribute vec3 barycoord;
        attribute vec3 color;

        varying vec2 Point;
        varying vec3 Barycoord;
        varying vec3 Color;

        void main()
        {
            vec3 vNormal = ( mat3( modelViewMatrix ) * normal );
            vNormal = normalize(vNormal);

            // pull slightly inward, to reduce sampling artifacts near edges
            Point.x = 0.93 * vNormal.x * 0.5 + 0.5;
            Point.y = 0.93 * vNormal.y * 0.5 + 0.5;

            Barycoord = barycoord;
            Color = color;

            gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

        }
    `;

    let fragmentShader = `
        uniform sampler2D Matcap_r; // Matcap texture
        uniform sampler2D Matcap_g; // Matcap texture
        uniform sampler2D Matcap_b; // Matcap texture
        uniform sampler2D Matcap_k; // Matcap texture
        uniform vec3 edgeColor;
        uniform float edgeWidth;

        varying vec2 Point;
        varying vec3 Barycoord;
        varying vec3 Color;

        ${common}

        void main(void){


            float alpha = getEdgeFactor(Barycoord, vec3(1.,1.,1.), edgeWidth);
            vec2 coord = Point;

            vec4 mat_r = sRGBToLinear(texture2D(Matcap_r, coord));
            vec4 mat_g = sRGBToLinear(texture2D(Matcap_g, coord));
            vec4 mat_b = sRGBToLinear(texture2D(Matcap_b, coord));
            vec4 mat_k = sRGBToLinear(texture2D(Matcap_k, coord));

            vec4 colorCombined = Color.r * mat_r + Color.g * mat_g + Color.b * mat_b +
                                (1. - Color.r - Color.g - Color.b) * mat_k;

            vec4 edgeColorCombined = edgeColor.r * mat_r + edgeColor.g * mat_g + edgeColor.b * mat_b +
                                (1. - edgeColor.r - edgeColor.g - edgeColor.b) * mat_k;

            gl_FragColor = (1.-alpha) * colorCombined + alpha * edgeColorCombined;
            gl_FragColor = LinearTosRGB( gl_FragColor );
        }
    `;

    let Material = new THREE.ShaderMaterial({
      uniforms: {
        Matcap_r: { value: tex_r },
        Matcap_g: { value: tex_g },
        Matcap_b: { value: tex_b },
        Matcap_k: { value: tex_k },
        edgeColor: { value: new THREE.Vector3(0, 0, 0) },
        edgeWidth: { value: 0 },
      },
      vertexShader,
      fragmentShader,
    });

    return Material;
  }

  let groundPlaneVertexShader = `
  uniform mat4 textureMatrix;
  attribute vec2 texture_uv;

  varying vec4 vUv;
  varying vec2 TextureUV;

  void main() {

  	vUv = textureMatrix * vec4( position, 1.0 );

    TextureUV = texture_uv;

  	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

  }
`;

  let groundPlaneFragmentShader = `
    uniform vec3 color;
    uniform sampler2D tDiffuse;
    uniform sampler2D tex;
    uniform float alpha;

    varying vec2 TextureUV;
    varying vec4 vUv;

    float blendOverlay( float base, float blend ) {
        return( base < 0.5 ? ( 2.0 * base * blend ) : ( 1.0 - 2.0 * ( 1.0 - base ) * ( 1.0 - blend ) ) );
    }

    vec3 blendOverlay( vec3 base, vec3 blend ) {
        return vec3( blendOverlay( base.r, blend.r ), blendOverlay( base.g, blend.g ), blendOverlay( base.b, blend.b ) );
    }

    float onGrid(vec2 coord2D) {
        // Checker stripes
        float modDist = min(min(mod(coord2D.x, 1.0), mod(coord2D.y, 1.0)), min(mod(-coord2D.x, 1.0), mod(-coord2D.y, 1.0)));
        return 1.-smoothstep(0.005, .02, modDist);
    }

    void main() {

        vec4 mat = texture2D(tex, TextureUV);
        vec4 base = texture2DProj( tDiffuse, vUv );
        float t = onGrid(26.*TextureUV);

        gl_FragColor = (1.-t) * ((1.-alpha) * vec4( blendOverlay( base.rgb, color ), 1.0 ) + alpha * mat) + t*vec4(0.3,0.3,0.3,1.);

    }
`;

  function createSurfaceMeshPickMaterial() {
    let vertexShader = `
        attribute vec3 barycoord;
        attribute vec3 color;
        attribute vec3 vertex_color0;
        attribute vec3 vertex_color1;
        attribute vec3 vertex_color2;
        attribute vec3 edge_color0;
        attribute vec3 edge_color1;
        attribute vec3 edge_color2;
        attribute vec3 face_color;

        varying vec3 BaryCoord;
        varying vec3 VertexColor0;
        varying vec3 VertexColor1;
        varying vec3 VertexColor2;
        varying vec3 EdgeColor0;
        varying vec3 EdgeColor1;
        varying vec3 EdgeColor2;
        varying vec3 FaceColor;


        void main()
        {
            BaryCoord = barycoord;
            VertexColor0 = vertex_color0;
            VertexColor1 = vertex_color1;
            VertexColor2 = vertex_color2;
            EdgeColor0 = edge_color0;
            EdgeColor1 = edge_color1;
            EdgeColor2 = edge_color2;
            FaceColor = face_color;

            gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

        }
    `;

    let fragmentShader = `
        varying vec3 BaryCoord;
        varying vec3 VertexColor0;
        varying vec3 VertexColor1;
        varying vec3 VertexColor2;
        varying vec3 EdgeColor0;
        varying vec3 EdgeColor1;
        varying vec3 EdgeColor2;
        varying vec3 FaceColor;

        ${common}

        void main(void){

            // Parameters defining the pick shape (in barycentric 0-1 units)
            float vertRadius = 0.2;
            float edgeRadius = 0.2;

            vec3 shadeColor = FaceColor;

            // Test vertices
            if (BaryCoord[0] > 1.0-vertRadius) {
                shadeColor = VertexColor0;
            } else if(BaryCoord[1] > 1.0-vertRadius) {
                shadeColor = VertexColor1;
            } else if (BaryCoord[2] > 1.0-vertRadius) {
                shadeColor = VertexColor2;
            } else if (BaryCoord[2] < edgeRadius) {
                shadeColor = EdgeColor0;
            } else if (BaryCoord[0] < edgeRadius) {
                shadeColor = EdgeColor1;
            } else if (BaryCoord[1] < edgeRadius) {
                shadeColor = EdgeColor2;
            }

            gl_FragColor = vec4(shadeColor, 1.);
        }
    `;

    let Material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
    });

    return Material;
  }

  function createInstancedMatCapMaterial(tex_r, tex_g, tex_b, tex_k) {
    let vertexShader = `
        uniform float scale;
        varying vec2 Point;

        void main()
        {
            vec3 vNormal = (modelViewMatrix * instanceMatrix * vec4(normal, 0.)).xyz;
            vNormal = normalize(vNormal);

            // pull slightly inward, to reduce sampling artifacts near edges
            Point.x = 0.93 * vNormal.x * 0.5 + 0.5;
            Point.y = 0.93 * vNormal.y * 0.5 + 0.5;

            gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4( scale * position, 1.0 );

        }
    `;

    let fragmentShader = `
        uniform sampler2D Matcap_r; // Matcap texture
        uniform sampler2D Matcap_g; // Matcap texture
        uniform sampler2D Matcap_b; // Matcap texture
        uniform sampler2D Matcap_k; // Matcap texture
        uniform vec3 color;

        varying vec2 Point;

        ${common}

        void main(void){

            vec2 coord = Point;

            vec4 mat_r = sRGBToLinear(texture2D(Matcap_r, coord));
            vec4 mat_g = sRGBToLinear(texture2D(Matcap_g, coord));
            vec4 mat_b = sRGBToLinear(texture2D(Matcap_b, coord));
            vec4 mat_k = sRGBToLinear(texture2D(Matcap_k, coord));

            vec4 colorCombined = color.r * mat_r + color.g * mat_g + color.b * mat_b +
                                (1. - color.r - color.g - color.b) * mat_k;

            gl_FragColor = colorCombined;
            gl_FragColor = LinearTosRGB( gl_FragColor );
        }
    `;

    let Material = new THREE.ShaderMaterial({
      uniforms: {
        Matcap_r: { value: tex_r },
        Matcap_g: { value: tex_g },
        Matcap_b: { value: tex_b },
        Matcap_k: { value: tex_k },
        color: { value: new THREE.Vector3(1, 0, 1) },
        scale: { value: 1 },
      },
      vertexShader,
      fragmentShader,
    });

    return Material;
  }

  function createInstancedScalarFunctionMaterial(tex_r, tex_g, tex_b, tex_k) {
    let vertexShader = `
        uniform float scale;
        attribute vec3 color;

        varying vec3 Color;
        varying vec2 Point;

        void main()
        {
            vec3 vNormal = (modelViewMatrix * instanceMatrix * vec4(normal, 0.)).xyz;
            vNormal = normalize(vNormal);

            // pull slightly inward, to reduce sampling artifacts near edges
            Point.x = 0.93 * vNormal.x * 0.5 + 0.5;
            Point.y = 0.93 * vNormal.y * 0.5 + 0.5;

            Color = color;

            gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4( scale * position, 1.0 );

        }
    `;

    let fragmentShader = `
        uniform sampler2D Matcap_r; // Matcap texture
        uniform sampler2D Matcap_g; // Matcap texture
        uniform sampler2D Matcap_b; // Matcap texture
        uniform sampler2D Matcap_k; // Matcap texture

        varying vec3 Color;
        varying vec2 Point;

        ${common}

        void main(void){

            vec2 coord = Point;

            vec4 mat_r = sRGBToLinear(texture2D(Matcap_r, coord));
            vec4 mat_g = sRGBToLinear(texture2D(Matcap_g, coord));
            vec4 mat_b = sRGBToLinear(texture2D(Matcap_b, coord));
            vec4 mat_k = sRGBToLinear(texture2D(Matcap_k, coord));

            vec4 colorCombined = Color.r * mat_r + Color.g * mat_g + Color.b * mat_b +
                                (1. - Color.r - Color.g - Color.b) * mat_k;

            gl_FragColor = colorCombined;
            gl_FragColor = LinearTosRGB( gl_FragColor );
        }
    `;

    let Material = new THREE.ShaderMaterial({
      uniforms: {
        Matcap_r: { value: tex_r },
        Matcap_g: { value: tex_g },
        Matcap_b: { value: tex_b },
        Matcap_k: { value: tex_k },
        scale: { value: 1 },
      },
      vertexShader,
      fragmentShader,
    });

    return Material;
  }

  function createPointCloudPickMaterial() {
    let vertexShader = `
        uniform float scale;
        attribute vec3 color;

        varying vec3 Color;


        void main()
        {
            Color = color;

            gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4( scale * position, 1.0 );

        }
    `;

    let fragmentShader = `
        varying vec3 Color;

        ${common}

        void main(void){
            gl_FragColor = vec4(Color, 1.);
        }
    `;

    let Material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
    });

    return Material;
  }

  function createCurveMatCapMaterial(tex_r, tex_g, tex_b, tex_k) {
    let vertexShader = `
        uniform float rad;
        attribute float len;

        varying vec2 Point;

        void main()
        {
            vec3 vNormal = (modelViewMatrix * instanceMatrix * vec4(normal, 0.)).xyz;
            vNormal = normalize(vNormal);

            // pull slightly inward, to reduce sampling artifacts near edges
            Point.x = 0.93 * vNormal.x * 0.5 + 0.5;
            Point.y = 0.93 * vNormal.y * 0.5 + 0.5;

            vec3 scaled_position = vec3(position.x * rad, position.y*rad, position.z*len);
            gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4( scaled_position, 1.0 );

        }
    `;

    let fragmentShader = `
        uniform sampler2D Matcap_r; // Matcap texture
        uniform sampler2D Matcap_g; // Matcap texture
        uniform sampler2D Matcap_b; // Matcap texture
        uniform sampler2D Matcap_k; // Matcap texture
        uniform vec3 color;

        varying vec2 Point;

        ${common}

        void main(void){

            vec2 coord = Point;

            vec4 mat_r = sRGBToLinear(texture2D(Matcap_r, coord));
            vec4 mat_g = sRGBToLinear(texture2D(Matcap_g, coord));
            vec4 mat_b = sRGBToLinear(texture2D(Matcap_b, coord));
            vec4 mat_k = sRGBToLinear(texture2D(Matcap_k, coord));

            vec4 colorCombined = color.r * mat_r + color.g * mat_g + color.b * mat_b +
                                (1. - color.r - color.g - color.b) * mat_k;

            gl_FragColor = colorCombined;
            gl_FragColor = LinearTosRGB( gl_FragColor );
        }
    `;

    let Material = new THREE.ShaderMaterial({
      uniforms: {
        Matcap_r: { value: tex_r },
        Matcap_g: { value: tex_g },
        Matcap_b: { value: tex_b },
        Matcap_k: { value: tex_k },
        color: { value: new THREE.Vector3(1, 0, 1) },
        rad: { value: 1 },
      },
      vertexShader,
      fragmentShader,
    });

    return Material;
  }

  // The next pick index that a structure can use to identify its elements
  // (get it by calling request pickBufferRange())
  let nextPickBufferInd = 1; // 0 returned by dat.gui?

  let structureRanges = [];

  function requestPickBufferRange(structure, count) {
    let structureStart = nextPickBufferInd;
    let structureEnd = nextPickBufferInd + count;

    structureRanges.push({
      start: structureStart,
      end: structureEnd,
      structure: structure,
    });

    nextPickBufferInd = structureEnd;
    return structureStart;
  }

  function globalIndexToLocal(globalInd) {
    // Loop through the ranges that we have allocated to find the one correpsonding to this structure.
    for (let range of structureRanges) {
      if (globalInd >= range.start && globalInd < range.end) {
        return { localInd: globalInd - range.start, structure: range.structure };
      }
    }

    return { localInd: 0, structure: undefined };
  }

  function evaluatePickQuery(pickRenderer, pickScene, camera, xPos, yPos) {
    // draw
    let pickTarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight);
    pickTarget.texture.generateMipmaps = false;
    pickRenderer.setRenderTarget(pickTarget);
    pickRenderer.render(pickScene, camera);

    // read color
    let pixelBuffer = new Uint8Array(4);
    pickRenderer.readRenderTargetPixels(
      pickTarget,
      xPos,
      pickTarget.height - yPos,
      1,
      1,
      pixelBuffer
    );

    // convert color to id
    let globalInd =
      pixelBuffer[0] + pixelBuffer[1] * 256 + pixelBuffer[2] * 256 * 256;

    return globalIndexToLocal(globalInd);
  }

  function pickIndToVector(pickInd) {
    return [
      ((pickInd & 0x000000ff) >> 0) / 255.0,
      ((pickInd & 0x0000ff00) >> 8) / 255.0,
      ((pickInd & 0x00ff0000) >> 16) / 255.0,
    ];
  }

  // polyscope/color_management.cpp
  // Clamp to [0,1]
  function unitClamp(x) {
    return Math.max(0, Math.min(1, x));
  }

  // Used to sample colors. Samples a series of most-distant values from a range [0,1]
  // offset from a starting value 'start' and wrapped around. index=0 returns start
  //
  // Example: if start = 0, emits f(0, i) = {0, 1/2, 1/4, 3/4, 1/8, 5/8, 3/8, 7/8, ...}
  //          if start = 0.3 emits (0.3 + f(0, i)) % 1
  function getIndexedDistinctValue(start, index) {
    if (index < 0) {
      return 0.0;
    }

    // Bit shifty magic to evaluate f()
    let val = 0;
    let p = 0.5;
    while (index > 0) {
      if (index % 2 == 1) {
        val += p;
      }
      index = index / 2;
      p /= 2.0;
    }

    // Apply modular offset
    val = (val + start) % 1.0;

    return unitClamp(val);
  }

  /**
   * https://axonflux.com/handy-rgb-to-hsl-and-rgb-to-hsv-color-model-c
   * Converts an HSV color value to RGB. Conversion formula
   * adapted from http://en.wikipedia.org/wiki/HSV_color_space.
   * Assumes h, s, and v are contained in the set [0, 1] and
   * returns r, g, and b in the set [0, 255].
   *
   * @param   Number  h       The hue
   * @param   Number  s       The saturation
   * @param   Number  v       The value
   * @return  Array           The RGB representation
   */
  function hsvToRgb(h, s, v) {
    let r, g, b;

    let i = Math.floor(h * 6);
    let f = h * 6 - i;
    let p = v * (1 - s);
    let q = v * (1 - f * s);
    let t = v * (1 - (1 - f) * s);

    switch (i % 6) {
      case 0:
        (r = v), (g = t), (b = p);
        break;
      case 1:
        (r = q), (g = v), (b = p);
        break;
      case 2:
        (r = p), (g = v), (b = t);
        break;
      case 3:
        (r = p), (g = q), (b = v);
        break;
      case 4:
        (r = t), (g = p), (b = v);
        break;
      case 5:
        (r = v), (g = p), (b = q);
        break;
    }

    return [r * 255, g * 255, b * 255];
  }

  // Get an indexed offset color. Inputs and outputs in RGB
  function indexOffsetHue(baseHSV, index) {
    let newHue = getIndexedDistinctValue(baseHSV[0], index);
    return hsvToRgb(newHue, baseHSV[1], baseHSV[2]);
  }

  // Keep track of unique structure colors
  // let uniqueColorBaseRGB = [28 / 255, 99 / 255, 227 / 255];
  let uniqueColorBaseHSV = [219 / 360, 88 / 100, 89 / 100];
  let iUniqueColor = 0;

  function getNextUniqueColor() {
    return indexOffsetHue(uniqueColorBaseHSV, iUniqueColor++);
  }

  // prettier-ignore
  let colorMaps = {
      viridis : ["#440154","#440256","#450457","#450559","#46075a","#46085c","#460a5d","#460b5e","#470d60","#470e61","#471063","#471164","#471365","#481467","#481668","#481769","#48186a","#481a6c","#481b6d","#481c6e","#481d6f","#481f70","#482071","#482173","#482374","#482475","#482576","#482677","#482878","#482979","#472a7a","#472c7a","#472d7b","#472e7c","#472f7d","#46307e","#46327e","#46337f","#463480","#453581","#453781","#453882","#443983","#443a83","#443b84","#433d84","#433e85","#423f85","#424086","#424186","#414287","#414487","#404588","#404688","#3f4788","#3f4889","#3e4989","#3e4a89","#3e4c8a","#3d4d8a","#3d4e8a","#3c4f8a","#3c508b","#3b518b","#3b528b","#3a538b","#3a548c","#39558c","#39568c","#38588c","#38598c","#375a8c","#375b8d","#365c8d","#365d8d","#355e8d","#355f8d","#34608d","#34618d","#33628d","#33638d","#32648e","#32658e","#31668e","#31678e","#31688e","#30698e","#306a8e","#2f6b8e","#2f6c8e","#2e6d8e","#2e6e8e","#2e6f8e","#2d708e","#2d718e","#2c718e","#2c728e","#2c738e","#2b748e","#2b758e","#2a768e","#2a778e","#2a788e","#29798e","#297a8e","#297b8e","#287c8e","#287d8e","#277e8e","#277f8e","#27808e","#26818e","#26828e","#26828e","#25838e","#25848e","#25858e","#24868e","#24878e","#23888e","#23898e","#238a8d","#228b8d","#228c8d","#228d8d","#218e8d","#218f8d","#21908d","#21918c","#20928c","#20928c","#20938c","#1f948c","#1f958b","#1f968b","#1f978b","#1f988b","#1f998a","#1f9a8a","#1e9b8a","#1e9c89","#1e9d89","#1f9e89","#1f9f88","#1fa088","#1fa188","#1fa187","#1fa287","#20a386","#20a486","#21a585","#21a685","#22a785","#22a884","#23a983","#24aa83","#25ab82","#25ac82","#26ad81","#27ad81","#28ae80","#29af7f","#2ab07f","#2cb17e","#2db27d","#2eb37c","#2fb47c","#31b57b","#32b67a","#34b679","#35b779","#37b878","#38b977","#3aba76","#3bbb75","#3dbc74","#3fbc73","#40bd72","#42be71","#44bf70","#46c06f","#48c16e","#4ac16d","#4cc26c","#4ec36b","#50c46a","#52c569","#54c568","#56c667","#58c765","#5ac864","#5cc863","#5ec962","#60ca60","#63cb5f","#65cb5e","#67cc5c","#69cd5b","#6ccd5a","#6ece58","#70cf57","#73d056","#75d054","#77d153","#7ad151","#7cd250","#7fd34e","#81d34d","#84d44b","#86d549","#89d548","#8bd646","#8ed645","#90d743","#93d741","#95d840","#98d83e","#9bd93c","#9dd93b","#a0da39","#a2da37","#a5db36","#a8db34","#aadc32","#addc30","#b0dd2f","#b2dd2d","#b5de2b","#b8de29","#bade28","#bddf26","#c0df25","#c2df23","#c5e021","#c8e020","#cae11f","#cde11d","#d0e11c","#d2e21b","#d5e21a","#d8e219","#dae319","#dde318","#dfe318","#e2e418","#e5e419","#e7e419","#eae51a","#ece51b","#efe51c","#f1e51d","#f4e61e","#f6e620","#f8e621","#fbe723","#fde725"],
      plasma: ["#0d0887","#100788","#130789","#16078a","#19068c","#1b068d","#1d068e","#20068f","#220690","#240691","#260591","#280592","#2a0593","#2c0594","#2e0595","#2f0596","#310597","#330597","#350498","#370499","#38049a","#3a049a","#3c049b","#3e049c","#3f049c","#41049d","#43039e","#44039e","#46039f","#48039f","#4903a0","#4b03a1","#4c02a1","#4e02a2","#5002a2","#5102a3","#5302a3","#5502a4","#5601a4","#5801a4","#5901a5","#5b01a5","#5c01a6","#5e01a6","#6001a6","#6100a7","#6300a7","#6400a7","#6600a7","#6700a8","#6900a8","#6a00a8","#6c00a8","#6e00a8","#6f00a8","#7100a8","#7201a8","#7401a8","#7501a8","#7701a8","#7801a8","#7a02a8","#7b02a8","#7d03a8","#7e03a8","#8004a8","#8104a7","#8305a7","#8405a7","#8606a6","#8707a6","#8808a6","#8a09a5","#8b0aa5","#8d0ba5","#8e0ca4","#8f0da4","#910ea3","#920fa3","#9410a2","#9511a1","#9613a1","#9814a0","#99159f","#9a169f","#9c179e","#9d189d","#9e199d","#a01a9c","#a11b9b","#a21d9a","#a31e9a","#a51f99","#a62098","#a72197","#a82296","#aa2395","#ab2494","#ac2694","#ad2793","#ae2892","#b02991","#b12a90","#b22b8f","#b32c8e","#b42e8d","#b52f8c","#b6308b","#b7318a","#b83289","#ba3388","#bb3488","#bc3587","#bd3786","#be3885","#bf3984","#c03a83","#c13b82","#c23c81","#c33d80","#c43e7f","#c5407e","#c6417d","#c7427c","#c8437b","#c9447a","#ca457a","#cb4679","#cc4778","#cc4977","#cd4a76","#ce4b75","#cf4c74","#d04d73","#d14e72","#d24f71","#d35171","#d45270","#d5536f","#d5546e","#d6556d","#d7566c","#d8576b","#d9586a","#da5a6a","#da5b69","#db5c68","#dc5d67","#dd5e66","#de5f65","#de6164","#df6263","#e06363","#e16462","#e26561","#e26660","#e3685f","#e4695e","#e56a5d","#e56b5d","#e66c5c","#e76e5b","#e76f5a","#e87059","#e97158","#e97257","#ea7457","#eb7556","#eb7655","#ec7754","#ed7953","#ed7a52","#ee7b51","#ef7c51","#ef7e50","#f07f4f","#f0804e","#f1814d","#f1834c","#f2844b","#f3854b","#f3874a","#f48849","#f48948","#f58b47","#f58c46","#f68d45","#f68f44","#f79044","#f79143","#f79342","#f89441","#f89540","#f9973f","#f9983e","#f99a3e","#fa9b3d","#fa9c3c","#fa9e3b","#fb9f3a","#fba139","#fba238","#fca338","#fca537","#fca636","#fca835","#fca934","#fdab33","#fdac33","#fdae32","#fdaf31","#fdb130","#fdb22f","#fdb42f","#fdb52e","#feb72d","#feb82c","#feba2c","#febb2b","#febd2a","#febe2a","#fec029","#fdc229","#fdc328","#fdc527","#fdc627","#fdc827","#fdca26","#fdcb26","#fccd25","#fcce25","#fcd025","#fcd225","#fbd324","#fbd524","#fbd724","#fad824","#fada24","#f9dc24","#f9dd25","#f8df25","#f8e125","#f7e225","#f7e425","#f6e626","#f6e826","#f5e926","#f5eb27","#f4ed27","#f3ee27","#f3f027","#f2f227","#f1f426","#f1f525","#f0f724","#f0f921"],
      magma: ["#000004","#010005","#010106","#010108","#020109","#02020b","#02020d","#03030f","#030312","#040414","#050416","#060518","#06051a","#07061c","#08071e","#090720","#0a0822","#0b0924","#0c0926","#0d0a29","#0e0b2b","#100b2d","#110c2f","#120d31","#130d34","#140e36","#150e38","#160f3b","#180f3d","#19103f","#1a1042","#1c1044","#1d1147","#1e1149","#20114b","#21114e","#221150","#241253","#251255","#271258","#29115a","#2a115c","#2c115f","#2d1161","#2f1163","#311165","#331067","#341069","#36106b","#38106c","#390f6e","#3b0f70","#3d0f71","#3f0f72","#400f74","#420f75","#440f76","#451077","#471078","#491078","#4a1079","#4c117a","#4e117b","#4f127b","#51127c","#52137c","#54137d","#56147d","#57157e","#59157e","#5a167e","#5c167f","#5d177f","#5f187f","#601880","#621980","#641a80","#651a80","#671b80","#681c81","#6a1c81","#6b1d81","#6d1d81","#6e1e81","#701f81","#721f81","#732081","#752181","#762181","#782281","#792282","#7b2382","#7c2382","#7e2482","#802582","#812581","#832681","#842681","#862781","#882781","#892881","#8b2981","#8c2981","#8e2a81","#902a81","#912b81","#932b80","#942c80","#962c80","#982d80","#992d80","#9b2e7f","#9c2e7f","#9e2f7f","#a02f7f","#a1307e","#a3307e","#a5317e","#a6317d","#a8327d","#aa337d","#ab337c","#ad347c","#ae347b","#b0357b","#b2357b","#b3367a","#b5367a","#b73779","#b83779","#ba3878","#bc3978","#bd3977","#bf3a77","#c03a76","#c23b75","#c43c75","#c53c74","#c73d73","#c83e73","#ca3e72","#cc3f71","#cd4071","#cf4070","#d0416f","#d2426f","#d3436e","#d5446d","#d6456c","#d8456c","#d9466b","#db476a","#dc4869","#de4968","#df4a68","#e04c67","#e24d66","#e34e65","#e44f64","#e55064","#e75263","#e85362","#e95462","#ea5661","#eb5760","#ec5860","#ed5a5f","#ee5b5e","#ef5d5e","#f05f5e","#f1605d","#f2625d","#f2645c","#f3655c","#f4675c","#f4695c","#f56b5c","#f66c5c","#f66e5c","#f7705c","#f7725c","#f8745c","#f8765c","#f9785d","#f9795d","#f97b5d","#fa7d5e","#fa7f5e","#fa815f","#fb835f","#fb8560","#fb8761","#fc8961","#fc8a62","#fc8c63","#fc8e64","#fc9065","#fd9266","#fd9467","#fd9668","#fd9869","#fd9a6a","#fd9b6b","#fe9d6c","#fe9f6d","#fea16e","#fea36f","#fea571","#fea772","#fea973","#feaa74","#feac76","#feae77","#feb078","#feb27a","#feb47b","#feb67c","#feb77e","#feb97f","#febb81","#febd82","#febf84","#fec185","#fec287","#fec488","#fec68a","#fec88c","#feca8d","#fecc8f","#fecd90","#fecf92","#fed194","#fed395","#fed597","#fed799","#fed89a","#fdda9c","#fddc9e","#fddea0","#fde0a1","#fde2a3","#fde3a5","#fde5a7","#fde7a9","#fde9aa","#fdebac","#fcecae","#fceeb0","#fcf0b2","#fcf2b4","#fcf4b6","#fcf6b8","#fcf7b9","#fcf9bb","#fcfbbd","#fcfdbf"],
      inferno: ["#000004","#010005","#010106","#010108","#02010a","#02020c","#02020e","#030210","#040312","#040314","#050417","#060419","#07051b","#08051d","#09061f","#0a0722","#0b0724","#0c0826","#0d0829","#0e092b","#10092d","#110a30","#120a32","#140b34","#150b37","#160b39","#180c3c","#190c3e","#1b0c41","#1c0c43","#1e0c45","#1f0c48","#210c4a","#230c4c","#240c4f","#260c51","#280b53","#290b55","#2b0b57","#2d0b59","#2f0a5b","#310a5c","#320a5e","#340a5f","#360961","#380962","#390963","#3b0964","#3d0965","#3e0966","#400a67","#420a68","#440a68","#450a69","#470b6a","#490b6a","#4a0c6b","#4c0c6b","#4d0d6c","#4f0d6c","#510e6c","#520e6d","#540f6d","#550f6d","#57106e","#59106e","#5a116e","#5c126e","#5d126e","#5f136e","#61136e","#62146e","#64156e","#65156e","#67166e","#69166e","#6a176e","#6c186e","#6d186e","#6f196e","#71196e","#721a6e","#741a6e","#751b6e","#771c6d","#781c6d","#7a1d6d","#7c1d6d","#7d1e6d","#7f1e6c","#801f6c","#82206c","#84206b","#85216b","#87216b","#88226a","#8a226a","#8c2369","#8d2369","#8f2469","#902568","#922568","#932667","#952667","#972766","#982766","#9a2865","#9b2964","#9d2964","#9f2a63","#a02a63","#a22b62","#a32c61","#a52c60","#a62d60","#a82e5f","#a92e5e","#ab2f5e","#ad305d","#ae305c","#b0315b","#b1325a","#b3325a","#b43359","#b63458","#b73557","#b93556","#ba3655","#bc3754","#bd3853","#bf3952","#c03a51","#c13a50","#c33b4f","#c43c4e","#c63d4d","#c73e4c","#c83f4b","#ca404a","#cb4149","#cc4248","#ce4347","#cf4446","#d04545","#d24644","#d34743","#d44842","#d54a41","#d74b3f","#d84c3e","#d94d3d","#da4e3c","#db503b","#dd513a","#de5238","#df5337","#e05536","#e15635","#e25734","#e35933","#e45a31","#e55c30","#e65d2f","#e75e2e","#e8602d","#e9612b","#ea632a","#eb6429","#eb6628","#ec6726","#ed6925","#ee6a24","#ef6c23","#ef6e21","#f06f20","#f1711f","#f1731d","#f2741c","#f3761b","#f37819","#f47918","#f57b17","#f57d15","#f67e14","#f68013","#f78212","#f78410","#f8850f","#f8870e","#f8890c","#f98b0b","#f98c0a","#f98e09","#fa9008","#fa9207","#fa9407","#fb9606","#fb9706","#fb9906","#fb9b06","#fb9d07","#fc9f07","#fca108","#fca309","#fca50a","#fca60c","#fca80d","#fcaa0f","#fcac11","#fcae12","#fcb014","#fcb216","#fcb418","#fbb61a","#fbb81d","#fbba1f","#fbbc21","#fbbe23","#fac026","#fac228","#fac42a","#fac62d","#f9c72f","#f9c932","#f9cb35","#f8cd37","#f8cf3a","#f7d13d","#f7d340","#f6d543","#f6d746","#f5d949","#f5db4c","#f4dd4f","#f4df53","#f4e156","#f3e35a","#f3e55d","#f2e661","#f2e865","#f2ea69","#f1ec6d","#f1ed71","#f1ef75","#f1f179","#f2f27d","#f2f482","#f3f586","#f3f68a","#f4f88e","#f5f992","#f6fa96","#f8fb9a","#f9fc9d","#fafda1","#fcffa4"],
  	  coolwarm: ["#3c4ec2", "#9bbcff", "#dcdcdc", "#f6a385", "#b40426"],
  };

  function applyColorMap(name, value, min, max) {
    let map = colorMaps[name];
    let alpha = (value - min) / (max - min);

    let prevIdx = Math.floor(alpha * (map.length - 1));
    let t = alpha * (map.length - 1) - prevIdx;
    let prevColor = new THREE.Color(map[prevIdx]);
    let nextColor = new THREE.Color(map[prevIdx + 1]);

    return prevColor.lerp(nextColor, t);
  }

  function computeMinMax(values) {
    let min = values[0];
    let max = values[0];
    values.forEach((v) => {
      min = Math.min(min, v);
      max = Math.max(max, v);
    });
    return [min, max];
  }

  class VertexScalarQuantity {
    constructor(name, values, parentMesh) {
      this.parent = parentMesh;
      this.ps = this.parent.ps;
      this.values = values;
      this.name = name;
      this.enabled = false;

      this.isDominantQuantity = true;

      [this.dataMin, this.dataMax] = computeMinMax(values);

      // create a new mesh material
      let functionMaterial = createVertexScalarFunctionMaterial(
        this.ps.matcapTextures.r,
        this.ps.matcapTextures.g,
        this.ps.matcapTextures.b,
        this.ps.matcapTextures.k
      );

      // build a three.js mesh to visualize the function
      this.mesh = new THREE.Mesh(this.parent.mesh.geometry.clone(), functionMaterial);
      this.initializeColorMap();

      // Copy some attributes from parent
      this.mesh.geometry.attributes.position = this.parent.mesh.geometry.attributes.position;
      this.mesh.geometry.attributes.normal = this.parent.mesh.geometry.attributes.normal;
      this.mesh.material.uniforms.edgeWidth = this.parent.mesh.material.uniforms.edgeWidth;
      this.mesh.material.uniforms.edgeColor = this.parent.mesh.material.uniforms.edgeColor;
    }

    initGui(guiFields, guiFolder) {
      this.prefix = this.parent.name + "#" + this.name;
      this.guiFields = guiFields;

      guiFields[this.prefix + "#Enabled"] = false;
      guiFolder
        .add(guiFields, this.prefix + "#Enabled")
        .onChange((e) => {
          this.setEnabled(e);
        })
        .listen()
        .name("Enabled");

      guiFields[this.prefix + "#ColorMap"] = "viridis";
      this.applyColorMap(guiFields[this.prefix + "#ColorMap"]);
      guiFolder
        .add(guiFields, this.prefix + "#ColorMap", [
          "viridis",
          "coolwarm",
          "plasma",
          "magma",
          "inferno",
        ])
        .onChange((cm) => {
          this.applyColorMap(cm);
        })
        .listen()
        .name("Color Map");
    }

    setEnabled(enabled) {
      this.guiFields[this.prefix + "#Enabled"] = enabled;
      this.enabled = enabled;
      if (enabled) {
        this.parent.enableQuantity(this);
      } else {
        this.parent.disableQuantity(this);
      }
    }

    setColorMap(cm) {
      this.guiFields[this.prefix + "#ColorMap"] = cm;
      this.applyColorMap(cm);
    }

    initializeColorMap() {
      let F = this.parent.faces.size();
      let colors = new Float32Array(F * 3 * 3);
      this.mesh.geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    }

    applyColorMap(cm) {
      // update color buffer
      const colors = this.mesh.geometry.attributes.color.array;

      let F = this.parent.faces.size();
      for (let iF = 0; iF < F; iF++) {
        let face = this.parent.faces.get(iF);
        for (let iV = 0; iV < 3; iV++) {
          let value = this.values[this.parent.getCorner(face, iV)];
          let color = applyColorMap(cm, value, this.dataMin, this.dataMax);

          colors[3 * 3 * iF + 3 * iV + 0] = color.r;
          colors[3 * 3 * iF + 3 * iV + 1] = color.g;
          colors[3 * 3 * iF + 3 * iV + 2] = color.b;
        }
      }

      this.mesh.geometry.attributes.color.needsUpdate = true;
    }

    getVertexValue(iV) {
      return this.ps.prettyScalar(this.values[iV]);
    }
    getEdgeValue(iE) {
      return undefined;
    }
    getFaceValue(iE) {
      return undefined;
    }

    remove() {}
  }

  class PointCloudScalarQuantity {
    constructor(name, values, parentCloud) {
      this.parent = parentCloud;
      this.ps = this.parent.ps;
      this.values = values;
      this.name = name;
      this.enabled = false;

      this.isDominantQuantity = true;

      [this.dataMin, this.dataMax] = computeMinMax(values);

      // create a new mesh material
      createInstancedScalarFunctionMaterial(
        this.ps.matcapTextures.r,
        this.ps.matcapTextures.g,
        this.ps.matcapTextures.b,
        this.ps.matcapTextures.k
      );

      // create matcap material
      let matcapMaterial = createInstancedScalarFunctionMaterial(
        this.ps.matcapTextures.r,
        this.ps.matcapTextures.g,
        this.ps.matcapTextures.b,
        this.ps.matcapTextures.k
      );

      // create mesh
      this.mesh = new THREE.InstancedMesh(
        this.parent.mesh.geometry.clone(),
        matcapMaterial,
        this.parent.nV
      );

      // Copy some attributes from parent
      this.mesh.geometry.attributes.position = this.parent.mesh.geometry.attributes.position;
      this.mesh.geometry.attributes.normal = this.parent.mesh.geometry.attributes.normal;
      this.mesh.material.uniforms.scale = this.parent.mesh.material.uniforms.scale;
      this.mesh.instanceMatrix = this.parent.mesh.instanceMatrix;

      this.initializeColorMap();
    }

    initGui(guiFields, guiFolder) {
      this.prefix = this.parent.name + "#" + this.name;
      this.guiFields = guiFields;

      guiFields[this.prefix + "#Enabled"] = false;
      guiFolder
        .add(guiFields, this.prefix + "#Enabled")
        .onChange((e) => {
          this.setEnabled(e);
        })
        .listen()
        .name("Enabled");

      guiFields[this.prefix + "#ColorMap"] = "viridis";
      this.applyColorMap(guiFields[this.prefix + "#ColorMap"]);
      guiFolder
        .add(guiFields, this.prefix + "#ColorMap", [
          "viridis",
          "coolwarm",
          "plasma",
          "magma",
          "inferno",
        ])
        .onChange((cm) => {
          this.applyColorMap(cm);
        })
        .listen()
        .name("Color Map");
    }

    setEnabled(enabled) {
      this.guiFields[this.prefix + "#Enabled"] = enabled;
      this.enabled = enabled;
      if (enabled) {
        this.parent.enableQuantity(this);
      } else {
        this.parent.disableQuantity(this);
      }
    }

    initializeColorMap() {
      let V = this.parent.nV;
      let colors = new Float32Array(V * 3);
      this.mesh.geometry.setAttribute(
        "color",
        new THREE.InstancedBufferAttribute(colors, 3)
      );
    }

    applyColorMap(cm) {
      // update color buffer
      const colors = this.mesh.geometry.attributes.color.array;

      let V = this.parent.nV;
      for (let iV = 0; iV < V; iV++) {
        let value = this.values[iV];
        let color = applyColorMap(cm, value, this.dataMin, this.dataMax);

        colors[3 * iV + 0] = color.r;
        colors[3 * iV + 1] = color.g;
        colors[3 * iV + 2] = color.b;
      }

      this.mesh.geometry.attributes.color.needsUpdate = true;
    }

    getVertexValue(iV) {
      return this.values[iV];
    }
    getEdgeValue(iE) {
      return undefined;
    }
    getFaceValue(iE) {
      return undefined;
    }

    remove() {}
  }

  class VertexVectorQuantity {
    constructor(name, values, parentMesh) {
      this.parent = parentMesh;
      this.ps = this.parent.ps;
      this.values = values;
      this.name = name;
      this.enabled = false;
      this.res = 4;
      this.rad = 0.5;
      this.len = 3;
      this.tipFrac = 0.3;
      this.widthFrac = 0.5;

      this.isDominantQuantity = false;

      // build a three.js mesh to visualize the function
      this.mesh = this.constructArrowMesh(this.parent.coords, values);
    }

    constructArrowMesh(bases, directions) {
      let torsoGeometry = new THREE.CylinderGeometry(
        this.rad * this.widthFrac,
        this.rad * this.widthFrac,
        this.len * (1 - this.tipFrac),
        this.res
      );

      // By default, the cylinder is vertically centered. But I want it to go upwards
      // from the origin, so I translate all of its vertices up by height/2
      let positions = torsoGeometry.attributes.position.array;
      let V = torsoGeometry.attributes.position.count;
      let minY = (-this.len * (1 - this.tipFrac)) / 2;
      for (let i = 0; i < V; i++) {
        positions[3 * i + 1] = positions[3 * i + 1] - minY;
      }

      let tipGeometry = new THREE.CylinderGeometry(
        0,
        this.rad,
        this.len * this.tipFrac,
        this.res
      );

      // By default, the tip is vertically centered. But I want it to be at the top
      // of the cylinder, so again I translate all of its vertices up
      positions = tipGeometry.attributes.position.array;
      V = tipGeometry.attributes.position.count;
      minY = (-this.len * this.tipFrac) / 2;
      for (let i = 0; i < V; i++) {
        positions[3 * i + 1] =
          positions[3 * i + 1] - minY + this.len * (1 - this.tipFrac);
      }

      let mat = new THREE.Matrix4();
      // prettier-ignore
      mat.set(0, 0, 1, 0,
              1, 0, 0, 0,
              0, 1, 0, 0,
              0, 0, 0, 1);
      torsoGeometry.applyMatrix4(mat);
      tipGeometry.applyMatrix4(mat);

      // create matcap material
      let material = createInstancedMatCapMaterial(
        this.ps.matcapTextures.r,
        this.ps.matcapTextures.g,
        this.ps.matcapTextures.b,
        this.ps.matcapTextures.k
      );
      material.uniforms.scale.value = 0.05;

      let nV = this.parent.nV;
      this.torsoMesh = new THREE.InstancedMesh(torsoGeometry, material, nV);
      this.tipMesh = new THREE.InstancedMesh(tipGeometry, material, nV);

      mat = new THREE.Matrix4();
      for (let iV = 0; iV < nV; iV++) {
        let pos = this.parent.coords.get(iV);
        let v = directions.get(iV);
        mat.lookAt(v, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 1));
        mat.setPosition(pos[0], pos[1], pos[2]);
        this.torsoMesh.setMatrixAt(iV, mat);
        this.tipMesh.setMatrixAt(iV, mat);
      }

      let arrows = new THREE.Group();
      arrows.add(this.torsoMesh);
      arrows.add(this.tipMesh);

      return arrows;
    }

    initGui(guiFields, guiFolder) {
      this.prefix = this.parent.name + "#" + this.name;
      this.guiFields = guiFields;

      guiFields[this.prefix + "#Enabled"] = false;
      guiFolder
        .add(guiFields, this.prefix + "#Enabled")
        .onChange((e) => {
          this.setEnabled(e);
        })
        .listen()
        .name("Enabled");

      guiFields[this.name + "#Color"] = getNextUniqueColor();
      this.setColor(guiFields[this.name + "#Color"]);
      guiFolder
        .addColor(guiFields, this.name + "#Color")
        .onChange((c) => {
          this.setColor(c);
        })
        .listen()
        .name("Color");

      guiFields[this.name + "#Radius"] = 1;
      this.setRadius(guiFields[this.name + "#Radius"]);
      guiFolder
        .add(guiFields, this.name + "#Radius")
        .min(0)
        .max(5)
        .step(0.05)
        .onChange((c) => {
          this.setRadius(c);
        })
        .listen()
        .name("Radius");
    }

    setColor(color) {
      let c = new THREE.Vector3(color[0] / 255, color[1] / 255, color[2] / 255);
      this.torsoMesh.material.uniforms.color.value = c;
      this.tipMesh.material.uniforms.color.value = c;
    }

    setRadius(rad) {
      this.torsoMesh.material.uniforms.scale.value = rad * 0.05;
      this.tipMesh.material.uniforms.scale.value = rad * 0.05;
    }

    setEnabled(enabled) {
      this.guiFields[this.prefix + "#Enabled"] = enabled;
      this.enabled = enabled;
      if (enabled) {
        this.parent.enableQuantity(this);
      } else {
        this.parent.disableQuantity(this);
      }
    }

    getVertexValue(iV) {
      let vec = this.values.get(iV);
      let vecList = [vec.x, vec.y, vec.z];
      return this.ps.prettyVector(vecList);
    }
    getEdgeValue(iE) {
      return undefined;
    }
    getFaceValue(iE) {
      return undefined;
    }
  }

  class SurfaceMesh {
    constructor(coords, faces, name, polyscopeEnvironment) {
      this.ps = polyscopeEnvironment;
      this.nV = coords.size();
      this.coords = coords;
      this.faces = faces;
      this.name = name;
      this.enabled = true;

      // build three.js mesh
      [this.mesh, this.geo] = this.constructThreeMesh(coords, faces);

      [
        this.smoothVertexNormals,
        this.smoothCornerNormals,
      ] = this.computeSmoothNormals();

      this.pickMesh = this.constructThreePickMesh(coords, faces);

      this.quantities = {};

      this.setSmoothShading(true);

      this.guiFields = undefined;
      this.guiFolder = undefined;
    }

    addVertexScalarQuantity(name, values) {
      this.quantities[name] = new VertexScalarQuantity(name, values, this);

      let quantityGui = this.guiFolder.addFolder(name);
      this.quantities[name].initGui(this.guiFields, quantityGui);

      return this.quantities[name];
    }

    addVertexVectorQuantity(name, values) {
      this.quantities[name] = new VertexVectorQuantity(name, values, this);

      let quantityGui = this.guiFolder.addFolder(name);
      this.quantities[name].initGui(this.guiFields, quantityGui);

      return this.quantities[name];
    }

    initGui(guiFields, guiFolder) {
      this.guiFields = guiFields;
      this.guiFolder = guiFolder;

      guiFields[this.name + "#Enabled"] = true;
      guiFolder
        .add(guiFields, this.name + "#Enabled")
        .onChange((e) => {
          this.setEnabled(e);
        })
        .listen()
        .name("Enabled");

      guiFields[this.name + "#Smooth"] = true;
      guiFolder
        .add(guiFields, this.name + "#Smooth")
        .onChange((c) => {
          this.setSmoothShading(c);
        })
        .listen()
        .name("Smooth");

      guiFields[this.name + "#Color"] = getNextUniqueColor();
      this.setColor(guiFields[this.name + "#Color"]);
      guiFolder
        .addColor(guiFields, this.name + "#Color")
        .onChange((c) => {
          this.setColor(c);
        })
        .listen()
        .name("Color");
      guiFields[this.name + "#Edge Width"] = 0;
      guiFolder
        .add(guiFields, this.name + "#Edge Width")
        .min(0)
        .max(2)
        .step(0.05)
        .onChange((width) => {
          this.mesh.material.uniforms.edgeWidth.value = width;
        })
        .listen()
        .name("Edge Width");

      guiFields[this.name + "#Edge Color"] = [0, 0, 0];
      guiFolder
        .addColor(guiFields, this.name + "#Edge Color")
        .onChange((c) => {
          this.setEdgeColor(c);
        })
        .listen()
        .name("Edge Color");

      guiFolder.open();
    }

    setSmoothShading(shadeSmooth) {
      if (shadeSmooth) {
        // make a copy of smoothCornerNormals rather than setting the geometry's normals
        // to smoothCornerNormals themselves so that calling computeVertexNormals later
        // doesn't overwrite our nice smoothCornerNormals
        this.mesh.geometry.attributes.normal.array = new Float32Array(
          this.smoothCornerNormals
        );
      } else {
        this.mesh.geometry.computeVertexNormals();
      }
      this.mesh.geometry.attributes.normal.needsUpdate = true;
    }

    setColor(color) {
      let c = new THREE.Vector3(color[0] / 255, color[1] / 255, color[2] / 255);
      this.mesh.material.uniforms.color.value = c;
    }

    setEdgeColor(color) {
      let c = new THREE.Vector3(color[0] / 255, color[1] / 255, color[2] / 255);
      this.mesh.material.uniforms.edgeColor.value = c;
    }

    setEnabled(enabled) {
      this.enabled = enabled;
      this.guiFields[this.name + "#Enabled"] = enabled;
      if (enabled) {
        let enabledQuantity = false;
        for (let q in this.quantities) {
          if (this.quantities[q].enabled) {
            this.ps.scene.add(this.quantities[q].mesh);
            enabledQuantity = true;
          }
        }
        if (!enabledQuantity) {
          this.ps.scene.add(this.mesh);
        }
        this.ps.pickScene.add(this.pickMesh);
      } else {
        for (let q in this.quantities) {
          this.ps.scene.remove(this.quantities[q].mesh);
        }
        this.ps.scene.remove(this.mesh);
        this.ps.pickScene.remove(this.pickMesh);
      }
    }

    enableQuantity(q) {
      if (q.isDominantQuantity) {
        for (let pName in this.quantities) {
          let p = this.quantities[pName];
          if (p.isDominantQuantity && pName != q.name) {
            this.guiFields[p.prefix + "#Enabled"] = false;
            p.enabled = false;
            this.ps.scene.remove(p.mesh);
          }
        }
      }

      if (this.enabled) {
        if (q.isDominantQuantity) {
          this.ps.scene.remove(this.mesh);
        }
        this.ps.scene.add(q.mesh);
      }
    }

    disableQuantity(q) {
      if (this.enabled) {
        this.ps.scene.remove(q.mesh);
        this.ps.scene.add(this.mesh);
      }
    }

    remove() {
      for (let q in this.quantities) {
        this.ps.scene.remove(this.quantities[q].mesh);
        this.quantities[q].remove();
      }
      this.quantities = {};
    }

    computeSmoothNormals() {
      // TODO: handle non-triangular face
      let V = this.nV;
      let F = this.faces.size();
      let vertexNormals = new Float32Array(V * 3);
      for (let iV = 0; iV < V; ++iV) {
        vertexNormals[3 * iV + 0] = 0;
        vertexNormals[3 * iV + 1] = 0;
        vertexNormals[3 * iV + 2] = 0;
      }

      const currNormals = this.mesh.geometry.attributes.normal.array;
      for (let iF = 0; iF < F; iF++) {
        let face = this.faces.get(iF);
        for (let iV = 0; iV < 3; iV++) {
          let v = this.getCorner(face, iV);
          for (let iD = 0; iD < 3; ++iD) {
            vertexNormals[3 * v + iD] += currNormals[3 * 3 * iF + 3 * iV + iD];
          }
        }
      }

      for (let iV = 0; iV < V; ++iV) {
        let n = new THREE.Vector3(
          vertexNormals[3 * iV + 0],
          vertexNormals[3 * iV + 1],
          vertexNormals[3 * iV + 2]
        );
        n.normalize();
        vertexNormals[3 * iV + 0] = n.x;
        vertexNormals[3 * iV + 1] = n.y;
        vertexNormals[3 * iV + 2] = n.z;
      }

      let normals = new Float32Array(F * 3 * 3);
      for (let iF = 0; iF < F; iF++) {
        let face = this.faces.get(iF);
        for (let iV = 0; iV < 3; iV++) {
          for (let iD = 0; iD < 3; ++iD) {
            normals[3 * 3 * iF + 3 * iV + iD] =
              vertexNormals[3 * this.getCorner(face, iV) + iD];
          }
        }
      }
      return [vertexNormals, normals];
    }

    setPosition(pos) {
      // First, undo the mesh's rotation so that we translate in the global coordinate frame
      let oldRot = new THREE.Euler(
        this.mesh.rotation.x,
        this.mesh.rotation.y,
        this.mesh.rotation.z
      );
      this.mesh.setRotationFromAxisAngle(new THREE.Vector3(1, 0, 0), 0);
      this.pickMesh.setRotationFromAxisAngle(new THREE.Vector3(1, 0, 0), 0);
      let oldPos = this.mesh.position;
      this.mesh.translateX(pos.x - oldPos.x, 1);
      this.mesh.translateY(pos.y - oldPos.y, 1);
      this.mesh.translateZ(pos.z - oldPos.z, 1);

      oldPos = this.pickMesh.position;
      this.pickMesh.translateX(pos.x - oldPos.x, 1);
      this.pickMesh.translateY(pos.y - oldPos.y, 1);
      this.pickMesh.translateZ(pos.z - oldPos.z, 1);

      // After translating, we re-apply the old rotation
      this.mesh.setRotationFromEuler(oldRot);
      this.pickMesh.setRotationFromEuler(oldRot);
    }

    setOrientationFromMatrix(mat) {
      this.mesh.setRotationFromAxisAngle(new THREE.Vector3(1, 0, 0), 0);
      this.mesh.setRotationFromMatrix(mat);
      this.pickMesh.setRotationFromAxisAngle(new THREE.Vector3(1, 0, 0), 0);
      this.pickMesh.setRotationFromMatrix(mat);
    }

    setOrientationFromFrame(T, N, B) {
      let mat = new THREE.Matrix4();
      // prettier-ignore
      mat.set(
            -T.x, N.x, -B.x, 0,
            -T.y, N.y, -B.y, 0,
            -T.z, N.z, -B.z, 0,
            0,    0,   0,    1
        );

      this.setOrientationFromMatrix(mat);
    }

    // TODO: support polygon meshes
    constructThreeMesh(coords, faces) {
      // create geometry object
      let threeGeometry = new THREE.BufferGeometry();

      if (faces.get(0).get) {
        this.getCorner = function (f, iV) {
          return f.get(iV);
        };
      } else if (faces.get(0)[0]) {
        this.getCorner = function (f, iV) {
          return f[iV];
        };
      }
      if (coords.get(0)[0]) {
        this.getDim = function (coord, iD) {
          return coord[iD];
        };
      } else if (coords.get(0).x) {
        this.getDim = function (coord, iD) {
          if (iD == 0) {
            return coord.x;
          } else if (iD == 1) {
            return coord.y;
          } else {
            return coord.z;
          }
        };
      }

      // fill position and barycoord buffers
      let F = faces.size();
      let positions = new Float32Array(F * 3 * 3);
      let barycoords = new Float32Array(F * 3 * 3);
      for (let iF = 0; iF < F; iF++) {
        let face = faces.get(iF);
        for (let iV = 0; iV < 3; iV++) {
          let coord = coords.get(this.getCorner(face, iV));
          for (let iD = 0; iD < 3; ++iD) {
            positions[3 * 3 * iF + 3 * iV + iD] = this.getDim(coord, iD);
            barycoords[3 * 3 * iF + 3 * iV + iD] = iD == iV ? 1 : 0;
          }
        }
      }

      threeGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      threeGeometry.setAttribute("barycoord", new THREE.BufferAttribute(barycoords, 3));
      threeGeometry.computeVertexNormals();

      // create matcap material
      let matcapMaterial = createMatCapMaterial(
        this.ps.matcapTextures.r,
        this.ps.matcapTextures.g,
        this.ps.matcapTextures.b,
        this.ps.matcapTextures.k
      );

      // create mesh
      let threeMesh = new THREE.Mesh(threeGeometry, matcapMaterial);
      return [threeMesh, threeGeometry];
    }

    pickElement(localInd) {
      if (localInd < this.facePickIndStart) {
        this.ps.setDataHeader(`Surface Mesh ${this.name} Vertex ${localInd}`);

        this.ps.clearDataFields();
        this.ps.showDataField(
          "position",
          this.ps.prettyVector(this.coords.get(localInd))
        );

        for (let qName in this.quantities) {
          let qVal = this.quantities[qName].getVertexValue(localInd);
          if (qVal) {
            this.ps.showDataField(qName, qVal);
          }
        }
      } else if (localInd < this.edgePickIndStart) {
        this.ps.setDataHeader(
          `Surface Mesh ${this.name} Face ${localInd - this.facePickIndStart}`
        );
        this.ps.clearDataFields();
      } else {
        this.ps.setDataHeader(
          `Surface Mesh ${this.name} Edge ${localInd - this.edgePickIndStart}`
        );
        this.ps.clearDataFields();
      }
    }

    // TODO: support polygon meshes
    // must be called after constructThreeMesh
    constructThreePickMesh(coords, faces) {
      let pickGeo = new THREE.BufferGeometry();

      let minmax = (a, b) => [Math.min(a, b), Math.max(a, b)];

      let F = faces.size();
      // count the number of vertices. Assuming they are densely indexed, this is just the max index + 1 that appears in faces
      // also index mesh edges
      let V = 0;
      this.edges = [];
      let edgeIndex = {};
      for (let iF = 0; iF < F; iF++) {
        let face = faces.get(iF);
        for (let iV = 0; iV < 3; ++iV) {
          V = Math.max(V, this.getCorner(face, iV) + 1);
          let edgeHash = minmax(
            this.getCorner(face, iV),
            this.getCorner(face, (iV + 1) % 3)
          );
          if (!(edgeHash in edgeIndex)) {
            edgeIndex[edgeHash] = this.edges.length;
            this.edges.push(edgeHash);
          }
        }
      }

      let E = (3 * F) / 2; // In a triangle mesh, 2x the number of edges must equal 3x the number of faces
      let totalPickElements = V + E + F;

      // In "local" indices, indexing elements only within this triMesh, used for reading later
      this.facePickIndStart = V;
      this.edgePickIndStart = this.facePickIndStart + F;

      // In "global" indices, indexing all elements in the scene, used to fill buffers for drawing here
      let pickStart = requestPickBufferRange(this, totalPickElements);
      let faceGlobalPickIndStart = pickStart + V;
      let edgeGlobalPickIndStart = faceGlobalPickIndStart + F;

      // 3 dimensions x 3 vertex values x 3 vertices to interpolate across per triangle
      let vertexColors0 = new Float32Array(3 * 3 * F);
      let vertexColors1 = new Float32Array(3 * 3 * F);
      let vertexColors2 = new Float32Array(3 * 3 * F);
      let edgeColors0 = new Float32Array(3 * 3 * F);
      let edgeColors1 = new Float32Array(3 * 3 * F);
      let edgeColors2 = new Float32Array(3 * 3 * F);

      // 3 dimensions x 3 vertices per triangle
      let faceColors = new Float32Array(3 * 3 * F);

      // Build all quantities in each face
      for (let iF = 0; iF < F; iF++) {
        let face = faces.get(iF);
        let fColor = pickIndToVector(iF + faceGlobalPickIndStart);

        let vColors = [0, 1, 2].map((i) =>
          pickIndToVector(pickStart + this.getCorner(face, i))
        );
        let eColors = [1, 2, 0].map((i) => {
          let edgeHash = minmax(
            this.getCorner(face, i),
            this.getCorner(face, (i + 1) % 3)
          );
          return pickIndToVector(edgeGlobalPickIndStart + edgeIndex[edgeHash]);
        });

        for (let iV = 0; iV < 3; iV++) {
          this.getCorner(face, iV);

          for (let iD = 0; iD < 3; ++iD) {
            faceColors[3 * 3 * iF + 3 * iV + iD] = fColor[iD];

            vertexColors0[3 * 3 * iF + 3 * iV + iD] = vColors[0][iD];
            vertexColors1[3 * 3 * iF + 3 * iV + iD] = vColors[1][iD];
            vertexColors2[3 * 3 * iF + 3 * iV + iD] = vColors[2][iD];
            edgeColors0[3 * 3 * iF + 3 * iV + iD] = eColors[2][iD];
            edgeColors1[3 * 3 * iF + 3 * iV + iD] = eColors[0][iD];
            edgeColors2[3 * 3 * iF + 3 * iV + iD] = eColors[1][iD];
          }
        }
      }

      // Positions and barycoords are copied from this.mesh.geometry
      // This ensures that moving the vertex positions of the mesh also moves the pick mesh's vertices
      pickGeo.setAttribute("position", this.mesh.geometry.attributes.position);
      pickGeo.setAttribute("barycoord", this.mesh.geometry.attributes.barycoord);

      pickGeo.setAttribute(
        "vertex_color0",
        new THREE.BufferAttribute(vertexColors0, 3)
      );
      pickGeo.setAttribute(
        "vertex_color1",
        new THREE.BufferAttribute(vertexColors1, 3)
      );
      pickGeo.setAttribute(
        "vertex_color2",
        new THREE.BufferAttribute(vertexColors2, 3)
      );
      pickGeo.setAttribute("edge_color0", new THREE.BufferAttribute(edgeColors0, 3));
      pickGeo.setAttribute("edge_color1", new THREE.BufferAttribute(edgeColors1, 3));
      pickGeo.setAttribute("edge_color2", new THREE.BufferAttribute(edgeColors2, 3));
      pickGeo.setAttribute("face_color", new THREE.BufferAttribute(faceColors, 3));

      // create matcap material
      let pickMaterial = createSurfaceMeshPickMaterial();

      // create mesh
      return new THREE.Mesh(pickGeo, pickMaterial);
    }

    updatePositions() {}
  }

  class PointCloud {
    constructor(coords, name, polyscopeEnvironment) {
      this.ps = polyscopeEnvironment;
      this.nV = coords.size();
      this.coords = coords;
      this.name = name;
      this.enabled = true;

      // build three.js mesh
      this.mesh = this.constructThreeMesh(coords);

      this.pickMesh = this.constructThreePickMesh(coords);

      this.quantities = {};

      this.guiFields = undefined;
      this.guiFolder = undefined;
    }

    addScalarQuantity(name, values) {
      this.quantities[name] = new PointCloudScalarQuantity(name, values, this);
      let quantityGui = this.guiFolder.addFolder(name);
      this.quantities[name].initGui(this.guiFields, quantityGui);
    }

    initGui(guiFields, guiFolder) {
      this.guiFields = guiFields;
      this.guiFolder = guiFolder;

      guiFields[this.name + "#Enabled"] = true;
      guiFolder
        .add(guiFields, this.name + "#Enabled")
        .onChange((e) => {
          this.setEnabled(e);
        })
        .listen()
        .name("Enabled");

      guiFields[this.name + "#Color"] = getNextUniqueColor();
      this.setColor(guiFields[this.name + "#Color"]);
      guiFolder
        .addColor(guiFields, this.name + "#Color")
        .onChange((c) => {
          this.setColor(c);
        })
        .listen()
        .name("Color");

      guiFields[this.name + "#Radius"] = 1;
      this.setRadius(guiFields[this.name + "#Radius"]);
      guiFolder
        .add(guiFields, this.name + "#Radius")
        .min(0)
        .max(5)
        .step(0.05)
        .onChange((c) => {
          this.setRadius(c);
        })
        .listen()
        .name("Radius");

      guiFolder.open();
    }

    setColor(color) {
      let c = new THREE.Vector3(color[0] / 255, color[1] / 255, color[2] / 255);
      this.mesh.material.uniforms.color.value = c;
    }

    setRadius(rad) {
      this.mesh.material.uniforms.scale.value = rad;
      this.pickMesh.material.uniforms.scale.value = rad;
    }

    setEnabled(enabled) {
      this.guiFields[this.name + "#Enabled"] = enabled;
      this.enabled = enabled;
      if (enabled) {
        let enabledQuantity = false;
        for (let q in this.quantities) {
          if (this.quantities[q].enabled) {
            this.ps.scene.add(this.quantities[q].mesh);
            enabledQuantity = true;
          }
        }
        if (!enabledQuantity) {
          this.ps.scene.add(this.mesh);
        }
        this.ps.pickScene.add(this.pickMesh);
      } else {
        for (let q in this.quantities) {
          this.ps.scene.remove(this.quantities[q].mesh);
        }
        this.ps.scene.remove(this.mesh);
        this.ps.pickScene.remove(this.pickMesh);
      }
    }

    enableQuantity(q) {
      if (q.isDominantQuantity) {
        for (let pName in this.quantities) {
          let p = this.quantities[pName];
          if (p.isDominantQuantity && pName != q.name) {
            this.guiFields[p.prefix + "#Enabled"] = false;
            p.enabled = false;
            this.ps.scene.remove(p.mesh);
          }
        }
      }

      if (this.enabled) {
        if (q.isDominantQuantity) {
          this.ps.scene.remove(this.mesh);
        }
        this.ps.scene.add(q.mesh);
      }
    }

    disableQuantity(q) {
      if (this.enabled) {
        this.ps.scene.remove(q.mesh);
        this.ps.scene.add(this.mesh);
      }
    }

    remove() {
      for (let q in this.quantities) {
        this.ps.scene.remove(this.quantities[q].mesh);
        this.quantities[q].remove();
      }
      this.quantities = {};
    }

    constructThreeMesh(coords) {
      let sphereGeometry = new THREE.IcosahedronGeometry(0.025, 2);

      // create matcap material
      let matcapMaterial = createInstancedMatCapMaterial(
        this.ps.matcapTextures.r,
        this.ps.matcapTextures.g,
        this.ps.matcapTextures.b,
        this.ps.matcapTextures.k
      );

      // create mesh
      let threeMesh = new THREE.InstancedMesh(sphereGeometry, matcapMaterial, this.nV);

      // set instance positions
      let mat = new THREE.Matrix4();
      new Float32Array(3 * this.nV);
      for (let iV = 0; iV < this.nV; iV++) {
        let pos = coords.get(iV);
        mat.setPosition(pos[0], pos[1], pos[2]);
        threeMesh.setMatrixAt(iV, mat);
      }

      return threeMesh;
    }

    pickElement(localInd) {
      this.ps.setDataHeader(`Point Cloud ${this.name} Vertex ${localInd}`);

      this.ps.clearDataFields();
      this.ps.showDataField(
        "position",
        this.ps.prettyVector(this.coords.get(localInd))
      );

      for (let qName in this.quantities) {
        let qVal = this.quantities[qName].getVertexValue(localInd);
        if (qVal) {
          this.ps.showDataField(qName, qVal);
        }
      }
    }

    // must be called after constructThreeMesh
    constructThreePickMesh(coords) {
      let totalPickElements = this.nV;

      // 3 dimensions
      let colors = new Float32Array(3 * this.nV);

      // In "global" indices, indexing all elements in the scene, used to fill buffers for drawing here
      let pickStart = requestPickBufferRange(this, totalPickElements);

      // compute colors in each face
      for (let iV = 0; iV < this.nV; iV++) {
        let vColor = pickIndToVector(iV + pickStart);
        for (let iD = 0; iD < 3; ++iD) {
          colors[3 * iV + +iD] = vColor[iD];
        }
      }

      // create matcap material
      let pickMaterial = createPointCloudPickMaterial();
      let pickMesh = new THREE.InstancedMesh(
        this.mesh.geometry.clone(),
        pickMaterial,
        this.nV
      );
      pickMesh.geometry.setAttribute(
        "color",
        new THREE.InstancedBufferAttribute(colors, 3)
      );

      // Positions are copied from this.mesh.geometry
      // This ensures that moving the vertex positions of the mesh also moves the pick mesh's vertices
      pickMesh.geometry.attributes.position = this.mesh.geometry.attributes.position;
      pickMesh.material.uniforms.scale = this.mesh.material.uniforms.scale;
      pickMesh.instanceMatrix = this.mesh.instanceMatrix;

      return pickMesh;
    }

    updatePositions() {}
  }

  class CurveNetwork {
    constructor(vertices, segments, maxLen, name, polyscopeEnvironment) {
      this.ps = polyscopeEnvironment;
      this.res = 12;

      [
        this.mesh,
        this.tubeMesh,
        this.pointMesh,
      ] = this.constructThreeCurveNetwork(vertices, segments, maxLen);

      this.segments = segments;
      this.maxLen = maxLen;
      this.name = name;
      this.quantities = {};

      this.guiFields = undefined;
      this.guiFolder = undefined;
    }

    setEnabled(enabled) {
      this.guiFields[this.name + "#Enabled"] = enabled;
      if (enabled) {
        this.ps.scene.add(this.mesh);
      } else {
        this.ps.scene.remove(this.mesh);
      }
    }

    remove() {
      for (let q in this.quantities) {
        this.ps.scene.remove(this.quantities[q].mesh);
        this.quantities[q].remove();
      }
      this.quantities = {};
    }

    updateVertexPositions(newPositions) {
      const lengths = this.tubeMesh.geometry.attributes.len.array;
      let mat = new THREE.Matrix4();
      for (let iS = 0; iS < this.segments.length; iS++) {
        let start = this.ps.listToVec(newPositions[this.segments[iS][0]]);
        let end = this.ps.listToVec(newPositions[this.segments[iS][1]]);
        let offset = new THREE.Vector3();
        offset.subVectors(start, end); // offset = start - end

        lengths[iS] = offset.length();
        mat.lookAt(new THREE.Vector3(0, 0, 0), offset, new THREE.Vector3(0, 0, 1));
        mat.setPosition(start.x, start.y, start.z);
        this.tubeMesh.setMatrixAt(iS, mat);
        this.pointMesh.setMatrixAt(this.segments[iS][0], mat);
        this.pointMesh.setMatrixAt(this.segments[iS][1], mat);
      }
      this.tubeMesh.geometry.attributes.len.needsUpdate = true;
      this.tubeMesh.instanceMatrix.needsUpdate = true;
      this.pointMesh.instanceMatrix.needsUpdate = true;
    }

    setColor(color) {
      let c = new THREE.Vector3(color[0] / 255, color[1] / 255, color[2] / 255);
      this.tubeMesh.material.uniforms.color.value = c;
      this.pointMesh.material.uniforms.color.value = c;
    }

    setEdgeWidth(width) {
      this.tubeMesh.material.uniforms.rad.value = width / 100;
      this.pointMesh.material.uniforms.scale.value = width / 100;
    }

    initGui(guiFields, guiFolder) {
      this.guiFields = guiFields;
      this.guiFolder = guiFolder;

      guiFields[this.name + "#Enabled"] = true;
      guiFolder
        .add(guiFields, this.name + "#Enabled")
        .onChange((e) => {
          this.setEnabled(e);
        })
        .listen()
        .name("Enabled");

      guiFields[this.name + "#Color"] = getNextUniqueColor();
      this.setColor(guiFields[this.name + "#Color"]);
      guiFolder
        .addColor(guiFields, this.name + "#Color")
        .onChange((c) => {
          this.setColor(c);
        })
        .listen()
        .name("Color");

      guiFields[this.name + "#Width"] = 1;
      this.setEdgeWidth(guiFields[this.name + "#Width"]);
      guiFolder
        .add(guiFields, this.name + "#Width")
        .min(0)
        .max(50)
        .step(0.25)
        .onChange((width) => {
          this.setEdgeWidth(width);
        })
        .listen()
        .name("Edge Width");

      guiFolder.open();
    }

    constructThreeCurveNetwork(vertices, segments, maxLen) {
      // create geometry object
      let tubeGeometry = new THREE.CylinderGeometry(1, 1, 1, this.res);
      let sphereGeometry = new THREE.SphereGeometry(1, this.res, this.res);

      // By default, the cylinder is vertically centered. But I want it to go upwards
      // from the origin, so I translate all of its vertices up by height/2
      let positions = tubeGeometry.attributes.position.array;
      let V = tubeGeometry.attributes.position.count;
      let minY = -0.5;
      for (let i = 0; i < V; i++) {
        positions[3 * i + 1] = positions[3 * i + 1] - minY;
      }

      // Rotate tube so that look-at points the tube in the given direction
      let mat = new THREE.Matrix4();
      // prettier-ignore
      mat.set(0, 0, 1, 0,
              1, 0, 0, 0,
              0, 1, 0, 0,
              0, 0, 0, 1);
      tubeGeometry.applyMatrix4(mat);
      sphereGeometry.applyMatrix4(mat);

      // create matcap materials
      let tubeMaterial = createCurveMatCapMaterial(
        this.ps.matcapTextures.r,
        this.ps.matcapTextures.g,
        this.ps.matcapTextures.b,
        this.ps.matcapTextures.k
      );
      tubeMaterial.uniforms.rad.value = 0.05;
      let sphereMaterial = createInstancedMatCapMaterial(
        this.ps.matcapTextures.r,
        this.ps.matcapTextures.g,
        this.ps.matcapTextures.b,
        this.ps.matcapTextures.k
      );
      sphereMaterial.uniforms.scale.value = 0.05;

      let tubeMesh = new THREE.InstancedMesh(
        tubeGeometry,
        tubeMaterial,
        segments.length
      );
      let pointMesh = new THREE.InstancedMesh(
        sphereGeometry,
        sphereMaterial,
        vertices.length
      );

      let lengths = new Float32Array(segments.length);
      mat = new THREE.Matrix4();
      for (let iS = 0; iS < segments.length; iS++) {
        let start = this.ps.listToVec(vertices[segments[iS][0]]);
        let end = this.ps.listToVec(vertices[segments[iS][1]]);
        let offset = new THREE.Vector3();
        offset.subVectors(start, end); // offset = start - end

        lengths[iS] = offset.length();
        mat.lookAt(new THREE.Vector3(0, 0, 0), offset, new THREE.Vector3(0, 0, 1));
        mat.setPosition(start.x, start.y, start.z);
        tubeMesh.setMatrixAt(iS, mat);
        pointMesh.setMatrixAt(segments[iS][0], mat);
        pointMesh.setMatrixAt(segments[iS][1], mat);
      }
      tubeMesh.geometry.setAttribute(
        "len",
        new THREE.InstancedBufferAttribute(lengths, 1)
      );

      let curve = new THREE.Group();
      curve.add(tubeMesh);
      curve.add(pointMesh);
      console.log(tubeMesh);

      return [curve, tubeMesh, pointMesh];
    }
  }

  // https://stackoverflow.com/a/34452130
  dat.GUI.prototype.removeFolder = function (name) {
    var folder = this.__folders[name];
    if (!folder) {
      return;
    }
    folder.close();
    this.__ul.removeChild(folder.domElement.parentNode);
    delete this.__folders[name];
    this.onResize();
  };

  class Geoptic {
    constructor(path = "js/geoptic.js") {
      if (!WebGL_js.WEBGL.isWebGLAvailable()) alert(WebGL_js.WEBGL.getWebGLErrorMessage());

      this.geopticPath = path;

      this.input = undefined;

      this.renderer = undefined;
      this.scene = undefined;
      this.camera = undefined;
      this.controls = undefined;
      this.shiftClick = false;
      this.matcapTextures = undefined;

      this.pickRenderer = undefined;
      this.pickScene = undefined;

      this.surfaceMeshes = {};
      this.curveNetworks = {};
      this.pointClouds = {};

      this.mesh = undefined;
      this.geo = undefined;

      this.structureGui = undefined;
      this.structureGuiFields = {};
      this.structureGuiMeshes = undefined;
      this.structureGuiCurveNetworks = undefined;
      this.structureGuiPointClouds = undefined;

      this.commandGui = new dat.GUI({ resizeable: true });
      this.commandGuiFields = {};

      this.groundPlane = undefined;

      this.onMeshLoad = (text) => {};
      this.userCallback = () => {};

      this.sceneMin = new THREE.Vector3(0, 0, 0);
      this.sceneMax = new THREE.Vector3(0, 0, 0);
    }

    // must be called after onload
    initInput() {
      let inputContainer = document.createElement("div");
      this.input = document.createElement("input");
      inputContainer.appendChild(this.input);
      document.body.appendChild(inputContainer);
      this.input.id = "fileInput";
      this.input.style.display = "none";
      this.input.type = "file";
    }

    // Must call after window is loaded
    init() {
      this.initInput();

      this.input.addEventListener(
        "change",
        function (e) {
          // show spinner
          document.getElementById("spinner").style.display = "inline-block";

          let file = this.input.files[0];
          let filename = file.name;

          if (filename.endsWith(".obj")) {
            let reader = new FileReader();
            reader.onload = function (e) {
              this.onMeshLoad(reader.result);
              document.getElementById("spinner").style.display = "none";
            }.bind(this);

            reader.onerror = function (e) {
              alert("Unable to load OBJ file");
              document.getElementById("spinner").style.display = "none";
            };

            reader.readAsText(file);
          } else {
            alert("Please load an OBJ file");
            document.getElementById("spinner").style.display = "none";
          }
        }.bind(this)
      );

      this.container = document.createElement("div");
      this.container.classList.add("container");
      document.body.appendChild(this.container);

      this.stats = new Stats__default['default']();
      this.container.append(this.stats.dom);

      this.initRenderer(this.container);
      this.initMatcap();
      this.initGUI();
      this.initCamera();
      this.initScene();
      this.initLights();
      this.initControls();
      this.initGroundPlane();
      this.addEventListeners();
    }

    initGroundPlane() {
      let tex = new THREE.TextureLoader().load(
        this.geopticPath + "/img/concrete.png"
      );
      this.groundPlane = new Reflector_js.Reflector(new THREE.PlaneGeometry(100, 100), {
        clipBias: 0.003,
        textureWidth: window.innerWidth * window.devicePixelRatio,
        textureHeight: window.innerHeight * window.devicePixelRatio,
        color: 0x777777,
      });
      this.groundPlane.material.vertexShader = groundPlaneVertexShader;
      this.groundPlane.material.fragmentShader = groundPlaneFragmentShader;
      this.groundPlane.material.uniforms.tex = { value: tex };
      this.groundPlane.material.uniforms.alpha = { value: 0.5 };
      this.groundPlane.geometry.setAttribute(
        "texture_uv",
        new THREE.BufferAttribute(Float32Array.from([0, 0, 0, 1, 1, 0, 1, 1]), 2)
      );
      this.groundPlane.rotateX(-Math.PI / 2);
      this.scene.add(this.groundPlane);
    }

    loadMesh(callback) {
      this.onMeshLoad = callback;
      this.input.click();
    }

    initMatcap() {
      this.matcapTextures = {
        r: undefined,
        g: undefined,
        b: undefined,
        k: undefined,
      };
      this.matcapTextures.r = new THREE.TextureLoader().load(
        this.geopticPath + "/img/clay_r.png"
      );
      this.matcapTextures.g = new THREE.TextureLoader().load(
        this.geopticPath + "/img/clay_g.png"
      );
      this.matcapTextures.b = new THREE.TextureLoader().load(
        this.geopticPath + "/img/clay_b.png"
      );
      this.matcapTextures.k = new THREE.TextureLoader().load(
        this.geopticPath + "/img/clay_k.png"
      );
    }

    initRenderer(container) {
      this.renderer = new THREE.WebGLRenderer({
        antialias: true,
      });
      this.renderer.setPixelRatio(window.devicePixelRatio);
      this.renderer.setClearColor(0xffffff, 1.0);
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.container.appendChild(this.renderer.domElement);

      this.pickRenderer = new THREE.WebGLRenderer({
        antialias: false, // turn antialiasing off for color based picking
      });
      this.pickRenderer.setPixelRatio(window.devicePixelRatio);
      this.pickRenderer.setClearColor(0xffffff, 1.0);
      this.pickRenderer.setSize(window.innerWidth, window.innerHeight);
      // TODO: do I need to do this?
      container.appendChild(this.pickRenderer.domElement);
    }

    initGUI() {
      this.structureGui = new dat.GUI({ autoPlace: false });

      let structureGuiWrapper = document.createElement("div");
      document.body.appendChild(structureGuiWrapper);
      structureGuiWrapper.id = "structure-gui";
      structureGuiWrapper.appendChild(this.structureGui.domElement);

      this.geopticOptions = this.structureGui.addFolder("Geoptic");
      this.geopticOptions.open();
      this.structureGuiFields["GroundPlane#Enabled"] = true;
      this.geopticOptions
        .add(this.structureGuiFields, "GroundPlane#Enabled")
        .onChange((e) => {
          if (e) {
            this.scene.add(this.groundPlane);
          } else {
            this.scene.remove(this.groundPlane);
          }
        })
        .listen()
        .name("Ground Plane");
    }

    initCamera() {
      const fov = 45.0;
      const aspect = window.innerWidth / window.innerHeight;
      const near = 0.01;
      const far = 1000;
      const eyeZ = 3.5;

      this.camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
      this.camera.position.z = eyeZ;
    }

    initScene() {
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0xffffff);

      this.pickScene = new THREE.Scene();
      this.pickScene.background = new THREE.Color(0xffffff);
    }

    initLights() {
      let ambient = new THREE.AmbientLight(0xffffff, 0.35);
      this.camera.add(ambient);

      let point = new THREE.PointLight(0xffffff);
      point.position.set(2, 20, 15);
      this.camera.add(point);

      this.scene.add(this.camera);
    }

    standardizeDataArray(arr) {
      if (!arr.size && arr.length) {
        arr.size = function () {
          return arr.length;
        };
      }
      if (!arr.get && arr[0]) {
        arr.get = function (i) {
          return arr[i];
        };
      }
    }

    registerSurfaceMesh(name, vertexCoordinates, faces, scale = 1) {
      this.standardizeDataArray(vertexCoordinates);
      this.standardizeDataArray(faces);

      if (!this.structureGuiMeshes) {
        this.structureGuiMeshes = this.structureGui.addFolder("Surface Meshes");
        this.structureGuiMeshes.open();
      }

      let meshStructure = new SurfaceMesh(vertexCoordinates, faces, name, this);
      this.surfaceMeshes[name] = meshStructure;

      let meshGui = this.structureGuiMeshes.addFolder(name);

      meshStructure.initGui(this.structureGuiFields, meshGui);

      this.scene.add(meshStructure.mesh);
      this.pickScene.add(meshStructure.pickMesh);

      let bbox = new THREE.Box3().setFromObject(meshStructure.mesh);

      this.sceneMin.min(bbox.min);
      this.sceneMax.max(bbox.max);

      let oldPos = this.groundPlane.position;
      this.groundPlane.translateZ(this.sceneMin.y - oldPos.y, 1);

      return meshStructure;
    }

    registerCurveNetwork(name, vertexCoordinates, edges) {
      this.standardizeDataArray(vertexCoordinates);
      if (!this.structureGuiCurveNetworks) {
        this.structureGuiCurveNetworks = this.structureGui.addFolder(
          "Curve Networks"
        );
        this.structureGuiCurveNetworks.open();
      }

      if (!edges) {
        edges = [];
        for (let iV = 0; iV + 1 < vertexCoordinates.length; iV++) {
          edges.push([iV, iV + 1]);
        }
      }

      // TODO: allocate extra space?
      let maxLen = vertexCoordinates.length;

      let curveStructure = new CurveNetwork(
        vertexCoordinates,
        edges,
        maxLen,
        name,
        this
      );
      this.curveNetworks[name] = curveStructure;

      let curveGui = this.structureGuiCurveNetworks.addFolder(name);
      curveStructure.initGui(this.structureGuiFields, curveGui);

      this.scene.add(curveStructure.mesh);

      return curveStructure;
    }

    registerPointCloud(name, vertexCoordinates) {
      this.standardizeDataArray(vertexCoordinates);
      if (!this.structureGuiPointCluods) {
        this.structureGuiPointClouds = this.structureGui.addFolder(
          "Point Clouds"
        );
        this.structureGuiPointClouds.open();
      }

      let cloudStructure = new PointCloud(vertexCoordinates, name, this);
      this.pointClouds[name] = cloudStructure;

      let cloudGui = this.structureGuiPointClouds.addFolder(name);
      cloudStructure.initGui(this.structureGuiFields, cloudGui);

      this.scene.add(cloudStructure.mesh);
      this.pickScene.add(cloudStructure.pickMesh);

      return cloudStructure;
    }

    deregisterSurfaceMesh(name) {
      if (!(name in this.surfaceMeshes)) return;

      this.structureGuiMeshes.removeFolder(name);
      this.surfaceMeshes[name].remove();
      this.scene.remove(this.surfaceMeshes[name].mesh);
      delete this.surfaceMeshes[name];
    }

    deregisterCurveNetwork(name) {
      if (!(name in this.curveNetworks)) return;

      this.structureGuiCurveNetworks.removeFolder(name);
      this.curveNetworks[name].remove();
      this.scene.remove(this.curveNetworks[name].mesh);
      delete this.curveNetworks[name];
    }

    clearAllStructures() {
      let names = Object.keys(this.surfaceMeshes);
      names.forEach((name) => {
        this.deregisterSurfaceMesh(name);
      });
      names = Object.keys(this.curveNetworks);
      names.forEach((name) => {
        this.deregisterCurveNetwork(name);
      });
    }

    initControls() {
      this.controls = new TrackballControls_js.TrackballControls(
        this.camera,
        this.renderer.domElement
      );
      this.controls.rotateSpeed = 5.0;
    }

    clearDataFields() {
      document.getElementById("info-body-field-names").innerHTML = "";
      document.getElementById("info-body-field-values").innerHTML = "";
    }

    showDataField(name, value) {
      let infoName = document.createElement("div");
      infoName.innerHTML = name;
      document.getElementById("info-body-field-names").appendChild(infoName);
      let infoValue = document.createElement("div");
      infoValue.innerHTML = value;
      document.getElementById("info-body-field-values").appendChild(infoValue);
    }

    setDataHeader(name) {
      document.getElementById("info-head").innerHTML = name;
    }

    pick(clickX, clickY) {
      let pickResult = evaluatePickQuery(
        this.pickRenderer,
        this.pickScene,
        this.camera,
        clickX,
        clickY
      );
      if (pickResult.structure) {
        pickResult.structure.pickElement(pickResult.localInd);
      }
    }

    addEventListeners() {
      window.addEventListener("resize", this.onWindowResize.bind(this), false);

      // attacking the eventListener to the renderer instead of the window ensures
      // that clicking on the GUI doesn't trigger geoptic's mouseClick handler
      this.renderer.domElement.addEventListener(
        "click",
        this.onMouseClick.bind(this),
        false
      );
    }

    onWindowResize() {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();

      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.controls.handleResize();
      this.render();
    }

    onMouseClick(event) {
      if (
        event.clientX >= 0 &&
        event.clientX <= window.innerWidth &&
        event.clientY >= 0 &&
        event.clientY <= window.innerHeight
      ) {
        this.pick(event.clientX, event.clientY);
      }
    }

    animate() {
      requestAnimationFrame(
        function () {
          this.animate();
        }.bind(this)
      );
      this.userCallback();
      if (this.controls) this.controls.update();
      this.render();
      this.stats.update();
    }

    render() {
      // set viewport and render mesh
      let width = window.innerWidth;

      this.renderer.setViewport(0.0, 0.0, width, window.innerHeight);
      this.renderer.setScissor(0.0, 0.0, width, window.innerHeight);
      this.renderer.setScissorTest(true);
      this.renderer.render(this.scene, this.camera);
    }

    message(str) {
      let message = document.createElement("div");
      let messageBuffer = document.getElementById("messages");
      messageBuffer.insertBefore(message, messageBuffer.firstChild);
      message.innerHTML = str;
    }

    doneLoading() {
      document.getElementById("spinner").style.display = "none";
    }

    prettyScalar(d) {
      return d.toFixed(5);
    }

    prettyVector(vec) {
      if (vec[0]) {
        return (
          "(" +
          vec[0].toFixed(2) +
          ", " +
          vec[1].toFixed(2) +
          ", " +
          vec[2].toFixed(2) +
          ")"
        );
      } else if (vec.x) {
        return (
          "(" +
          vec.x.toFixed(2) +
          ", " +
          vec.y.toFixed(2) +
          ", " +
          vec.z.toFixed(2) +
          ")"
        );
      }
    }

    listToVec(list) {
      return new THREE.Vector3(list[0], list[1], list[2]);
    }
  }

  exports.Geoptic = Geoptic;

  Object.defineProperty(exports, '__esModule', { value: true });

})));
