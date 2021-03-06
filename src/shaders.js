import {
  ShaderMaterial,
  DoubleSide,
  Vector3,
} from "https://unpkg.com/three@0.125.1/build/three.module.js";

let matcapIncludes = `
        uniform sampler2D Matcap_rgbk; // Matcap texture
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

            // pull slightly inward, to reduce sampling artifacts near edges
            // Then divide by 4 to get a coordinate in [-0.25, 0.25]
            vec2 uv = 0.93 * Normal * 0.25;

            vec4 mat_r = sRGBToLinear(texture2D(Matcap_rgbk, uv + vec2(0.25, 0.75)));
            vec4 mat_g = sRGBToLinear(texture2D(Matcap_rgbk, uv + vec2(0.75, 0.75)));
            vec4 mat_b = sRGBToLinear(texture2D(Matcap_rgbk, uv + vec2(0.25, 0.25)));
            vec4 mat_k = sRGBToLinear(texture2D(Matcap_rgbk, uv + vec2(0.75, 0.25)));

            vec4 colorCombined = color.r * mat_r + color.g * mat_g + color.b * mat_b +
                                (1. - color.r - color.g - color.b) * mat_k;

            return LinearTosRGB( colorCombined );
        }
`;

function createMatCapMaterial(tex_rgbk) {
  let vertexShader = `
        attribute vec3 barycoord;

        varying vec3 vNormal;
        varying vec3 Barycoord;

        void main()
        {
            vNormal = ( mat3( modelViewMatrix ) * normal );

            Barycoord = barycoord;

            gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

        }
    `;

  let fragmentShader = `
        ${matcapIncludes}
        uniform vec3 color;
        uniform vec3 edgeColor;
        uniform float edgeWidth;

        varying vec3 vNormal;
        varying vec3 Barycoord;

        ${common}

        void main(void){
            float alpha = getEdgeFactor(Barycoord, vec3(1.,1.,1.), edgeWidth);
            gl_FragColor = lightSurfaceMat((1.-alpha) * color + alpha * edgeColor, normalize(vNormal).xy);
        }
    `;

  let Material = new ShaderMaterial({
    uniforms: {
      Matcap_rgbk: { value: tex_rgbk },
      color: { value: new Vector3(1, 0, 1) },
      edgeColor: { value: new Vector3(0, 0, 0) },
      edgeWidth: { value: 0 },
    },
    vertexShader,
    fragmentShader,
  });
  Material.side = DoubleSide;

  return Material;
}

function createVertexScalarFunctionMaterial(tex_rgbk) {
  let vertexShader = `
        attribute vec3 barycoord;
        attribute float value;

        varying vec3 vNormal;
        varying vec3 Barycoord;
        varying float Value;

        void main()
        {
            vNormal = ( mat3( modelViewMatrix ) * normal );
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

        varying vec3 vNormal;
        varying vec3 Barycoord;
        varying float Value;

        ${common}

        void main(void){
            float alpha = getEdgeFactor(Barycoord, vec3(1.,1.,1.), edgeWidth);
            vec3 Color = sRGBToLinear(texture2D(colormap, vec2(Value, 0.5))).rgb;
            gl_FragColor = lightSurfaceMat((1.-alpha) * Color + alpha * edgeColor, normalize(vNormal).xy);
        }
    `;
  let Material = new ShaderMaterial({
    uniforms: {
      Matcap_rgbk: { value: tex_rgbk },
      colormap: { value: undefined },
      edgeColor: { value: new Vector3(0, 0, 0) },
      edgeWidth: { value: 0 },
    },
    vertexShader,
    fragmentShader,
  });
  Material.side = DoubleSide;

  return Material;
}

