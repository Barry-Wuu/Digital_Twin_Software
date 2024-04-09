import { defineComponent, ref, watch } from "vue";
import * as THREE from 'three';
import DTScene from './DTScene';
import BUS from "../EventBus"

var app;
var canvas;
var delta = new THREE.Vector3();
var dragFromOutside;  // 是否从外界拖入
var dragModel;
var dragName;
var dragPoint;  // 拖动开始时的拖动点
var fullscreen = false;
var isDrag = false;  // 是否在用鼠标移动模型
var keys = {shift: false};  // 按下的按键
var mode = "edit";  // 编辑模式（edit）或浏览模式（view）
var moveStart = null;  // 用左键移动镜头之前，射线检测器与地面的交点
var mouseType = [false, false, false];  // 左、中、右键是否按下
const ray = new THREE.Raycaster();  // 从鼠标发出的射线检测器
var resizeObserver;
var style;
var tempModel;
var tempOpacity;

var MOVE = THREE.MOUSE.PAN;
var ROTATE = THREE.MOUSE.ROTATE;
var ZOOM = THREE.MOUSE.DOLLY;
var FRONT = new THREE.Vector3(0, 1, 0);
var UP = new THREE.Vector3(0, 0, 1);  // z轴朝上
var DOWN = new THREE.Vector3(0, 0, -1);

