import { collapseMotion } from 'ant-design-vue/es/_util/transition';
import { access } from 'original-fs';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ref, toRaw } from 'vue';

export default class SceneBuilder{
    root: HTMLElement
    scene: THREE.Scene
    camera: THREE.PerspectiveCamera
    renderer: THREE.WebGLRenderer
    controls: OrbitControls
    material: THREE.MeshNormalMaterial
    ground
   
    createGeometry(type:string, position:[number, number, number]){
        let color, mesh;
        if(type == "正方体"){
            mesh = new THREE.BoxGeometry( 1, 1, 1 );
            color = "lime";
        };
        if(type == "球"){
            mesh = new THREE.SphereGeometry( 0.5 );
            color = "red";
        }
        if(type == "锥体"){
            mesh = new THREE.ConeGeometry( 0.5, 1, 4 );
            color = "yellow";
        }
        if(type == "圆柱"){
            mesh = new THREE.CylinderGeometry(0.5, 0.5);
            color = "blue";
        }
        let material = new THREE.MeshBasicMaterial({ color: color });
        let geom = new THREE.Mesh( mesh, material );
        geom.name = type
        geom.position.set(position[0], position[1], position[2])
        this.scene.add(geom);
        return(geom);
    }
    constructor(root: HTMLElement){
        this.root = root;
        this.scene = new THREE.Scene(),
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize( 540, 640 );
        this.renderer.setPixelRatio(window.devicePixelRatio)
        this.scene.background = new THREE.Color( 0x5555555);
        this.cameraSetup();
        this.controls = new OrbitControls( this.camera, this.renderer.domElement );
        this.draw()
        this.root.appendChild( this.renderer.domElement );
    }
    cameraSetup (){
        this.camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
        this.camera.position.set( -10, 5, 5 );
        this.camera.lookAt(0,0,0)
    }
    draw () {
        // LINE
        this.material = new THREE.LineBasicMaterial( { color: 0xffffff } );
        // GRID
        const gridHelper = new THREE.GridHelper(50,50);
        this.scene.add( gridHelper );
        this.ground = gridHelper;
        //AXES
        const axesHelper = new THREE.AxesHelper( 50 );
        this.scene.add( axesHelper );
        //LIGHTS
        var light = new THREE.Light(0xFFFFFF, 10, 100);
        light.position.set( 5, 5, 5 );
        this.scene.add( light );
        this.scene.add( new THREE.AmbientLight(0xaaaaaa) );
        let geom = new THREE.Mesh( 
            new THREE.PlaneGeometry(50, 50), 
            new THREE.MeshBasicMaterial({ color: "darkblue" })
        );
        geom.rotation.name = "地面"
        geom.rotation.x = -Math.PI / 2
        this.scene.add( geom );
    }
    render = () => {
        requestAnimationFrame( this.render );
        this.renderer.render(toRaw(this.scene), this.camera)
        this.controls.update();
    }
    Scene = ()=>this.scene
}