function createVertexDistanceFunctionMaterial(tex_rgbk) {
  let vertexShader = `
        attribute vec3 barycoord;
        attribute float value;

        varying vec3 vNormal;
        varying vec3 Barycoord;
        varying float Value;

        void main()
        {
            vNormal = ( mat3( modelViewMatrix ) * normal );
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

        varying vec3 vNormal;
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
            gl_FragColor = lightSurfaceMat((1.-alpha) * outColor + alpha * edgeColor, normalize(vNormal).xy);
        }
    `;
  let Material = new ShaderMaterial({
    uniforms: {
      Matcap_rgbk: { value: tex_rgbk },
      colormap: { value: undefined },
      edgeColor: { value: new Vector3(0, 0, 0) },
      edgeWidth: { value: 0 },
      scale: { value: 1 },
      offset: { value: 0.2 },
    },
    vertexShader,
    fragmentShader,
  });
  Material.side = DoubleSide;

  return Material;
}

function VertexParamCheckerboard(tex_rgbk) {
  let vertexShader = `
        attribute vec3 barycoord;
        attribute vec2 coord;

        varying vec3 vNormal;
        varying vec3 Barycoord;
        varying vec2 Coord;

        void main()
        {
            vNormal = ( mat3( modelViewMatrix ) * normal );
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

        varying vec3 vNormal;
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

            gl_FragColor = lightSurfaceMat((1.-alpha) * outColor + alpha * edgeColor, normalize(vNormal).xy);

        }
    `;

  let Material = new ShaderMaterial({
    uniforms: {
      Matcap_rgbk: { value: tex_rgbk },
      edgeColor: { value: new Vector3(0, 0, 0) },
      edgeWidth: { value: 0 },
      color1: { value: new Vector3(1, 1, 0) },
      color2: { value: new Vector3(0, 1, 1) },
      paramScale: { value: 1 },
    },
    vertexShader,
    fragmentShader,
  });
  Material.side = DoubleSide;

  return Material;
}

function VertexParamGrid(tex_rgbk) {
  let vertexShader = `
        attribute vec3 barycoord;
        attribute vec2 coord;

        varying vec3 vNormal;
        varying vec3 Barycoord;
        varying vec2 Coord;

        void main()
        {
            vNormal = ( mat3( modelViewMatrix ) * normal );
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

        varying vec3 vNormal;
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

            gl_FragColor = lightSurfaceMat((1.-alpha) * outColor + alpha * edgeColor, normalize(vNormal).xy);

        }
    `;

  let Material = new ShaderMaterial({
    uniforms: {
      Matcap_rgbk: { value: tex_rgbk },
      edgeColor: { value: new Vector3(0, 0, 0) },
      edgeWidth: { value: 0 },
      color1: { value: new Vector3(1, 1, 0) },
      color2: { value: new Vector3(0, 1, 1) },
      paramScale: { value: 1 },
    },
    vertexShader,
    fragmentShader,
  });
  Material.side = DoubleSide;

  return Material;
}

