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

import { VertexParamCheckerboard, VertexParamGrid } from "./shaders.js";
import { applyColorMap } from "./color_maps.js";

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
    this.mesh = new Mesh(this.parent.mesh.geometry.clone(), functionMaterial);
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

    guiFields[this.name + "#Color1"] = [255, 125, 255];
    this.setColor1(guiFields[this.name + "#Color1"]);
    const color1Button = guiFolder
      .addColor(guiFields, this.name + "#Color1")
      .onChange((c) => {
        this.setColor1(c);
      })
      .listen()
      .name("Color");

    guiFields[this.name + "#Color2"] = [25, 25, 125];
    this.setColor2(guiFields[this.name + "#Color2"]);
    const color2Button = guiFolder
      .addColor(guiFields, this.name + "#Color2")
      .onChange((c) => {
        this.setColor2(c);
      })
      .listen()
      .name("Color");

    guiFields[this.name + "#Scale"] = 1;
    this.setScale(guiFields[this.name + "#Scale"]);
    const edgeWidthInput = guiFolder
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
    let c = new Vector3(color[0] / 255, color[1] / 255, color[2] / 255);
    this.mesh.material.uniforms.color1.value = c;
  }

  setColor2(color) {
    let c = new Vector3(color[0] / 255, color[1] / 255, color[2] / 255);
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
    if (coords.get(0).x) {
      this.getDim = function (coord, iD) {
        if (iD == 0) {
          return coord.x;
        } else if (iD == 1) {
          return coord.y;
        } else {
          return coord.z;
        }
      };
    } else {
      this.getDim = function (coord, iD) {
        return coord[iD];
      };
    }

    // fill position and barycoord buffers
    let F = this.parent.faces.size();
    let coordArray = new Float32Array(F * 3 * 2);
    for (let iF = 0; iF < F; iF++) {
      let face = this.parent.faces.get(iF);
      for (let iV = 0; iV < 3; iV++) {
        let coord = coords.get(this.parent.getCorner(face, iV));
        for (let iD = 0; iD < 2; ++iD) {
          coordArray[3 * 2 * iF + 2 * iV + iD] = this.getDim(coord, iD);
        }
      }
    }

    this.mesh.geometry.setAttribute(
      "coord",
      new BufferAttribute(coordArray, 2)
    );
  }

  getVertexValue(iV) {
    return this.gp.prettyVector2(this.coords.get(iV));
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
