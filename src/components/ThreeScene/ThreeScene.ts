import { defineComponent, onMounted } from "vue";
import * as THREE from 'three';
import SceneBuilder from './SceneBuilder';
import BUS from "../Eventbus"

var dragModel;
var dragName
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
          this.updateTree()
        },
        event2ground(e){
          const mouse = new THREE.Vector2(e.offsetX*2/e.target.width-1, 1-e.offsetY*2/e.target.height)
          const raycaster = new THREE.Raycaster();
          raycaster.setFromCamera(mouse, this.scene.camera);
          const P0 = raycaster.ray.origin;
          const P = raycaster.ray.direction;
          const k = -P0.y/P.y
          return {x:P0.x+k*P.x, z:P0.z+k*P.z}
        },
        hover(e){
          e.preventDefault();
          const xz = this.event2ground(e);
          dragModel.position.x = xz.x;
          dragModel.position.z = xz.z;
        },
        leave(){
          console.log(dragModel)
          dragModel.parent.remove(dragModel);
        },
        preview(e){
          let data = dragName.data;
          if(dragName.type != "modelName")return;
          const xz = this.event2ground(e);
          dragModel = this.scene.createGeometry(data, [xz.x, 0.0, xz.z])
          dragModel.material.transparent = true;
          dragModel.material.opacity = 0.5;
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