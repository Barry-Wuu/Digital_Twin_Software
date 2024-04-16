import * as Ammo from "ammo.js"
import BUS from "../EventBus"
import * as fs from "fs";
import * as THREE from "three"
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js"
import { ColladaLoader } from "three/examples/jsm/loaders/COLLADALoader.js"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"
import { computed, ref,  toRaw, watch } from 'vue'
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js"
import { ViewHelper } from "three/examples/jsm/helpers/ViewHelper.js"
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
const path = require("path")

var BottomFPS, BottomTimer;
let customModels = {};
var DTObjects = ref([]);
var emulateMode = "stop";  // 仿真模式
var frames = 0;  // 帧率计算
var gizmo;
var groundColor = "azure";
var groundSize = 250;  // 地面范围：-groundSize ≤ x ≤ groundSize，-groundSize ≤ y ≤ groundSize
var loader = new STLLoader();
var loading = false;
var origin = new THREE.Vector3(0, 0, 0);
var protectedObjects = [];
var rowCounter = 0;  // 层级树行计数器
var speed = 1;
var SCENE = new THREE.Scene();
var temp = false;
var UP = new THREE.Vector3(0, 0, 1);  // z轴朝上

// 物理量
var animate;
const clock = new THREE.Clock();
const g = 9.8;
const G = new Ammo.btVector3( 0, 0, -g )
const margin = 1e-5;
var T0;  // 开始仿真的时间
var time = performance.now();
var timeUpdateFPS = performance.now();

function geom2rigidShape(geom, scale){  // 从几何形状建立刚体形状
    // points里每三个连续的点定义了一个三角形面
    let points = geom.attributes.position.array
    let triangleMesh = new Ammo.btTriangleMesh();
    for (let i=0; i < points.length; i+=9) {
        let p0 = new Ammo.btVector3(points[i], points[i+1], points[i+2]);
        let p1 = new Ammo.btVector3(points[i+3], points[i+4], points[i+5]);
        let p2 = new Ammo.btVector3(points[i+6], points[i+7], points[i+8]);
        p0.op_mul(scale)
        p1.op_mul(scale)
        p2.op_mul(scale)
        triangleMesh.addTriangle(p0, p1, p2);  
    } 
    //return shape;
    //let shape = new Ammo.btBvhTriangleMeshShape(triangleMesh);  // 真实碰撞网格，几千个面同时导入后碰撞时会卡死
    let shape = new Ammo.btConvexTriangleMeshShape(triangleMesh);  // 凸碰撞网格
    return shape;
}

// 物理解算器
var physicsWorld;
const broadphase = new Ammo.btDbvtBroadphase();
const collisionConfiguration = new Ammo.btDefaultCollisionConfiguration(); 
const dispatcher = new Ammo.btCollisionDispatcher( collisionConfiguration );
const solver = new Ammo.btSequentialImpulseConstraintSolver();
physicsWorld = new Ammo.btDiscreteDynamicsWorld(dispatcher, broadphase, solver, collisionConfiguration);
physicsWorld.setGravity( G );
// 碰撞体到刚体和网格的映射表，因为碰撞检测时碰撞体和刚体不同，而两者ptr相同，所以需要用ptr在此表中查找刚体和网格
var rb_mesh = {};

BUS.on("changeEmulateMode", (mode: string)=>{emulateMode = mode});
BUS.on("changeSpeed", (k: string)=>{speed = parseInt(k.slice(0, k.length-1))});
BUS.on("clearTemp", ()=>{SCENE.DT.clearTemp()});