function VertexParamTartan(tex_rgbk) {
  let vertexShader = `
        attribute vec3 barycoord;
        attribute vec2 coord;

        varying vec3 vNormal;
        varying vec3 Barycoord;
        varying vec2 Coord;

        void main()
        {
            vNormal = ( mat3( modelViewMatrix ) * normal );

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

        varying vec3 vNormal;
        varying vec3 Barycoord;
        varying vec2 Coord;

        ${common}

        void STRIPE(float x, float y, float center, float width, inout float bumpHeight,
                    inout vec3 oldcolor, vec3 newcolor, bool shift) {
            float sWidth = 0.05;
            float stripe_coord = mod(x - y + sWidth*0.25, sWidth);
            float slopeWidthPix = 5.;
            vec2 fw = fwidth(Coord);
            float scale = max(fw.x, fw.y);
            float pWidth = slopeWidthPix * scale;

            float stripeD = abs(stripe_coord - 0.5*sWidth);
            float t = smoothstep(0.25*sWidth-pWidth, 0.25*sWidth+pWidth, stripeD);
            if (shift) t = 1.-t;

            float minDx = min(abs(x-center), abs(x-(1.-center)));
            float sx = min(width / pWidth, 1.)*(1.-smoothstep(width-pWidth, width + pWidth, minDx));
            vec3 newcolorx = (1.-sx)*oldcolor + (sx)* newcolor;
            float bumpHeightx = sqrt(1.-(1.-sx)*pow(abs(minDx / width), 0.5));

            float minDy = min(abs(y-center), abs(y-(1.-center)));
            float sy = min(width / pWidth, 1.)*(1.-smoothstep(width-pWidth, width + pWidth, minDy));
            vec3 newcolory = (1.-sy)*oldcolor + (sy)* newcolor;
            float bumpHeighty = sqrt(1.-(1.-sy)*pow(abs(minDy / width), 0.5));

            bumpHeight *= (t * bumpHeightx + (1.-t)*bumpHeighty);
            oldcolor = t * newcolorx + (1.-t) * newcolory;

        }

        void base_stripe_bumps(float x, float y, inout float bumpHeight) {
            float sWidth = 0.05;
            float stripe_coord = mod(x - y, sWidth) / sWidth;

            float minD = min(abs(stripe_coord), min(abs(1.-stripe_coord), abs(stripe_coord-0.5)));
            bumpHeight *= sqrt(1. - pow(abs(minD/0.23) , 0.5));
        }

        void main(void){
            float alpha = getEdgeFactor(Barycoord, vec3(1.,1.,1.), edgeWidth);

            // // Works correctly on negative x, y
            // float modX = Coord.x - floor(Coord.x);
            // float modY = Coord.y - floor(Coord.y);
            // Apply the checkerboard effect
            float mX = mod(Coord.x, 2.*paramScale) / (2.*paramScale); // in [0, 1]
            float mY = mod(Coord.y, 2.*paramScale) / (2.*paramScale);

            vec3 blue = vec3(18.0 / 255., 18.0 / 255., 80.0 / 255.);
            vec3 green = vec3(0.00, 0.40, 0.20);
            vec3 dark_green = vec3(0.00, 0.10, 0.10);
            vec3 dark = vec3(0.00, 0.02, 0.13);
            vec3 red = vec3(0.80, 0.00, 0.00);
            vec3 yellow = vec3(1.00, 0.70, 0.00);

            vec3 outColor = dark_green;

            float bumpHeight = 1.;
            // base_stripe_bumps(mX, mY, bumpHeight);
            STRIPE(mX, mY, 0.000, 1.000, bumpHeight, outColor, blue, true);
            STRIPE(mX, mY, 0.000, 0.225, bumpHeight, outColor, dark_green, false);
            STRIPE(mX, mY, 0.000, 0.225, bumpHeight, outColor, green, true);
            STRIPE(mX, mY, 0.275, 0.050, bumpHeight, outColor, dark, false);
            STRIPE(mX, mY, 0.150, 0.020, bumpHeight, outColor, red, true);
            STRIPE(mX, mY, 0.110, 0.004, bumpHeight, outColor, red, true);
            STRIPE(mX, mY, 0.325, 0.004, bumpHeight, outColor, red, true);
            STRIPE(mX, mY, 0.420, 0.020, bumpHeight, outColor, red, true);
            STRIPE(mX, mY, 0.460, 0.004, bumpHeight, outColor, red, true);
            STRIPE(mX, mY, 0.000, 0.010, bumpHeight, outColor, yellow, true);

            // TODO: get bump map working
            // float dbdx = dFdx(bumpHeight);
            // float dbdy = dFdy(bumpHeight);
            // float s = smoothstep(0.15, 0., abs(dbdx) + abs(dbdy));
            // vec3 bumpedNormal = normalize(vNormal - 5.*s*vec3(dbdx, dbdy, 0.));
            vec3 bumpedNormal = normalize(vNormal);

            // pull slightly inward, to reduce sampling artifacts near edges
            // vec2 vNormalBetter = vec2(0.9 * bumpedNormal.x * 0.5 + 0.5,
            //                   0.9 * bumpedNormal.y * 0.5 + 0.5);

            gl_FragColor = lightSurfaceMat((1.-alpha) * outColor + alpha * edgeColor, normalize(vNormal).xy);

        }
    `;

  let Material = new ShaderMaterial({
    uniforms: {
      Matcap_rgbk: { value: tex_rgbk },
      edgeColor: { value: new Vector3(0, 0, 0) },
      edgeWidth: { value: 0 },
      color1: { value: new Vector3(1, 1, 0) },
      color2: { value: new Vector3(0, 1, 1) },
      paramScale: { value: 1 },
    },
    vertexShader,
    fragmentShader,
  });
  Material.side = DoubleSide;

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

        vec4 mat = vec4(texture2D(tex, 9.*TextureUV).rgb * 0.55 + 0.45, 1.);
        vec4 base = texture2DProj( tDiffuse, vUv);
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

  let Material = new ShaderMaterial({
    vertexShader,
    fragmentShader,
  });

  Material.side = DoubleSide;
  return Material;
}