export default defineComponent({
    name:"ThreeScene",
    props:{},
    components:{},
    data(){
      resizeObserver = new ResizeObserver(()=>{
        this.resizeCanvas()
      });
      BUS.on("dragstart", (data)=>{dragName = data;});
      BUS.on("dropout", ()=>dragModel.remove());
      BUS.on("canvasFullscreen", ()=>{  // 全屏或退出全屏
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
        BUS.emit("changeQuitFullscreen", fullscreen);
        this.resizeCanvas();
      });
      BUS.on('modeSelect', data => mode = data);
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
      event2face(e){  // 求鼠标发出的射线与物体的交点
        this.castRay(e);  // 射线检测
        for(let intersect of ray.intersectObject(this.scene.SCENE)){
          if(intersect.object.type == "Mesh" && intersect.object != dragModel 
          && intersect.object != tempModel){
            return [intersect.object, intersect.point];
          }
        }
        return new THREE.Vector3( 999, 999, 999 )  // 若无交点
      },
      event2ground(e){  // 求鼠标发出的射线与地面的交点
        this.castRay(e);  // 射线检测
        for(let intersect of ray.intersectObject(this.scene.ground)){
          if(intersect.object.type == "Mesh")
            {return [intersect.object, intersect.point];}
        }
        return new THREE.Vector3( 999, 999, 999 )  // 若无交点
      },
      event2planeH(e, P){  // 求鼠标发出的射线与平面z=P.z的交点
        this.castRay(e);  // 射线检测
        let plane = new THREE.Plane(), result = new THREE.Vector3();
        plane.setFromNormalAndCoplanarPoint(UP, P);  // 作过点P且法向量朝上的水平平面
        ray.ray.intersectPlane(plane, result);  // 返回射线检测器与该平面的交点
        return result;
      },
      event2planeV(e, P){  // 求鼠标发出的射线与过点P且与视野正前方垂直的平面的交点
        this.castRay(e);  // 射线检测
        let front = FRONT.clone();  // 求视野的正前方的方向向量
        front.applyEuler(this.scene.camera.rotation);
        front.z = 0;
        front.normalize();
        let plane = new THREE.Plane(), result = new THREE.Vector3();
        plane.setFromNormalAndCoplanarPoint(front, P);  // 作过点P且法向量朝视野正前方的竖直平面
        ray.ray.intersectPlane(plane, result);  // 返回射线检测器与该平面的交点
        return result;
      },
      onDragenter(e){
        let modelName = dragName.data;
        if(dragName.type != "modelName") return;
        dragFromOutside = true;
        dragModel = this.scene.createGeometry(modelName, this.event2face(e)[1]);
        dragModel.isDrag = true;
        dragModel.material.transparent = true;
        tempOpacity = dragModel.material.opacity;
        dragModel.material.opacity = tempOpacity/2;
        tempModel = dragModel.clone();
        tempModel.visible = false;
      },
      onDragleave(){
        if(dragModel){
          dragFromOutside = false;
          dragModel.DT.destroy();
          dragModel = null;
        }     
        tempModel.remove();
      },
      onDragover(e){
        e.preventDefault();
        if(tempModel && dragModel){
          tempModel.position.set(0, 0, 0);
          let box = new THREE.Box3().setFromObject(tempModel);
          if(!dragFromOutside){  // 拖动时，物体位置 = 鼠标与平面z=H的交点坐标 + Δp
            let point;
            if(keys.shift) point = this.event2planeV(e, dragPoint);  // 左键+shift拖动物体以改变其高度
            else point = this.event2planeH(e, dragPoint);  // 左键拖动物体在同一高度内移动
            point.add(delta);
            tempModel.position.copy(point);
          }
          else{  // 从外部拖入模型时将其包围盒中心移到鼠标
            let intersect = this.event2face(e);
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
          if(dragName) dragName.data.modeltype = null;
          tempModel.clear();
        }
        BUS.emit("updateTree");
      },
      onKeyup(k){
        if(k.code == "ShiftLeft") keys.shift = false;
      },
      onKeydown(k){
        if(k.code == "Delete") BUS.emit("deleteChoices");
        else if(k.code == "ShiftLeft") keys.shift = true;
      },
      onMousedown(e){
        mouseType[e.button] = true;
        if(mouseType[0]){
          if(mouseType[2]){}  // 双击左右键则移动
          else if(mode == "edit"){  // 左键点击
            let result = this.event2face(e);
            let choice = result[0];
            dragPoint = result[1];
            if(choice.userData.indicator) choice = choice.parent;  // 点击指示箭头
            if(choice.DT && !choice.userData.ground){
              if(choice){
                BUS.emit("clickModel", choice.id + ',' + keys.shift);
              }  
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
              BUS.emit("deselect")
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
          this.scene.cameraControls.mouseButtons = {
            LEFT: MOVE, MIDDLE: -1, RIGHT: MOVE
          };
        } else if(mouseType[0]){
          this.scene.cameraControls.mouseButtons = {
            LEFT: mode == "edit" ? -1 : ROTATE, MIDDLE: isDrag ? -1 : ZOOM, RIGHT: -1
          };
        } else if(mouseType[1]){
          this.scene.cameraControls.mouseButtons = {
            LEFT: -1, MIDDLE: MOVE, RIGHT: -1
          };
        } else if(mouseType[2]){
          this.scene.cameraControls.mouseButtons = {
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
          this.scene.cameraControls.enableZoom = false;     
          dragModel.rotateOnWorldAxis(UP, e.deltaY*Math.PI/1200);
        } else {  // 滚轮放缩镜头
          this.scene.cameraControls.enableZoom = true;
        }
      },
      remove(){this.scene.SCENE.remove(dragModel)},
      resizeCanvas() {  //让画布大小和父组件大小相适应
        let width = window.innerWidth, height = window.innerHeight;
        if(!fullscreen){  // 直接预览
          let tab = canvas;
          for(let i=0; i<4; i++){tab = tab.parentElement;}
          width = canvas.clientWidth;  
          height = tab.clientHeight - tab.children[0].clientHeight - 4; 
        }  // 否则全屏预览
        this.scene.renderer.setSize(width, height);
        this.scene.camera.aspect = width / height;
        this.scene.camera.updateProjectionMatrix();
      },
      setControl(key, action){  // 设置快捷键（左键、中间、右键：平移、旋转、放缩）
        var map = {
          "NONE": -1,  // 无
          "PAN": THREE.MOUSE.PAN,  // 平移
          "ROTATE": THREE.MOUSE.ROTATE,  // 旋转
          "DOLLY": THREE.MOUSE.DOLLY,  // 放缩
        }
        let act = map[action];
        let button = this.scene.cameraControls.mouseButtons;
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
          BUS.emit("canvasFullscreen");
        }
      });
    },
  }
);