import * as fs from 'fs';  
import * as THREE from 'three';
import * as Ammo from 'ammo.js';  
import { ColladaLoader } from 'three/examples/jsm/loaders/COLLADALoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ref, toRaw } from 'vue';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import BUS from "../EventBus"

const clock = new THREE.Clock();
var loader = new STLLoader();
window.SCENE = {}
window.wireframes = {}
// 物理量
const G = new Ammo.btVector3( 0, 0, -9.8 )
var rigidBodies = [];
const margin = 0.05;
let animate;
let hinge;
let cloth;
let physicsWorld;
let transformAux1;
// 配置Ammo.js的物理世界  

export default class SceneBuilder{
    camera: THREE.PerspectiveCamera
    material
    controls: OrbitControls
    ground
    group
    renderer: THREE.WebGLRenderer
    rigidBodies: []
    root: HTMLElement
    scene: THREE.Scene
    constructor(root: HTMLElement){ // 初始化
        animate = () => {
            requestAnimationFrame(animate);  
            this.render();
        }
        //this.group = new THREE.Group();
        this.root = root;
        this.scene = new THREE.Scene();
        window.SCENE = this.scene;
        // 渲染器
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize( 540, 540 );
        this.renderer.shadowMap.enabled = true;
        this.root.appendChild( this.renderer.domElement );
        // 天空
        this.scene.background = new THREE.Color("dodgerblue");
        this.cameraSetup();
        // 相机控制器
        //this.group.add(this.camera);
        //this.controls = new OrbitControls( this.camera, this.renderer.domElement );
        //this.controls.mouseButtons = {LEFT: -1,MIDDLE: -1,RIGHT: THREE.MOUSE.ROTATE};
        // 网格
        const gridHelper = new THREE.GridHelper(2000, 20, "black", "white");
        gridHelper.rotateX(Math.PI/2);
        this.scene.add( gridHelper );
        // 坐标轴
        const axesHelper = new THREE.AxesHelper( 500 );
        // 平行光
        const light = new THREE.DirectionalLight( "white", 3 );
        light.castShadow = true;
        light.position.set( 0, 0, 1000 );
        light.shadow.camera.left = - 10;
        light.shadow.camera.right = 10;
        light.shadow.camera.top = 10;
        light.shadow.camera.bottom = - 10;

        light.shadow.camera.near = 2;
        light.shadow.camera.far = 50;

        light.shadow.mapSize.x = 1024;
        light.shadow.mapSize.y = 1024;

        light.shadow.bias = - 0.003;
        this.scene.add( light );
        // 地面
        this.ground = new THREE.Mesh( 
            new THREE.PlaneGeometry(2000, 2000), 
            new THREE.MeshPhongMaterial({ color: "grey" })
        );
        this.ground.castShadow = true;
        this.ground.receiveShadow = true;
        this.ground.name = "地面";
        this.scene.add( this.ground );
        // 地面边框
        let wireframe = new THREE.BoxHelper(this.ground, "red");
        this.ground.wireframe = wireframe;
        wireframe.visible = false;
        this.ground.add(wireframe);
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
    createRigidBody( mesh ) {  // 添加刚体
        let pos = mesh.position;
        let quat = mesh.quaternion;
        let mass = mesh.mass;
        let shape = mesh.shape;
        const transform = new Ammo.btTransform();
        transform.setIdentity();
        transform.setOrigin( new Ammo.btVector3(pos.x, pos.y, pos.z) );
        transform.setRotation( new Ammo.btQuaternion( quat.x, quat.y, quat.z, quat.w ) );
        const motionState = new Ammo.btDefaultMotionState( transform );
        const localInertia = new Ammo.btVector3( 0, 0, 0 );
        shape.calculateLocalInertia( mass, localInertia );
        const rbInfo = new Ammo.btRigidBodyConstructionInfo( mass, motionState, shape, localInertia );
        const body = new Ammo.btRigidBody( rbInfo );
        mesh.userData.physicsBody = body;
        this.scene.add( mesh );
        if ( mass > 0 ) {  // 质量为0代表为固定的刚体
            rigidBodies.push( mesh );
            body.setActivationState( 4 );
        }
        physicsWorld.addRigidBody( body );
    }
    createGeometry(data, position: Object){
        let material = null, scene = this.scene;
        let name = data.modeltype + '-' + data.modelname;
        let mass, shape, movable = false;
        console.log(name)
        if(data.modeltype == "传送带"){  
            loader.load(`src/assets/models/传送带-${data.modelname}.stl`, function(geom){
                window.geom = geom;
            });
            this.material = { color: "gray" };
        }
        if(name == "货物-发生器"){  
            window.geom = new THREE.BoxGeometry( 20, 20, 20 );
            this.material = { color: "lime", opacity: 0.5, transparent: true };
        }
        if(name == "货物-回收器"){  
            window.geom = new THREE.BoxGeometry( 20, 20, 20 );
            this.material = { color: "red", opacity: 0.5, transparent: true };
        }
        if(name == "货物-货物"){  
            mass = 1;
            movable = true;
            shape = new Ammo.btBoxShape( new Ammo.btVector3( 20, 20, 20 ) );
            shape.setMargin( 0.05 );
            window.geom = new THREE.BoxGeometry( 20, 20, 20 );
            this.material = { color: "blue" };
        }
        if(name == "基本几何体-正方体"){
            window.geom = new THREE.BoxGeometry( 100, 100, 100 );
            this.material = { color: "lime" };
        };
        if(name == "基本几何体-球"){
            window.geom = new THREE.SphereGeometry( 50 );
            this.material = { color: "red" };
        }
        if(name == "基本几何体-锥体"){
            window.geom = new THREE.ConeGeometry( 50, 100, 4 );
            this.material = { color: "yellow" };
        }
        if(name == "基本几何体-圆柱"){
            window.geom = new THREE.CylinderGeometry(50, 50);
            this.material = { color: "blue" };
        }
        material = new THREE.MeshPhongMaterial(this.material);
        let mesh = new THREE.Mesh( window.geom, material );
        if(data.modeltype == "基本几何体"){
            mesh.rotateX(Math.PI/2);
        }
        mesh.name = data.modelname;
        let wireframe = new THREE.BoxHelper(mesh, "white");
        wireframe.visible = false;
        mesh.castShadow = true;
        mesh.movable = movable;
        mesh.receiveShadow = true;
        mesh.wireframe = wireframe
        mesh.add(wireframe);
        mesh.position.copy(position);
        if(movable){
            mesh.mass = mass;
            mesh.shape = shape;
            //this.createRigidBody( mesh );
            //this.removeRigidBody(mesh)
        }
        this.scene.add(mesh);
        return(mesh);
    }   
    init(){
        this.initPhysics();
        animate();
    }
    initPhysics() {
        // Physics configuration
        const collisionConfiguration = new Ammo.btDefaultCollisionConfiguration(); 
        const dispatcher = new Ammo.btCollisionDispatcher( collisionConfiguration );
        const broadphase = new Ammo.btDbvtBroadphase();
        const solver = new Ammo.btSequentialImpulseConstraintSolver();
        physicsWorld = new Ammo.btDiscreteDynamicsWorld(dispatcher, broadphase, solver, collisionConfiguration);
        physicsWorld.setGravity( G );
        transformAux1 = new Ammo.btTransform();
    }
    removeRigidBody( mesh ){  // 移除刚体
        let body = mesh.userData.physicsBody;
        rigidBodies = rigidBodies.filter(i => i != body);
        physicsWorld.removeRigidBody( body );
        mesh.userData = {};
    }
    render = () => {
        this.updatePhysics( clock.getDelta() );
        this.renderer.render(toRaw(this.scene), this.camera)
        //this.controls.update();
    }
    updatePhysics( deltaTime ) {  // 步进
        physicsWorld.stepSimulation( deltaTime, 10 );
        // 更新刚体
        for ( let i = 0, len = rigidBodies.length; i < len; i++ ) {
            const objThree = rigidBodies[ i ];
            const objPhys = objThree.userData.physicsBody;
            try{
                const ms = objPhys.getMotionState();
                if ( ms ) {
                    ms.getWorldTransform( transformAux1 );
                    const p = transformAux1.getOrigin();
                    const q = transformAux1.getRotation();
                    objThree.position.set( p.x(), p.y(), p.z() );
                    objThree.quaternion.set( q.x(), q.y(), q.z(), q.w() );
                }
            }
            catch(e) {}  // 刚体被拖动时无法计算
        }
    }
}