function createInstancedMatCapMaterial(tex_rgbk) {
  let vertexShader = `
        uniform float scale;
        varying vec3 vNormal;

        void main()
        {
            vNormal = (modelViewMatrix * instanceMatrix * vec4(normal, 0.)).xyz;
            gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4( scale * position, 1.0 );

        }
    `;

  let fragmentShader = `
        ${matcapIncludes}
        uniform vec3 color;

        varying vec3 vNormal;

        ${common}

        void main(void){
            gl_FragColor = lightSurfaceMat(color, normalize(vNormal).xy);
        }
    `;

  let Material = new ShaderMaterial({
    uniforms: {
      Matcap_rgbk: { value: tex_rgbk },
      color: { value: new Vector3(1, 0, 1) },
      scale: { value: 1 },
    },
    vertexShader,
    fragmentShader,
  });

  Material.side = DoubleSide;
  return Material;
}

function createInstancedScalarFunctionMaterial(tex_rgbk) {
  let vertexShader = `
        uniform float scale;
        attribute float value;

        varying float Value;
        varying vec3 vNormal;

        void main()
        {
            vNormal = (modelViewMatrix * instanceMatrix * vec4(normal, 0.)).xyz;

            Value = value;

            gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4( scale * position, 1.0 );

        }
    `;

  let fragmentShader = `
        ${matcapIncludes}
        uniform sampler2D colormap; // colormap

        varying float Value;
        varying vec3 vNormal;

        ${common}

        void main(void){
            vec3 Color = sRGBToLinear(texture2D(colormap, vec2(Value, 0.5))).rgb;
            gl_FragColor = lightSurfaceMat(Color, normalize(vNormal).xy);
        }
    `;

  let Material = new ShaderMaterial({
    uniforms: {
      Matcap_rgbk: { value: tex_rgbk },
      colormap: { value: undefined },
      scale: { value: 1 },
    },
    vertexShader,
    fragmentShader,
  });

  Material.side = DoubleSide;
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

  let Material = new ShaderMaterial({
    vertexShader,
    fragmentShader,
  });

  // Material.side = DoubleSide;
  return Material;
}

function createCurveMatCapMaterial(tex_rgbk) {
  let vertexShader = `
        uniform float rad;
        attribute float len;

        varying vec3 vNormal;

        void main()
        {
            vNormal = (modelViewMatrix * instanceMatrix * vec4(normal, 0.)).xyz;

            vec3 scaled_position = vec3(position.x * rad, position.y*rad, position.z*len);
            gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4( scaled_position, 1.0 );

        }
    `;

  let fragmentShader = `
        ${matcapIncludes}
        uniform vec3 color;

        varying vec3 vNormal;

        ${common}

        void main(void){
            gl_FragColor = lightSurfaceMat(color, normalize(vNormal).xy);
        }
    `;

  let Material = new ShaderMaterial({
    uniforms: {
      Matcap_rgbk: { value: tex_rgbk },
      color: { value: new Vector3(1, 0, 1) },
      rad: { value: 1 },
    },
    vertexShader,
    fragmentShader,
  });

  Material.side = DoubleSide;
  return Material;
}

export {
  createMatCapMaterial,
  createInstancedMatCapMaterial,
  createVertexScalarFunctionMaterial,
  createVertexDistanceFunctionMaterial,
  VertexParamCheckerboard,
  VertexParamGrid,
  VertexParamTartan,
  createInstancedScalarFunctionMaterial,
  createSurfaceMeshPickMaterial,
  createPointCloudPickMaterial,
  createCurveMatCapMaterial,
  groundPlaneVertexShader,
  groundPlaneFragmentShader,
};
