import { defineComponent, onMounted, ref, watch } from "vue";
import * as THREE from 'three';
import SceneBuilder from './SceneBuilder';
import BUS from "../EventBus"

var cameraPosition;
var cameraRotation;
var dragModel;
var dragName;
var move = false;  // 用鼠标移动模型
var moveStart;  // 用左键移动镜头之前，射线检测器与地面的交点
var mouseType;  // 判断鼠标按键类型
const ray = new THREE.Raycaster();  // 从鼠标发出的射线检测器
var tempModel;
var tempPosition = null;

export default defineComponent({
    name:"ThreeScene",
    props:{},
    components:{},
    setup(){},
    data(){
      BUS.on('dragstart', (data)=>{dragName = data;});
      BUS.on('dropout', ()=>dragModel.remove());
      BUS.on('updateTree0', ()=>this.updateTree());
      return{
          sketch:null,
          description:null,
          width: 540,
          rendered:false,
      }
    },
    methods:{
        dragenter(e){
          let modelName = dragName.data;
          if(dragName.type != "modelName")return;
          dragModel = this.scene.createGeometry(modelName, this.event2face(e)[1]);console.log(dragModel)
          dragModel.material.transparent = true;
          dragModel.material.opacity = 0.5;
          tempModel = dragModel.clone();
          tempModel.visible = false;
        },
        dragover(e){
          e.preventDefault();
          if(tempModel){
            tempModel.position.set(0, 0, 0)
            let box = new THREE.Box3().setFromObject(tempModel);
            let int = this.event2face(e)
            tempModel.position.copy(int[1])
            tempModel.position.x -= (box.max.x+box.min.x)/2  // 将模型的包围盒中心移到鼠标
            tempModel.position.y -= (box.max.y+box.min.y)/2
            box = new THREE.Box3().setFromObject(tempModel);  // 包围盒
            let box0 = new THREE.Box3().setFromObject(int[0]);
            tempModel.position.z += box0.max.z - box.min.z;
            dragModel.position.copy(tempModel.position);
          }
        },
        dragleave(){
          dragModel.parent.remove(dragModel);
          tempModel.parent.remove(tempModel);
        },
        drop(){
          dragModel.material.opacity = 1;
          dragModel = null;
          dragName.data.modeltype = null;
          tempModel.clear();
          this.updateTree();
        },
        event2face(e){
          if(dragName.data.modeltype == "传送带") return this.event2ground(e);
          const mouse = new THREE.Vector2(e.offsetX*2/e.target.width-1, 1-e.offsetY*2/e.target.height);
          ray.setFromCamera(mouse, this.scene.camera);  // 射线检测
          for(let intersect of ray.intersectObject(this.scene.scene)){
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
        mousedown(e){
          let choice = this.event2face(e)[0];
          if(choice != this.scene.ground){
            if(choice) BUS.emit("clickModel", choice);
            dragModel = choice;
            tempModel = dragModel.clone();
            //tempModel.visible = false;
            move = true;
          }
          else{
            BUS.emit("deselect")
            tempPosition = new THREE.Vector2(e.offsetX*2/e.target.width-1, 1-e.offsetY*2/e.target.height);
            ray.setFromCamera(tempPosition, this.scene.camera);  // 射线检测
            moveStart = ray.intersectObject(this.scene.ground)[0].point;
            cameraPosition = this.scene.camera.position;
            cameraRotation = this.scene.camera.rotation;
            mouseType = e.button;
          };
        },
        mousemove(e){
          if(moveStart){
            const mouse = new THREE.Vector2(e.offsetX*2/e.target.width-1, 1-e.offsetY*2/e.target.height);
            ray.setFromCamera(mouse, this.scene.camera);  // 射线检测
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
        },
        print(x){
          let time = new Date()
            document.getElementById("log").appendChild(document.createTextNode(
              time.toLocaleString() + " —— " + x
            ));
            document.getElementById("log").appendChild(document.createElement('br'));
        },
        redirectToDetailed(){},
        remove(){this.scene.scene.remove(dragModel)},
        Scene(){
          return this.scene ? this.scene.scene : null ;
        },
        updateTree(){BUS.emit('updateTree', this.scene.scene)},
        updateWindowWidth() {
          this.scene.camera.aspect = window.innerWidth / window.innerHeight;
          this.scene.camera.updateProjectionMatrix();
          this.scene.renderer.setSize( window.innerWidth, window.innerHeight );
          this.updateWindowWidth()
        },
        wheel(e){
          const target = this.event2face(e)[1];
          if(dragModel){  // 拖动物体+滚轮=旋转物体
            dragModel.rotateZ(e.deltaY*Math.PI/1200);
          }else{  // 滚轮放缩镜头
            const k = 0.4;
            this.scene.camera.position = this.scene.camera.position.multiplyScalar(1+k*e.deltaY/100)
            .addScaledVector(target.position, -k*e.deltaY/100);
          }
        }
    },
    mounted(){
        this.scene = new SceneBuilder(this.$refs.sketch)
        this.scene.render()
        window.addEventListener('keydown', (e)=>{if(e.key == "Delete"){
          BUS.emit("deleteChoice");
        }});
        window.addEventListener('mousedown', this.mousedown, false);
        window.addEventListener('mousemove', (e)=>{move ? this.dragover(e) : this.mousemove(e)}, false);
        window.addEventListener('mouseup', (e)=>{
          if(move){this.drop(e); move=false}
          else{ moveStart = null;}
        }, false);
        window.addEventListener('resize', this.updateWindowWidth);
        this.rendered = true;
        this.updateTree();
    },
    beforeDestroy() {
        window.removeEventListener('resize', this.updateWindowWidth);
    },
    computed:{}
  }
);