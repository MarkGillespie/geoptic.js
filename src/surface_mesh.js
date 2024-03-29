import {
  BufferGeometry,
  BufferAttribute,
  Vector3,
  Matrix4,
  Euler,
  Mesh,
} from "https://unpkg.com/three@0.125.1/build/three.module.js";

import { requestPickBufferRange, pickIndToVector } from "./pick.js";

import {
  createMatCapMaterial,
  createSurfaceMeshPickMaterial,
} from "./shaders.js";
import { getNextUniqueColor } from "./color_utils.js";
import { VertexScalarQuantity } from "./scalar_quantity.js";
import { VertexDistanceQuantity } from "./distance_quantity.js";
import { VertexVectorQuantity } from "./vector_quantity.js";
import { VertexParameterizationQuantity } from "./parameterization_quantity.js";

import {
  standardizeVector2Array,
  standardizeVector3Array,
  standardizeFaceArray,
} from "./standardize_data_array.js";

class SurfaceMesh {
  constructor(coords, faces, name, geopticEnvironment, options = {}) {
    this.gp = geopticEnvironment;
    this.nV = coords.length;
    this.coords = coords;
    this.faces = faces;
    this.name = name;

    // build three.js mesh
    [this.mesh, this.geo] = this.constructThreeMesh(coords, faces);

    [this.smoothVertexNormals, this.smoothCornerNormals] =
      this.computeSmoothNormals();

    if (this.gp.doPicks)
      this.pickMesh = this.constructThreePickMesh(coords, faces);

    this.quantities = {};

    this.guiFolder = undefined;
    this.edgeGuis = [];

    // Default options
    this.options = {
      enabled: true,
      smooth: true,
      edgesEnabled: false,
      edgeColor: [0, 0, 0],
      edgeWidth: 1,
    };
    this.options.color = options.color || getNextUniqueColor();

    // copy anything set in options to this.options
    Object.assign(this.options, { options });
    this.setOptions(this.options);

    this.setSmoothShading(this.options.smooth);
    this.setColor(this.options.color);

    this.vertexPickCallback = (iV) => {};
    this.edgePickCallback = (iE) => {};
    this.facePickCallback = (iF) => {};
  }

  addVertexScalarQuantity(name, values) {
    const options = this.quantities[name]
      ? this.quantities[name].getOptions()
      : {};
    this.quantities[name] = new VertexScalarQuantity(
      name,
      values,
      this,
      options
    );

    this.guiFolder.removeFolder(name);
    let quantityGui = this.guiFolder.addFolder(name);
    this.quantities[name].initGui(quantityGui);

    return this.quantities[name];
  }

  addVertexDistanceQuantity(name, values) {
    const options = this.quantities[name]
      ? this.quantities[name].getOptions()
      : {};
    this.quantities[name] = new VertexDistanceQuantity(
      name,
      values,
      this,
      options
    );

    this.guiFolder.removeFolder(name);
    let quantityGui = this.guiFolder.addFolder(name);
    this.quantities[name].initGui(quantityGui);

    return this.quantities[name];
  }

  addVertexVectorQuantity(name, values) {
    const options = this.quantities[name]
      ? this.quantities[name].getOptions()
      : {};
    if (this.quantities[name]) {
      this.disableQuantity(this.quantities[name]);
    }
    values = standardizeVector3Array(values);
    this.quantities[name] = new VertexVectorQuantity(
      name,
      values,
      this,
      options
    );

    this.guiFolder.removeFolder(name);
    let quantityGui = this.guiFolder.addFolder(name);
    this.quantities[name].initGui(quantityGui);

    return this.quantities[name];
  }

  addVertexParameterizationQuantity(name, values) {
    const options = this.quantities[name]
      ? this.quantities[name].getOptions()
      : {};
    values = standardizeVector2Array(values);
    this.quantities[name] = new VertexParameterizationQuantity(
      name,
      values,
      this,
      options
    );

    this.guiFolder.removeFolder(name);
    let quantityGui = this.guiFolder.addFolder(name);
    this.quantities[name].initGui(quantityGui);

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

    const enabledButton = guiFolder
      .add(this.options, "enabled")
      .onChange((e) => {
        this.setEnabled(e);
      })
      .listen()
      .name("Enabled");
    let row = enabledButton.domElement.closest("li");
    row.classList.add("half-button");
    row.style.width = "35%";

    const smoothButton = guiFolder
      .add(this.options, "smooth")
      .onChange((c) => {
        this.setSmoothShading(c);
      })
      .listen()
      .name("Smooth");
    row = smoothButton.domElement.closest("li");
    row.classList.add("half-button");
    row.style.width = "35%";

    const edgesButton = guiFolder
      .add(this.options, "edgesEnabled")
      .onChange((c) => {
        this.setEdgesEnabled(c);
      })
      .listen()
      .name("Edges");
    row = edgesButton.domElement.closest("li");
    row.classList.add("half-button");
    row.style.width = "30%";

    const colorButton = guiFolder
      .addColor(this.options, "color")
      .onChange((c) => {
        this.setColor(c);
      })
      .listen()
      .name("Color");

    const edgeWidthInput = guiFolder
      .add(this.options, "edgeWidth")
      .min(0)
      .max(2)
      .step(0.05)
      .onChange((width) => {
        this.setEdgeWidth(width);
      })
      .listen()
      .name("Edge Width");
    row = edgeWidthInput.domElement.closest("li");
    row.style.display = "none";
    this.edgeGuis.push(row);

    const edgeColorInput = guiFolder
      .addColor(this.options, "edgeColor")
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
    this.options.edges = enabled;
    for (let elem of this.edgeGuis) {
      elem.style.display = enabled ? "block" : "none";
    }
    if (enabled) {
      this.mesh.material.uniforms.edgeWidth.value = this.options.edgeWidth;
    } else {
      this.mesh.material.uniforms.edgeWidth.value = 0;
    }
  }

