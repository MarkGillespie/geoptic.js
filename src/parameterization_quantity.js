import {
  BufferAttribute,
  InstancedBufferAttribute,
  IcosahedronGeometry,
  Vector3,
  Mesh,
  InstancedMesh,
  Color,
  Matrix4,
} from "https://unpkg.com/three@0.125.1/build/three.module.js";

import {
  VertexParamCheckerboard,
  VertexParamGrid,
  VertexParamTartan,
} from "./shaders.js";

class VertexParameterizationQuantity {
  constructor(name, coords, parentMesh, options = {}) {
    this.parent = parentMesh;
    this.gp = this.parent.gp;
    this.coords = coords;
    this.name = name;

    this.isDominantQuantity = true;

    // create a new mesh material
    let functionMaterial = VertexParamCheckerboard(
      this.gp.matcapTextures.r,
      this.gp.matcapTextures.g,
      this.gp.matcapTextures.b,
      this.gp.matcapTextures.k
    );

    // build a three.js mesh to visualize the function
    this.mesh = new Mesh(this.parent.mesh.geometry.clone(), functionMaterial);
    this.initParam(coords);

    // Copy some attributes from parent
    this.mesh.geometry.attributes.position = this.parent.mesh.geometry.attributes.position;
    this.mesh.geometry.attributes.normal = this.parent.mesh.geometry.attributes.normal;
    this.mesh.material.uniforms.edgeWidth = this.parent.mesh.material.uniforms.edgeWidth;
    this.mesh.material.uniforms.edgeColor = this.parent.mesh.material.uniforms.edgeColor;

    this.colorButtons = [];

    this.options = {
      enabled: false,
      style: "checker",
      color1: [249, 45, 94],
      color2: [249, 219, 225],
      scale: 1,
    };
    Object.assign(this.options, options);
    this.setOptions(this.options);
  }

  initGui(guiFolder) {
    guiFolder
      .add(this.options, "enabled")
      .onChange((e) => {
        this.setEnabled(e);
      })
      .listen()
      .name("Enabled");

    guiFolder
      .add(this.options, "style", ["checker", "grid", "tartan"])
      .onChange((s) => {
        this.setStyle(s);
      })
      .listen()
      .name("Color Map");

    const color1Button = guiFolder
      .addColor(this.options, "color1")
      .onChange((c) => {
        this.setColor1(c);
      })
      .listen()
      .name("Color");
    let row = color1Button.domElement.closest("li");
    this.colorButtons.push(row);

    const color2Button = guiFolder
      .addColor(this.options, "color2")
      .onChange((c) => {
        this.setColor2(c);
      })
      .listen()
      .name("Color");
    row = color2Button.domElement.closest("li");
    this.colorButtons.push(row);

    const scaleInput = guiFolder
      .add(this.options, "scale")
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
    this.options.scale = scale;
    this.mesh.material.uniforms.paramScale.value = scale / 10;
  }

  setColor1(color) {
    this.options.color1 = color;
    let c = new Vector3(color[0] / 255, color[1] / 255, color[2] / 255);
    this.mesh.material.uniforms.color1.value = c;
  }

  setColor2(color) {
    this.options.color2 = color;
    let c = new Vector3(color[0] / 255, color[1] / 255, color[2] / 255);
    this.mesh.material.uniforms.color2.value = c;
  }

  setEnabled(enabled) {
    this.options.enabled = enabled;
    if (enabled) {
      this.parent.enableQuantity(this);
    } else {
      this.parent.disableQuantity(this);
    }
  }

  setStyle(style) {
    this.options.style = style;
    if (style == "checker") {
      this.mesh.material = VertexParamCheckerboard(
        this.gp.matcapTextures.r,
        this.gp.matcapTextures.g,
        this.gp.matcapTextures.b,
        this.gp.matcapTextures.k
      );
      for (let elem of this.colorButtons) {
        elem.style.display = "block";
      }
    } else if (style == "grid") {
      this.mesh.material = VertexParamGrid(
        this.gp.matcapTextures.r,
        this.gp.matcapTextures.g,
        this.gp.matcapTextures.b,
        this.gp.matcapTextures.k
      );
      for (let elem of this.colorButtons) {
        elem.style.display = "block";
      }
    } else if (style == "tartan") {
      this.mesh.material = VertexParamTartan(
        this.gp.matcapTextures.r,
        this.gp.matcapTextures.g,
        this.gp.matcapTextures.b,
        this.gp.matcapTextures.k
      );
      for (let elem of this.colorButtons) {
        elem.style.display = "none";
      }
    }
    // Reset material uniforms
    this.setColor1(this.options.color1);
    this.setColor2(this.options.color2);
    this.setScale(this.options.scale);

    // Copy some attributes from parent
    this.mesh.material.uniforms.edgeWidth = this.parent.mesh.material.uniforms.edgeWidth;
    this.mesh.material.uniforms.edgeColor = this.parent.mesh.material.uniforms.edgeColor;
  }

  // enabled: false,
  // style: "checker",
  // color1: [249, 45, 94],
  // color2: [249, 219, 225],
  // scale: 1,
  setOptions(options) {
    if (options.hasOwnProperty("style")) {
      this.setStyle(options.style);
    }
    if (options.hasOwnProperty("color1")) {
      this.setColor1(options.color1);
    }
    if (options.hasOwnProperty("color2")) {
      this.setColor2(options.color2);
    }
    if (options.hasOwnProperty("style")) {
      this.setStyle(options.style);
    }
    if (options.hasOwnProperty("enabled")) {
      this.setEnabled(options.enabled);
    }
  }

  getOptions() {
    return this.options;
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
      new BufferAttribute(coordArray, 2)
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

export { VertexParameterizationQuantity };
