function standardizeVector3Array(positionArray) {
  let get = undefined;
  if (positionArray.get) {
    get = (iV) => positionArray.get(iV);
  } else {
    get = (iV) => positionArray[iV];
  }

  let getDim = undefined;
  if (get(0).x) {
    getDim = function (coord, iD) {
      if (iD == 0) {
        return coord.x;
      } else if (iD == 1) {
        return coord.y;
      } else {
        return coord.z;
      }
    };
  } else {
    getDim = (coord, iD) => coord[iD];
  }

  let size = undefined;
  if (positionArray.size) {
    size = positionArray.size();
  } else {
    size = positionArray.length;
  }

  const standardizedPositions = [];
  let pos = undefined;
  for (let iV = 0; iV < size; iV++) {
    pos = get(iV);
    standardizedPositions.push([
      getDim(pos, 0),
      getDim(pos, 1),
      getDim(pos, 2),
    ]);
  }
  return standardizedPositions;
}

function standardizeFaceArray(faceArray) {
  let get = undefined;
  let flatTris = false;
  if (faceArray.get) {
    // if faceArray is a single list, we assume that all faces are
    // triangles (this is the geometry-processing-js convention)
    if (
      typeof faceArray.get(0) == "number" ||
      typeof faceArray.get(0) == "bigint"
    ) {
      flatTris = true;
      get = (iV) => [
        faceArray.get(3 * iV),
        faceArray.get(3 * iV + 1),
        faceArray.get(3 * iV + 2),
      ];
    } else if (faceArray.get(0).get) {
      get = (iV) => [
        faceArray.get(iV).get(0),
        faceArray.get(iV).get(1),
        faceArray.get(iV).get(2),
      ];
    } else {
      get = (iV) => faceArray.get(iV);
    }
  } else {
    // if faceArray is a single list, we assume that all faces are
    // triangles (this is the geometry-processing-js convention)
    if (typeof faceArray[0] == "number" || typeof faceArray[0] == "bigint") {
      flatTris = true;
      get = (iV) => [
        faceArray[3 * iV],
        faceArray[3 * iV + 1],
        faceArray[3 * iV + 2],
      ];
    } else {
      // for now, I'll assume that nobody would make a list of things that have a get function
      get = (iV) => faceArray[iV];
    }
  }

  let size = undefined;
  if (faceArray.size) {
    size = faceArray.size();
  } else {
    size = faceArray.length;
  }
  if (flatTris) size /= 3;

  const standardizedFaces = [];
  let face = undefined;
  for (let iF = 0; iF < size; iF++) {
    standardizedFaces.push([get(iF)[0], get(iF)[1], get(iF)[2]]);
  }
  return standardizedFaces;
}

function standardizeVector2Array(array) {
  let get = undefined;
  if (array.get) {
    get = (iV) => array.get(iV);
  } else {
    get = (iV) => array[iV];
  }

  let getDim = undefined;
  if (get(0).x) {
    getDim = function (coord, iD) {
      if (iD == 0) {
        return coord.x;
      } else {
        return coord.y;
      }
    };
  } else {
    getDim = (coord, iD) => coord[iD];
  }

  let size = undefined;
  if (array.size) {
    size = array.size();
  } else {
    size = array.length;
  }

  const standardizedArray = [];
  let pos = undefined;
  for (let iV = 0; iV < size; iV++) {
    pos = get(iV);
    standardizedArray.push([getDim(pos, 0), getDim(pos, 1)]);
  }
  return standardizedArray;
}

export {
  standardizeVector3Array,
  standardizeFaceArray,
  standardizeVector2Array,
};