  setSmoothShading(shadeSmooth) {
    this.options.smooth = shadeSmooth;
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
    this.options.color = color;
    let c = new Vector3(color[0] / 255, color[1] / 255, color[2] / 255);
    this.mesh.material.uniforms.color.value = c;
  }

  setEdgeColor(color) {
    this.options.edgeColor = color;
    let c = new Vector3(color[0] / 255, color[1] / 255, color[2] / 255);
    this.mesh.material.uniforms.edgeColor.value = c;
  }

  setEdgeWidth(width) {
    this.options.edgeWidth = width;
    this.edgeWidth = width;
    this.mesh.material.uniforms.edgeWidth.value = width;
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

  getOptions() {
    return this.options;
  }

  setOptions(options) {
    if (options.hasOwnProperty("edgeWidth")) {
      this.setEdgeWidth(options.edgeWidth);
    }
    if (options.hasOwnProperty("edgeColor")) {
      this.setEdgeColor(options.edgeColor);
    }
    if (options.hasOwnProperty("edgesEnabled")) {
      this.setEdgesEnabled(options.edgesEnabled);
    }
    if (options.hasOwnProperty("color")) {
      this.setColor(options.color);
    }
    if (options.hasOwnProperty("smooth")) {
      this.setSmoothShading(options.smooth);
    }
    if (options.hasOwnProperty("enabled")) {
      this.setEnabled(options.enabled);
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
      let n = new Vector3(
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
    let oldRot = new Euler(
      this.mesh.rotation.x,
      this.mesh.rotation.y,
      this.mesh.rotation.z
    );
    this.mesh.setRotationFromAxisAngle(new Vector3(1, 0, 0), 0);
    if (this.gp.doPicks)
      this.pickMesh.setRotationFromAxisAngle(new Vector3(1, 0, 0), 0);
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
    this.mesh.setRotationFromAxisAngle(new Vector3(1, 0, 0), 0);
    this.mesh.setRotationFromMatrix(mat);

    if (this.gp.doPicks) {
      this.pickMesh.setRotationFromAxisAngle(new Vector3(1, 0, 0), 0);
      this.pickMesh.setRotationFromMatrix(mat);
    }
  }

  setOrientationFromFrame(T, N, B) {
    let mat = new Matrix4();
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
    let threeGeometry = new BufferGeometry();

    // fill position and barycoord buffers
    let F = faces.length;
    let positions = new Float32Array(F * 3 * 3);
    let normals = new Float32Array(F * 3 * 3);
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

    threeGeometry.setAttribute("position", new BufferAttribute(positions, 3));
    threeGeometry.setAttribute("barycoord", new BufferAttribute(barycoords, 3));
    threeGeometry.computeVertexNormals();

    // create matcap material
    let matcapMaterial = createMatCapMaterial(this.gp.matcapTextures.rgbk);

    // create mesh
    let threeMesh = new Mesh(threeGeometry, matcapMaterial);
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
    let pickGeo = new BufferGeometry();

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
        let vertex = face[iV];

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
      new BufferAttribute(vertexColors0, 3)
    );
    pickGeo.setAttribute(
      "vertex_color1",
      new BufferAttribute(vertexColors1, 3)
    );
    pickGeo.setAttribute(
      "vertex_color2",
      new BufferAttribute(vertexColors2, 3)
    );
    pickGeo.setAttribute("edge_color0", new BufferAttribute(edgeColors0, 3));
    pickGeo.setAttribute("edge_color1", new BufferAttribute(edgeColors1, 3));
    pickGeo.setAttribute("edge_color2", new BufferAttribute(edgeColors2, 3));
    pickGeo.setAttribute("face_color", new BufferAttribute(faceColors, 3));

    // create matcap material
    let pickMaterial = createSurfaceMeshPickMaterial();

    // create mesh
    return new Mesh(pickGeo, pickMaterial);
  }

  updatePositions() {}
}

export { SurfaceMesh };
