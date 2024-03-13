import { defineComponent, ref, watch } from "vue";
import * as THREE from 'three';
import DTScene from './DTScene';
import BUS from "../EventBus"

var cameraPosition;
var cameraRotation;
var canvas;
var dragModel;
var dragMovable = true;  // 拖动刚体
var dragName;
var isDrag = false;  // 是否在用鼠标移动模型
var moveStart = null;  // 用左键移动镜头之前，射线检测器与地面的交点
var mouseType;  // 判断鼠标按键类型
const ray = new THREE.Raycaster();  // 从鼠标发出的射线检测器
var resizeObserver;
var shift = false;
var tempModel;
var tempOpacity;
var tempPosition = null;
var up = new THREE.Vector3(0, 0, 1);

export default defineComponent({
    name:"ThreeScene",
    props:{},
    components:{},
    data(){
      resizeObserver = new ResizeObserver(()=>this.resize());
      BUS.on('dragstart', (data)=>{dragName = data;});
      BUS.on('dropout', ()=>dragModel.remove());
      BUS.on('resize', ()=>this.resize());
      return{
        description: null,
        rendered: false,
      }
    },
    methods:{
        dragenter(e){
          let modelName = dragName.data;
          if(dragName.type != "modelName")return;
          dragModel = this.scene.createGeometry(modelName, this.event2face(e)[1]);
          dragModel.isDrag = true;
          dragModel.material.transparent = true;
          tempOpacity = dragModel.material.opacity;
          dragModel.material.opacity = tempOpacity/2;
          tempModel = dragModel.clone();
          tempModel.visible = false;
        },
        dragover(e){
          e.preventDefault();
          if(tempModel && dragModel){
            tempModel.position.set(0, 0, 0);
            let box = new THREE.Box3().setFromObject(tempModel);
            let intersect = this.event2face(e);
            tempModel.position.copy(intersect[1]);
            tempModel.position.x -= (box.max.x+box.min.x)/2;  // 将模型的包围盒中心移到鼠标
            tempModel.position.y -= (box.max.y+box.min.y)/2;
            box = new THREE.Box3().setFromObject(tempModel);  // 包围盒
            let box0 = new THREE.Box3().setFromObject(intersect[0]);
            tempModel.position.z += box0.max.z - box.min.z;
            dragModel.position.copy(tempModel.position);
          }
        },
        dragleave(){
          if(dragModel){
            dragModel.DT.destroy();
            dragModel = null;
          }     
          tempModel.remove();
        },
        drop(){
          dragModel.isDrag = false;
          dragModel.material.opacity = tempOpacity;
          if(dragModel.DT.rigid){dragModel.DT.createRigidBody()}
          dragModel = null;
          dragName.data.modeltype = null;
          dragMovable = false;
          tempModel.clear();
          BUS.emit("updateTree");
        },
        event2face(e){
          const mouse = new THREE.Vector2(e.offsetX*2/e.target.width-1, 1-e.offsetY*2/e.target.height);
          ray.setFromCamera(mouse, this.scene.camera);  // 射线检测
          for(let intersect of ray.intersectObject(this.scene.SCENE)){
            if(intersect.object.type == "Mesh" && intersect.object != dragModel 
            && intersect.object != tempModel){
              return [intersect.object, intersect.point];
            }
          }
          return new THREE.Vector3( 999, 999, 999 )  // 若无交点
        },
        event2ground(e){
          const mouse = new THREE.Vector2(e.offsetX*2/e.target.width-1, 1-e.offsetY*2/e.target.height);
          ray.setFromCamera(mouse, this.scene.camera);  // 射线检测
          for(let intersect of ray.intersectObject(this.scene.ground)){
            if(intersect.object.type == "Mesh")
              {return [intersect.object, intersect.point];}
          }
          return new THREE.Vector3( 999, 999, 999 )  // 若无交点
        },
        keyup(k){
          if(k.code == "ShiftLeft"){shift = false;}
        },
        keydown(k){
          if(k.code == "Delete") BUS.emit("deleteChoices");
          else if(k.code == "ShiftLeft") shift = true;
        },
        mousedown(e){
          mouseType = e.button;
          if(mouseType == 0){  // 左键点击
            let choice = this.event2face(e)[0];
            if(choice.geometry.type == "ShapeGeometry") choice = choice.parent;
            if(choice != this.scene.ground){
              if(choice.rigid){
                this.scene.removeRigidBody(choice);
                dragMovable = true;
              }
              if(choice){
                BUS.emit("clickModel", choice.id +','+shift);
              }
              dragModel = choice;
              dragModel.isDrag = true;
              tempModel = dragModel.clone();
              tempOpacity = dragModel.material.opacity;
              isDrag = true;
            }
            else{
              BUS.emit("deselect")
            }
          }
          else{  // 中键或右键点击
            tempPosition = new THREE.Vector2(e.offsetX*2/e.target.width-1, 1-e.offsetY*2/e.target.height);
            ray.setFromCamera(tempPosition, this.scene.camera);  // 射线检测
            moveStart = ray.intersectObject(this.scene.ground)[0].point;
            cameraPosition = this.scene.camera.position;
            cameraRotation = this.scene.camera.rotation;
          };
        },
        mousemove(e){
          if(isDrag) this.dragover(e);
          if(moveStart){
            const mouse = new THREE.Vector2(e.offsetX*2/e.target.width-1, 1-e.offsetY*2/e.target.height);
            ray.setFromCamera(mouse, this.scene.camera);  // 射线检测
            try{
              let move = ray.intersectObject(this.scene.ground)[0].point;
              if(mouseType == 1){  // 中键移动镜头
                this.scene.camera.position.x = cameraPosition.x - move.x + moveStart.x;
                this.scene.camera.position.y = cameraPosition.y - move.y + moveStart.y;
              }
              else if (mouseType == 2){  // 右键旋转镜头
                this.scene.camera.rotation.y = cameraRotation.y + (tempPosition.x - mouse.x)/10;
                this.scene.camera.rotation.x = cameraRotation.x + (mouse.y - tempPosition.y)/10;
              }
            }
            catch (e) {} 
          }
        },
        mouseup(e){
          if(isDrag){ 
            this.drop(e);
            isDrag = false;
          }
          else{ moveStart = null; }
        },
        print(x){
          let time = new Date()
            document.getElementById("log").appendChild(document.createTextNode(
              time.toLocaleString() + " —— " + x
            ));
            document.getElementById("log").appendChild(document.createElement('br'));
        },
        redirectToDetailed(){},
        remove(){this.scene.SCENE.remove(dragModel)},
        resize() {  //让画布大小和父组件大小相适应
          let tab = canvas;
          for(let i=0; i<4; i++){tab = tab.parentElement;}
          const width = canvas.clientWidth;  
          const height = tab.clientHeight - tab.children[0].clientHeight - 4;  
          this.scene.renderer.setSize(width, height);
          this.scene.camera.aspect = width / height;
          this.scene.camera.updateProjectionMatrix();
        },
        wheel(e){  // 滚轮事件
          if(dragModel){  // 拖动物体+滚轮=旋转物体
            dragModel.rotateOnWorldAxis(up, e.deltaY*Math.PI/1200);
          }else{  // 滚轮放缩镜头
            const target = this.event2face(e)[1];
            const k = 0.4;
            this.scene.camera.position = this.scene.camera.position.multiplyScalar(1+k*e.deltaY/100)
            .addScaledVector(target.position, -k*e.deltaY/100);
          }
        }
    },
    mounted(){
      canvas = document.getElementById('canvas');  
      this.scene = new DTScene(canvas);
      this.scene.init();
      canvas = document.getElementById('canvas');  
      this.rendered = true;
      this.resize();
      resizeObserver.observe(canvas.parentElement.parentElement.parentElement);
    },
  }
);