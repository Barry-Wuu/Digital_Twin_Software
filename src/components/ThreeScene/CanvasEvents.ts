import { defineComponent, ref, watch } from "vue"
import * as THREE from "three"
import DTScene from "./DTScene"
import global from "../GlobalVariables"
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { LuminosityShader } from 'three/examples/jsm/shaders/LuminosityShader.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { SobelOperatorShader } from 'three/examples/jsm/shaders/SobelOperatorShader.js';

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
var moveStart = null;  // 用左键移动镜头之前，射线检测器与地面的交点
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
    name:"ThreeScene",
    props:{},
    components:{},
    data(){
      resizeObserver = new ResizeObserver(()=>{this.resizeCanvas()});
      global.on("dragModelStart", (data)=>{dragData = data;});
      global.on("dropout", ()=>dragModel.remove());
      global.on("canvasFullscreen", ()=>{  // 全屏或退出全屏
        fullscreen = !fullscreen;
        if(fullscreen){ 
          parent = canvas.parentElement;
          style = canvas.style;
          canvas.style = 
            "position: absolute;" +
            "top: 0px; left: 0px;" +
            "zIndex: 114514;";  // 让画布盖住其它组件\
          app.appendChild(canvas);  
        } else {
          canvas.style = style;
          parent.appendChild(canvas);
        }
        global.emit("changeQuitFullscreen", fullscreen);
        this.resizeCanvas();
      });
      return{
        description: null,
        rendered: false,
      }
    },
    methods:{
      castRay(e){  // 射线检测
        const mouse = new THREE.Vector2(e.offsetX*2/e.target.width-1, 1-e.offsetY*2/e.target.height);
        ray.setFromCamera(mouse, this.scene.camera);
      },
      intersectObject(e){  // 求鼠标发出的射线与物体的交点
        this.castRay(e);  // 射线检测
        for(let intersect of ray.intersectObject(this.scene.SCENE)){
          let mesh = intersect.object;
          if(mesh.isTransformControlsPlane) continue;
          if(mesh.isMesh && mesh != dragModel && mesh != tempModel){
            return [mesh, intersect.point];
          }
        }
        return new THREE.Vector3( 999, 999, 999 )  // 若无交点
      },
      intersectGround(e){  // 求鼠标发出的射线与地面的交点
        this.castRay(e);  // 射线检测
        for(let intersect of ray.intersectObject(this.scene.ground)){
          if(intersect.object.isMesh)
            {return [intersect.object, intersect.point];}
        }
        return new THREE.Vector3( 999, 999, 999 )  // 若无交点
      },
      intersectPlaneH(e, P){  // 求鼠标发出的射线与平面z=P.z的交点
        this.castRay(e);  // 射线检测
        let plane = new THREE.Plane(), result = new THREE.Vector3();
        plane.setFromNormalAndCoplanarPoint(UP, P);  // 作过点P且法向量朝上的水平平面
        ray.ray.intersectPlane(plane, result);  // 返回射线检测器与该平面的交点
        return result;
      },
      intersectPlaneV(e, P){  // 求鼠标发出的射线与过点P且与视野正前方垂直的平面的交点
        this.castRay(e);  // 射线检测
        this.scene.camera.getWorldDirection(front);  // 求视野的正前方的方向向量
        let plane = new THREE.Plane(), result = new THREE.Vector3();
        plane.setFromNormalAndCoplanarPoint(front, P);  // 作过点P且法向量朝视野正前方的竖直平面
        ray.ray.intersectPlane(plane, result);  // 返回射线检测器与该平面的交点
        return result;
      },
      onDragenter(e){
        let data = e.dataTransfer;
        // 隐藏拖动图像
        function findImg(DOM){
          for(let child of DOM.children){
            if(child.localName == "img") {tempImg = child; return;}
            findImg(child);
          }
        }
        findImg(e.fromElement);
        data.setDragImage(document.createElement("img"), 0 ,0);console.log()
        // 拖入模型
        let DT, modelName;
        dragFromOutside = true;
        if(dragData.type == "asset"){
          DT = dragData.data.DT;
          dragModel = this.scene.createGeometryFromAsset(DT, this.intersectObject(e)[1]);
        }
        if(dragData.type == "model"){
          modelName = dragData.data;
          dragModel = this.scene.createGeometry(modelName, this.intersectObject(e)[1]);
        }
        else return;
        dragModel.isDrag = true;
        dragModel.material.transparent = true;
        tempOpacity = dragModel.material.opacity;
        dragModel.material.opacity = tempOpacity/2;
        tempModel = dragModel.clone();
        tempModel.visible = false;
      },
      onDragleave(e){
        if(dragModel){
          dragFromOutside = false;
          dragModel.DT.destroy();
          dragModel = null;
        }     
        tempModel.remove();
        e.dataTransfer.setDragImage(tempImg, 0 ,0);
      },
      onDragover(e){
        e.preventDefault();
        if(tempModel && dragModel){
          tempModel.position.set(0, 0, 0);
          let box = new THREE.Box3().setFromObject(tempModel);
          if(!dragFromOutside){  // 拖动时，物体位置 = 鼠标与平面z=H的交点坐标 + Δp
            let point;
            if(e.shiftKey) {  // 左键+shift拖动物体以改变其高度
              point = dragPoint.clone();
              point.z = this.intersectPlaneV(e, dragPoint).z;
            }
            else point = this.intersectPlaneH(e, dragPoint);  // 左键拖动物体在同一高度内移动
            point.add(delta);
            tempModel.position.copy(point);
          }
          else{  // 从外部拖入模型时将其包围盒中心移到鼠标
            let intersect = this.intersectObject(e);
            tempModel.position.copy(intersect[1]);
            tempModel.position.x -= (box.max.x+box.min.x)/2;
            tempModel.position.y -= (box.max.y+box.min.y)/2;
            box = new THREE.Box3().setFromObject(tempModel);  // 包围盒
            let box0 = new THREE.Box3().setFromObject(intersect[0]);
            tempModel.position.z += box0.max.z - box.min.z;
          } 
          dragModel.position.copy(tempModel.position);
        }
      },
      onDrop(){
        if(dragModel){
          dragFromOutside = dragModel.isDrag = false;
          dragModel.material.opacity = tempOpacity;
          if(dragModel.DT.rigid){dragModel.DT.createRigidBody()}
          if(!this.scene.DTObjects.value.includes(dragModel.DT)){
            this.scene.DTObjects.value.push(dragModel.DT);
          }
          dragModel = null;
          if(tempModel) tempModel.clear();
        }
        global.emit("updateTree");
      },
      onKeyup(k){
        // 按键抬起
      },
      onKeydown(k){
        if(k.code == "Delete") global.emit("deleteChoices");
      },
      onMousedown(e){
        global.emit("deselectAsset");
        mouseType[e.button] = true;
        if(mouseType[0]){
          if(mouseType[2]){}  // 双击左右键则移动
          else if(global.mode() == "edit"){  // 左键点击
            let result = this.intersectObject(e);
            let choice = result[0];
            if(choice.userData.controller) return;  // 点击控制器则忽略后文
            dragPoint = result[1];
            if(choice.userData.indicator) choice = choice.parent;  // 点击指示箭头
            if(choice.DT && !choice.userData.ground){
              global.emit("clickModel", choice.id + ',' + e.shiftKey); 
              delta.subVectors(result[0].position, result[1]);  // Δp = 选中物体的坐标 - 物体上点击处的坐标
              dragModel = choice;
              dragModel.isDrag = true;
              tempModel = dragModel.clone();
              tempOpacity = dragModel.material.opacity;
              isDrag = true;
              if(dragModel.DT.rigid){
                this.scene.removeRigidBody(dragModel);
              }
            } else {
              global.emit("deselect")
            }
          }
        }
        else{  // 中键或右键点击
          this.castRay(e);  // 射线检测
          moveStart = ray.intersectObject(this.scene.ground)[0].point;
        };
      },
      onMousemove(e){
        if(mouseType[0] && mouseType[2]){
          this.scene.orbitControl.mouseButtons = {
            LEFT: MOVE, MIDDLE: -1, RIGHT: MOVE
          };
        } else if(mouseType[0]){
          this.scene.orbitControl.mouseButtons = {
            LEFT: global.mode() == "edit" ? -1 : ROTATE, MIDDLE: isDrag ? -1 : ZOOM, RIGHT: -1
          };
        } else if(mouseType[1]){
          this.scene.orbitControl.mouseButtons = {
            LEFT: -1, MIDDLE: MOVE, RIGHT: -1
          };
        } else if(mouseType[2]){
          this.scene.orbitControl.mouseButtons = {
            LEFT: -1, MIDDLE: -1, RIGHT: ROTATE
          };
        }
        if(isDrag) this.onDragover(e);
        if(moveStart){
          this.castRay(e);  // 射线检测
          try{
            let move = ray.intersectObject(this.scene.ground)[0].point;
          }
          catch (e) {} 
        }
      },
      onMouseup(e){
        mouseType[e.button] = false;
        if(isDrag){ 
          this.onDrop(e);
          isDrag = false;
        }
        else{ moveStart = null; }
      },
      onWheel(e){  // 滚轮事件
        if(dragModel){  // 拖动物体+滚轮=旋转物体
          this.scene.orbitControl.enableZoom = false;     
          dragModel.rotateOnWorldAxis(UP, e.deltaY*Math.PI/1200);
        } else {  // 滚轮放缩镜头
          this.scene.orbitControl.enableZoom = true;
        }
      },
      remove(){this.scene.SCENE.remove(dragModel)},
      resizeCanvas() {  //让画布大小和父组件大小相适应
        let composer = this.scene.composer;
        let width = window.innerWidth, height = window.innerHeight;
        document.getElementById("canvas").style.width = "444px";
        if(!fullscreen){  // 直接预览
          let tab = canvas;
          for(let i=0; i<4; i++){tab = tab.parentElement;}
          width = tab.clientWidth;  
          height = tab.clientHeight - tab.children[0].clientHeight - 4; 
        }  // 否则全屏预览
        this.scene.camera.aspect = width / height;
        this.scene.camera.updateProjectionMatrix();
        this.scene.renderer.setSize(width, height);
        composer.setSize(width, height);
        if(composer.passes[1]) composer.passes[1].resolution.set(width, height);
        if(composer.passes[2]) 
          composer.passes[2].uniforms['resolution'].value.set(1/width, 1/height);
      },
      setControl(key, action){  // 设置快捷键（左键、中间、右键：平移、旋转、放缩）
        var map = {
          "NONE": -1,  // 无
          "PAN": THREE.MOUSE.PAN,  // 平移
          "ROTATE": THREE.MOUSE.ROTATE,  // 旋转
          "DOLLY": THREE.MOUSE.DOLLY,  // 放缩
        }
        let act = map[action];
        let button = this.scene.orbitControl.mouseButtons;
        if(key == "LEFT") button.LEFT = act;  // 左键
        else if(key == "MIDDLE") button.MIDDLE = act;  // 中键
        else if(key == "RIGHT") button.RIGHT = act;  // 右键
      }
    },
    mounted(){
      canvas = document.getElementById("canvas");  
      app = document.getElementById("app"); 
      this.scene = new DTScene(canvas);
      this.scene.init();
      this.rendered = true;
      this.resizeCanvas();
      resizeObserver.observe(canvas.parentElement.parentElement.parentElement);
      window.addEventListener("keydown", (k)=>{
        if(k.code == "Escape" && fullscreen){
          global.emit("canvasFullscreen");
        }
      });
    },
  }
);