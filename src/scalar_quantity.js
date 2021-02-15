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
  createVertexScalarFunctionMaterial,
  createInstancedScalarFunctionMaterial,
} from "./shaders.js";

import { availableColorMaps, getColorMap } from "./color_maps.js";

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
  constructor(name, values, parentMesh, options = {}) {
    this.parent = parentMesh;
    this.gp = this.parent.gp;
    this.values = values;
    this.name = name;

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
    this.mesh = new Mesh(this.parent.mesh.geometry.clone(), functionMaterial);
    this.initializeFunctionValues();

    // Copy some attributes from parent
    this.mesh.geometry.attributes.position = this.parent.mesh.geometry.attributes.position;
    this.mesh.geometry.attributes.normal = this.parent.mesh.geometry.attributes.normal;
    this.mesh.material.uniforms.edgeWidth = this.parent.mesh.material.uniforms.edgeWidth;
    this.mesh.material.uniforms.edgeColor = this.parent.mesh.material.uniforms.edgeColor;

    this.options = { enabled: false, colormap: "viridis" };
    Object.assign(this.options, options);
    this.setOptions(this.options);
  }

  initGui(guiFolder) {
    this.prefix = this.parent.name + "#" + this.name;

    guiFolder
      .add(this.options, "enabled")
      .onChange((e) => {
        this.setEnabled(e);
      })
      .listen()
      .name("Enabled");

    this.applyColorMap(this.options.colormap);
    guiFolder
      .add(this.options, "colormap", availableColorMaps)
      .onChange((cm) => {
        this.applyColorMap(cm);
      })
      .listen()
      .name("Color Map");
  }

  setEnabled(enabled) {
    this.options.enabled = enabled;
    if (enabled) {
      this.parent.enableQuantity(this);
    } else {
      this.parent.disableQuantity(this);
    }
  }

  setColorMap(cm) {
    this.options.colormap = cm;
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

    this.mesh.geometry.setAttribute("value", new BufferAttribute(vals, 1));
  }

  applyColorMap(cm) {
    this.mesh.material.uniforms.colormap.value = getColorMap(this.gp, cm);
  }

  getOptions() {
    return this.options;
  }

  setOptions(options) {
    if (options.hasOwnProperty("colormap")) {
      this.setColorMap(options.colormap);
    }
    if (options.hasOwnProperty("enabled")) {
      this.setEnabled(options.enabled);
    }
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
  constructor(name, values, parentCloud, options = {}) {
    this.parent = parentCloud;
    this.gp = this.parent.gp;
    this.values = values;
    this.name = name;

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
    this.mesh = new InstancedMesh(
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

    this.options = { enabled: false, colormap: "viridis" };
    Object.assign(this.options, options);
    this.setOptions(this.options);
  }

  initGui(guiFolder) {
    this.prefix = this.parent.name + "#" + this.name;

    guiFolder
      .add(this.options, "enabled")
      .onChange((e) => {
        this.setEnabled(e);
      })
      .listen()
      .name("Enabled");

    guiFolder
      .add(this.options, "colormap", availableColorMaps)
      .onChange((cm) => {
        this.applyColorMap(cm);
      })
      .listen()
      .name("Color Map");
  }

  setEnabled(enabled) {
    this.options.enabled = enabled;
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
      new InstancedBufferAttribute(vals, 1)
    );
  }

  setColorMap(cm) {
    this.colormap = cm;
    this.applyColorMap(cm);
  }

  applyColorMap(cm) {
    this.mesh.material.uniforms.colormap.value = getColorMap(this.gp, cm);
  }

  getOptions() {
    return this.options;
  }

  setOptions(options) {
    if (options.hasOwnProperty("colormap")) {
      this.setColorMap(options.colormap);
    }
    if (options.hasOwnProperty("enabled")) {
      this.setEnabled(options.enabled);
    }
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

export { VertexScalarQuantity, PointCloudScalarQuantity };
