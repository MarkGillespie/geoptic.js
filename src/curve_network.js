import {
  Group,
  Vector3,
  CylinderGeometry,
  SphereGeometry,
  InstancedMesh,
  InstancedBufferAttribute,
  Matrix4,
} from "https://unpkg.com/three@0.125.1/build/three.module.js";

import {
  createCurveMatCapMaterial,
  createInstancedMatCapMaterial,
} from "./shaders.js";

import { getNextUniqueColor } from "./color_utils.js";

class CurveNetwork {
  constructor(vertices, segments, maxLen, name, geopticEnvironment) {
    this.gp = geopticEnvironment;
    this.res = 12;

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
    let mat = new Matrix4();
    for (let iS = 0; iS < this.segments.length; iS++) {
      let start = this.gp.listToVec(newPositions[this.segments[iS][0]]);
      let end = this.gp.listToVec(newPositions[this.segments[iS][1]]);
      let offset = new Vector3();
      offset.subVectors(start, end); // offset = start - end

      lengths[iS] = offset.length();
      mat.lookAt(new Vector3(0, 0, 0), offset, new Vector3(0, 0, 1));
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
    let c = new Vector3(color[0] / 255, color[1] / 255, color[2] / 255);
    this.tubeMesh.material.uniforms.color.value = c;
    this.pointMesh.material.uniforms.color.value = c;
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

    guiFields[this.name + "#Color"] = getNextUniqueColor();
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
    let tubeGeometry = new CylinderGeometry(1, 1, 1, this.res);
    let sphereGeometry = new SphereGeometry(1, this.res, this.res);

    // By default, the cylinder is vertically centered. But I want it to go upwards
    // from the origin, so I translate all of its vertices up by height/2
    let positions = tubeGeometry.attributes.position.array;
    let V = tubeGeometry.attributes.position.count;
    let minY = -0.5;
    for (let i = 0; i < V; i++) {
      positions[3 * i + 1] = positions[3 * i + 1] - minY;
    }

    // Rotate tube so that look-at points the tube in the given direction
    let mat = new Matrix4();
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

    let tubeMesh = new InstancedMesh(
      tubeGeometry,
      tubeMaterial,
      segments.length
    );
    let pointMesh = new InstancedMesh(
      sphereGeometry,
      sphereMaterial,
      vertices.length
    );

    let lengths = new Float32Array(segments.length);
    mat = new Matrix4();
    for (let iS = 0; iS < segments.length; iS++) {
      let start = this.gp.listToVec(vertices[segments[iS][0]]);
      let end = this.gp.listToVec(vertices[segments[iS][1]]);
      let offset = new Vector3();
      offset.subVectors(start, end); // offset = start - end

      lengths[iS] = offset.length();
      mat.lookAt(new Vector3(0, 0, 0), offset, new Vector3(0, 0, 1));
      mat.setPosition(start.x, start.y, start.z);
      tubeMesh.setMatrixAt(iS, mat);
      pointMesh.setMatrixAt(segments[iS][0], mat);
      pointMesh.setMatrixAt(segments[iS][1], mat);
    }
    tubeMesh.geometry.setAttribute(
      "len",
      new InstancedBufferAttribute(lengths, 1)
    );

    let curve = new Group();
    curve.add(tubeMesh);
    curve.add(pointMesh);

    return [curve, tubeMesh, pointMesh];
  }
}

export { CurveNetwork };
