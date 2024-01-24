import * as fs from 'fs';  
import * as THREE from 'three';
import { ColladaLoader } from 'three/examples/jsm/loaders/COLLADALoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ref, toRaw } from 'vue';
import BUS from "../EventBus"

var loader = new STLLoader();
window.SCENE = {}
window.wireframes = {}

export default class SceneBuilder{
    camera: THREE.PerspectiveCamera
    color
    controls: OrbitControls
    ground
    group
    material: THREE.MeshNormalMaterial
    renderer: THREE.WebGLRenderer
    root: HTMLElement
    scene: THREE.Scene
    constructor(root: HTMLElement){
        //this.group = new THREE.Group();
        this.root = root;
        this.scene = new THREE.Scene();
        window.SCENE = this.scene;
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize( 540, 540 );
        this.scene.background = new THREE.Color( 0x5555555);
        this.cameraSetup();
        //this.group.add(this.camera);
        //this.controls = new OrbitControls( this.camera, this.renderer.domElement );
        //this.controls.mouseButtons = {LEFT: -1,MIDDLE: -1,RIGHT: THREE.MOUSE.ROTATE};
        this.draw()
        this.root.appendChild( this.renderer.domElement );
    }
    cameraSetup (){
        this.camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 10, 10000 );
        this.camera.position.set( 0, -500, 300 );
        this.camera.lookAt(0, 0, 0)
        BUS.on("moveTo",(model)=>{
            let box = new THREE.Box3().setFromObject(model);
            let center = {
                x: model.position.x + (box.min.x + box.max.x)/2,
                y: model.position.y + (box.min.y + box.max.y)/2,
                z: model.position.z + (box.min.z + box.max.z)/2,
            };
            this.camera.position.set( center.x, center.y - 30, center.z + 10);
            console.log(this.controls, this.camera.rotation);
        });
    }
    createWireframe(model){
        let wireframe = this.scene.scene.createWireframe(model);
    }
    createGeometry(data, position: Object){
        let material = null, scene = this.scene;
        let name = data.modeltype + '-' + data.modelname;
        console.log(name)
        if(data.modeltype == "传送带"){  
            loader.load(`src/assets/models/传送带-${data.modelname}.stl`, function(geom){
                window.geom = geom;
            });
            this.color = "gray";
        }
        if(name == "货物-发生器"){  
            window.geom = new THREE.BoxGeometry( 20, 20, 20 );
            this.color = "lime";
        }
        if(name == "货物-回收器"){  
            window.geom = new THREE.BoxGeometry( 20, 20, 20 );
            this.color = "red";
        }
        if(name == "货物-货物"){  
            window.geom = new THREE.BoxGeometry( 20, 20, 20 );
            this.color = "blue";
        }
        if(name == "基本几何体-正方体"){
            window.geom = new THREE.BoxGeometry( 1, 1, 1 );
            this.color = "lime";
        };
        if(name == "基本几何体-球"){
            window.geom = new THREE.SphereGeometry( 0.5 );
            this.color = "red";
        }
        if(name == "基本几何体-锥体"){
            window.geom = new THREE.ConeGeometry( 0.5, 1, 4 );
            this.color = "yellow";
        }
        if(name == "基本几何体-圆柱"){
            window.geom = new THREE.CylinderGeometry(0.5, 0.5);
            this.color = "blue";
        }
        material = new THREE.MeshBasicMaterial({ color: this.color });
        let mesh = new THREE.Mesh( window.geom, material );
        if(data.modeltype == "基本几何体"){
            mesh.rotateX(Math.PI/2);
            mesh.scale.set(100, 100, 100)
        }
        mesh.name = data.modelname;
        let wireframe = new THREE.BoxHelper(mesh, "white");
        wireframe.visible = false;
        mesh.wireframe = wireframe
        mesh.add(wireframe);
        mesh.position.copy(position);
        scene.add(mesh);
        return(mesh);
    }   
    draw () {
        const gridHelper = new THREE.GridHelper(2000,20);  // 网格
        gridHelper.rotateX(Math.PI/2);
        this.scene.add( gridHelper );
        const axesHelper = new THREE.AxesHelper( 500 );  //坐标轴
        this.scene.add( axesHelper );
        this.scene.add( new THREE.AmbientLight(0xffffff) );  //灯光
        var light = new THREE.DirectionalLight( 0xffffff, 0.5 );
        light.castShadow = true
        light.position.set(0, 0, 1000);
        light.shadow.mapSize.set(2048, 2048);

        light.shadow.radius = 20; // 设置阴影贴图模糊度

        light.shadow.camera.near = 0.5; // 设置平行光投射相机的属性  //产生阴影的最近距离
        light.shadow.camera.far = 500; //产生阴影的最远距离
        light.shadow.camera.left = -5; //产生阴影距离位置的最左边位置
        light.shadow.camera.right = 5; //最右边
        light.shadow.camera.top = 5; //最上边
        light.shadow.camera.bottom = -5; //最下面
        this.scene.add( light );
        
        this.ground = new THREE.Mesh( 
            new THREE.PlaneGeometry(2000, 2000), 
            new THREE.MeshStandardMaterial({ color: "darkblue" })
        );
        this.ground.receiveShadow = true
        this.ground.name = "地面"
        this.scene.add( this.ground );
        let wireframe = new THREE.BoxHelper(this.ground, "white");
        this.ground.wireframe = wireframe;
        wireframe.visible = false;
        this.ground.add(wireframe);
    }
    render = () => {
        requestAnimationFrame( this.render );
        this.renderer.shadowMap.enabled = true
        this.renderer.render(toRaw(this.scene), this.camera)
        //this.controls.update();
    }
}