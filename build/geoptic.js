(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('https://unpkg.com/three@0.125.1/build/three.module.js'), require('https://unpkg.com/three@0.125.1/examples/jsm/controls/TrackballControls.js'), require('https://unpkg.com/three@0.125.1/examples/jsm/WebGL.js'), require('https://unpkg.com/three@0.125.1/examples/jsm/objects/Reflector.js'), require('https://unpkg.com/three@0.125.1/examples/jsm/loaders/RGBELoader.js'), require('https://unpkg.com/three@0.125.1/examples/jsm/libs/stats.module.js'), require('https://unpkg.com/dat.gui@0.7.6/build/dat.gui.module.js')) :
  typeof define === 'function' && define.amd ? define(['exports', 'https://unpkg.com/three@0.125.1/build/three.module.js', 'https://unpkg.com/three@0.125.1/examples/jsm/controls/TrackballControls.js', 'https://unpkg.com/three@0.125.1/examples/jsm/WebGL.js', 'https://unpkg.com/three@0.125.1/examples/jsm/objects/Reflector.js', 'https://unpkg.com/three@0.125.1/examples/jsm/loaders/RGBELoader.js', 'https://unpkg.com/three@0.125.1/examples/jsm/libs/stats.module.js', 'https://unpkg.com/dat.gui@0.7.6/build/dat.gui.module.js'], factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.geoptic = {}, global.THREE, global.TrackballControls_js, global.WebGL_js, global.Reflector_js, null, global.Stats, global.dat_gui_module_js));
}(this, (function (exports, THREE, TrackballControls_js, WebGL_js, Reflector_js, RGBELoader_js, Stats, dat_gui_module_js) { 'use strict';

  function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

  var Stats__default = /*#__PURE__*/_interopDefaultLegacy(Stats);

  let matcapIncludes = `
        uniform sampler2D Matcap_r; // Matcap texture
        uniform sampler2D Matcap_g; // Matcap texture
        uniform sampler2D Matcap_b; // Matcap texture
        uniform sampler2D Matcap_k; // Matcap texture
`;

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

        vec4 lightSurfaceMat(vec3 color, vec2 Normal) {
            vec4 mat_r = sRGBToLinear(texture2D(Matcap_r, Normal));
            vec4 mat_g = sRGBToLinear(texture2D(Matcap_g, Normal));
            vec4 mat_b = sRGBToLinear(texture2D(Matcap_b, Normal));
            vec4 mat_k = sRGBToLinear(texture2D(Matcap_k, Normal));

            vec4 colorCombined = color.r * mat_r + color.g * mat_g + color.b * mat_b +
                                (1. - color.r - color.g - color.b) * mat_k;

            return LinearTosRGB( colorCombined );
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
        ${matcapIncludes}
        uniform vec3 color;
        uniform vec3 edgeColor;
        uniform float edgeWidth;

        varying vec2 Point;
        varying vec3 Barycoord;

        ${common}

        void main(void){
            float alpha = getEdgeFactor(Barycoord, vec3(1.,1.,1.), edgeWidth);
            gl_FragColor = lightSurfaceMat((1.-alpha) * color + alpha * edgeColor, Point);
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
    Material.side = THREE.DoubleSide;

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
        ${matcapIncludes}
        uniform vec3 edgeColor;
        uniform float edgeWidth;

        varying vec2 Point;
        varying vec3 Barycoord;
        varying vec3 Color;

        ${common}

        void main(void){

            float alpha = getEdgeFactor(Barycoord, vec3(1.,1.,1.), edgeWidth);
            gl_FragColor = lightSurfaceMat((1.-alpha) * Color + alpha * edgeColor, Point);
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
    Material.side = THREE.DoubleSide;

    return Material;
  }

  function createVertexDistanceFunctionMaterial(tex_r, tex_g, tex_b, tex_k) {
    let vertexShader = `
        attribute vec3 barycoord;
        attribute float value;

        varying vec2 Point;
        varying vec3 Barycoord;
        varying float Value;

        void main()
        {
            vec3 vNormal = ( mat3( modelViewMatrix ) * normal );
            vNormal = normalize(vNormal);

            // pull slightly inward, to reduce sampling artifacts near edges
            Point.x = 0.93 * vNormal.x * 0.5 + 0.5;
            Point.y = 0.93 * vNormal.y * 0.5 + 0.5;

            Barycoord = barycoord;
            Value = value;

            gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

        }
    `;

    let fragmentShader = `
        ${matcapIncludes}
        uniform sampler2D colormap; // Matcap texture
        uniform vec3 edgeColor;
        uniform float edgeWidth;
        uniform float scale;

        varying vec2 Point;
        varying vec3 Barycoord;
        varying float Value;

        ${common}

        void main(void){

            vec3 Color = sRGBToLinear(texture2D(colormap, vec2(mod(Value*scale,1.), 0.5))).rgb;

            float alpha = getEdgeFactor(Barycoord, vec3(1.,1.,1.), edgeWidth);
            gl_FragColor = lightSurfaceMat((1.-alpha) * Color + alpha * edgeColor, Point);
        }
    `;
    let Material = new THREE.ShaderMaterial({
      uniforms: {
        Matcap_r: { value: tex_r },
        Matcap_g: { value: tex_g },
        Matcap_b: { value: tex_b },
        Matcap_k: { value: tex_k },
        colormap: { value: undefined },
        edgeColor: { value: new THREE.Vector3(0, 0, 0) },
        edgeWidth: { value: 0 },
        scale: { value: 1 },
      },
      vertexShader,
      fragmentShader,
    });
    Material.side = THREE.DoubleSide;

    return Material;
  }

  function VertexParamCheckerboard(tex_r, tex_g, tex_b, tex_k) {
    let vertexShader = `
        attribute vec3 barycoord;
        attribute vec2 coord;

        varying vec2 Point;
        varying vec3 Barycoord;
        varying vec2 Coord;

        void main()
        {
            vec3 vNormal = ( mat3( modelViewMatrix ) * normal );
            vNormal = normalize(vNormal);

            // pull slightly inward, to reduce sampling artifacts near edges
            Point.x = 0.93 * vNormal.x * 0.5 + 0.5;
            Point.y = 0.93 * vNormal.y * 0.5 + 0.5;

            Barycoord = barycoord;
            Coord = coord;

            gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

        }
    `;

    let fragmentShader = `
        ${matcapIncludes}
        uniform vec3 edgeColor;
        uniform float edgeWidth;
        uniform vec3 color1;
        uniform vec3 color2;
        uniform float paramScale;

        varying vec2 Point;
        varying vec3 Barycoord;
        varying vec2 Coord;

        ${common}

        void main(void){
            float alpha = getEdgeFactor(Barycoord, vec3(1.,1.,1.), edgeWidth);

            // Apply the checkerboard effect
            float mX = mod(Coord.x, 2.0 * paramScale) / paramScale - 1.f; // in [-1, 1]
            float mY = mod(Coord.y, 2.0 * paramScale) / paramScale - 1.f;

            float minD = min( min(abs(mX), 1.0 - abs(mX)), min(abs(mY), 1.0 - abs(mY))) * 2.; // rect distace from flipping sign in [0,1]
            float p = 6.;
            float minDSmooth = pow(minD, 1. / p);
            // TODO do some clever screen space derivative thing to prevent aliasing

            float v = (mX * mY); // in [-1, 1], color switches at 0
            float adjV = sign(v) * minDSmooth;

            float s = smoothstep(-1.f, 1.f, adjV);

            vec3 outColor = (1.-s)*color1 + s* color2;

            gl_FragColor = lightSurfaceMat((1.-alpha) * outColor + alpha * edgeColor, Point);

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
        color1: { value: new THREE.Vector3(1, 1, 0) },
        color2: { value: new THREE.Vector3(0, 1, 1) },
        paramScale: { value: 1 },
      },
      vertexShader,
      fragmentShader,
    });
    Material.side = THREE.DoubleSide;

    return Material;
  }

  function VertexParamGrid(tex_r, tex_g, tex_b, tex_k) {
    let vertexShader = `
        attribute vec3 barycoord;
        attribute vec2 coord;

        varying vec2 Point;
        varying vec3 Barycoord;
        varying vec2 Coord;

        void main()
        {
            vec3 vNormal = ( mat3( modelViewMatrix ) * normal );
            vNormal = normalize(vNormal);

            // pull slightly inward, to reduce sampling artifacts near edges
            Point.x = 0.93 * vNormal.x * 0.5 + 0.5;
            Point.y = 0.93 * vNormal.y * 0.5 + 0.5;

            Barycoord = barycoord;
            Coord = coord;

            gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

        }
    `;

    let fragmentShader = `
        ${matcapIncludes}
        uniform vec3 edgeColor;
        uniform float edgeWidth;
        uniform vec3 color1;
        uniform vec3 color2;
        uniform float paramScale;

        varying vec2 Point;
        varying vec3 Barycoord;
        varying vec2 Coord;

        ${common}

        void main(void){
            float alpha = getEdgeFactor(Barycoord, vec3(1.,1.,1.), edgeWidth);


            // Apply the checkerboard effect
            float mX = mod(Coord.x, 2.0 * paramScale) / paramScale - 1.f; // in [-1, 1]
            float mY = mod(Coord.y, 2.0 * paramScale) / paramScale - 1.f;


            // rect distace from flipping sign in [0,1]
            float minD = min(min(abs(mX), 1.0 - abs(mX)), min(abs(mY), 1.0 - abs(mY))) * 2.;

            float width = 0.05;
            float slopeWidthPix = 10.;

            vec2 fw = fwidth(Coord);
            float scale = max(fw.x, fw.y);
            float pWidth = slopeWidthPix * scale;

            float s = smoothstep(width, width + pWidth, minD);

            vec3 outColor = (1.-s)*color1 + s* color2;

            gl_FragColor = lightSurfaceMat((1.-alpha) * outColor + alpha * edgeColor, Point);

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
        color1: { value: new THREE.Vector3(1, 1, 0) },
        color2: { value: new THREE.Vector3(0, 1, 1) },
        paramScale: { value: 1 },
      },
      vertexShader,
      fragmentShader,
    });
    Material.side = THREE.DoubleSide;

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

    Material.side = THREE.DoubleSide;
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
        ${matcapIncludes}
        uniform vec3 color;

        varying vec2 Point;

        ${common}

        void main(void){
            gl_FragColor = lightSurfaceMat(color, Point);
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

    Material.side = THREE.DoubleSide;
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
        ${matcapIncludes}

        varying vec3 Color;
        varying vec2 Point;

        ${common}

        void main(void){
            gl_FragColor = lightSurfaceMat(Color, Point);
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

    Material.side = THREE.DoubleSide;
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

        void main(void){
            gl_FragColor = vec4(Color, 1.);
        }
    `;

    let Material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
    });

    // Material.side = DoubleSide;
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
        ${matcapIncludes}
        uniform vec3 color;

        varying vec2 Point;

        ${common}

        void main(void){
            gl_FragColor = lightSurfaceMat(color, Point);
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

    Material.side = THREE.DoubleSide;
    return Material;
  }

  // The next pick index that a structure can use to identify its elements
  // (get it by calling request pickBufferRange())
  let nextPickBufferInd = 1; // 0 returned by dat.gui?

  let structureRanges = [];

  let pickRenderTarget = new THREE.WebGLRenderTarget();
  pickRenderTarget.texture.generateMipmaps = false;

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

  function evaluatePickQuery(
    pickRenderer,
    pickScene,
    camera,
    xPos,
    yPos,
    width,
    height
  ) {
    // draw
    pickRenderTarget.setSize(width, height);
    pickRenderer.setRenderTarget(pickRenderTarget);
    pickRenderer.render(pickScene, camera);

    // read color
    let pixelBuffer = new Uint8Array(4);
    pickRenderer.readRenderTargetPixels(
      pickRenderTarget,
      xPos,
      pickRenderTarget.height - yPos,
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
      coolwarm : ["#3b4cc0","#3c4ec2","#3d50c3","#3e51c5","#3f53c6","#4055c8","#4257c9","#4358cb","#445acc","#455cce","#465ecf","#485fd1","#4961d2","#4a63d3","#4b64d5","#4c66d6","#4e68d8","#4f69d9","#506bda","#516ddb","#536edd","#5470de","#5572df","#5673e0","#5875e1","#5977e3","#5a78e4","#5b7ae5","#5d7ce6","#5e7de7","#5f7fe8","#6180e9","#6282ea","#6384eb","#6485ec","#6687ed","#6788ee","#688aef","#6a8bef","#6c8ff1","#6e90f2","#6f92f3","#7093f3","#7295f4","#7396f5","#7597f6","#7699f6","#779af7","#799cf8","#7a9df8","#7b9ff9","#7da0f9","#7ea1fa","#80a3fa","#81a4fb","#82a6fb","#84a7fc","#85a8fc","#86a9fc","#88abfd","#89acfd","#8badfd","#8caffe","#8db0fe","#8fb1fe","#90b2fe","#92b4fe","#93b5fe","#94b6ff","#96b7ff","#97b8ff","#98b9ff","#9abbff","#9bbcff","#9dbdff","#9ebeff","#9fbfff","#a2c1ff","#a3c2fe","#a5c3fe","#a6c4fe","#a7c5fe","#a9c6fd","#aac7fd","#abc8fd","#adc9fd","#aec9fc","#afcafc","#b1cbfc","#b2ccfb","#b3cdfb","#b5cdfa","#b6cefa","#b7cff9","#b9d0f9","#bad0f8","#bbd1f8","#bcd2f7","#bed2f6","#bfd3f6","#c0d4f5","#c1d4f4","#c3d5f4","#c4d5f3","#c5d6f2","#c6d6f1","#c7d7f0","#c9d7f0","#cad8ef","#cbd8ee","#ccd9ed","#cdd9ec","#cedaeb","#cfdaea","#d1dae9","#d2dbe8","#d4dbe6","#d5dbe5","#d6dce4","#d7dce3","#d8dce2","#d9dce1","#dadce0","#dbdcde","#dcdddd","#dddcdc","#dedcdb","#dfdbd9","#e0dbd8","#e1dad6","#e2dad5","#e3d9d3","#e4d9d2","#e5d8d1","#e6d7cf","#e7d7ce","#e8d6cc","#e9d5cb","#ead5c9","#ead4c8","#ebd3c6","#ecd3c5","#edd2c3","#edd1c2","#eed0c0","#efcfbf","#efcebd","#f0cdbb","#f1cdba","#f1ccb8","#f2cbb7","#f2cab5","#f2c9b4","#f3c8b2","#f4c6af","#f4c5ad","#f5c4ac","#f5c2aa","#f5c1a9","#f5c0a7","#f6bfa6","#f6bea4","#f6bda2","#f7bca1","#f7ba9f","#f7b99e","#f7b89c","#f7b79b","#f7b599","#f7b497","#f7b396","#f7b194","#f7b093","#f7af91","#f7ad90","#f7ac8e","#f7aa8c","#f7a98b","#f7a889","#f7a688","#f6a586","#f6a385","#f6a283","#f5a081","#f59f80","#f59d7e","#f59c7d","#f49a7b","#f4987a","#f39778","#f39577","#f39475","#f29072","#f18f71","#f18d6f","#f08b6e","#f08a6c","#ef886b","#ee8669","#ee8468","#ed8366","#ec8165","#ec7f63","#eb7d62","#ea7b60","#e97a5f","#e9785d","#e8765c","#e7745b","#e67259","#e57058","#e46e56","#e36c55","#e36b54","#e26952","#e16751","#e0654f","#df634e","#de614d","#dd5f4b","#dc5d4a","#da5a49","#d95847","#d85646","#d75445","#d65244","#d55042","#d44e41","#d24b40","#d1493f","#d0473d","#cd423b","#cc403a","#cb3e38","#ca3b37","#c83836","#c73635","#c53334","#c43032","#c32e31","#c12b30","#c0282f","#be242e","#bd1f2d","#bb1b2c","#ba162b","#b8122a","#b70d28","#b50927","#b40426"],
      blues : ["#f7fbff","#f6faff","#f5fafe","#f5f9fe","#f4f9fe","#f3f8fe","#f2f8fd","#f2f7fd","#f1f7fd","#f0f6fd","#eff6fc","#eef5fc","#eef5fc","#edf4fc","#ecf4fb","#ebf3fb","#eaf3fb","#eaf2fb","#e9f2fa","#e8f1fa","#e7f1fa","#e7f0fa","#e6f0f9","#e5eff9","#e4eff9","#e3eef9","#e3eef8","#e2edf8","#e1edf8","#e0ecf8","#dfecf7","#dfebf7","#deebf7","#ddeaf7","#dceaf6","#dce9f6","#dbe9f6","#dae8f6","#d9e8f5","#d8e7f5","#d7e6f5","#d6e6f4","#d6e5f4","#d5e5f4","#d4e4f4","#d3e4f3","#d3e3f3","#d2e3f3","#d1e2f3","#d0e2f2","#d0e1f2","#cfe1f2","#cee0f2","#cde0f1","#cddff1","#ccdff1","#cbdef1","#cadef0","#caddf0","#c9ddf0","#c8dcf0","#c7dcef","#c7dbef","#c6dbef","#c4daee","#c3daee","#c2d9ee","#c1d9ed","#bfd8ed","#bed8ec","#bdd7ec","#bcd7eb","#bad6eb","#b9d6ea","#b8d5ea","#b7d4ea","#b5d4e9","#b3d3e8","#b2d2e8","#b0d2e7","#afd1e7","#aed1e7","#add0e6","#abd0e6","#aacfe5","#a9cfe5","#a8cee4","#a6cee4","#a5cde3","#a4cce3","#a3cce3","#a1cbe2","#a0cbe2","#9fcae1","#9dcae1","#9cc9e1","#9ac8e0","#99c7e0","#97c6df","#95c5df","#94c4df","#92c4de","#91c3de","#8fc2de","#8dc1dd","#8cc0dd","#8abfdd","#89bedc","#87bddc","#85bcdc","#84bcdb","#82bbdb","#81badb","#7fb9da","#7db8da","#7cb7da","#79b5d9","#77b5d9","#75b4d8","#74b3d8","#72b2d8","#71b1d7","#6fb0d7","#6dafd7","#6caed6","#6aaed6","#69add5","#68acd5","#66abd4","#65aad4","#64a9d3","#63a8d3","#61a7d2","#60a7d2","#5fa6d1","#5da5d1","#5ca4d0","#5ba3d0","#5aa2cf","#58a1cf","#57a0ce","#56a0ce","#549fcd","#539ecd","#529dcc","#519ccc","#4f9bcb","#4e9acb","#4d99ca","#4b98ca","#4a98c9","#4997c9","#4896c8","#4695c8","#4493c7","#4292c6","#4191c6","#4090c5","#3f8fc5","#3e8ec4","#3d8dc4","#3c8cc3","#3b8bc2","#3a8ac2","#3989c1","#3888c1","#3787c0","#3686c0","#3585bf","#3484bf","#3383be","#3282be","#3181bd","#3080bd","#2f7fbc","#2e7ebc","#2d7dbb","#2c7cba","#2b7bba","#2a7ab9","#2979b9","#2777b8","#2676b8","#2575b7","#2474b7","#2373b6","#2272b6","#2171b5","#2070b4","#206fb4","#1f6eb3","#1e6db2","#1c6bb0","#1c6ab0","#1b69af","#1a68ae","#1967ad","#1966ad","#1865ac","#1764ab","#1663aa","#1562a9","#1561a9","#1460a8","#135fa7","#125ea6","#125da6","#115ca5","#105ba4","#0f5aa3","#0e59a2","#0e58a2","#0d57a1","#0c56a0","#0b559f","#0a549e","#0a539e","#09529d","#08519c","#08509b","#084f99","#084e98","#084d96","#084c95","#084b93","#084a91","#084990","#08488e","#08478d","#08468b","#08458a","#084387","#084285","#084184","#084082","#083e81","#083d7f","#083c7d","#083b7c","#083a7a","#083979","#083877","#083776","#083674","#083573","#083471","#083370","#08326e","#08316d","#08306b"],
      piyg : ["#8e0152","#900254","#920355","#940457","#970559","#99065a","#9b075c","#9d085e","#9f095f","#a10a61","#a40b63","#a60c65","#a80d66","#aa0e68","#ac0f6a","#ae106b","#b1116d","#b3126f","#b51370","#b71472","#b91574","#bb1675","#bd1777","#c01879","#c2197a","#c41a7c","#c51d7e","#c62080","#c72482","#c82884","#c92b86","#ca2f88","#cb3289","#cc368b","#cd3a8d","#ce3d8f","#cf4191","#d04493","#d14895","#d34f99","#d4539b","#d5579d","#d65a9f","#d75ea1","#d861a2","#d965a4","#da69a6","#db6ca8","#dc70aa","#dd73ac","#de77ae","#df79b0","#df7cb1","#e07eb3","#e181b5","#e283b7","#e286b8","#e388ba","#e48bbc","#e58dbe","#e590bf","#e692c1","#e795c3","#e897c4","#e89ac6","#e99cc8","#ea9fca","#eba1cb","#eba3cd","#eca6cf","#eda8d1","#eeabd2","#eeadd4","#efb0d6","#f0b2d7","#f1b5d9","#f1b7da","#f2badc","#f3bcdd","#f3bdde","#f4bfdf","#f4c1df","#f5c2e0","#f5c4e1","#f5c6e2","#f6c7e3","#f6c9e3","#f7cbe4","#f7cce5","#f8cee6","#f8d0e7","#f9d1e8","#f9d3e8","#fad4e9","#fad6ea","#fbd8eb","#fbd9ec","#fcdbed","#fcdded","#fddeee","#fde0ef","#fde1ef","#fde2f0","#fce3f0","#fce4f0","#fce5f1","#fce5f1","#fbe6f1","#fbe7f2","#fbe8f2","#fbe9f2","#faeaf2","#faebf3","#faecf3","#faedf3","#f9eef4","#f9eff4","#f9f0f5","#f9f1f5","#f8f2f5","#f8f3f6","#f8f4f6","#f8f5f6","#f7f6f7","#f7f7f7","#f7f7f6","#f6f7f5","#f5f7f3","#f5f7f2","#f4f7f0","#f3f7ef","#f3f6ed","#f2f6ec","#f1f6ea","#f1f6e8","#f0f6e7","#eff6e5","#eff6e4","#eef6e2","#edf6e1","#edf6df","#ecf6de","#ebf6dc","#ebf6db","#eaf5d9","#e9f5d8","#e9f5d6","#e8f5d5","#e7f5d3","#e7f5d2","#e6f5d0","#e4f4cd","#e2f3ca","#e1f3c7","#ddf1c1","#dbf0bf","#d9f0bc","#d8efb9","#d6eeb6","#d4edb3","#d2ecb0","#d0ecad","#cfebaa","#cdeaa7","#cbe9a4","#c9e8a2","#c7e89f","#c6e79c","#c4e699","#c2e596","#c0e593","#bee490","#bde38d","#bbe28a","#b9e187","#b7e085","#b5df82","#b2dd7f","#b0dc7d","#aeda7a","#acd977","#a9d874","#a7d672","#a5d56f","#a3d36c","#a1d26a","#9ed067","#9ccf64","#9acd61","#98cc5f","#95cb5c","#93c959","#8fc654","#8cc551","#8ac34f","#88c24c","#86c049","#83bf46","#81bd44","#7fbc41","#7dba40","#7bb93e","#79b73d","#77b53c","#75b43b","#73b239","#71b038","#6faf37","#6dad36","#6bac34","#69aa33","#67a832","#66a731","#64a52f","#62a32e","#60a22d","#5ea02c","#5c9e2a","#5a9d29","#589b28","#569927","#549825","#529624","#509423","#4e9322","#4c9121","#4b8f21","#498d20","#488c20","#468a20","#45881f","#42841f","#40831e","#3f811e","#3d7f1e","#3c7d1d","#3a7b1d","#397a1d","#37781c","#36761c","#34741c","#33721c","#31711b","#306f1b","#2e6d1b","#2d6b1a","#2b691a","#2a681a","#286619","#276419"],
      spectral : ["#9e0142","#a00343","#a20643","#a40844","#a70b44","#a90d45","#ab0f45","#ad1246","#af1446","#b11747","#b41947","#b61b48","#b81e48","#ba2049","#bc2249","#be254a","#c1274a","#c32a4b","#c52c4b","#c72e4c","#c9314c","#cb334d","#cd364d","#d0384e","#d23a4e","#d43d4f","#d63f4f","#d7414e","#d8434e","#d9444d","#da464d","#dc484c","#dd4a4c","#de4c4b","#df4e4b","#e1504b","#e2514a","#e3534a","#e45549","#e75948","#e85b48","#e95c47","#ea5e47","#eb6046","#ed6246","#ee6445","#ef6645","#f06744","#f26944","#f36b43","#f46d43","#f47044","#f57245","#f57547","#f57748","#f67a49","#f67c4a","#f67f4b","#f7814c","#f7844e","#f8864f","#f88950","#f88c51","#f98e52","#f99153","#f99355","#fa9656","#fa9857","#fa9b58","#fb9d59","#fba05b","#fba35c","#fca55d","#fca85e","#fcaa5f","#fdad60","#fdaf62","#fdb365","#fdb567","#fdb768","#fdb96a","#fdbb6c","#fdbd6d","#fdbf6f","#fdc171","#fdc372","#fdc574","#fdc776","#fec877","#feca79","#fecc7b","#fece7c","#fed07e","#fed27f","#fed481","#fed683","#fed884","#feda86","#fedc88","#fede89","#fee08b","#fee18d","#fee28f","#fee491","#fee593","#fee695","#fee797","#fee999","#feea9b","#feeb9d","#feec9f","#feeda1","#feefa3","#fff0a6","#fff1a8","#fff2aa","#fff5ae","#fff6b0","#fff7b2","#fff8b4","#fffab6","#fffbb8","#fffcba","#fffdbc","#fffebe","#ffffbe","#fefebd","#fdfebb","#fcfeba","#fbfdb8","#fafdb7","#f9fcb5","#f8fcb4","#f7fcb2","#f6fbb0","#f5fbaf","#f4faad","#f3faac","#f2faaa","#f1f9a9","#f0f9a7","#eff9a6","#eef8a4","#edf8a3","#ecf7a1","#ebf7a0","#eaf79e","#e9f69d","#e8f69b","#e7f59a","#e6f598","#e4f498","#e1f399","#dff299","#daf09a","#d8ef9b","#d6ee9b","#d3ed9c","#d1ed9c","#cfec9d","#cdeb9d","#caea9e","#c8e99e","#c6e89f","#c3e79f","#c1e6a0","#bfe5a0","#bce4a0","#bae3a1","#b8e2a1","#b5e1a2","#b3e0a2","#b1dfa3","#aedea3","#acdda4","#aadca4","#a7dba4","#a4daa4","#a2d9a4","#9fd8a4","#9cd7a4","#99d6a4","#97d5a4","#94d4a4","#91d3a4","#8fd2a4","#8cd1a4","#89d0a4","#86cfa5","#84cea5","#81cda5","#7ecca5","#79c9a5","#76c8a5","#74c7a5","#71c6a5","#6ec5a5","#6bc4a5","#69c3a5","#66c2a5","#64c0a6","#62bda7","#60bba8","#5eb9a9","#5cb7aa","#5ab4ab","#58b2ac","#56b0ad","#54aead","#52abae","#50a9af","#4ea7b0","#4ba4b1","#49a2b2","#47a0b3","#459eb4","#439bb5","#4199b6","#3f97b7","#3d95b8","#3b92b9","#3990ba","#378ebb","#358bbc","#3389bd","#3387bc","#3585bb","#3682ba","#3880b9","#3a7eb8","#3b7cb7","#3f77b5","#4175b4","#4273b3","#4471b2","#466eb1","#486cb0","#496aaf","#4b68ae","#4d65ad","#4e63ac","#5061aa","#525fa9","#545ca8","#555aa7","#5758a6","#5956a5","#5b53a4","#5c51a3","#5e4fa2"],
      rainbow : ["#8000ff","#7e03ff","#7c06ff","#7a09ff","#780dff","#7610ff","#7413ff","#7216ff","#7019ff","#6e1cff","#6c1fff","#6a22fe","#6826fe","#6629fe","#642cfe","#622ffe","#6032fe","#5e35fe","#5c38fd","#5a3bfd","#583efd","#5641fd","#5444fd","#5247fc","#504afc","#4e4dfc","#4c50fc","#4a53fb","#4856fb","#4659fb","#445cfb","#425ffa","#4062fa","#3e65fa","#3c68f9","#3a6bf9","#386df9","#3670f8","#3473f8","#3079f7","#2e7bf7","#2c7ef7","#2a81f6","#2884f6","#2686f5","#2489f5","#228cf4","#208ef4","#1e91f3","#1c93f3","#1a96f3","#1898f2","#169bf2","#149df1","#12a0f1","#10a2f0","#0ea5ef","#0ca7ef","#0aa9ee","#08acee","#06aeed","#04b0ed","#02b3ec","#01b5eb","#03b7eb","#05b9ea","#07bbea","#09bee9","#0bc0e8","#0dc2e8","#0fc4e7","#11c6e6","#13c8e6","#15cae5","#17cbe4","#19cde4","#1bcfe3","#1fd3e1","#21d5e1","#23d6e0","#25d8df","#27dade","#29dbde","#2bdddd","#2ddedc","#2fe0db","#31e1da","#33e3da","#35e4d9","#37e6d8","#39e7d7","#3be8d6","#3dead5","#3febd5","#41ecd4","#43edd3","#45eed2","#47efd1","#49f1d0","#4bf2cf","#4df3ce","#4ff3cd","#51f4cc","#53f5cb","#55f6cb","#57f7ca","#59f8c9","#5bf8c8","#5df9c7","#5ffac6","#61fac5","#63fbc4","#65fbc3","#67fcc2","#69fcc1","#6bfdc0","#6ffebe","#71febc","#73febb","#75feba","#77ffb9","#79ffb8","#7bffb7","#7dffb6","#7fffb5","#81ffb4","#83ffb3","#85ffb2","#87ffb0","#89ffaf","#8bfeae","#8dfead","#8ffeac","#91feab","#93fda9","#95fda8","#97fca7","#99fca6","#9bfba5","#9dfba4","#9ffaa2","#a1faa1","#a3f9a0","#a5f89f","#a7f89d","#a9f79c","#abf69b","#adf59a","#aff498","#b1f397","#b3f396","#b5f295","#b7f193","#b9ef92","#bded8f","#bfec8e","#c1eb8d","#c3ea8c","#c5e88a","#c7e789","#c9e688","#cbe486","#cde385","#cfe184","#d1e082","#d3de81","#d5dd80","#d7db7e","#d9da7d","#dbd87b","#ddd67a","#dfd579","#e1d377","#e3d176","#e5cf74","#e7cd73","#e9cb72","#ebca70","#edc86f","#efc66d","#f1c46c","#f3c26b","#f5c069","#f7be68","#f9bb66","#fbb965","#fdb763","#ffb562","#ffb360","#ffb05f","#ffae5e","#ffac5c","#ffa759","#ffa558","#ffa256","#ffa055","#ff9d53","#ff9b52","#ff9850","#ff964f","#ff934d","#ff914c","#ff8e4a","#ff8c49","#ff8947","#ff8646","#ff8444","#ff8143","#ff7e41","#ff7b40","#ff793e","#ff763d","#ff733b","#ff703a","#ff6d38","#ff6b37","#ff6835","#ff6533","#ff6232","#ff5f30","#ff5c2f","#ff592d","#ff562c","#ff532a","#ff5029","#ff4d27","#ff4a26","#ff4724","#ff4422","#ff4121","#ff3e1f","#ff381c","#ff351b","#ff3219","#ff2f18","#ff2c16","#ff2914","#ff2613","#ff2211","#ff1f10","#ff1c0e","#ff190d","#ff160b","#ff1309","#ff1008","#ff0d06","#ff0905","#ff0603","#ff0302","#ff0000"],
  jet : ["#000080","#000084","#000089","#00008d","#000092","#000096","#00009b","#00009f","#0000a4","#0000a8","#0000ad","#0000b2","#0000b6","#0000bb","#0000bf","#0000c4","#0000c8","#0000cd","#0000d1","#0000d6","#0000da","#0000df","#0000e4","#0000e8","#0000ed","#0000f1","#0000f6","#0000fa","#0000ff","#0000ff","#0000ff","#0000ff","#0001ff","#0005ff","#0009ff","#000dff","#0011ff","#0015ff","#0019ff","#0021ff","#0025ff","#0029ff","#002dff","#0031ff","#0035ff","#0039ff","#003dff","#0041ff","#0045ff","#0049ff","#004dff","#0051ff","#0055ff","#0059ff","#005dff","#0061ff","#0065ff","#0069ff","#006dff","#0071ff","#0075ff","#0079ff","#007dff","#0081ff","#0085ff","#0089ff","#008dff","#0091ff","#0095ff","#0099ff","#009dff","#00a1ff","#00a5ff","#00a9ff","#00adff","#00b1ff","#00b5ff","#00bdff","#00c1ff","#00c5ff","#00c9ff","#00cdff","#00d1ff","#00d5ff","#00d9ff","#00ddfe","#00e1fb","#00e5f8","#02e9f4","#06edf1","#09f1ee","#0cf5eb","#0ff9e7","#13fde4","#16ffe1","#19ffde","#1cffdb","#1fffd7","#23ffd4","#26ffd1","#29ffce","#2cffca","#30ffc7","#33ffc4","#36ffc1","#39ffbe","#3cffba","#40ffb7","#43ffb4","#46ffb1","#49ffad","#4dffaa","#50ffa7","#53ffa4","#56ffa0","#5aff9d","#60ff97","#63ff94","#66ff90","#6aff8d","#6dff8a","#70ff87","#73ff83","#77ff80","#7aff7d","#7dff7a","#80ff77","#83ff73","#87ff70","#8aff6d","#8dff6a","#90ff66","#94ff63","#97ff60","#9aff5d","#9dff5a","#a0ff56","#a4ff53","#a7ff50","#aaff4d","#adff49","#b1ff46","#b4ff43","#b7ff40","#baff3c","#beff39","#c1ff36","#c4ff33","#c7ff30","#caff2c","#ceff29","#d1ff26","#d4ff23","#d7ff1f","#deff19","#e1ff16","#e4ff13","#e7ff0f","#ebff0c","#eeff09","#f1fc06","#f4f802","#f8f500","#fbf100","#feed00","#ffea00","#ffe600","#ffe200","#ffde00","#ffdb00","#ffd700","#ffd300","#ffd000","#ffcc00","#ffc800","#ffc400","#ffc100","#ffbd00","#ffb900","#ffb600","#ffb200","#ffae00","#ffab00","#ffa700","#ffa300","#ff9f00","#ff9c00","#ff9800","#ff9400","#ff9100","#ff8d00","#ff8900","#ff8200","#ff7e00","#ff7a00","#ff7700","#ff7300","#ff6f00","#ff6c00","#ff6800","#ff6400","#ff6000","#ff5d00","#ff5900","#ff5500","#ff5200","#ff4e00","#ff4a00","#ff4700","#ff4300","#ff3f00","#ff3b00","#ff3800","#ff3400","#ff3000","#ff2d00","#ff2900","#ff2500","#ff2200","#ff1e00","#ff1a00","#ff1600","#ff1300","#fa0f00","#f60b00","#f10800","#ed0400","#e80000","#e40000","#df0000","#da0000","#d10000","#cd0000","#c80000","#c40000","#bf0000","#bb0000","#b60000","#b20000","#ad0000","#a80000","#a40000","#9f0000","#9b0000","#960000","#920000","#8d0000","#890000","#840000","#800000"],
      reds : ["#fff5f0","#fff4ef","#fff4ee","#fff3ed","#fff2ec","#fff2eb","#fff1ea","#fff0e9","#fff0e8","#ffefe8","#ffeee7","#ffeee6","#ffede5","#ffece4","#ffece3","#ffebe2","#feeae1","#feeae0","#fee9df","#fee8de","#fee8dd","#fee7dc","#fee7db","#fee6da","#fee5d9","#fee5d8","#fee4d8","#fee3d7","#fee3d6","#fee2d5","#fee1d4","#fee1d3","#fee0d2","#fedfd0","#fedecf","#fedccd","#fedbcc","#fedaca","#fed9c9","#fdd7c6","#fdd5c4","#fdd4c2","#fdd3c1","#fdd2bf","#fdd1be","#fdd0bc","#fdcebb","#fdcdb9","#fdccb8","#fdcbb6","#fdcab5","#fdc9b3","#fdc7b2","#fdc6b0","#fdc5ae","#fcc4ad","#fcc3ab","#fcc2aa","#fcc1a8","#fcbfa7","#fcbea5","#fcbda4","#fcbca2","#fcbba1","#fcb99f","#fcb89e","#fcb79c","#fcb69b","#fcb499","#fcb398","#fcb296","#fcb095","#fcaf93","#fcae92","#fcad90","#fcab8f","#fcaa8d","#fca78b","#fca689","#fca588","#fca486","#fca285","#fca183","#fca082","#fc9e80","#fc9d7f","#fc9c7d","#fc9b7c","#fc997a","#fc9879","#fc9777","#fc9576","#fc9474","#fc9373","#fc9272","#fc9070","#fc8f6f","#fc8e6e","#fc8d6d","#fc8b6b","#fc8a6a","#fc8969","#fc8767","#fc8666","#fc8565","#fc8464","#fc8262","#fc8161","#fc8060","#fc7f5f","#fb7d5d","#fb7c5c","#fb7b5b","#fb7a5a","#fb7858","#fb7757","#fb7555","#fb7353","#fb7252","#fb7151","#fb7050","#fb6e4e","#fb6d4d","#fb6c4c","#fb6b4b","#fb694a","#fa6849","#fa6648","#fa6547","#f96346","#f96245","#f96044","#f85f43","#f85d42","#f75c41","#f75b40","#f7593f","#f6583e","#f6563d","#f6553c","#f5533b","#f5523a","#f4503a","#f44f39","#f44d38","#f34c37","#f34a36","#f34935","#f24734","#f24633","#f14432","#f14331","#f14130","#f0402f","#f03d2d","#ef3c2c","#ee3a2c","#ed392b","#ec382b","#eb372a","#ea362a","#e93529","#e83429","#e63328","#e53228","#e43027","#e32f27","#e22e27","#e12d26","#e02c26","#de2b25","#dd2a25","#dc2924","#db2824","#da2723","#d92523","#d82422","#d72322","#d52221","#d42121","#d32020","#d21f20","#d11e1f","#d01d1f","#cf1c1f","#ce1a1e","#cc191e","#cb181d","#ca181d","#c9181d","#c8171c","#c7171c","#c4161c","#c3161b","#c2161b","#c1161b","#bf151b","#be151a","#bd151a","#bc141a","#bb141a","#b91419","#b81419","#b71319","#b61319","#b51318","#b31218","#b21218","#b11218","#b01217","#af1117","#ad1117","#ac1117","#ab1016","#aa1016","#a91016","#a81016","#a60f15","#a50f15","#a30f15","#a10e15","#9f0e14","#9d0d14","#9c0d14","#9a0c14","#980c13","#960b13","#940b13","#920a13","#900a12","#8e0912","#8a0812","#880811","#860811","#840711","#820711","#800610","#7e0610","#7c0510","#7a0510","#79040f","#77040f","#75030f","#73030f","#71020e","#6f020e","#6d010e","#6b010e","#69000d","#67000d"],
      phase : ["#a8780d","#a9770f","#ab7611","#ac7513","#ae7414","#af7316","#b17218","#b27119","#b3701b","#b56f1d","#b66e1e","#b76d20","#b96c22","#ba6b23","#bb6a25","#bd6926","#be6828","#bf672a","#c0662b","#c1652d","#c2642e","#c46230","#c56132","#c66033","#c75f35","#c85e37","#c95d38","#ca5c3a","#cb5a3c","#cc593e","#cd583f","#ce5741","#cf5643","#d05445","#d05347","#d15249","#d2514b","#d34f4d","#d44e4f","#d54b53","#d64a55","#d74957","#d8475a","#d8465c","#d9455e","#d94361","#da4263","#db4066","#db3f68","#dc3d6b","#dc3c6d","#dd3a70","#dd3973","#dd3876","#de3678","#de357b","#de337e","#de3281","#df3184","#df2f87","#df2e8a","#df2d8d","#df2b90","#df2a93","#de2997","#de289a","#de289d","#de27a0","#dd26a3","#dd26a6","#dc25a9","#dc25ad","#db25b0","#da25b3","#da26b6","#d926b9","#d827bc","#d628c1","#d529c4","#d42ac7","#d32bc9","#d22dcc","#d12ece","#d02fd0","#cf31d3","#cd32d5","#cc34d7","#cb35d9","#c937db","#c839dd","#c63adf","#c53ce1","#c33ee2","#c23fe4","#c041e5","#be43e7","#bd45e8","#bb46e9","#b948eb","#b84aec","#b64bed","#b44dee","#b24fef","#b050ef","#ae52f0","#ac54f1","#aa55f1","#a957f2","#a759f3","#a45af3","#a25cf3","#a05df4","#9e5ff4","#9c60f4","#9a62f4","#9863f4","#9366f4","#9168f4","#8f69f4","#8c6bf3","#8a6cf3","#876df3","#856ff2","#8270f1","#8071f1","#7d73f0","#7b74ef","#7875ef","#7677ee","#7378ed","#7079ec","#6e7aeb","#6b7be9","#687ce8","#667ee7","#637fe6","#6080e4","#5d81e3","#5a82e1","#5883df","#5584de","#5285dc","#4f86da","#4d87d8","#4a87d7","#4788d5","#4589d3","#428ad1","#408acf","#3d8bcd","#3b8ccb","#388cc9","#368dc7","#348ec4","#308fc0","#2e8fbe","#2c90bc","#2a90ba","#2891b8","#2791b6","#2591b4","#2492b2","#2392b0","#2192ae","#2093ac","#1f93aa","#1e93a8","#1d94a6","#1c94a4","#1b94a2","#1a94a0","#19959e","#19959c","#18959a","#179598","#169696","#159694","#149692","#149690","#13978e","#12978c","#11978a","#109788","#0f9786","#0e9884","#0d9882","#0d9880","#0c987e","#0c987c","#0b9979","#0b9977","#0b9975","#0d9970","#0e996e","#0f9a6b","#119a69","#139a66","#159a63","#179a61","#199a5e","#1c9a5b","#1f9a58","#219a55","#249a52","#279a4f","#2b9a4c","#2e9a49","#319946","#359943","#389940","#3c993c","#409839","#439836","#479732","#4b972f","#4f962c","#539629","#569526","#5a9423","#5e9420","#61931e","#65921b","#689119","#6b9017","#6f9016","#728f14","#748e13","#778d12","#7a8c11","#7d8b10","#7f8b0f","#84890e","#86880e","#88870e","#8b860d","#8d850d","#8f840d","#91830d","#93830d","#95820d","#97810d","#99800d","#9b7f0d","#9d7e0d","#9f7d0d","#a17c0d","#a27b0d","#a47a0d","#a6790d","#a8780d"],
      stripes : ["#fee6e3","#fde6e2","#fde5e2","#fde4e1","#fde4e0","#fde3e0","#fde2df","#fde1de","#fde1de","#faa5b7","#faa3b6","#faa2b6","#faa1b6","#faa1b6","#faa0b5","#fa9eb5","#fa9db4","#fdd9d6","#fdd8d5","#fdd8d5","#fdd7d4","#fdd7d3","#fdd6d2","#fdd5d1","#fdd4d0","#f991b0","#f991b0","#f98faf","#f98dae","#f98bae","#f98aad","#f98aad","#f988ad","#f986ac","#fcccc8","#fcccc7","#fcccc7","#fccbc6","#fccac5","#fcc9c4","#fcc8c3","#fcc7c3","#f87aa8","#f87aa8","#f878a7","#f877a6","#f875a6","#f875a6","#f873a5","#f871a4","#fcc0bf","#fcbfbe","#fcbebe","#fcbcbd","#fcbcbd","#fbbbbd","#fbbabd","#fbb9bc","#fbb8bc","#f666a1","#f564a0","#f462a0","#f462a0","#f361a0","#f35f9f","#f25d9f","#f25d9f","#fbafba","#fbafba","#fbaeb9","#fbadb9","#fbacb9","#fbacb9","#fbaab8","#fba9b8","#ec529d","#ec529d","#eb509c","#ea4f9c","#ea4d9c","#ea4d9c","#e94b9c","#e84a9b","#e84a9b","#faa0b5","#faa0b5","#fa9eb5","#fa9db4","#fa9bb4","#fa9bb4","#fa99b3","#fa97b2","#e23e99","#e23e99","#e13d99","#e13b98","#e03a98","#e03a98","#df3898","#de3697","#f98dae","#f98bae","#f98aad","#f988ad","#f988ad","#f986ac","#f984ab","#f984ab","#f883ab","#d52b93","#d52b93","#d32992","#d22891","#d22891","#d02690","#cf258f","#cf258f","#f877a6","#f877a6","#f875a6","#f873a5","#f873a5","#f871a4","#f770a4","#f76ea3","#c61b8b","#c4198a","#c31889","#c31889","#c21688","#c01588","#c01588","#bf1387","#bd1186","#f564a0","#f462a0","#f361a0","#f35f9f","#f35f9f","#f25d9f","#f15c9f","#f15c9f","#b40881","#b30681","#b30681","#b10580","#b0037f","#b0037f","#ae017e","#ae017e","#ec529d","#eb509c","#ea4f9c","#ea4f9c","#ea4d9c","#e94b9c","#e94b9c","#e84a9b","#e7489b","#a3017d","#a1017c","#a1017c","#a0017c","#9e017c","#9e017c","#9c017c","#9b017b","#e23e99","#e23e99","#e13d99","#e13b98","#e13b98","#e03a98","#df3898","#df3898","#91017a","#91017a","#8f017a","#8f017a","#8e017a","#8c0179","#8c0179","#8b0179","#d82e94","#d62d93","#d52b93","#d52b93","#d32992","#d22891","#d22891","#d02690","#cf258f","#810178","#7f0178","#7d0177","#7d0177","#7c0177","#7a0177","#7a0177","#790177","#c71d8c","#c61b8b","#c4198a","#c4198a","#c31889","#c21688","#c21688","#c01588","#6f0174","#6f0174","#6e0174","#6c0173","#6c0173","#6b0173","#6b0173","#690173","#680172","#b70b83","#b60982","#b40881","#b40881","#b30681","#b30681","#b10580","#b0037f","#600070","#5f0070","#5d006f","#5d006f","#5b006f","#5b006f","#5a006e","#58006e","#a8017d","#a6017d","#a5017d","#a5017d","#a3017d","#a3017d","#a1017c","#a0017c","#a0017c","#4f006c","#4f006c","#4e006b","#4c006b","#4c006b","#4b006a","#49006a","#49006a"],
  };

  const availableColorMaps = Object.keys(colorMaps);

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
      this.gp = this.parent.gp;
      this.values = values;
      this.name = name;
      this.enabled = false;

      this.isDominantQuantity = true;

      [this.dataMin, this.dataMax] = computeMinMax(values);

      // create a new mesh material
      let functionMaterial = createVertexScalarFunctionMaterial(
        this.gp.matcapTextures.r,
        this.gp.matcapTextures.g,
        this.gp.matcapTextures.b,
        this.gp.matcapTextures.k
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
        .add(guiFields, this.prefix + "#ColorMap", availableColorMaps)
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
      let F = this.parent.faces.length;
      let colors = new Float32Array(F * 3 * 3);
      this.mesh.geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    }

    applyColorMap(cm) {
      // update color buffer
      const colors = this.mesh.geometry.attributes.color.array;

      let F = this.parent.faces.length;
      for (let iF = 0; iF < F; iF++) {
        let face = this.parent.faces[iF];
        for (let iV = 0; iV < 3; iV++) {
          let value = this.values[face[iV]];
          let color = applyColorMap(cm, value, this.dataMin, this.dataMax);

          colors[3 * 3 * iF + 3 * iV + 0] = color.r;
          colors[3 * 3 * iF + 3 * iV + 1] = color.g;
          colors[3 * 3 * iF + 3 * iV + 2] = color.b;
        }
      }

      this.mesh.geometry.attributes.color.needsUpdate = true;
    }

    getVertexValue(iV) {
      return this.gp.prettyScalar(this.values[iV]);
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
      this.gp = this.parent.ps;
      this.values = values;
      this.name = name;
      this.enabled = false;

      this.isDominantQuantity = true;

      [this.dataMin, this.dataMax] = computeMinMax(values);

      // create a new mesh material
      createInstancedScalarFunctionMaterial(
        this.gp.matcapTextures.r,
        this.gp.matcapTextures.g,
        this.gp.matcapTextures.b,
        this.gp.matcapTextures.k
      );

      // create matcap material
      let matcapMaterial = createInstancedScalarFunctionMaterial(
        this.gp.matcapTextures.r,
        this.gp.matcapTextures.g,
        this.gp.matcapTextures.b,
        this.gp.matcapTextures.k
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

  function computeMinMax$1(values) {
    let min = values[0];
    let max = values[0];
    values.forEach((v) => {
      min = Math.min(min, v);
      max = Math.max(max, v);
    });
    return [min, max];
  }

  class VertexDistanceQuantity {
    constructor(name, values, parentMesh) {
      this.parent = parentMesh;
      this.gp = this.parent.gp;
      this.values = values;
      this.name = name;
      this.enabled = false;

      this.isDominantQuantity = true;

      [this.dataMin, this.dataMax] = computeMinMax$1(values);

      // create a new mesh material
      let functionMaterial = createVertexDistanceFunctionMaterial(
        this.gp.matcapTextures.r,
        this.gp.matcapTextures.g,
        this.gp.matcapTextures.b,
        this.gp.matcapTextures.k
      );

      // build a three.js mesh to visualize the function
      this.mesh = new THREE.Mesh(this.parent.mesh.geometry.clone(), functionMaterial);
      this.mesh.material.uniforms.colormap.value = this.gp.stripeTexture;
      this.initializeDistances(this.values);

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

      // guiFields[this.name + "#Scale"] = 1;
      // this.setScale(guiFields[this.name + "#Scale"]);
      // guiFolder
      //   .add(guiFields, this.name + "#Scale")
      //   .min(0)
      //   .max(2)
      //   .step(0.05)
      //   .onChange((scale) => {
      //     this.setScale(scale);
      //   })
      //   .listen()
      //   .name("Scale");

      // guiFields[this.prefix + "#ColorMap"] = "viridis";
      // this.applyColorMap(guiFields[this.prefix + "#ColorMap"]);
      // guiFolder
      //   .add(guiFields, this.prefix + "#ColorMap", availableColorMaps)
      //   .onChange((cm) => {
      //     this.applyColorMap(cm);
      //   })
      //   .listen()
      //   .name("Color Map");
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

    // setScale(scale) {
    //   this.mesh.material.uniforms.scale.value = scale;
    // }

    initializeDistances(values) {
      let F = this.parent.faces.length;
      let distances = new Float32Array(F * 3);

      for (let iF = 0; iF < F; iF++) {
        let face = this.parent.faces[iF];
        for (let iV = 0; iV < 3; iV++) {
          let val = this.values[face[iV]];
          val = (val - this.dataMin) / (this.dataMax - this.dataMin);
          distances[3 * iF + iV] = val;
        }
      }

      this.mesh.geometry.setAttribute("value", new THREE.BufferAttribute(distances, 1));
    }

    applyColorMap(cm) {
      // update color buffer
      const colors = this.mesh.geometry.attributes.color.array;

      let F = this.parent.faces.length;
      for (let iF = 0; iF < F; iF++) {
        let face = this.parent.faces[iF];
        for (let iV = 0; iV < 3; iV++) {
          let value = this.values[face[iV]];
          let color = applyColorMap(cm, value, this.dataMin, this.dataMax);

          colors[3 * 3 * iF + 3 * iV + 0] = color.r;
          colors[3 * 3 * iF + 3 * iV + 1] = color.g;
          colors[3 * 3 * iF + 3 * iV + 2] = color.b;
        }
      }

      this.mesh.geometry.attributes.color.needsUpdate = true;
    }

    getVertexValue(iV) {
      return this.gp.prettyScalar(this.values[iV]);
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
      this.gp = this.parent.gp;
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
        this.gp.matcapTextures.r,
        this.gp.matcapTextures.g,
        this.gp.matcapTextures.b,
        this.gp.matcapTextures.k
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
      return this.gp.prettyVector(vecList);
    }
    getEdgeValue(iE) {
      return undefined;
    }
    getFaceValue(iE) {
      return undefined;
    }
  }

  class VertexParameterizationQuantity {
    constructor(name, coords, parentMesh) {
      this.parent = parentMesh;
      this.gp = this.parent.gp;
      this.coords = coords;
      this.name = name;
      this.enabled = false;

      this.isDominantQuantity = true;

      // create a new mesh material
      let functionMaterial = VertexParamCheckerboard(
        this.gp.matcapTextures.r,
        this.gp.matcapTextures.g,
        this.gp.matcapTextures.b,
        this.gp.matcapTextures.k
      );

      // build a three.js mesh to visualize the function
      this.mesh = new THREE.Mesh(this.parent.mesh.geometry.clone(), functionMaterial);
      this.initParam(coords);

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

      guiFields[this.prefix + "#Style"] = "checker";
      // this.applyStyle(guiFields[this.prefix + "#Style"]);
      guiFolder
        .add(guiFields, this.prefix + "#Style", ["checker", "grid"])
        .onChange((s) => {
          this.applyStyle(s);
        })
        .listen()
        .name("Color Map");

      guiFields[this.name + "#Color1"] = [249, 45, 94];
      this.setColor1(guiFields[this.name + "#Color1"]);
      guiFolder
        .addColor(guiFields, this.name + "#Color1")
        .onChange((c) => {
          this.setColor1(c);
        })
        .listen()
        .name("Color");

      guiFields[this.name + "#Color2"] = [249, 219, 225];
      this.setColor2(guiFields[this.name + "#Color2"]);
      guiFolder
        .addColor(guiFields, this.name + "#Color2")
        .onChange((c) => {
          this.setColor2(c);
        })
        .listen()
        .name("Color");

      guiFields[this.name + "#Scale"] = 1;
      this.setScale(guiFields[this.name + "#Scale"]);
      guiFolder
        .add(guiFields, this.name + "#Scale")
        .min(0)
        .max(2)
        .step(0.05)
        .onChange((scale) => {
          this.setScale(scale);
        })
        .listen()
        .name("Scale");
    }

    setScale(scale) {
      this.mesh.material.uniforms.paramScale.value = scale / 10;
    }

    setColor1(color) {
      let c = new THREE.Vector3(color[0] / 255, color[1] / 255, color[2] / 255);
      this.mesh.material.uniforms.color1.value = c;
    }

    setColor2(color) {
      let c = new THREE.Vector3(color[0] / 255, color[1] / 255, color[2] / 255);
      this.mesh.material.uniforms.color2.value = c;
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

    applyStyle(style) {
      if (style == "checker") {
        this.mesh.material = VertexParamCheckerboard(
          this.gp.matcapTextures.r,
          this.gp.matcapTextures.g,
          this.gp.matcapTextures.b,
          this.gp.matcapTextures.k
        );
      } else if (style == "grid") {
        this.mesh.material = VertexParamGrid(
          this.gp.matcapTextures.r,
          this.gp.matcapTextures.g,
          this.gp.matcapTextures.b,
          this.gp.matcapTextures.k
        );
      }
      // Reset material uniforms
      this.setColor1(this.guiFields[this.name + "#Color1"]);
      this.setColor2(this.guiFields[this.name + "#Color2"]);
      this.setScale(this.guiFields[this.name + "#Scale"]);

      // Copy some attributes from parent
      this.mesh.material.uniforms.edgeWidth = this.parent.mesh.material.uniforms.edgeWidth;
      this.mesh.material.uniforms.edgeColor = this.parent.mesh.material.uniforms.edgeColor;
    }

    initParam(coords) {
      // fill position and barycoord buffers
      let F = this.parent.faces.length;
      let coordArray = new Float32Array(F * 3 * 2);
      for (let iF = 0; iF < F; iF++) {
        let face = this.parent.faces[iF];
        for (let iV = 0; iV < 3; iV++) {
          let coord = coords[face[iV]];
          for (let iD = 0; iD < 2; ++iD) {
            coordArray[3 * 2 * iF + 2 * iV + iD] = coord[iD];
          }
        }
      }

      this.mesh.geometry.setAttribute(
        "coord",
        new THREE.BufferAttribute(coordArray, 2)
      );
    }

    getVertexValue(iV) {
      return this.gp.prettyVector2(this.coords[iV]);
    }
    getEdgeValue(iE) {
      return undefined;
    }
    getFaceValue(iE) {
      return undefined;
    }

    remove() {}
  }

  function standardizeVector3Array(positionArray) {
    let get = undefined;
    if (positionArray.get) {
      get = (iV) => positionArray.get(iV);
    } else {
      get = (iV) => positionArray[iV];
    }

    let getDim = undefined;
    if (get(0).x) {
      getDim = function (coord, iD) {
        if (iD == 0) {
          return coord.x;
        } else if (iD == 1) {
          return coord.y;
        } else {
          return coord.z;
        }
      };
    } else {
      getDim = (coord, iD) => coord[iD];
    }

    let size = undefined;
    if (positionArray.size) {
      size = positionArray.size();
    } else {
      size = positionArray.length;
    }

    const standardizedPositions = [];
    let pos = undefined;
    for (let iV = 0; iV < size; iV++) {
      pos = get(iV);
      standardizedPositions.push([
        getDim(pos, 0),
        getDim(pos, 1),
        getDim(pos, 2),
      ]);
    }
    return standardizedPositions;
  }

  function standardizeFaceArray(faceArray) {
    let get = undefined;
    let flatTris = false;
    if (faceArray.get) {
      // if faceArray is a single list, we assume that all faces are
      // triangles (this is the geometry-processing-js convention)
      if (
        typeof faceArray.get(0) == "number" ||
        typeof faceArray.get(0) == "bigint"
      ) {
        flatTris = true;
        get = (iV) => [
          faceArray.get(3 * iV),
          faceArray.get(3 * iV + 1),
          faceArray.get(3 * iV + 2),
        ];
      } else if (faceArray.get(0).get) {
        get = (iV) => [
          faceArray.get(iV).get(0),
          faceArray.get(iV).get(1),
          faceArray.get(iV).get(2),
        ];
      } else {
        get = (iV) => faceArray.get(iV);
      }
    } else {
      // if faceArray is a single list, we assume that all faces are
      // triangles (this is the geometry-processing-js convention)
      if (typeof faceArray[0] == "number" || typeof faceArray[0] == "bigint") {
        flatTris = true;
        get = (iV) => [
          faceArray[3 * iV],
          faceArray[3 * iV + 1],
          faceArray[3 * iV + 2],
        ];
      } else {
        // for now, I'll assume that nobody would make a list of things that have a get function
        get = (iV) => faceArray[iV];
      }
    }

    let size = undefined;
    if (faceArray.size) {
      size = faceArray.size();
    } else {
      size = faceArray.length;
    }
    if (flatTris) size /= 3;

    const standardizedFaces = [];
    for (let iF = 0; iF < size; iF++) {
      standardizedFaces.push([get(iF)[0], get(iF)[1], get(iF)[2]]);
    }
    return standardizedFaces;
  }

  function standardizeVector2Array(array) {
    let get = undefined;
    if (array.get) {
      get = (iV) => array.get(iV);
    } else {
      get = (iV) => array[iV];
    }

    let getDim = undefined;
    if (get(0).x) {
      getDim = function (coord, iD) {
        if (iD == 0) {
          return coord.x;
        } else {
          return coord.y;
        }
      };
    } else {
      getDim = (coord, iD) => coord[iD];
    }

    let size = undefined;
    if (array.size) {
      size = array.size();
    } else {
      size = array.length;
    }

    const standardizedArray = [];
    let pos = undefined;
    for (let iV = 0; iV < size; iV++) {
      pos = get(iV);
      standardizedArray.push([getDim(pos, 0), getDim(pos, 1)]);
    }
    return standardizedArray;
  }

  class SurfaceMesh {
    constructor(coords, faces, name, geopticEnvironment, options = {}) {
      this.gp = geopticEnvironment;
      this.nV = coords.length;
      this.coords = coords;
      this.faces = faces;
      this.name = name;
      this.enabled = true;

      this.color = options.color || getNextUniqueColor();

      // build three.js mesh
      [this.mesh, this.geo] = this.constructThreeMesh(coords, faces);

      [
        this.smoothVertexNormals,
        this.smoothCornerNormals,
      ] = this.computeSmoothNormals();

      if (this.gp.doPicks)
        this.pickMesh = this.constructThreePickMesh(coords, faces);

      this.quantities = {};

      this.setSmoothShading(true);

      this.guiFields = undefined;
      this.guiFolder = undefined;

      this.vertexPickCallback = (iV) => {};
      this.edgePickCallback = (iE) => {};
      this.facePickCallback = (iF) => {};
    }

    addVertexScalarQuantity(name, values) {
      this.quantities[name] = new VertexScalarQuantity(name, values, this);

      this.guiFolder.removeFolder(name);
      let quantityGui = this.guiFolder.addFolder(name);
      this.quantities[name].initGui(this.guiFields, quantityGui);

      return this.quantities[name];
    }

    addVertexDistanceQuantity(name, values) {
      this.quantities[name] = new VertexDistanceQuantity(name, values, this);

      this.guiFolder.removeFolder(name);
      let quantityGui = this.guiFolder.addFolder(name);
      this.quantities[name].initGui(this.guiFields, quantityGui);

      return this.quantities[name];
    }

    addVertexVectorQuantity(name, values) {
      values = standardizeVector3Array(values);
      this.quantities[name] = new VertexVectorQuantity(name, values, this);

      this.guiFolder.removeFolder(name);
      let quantityGui = this.guiFolder.addFolder(name);
      this.quantities[name].initGui(this.guiFields, quantityGui);

      return this.quantities[name];
    }

    addVertexParameterizationQuantity(name, values) {
      values = standardizeVector2Array(values);
      this.quantities[name] = new VertexParameterizationQuantity(
        name,
        values,
        this
      );

      this.guiFolder.removeFolder(name);
      let quantityGui = this.guiFolder.addFolder(name);
      this.quantities[name].initGui(this.guiFields, quantityGui);

      return this.quantities[name];
    }

    initGui(guiFields, guiFolder) {
      this.guiFields = guiFields;
      this.guiFolder = guiFolder;

      let objectGuiList = guiFolder.domElement.firstChild;
      let meshInfoBox = document.createElement("li");
      meshInfoBox.classList.add("dat-info-box");
      objectGuiList.appendChild(meshInfoBox);
      let vertexInfo = document.createElement("span");
      vertexInfo.innerHTML = "#verts: " + this.nV;
      let faceInfo = document.createElement("span");
      faceInfo.innerHTML = "   #faces: " + this.faces.length;
      meshInfoBox.appendChild(vertexInfo);
      meshInfoBox.appendChild(faceInfo);

      guiFields[this.name + "#Enabled"] = true;
      const enabledButton = guiFolder
        .add(guiFields, this.name + "#Enabled")
        .onChange((e) => {
          this.setEnabled(e);
        })
        .listen()
        .name("Enabled");
      let row = enabledButton.domElement.closest("li");
      row.classList.add("half-button");
      row.style.width = "35%";

      guiFields[this.name + "#Smooth"] = true;
      const smoothButton = guiFolder
        .add(guiFields, this.name + "#Smooth")
        .onChange((c) => {
          this.setSmoothShading(c);
        })
        .listen()
        .name("Smooth");
      row = smoothButton.domElement.closest("li");
      row.classList.add("half-button");
      row.style.width = "35%";

      guiFields[this.name + "#Edges"] = false;
      const edgesButton = guiFolder
        .add(guiFields, this.name + "#Edges")
        .onChange((c) => {
          this.setEdgesEnabled(c);
        })
        .listen()
        .name("Edges");
      row = edgesButton.domElement.closest("li");
      row.classList.add("half-button");
      row.style.width = "30%";

      guiFields[this.name + "#Color"] = this.color;
      this.setColor(guiFields[this.name + "#Color"]);
      guiFolder
        .addColor(guiFields, this.name + "#Color")
        .onChange((c) => {
          this.setColor(c);
        })
        .listen()
        .name("Color");

      guiFields[this.name + "#Edge Width"] = 0;
      // keep your own store of the edge width so it doesn't get forgotten
      // if you set the edge width to zero to turn off edges
      this.edgeWidth = 1;
      const edgeWidthInput = guiFolder
        .add(guiFields, this.name + "#Edge Width")
        .min(0)
        .max(2)
        .step(0.05)
        .onChange((width) => {
          this.edgeWidth = width;
          this.mesh.material.uniforms.edgeWidth.value = width;
        })
        .listen()
        .name("Edge Width");
      row = edgeWidthInput.domElement.closest("li");
      row.style.display = "none";
      this.edgeGuis = [row];

      guiFields[this.name + "#Edge Color"] = [0, 0, 0];
      const edgeColorInput = guiFolder
        .addColor(guiFields, this.name + "#Edge Color")
        .onChange((c) => {
          this.setEdgeColor(c);
        })
        .listen()
        .name("Edge Color");
      row = edgeColorInput.domElement.closest("li");
      row.style.display = "none";
      this.edgeGuis.push(row);

      guiFolder.open();
    }

    setEdgesEnabled(enabled) {
      this.guiFields[this.name + "#Edges"] = enabled;
      for (let elem of this.edgeGuis) {
        elem.style.display = enabled ? "block" : "none";
      }
      if (enabled) {
        this.mesh.material.uniforms.edgeWidth.value = this.edgeWidth;
        this.guiFields[this.name + "#Edge Width"] = this.edgeWidth;
      } else {
        this.mesh.material.uniforms.edgeWidth.value = 0;
        this.guiFields[this.name + "#Edge Width"] = 0;
      }
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
      this.color = color;
      let c = new THREE.Vector3(color[0] / 255, color[1] / 255, color[2] / 255);
      this.mesh.material.uniforms.color.value = c;
    }

    getColor() {
      return this.color;
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
            this.gp.scene.add(this.quantities[q].mesh);
            enabledQuantity = true;
          }
        }
        if (!enabledQuantity) {
          this.gp.scene.add(this.mesh);
        }
        if (this.gp.doPicks) this.gp.pickScene.add(this.pickMesh);
      } else {
        for (let q in this.quantities) {
          this.gp.scene.remove(this.quantities[q].mesh);
        }
        this.gp.scene.remove(this.mesh);
        if (this.gp.doPicks) this.gp.pickScene.remove(this.pickMesh);
      }
    }

    enableQuantity(q) {
      if (q.isDominantQuantity) {
        for (let pName in this.quantities) {
          let p = this.quantities[pName];
          if (p.isDominantQuantity && pName != q.name) {
            this.guiFields[p.prefix + "#Enabled"] = false;
            p.enabled = false;
            this.gp.scene.remove(p.mesh);
          }
        }
      }

      if (this.enabled) {
        if (q.isDominantQuantity) {
          this.gp.scene.remove(this.mesh);
        }
        this.gp.scene.add(q.mesh);
      }
    }

    disableQuantity(q) {
      if (this.enabled) {
        this.gp.scene.remove(q.mesh);
        this.gp.scene.add(this.mesh);
      }
    }

    remove() {
      for (let q in this.quantities) {
        this.gp.scene.remove(this.quantities[q].mesh);
        this.quantities[q].remove();
      }
      this.quantities = {};
    }

    computeSmoothNormals() {
      // TODO: handle non-triangular face
      let V = this.nV;
      let F = this.faces.length;
      let vertexNormals = new Float32Array(V * 3);
      for (let iV = 0; iV < V; ++iV) {
        vertexNormals[3 * iV + 0] = 0;
        vertexNormals[3 * iV + 1] = 0;
        vertexNormals[3 * iV + 2] = 0;
      }

      const currNormals = this.mesh.geometry.attributes.normal.array;
      for (let iF = 0; iF < F; iF++) {
        let face = this.faces[iF];
        for (let iV = 0; iV < 3; iV++) {
          let v = face[iV];
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
        let face = this.faces[iF];
        for (let iV = 0; iV < 3; iV++) {
          for (let iD = 0; iD < 3; ++iD) {
            normals[3 * 3 * iF + 3 * iV + iD] = vertexNormals[3 * face[iV] + iD];
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
      if (this.gp.doPicks)
        this.pickMesh.setRotationFromAxisAngle(new THREE.Vector3(1, 0, 0), 0);
      let oldPos = this.mesh.position;
      this.mesh.translateX(pos.x - oldPos.x, 1);
      this.mesh.translateY(pos.y - oldPos.y, 1);
      this.mesh.translateZ(pos.z - oldPos.z, 1);

      if (this.gp.doPicks) {
        oldPos = this.pickMesh.position;
        this.pickMesh.translateX(pos.x - oldPos.x, 1);
        this.pickMesh.translateY(pos.y - oldPos.y, 1);
        this.pickMesh.translateZ(pos.z - oldPos.z, 1);
      }

      // After translating, we re-apply the old rotation
      this.mesh.setRotationFromEuler(oldRot);
      if (this.gp.doPicks) this.pickMesh.setRotationFromEuler(oldRot);
    }

    setOrientationFromMatrix(mat) {
      this.mesh.setRotationFromAxisAngle(new THREE.Vector3(1, 0, 0), 0);
      this.mesh.setRotationFromMatrix(mat);

      if (this.gp.doPicks) {
        this.pickMesh.setRotationFromAxisAngle(new THREE.Vector3(1, 0, 0), 0);
        this.pickMesh.setRotationFromMatrix(mat);
      }
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

      // fill position and barycoord buffers
      let F = faces.length;
      let positions = new Float32Array(F * 3 * 3);
      let barycoords = new Float32Array(F * 3 * 3);
      for (let iF = 0; iF < F; iF++) {
        let face = faces[iF];
        for (let iV = 0; iV < 3; iV++) {
          let coord = coords[face[iV]];
          for (let iD = 0; iD < 3; ++iD) {
            positions[3 * 3 * iF + 3 * iV + iD] = coord[iD];
            barycoords[3 * 3 * iF + 3 * iV + iD] = iD == iV ? 1 : 0;
          }
        }
      }

      threeGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      threeGeometry.setAttribute("barycoord", new THREE.BufferAttribute(barycoords, 3));
      threeGeometry.computeVertexNormals();

      // create matcap material
      let matcapMaterial = createMatCapMaterial(
        this.gp.matcapTextures.r,
        this.gp.matcapTextures.g,
        this.gp.matcapTextures.b,
        this.gp.matcapTextures.k
      );

      // create mesh
      let threeMesh = new THREE.Mesh(threeGeometry, matcapMaterial);
      return [threeMesh, threeGeometry];
    }

    pickElement(localInd) {
      if (localInd < this.facePickIndStart) {
        this.gp.setDataHeader(`Surface Mesh ${this.name}`, `Vertex ${localInd}`);

        this.gp.clearDataFields();
        this.gp.showDataField(
          "position",
          this.gp.prettyVector(this.coords[localInd])
        );

        for (let qName in this.quantities) {
          let qVal = this.quantities[qName].getVertexValue(localInd);
          if (qVal) {
            this.gp.showDataField(qName, qVal);
          }
        }
        this.vertexPickCallback(localInd);
      } else if (localInd < this.edgePickIndStart) {
        const iF = localInd - this.facePickIndStart;
        this.gp.setDataHeader(`Surface Mesh ${this.name}`, `Face ${iF}`);
        this.gp.clearDataFields();
        this.facePickCallback(iF);
      } else {
        const iE = localInd - this.edgePickIndStart;
        this.gp.setDataHeader(`Surface Mesh ${this.name}`, `Edge ${iE}`);
        this.gp.clearDataFields();
        this.edgePickCallback(iE);
      }
    }

    // TODO: support polygon meshes
    // must be called after constructThreeMesh
    constructThreePickMesh(coords, faces) {
      let pickGeo = new THREE.BufferGeometry();

      let minmax = (a, b) => [Math.min(a, b), Math.max(a, b)];

      let F = faces.length;
      // count the number of vertices. Assuming they are densely indexed, this is just the max index + 1 that appears in faces
      // also index mesh edges
      let V = 0;
      this.edges = [];
      let edgeIndex = {};
      for (let iF = 0; iF < F; iF++) {
        let face = faces[iF];
        for (let iV = 0; iV < 3; ++iV) {
          V = Math.max(V, face[iV] + 1);
          let edgeHash = minmax(face[iV], face[(iV + 1) % 3]);
          if (!(edgeHash in edgeIndex)) {
            edgeIndex[edgeHash] = this.edges.length;
            this.edges.push(edgeHash);
          }
        }
      }

      let E = this.edges.length;
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
        let face = faces[iF];
        let fColor = pickIndToVector(iF + faceGlobalPickIndStart);

        let vColors = [0, 1, 2].map((i) => pickIndToVector(pickStart + face[i]));
        let eColors = [1, 2, 0].map((i) => {
          let edgeHash = minmax(face[i], face[(i + 1) % 3]);
          return pickIndToVector(edgeGlobalPickIndStart + edgeIndex[edgeHash]);
        });

        for (let iV = 0; iV < 3; iV++) {
          face[iV];

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
    constructor(coords, name, geopticEnvironment, options = {}) {
      this.gp = geopticEnvironment;
      this.nV = coords.length;
      this.coords = coords;
      this.name = name;
      this.enabled = true;
      this.color = options.color || getNextUniqueColor();

      // build three.js mesh
      this.mesh = this.constructThreeMesh(coords);

      if (this.gp.doPicks) this.pickMesh = this.constructThreePickMesh(coords);

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

      let objectGuiList = guiFolder.domElement.firstChild;
      let meshInfoBox = document.createElement("li");
      meshInfoBox.classList.add("dat-info-box");
      objectGuiList.appendChild(meshInfoBox);
      let vertexInfo = document.createElement("span");
      vertexInfo.innerHTML = "#verts: " + this.nV;
      meshInfoBox.appendChild(vertexInfo);

      guiFields[this.name + "#Enabled"] = true;
      guiFolder
        .add(guiFields, this.name + "#Enabled")
        .onChange((e) => {
          this.setEnabled(e);
        })
        .listen()
        .name("Enabled");

      guiFields[this.name + "#Color"] = this.color;
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
      this.color = color;
      let c = new THREE.Vector3(color[0] / 255, color[1] / 255, color[2] / 255);
      this.mesh.material.uniforms.color.value = c;
    }

    getColor() {
      return this.color;
    }

    setRadius(rad) {
      this.mesh.material.uniforms.scale.value = rad;

      if (this.gp.doPicks) this.pickMesh.material.uniforms.scale.value = rad;
    }

    setEnabled(enabled) {
      this.guiFields[this.name + "#Enabled"] = enabled;
      this.enabled = enabled;
      if (enabled) {
        let enabledQuantity = false;
        for (let q in this.quantities) {
          if (this.quantities[q].enabled) {
            this.gp.scene.add(this.quantities[q].mesh);
            enabledQuantity = true;
          }
        }
        if (!enabledQuantity) {
          this.gp.scene.add(this.mesh);
        }
        if (this.gp.doPicks) this.gp.pickScene.add(this.pickMesh);
      } else {
        for (let q in this.quantities) {
          this.gp.scene.remove(this.quantities[q].mesh);
        }
        this.gp.scene.remove(this.mesh);
        if (this.gp.doPicks) this.gp.pickScene.remove(this.pickMesh);
      }
    }

    enableQuantity(q) {
      if (q.isDominantQuantity) {
        for (let pName in this.quantities) {
          let p = this.quantities[pName];
          if (p.isDominantQuantity && pName != q.name) {
            this.guiFields[p.prefix + "#Enabled"] = false;
            p.enabled = false;
            this.gp.scene.remove(p.mesh);
          }
        }
      }

      if (this.enabled) {
        if (q.isDominantQuantity) {
          this.gp.scene.remove(this.mesh);
        }
        this.gp.scene.add(q.mesh);
      }
    }

    disableQuantity(q) {
      if (this.enabled) {
        this.gp.scene.remove(q.mesh);
        this.gp.scene.add(this.mesh);
      }
    }

    remove() {
      for (let q in this.quantities) {
        this.gp.scene.remove(this.quantities[q].mesh);
        this.quantities[q].remove();
      }
      this.quantities = {};
    }

    constructThreeMesh(coords) {
      let sphereGeometry = new THREE.IcosahedronGeometry(0.025, 2);

      // create matcap material
      let matcapMaterial = createInstancedMatCapMaterial(
        this.gp.matcapTextures.r,
        this.gp.matcapTextures.g,
        this.gp.matcapTextures.b,
        this.gp.matcapTextures.k
      );

      // create mesh
      let threeMesh = new THREE.InstancedMesh(sphereGeometry, matcapMaterial, this.nV);

      // set instance positions
      let mat = new THREE.Matrix4();
      new Float32Array(3 * this.nV);
      for (let iV = 0; iV < this.nV; iV++) {
        let pos = coords[iV];
        mat.setPosition(pos[0], pos[1], pos[2]);
        threeMesh.setMatrixAt(iV, mat);
      }

      return threeMesh;
    }

    pickElement(localInd) {
      this.gp.setDataHeader(`Point Cloud ${this.name}`, `Vertex ${localInd}`);

      this.gp.clearDataFields();
      this.gp.showDataField(
        "position",
        this.gp.prettyVector(this.coords[localInd])
      );

      for (let qName in this.quantities) {
        let qVal = this.quantities[qName].getVertexValue(localInd);
        if (qVal) {
          this.gp.showDataField(qName, qVal);
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
    constructor(
      vertices,
      segments,
      maxLen,
      name,
      geopticEnvironment,
      options = {}
    ) {
      this.gp = geopticEnvironment;
      this.res = 12;
      this.color = options.color || getNextUniqueColor();

      [
        this.mesh,
        this.tubeMesh,
        this.pointMesh,
      ] = this.constructThreeCurveNetwork(vertices, segments, maxLen);

      this.nV = vertices.length;
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
        this.gp.scene.add(this.mesh);
      } else {
        this.gp.scene.remove(this.mesh);
      }
    }

    remove() {
      for (let q in this.quantities) {
        this.gp.scene.remove(this.quantities[q].mesh);
        this.quantities[q].remove();
      }
      this.quantities = {};
    }

    updateVertexPositions(newPositions) {
      const lengths = this.tubeMesh.geometry.attributes.len.array;
      let mat = new THREE.Matrix4();
      for (let iS = 0; iS < this.segments.length; iS++) {
        let start = this.gp.listToVec(newPositions[this.segments[iS][0]]);
        let end = this.gp.listToVec(newPositions[this.segments[iS][1]]);
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
      this.color = color;
      let c = new THREE.Vector3(color[0] / 255, color[1] / 255, color[2] / 255);
      this.tubeMesh.material.uniforms.color.value = c;
      this.pointMesh.material.uniforms.color.value = c;
    }

    getColor() {
      return this.color;
    }

    setEdgeWidth(width) {
      this.tubeMesh.material.uniforms.rad.value = width / 100;
      this.pointMesh.material.uniforms.scale.value = width / 100;
    }

    initGui(guiFields, guiFolder) {
      this.guiFields = guiFields;
      this.guiFolder = guiFolder;

      let objectGuiList = guiFolder.domElement.firstChild;
      let meshInfoBox = document.createElement("li");
      meshInfoBox.classList.add("dat-info-box");
      objectGuiList.appendChild(meshInfoBox);
      let vertexInfo = document.createElement("span");
      vertexInfo.innerHTML = "#verts: " + this.nV;
      let faceInfo = document.createElement("span");
      faceInfo.innerHTML = "   #edges: " + this.segments.length;
      meshInfoBox.appendChild(vertexInfo);
      meshInfoBox.appendChild(faceInfo);

      guiFields[this.name + "#Enabled"] = true;
      guiFolder
        .add(guiFields, this.name + "#Enabled")
        .onChange((e) => {
          this.setEnabled(e);
        })
        .listen()
        .name("Enabled");

      guiFields[this.name + "#Color"] = this.color;
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
        this.gp.matcapTextures.r,
        this.gp.matcapTextures.g,
        this.gp.matcapTextures.b,
        this.gp.matcapTextures.k
      );
      tubeMaterial.uniforms.rad.value = 0.05;
      let sphereMaterial = createInstancedMatCapMaterial(
        this.gp.matcapTextures.r,
        this.gp.matcapTextures.g,
        this.gp.matcapTextures.b,
        this.gp.matcapTextures.k
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
        let start = this.gp.listToVec(vertices[segments[iS][0]]);
        let end = this.gp.listToVec(vertices[segments[iS][1]]);
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

      return [curve, tubeMesh, pointMesh];
    }
  }

  // https://stackoverflow.com/a/34452130
  dat_gui_module_js.GUI.prototype.removeFolder = function (name) {
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
    constructor(options = {}) {
      if (!WebGL_js.WEBGL.isWebGLAvailable()) alert(WebGL_js.WEBGL.getWebGLErrorMessage());

      this.geopticPath = options.path || "js/geoptic.js";

      this.parent = options.parent || document.body;

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

      this.commandGui = new dat_gui_module_js.GUI({ resizeable: true });
      this.commandGuiFields = {};
      let commandGuiWrapper = document.createElement("div");
      this.parent.appendChild(commandGuiWrapper);
      commandGuiWrapper.id = "command-gui";
      commandGuiWrapper.appendChild(this.commandGui.domElement);

      this.groundPlane = undefined;

      this.onMeshLoad = (text) => {};
      this.userCallback = () => {};

      this.sceneMin = new THREE.Vector3(0, 0, 0);
      this.sceneMax = new THREE.Vector3(0, 0, 0);

      // If options.picks is set, do whatever that says. Otherwise, enable picks
      this.doPicks =
        (options.hasOwnProperty("picks") && options.picks) ||
        !options.hasOwnProperty("picks");

      this.init();
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

      this.initDOM();

      this.stats = new Stats__default['default']();
      // Place stats in corner of this.container, rather than always placing at the top-left corner of the page
      this.stats.dom.style.position = "absolute";
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

      this.render();
    }

    initDOM() {
      this.container = document.createElement("div");
      this.container.style.height = "100%";
      this.container.style.overflow = "hidden";
      this.container.style.position = "relative";
      this.parent.appendChild(this.container);

      if (this.doPicks) {
        // <div id="selection-info">
        //     <div id="info-head">
        //         <div id="info-head-structure"></div>
        //         <div id="info-head-name"></div>
        //     </div>
        //     <div id="info-body">
        //         <div id="info-body-field-names"></div>
        //         <div id="info-body-field-values"></div>
        //     </div>
        // </div>
        let selectionInfo = document.createElement("div");
        selectionInfo.id = "selection-info";
        let infoHeader = document.createElement("div");
        infoHeader.id = "info-head";
        let infoHeadStructure = document.createElement("div");
        infoHeadStructure.id = "info-head-structure";
        let infoHeadName = document.createElement("div");
        infoHeadName.id = "info-head-name";
        let infoBody = document.createElement("div");
        infoBody.id = "info-body";
        let infoBodyName = document.createElement("div");
        infoBodyName.id = "info-body-field-names";
        let infoBodyValues = document.createElement("div");
        infoBodyValues.id = "info-body-field-values";

        infoBody.appendChild(infoBodyName);
        infoBody.appendChild(infoBodyValues);
        infoHeader.appendChild(infoHeadStructure);
        infoHeader.appendChild(infoHeadName);
        selectionInfo.appendChild(infoHeader);
        selectionInfo.appendChild(infoBody);
        this.container.appendChild(selectionInfo);
      }

      // <div id="messages"><div></div></div>
      let messagePanel = document.createElement("div");
      messagePanel.id = "messages";
      this.container.appendChild(messagePanel);
    }

    initGroundPlane() {
      let tex = new THREE.TextureLoader().load(
        this.geopticPath + "/img/concrete.png"
      );
      this.groundPlane = new Reflector_js.Reflector(new THREE.PlaneGeometry(100, 100), {
        clipBias: 0.003,
        textureWidth: this.parent.offsetWidth * window.devicePixelRatio,
        textureHeight: this.parent.offsetHeight * window.devicePixelRatio,
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

      this.stripeTexture = new THREE.TextureLoader().load(
        this.geopticPath + "/img/stripes.png"
      );
    }

    initRenderer(container) {
      this.renderer = new THREE.WebGLRenderer({
        antialias: true,
      });
      this.renderer.setPixelRatio(window.devicePixelRatio);
      this.renderer.setClearColor(0xffffff, 1.0);
      this.renderer.setSize(this.parent.offsetWidth, this.parent.offsetHeight);
      this.container.appendChild(this.renderer.domElement);

      if (this.doPicks) {
        this.pickRenderer = new THREE.WebGLRenderer({
          antialias: false, // turn antialiasing off for color based picking
        });
        this.pickRenderer.setPixelRatio(window.devicePixelRatio);
        this.pickRenderer.setClearColor(0xffffff, 1.0);
        this.pickRenderer.setSize(
          this.parent.offsetWidth,
          this.parent.offsetHeight
        );
        // TODO: do I need to do this?
        container.appendChild(this.pickRenderer.domElement);
      }
    }

    initGUI() {
      this.structureGui = new dat_gui_module_js.GUI({ autoPlace: false, resizeable: true });

      let structureGuiWrapper = document.createElement("div");
      this.parent.appendChild(structureGuiWrapper);
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
      const aspect = this.parent.offsetWidth / this.parent.offsetHeight;
      const near = 0.01;
      const far = 1000;
      const eyeZ = 3.5;

      this.camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
      this.camera.position.z = eyeZ;
    }

    initScene() {
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0xffffff);

      if (this.doPicks) {
        this.pickScene = new THREE.Scene();
        this.pickScene.background = new THREE.Color(0xffffff);
      }
    }

    initLights() {
      let ambient = new THREE.AmbientLight(0xffffff, 0.35);
      this.camera.add(ambient);

      let point = new THREE.PointLight(0xffffff);
      point.position.set(2, 20, 15);
      this.camera.add(point);

      this.scene.add(this.camera);
    }

    registerSurfaceMesh(name, vertexCoordinates, faces, scale = 1) {
      vertexCoordinates = standardizeVector3Array(vertexCoordinates);
      faces = standardizeFaceArray(faces);

      if (!this.structureGuiMeshes) {
        this.structureGuiMeshes = this.structureGui.addFolder("Surface Meshes");
        this.structureGuiMeshes.open();
      }

      // If there's an existing strucure with this name,
      // copy its properties and delete it
      const options = {};
      if (this.surfaceMeshes[name]) {
        options.color = this.surfaceMeshes[name].getColor();
        this.deregisterSurfaceMesh(name);
      }

      let meshStructure = new SurfaceMesh(
        vertexCoordinates,
        faces,
        name,
        this,
        options
      );
      this.surfaceMeshes[name] = meshStructure;

      let meshGui = this.structureGuiMeshes.addFolder(name);

      meshStructure.initGui(this.structureGuiFields, meshGui);

      this.scene.add(meshStructure.mesh);
      if (this.doPicks) this.pickScene.add(meshStructure.pickMesh);

      let bbox = new THREE.Box3().setFromObject(meshStructure.mesh);

      this.sceneMin.min(bbox.min);
      this.sceneMax.max(bbox.max);

      let oldPos = this.groundPlane.position;
      this.groundPlane.translateZ(this.sceneMin.y - oldPos.y, 1);

      return meshStructure;
    }

    registerCurveNetwork(name, vertexCoordinates, edges) {
      vertexCoordinates = standardizeVector3Array(vertexCoordinates);

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
      } else {
        edges = standardizeFaceArray(edges);
      }

      // TODO: allocate extra space?
      let maxLen = vertexCoordinates.length;

      // If there's an existing strucure with this name,
      // copy its properties and delete it
      const options = {};
      if (this.curveNetworks[name]) {
        options.color = this.curveNetworks[name].getColor();
        this.deregisterCurveNetwork(name);
      }

      let curveStructure = new CurveNetwork(
        vertexCoordinates,
        edges,
        maxLen,
        name,
        this,
        options
      );
      this.curveNetworks[name] = curveStructure;

      let curveGui = this.structureGuiCurveNetworks.addFolder(name);
      curveStructure.initGui(this.structureGuiFields, curveGui);

      this.scene.add(curveStructure.mesh);

      return curveStructure;
    }

    registerPointCloud(name, vertexCoordinates) {
      vertexCoordinates = standardizeVector3Array(vertexCoordinates);
      if (!this.structureGuiPointClouds) {
        this.structureGuiPointClouds = this.structureGui.addFolder(
          "Point Clouds"
        );
        this.structureGuiPointClouds.open();
      }

      // If there's an existing strucure with this name,
      // copy its properties and delete it
      const options = {};
      if (this.pointClouds[name]) {
        options.color = this.pointClouds[name].getColor();
        this.deregisterPointCloud(name);
      }

      let cloudStructure = new PointCloud(vertexCoordinates, name, this, options);
      this.pointClouds[name] = cloudStructure;

      let cloudGui = this.structureGuiPointClouds.addFolder(name);
      cloudStructure.initGui(this.structureGuiFields, cloudGui);

      this.scene.add(cloudStructure.mesh);
      if (this.doPicks) this.pickScene.add(cloudStructure.pickMesh);

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

    deregisterPointCloud(name) {
      if (!(name in this.pointClouds)) return;

      this.structureGuiPointClouds.removeFolder(name);
      this.pointClouds[name].remove();
      this.scene.remove(this.pointClouds[name].mesh);
      delete this.pointClouds[name];
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

    setDataHeader(structure, name) {
      document.getElementById("info-head-structure").innerHTML = structure;
      document.getElementById("info-head-name").innerHTML = name;
    }

    pick(clickX, clickY) {
      const rect = this.parent.getBoundingClientRect();

      const pickResult = evaluatePickQuery(
        this.pickRenderer,
        this.pickScene,
        this.camera,
        clickX - rect.left,
        clickY - rect.top,
        rect.width,
        rect.height
      );
      if (pickResult.structure) {
        pickResult.structure.pickElement(pickResult.localInd);
      }
    }

    addEventListeners() {
      window.addEventListener("resize", this.onWindowResize.bind(this), false);

      if (this.doPicks) {
        // attacking the eventListener to the renderer instead of the window ensures
        // that clicking on the GUI doesn't trigger geoptic's mouseClick handler
        this.renderer.domElement.addEventListener(
          "click",
          this.onMouseClick.bind(this),
          false
        );
      }
    }

    onWindowResize() {
      this.camera.aspect = this.parent.offsetWidth / this.parent.offsetHeight;
      this.camera.updateProjectionMatrix();

      this.renderer.setSize(this.parent.offsetWidth, this.parent.offsetHeight);
      this.controls.handleResize();
      this.render();
    }

    onMouseClick(event) {
      if (
        event.clientX >= 0 &&
        event.clientX <= this.parent.offsetWidth &&
        event.clientY >= 0 &&
        event.clientY <= this.parent.offsetHeight
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
      let width = this.parent.offsetWidth;

      this.renderer.setViewport(0.0, 0.0, width, this.parent.offsetHeight);
      this.renderer.setScissor(0.0, 0.0, width, this.parent.offsetHeight);
      this.renderer.setScissorTest(true);
      this.renderer.render(this.scene, this.camera);
    }

    message(str) {
      let messageBuffer = document.getElementById("messages");
      let message = document.createElement("div");
      messageBuffer.insertBefore(message, messageBuffer.firstChild);
      message.innerHTML = str;
    }

    startLoading() {
      console.log("start loading!");
      document.getElementById("spinner").style.display = "inline-block";
    }

    doneLoading() {
      document.getElementById("spinner").style.display = "none";
    }

    slowFunction(f) {
      this.startLoading();
      setTimeout(
        function () {
          f();
          this.doneLoading();
        }.bind(this),
        1
      );
    }

    prettyScalar(d) {
      return d.toFixed(5);
    }

    prettyVector2(vec) {
      if (vec.x) {
        return "(" + vec.x.toFixed(2) + ", " + vec.y.toFixed(2) + ")";
      } else {
        return "(" + vec[0].toFixed(2) + ", " + vec[1].toFixed(2) + ")";
      }
    }

    prettyVector(vec) {
      if (vec.x) {
        return (
          "(" +
          vec.x.toFixed(2) +
          ", " +
          vec.y.toFixed(2) +
          ", " +
          vec.z.toFixed(2) +
          ")"
        );
      } else {
        return (
          "(" +
          vec[0].toFixed(2) +
          ", " +
          vec[1].toFixed(2) +
          ", " +
          vec[2].toFixed(2) +
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
