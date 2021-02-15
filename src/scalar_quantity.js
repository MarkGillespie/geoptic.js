import {
  BufferAttribute,
  InstancedBufferAttribute,
  IcosahedronGeometry,
  Vector3,
  Mesh,
  InstancedMesh,
  TextureLoader,
  Color,
  Matrix4,
} from "https://unpkg.com/three@0.125.1/build/three.module.js";

import {
  createVertexScalarFunctionMaterial,
  createInstancedScalarFunctionMaterial,
} from "./shaders.js";

import { availableColorMaps, applyColorMap } from "./color_maps.js";

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
    this.mesh = new Mesh(this.parent.mesh.geometry.clone(), functionMaterial);
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

    this.mesh.geometry.setAttribute("value", new BufferAttribute(vals, 1));
  }

  applyColorMap(cm) {
    this.mesh.material.uniforms.colormap.value = new TextureLoader().load(
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
      new InstancedBufferAttribute(vals, 1)
    );
  }

  applyColorMap(cm) {
    this.mesh.material.uniforms.colormap.value = new TextureLoader().load(
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

export { VertexScalarQuantity, PointCloudScalarQuantity };
