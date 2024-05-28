import { defineComponent, ref, watch } from "vue"
import * as THREE from "three"
import DTScene from "./DTScene"
import global from "../../Global"
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { LuminosityShader } from 'three/examples/jsm/shaders/LuminosityShader.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

const storedattachObjects = localStorage.getItem('attachObjects');
const attachObjects = JSON.parse(storedattachObjects);
// console.log(attachObjects);
var app;
var canvas;
var delta = new THREE.Vector3();
var dragFromOutside;  // 是否从外界拖入
var dragData;
var dragModel;
var dragPoint;  // 拖动开始时的拖动点
var front = new THREE.Vector3();
var fullscreen = false;
var isDrag = false;  // 是否在用鼠标移动模型
var keys = { shift:false, space: false };  // 按下的按键
var mouseType = [false, false, false];  // 左、中、右键是否按下
const ray = new THREE.Raycaster();  // 从鼠标发出的射线检测器
var resizeObserver;
var style;
var tempImg;  // 临时隐藏拖动图标
var tempModel;
var tempOpacity;

var MOVE = THREE.MOUSE.PAN;
var ROTATE = THREE.MOUSE.ROTATE;
var ZOOM = THREE.MOUSE.DOLLY;
var UP = new THREE.Vector3(0, 0, 1);  // z轴朝上

