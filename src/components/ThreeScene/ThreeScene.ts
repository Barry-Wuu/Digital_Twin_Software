import { defineComponent, onMounted } from "vue";
import * as THREE from 'three';
import SceneBuilder from './SceneBuilder';
import BUS from "../Eventbus"

var boundingBox;
var dragModel;
var dragName;
var tempModel;

BUS.on('dragstart', (data)=>{dragName = data})
BUS.on('dropout', ()=>dragModel.remove())

export default defineComponent({
    name:"ThreeScene",
    props:{},
    components:{},
    setup(){       
        return {
        }
    },
    data(){
        return{
           sketch:null,
           description:null,
           width: 540,
           rendered:false,
        }
    },
    methods:{
        drop(){
          dragModel.material.opacity = 1;
          tempModel.parent.remove(tempModel);
          this.updateTree()
        },
        event2ground(e){
          const mouse = new THREE.Vector2(e.offsetX*2/e.target.width-1, 1-e.offsetY*2/e.target.height)
          const ray = new THREE.Raycaster();
          ray.setFromCamera(mouse, this.scene.camera);
          const P0 = ray.ray.origin;
          const P = ray.ray.direction;
          const k = -P0.y/P.y
          return {x:P0.x+k*P.x, z:P0.z+k*P.z}
        },
        hover(e){
          e.preventDefault();
          const xz = this.event2ground(e);
          this.set3(tempModel.position, [xz.x, 0, xz.z])
          this.scene.scene.traverse(
            (obj)=>{
              let box = new THREE.Box3().setFromObject(tempModel);  // 包围盒
              if(obj != dragModel && obj != tempModel && ["Mesh"].includes(obj.type)){
                let box0 = new THREE.Box3().setFromObject(obj);
                if(box.intersectsBox(box0)){
                  tempModel.position.y += box0.max.y - box.min.y
                }
              }  
            }
          )
          this.set3(dragModel.position, [xz.x, tempModel.position.y, xz.z])
        },
        leave(){
          dragModel.parent.remove(dragModel);
        },
        preview(e){
          let data = dragName.data;
          if(dragName.type != "modelName")return;
          const xz = this.event2ground(e);
          dragModel = this.scene.createGeometry(data, [xz.x, 0.0, xz.z])
          dragModel.material.transparent = true;
          dragModel.material.opacity = 0.5;
          tempModel = this.scene.createGeometry(data, [xz.x, 0.0, xz.z])
          tempModel.visible = false;
          boundingBox = new THREE.Box3().setFromObject(dragModel);  // 包围盒
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
        set3(vector3, x){
          vector3.x = x[0]; vector3.y = x[1]; vector3.z = x[2]; 
        },
        updateTree(){
          BUS.emit("updateModel", this.scene.Scene())
        },
        updateWindowWidth() {
		        this.scene.camera.aspect = window.innerWidth / window.innerHeight;
            this.scene.camera.updateProjectionMatrix();
            this.scene.renderer.setSize( window.innerWidth, window.innerHeight );
            this.updateWindowWidth()
          }
    },
    mounted(){
        this.scene = new SceneBuilder(this.$refs.sketch)
        this.scene.render()
        window.addEventListener('resize', this.updateWindowWidth);
        this.rendered = true;
        this.updateTree()
    },
    beforeDestroy() {
        window.removeEventListener('resize', this.updateWindowWidth);
      },
    computed:{}
  }
);