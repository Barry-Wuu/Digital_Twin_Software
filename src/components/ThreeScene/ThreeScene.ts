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
          const ray = new THREE.Raycaster();  // 射线
          ray.setFromCamera(mouse, this.scene.camera);
          for(let intersect of ray.intersectObject(this.scene.scene)){
            if(intersect.object.type == "Mesh" 
            && intersect.object != dragModel && intersect.object != tempModel){
              return intersect.point;
            }
          }
          return new THREE.Vector3( 999, 999, 999 )  // 若无交点
        },
        hover(e){
          e.preventDefault();
          this.set3(tempModel.position, this.event2ground(e))
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
          this.set3(dragModel.position, tempModel.position)
        },
        leave(){
          dragModel.parent.remove(dragModel);
        },
        preview(e){
          let data = dragName.data;
          if(dragName.type != "modelName")return;
          dragModel = this.scene.createGeometry(data, this.event2ground(e))
          dragModel.material.transparent = true;
          dragModel.material.opacity = 0.5;
          tempModel = this.scene.createGeometry(data, dragModel.position)
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
        set3(vector3, p){
          vector3.x = p.x; vector3.y = p.y; vector3.z = p.z; 
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