class DTObject {  // 用DTObject类包裹场景中的对象
    children  // 子物体（自动计算）
    code: string  // 自定义脚本
    custom: object  // 自定义属性
    expanded: boolean  // 是否在层级树中展开
    friction0: number  // 静摩擦力
    friction: number  // 滑动摩擦力
    geometry: THREE.object  // 模型几何体
    id: number  // 序号
    key: number  // 层级数的键
    mass: number  // 质量
    material: THREE.object  // 模型材质
    mesh: THREE.object  // 模型网格
    name: string  // 名称
    rb: object  // 刚体
    rigid: boolean  // 是否为刚体
    rigidShape: string  // 刚体网格
    row: number  // 子树在层级树模块中占几行
    scale: number  // 尺寸
    skybox: object  // 天空盒
    temp: boolean  // 临时实体（如货物）
    timer: number  // 定时器（自动计算）
    timeInterval: number  // 定时器触发时间
    title: string  // 标题 = 物体类型 + 名称 + 序号（自动计算）
    type: string  // 模型类型
    v0: number  // 传送带中轴线速度
    wireframe
    constructor(mesh=null, newScene=false) {  
        this.children = [];
        this.custom = {};
        this.friction0 = 0.5;  
        this.friction = 0.8;  
        this.rigid = false;
        this.row = 0;
        this.scale = 1;
        this.skybox = {};
        this.timer = performance.now(); 
        if(mesh){
            this.id = this.key = mesh.id;
            this.mesh = mesh;
            this.type = mesh.type;
            mesh.DT = this;
            mesh.userData.id = this.id;
        }
        if(newScene) DTObjects.value.push(this);
        return this;
    }  
    clearTemp() {  // 重置仿真动画时遍历清除所有临时物体
        if(this.temp) this.destroy();
        for(let child of this.children){
            child.clearTemp();
        }
    }
    clone() {  // 保存时返回去除一些属性的DTObject，以节省DTObject文件大小
        let newDTObject = new DTObject(null);
        for(let prop in this){
            if(this[prop] == undefined) continue;
            else if(prop == "children"){
                for(let child of this.children){
                    newDTObject.children.push(child.clone());
                }
            }
            else if(this[prop].uuid) continue;  // 排除网格、几何体、材质等属性
            else newDTObject[prop] = this[prop];
        }
        return newDTObject;
    }
    copyFrom(obj, clearDTObjects = false){  // 将读取的普通对象变回DT对象
        if(clearDTObjects) DTObjects.value = [];  // 清理旧的场景
        DTObjects.value.push(this);
        for(let prop in obj){
            if(prop == "children"){
                this.children = [];
                for(let child of obj.children){
                    let childDT = new DTObject();
                    childDT.copyFrom(child);
                    this.children.push(childDT);
                }  
            }
            else this[prop] = obj[prop];
        }
    }
    createRigidBody() {  // 添加刚体
        if(!this.rigid) return;
        let pos = this.mesh.position;
        let quat = this.mesh.quaternion;
        let mass = this.mass;
        let shape = eval(this.rigidShape);
        const transform = new Ammo.btTransform();
        transform.setIdentity();
        transform.setOrigin( new Ammo.btVector3(pos.x, pos.y, pos.z) );
        transform.setRotation( new Ammo.btQuaternion( quat.x, quat.y, quat.z, quat.w ) );
        const motionState = new Ammo.btDefaultMotionState( transform );
        const localInertia = new Ammo.btVector3( 0, 0, 0 );
        shape.calculateLocalInertia( mass, localInertia );
        const rbInfo = new Ammo.btRigidBodyConstructionInfo( mass, motionState, shape, localInertia );
        const rb = new Ammo.btRigidBody( rbInfo );
        this.rb = rb;
        this.mesh.userData.physicsBody = rb;
        //SCENE.add( this.mesh );
        if (mass > 0) {rb.setActivationState( 4 );}  // 质量为0代表为固定的刚体
        physicsWorld.addRigidBody( rb );
        rb_mesh[rb.ptr] = {mesh:this.mesh, rb:rb};
        rb.setFriction( this.friction0 );  // 静摩擦力
    }
    destroy(protect = true) {  // 清除自身及其网格和刚体
        if(protect && protectedObjects.includes(this)) return;  // 不能删除场景和地面
        let mesh = this.mesh;
        if(this.rigid){
            let rb = mesh.userData.physicsBody;
            try {delete rb_mesh[rb.ptr]} catch{};
            physicsWorld.removeRigidBody(rb);
        }
        try{
            mesh.removeFromParent();
        } 
        catch {}
        let index = DTObjects.value.indexOf(this);
        if(index != -1) DTObjects.value.splice(index, 1);  // 原地修改DTObject.value，以防监听不到其变化
    }  
    findDTObjectById(id, loadingFile=false) {  // 根据id寻找物体 
        if(!loadingFile){
            let mesh = SCENE.getObjectById(id);
            return mesh ? mesh.DT : null;
        }
        if(this.id==id) return this;
        let result;
        for(let child of this.children){
            result = child.findDTObjectById(id, loadingFile);
            if(result) return result;
        }
        return null;
    }
    getDTObjects() {return DTObjects.value;}
    newScene(){  // 新的场景
        loading = true;
        for(let ptr in rb_mesh) physicsWorld.removeRigidBody(rb_mesh[ptr].rb);
        rb_mesh = {};
        // 相机绑定的SCENE是Three.Scene，导入的场景this.mesh是Three.Group，将Group克隆到SCENE中
        let group = this.mesh;
        for(let prop in group){
            try{SCENE[prop] = group[prop]}
            catch(e){
                if(e instanceof TypeError) SCENE[prop].copy(group[prop]);
            }
        }
        this.updateChildren(true);
        this.updateWireframes(true);
        BUS.emit("init");
    }
    setProp(prop, newValue) {
        let node = this, split = prop.split('.');
        let last = split.splice(-1);
        for(let p of split){node = node[p];}
        node[last] = newValue;
        if(this.rigid){  // 刚体
            let rb = this.mesh.userData.physicsBody;
            let transform = new Ammo.btTransform();
            const motionState = rb.getMotionState();
            motionState.getWorldTransform( transform );
            let p = this.mesh.position;
            let q = new THREE.Quaternion();  // q代表四元数
            const r = this.mesh.rotation;  // r代表欧
            p = new Ammo.btVector3(p.x, p.y, p.z);
            q.setFromEuler(r);
            q = new Ammo.btQuaternion(q.x, q.y, q.z, q.w);
            transform.setOrigin(p);
            transform.setRotation(q);
            motionState.setWorldTransform( transform );
            rb.setMotionState(motionState);
        }
    }
    setRow(expanded){
        let children = this.children, lastRow = 0;
        this.expanded = expanded.includes(this.key);
        if(this.expanded){
            this.row = children.length;
            for(let i=0; i<children.length; i++){
                if(i<children.length-1) this.row += children[i].setRow(expanded);
                else{
                    try{lastRow = children[children.length-1].setRow(expanded);}
                    catch{}
                }
            }
        }
        else this.row = 0;
        return this.row + lastRow;
    }
    setTitle(name=null) {  // 物体在树中的标题 = 类型 + 名称 
        let title = '';
        if(this.type == "DirectionalLight") {}
        else if(this.name == "地面") title = "【地面】";
        else if(this.name) title = `【${this.name + this.id}】`;
        else if(this.mesh.name) title = `【${this.mesh.name}】`;  // + this.id
        else if(name) title = this.name = name;
        this.title = this.type + title;
    }
    updateChildren(loadingFile=false) {  // 更新DTObject的父子关系
        let newChildren = [];
        this.setTitle();
        for(let childMesh of this.mesh.children){  // 刷新时
            if(!childMesh.userData.id) continue;
            let childDT = SCENE.DT.findDTObjectById(childMesh.userData.id, loadingFile);
            if(!childDT) continue;
            childDT.geometry = childMesh.geometry;
            childDT.material = childMesh.material;
            childDT.mesh = childMesh;
            if(loadingFile){  // 读取文件时  
                childMesh.DT = childDT;
                childDT.id = childDT.key = childMesh.userData.id = childMesh.id;
                childDT.createRigidBody();
            }
            newChildren.push(childDT);
            childDT.updateChildren(loadingFile);
        }
        this.children = newChildren;
    }
    updateWireframes(loadingFile = false){  // 添加线框
        let wireframe;
        if(loadingFile){
            wireframe = this.mesh.children.filter(child=>child.userData.wireframe)[0];  
        } else {
            wireframe = new THREE.BoxHelper(this.mesh, "cyan");  // 线框
            wireframe.material.transparent = true;
            wireframe.userData.wireframe = true;  
            this.mesh.add(wireframe);
        }
        if(wireframe){
            wireframe.visible = false;
            this.wireframe = wireframe;
        }
        for(let child of this.children){child.updateWireframes(loadingFile);}
    }
}  

