import * as fs from 'fs';  
import * as THREE from 'three';
import * as Ammo from 'ammo.js';  
import { ColladaLoader } from 'three/examples/jsm/loaders/COLLADALoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ref, toRaw } from 'vue';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import BUS from "../EventBus"

var loader = new STLLoader();
window.SCENE = {}
window.wireframes = {}
// 物理量
const clock = new THREE.Clock();
const g = 9.8;
const G = new Ammo.btVector3( 0, 0, -g )
var rigidBodies = [];
const margin = 1e-5;
let animate;
let hinge;
let cloth;
let physicsWorld;
let transformAux1;
// 碰撞体到刚体和网格的映射表，因为碰撞检测时碰撞体和刚体不同，而两者ptr相同，所以需要用ptr在此表中查找刚体和网格
var rb_mesh = new Map();

export default class SceneBuilder{
    camera: THREE.PerspectiveCamera
    material
    controls: OrbitControls
    ground
    group
    renderer: THREE.WebGLRenderer
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
        const gridHelper = new THREE.GridHelper(100, 20, "red", "white");
        gridHelper.rotateX(Math.PI/2);
        this.scene.add( gridHelper );
        // 坐标轴
        const axesHelper = new THREE.AxesHelper( 10 );
        this.scene.add( axesHelper );
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
            new THREE.PlaneGeometry(100, 100), 
            new THREE.MeshPhongMaterial({ color: "grey" })
        );
        this.ground.castShadow = true;
        this.ground.receiveShadow = true;
        this.ground.name = "地面";
        this.ground.mass = 0 // 不可动
        this.ground.shape = new Ammo.btBoxShape( new Ammo.btVector3( 50, 50, margin ) );
        this.scene.add( this.ground );
        // 地面边框
        let wireframe = new THREE.BoxHelper(this.ground, "red");
        this.ground.wireframe = wireframe;
        wireframe.visible = false;
        this.ground.add(wireframe);
    }
    cameraSetup (){
        this.camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 100 );
        this.camera.position.set( 0, -25, 15 );
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
        shape.setMargin( margin );
        const transform = new Ammo.btTransform();
        transform.setIdentity();
        transform.setOrigin( new Ammo.btVector3(pos.x, pos.y, pos.z) );
        transform.setRotation( new Ammo.btQuaternion( quat.x, quat.y, quat.z, quat.w ) );
        const motionState = new Ammo.btDefaultMotionState( transform );
        const localInertia = new Ammo.btVector3( 0, 0, 0 );
        shape.calculateLocalInertia( mass, localInertia );
        const rbInfo = new Ammo.btRigidBodyConstructionInfo( mass, motionState, shape, localInertia );
        const rb = new Ammo.btRigidBody( rbInfo );
        mesh.userData.physicsBody = rb;
        this.scene.add( mesh );
        if (mass>0) {rb.setActivationState( 4 );}  // 质量为0代表为固定的刚体
        physicsWorld.addRigidBody( rb );
        rb_mesh.set(rb.ptr, {mesh:mesh, rb:rb});
        rb.setFriction(0.5);
    }
    createGeometry(data, position: Object){
        let material = null, scene = this.scene;
        let name = data.modeltype + '-' + data.modelname;
        let mass, shape, rigid = false, scale = 1;
        console.log(name)
        if(data.modeltype == "传送带"){  
            loader.load(`src/assets/models/传送带-${data.modelname}.stl`, function(geom){
                window.geom = geom;
            });
            this.material = { color: "lightgray" };
            mass = 0;
            rigid = true;
            scale = 0.05;
            shape = this.geom2Shape(geom, scale);
        }
        if(name == "货物-发生器"){  
            window.geom = new THREE.BoxGeometry( 1, 1, 1 );
            this.material = { color: "lime", opacity: 0.5, transparent: true };
        }
        if(name == "货物-回收器"){  
            window.geom = new THREE.BoxGeometry( 1, 1, 1 );
            this.material = { color: "red", opacity: 0.5, transparent: true };
        }
        if(name == "货物-货物"){  
            window.geom = new THREE.BoxGeometry( 1, 1, 1 );
            this.material = { color: "blue" };
            mass = 1;
            rigid = true;
            shape = new Ammo.btBoxShape( new Ammo.btVector3( 0.5, 0.5, 0.5 ) ); 
        }
        if(name == "基本几何体-正方体"){
            window.geom = new THREE.BoxGeometry( 1, 1, 1 );
            this.material = { color: "lime" };
        };
        if(name == "基本几何体-球"){
            window.geom = new THREE.SphereGeometry( 0.5 );
            this.material = { color: "red" };
        }
        if(name == "基本几何体-锥体"){
            window.geom = new THREE.ConeGeometry( 0.5, 1, 12 );
            this.material = { color: "yellow" };
        }
        if(name == "基本几何体-圆柱"){
            window.geom = new THREE.CylinderGeometry(0.5, 0.5);
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
        mesh.rigid = rigid;
        mesh.receiveShadow = true;
        mesh.wireframe = wireframe
        mesh.add(wireframe);
        mesh.position.copy(position);
        if(scale != 1){
            mesh.scale.set(scale, scale, scale);
        }
        if(rigid){
            mesh.mass = mass;
            mesh.shape = shape;
        }
        this.scene.add(mesh);
        return(mesh);
    }  
    geom2Shape(geom, scale){  // 从几何形状建立刚体形状
        let shape = new Ammo.btConvexHullShape();
        let points = geom.attributes.position.array
        for (let i=0; i < points.length; i+=3) {
            let point = new Ammo.btVector3(points[i], points[i+1], points[i+2])
            point.op_mul(scale)
            shape.addPoint(
                point,
                i >= (points.length-3) 
            );
        } 
        return shape;
    }
    init(){
        this.initPhysics();
        animate();
        this.createRigidBody( this.ground );
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
        let rb = mesh.userData.physicsBody;
        rb_mesh.delete(rb);
        physicsWorld.removeRigidBody( rb );
        mesh.userData = {};
    }
    render = () => {
        this.updatePhysics( clock.getDelta() );
        this.renderer.render(toRaw(this.scene), this.camera)
        //this.controls.update();
    } 
    transport(){  // 检测物理世界中的物体是否与传送带碰撞，若有则施力
        const dispatcher = physicsWorld.getDispatcher();  
        for(var i=0; i<dispatcher.getNumManifolds(); i++){ 
            let collision = dispatcher.getManifoldByIndexInternal(i);
            // 通过查表，用碰撞体的ptr寻找对应的刚体和网格
            let ptr0 = collision.getBody0().ptr, ptr1 = collision.getBody1().ptr;
            let rb0 = rb_mesh.get(ptr0).rb, rb1 = rb_mesh.get(ptr1).rb;
            let mesh0 = rb_mesh.get(ptr0).mesh, mesh1 = rb_mesh.get(ptr1).mesh;
            // 让货物排在前面
            if(mesh1.name == "货物"){
                let t=rb0; rb0=rb1; rb1=t; t=mesh0; mesh0=mesh1; mesh1=t; 
            }
            if(mesh0.name == "货物"){
                // 摩擦力 F = kmg(v0-v)/||v0-v||，v和v0为向量
                // 设置动摩擦系数k、质量m、货物速度v、传送带速度v0、传送带旋转角θ 
                let k = 1, m = mesh0.mass, v, v0, theta=mesh1.rotation.z;
                if(mesh1.name == "直道"){
                    v0 = new Ammo.btVector3(Math.cos(theta), Math.sin(theta), 0);
                    v = rb0.getLinearVelocity();
                    let force = new Ammo.btVector3();
                    force.op_add(v0).op_sub(v).normalize();
                    force.op_mul(k*m*g);
                    rb0.applyCentralForce(force);
                }
                else if(mesh1.name == "弯道"){
                    let p = mesh0.position
                    let r = new THREE.Vector3();
                    r.add(mesh0.position).sub(mesh1.position)
                    r.setZ(0);
                    let R = r.length();  // 当货物到弯道的半径为3.8≤R≤6.4时施力
                    if(R>=3.8 && R<=6.4){
                        v0 = new Ammo.btVector3(r.y, -r.x, 0);
                        v0.normalize();
                        v0.op_mul(1);
                        v = rb0.getLinearVelocity();
                        let force = new Ammo.btVector3();
                        force.op_add(v0).op_sub(v).normalize();
                        force.op_mul(k*m*g);
                        rb0.applyCentralForce(force);
                    }  
                }
            }
        }
    }
    updatePhysics( deltaTime ) {  // 步进
        physicsWorld.stepSimulation( deltaTime );  // 更新刚体
        for(let obj of rb_mesh.values()){  // 让网格位置等于刚体位置
            const rb = obj.rb, mesh = obj.mesh;
            if(!mesh) continue;
            if(!mesh.isDrag){  // 刚体未被拖动时才计算
                const motionState = rb.getMotionState();
                if ( motionState ) {
                    motionState.getWorldTransform( transformAux1 );
                    const p = transformAux1.getOrigin();
                    const q = transformAux1.getRotation();
                    const dispatcher = physicsWorld.getDispatcher();

                    // 货物在弯道上时需修正网格位置
                    mesh.position.set( p.x(), p.y(), p.z() );
                    mesh.quaternion.set( q.x(), q.y(), q.z(), q.w() );
                }
            }
        }
        this.transport();
    }
}