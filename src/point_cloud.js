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
    let c = new Vector3(color[0] / 255, color[1] / 255, color[2] / 255);
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
    let sphereGeometry = new IcosahedronGeometry(0.025, 2);

    // create matcap material
    let matcapMaterial = createInstancedMatCapMaterial(
      this.gp.matcapTextures.r,
      this.gp.matcapTextures.g,
      this.gp.matcapTextures.b,
      this.gp.matcapTextures.k
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
