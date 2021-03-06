import {
  InstancedMesh,
  InstancedBufferAttribute,
  IcosahedronGeometry,
  Vector3,
  Matrix4,
  MeshBasicMaterial,
} from "https://unpkg.com/three@0.125.1/build/three.module.js";

import { requestPickBufferRange, pickIndToVector } from "./pick.js";

import {
  createInstancedMatCapMaterial,
  createInstancedScalarFunctionMaterial,
  createPointCloudPickMaterial,
} from "./shaders.js";
import { getNextUniqueColor } from "./color_utils.js";
import { PointCloudScalarQuantity } from "./scalar_quantity.js";

class PointCloud {
  constructor(coords, name, geopticEnvironment, options = {}) {
    this.gp = geopticEnvironment;
    this.nV = coords.length;
    this.coords = coords;
    this.name = name;

    // build three.js mesh
    this.mesh = this.constructThreeMesh(coords);

    if (this.gp.doPicks) this.pickMesh = this.constructThreePickMesh(coords);

    this.quantities = {};

    this.guiFolder = undefined;

    this.options = { radius: 1, enabled: true };
    this.options.color = options.color || getNextUniqueColor();
    Object.assign(this.options, options);

    this.setOptions(this.options);

    this.vertexPickCallback = (iV) => {};
  }

  addScalarQuantity(name, values) {
    this.quantities[name] = new PointCloudScalarQuantity(name, values, this);
    let quantityGui = this.guiFolder.addFolder(name);
    this.quantities[name].initGui(quantityGui);
  }

  initGui(guiFolder) {
    this.guiFolder = guiFolder;

    let objectGuiList = guiFolder.domElement.firstChild;
    let meshInfoBox = document.createElement("li");
    meshInfoBox.classList.add("dat-info-box");
    objectGuiList.appendChild(meshInfoBox);
    let vertexInfo = document.createElement("span");
    vertexInfo.innerHTML = "#verts: " + this.nV;
    meshInfoBox.appendChild(vertexInfo);

    guiFolder
      .add(this.options, "enabled")
      .onChange((e) => {
        this.setEnabled(e);
      })
      .listen()
      .name("Enabled");

    guiFolder
      .addColor(this.options, "color")
      .onChange((c) => {
        this.setColor(c);
      })
      .listen()
      .name("Color");

    guiFolder
      .add(this.options, "radius")
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
    this.options.color = color;
    let c = new Vector3(color[0] / 255, color[1] / 255, color[2] / 255);
    this.mesh.material.uniforms.color.value = c;
  }

  getOptions() {
    return this.options;
  }

  setOptions(options) {
    if (options.hasOwnProperty("color")) {
      this.setColor(options.color);
    }
    if (options.hasOwnProperty("radius")) {
      this.setRadius(options.radius);
    }
    if (options.hasOwnProperty("enabled")) {
      this.setEnabled(options.enabled);
    }
  }

  setRadius(rad) {
    this.options.radius = rad;
    this.mesh.material.uniforms.scale.value = rad;

    if (this.gp.doPicks) this.pickMesh.material.uniforms.scale.value = rad;
  }

  setEnabled(enabled) {
    this.options.enabled = enabled;
    if (enabled) {
      let enabledQuantity = false;
      for (let q in this.quantities) {
        if (this.quantities[q].options.enabled) {
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
          p.options.enabled = false;
          this.gp.scene.remove(p.mesh);
        }
      }
    }

    if (this.options.enabled) {
      if (q.isDominantQuantity) {
        this.gp.scene.remove(this.mesh);
      }
      this.gp.scene.add(q.mesh);
    }
  }

  disableQuantity(q) {
    if (this.options.enabled) {
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
    let sphereGeometry = new IcosahedronGeometry(0.025, 2);

    // create matcap material
    let matcapMaterial = createInstancedMatCapMaterial(
      this.gp.matcapTextures.rgbk
    );

    // create mesh
    let threeMesh = new InstancedMesh(sphereGeometry, matcapMaterial, this.nV);

    // set instance positions
    let mat = new Matrix4();
    let positions = new Float32Array(3 * this.nV);
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

    this.vertexPickCallback(localInd);
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
    let pickMesh = new InstancedMesh(
      this.mesh.geometry.clone(),
      pickMaterial,
      this.nV
    );
    pickMesh.geometry.setAttribute(
      "color",
      new InstancedBufferAttribute(colors, 3)
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

export { PointCloud };
