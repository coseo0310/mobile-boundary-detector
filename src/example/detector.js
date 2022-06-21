import { load, detect } from "./boundary_detector.js";

// Libary Loaded
import "../lib/tfjs@3.18.0/dist/tf.min.js";
import "../lib/tfjs-backend-wasm@3.18.0/dist/tf-backend-wasm.js";
import "../lib/numjs-master/dist/numjs.min.js";
import "../lib/pyodide@0.20.0/pyodide.js";

export default class Detector {
  cameraWrap = document.createElement("div");
  loader = document.createElement("div");
  canvas = document.createElement("canvas");
  video = document.createElement("video");

  stream = null;
  model = null;
  videoWidth = 320;
  videoHeight = 320;
  rotate = "horizontal";
  section = {
    dx: 0,
    dy: 0,
    width: 0,
    height: 0,
  };

  isMobile = navigator.userAgent.toLocaleLowerCase().includes("mobile");
  isCapture = false;
  isLoading = false;
  isDetect = false;
  isAnimate = false;
  isWorker = true;
  isSafari = navigator.userAgent.toLocaleLowerCase().includes("safari");

  loaderCallback = null;

  square = [];

  worker = null;

  constructor() {
    this.isWorker = !this.isSafari;
    if (this.isWorker && window.Worker) {
      this.worker = new Worker("./module/worker.js", { type: "module" });
      this.worker.onmessage = async (e) => {
        switch (e.data.type) {
          case "setModel":
            this.isLoading = true;
            this.loader.style.display = "none";
            if (this.loaderCallback) {
              this.loaderCallback();
            }
            break;
          case "getCapture":
            this.setLine(e.data.square);
            if (e.data.square.length === 0) {
              this.square = [];
            }
            break;
          case "getAnimate":
            this.isDetect = false;

            if (this.isCapture) {
              return;
            }
            await this.clearCanvas();
            await this.setSection();
            await this.setLine(e.data.square);
            if (e.data.square.length === 0) {
              this.square = [];
            }
            this.animate();
            break;
          default:
            break;
        }
      };
    }

    this.setModel();
    this.setElement();
    this.setDevice();
    this.setSection();

    window.addEventListener("beforeunload", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.clearVideo();
    });
  }

  setElement() {
    this.cameraWrap.classList.add("camera-wrap");
    this.cameraWrap.style.position = "relative";
    this.cameraWrap.style.display = "flex";
    this.cameraWrap.style.alignItems = "center";
    this.cameraWrap.style.justifyContent = "center";
    this.cameraWrap.style.width = "100%";
    this.cameraWrap.style.height = "100%";
    this.cameraWrap.style.overflow = "hidden";
    this.cameraWrap.style.maxWidth = `${this.videoWidth}px`;
    this.cameraWrap.style.maxHeight = `${this.videoHeight}px`;

    this.loader.classList.add("loader");
    this.loader.innerText = "Loading...";
    this.loader.style.position = "absolute";
    this.loader.style.display = "flex";
    this.loader.style.justifyContent = "center";
    this.loader.style.alignItems = "center";
    this.loader.style.color = "white";
    this.loader.style.width = "100%";
    this.loader.style.height = "100%";
    this.loader.style.backgroundColor = "rgba(0, 0, 0, 0.8)";

    this.canvas.classList.add("canvas");
    this.canvas.style.position = "absolute";
    this.canvas.style.backgroundColor = "transparent";

    this.ctx = this.canvas.getContext("2d");

    this.video.classList.add("video");
    this.video.style.zIndex = "-1";
    this.video.autoplay = true;
    this.video.muted = true;
    this.video.playsInline = true;

    this.cameraWrap.appendChild(this.loader);
    this.cameraWrap.appendChild(this.video);
    this.cameraWrap.appendChild(this.canvas);
  }

  async setDevice() {
    try {
      const initalConstrains = {
        audio: false,
        video: {
          facingMode: "environment",
          width: this.videoWidth,
          height: this.videoHeight,
        },
      };
      const cameraConstrainsts = {
        audio: false,
        video: {
          width: this.videoWidth,
          height: this.videoHeight,
        },
      };
      if (!navigator.mediaDevices.getUserMedia) {
        return;
      }
      this.stream = await navigator.mediaDevices.getUserMedia(
        !this.isMobile ? cameraConstrainsts : initalConstrains
      );

      this.video.srcObject = this.stream;
    } catch (error) {
      console.error(error);
    }
  }

  async setSection() {
    this.clearCanvas();
    this.section.width = this.videoWidth - this.section.dx * 2;
    this.section.height = this.videoHeight - this.section.dy * 2;
    this.canvas.width = this.videoWidth;
    this.canvas.height = this.videoHeight;
    this.ctx.save();
    this.ctx.strokeStyle = "lightgoldenrodyellow";
    this.ctx.lineWidth = 3;
    this.ctx.strokeRect(10, 10, this.videoWidth - 20, this.videoHeight - 20);
    this.ctx.restore();
  }

  async setLine(square) {
    if (square.length === 0) {
      return;
    }
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.moveTo(square[0][0], square[0][1]);
    this.ctx.lineTo(square[1][0], square[1][1]);
    this.ctx.lineTo(square[2][0], square[2][1]);
    this.ctx.lineTo(square[3][0], square[3][1]);
    this.ctx.lineTo(square[0][0], square[0][1]);
    this.ctx.strokeStyle = "red";
    this.ctx.lineWidth = 2;
    this.ctx.stroke();
    this.ctx.restore();
    this.square = square;
  }

  async setLoaderCallback(c) {
    this.loaderCallback = c;
  }

  async setModel() {
    if (this.isWorker && window.Worker) {
      this.worker.postMessage({ type: "setModel" });
    } else {
      // 모델 로드
      this.model = await load("./module/tfjs320f16/model.json");
      this.isLoading = true;
      this.loader.style.display = "none";
      if (this.loaderCallback) {
        this.loaderCallback();
      }
    }
  }

  async capture() {
    if (!this.isLoading) {
      return;
    }
    await this.setRealtimeDetect(false);
    this.isCapture = true;
    this.isAnimate = false;
    this.clearCanvas();

    this.canvas.width = this.videoWidth;
    this.canvas.height = this.videoHeight;

    this.ctx.drawImage(this.video, 0, 0, this.videoWidth, this.videoHeight);

    const dataUrl = await this.canvas.toDataURL();

    if (this.isWorker && window.Worker) {
      const { data } = this.ctx.getImageData(0, 0, 320, 320);
      this.worker.postMessage({ type: "getCapture", rgb: data });
    } else {
      const imgEl = new Image();
      imgEl.src = dataUrl;
      imgEl.onload = (async () => {
        imgEl.width = 320;
        imgEl.height = 320;
        const img = window.tf.browser.fromPixels(imgEl);
        const square = await detect(img, this.model);
        await this.setLine(square);
        if (square.length === 0) {
          this.square = [];
        }
      }).bind(this);
    }
  }

  async setRealtimeDetect(is = true) {
    this.isAnimate = is;

    if (is) {
      this.animate();
    } else {
      this.isDetect = false;
    }
  }

  async animate(t = 0) {
    if (!this.isAnimate || !this.isLoading) {
      return;
    }
    if (!this.isDetect) {
      this.isDetect = true;
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      canvas.width = this.videoWidth;
      canvas.height = this.videoHeight;

      ctx.drawImage(this.video, 0, 0, this.videoWidth, this.videoHeight);

      if (this.isWorker && window.Worker) {
        const { data } = ctx.getImageData(0, 0, 320, 320);
        this.worker.postMessage({ type: "getAnimate", rgb: data });
        return;
      } else {
        const dataUrl = await canvas.toDataURL();
        const imgEl = new Image();
        imgEl.src = dataUrl;
        imgEl.onload = (async () => {
          if (this.isCapture) {
            return;
          }
          imgEl.width = 320;
          imgEl.height = 320;
          const img = window.tf.browser.fromPixels(imgEl);
          const square = await detect(img, this.model);
          await this.clearCanvas();
          await this.setSection();
          await this.setLine(square);
          if (square.length === 0) {
            this.square = [];
          }
          this.isDetect = false;
        }).bind(this);
      }
    }

    requestAnimationFrame(this.animate.bind(this));
  }

  async resetCapture() {
    this.clearCanvas();
    this.setSection();
    this.isCapture = false;
  }

  getSquare() {
    return square;
  }

  clearCanvas() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  clearVideo() {
    this.video.pause();
    this.video.src = "";
    this.stream.getTracks()[0].stop();
  }

  getElement() {
    return this.cameraWrap;
  }
}