export default class SceneBuilder{
    camera: THREE.PerspectiveCamera
    cameraControls: OrbitControls
    canvas: HTMLElement
    DTObjects = DTObjects
    ground
    renderer: THREE.WebGLRenderer
    SCENE = SCENE
    transformController
    constructor(canvas: HTMLElement){ 
        // 初始化
        BottomFPS = document.getElementById("BottomFPS");
        BottomTimer = document.getElementById("BottomTimer");
        T0 = performance.now();
        this.canvas = canvas;
        // 物体数量变化时
        watch(computed(()=>{return DTObjects.value.length}), ()=>{  // 只检测DTObjects的长度变化
            if(loading) return;
            BUS.getDTScene().updateChildren();
            BUS.emit("updateTree");
            if(!temp) BUS.emit("saveInitScene");
            temp = true;
        });
        // 场景
        protectedObjects.push(SCENE.id);
        BUS.setDTScene(new DTObject(SCENE, true));
        BUS.getDTScene().skybox = {skyColor:"skyblue", skyline:"white", groundColor:"darkkhaki"};
        // 渲染器
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.autoClear = false;
        this.renderer.shadowMap.enabled = true;
        this.canvas.appendChild( this.renderer.domElement );
        // 相机
        const fov = 75;
        const aspect = window.innerWidth / window.innerHeight;
        const near = 0.1;
        const far = 1000;
        this.camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
        this.camera.position.set( 0, -25, 15 );
        this.camera.lookAt(0, 0, 0);
        this.camera.up.copy(UP);  // 在相机里让z轴向上
        // 轨道控制器
        this.cameraControls = new OrbitControls(this.camera, this.renderer.domElement);
        this.cameraControls.mouseButtons = {  // 设置默认快捷键
            LEFT: -1, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.ROTATE
        };
        this.cameraControls.minDistance = 1;  // 限制相机缩放距离
        this.cameraControls.maxDistance = 300;
        // 姿态控制器 
        /*
        this.transformController = new TransformControls(this.camera, this.renderer.domElement);
        SCENE.add(this.transformController);
        this.canvas.addEventListener("keydown",(e)=>{
            if(e.code == "KeyQ") this.transformController.setMode("translate");
            if(e.code == "KeyW") this.transformController.setMode("rotate");
            if(e.code == "KeyE") this.transformController.setMode("scale");
        })
        window.tC = this.transformController; */
        // 导向器（Gizmo）
        gizmo = new ViewHelper(this.camera, this.renderer.domElement);
        // 平行光
        const light = new THREE.DirectionalLight( "white", 3 );
        light.castShadow = true;
        light.position.set(-16, -16, 24);
        light.shadow.bias = - 0.003;
        light.shadow.camera.left = - 10;
        light.shadow.camera.right = 10;
        light.shadow.camera.top = 10;
        light.shadow.camera.bottom = - 10;
        light.shadow.camera.near = 2;
        light.shadow.camera.far = 50;
        light.shadow.mapSize.x = 1024;
        light.shadow.mapSize.y = 1024;
        SCENE.add( light );
        let DTLight = new DTObject(light, true);
        DTLight.setTitle();
        // 地面
        this.ground = new THREE.Mesh( 
            new THREE.PlaneGeometry(500, 500), 
            new THREE.MeshBasicMaterial({ color: groundColor })
        );
        let DTGround = new DTObject(this.ground, true);
        DTGround.setTitle("地面");
        protectedObjects.push(this.ground.id);
        this.ground.castShadow = true;
        this.ground.receiveShadow = true;
        this.ground.userData.ground = true;
        this.ground.DT.mass = 0 // 不可动
        this.ground.DT.rigid = true;
        this.ground.DT.rigidShape = "new Ammo.btBoxShape(new Ammo.btVector3(groundSize, groundSize, margin))";
        this.ground.DT.createRigidBody();
        SCENE.add(this.ground);
        //transformController.attach(this.ground)
        //console.log(this.transformController)
        // 网格
        const gridHelper = new THREE.GridHelper(500, 100, groundColor, "#AAAAAA");
        gridHelper.rotateX(Math.PI/2);
        SCENE.add( gridHelper );
        gridHelper.position.z = 0.01;
        // 正主坐标轴（不包括z轴）
        const lineXGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3( groundSize, 0, 0.02 ),
            new THREE.Vector3( 0, 0, 0.02 )
        ]);
        const lineXMaterial = new THREE.LineBasicMaterial({color: "red"});
        SCENE.add( new THREE.Line( lineXGeometry, lineXMaterial ) );
        let lineYGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3( 0, groundSize, 0.02 ),
            new THREE.Vector3( 0, 0, 0.02 )
        ]);
        let lineYMaterial = new THREE.LineBasicMaterial({color: "green"});
        SCENE.add( new THREE.Line( lineYGeometry, lineYMaterial ) );
        // 负主坐标轴
        const lineGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3( -groundSize, 0, 0.02 ),
            new THREE.Vector3( 0, 0, 0.02 ),
            new THREE.Vector3( 0, -groundSize, 0.02 )
        ]);
        const lineMaterial = new THREE.LineBasicMaterial({color: "black"});
        const line = new THREE.Line( lineGeometry, lineMaterial );
        SCENE.add( line );
        // 预先载入自定义模型
        this.preloadModels();
        BUS.on("init", ()=>this.init());
        //
        //this.importRobot()
    }
    init(){  // 场景更新时的操作
        // 天空
        this.setSkyboxByColor(SCENE.DT)
        // 远处雾化
        SCENE.fog = new THREE.Fog(groundColor, 5, 200);
        emulateMode = "stop";
        loading = false;
        if(!animate){
            animate = () => {
                try{requestAnimationFrame(animate);}
                catch{return}  
                this.render();
            };
            animate();
        }
    }
    importRobot(){  // 导入六轴机器人模型
        //
        let promises = 0;
        const loader = new OBJLoader(); /* 从Collada类中声明模型加载参数 */
        let models = ["src/assets/models/4robot.obj"]
        for(let i=0; i<=6; i++){
            models.push(`src/assets/models/Robot${i}.obj`);
        }
        for(let model of models){
            loader.load(model, function (robot) {
                robot.traverse((mesh)=>{
                    if(mesh.isGroup || mesh.isMesh) {  // 递归判断dae下的子类标签是否是网格对象
                        if(model=="src/assets/models/Robot0.obj") {
                            //let box = new THREE.Box3().setFromObject(mesh), center=UP.clone();
                            window.tC.attach(mesh.parent)
                            //if(box) {
                            //    window.control.setMode('rotate')
                            //    box.getCenter(window.control.position)
                            window.tC.position.z += 1;
                            //}
                            mesh.material = new THREE.MeshPhongMaterial({ color: "dodgerblue" });
                        }
                        mesh.castShadow = mesh.receiveShadow = true;
                        mesh.name = path.basename(model, path.extname(model))
                        new DTObject(mesh, true);
                    }
                });
                promises += 1;
                robot.scale.set(20, 20, 20);
                robot.rotateX(Math.PI/2);
                SCENE.add(robot);
            })
        }
    }
    cameraSetup (){
        BUS.on("moveTo",(model)=>{
            let box = new THREE.Box3().setFromObject(model);
            let center = {
                x: model.position.x + (box.min.x + box.max.x)/2,
                y: model.position.y + (box.min.y + box.max.y)/2,
                z: model.position.z + (box.min.z + box.max.z)/2,
            };
            this.camera.position.set( center.x, center.y - 30, center.z + 10);
        });
    }
    createArrow(x, y, theta){  // 指示箭头(横坐标，纵坐标，旋转角)
        let theta0 = theta * Math.PI / 180;
        let theta1 = (theta+90) * Math.PI / 180;
        let theta2 = (theta-90) * Math.PI / 180;
        const triangle = new THREE.Shape();
        triangle.moveTo(x + 2*Math.cos(theta0), y + 2*Math.sin(theta0));
        triangle.lineTo(x + 0.5*Math.cos(theta1), y + 0.5*Math.sin(theta1));
        triangle.lineTo(x + 0.5*Math.cos(theta2), y + 0.5*Math.sin(theta2));
        const geom = new THREE.ShapeGeometry(triangle);
        const material = new THREE.MeshBasicMaterial( { color: "white" } );
        return new THREE.Mesh( geom, material ) ;
    }
    createGeometry(data, position: Object){  // 定义各物体属性
        let indicators = [];  // 传送带的指示箭头
        let modelPath;
        let name = data.modeltype + '-' + data.modelname;
        let mesh = new THREE.Mesh();
        let DT = new DTObject(mesh);
        if(data.modeltype == "传送带"){  
            DT.mass = 0;
            DT.rigid = true; 
            if(data.modelname == "护栏"){  // 将刚体形状设为函数以便导出，否则读取刚体形状后只有指针
                DT.geometry = new THREE.BoxGeometry( 2, 0.5, 1 );
                DT.rigidShape = "new Ammo.btBoxShape(new Ammo.btVector3( 1, 0.25, 0.5 ))";
            }
            else if(data.modelname == "传感器"){
                DT.geometry = new THREE.BoxGeometry( 2, 0.5, 1 );
                DT.material = { color: "red", opacity: 0.5, transparent: true };
                DT.rigidShape = "new Ammo.btBoxShape(new Ammo.btVector3( 1, 0.25, 0.5 ))";
            }
            else{
                DT.scale = 0.05;
                modelPath = `src/assets/models/传送带-${data.modelname}.stl`;
                DT.geometry = customModels[modelPath];
                DT.rigidShape = "geom2rigidShape(this.geometry, this.scale)"
                if(data.modelname == "直道"){
                    DT.material = { color: "lightgray" };
                    DT.v0 = 2;
                    indicators = [this.createArrow(0.5, 0, 0)]
                }
                if(data.modelname == "弯道"){
                    DT.material = { color: "lightgray" };
                    DT.v0 = 2;
                    indicators = [this.createArrow(-5, 0, 90)]
                }   
            }
        }
        else if(name == "货物-发生器"){  
            DT.geometry = new THREE.BoxGeometry( 1, 1, 1 );
            DT.material = { color: "lime", opacity: 0.5, transparent: true };
            DT.timeInterval = 5000;
        }
        else if(name == "货物-回收器"){  
            DT.geometry = new THREE.BoxGeometry( 1, 1, 1 );
            DT.material = { color: "red", opacity: 0.5, transparent: true };
            DT.mass = 0;
            DT.rigid = true;
            DT.rigidShape = "new Ammo.btBoxShape(new Ammo.btVector3( 0.5, 0.5, 0.5 ))"; 
        }
        else if(name == "货物-货物"){  
            DT.geometry = new THREE.BoxGeometry( 1, 1, 1 );
            DT.material = { color: "blue" };
            DT.mass = 1;
            DT.rigid = true;
            DT.rigidShape = "new Ammo.btBoxShape(new Ammo.btVector3( 0.5, 0.5, 0.5 ))"; 
            DT.temp = true;  // 临时实体
        }
        else if(name == "基本几何体-正方体"){
            DT.geometry = new THREE.BoxGeometry( 1, 1, 1 );
            DT.material = { color: "lime" };
        }
        else if(name == "基本几何体-球"){
            DT.geometry = new THREE.SphereGeometry( 0.5 );
            DT.material = { color: "red" };
        }
        else if(name == "基本几何体-锥体"){
            DT.geometry = new THREE.ConeGeometry( 0.5, 1, 12 );
            DT.material = { color: "yellow" };
        }
        else if(name == "基本几何体-圆柱"){
            DT.geometry = new THREE.CylinderGeometry(0.5, 0.5);
            DT.material = { color: "blue" };
        }

        mesh.material = new THREE.MeshPhongMaterial(DT.material);
        if(data.modeltype == "基本几何体"){mesh.rotateX(Math.PI/2);}
        DT.name = data.modelname;
        mesh.geometry = DT.geometry;

        DT.setTitle();
        DT.updateWireframes();
        if(indicators.length){  // 指示箭头
            for(let i of indicators){
                i.scale.set(1/DT.scale, 1/DT.scale, 1/DT.scale);
                i.userData.indicator = true;
                mesh.add(i);
            }
        }   

        mesh.castShadow = mesh.receiveShadow = true;
        mesh.position.copy(position);
        if(DT.scale != 1){ mesh.scale.set(DT.scale, DT.scale, DT.scale); }
        DT.createRigidBody();
        SCENE.add(mesh);
        return mesh;
    }  
    createSkyBoxFromTexture() {
        // 图片路径有要求，需要放在public文件夹下
        const picPath = "../src/assets/skybox/"; // 默认为public内
        const skybox = new THREE.CubeTextureLoader().setPath(picPath)
        .load(["px.jpg", "nx.jpg", "py.jpg", "ny.jpg", "pz.jpg", "nz.jpg"]);
        skybox.format = THREE.RGBAFormat;
        this.SCENE.background = skybox;
    }
    preloadModels(){  // 事先载入所有的已有模型
        const modelPath = "src/assets/models/";
        function searchFiles(dir) {  // 使用同步操作
            let files = fs.readdirSync(dir);
            files.forEach(fileName => {
                let filePath = modelPath + fileName;
                let stats = fs.statSync(filePath);
                if (stats.isFile() && path.extname(filePath) == ".stl") {
                    customModels[filePath] = ''; // 保存模型文件的路径
                }
                if (stats.isDirectory()) {
                    searchFiles(filePath); // 递归子目录
                }
            });
        }

        searchFiles(modelPath);  // 然后异步载入相应几何体（THREE.geometry）
        for(let modelPath in customModels){
            let load = loader.loadAsync(modelPath);
            load.then((geom)=>{customModels[modelPath] = geom;});   
        }
    }
    removeRigidBody( mesh ){  // 移除刚体
        let rb = mesh.userData.physicsBody;
        delete rb_mesh[rb.ptr];
        physicsWorld.removeRigidBody( rb );
        delete mesh.userData.rb;
    }
    render(){
        this.updatePhysics( clock.getDelta() );
        this.renderer.render(toRaw(SCENE), this.camera)
        gizmo.render(this.renderer);
        this.cameraControls.update();
    } 
    setSkyboxByColor(DTScene) {  // 根据上中下三种颜色设置天空盒
        function isColor(color, defaultColor){  // 测试字符串是否能解析成颜色，否则将颜色恢复为默认值
            const temp = document.createElement("div");  
            temp.style.color = color;  
            return temp.style.color ? color : defaultColor;  
        }  
        let skyColor = isColor(DTScene.skybox.skyColor, "skyblue");
        let skyline = isColor(DTScene.skybox.skyline, "white");
        let groundColor = isColor(DTScene.skybox.groundColor, "darkkhaki");
        DTScene.skybox = {skyColor:skyColor, skyline:skyline, groundColor:groundColor};

        const radius: number = 600;
        const widthSegments: number = 32;
        const heightSegments: number = 15;
        const skyGeo = new THREE.SphereGeometry(radius, widthSegments, heightSegments);
        const uniforms = {
            topColor: { value: new THREE.Color(skyColor) },
            skylineColor: { value: new THREE.Color(skyline) },
            bottomColor: { value: new THREE.Color(groundColor) },
            offset: { value: 0 },
            exponent: { value: 0.6 },
            skyCenter: { value: new THREE.Vector3() }
        }
        // 顶点着色器
        const vertexShader = `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4( position, 1.0 );
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
        }`
        // 片着色器
        const fragmentShader = `
        uniform vec3 topColor;
        uniform vec3 skylineColor;
        uniform vec3 bottomColor;
        uniform float offset;
        uniform float exponent;
        uniform vec3 skyCenter;
        varying vec3 vWorldPosition;
        void main() {
          vec3 position = vec3(vWorldPosition.x - skyCenter.x, vWorldPosition.y - skyCenter.y, vWorldPosition.z - skyCenter.z);
          float h = normalize( position + offset ).z;
          vec3 color;
          if (h > 0.0) {
            color = mix( skylineColor, topColor, max( pow( max( h, 0.0 ), exponent ), 0.0 ) );
          } else {
            color = mix( skylineColor, bottomColor, max( pow( max( -h, 0.0 ), exponent ), 0.0 ) );
          }
          gl_FragColor = vec4(color , 1.0 );
        }`
        // 着色器材质
        const skyMat = new THREE.ShaderMaterial({
            uniforms: uniforms,
            vertexShader: vertexShader,
            fragmentShader: fragmentShader,
            side: THREE.BackSide
        });

        let skyBox = new THREE.Mesh(skyGeo, skyMat);
        skyBox.rotation.x = (Math.PI/2);
        SCENE.add(skyBox);
    }
    transport(){  // 检测物理世界中的物体是否与传送带碰撞，若有则施力
        const dispatcher = physicsWorld.getDispatcher();  
        for(var i=0; i<dispatcher.getNumManifolds(); i++){ 
            let collision = dispatcher.getManifoldByIndexInternal(i);
            // 通过查表，用碰撞体的ptr寻找对应的刚体和网格
            let ptr0 = collision.getBody0().ptr, ptr1 = collision.getBody1().ptr;
            let rb0 = rb_mesh[ptr0].rb, rb1 = rb_mesh[ptr1].rb;
            let mesh0 = rb_mesh[ptr0].mesh, mesh1 = rb_mesh[ptr1].mesh;
            // 让货物排在前面
            if(mesh1.DT.name == "货物"){
                let t=rb0; rb0=rb1; rb1=t; t=mesh0; mesh0=mesh1; mesh1=t; 
            }
            if(mesh0.DT.name == "货物"){
                let J = 5;  // 转动惯量J
                let k = Math.min(mesh0.DT.friction, mesh1.DT.friction);  // 滑动摩擦系数k
                let kw = k;  // 转动摩擦系数kw
                let m = mesh0.DT.mass;  // 质量m
                let v;  // 货物速度v
                let v0 = mesh1.DT.v0;  // 传送带中轴线速度v0
                let theta = mesh1.rotation.z;  //传送带旋转角θ 
                let R = 5;  // 传送带中轴线半径R
                if(mesh1.DT.name == "直道"){  // 摩擦力 F = kmg(v0-v)/||v0-v||，v和v0为向量
                    // 将v0从标量转换为货物处的速度矢量v0_real
                    let v0_real = new Ammo.btVector3(v0*Math.cos(theta), v0*Math.sin(theta), 0);
                    v = rb0.getLinearVelocity();
                    let F = new Ammo.btVector3();
                    F.op_add(v0_real).op_sub(v).normalize();
                    F.op_mul(k*m*g);
                    rb0.applyCentralForce(F);
                }
                else if(mesh1.DT.name == "弯道"){
                    let r = new THREE.Vector3();
                    r.add(mesh0.position).sub(mesh1.position);
                    r.setZ(0);
                    let ra = r.length();  // 径向矢量r=v0-v，模ra=||v0-v||
                    if(ra>=3.2 && ra<=6.4){  // 当货物到弯道的半径为3.2≤ra≤6.4时向其质心施力
                        // 将v0从标量转换为货物处的速度矢量v0_real
                        let v0_real = new Ammo.btVector3(r.y, -r.x, 0);  // 旋转v0
                        v0_real.normalize();
                        v0_real.op_mul(v0 * ra / R);
                        v = rb0.getLinearVelocity();
                        let F = new Ammo.btVector3();
                        F.op_add(v0_real);
                        F.op_sub(v);
                        F.normalize();
                        F.op_mul(k*m*g);
                        rb0.applyCentralForce(F);
                        // 然后施加转矩
                        let w0 = -v0_real.length() / ra;  //传送带角速度ω0 
                        let w = rb0.getAngularVelocity().z();  //货物角速度ω0
                        let M = new Ammo.btVector3(0, 0, kw * J * (w0 - w));
                        rb0.applyTorque(M);  // 同理，摩擦力矩 M = kw*J*(ω0-ω)
                    }  
                }
                else if(mesh1.DT.name == "回收器"){
                    mesh0.DT.destroy();
                    BUS.emit("print", `【${mesh0.DT.name}${mesh0.id}】被【${mesh1.DT.name}${mesh1.id}】回收`)
                }
            }
        }
    }
    updateFPSandTime(now, pause, stop){  // 更新帧率和用时
        if(stop){ 
            BottomTimer.textContent = "00:00:00.000"
        } else {
            let totalTime = new Date(now - T0);
            function pad(x, n=2){return x.toString().padStart(n, '0')};
            BottomTimer.textContent = pad(totalTime.getHours() - 8) + ':'
            + pad(totalTime.getMinutes()) + ':'
            + pad(totalTime.getSeconds()) + '.'
            + pad(totalTime.getMilliseconds(), 3);
        }
        if(time - timeUpdateFPS < 1000){  // 未到一秒则统计一秒钟的步进次数，将其作为帧数
            frames++;
            time = now;
        }
        else{  // 到一秒时更新帧率显示          
            BottomFPS.textContent = frames;
            frames = 0;
            timeUpdateFPS = time;
        }
    }
    updatePhysics( deltaTime ) {  // 步进 
        let now = performance.now();     
        let pause = emulateMode == "pause", stop = emulateMode == "stop";  // 是否暂停或停止
        this.updateFPSandTime(now, pause, stop);
        if(stop){T0 = performance.now();}  // 暂停后停止计时
        if(pause || stop)return;  // 未暂停时更新刚体
        if(emulateMode == "step") physicsWorld.stepSimulation( deltaTime );
        else{
            for(let i=0; i<speed; i++) physicsWorld.stepSimulation( deltaTime );
        }
        for(let DT of DTObjects.value){  // 让网格位置等于刚体位置
            const mesh = DT.mesh, rb = DT.rb;
            try{ if(DT.code != '') eval(DT.code) }  // 若物体有自定义脚本则执行 
            catch(e) {console.log(e)}
            if(!DT.rigid){
                if(!stop && DT.name == "发生器"){  // 未暂停时制造货物
                    if(now - DT.timer >= DT.timeInterval){  // 秒变毫秒
                        let mesh0 = this.createGeometry({modeltype:"货物", modelname:"货物"}, mesh.position);                      
                        mesh0.rotation.copy(mesh.rotation);
                        DTObjects.value.push(mesh0.DT);
                        SCENE.DT.children.push(mesh0.DT);
                        BUS.emit("print", `【${DT.name}${DT.id}】创建了【${mesh0.DT.name}${mesh0.id}】`);
                        DT.timer = now;
                    }
                }
                continue;
            };
            if(!DT.mesh.userData.physicsBody) continue;
            if(!mesh.isDrag){  // 刚体未被拖动时才计算
                if(mesh.position.manhattanDistanceTo(origin) > 10000){
                    mesh.DT.destroy();  // 物体太远则清除
                }
                const motionState = rb.getMotionState();
                if ( motionState ) {
                    let transform = new Ammo.btTransform();
                    motionState.getWorldTransform( transform );
                    const p = transform.getOrigin();
                    const q = transform.getRotation();
                    mesh.position.set( p.x(), p.y(), p.z() );  // 将网格位移设为刚体位移
                    mesh.quaternion.set( q.x(), q.y(), q.z(), q.w() );  // 将网格旋转设为刚体旋转
                }
            }
        }
        this.transport();
        if(emulateMode == "step") emulateMode = "pause";  // 步进模式下，每仿真完一步就停止
    }
}