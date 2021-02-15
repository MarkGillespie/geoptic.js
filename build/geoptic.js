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
        uniform sampler2D colormap; // colormap
        uniform vec3 edgeColor;
        uniform float edgeWidth;

        varying vec2 Point;
        varying vec3 Barycoord;
        varying float Value;

        ${common}

        void main(void){
            float alpha = getEdgeFactor(Barycoord, vec3(1.,1.,1.), edgeWidth);
            vec3 Color = sRGBToLinear(texture2D(colormap, vec2(Value, 0.5))).rgb;
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
        uniform sampler2D colormap; // colormap
        uniform vec3 edgeColor;
        uniform float edgeWidth;
        uniform float scale;
        uniform float offset;

        varying vec2 Point;
        varying vec3 Barycoord;
        varying float Value;

        ${common}

        void main(void){
            float v1 = Value * (1.-offset);
            float v2 = Value * (1.-offset) + offset;

            vec3 color1 = sRGBToLinear(texture2D(colormap, vec2(v1, 0.5))).rgb;
            vec3 color2 = sRGBToLinear(texture2D(colormap, vec2(v2, 0.5))).rgb;

            // Apply the stripe effect
            float mX = mod(Value * 2.*scale, 2.)  - 1.f; // in [-1, 1]

            float p = 6.;
            float minDSmooth = pow(mX, 1. / p);
            // TODO do some clever screen space derivative thing to prevent aliasing

            float adjV = sign(mX) * minDSmooth;

            float s = smoothstep(-1.f, 1.f, adjV);

            vec3 outColor = (1.-s)*color1 + s* color2;

            float alpha = getEdgeFactor(Barycoord, vec3(1.,1.,1.), edgeWidth);
            gl_FragColor = lightSurfaceMat((1.-alpha) * outColor + alpha * edgeColor, Point);
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
        offset: { value: 0.2 },
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
        attribute float value;

        varying float Value;
        varying vec2 Point;

        void main()
        {
            vec3 vNormal = (modelViewMatrix * instanceMatrix * vec4(normal, 0.)).xyz;
            vNormal = normalize(vNormal);

            // pull slightly inward, to reduce sampling artifacts near edges
            Point.x = 0.93 * vNormal.x * 0.5 + 0.5;
            Point.y = 0.93 * vNormal.y * 0.5 + 0.5;

            Value = value;

            gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4( scale * position, 1.0 );

        }
    `;

    let fragmentShader = `
        ${matcapIncludes}
        uniform sampler2D colormap; // colormap

        varying float Value;
        varying vec2 Point;

        ${common}

        void main(void){
            vec3 Color = sRGBToLinear(texture2D(colormap, vec2(Value, 0.5))).rgb;
            gl_FragColor = lightSurfaceMat(Color, Point);
        }
    `;

    let Material = new THREE.ShaderMaterial({
      uniforms: {
        Matcap_r: { value: tex_r },
        Matcap_g: { value: tex_g },
        Matcap_b: { value: tex_b },
        Matcap_k: { value: tex_k },
        colormap: { value: undefined },
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
      this.initializeFunctionValues();

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

    initializeFunctionValues() {
      let F = this.parent.faces.length;
      let vals = new Float32Array(F * 3);

      for (let iF = 0; iF < F; iF++) {
        let face = this.parent.faces[iF];
        for (let iV = 0; iV < 3; iV++) {
          let val = this.values[face[iV]];
          val = (val - this.dataMin) / (this.dataMax - this.dataMin);
          vals[3 * iF + iV] = val;
        }
      }

      this.mesh.geometry.setAttribute("value", new THREE.BufferAttribute(vals, 1));
    }

    applyColorMap(cm) {
      this.mesh.material.uniforms.colormap.value = new THREE.TextureLoader().load(
        this.gp.geopticPath + "/img/colormaps/" + cm + ".png"
      );
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
      this.gp = this.parent.gp;
      this.values = values;
      this.name = name;
      this.enabled = false;

      this.isDominantQuantity = true;

      [this.dataMin, this.dataMax] = computeMinMax(values);

      // create a new mesh material
      let functionMaterial = createInstancedScalarFunctionMaterial(
        this.gp.matcapTextures.r,
        this.gp.matcapTextures.g,
        this.gp.matcapTextures.b,
        this.gp.matcapTextures.k
      );

      // create mesh
      this.mesh = new THREE.InstancedMesh(
        this.parent.mesh.geometry.clone(),
        functionMaterial,
        this.parent.nV
      );

      // Copy some attributes from parent
      this.mesh.geometry.attributes.position = this.parent.mesh.geometry.attributes.position;
      this.mesh.geometry.attributes.normal = this.parent.mesh.geometry.attributes.normal;
      this.mesh.material.uniforms.scale = this.parent.mesh.material.uniforms.scale;
      this.mesh.instanceMatrix = this.parent.mesh.instanceMatrix;

      this.initializeFunctionValues();
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

    initializeFunctionValues() {
      let vals = new Float32Array(this.parent.nV * 3);

      for (let iV = 0; iV < this.parent.nV; iV++) {
        let val = this.values[iV];
        val = (val - this.dataMin) / (this.dataMax - this.dataMin);
        vals[iV] = val;
      }

      this.mesh.geometry.setAttribute(
        "value",
        new THREE.InstancedBufferAttribute(vals, 1)
      );
    }

    applyColorMap(cm) {
      this.mesh.material.uniforms.colormap.value = new THREE.TextureLoader().load(
        this.gp.geopticPath + "/img/colormaps/" + cm + ".png"
      );
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
      this.mesh.material.uniforms.colormap.value = new THREE.TextureLoader().load(
        this.gp.geopticPath + "/img/colormaps/RdPu.png"
      );
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

      guiFields[this.name + "#Stripes"] = 20;
      this.setStripes(guiFields[this.name + "#Stripes"]);
      guiFolder
        .add(guiFields, this.name + "#Stripes")
        .min(0)
        .max(50)
        .step(0.5)
        .onChange((stripes) => {
          this.setStripes(stripes);
        })
        .listen()
        .name("Stripes");

      guiFields[this.name + "#Offset"] = 0.2;
      this.setOffset(guiFields[this.name + "#Offset"]);
      guiFolder
        .add(guiFields, this.name + "#Offset")
        .min(0)
        .max(0.5)
        .step(0.05)
        .onChange((offset) => {
          this.setOffset(offset);
        })
        .listen()
        .name("Offset");

      guiFields[this.prefix + "#ColorMap"] = "rdpu";
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

    setStripes(stripes) {
      this.mesh.material.uniforms.scale.value = stripes;
    }

    setOffset(offset) {
      this.mesh.material.uniforms.offset.value = offset;
    }

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
      this.mesh.material.uniforms.colormap.value = new THREE.TextureLoader().load(
        this.gp.geopticPath + "/img/colormaps/" + cm + ".png"
      );
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
      this.container.style.overflow = "hidden";
      this.parent.appendChild(this.container);
      if (this.parent == document.body) {
        this.container.style.height = "100vh";
        this.container.style.width = "100vw";
        this.container.style.position = "absolute";
        this.container.style.left = 0;
        this.container.style.top = 0;
        this.container.style["z-index"] = 0;
        console.log(this.container);
      } else {
        this.container.style.height = "100%";
        this.container.style.position = "relative";
      }

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
        textureWidth: this.container.offsetWidth * window.devicePixelRatio,
        textureHeight: this.container.offsetHeight * window.devicePixelRatio,
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
      this.renderer.setSize(
        this.container.offsetWidth,
        this.container.offsetHeight
      );
      this.container.appendChild(this.renderer.domElement);

      if (this.doPicks) {
        this.pickRenderer = new THREE.WebGLRenderer({
          antialias: false, // turn antialiasing off for color based picking
        });
        this.pickRenderer.setPixelRatio(window.devicePixelRatio);
        this.pickRenderer.setClearColor(0xffffff, 1.0);
        this.pickRenderer.setSize(
          this.container.offsetWidth,
          this.container.offsetHeight
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
      const aspect = this.container.offsetWidth / this.container.offsetHeight;
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
      this.camera.aspect =
        this.container.offsetWidth / this.container.offsetHeight;
      this.camera.updateProjectionMatrix();

      this.renderer.setSize(
        this.container.offsetWidth,
        this.container.offsetHeight
      );
      this.controls.handleResize();
      this.render();
    }

    onMouseClick(event) {
      if (
        event.clientX >= 0 &&
        event.clientX <= this.container.offsetWidth &&
        event.clientY >= 0 &&
        event.clientY <= this.container.offsetHeight
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
      let width = this.container.offsetWidth;

      this.renderer.setViewport(0.0, 0.0, width, this.container.offsetHeight);
      this.renderer.setScissor(0.0, 0.0, width, this.container.offsetHeight);
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