export default defineComponent({
  name: "ThreeScene",
  props: {},
  components: {},
  data() {
    resizeObserver = new ResizeObserver(() => {  // 画布大小改变时的事件
      this.resizeCanvas()
    });
    global.on("changeFullscreen", () => {  // 全屏或退出全屏
      fullscreen = !fullscreen;
      if (fullscreen) {
        parent = canvas.parentElement;
        style = canvas.style;
        canvas.style =
          "position: absolute;" +
          "top: 0px; left: 0px;" +
          "zIndex: 114514;";  // 让画布盖住其它组件
        app.appendChild(canvas);
      } else {
        canvas.style = style;
        parent.appendChild(canvas);
      }
      global.emit("changeQuitFullscreen", fullscreen);
      this.resizeCanvas();
    });
    global.on("dragModelStart", (data) => { dragData = data });
    global.on("dropout", () => dragModel.remove());
    return { description: null, rendered: false, }
  },
  methods: {
    castRay(e) {  // 射线检测
      const mouse = new THREE.Vector2(
        e.offsetX * 2 / e.target.clientWidth - 1, 
        1 - e.offsetY * 2 / e.target.clientHeight
      );
      ray.setFromCamera(mouse, this.scene.camera);        
    },
    intersectObject(e) {  // 求鼠标发出的射线与物体的交点
      this.castRay(e);  // 射线检测
      for (let intersect of ray.intersectObject(this.scene.SCENE)) {
        let mesh = intersect.object;
        if (mesh.isTransformControlsPlane) continue;  // 忽略控制器
        if (mesh.isMesh && mesh != dragModel && mesh != tempModel) {
          return [mesh, intersect.point];
        }
      }
      return new THREE.Vector3(999, 999, 999)  // 若无交点
    },
    intersectPlaneH(e, P) {  // 求鼠标发出的射线与平面z=P.z的交点
      this.castRay(e);  // 射线检测
      let plane = new THREE.Plane(), result = new THREE.Vector3();
      plane.setFromNormalAndCoplanarPoint(UP, P);  // 作过点P且法向量朝上的水平平面
      ray.ray.intersectPlane(plane, result);  // 返回射线检测器与该平面的交点
      return result;
    },
    intersectPlaneV(e, P) {  // 求鼠标发出的射线与过点P且与视野正前方垂直的平面的交点
      this.castRay(e);  // 射线检测
      this.scene.camera.getWorldDirection(front);  // 求视野的正前方的方向向量
      let plane = new THREE.Plane(), result = new THREE.Vector3();
      plane.setFromNormalAndCoplanarPoint(front, P);  // 作过点P且法向量朝视野正前方的竖直平面
      ray.ray.intersectPlane(plane, result);  // 返回射线检测器与该平面的交点
      return result;
    },
    onDragenter(e) {
      let data = e.dataTransfer;
      // 隐藏拖动图像
      function findImg(DOM) {
        for (let child of DOM.children) {
          if (child.localName == "img") { tempImg = child; return; }
          findImg(child);
        }
      }
      findImg(e.fromElement);
      data.setDragImage(document.createElement("img"), 0, 0);
      // 拖入模型
      dragFromOutside = true;
      switch(dragData.type){
        case "asset":
          let DT = dragData.data.DT;
          dragModel = this.scene.createMeshFromAsset(DT, this.intersectObject(e)[1]);
          break;
        case "model":
          let item = dragData.item;
          dragModel = this.scene.createMesh(item, this.intersectObject(e)[1]);
          break;
        default: return;
      }
      dragModel.isDrag = true;
      dragModel.material.transparent = true;
      tempOpacity = dragModel.material.opacity;
      dragModel.material.opacity = tempOpacity / 2;
      tempModel = dragModel.clone();
      tempModel.visible = false;
    },
    onDragleave(e) {
      if (dragModel) {
        dragFromOutside = false;
        dragModel.DT.destroy();
        dragModel = null;
      }
      tempModel.remove();
      e.dataTransfer.setDragImage(tempImg, 0, 0);
    },
    onDragover(e) {
      e.preventDefault();
      if (dragModel && tempModel) {
        var attachPoint1;
        tempModel.position.set(0, 0, 0);
        let box = new THREE.Box3().setFromObject(tempModel);
        if (!dragFromOutside) {  // 拖动时，物体位置 = 鼠标与平面z=H的交点坐标 + Δp
          let point;
          if (dragModel.userData.isConveyor){  // 拖入传送带时
            attachPoint1 = dragModel.getObjectByName('ap1');
            if (keys.space) {  // 检查空格键和左键是否同时被按下
              let minDistance = Infinity;  // 初始化最小距离为无穷大
              let closestAttachPoint2 = null;
              let worldPositionAP1 = new THREE.Vector3();
              attachPoint1.getWorldPosition(worldPositionAP1);  // 获取ap1在世界坐标系中的位置
              this.scene.SCENE.traverse((child) => {  // 遍历场景中的所有对象，寻找名为'ap2'的物体
                if (child.name === 'ap2') {
                  let worldPositionAP2 = new THREE.Vector3();
                  child.getWorldPosition(worldPositionAP2);  // 获取ap2在世界坐标系中的位置
                  // console.log("ap2 position is" , worldPositionAP2);
                  let distance = worldPositionAP1.distanceTo(worldPositionAP2);
                  if (distance < minDistance) { // 更新最近的ap2
                    minDistance = distance;
                    closestAttachPoint2 = child;
                  }
                }
              });
              if (closestAttachPoint2 && minDistance < 1) {// 如果找到最近的ap2，并且距离小于1
                const newWorldPosition = new THREE.Vector3();
                closestAttachPoint2.getWorldPosition(newWorldPosition);
                const offset = newWorldPosition.sub(worldPositionAP1);// 计算从 dragModel 到 ap1 当前世界位置的偏移
                const rotationChange = closestAttachPoint2.parent.rotation
                dragModel.rotation.x = rotationChange.x;  // X轴旋转
                dragModel.rotation.y = rotationChange.y;  // Y轴旋转
                if (dragModel.DT.name=="直道"){
                  dragModel.rotation.z = rotationChange.z;}
                  else{
                    dragModel.rotation.z = rotationChange.z-Math.PI/2;
                    console.log(dragModel)
                  }
                dragModel.position.add(offset);  // 更新 dragModel 的位置
                this.scene.updateMatrixWorld(true);  // 确保场景中所有变换都是最新的
              }
            };
          }
          if (e.shiftKey) {  // 左键+shift拖动物体以改变其高度
            point = dragPoint.clone();
            point.z = this.intersectPlaneV(e, dragPoint).z;
          }
          else {  // 左键拖动物体在水平面内移动
            if (dragModel.userData.isConveyor){  // 拖动传送带时
              let minDistance = Infinity;  // 初始化最小距离为无穷大
              let closestAttachPoint2 = null;
              let worldPositionAP1 = new THREE.Vector3();
              let initialColor1 = attachPoint1.material.color.clone();  // 存储原始颜色
              let hasColorChanged = false;  // 标记颜色是否已经被改变
              attachPoint1.getWorldPosition(worldPositionAP1);  // 获取ap1在世界坐标系中的位置
              this.scene.SCENE.traverse((child) => {  // 遍历场景中的所有对象，寻找名为'ap2'的物体
                if (child.name === 'ap2') {
                  let worldPositionAP2 = new THREE.Vector3();
                  child.getWorldPosition(worldPositionAP2);  // 获取ap2在世界坐标系中的位置
                  // console.log("ap2 position is" , worldPositionAP2);
                  let distance = worldPositionAP1.distanceTo(worldPositionAP2);
                  if (distance < minDistance) { // 更新最近的ap2
                    minDistance = distance;
                    closestAttachPoint2 = child;
                    if (distance < 1.5) {
                      // 在距离小于1.5时变金色
                      attachPoint1.material.color.set('gold');
                      child.material.color.set('gold');
                      hasColorChanged = true;
                    }
                    else { 
                      attachPoint1.material.color.set('red');
                      closestAttachPoint2.material.color.set('lime');
                    }
                  }
                }
              });
              if (minDistance > 1.5 && hasColorChanged) {
                // 如果距离大于1.5，并且颜色已经改变了，恢复原始颜色
                attachPoint1.material.color.set('red');
                if (closestAttachPoint2) {
                  closestAttachPoint2.material.color.set('lime');  // 假设我们也存储了closestAttachPoint2的原始颜色
                }
                hasColorChanged = false; // 更新颜色改变标记
              }
            }
            point = this.intersectPlaneH(e, dragPoint);
          }
          point.add(delta);  // 更新模型的全局坐标
          tempModel.position.copy(dragModel.parent.worldToLocal(point));  // 将模型的全局坐标转换为局部坐标
        }
        else {  // 从外部拖入模型时将其包围盒中心移到鼠标
          let intersect = this.intersectObject(e);
          tempModel.position.copy(intersect[1]);
          tempModel.position.x -= (box.max.x + box.min.x) / 2;
          tempModel.position.y -= (box.max.y + box.min.y) / 2;
          box = new THREE.Box3().setFromObject(tempModel);  // 包围盒
          let box0 = new THREE.Box3().setFromObject(intersect[0]);
          tempModel.position.z += box0.max.z - box.min.z;
        }
        dragModel.position.copy(tempModel.position);
      }
      else if(dragModel.isLight){  // 拖动光源
        e = {
          offsetX: e.offsetX + delta.x,
          offsetY: e.offsetY + delta.y,
          shiftKey: e.shiftKey,
          target:{
            clientWidth: e.target.clientWidth,
            clientHeight: e.target.clientHeight,
          }
        };
        if (e.shiftKey) {  // 左键+shift拖动物体以改变其高度
          dragModel.position.z = this.intersectPlaneV(e, delta.pos).z;
        } else {  // 左键拖动物体在水平面内移动
          dragModel.position.copy(this.intersectPlaneH(e, delta.pos));
        }
      }
    },
    onDrop() {
      if (dragModel) {
        dragFromOutside = dragModel.isDrag = false;
        if (tempOpacity) {
          dragModel.material.opacity = tempOpacity;
          tempOpacity = null;
        }
        if (dragModel.DT.rigid) { dragModel.DT.createRigidBody() }
        if (!this.scene.DTObjects.value.includes(dragModel.DT)) {
          this.scene.DTObjects.value.push(dragModel.DT);
        }
        if (tempModel) tempModel.clear();
        dragModel = tempModel = null;
      }
      global.emit("updateTree");
    },
    onKeydown(k) {
      if (k.code == "Delete") global.emit("deleteChoices");
      else if (k.code == "ShiftLeft") keys.shift = true;
      else if (k.code == "Space") keys.space = true;
    },
    onKeyup(k) {
      if (k.code == "Space") keys.space = false;
    },
    onMousedown(e) {
      global.emit("deselectAsset");
      mouseType[e.button] = true;
      if (mouseType[0]) {
        if (mouseType[2]) { }  // 双击左右键则移动
        else if (global.mode() == "edit") {  // 左键点击
          if (e.target.localName == "div"){
            let result = this.intersectObject(e);
            let choice = result[0];
            let parent = choice.parent;
            if (choice.userData.controller) return;  // 点击控制器则忽略后文
            dragPoint = result[1];
            if (parent.userData.indicator) choice = parent;  // 点击指示箭头
            if (parent.userData.rigidHelper) choice = parent;  // 点击碰撞体
            if (choice.DT && !choice.userData.ground) {
              global.emit("clickModel", {id: choice.id, shift: e.shiftKey});
              delta = new THREE.Vector3();
              result[0].getWorldPosition(delta);
              delta.sub(result[1]);  // Δp = 选中物体的全局坐标 - 物体上点击处的坐标
              dragModel = choice;
              dragModel.isDrag = true;
              tempModel = dragModel.clone();
              tempModel.children = tempModel.children.filter(
                mesh => !mesh.isTransformControls
              )
              tempOpacity = dragModel.material.opacity;
              //this.scene.outlinePass.selectedObjects = [tempModel];
              isDrag = true;
              if (dragModel.DT.rigid) {
                this.scene.removeRigidBody(dragModel);
              }
            } else {  // 取消选择
              if(e.target.localName == "div") global.emit("deselect");  // 避免点击img时取消选择
            }
          }
          else if(e.target.localName == "img"){  // 拖动灯光
            let id = parseInt(e.target.id);  // 若id为数字字符串则转换为数字
            global.emit("clickModel", {id: id, shift: e.shiftKey}); 
            let choice = this.scene.SCENE.getObjectById(id);
            let rect = e.target.getBoundingClientRect();
            let P = new THREE.Vector2(
              rect.left + e.target.clientWidth / 2,
              rect.top + e.target.clientHeight / 2
            );
            let P_e = new THREE.Vector2(e.clientX, e.clientY);
            P.sub(P_e);  // Δp = 选中物体的全局坐标 - 物体上点击处的坐标
            delta = {x: P.x, y: P.y, pos: choice.position};
            dragModel = choice;
            isDrag = true;
          }
        }
      }
      else {
        // 中键或右键点击
      };
    },
    onMousemove(e) {
      if (mouseType[0] && mouseType[2]) {
        this.scene.orbitControl.mouseButtons = {
          LEFT: MOVE, MIDDLE: -1, RIGHT: MOVE
        };
      } else if (mouseType[0]) {
        this.scene.orbitControl.mouseButtons = {
          LEFT: global.mode() == "edit" ? -1 : ROTATE, MIDDLE: isDrag ? -1 : ZOOM, RIGHT: -1
        };
      } else if (mouseType[1]) {
        this.scene.orbitControl.mouseButtons = {
          LEFT: -1, MIDDLE: MOVE, RIGHT: -1
        };
      } else if (mouseType[2]) {
        this.scene.orbitControl.mouseButtons = {
          LEFT: -1, MIDDLE: -1, RIGHT: ROTATE
        };
      }
      if (isDrag) this.onDragover(e);
    },
    onMouseup(e) {
      mouseType[e.button] = false;
      if (isDrag) {
        this.onDrop();
        isDrag = false;
      }
    },
    onWheel(e) {  // 滚轮事件
      if (dragModel) {  // 拖动物体+滚轮=旋转物体
        this.scene.orbitControl.enableZoom = false;
        dragModel.rotateOnWorldAxis(UP, e.deltaY * Math.PI / 1200);
      } else {  // 滚轮放缩镜头
        this.scene.orbitControl.enableZoom = true;
      }
    },
    remove() { this.scene.SCENE.remove(dragModel) },
    resizeCanvas() {  //让画布大小和父组件大小相适应
      const k = 10;
      let width = window.innerWidth, height = window.innerHeight;
      if (!fullscreen) {  // 直接预览
        let tab = canvas;
        for (let i = 0; i < 4; i++) { tab = tab.parentElement; }
        width = canvas.clientWidth;
        height = tab.clientHeight - tab.children[0].clientHeight - 4;
      }  // 否则全屏预览
      let ratio = width / height;
      this.scene.cssRenderer.setSize(width, height);
      this.scene.renderer.setPixelRatio(ratio);
      this.scene.renderer.setSize(width, height);
      // 调整相机的分辨率
      this.scene.cameraOrtho.left = -k * ratio;
      this.scene.cameraOrtho.right = k * ratio;
      this.scene.cameraOrtho.top = k;
      this.scene.cameraOrtho.bottom = -k;
      this.scene.cameraPersp.aspect = ratio;
      this.scene.cameraPersp.updateProjectionMatrix(); 
      global.emit("updateEdgeGlow", {width: width, height: height});
    },
    setControl(key, action) {  // 设置快捷键（左键、中间、右键：平移、旋转、放缩）
      var map = {
        "NONE": -1,  // 无
        "PAN": THREE.MOUSE.PAN,  // 平移
        "ROTATE": THREE.MOUSE.ROTATE,  // 旋转
        "DOLLY": THREE.MOUSE.DOLLY,  // 放缩
      }
      let act = map[action];
      let button = this.scene.orbitControl.mouseButtons;
      if (key == "LEFT") button.LEFT = act;  // 左键
      else if (key == "MIDDLE") button.MIDDLE = act;  // 中键
      else if (key == "RIGHT") button.RIGHT = act;  // 右键
    }
  },
  mounted() {
    app = document.getElementById("app");
    canvas = document.getElementById("canvas");
    this.scene = new DTScene(canvas);
    this.scene.init();
    this.rendered = true;
    this.resizeCanvas();
    resizeObserver.observe(canvas.parentElement.parentElement.parentElement);
    window.addEventListener("keydown", (k) => {
      if (k.code == "Escape" && fullscreen) {
        global.emit("changeFullscreen");
      }
    });
  },
});