import * as THREE from "https://unpkg.com/three@0.125.1/build/three.module.js";
import { TrackballControls } from "https://unpkg.com/three@0.125.1/examples/jsm/controls/TrackballControls.js";
import { WEBGL } from "https://unpkg.com/three@0.125.1/examples/jsm/WebGL.js";
import { Reflector } from "https://unpkg.com/three@0.125.1/examples/jsm/objects/Reflector.js";
import Stats from "https://unpkg.com/three@0.125.1/examples/jsm/libs/stats.module.js";

import { GUI } from "https://unpkg.com/dat.gui@0.7.6/build/dat.gui.module.js";

import {
  groundPlaneVertexShader,
  groundPlaneFragmentShader,
} from "./shaders.js";
import { SurfaceMesh } from "./surface_mesh.js";
import { PointCloud } from "./point_cloud.js";
import { evaluatePickQuery } from "./pick.js";
import { CurveNetwork } from "./curve_network.js";
import { getNextUniqueColor } from "./color_utils.js";
import { getColorMap } from "./color_maps.js";
import {
  standardizeVector3Array,
  standardizeFaceArray,
} from "./standardize_data_array.js";

// https://stackoverflow.com/a/34452130
GUI.prototype.removeFolder = function (name) {
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
    if (!WEBGL.isWebGLAvailable()) alert(WEBGL.getWebGLErrorMessage());

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

    this.commandGui = new GUI({ resizeable: true });
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

    this.stats = new Stats();
    // Place stats in corner of this.container, rather than always placing at the top-left corner of the page
    this.stats.dom.style.position = "absolute";
    this.container.append(this.stats.dom);

    this.initRenderer(this.container);
    this.initTextures();
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
    tex.wrapS = THREE.MirroredRepeatWrapping;
    tex.wrapT = THREE.MirroredRepeatWrapping;
    this.groundPlane = new Reflector(new THREE.PlaneGeometry(100, 100), {
      clipBias: 0.003,
      textureWidth: this.container.offsetWidth * window.devicePixelRatio,
      textureHeight: this.container.offsetHeight * window.devicePixelRatio,
      color: 0x777777,
    });
    this.groundPlane.material.vertexShader = groundPlaneVertexShader;
    this.groundPlane.material.fragmentShader = groundPlaneFragmentShader;
    this.groundPlane.material.uniforms.tex = { value: tex };
    this.groundPlane.material.uniforms.alpha = { value: 0.85 };
    let uvs = new Float32Array(4 * 2);
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

  initTextures() {
    this.matcapTextures = {
      rgbk: undefined,
    };
    this.matcapTextures.rgbk = new THREE.TextureLoader().load(
      this.geopticPath + "/img/clay_rgbk.png"
    );

    // Pre-fetch viridis colormap (default) and rdpu colormap (default for distances)
    getColorMap(this, "viridis");
    getColorMap(this, "rdpu");
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
    this.structureGui = new GUI({ autoPlace: false, resizeable: true });

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
    let options = {};
    if (this.surfaceMeshes[name]) {
      options = this.surfaceMeshes[name].getOptions();
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
      this.structureGuiCurveNetworks =
        this.structureGui.addFolder("Curve Networks");
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
      this.structureGuiPointClouds =
        this.structureGui.addFolder("Point Clouds");
      this.structureGuiPointClouds.open();
    }

    // If there's an existing strucure with this name,
    // copy its properties and delete it
    const options = this.pointClouds[name]
      ? this.pointClouds[name].getOptions()
      : {};
    if (this.pointClouds[name]) {
      this.deregisterPointCloud(name);
    }

    let cloudStructure = new PointCloud(vertexCoordinates, name, this, options);
    this.pointClouds[name] = cloudStructure;

    let cloudGui = this.structureGuiPointClouds.addFolder(name);
    cloudStructure.initGui(cloudGui);

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
    this.controls = new TrackballControls(
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
      clickX,
      clickY,
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
    const rect = this.parent.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    if (
      x >= 0 &&
      x <= this.container.offsetWidth &&
      y >= 0 &&
      y <= this.container.offsetHeight
    ) {
      this.pick(x, y);
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

  setGroundPlaneEnabled(enabled) {
    this.structureGuiFields["GroundPlane#Enabled"] = enabled;
    if (enabled) {
      this.scene.add(this.groundPlane);
    } else {
      this.scene.remove(this.groundPlane);
    }
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

export { Geoptic };
