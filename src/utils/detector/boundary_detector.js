import { inference_tfjs } from "./inference.js";
import { pred_squares } from "./postprocessing.js";

export async function load(model_path) {
  const tfjsModel = await tf.loadGraphModel(model_path);
  const preheat = tf.zeros([1, 320, 320, 3]).toFloat();
  tfjsModel.predict(preheat);
  // const pyodide = await loadPyodide();
  // await pyodide.loadPackage("numpy");
  // await pyodide.runPythonAsync(`
  //           import os
  //           import numpy as np
  //       `);
  return [tfjsModel];
}

export async function detect(img, model) {
  const [tfjsModel, pyodide] = model;

  const [pts, pts_score, vmap] = await inference_tfjs(img, tfjsModel);

  let square = [];
  try {
    if (WebAssembly) {
      // console.log("Running WebAssembly 💻");
      square = await pred_squares(pyodide, pts, pts_score, vmap);
    } else {
      // console.log("Running numjs 💿");
      square = pred_squares_numjs(pts, pts_score, vmap);
    }
  } catch (error) {
    square = [];
  }
  return square;
}
