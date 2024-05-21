import * as Ammo from "ammo.js"
import global from "../../Global"
import * as fs from "fs";
const path = require("path");
import * as THREE from "three"

import { ClearPass } from 'three/examples/jsm/postprocessing/ClearPass.js';
import { ColladaLoader } from "three/examples/jsm/loaders/COLLADALoader.js"
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js"
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"
import { OutlinePass } from "three/examples/jsm/postprocessing/OutlinePass.js"
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls.js"
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js"
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js"
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js"
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js"
import { ViewHelper } from "three/examples/jsm/helpers/ViewHelper.js"
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js"
import { computed, ref, watch } from "vue"
import bulb from "../../assets/svg/bulb.svg";
import sun from "../../assets/svg/sun.svg";

var attached;  // 控制器附着的物体
var BottomFPS, BottomTimer;
var controller;
let customModels = {};
let attachObjects = new THREE.Group();
var DTObjects = ref([]);
var emulateMode = "stop";  // 仿真模式
var frameCounter = 0;  // 帧计数器，计满60帧近似看做1秒
var frames = 0;  // 帧率计算
let front = new THREE.Vector3(); 
var groundColor = "azure";
var groundSize = 250;  // 地面范围：-groundSize ≤ x ≤ groundSize，-groundSize ≤ y ≤ groundSize
var loader = new STLLoader();
var loading = false;
var origin = new THREE.Vector3(0, 0, 0);
var SCENE = new THREE.Scene();
var speed = 1;
var temp = false;
var UP = new THREE.Vector3(0, 0, 1);  // z轴朝上
var Ground = new THREE.Plane(UP);  // 平面z=0

// 物理量
var animate;
const clock = new THREE.Clock();
const g = 9.8;
const G = new Ammo.btVector3( 0, 0, -g );
const margin = 1e-5;  // rigidShape需要此间隙
var moveToId = 0;
var targetObject, p_start, p_end;  // 相机移动的目标物体，起点和终点
var renderPass;  // 边缘高亮滤镜
var T0;  // 开始仿真的时间
var time = performance.now();
var timeUpdateFPS = performance.now();

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

global.on("changeEmulateMode", (mode: string)=>{emulateMode = mode});
global.on("changeSpeed", (k: string)=>{speed = parseInt(k.slice(0, k.length-1))});
global.on("clearLoads", ()=>{SCENE.DT.clearLoads()});

export class DTObject {  // 用DTObject类包裹场景中的对象
    children = []  // 子物体（自动计算）
    code: string  // 自定义脚本
    custom = {}  // 自定义属性
    expanded: boolean  // 是否在层级树中展开
    friction0 = 0.5  // 静摩擦力
    friction = 0.8  // 滑动摩擦力
    geometry: THREE.object  // 模型几何体
    id: number  // 序号
    key: number  // 层级树的键，应等于序号
    layers = {}  // 物体及其子孙的图层
    mass: number  // 质量
    material: THREE.object  // 模型材质
    mesh: THREE.object  // 模型网格
    name: string  // 名称
    rb: object  // 刚体
    rigid = false  // 是否为刚体
    rigidShape: string  // 刚体网格，设成字符串易于存取，若为空则刚体为mesh的凸集
    row = 0  // 子树在层级树模块中占几行
    scale = 1  // 尺寸
    skybox: object  // 天空盒
    special: boolean  // 特殊实体（如传感器
    temp: boolean  // 临时实体（如货物）
    timer = performance.now()  // 定时器（自动计算）
    timeInterval: number  // 定时器触发时间
    title: string  // 标题 = 物体类型 + 名称 + 序号（自动计算）
    type: string  // 模型类型
    v0: number  // 传送带中轴线速度
    wireframe
    constructor(mesh=null, newScene=false, asset=null) {  
        if(mesh){
            this.id = this.key = mesh.id;
            this.mesh = mesh;
            if(mesh.name) this.name = mesh.name;
            this.type = mesh.type;
            mesh.DT = this;
            mesh.userData.id = this.id;
            if(asset == "model"){
                this.geometry = mesh.geometry;
                this.material = mesh.material;
            }
        }
        if(newScene) DTObjects.value.push(this);
        return this;
    }  
    clearLoads() {  // 重置仿真动画时遍历清除所有临时物体
        if(this.temp) this.destroy();
        for(let child of this.children){
            child.clearLoads();
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
    controlEnd(){  // 取消选择时移除控制器
        if(attached) attached.DT.setProp();
        attached = null;
        SCENE.remove(controller);
        controller.detach();
        controller.setMode("translate");  // 取消选择时把控制器恢复为平移模式
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
        let mass = this.mass;
        let pos = this.mesh.position;
        let quat = this.mesh.quaternion;
        let shape;
        if(typeof this.rigidShape != "string"){  // 自定义刚体形状
            shape = this.createRigidShape(this.rigidShape);
        }
        else if(this.rigidShape == "convex"){  // 将几何体的凸集作为刚体形状
            shape = this.createRigidShape(this.geometry);
        }
        else{  // 固有的简单几何体
            this.createRigidHelper();
            shape = eval(this.rigidShape); 
        }
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
    createRigidHelper(geom=null){ // 根据刚体形状添加可视化碰撞体网格
        let result, rule = /\(([^]*)\)/;
        let material = new THREE.LineBasicMaterial({  // 红色透明材质
            color: "red",
            // opacity: 0.5,
            // transparent: true
        });
        if(!geom){
            if(typeof this.rigidShape != "string"){  // 自定义刚体形状
                geom = this.rigidShape;
            }
            else if(this.rigidShape.includes("btBoxShape")){
                result = eval(this.rigidShape.match(rule)[1]);
                geom = new THREE.BoxGeometry(result.x()*2, result.y()*2, result.z()*2);
            }
            else if(this.rigidShape.includes("btConeShape")){
                result = this.rigidShape.match(rule)[1];
                geom = eval(`new THREE.ConeGeometry(${result})`);
            }
            else if(this.rigidShape.includes("btCylinderShape")){
                result = eval(this.rigidShape.match(rule)[1]);
                geom = new THREE.CylinderGeometry(result.x(), result.z(), result.y());
            }
            else if(this.rigidShape.includes("btSphereShape")){
                result = eval(this.rigidShape.match(rule)[1]);
                geom = new THREE.SphereGeometry(result);
            }
            else return;
        }
        geom = new THREE.WireframeGeometry(geom);
        const rigidHelper = new THREE.LineSegments(geom, material);  // 可视化碰撞体网格
        rigidHelper.visible = global.layers().includes("碰撞体");
        this.mesh.add(rigidHelper);
        this.layers.rigidHelper = rigidHelper;
    }
    createRigidShape(geom){  // 从几何形状建立刚体形状
        // points里每三个连续的点定义了一个三角形面
        let ammoMesh = new Ammo.btTriangleMesh();
        let threeVertices = [];
        let points = geom.attributes.position.array;
        for (let i=0; i < points.length; i+=9) {
            let p0 = new Ammo.btVector3(points[i], points[i+1], points[i+2]);
            let p1 = new Ammo.btVector3(points[i+3], points[i+4], points[i+5]);
            let p2 = new Ammo.btVector3(points[i+6], points[i+7], points[i+8]);
            p0.op_mul(this.scale)
            p1.op_mul(this.scale)
            p2.op_mul(this.scale)
            ammoMesh.addTriangle(p0, p1, p2);  
            p0 = new THREE.Vector3(points[i], points[i+1], points[i+2]);
            p1 = new THREE.Vector3(points[i+3], points[i+4], points[i+5]);
            p2 = new THREE.Vector3(points[i+6], points[i+7], points[i+8]);
            //p0.multiplyScalar(scale);
            //p1.multiplyScalar(scale);
            //p2.multiplyScalar(scale);
            threeVertices.push(p0, p1, p2);
        } 
        if(this.rigidShape == "convex"){  // 凸刚体形状
            this.createRigidHelper(new ConvexGeometry(threeVertices));
            return new Ammo.btConvexTriangleMeshShape(ammoMesh);
        }
        this.createRigidHelper(geom);  // 真实碰撞网格，面太多时会卡死
        return new Ammo.btBvhTriangleMeshShape(ammoMesh);
    }
    destroy(protect = true) {  // 清除自身及其网格和刚体
        let mesh = this.mesh;
        if(protect && mesh.userData.protected) return;  // 不能删除场景和地面
        // 如果子物体中有CSS2DObject，则先删除相应的DOM，以免其残留在屏幕上
        let css2d = mesh.children.filter(child => child.isCSS2DObject);
        if(css2d.length){
            for(let child of css2d) {
                let dom = child.userData.dom;
                if(dom) dom.remove();
            }
        }
        this.controlEnd();  // 如果控制器绑定了该物体，则先解绑
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
    sensorStop() {
        let rb = this.mesh.userData.physicsBody;
        rb.setMassProps(0, new Ammo.btVector3(0, 0, 0));
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
        let controller = SCENE.children.filter(child => child.isTransformControls)[0];
        for(let prop in group){
            try{ SCENE[prop] = group[prop] }
            catch(e){
                if(e instanceof TypeError) SCENE[prop].copy(group[prop]);
            }
        }
        SCENE.add(controller);
        this.updateChildren(true);
        this.updateWireframes(true);
        global.emit("init");
    }
    setProp(prop=null, newValue=null) {  // 改变物体及其刚体的属性
        if(prop){
            let node = this, split = prop.split('.');
            let last = split.splice(-1);
            for(let p of split){node = node[p];}
            node[last] = newValue;
        }
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
    setRow(expanded){  // 设置物体在树中的行数
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
        if(this.type == "DirectionalLight") title = "平行光";
        else if(this.type == "AmbientLight") title = "环境光";
        else if(this.mesh.userData.ground) title = "地面";
        else if(this.name) {  // 若标题太长则截取20个字符
            if(this.name.length <= 20) title = this.name;
            else title = this.name.slice(0, 20) + "...";
        }
        else if(this.mesh.name){
            if(this.temp) this.mesh.name += this.id  // 创建货物时为物体名称添加id
            if(this.mesh.name.length <= 20) title = this.mesh.name;  // 物体名称太长则省略
            else title = this.mesh.name.slice(0, 20) + "...";
        } 
        else if(name) title = this.name = name;
        this.title = `(${this.type}) ` + title;
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
            wireframe.userData.wireframe = true;  
            this.mesh.add(wireframe);
        }
        if(wireframe){
            wireframe.visible = false;
            this.wireframe = wireframe;
        }
        // for(let child of this.children){child.updateWireframes(loadingFile);}
    }
}  

export default class SceneBuilder{
    camera  // 默认相机
    cameraMovable: THREE.PerspectiveCamera  // 可平移透视相机
    cameraOrtho: THREE.OrthographicCamera  // 正交相机
    cameraPersp: THREE.PerspectiveCamera  // 透视相机
    canvas: HTMLElement
    composer  // 边缘高亮着色器
    cssRenderer: THREE.CSS2DRenderer
    DTObjects = DTObjects
    gizmoOrtho: THREE.ViewHelper
    gizmoPersp: THREE.ViewHelper
    ground
    orbitControl: OrbitControls
    pointerControl: PointerLockControls
    renderer: THREE.WebGLRenderer
    SCENE = SCENE
    constructor(canvas: HTMLElement){ 
        // 初始化
        BottomFPS = document.getElementById("BottomFPS");
        BottomTimer = document.getElementById("BottomTimer"); 
        T0 = performance.now();
        this.canvas = canvas;
        // 物体数量变化时
        watch(computed(()=>DTObjects.value.length), ()=>{  // 只检测DTObjects的长度变化
            if(loading) return;
            global.DTScene().updateChildren();
            global.emit("updateTree");
            if(!temp) global.emit("saveInitScene");
            temp = true;
        });
        // 场景
        SCENE.userData.protected = true;
        global.setDTScene(new DTObject(SCENE, true));
        global.DTScene().skybox = {
            skyColor: new THREE.Color("skyblue"), 
            skyline: new THREE.Color("white"), 
            groundColor: new THREE.Color("darkkhaki"), 
        };
        // 场景渲染器
        this.renderer = new THREE.WebGLRenderer({antialias: true});
        this.renderer.autoClear = false;
        this.renderer.shadowMap.enabled = true;
        const DOM = this.renderer.domElement;
        this.canvas.appendChild(DOM);
        // CSS渲染器
        this.cssRenderer = new CSS2DRenderer();
        let cssDOM = this.cssRenderer.domElement;
        cssDOM.style.position = 'absolute';
        cssDOM.style.top = '0px';
        this.canvas.appendChild(cssDOM);
        // 透视相机
        const near = 0.1;
        const far = 1000;
        const fov = 75;
        const ratio = window.innerWidth / window.innerHeight;
        this.cameraPersp = new THREE.PerspectiveCamera(fov, ratio, near, far);
        this.cameraPersp.position.set(0, -25, 15);
        this.cameraPersp.lookAt(0, 0, 0);
        this.cameraPersp.up.copy(UP);  // 在相机里让z轴向上
        this.camera = this.cameraPersp;
        global.setCamera(this.camera);
        global.on("cameraMoveTo", (id)=>{  // 双击将相机拉近至物体
            moveToId = id;
        });   
        global.on("changeCamera", data => {  // 切换相机类型（透视/正交）
            let camera = this.camera;  // 前一个相机
            let position = camera.position;
            let target = this.orbitControl.target;
            let visible = global.layers().includes("Gizmo");
            this.camera = {"透视": this.cameraPersp, "正交": this.cameraOrtho} [data];
            this.camera.position.copy(position);
            this.orbitControl.object = this.camera;
            this.orbitControl.target.copy(target);
            renderPass.camera = this.camera; 
            this.gizmoPersp.visible = visible && data == "透视";
            this.gizmoOrtho.visible = visible && data == "正交";
        })
        global.on("changeView", (key)=>{
            let camera = this.camera;
            if(key == "默认视图") camera.position.set(0, -25, 15);           
            if(key == "俯视图") camera.position.set(0, 0, 20);
            if(key == "正视图") camera.position.set(0, -30, 5);
            if(key == "左视图") camera.position.set(-30, 0, 5);
            if(key == "右视图") camera.position.set(30, 0, 5);
            this.orbitControl.target.set(0, 0, 0)
        })
        // 透视/正交相机的轨道控制器
        this.orbitControl = new OrbitControls(this.camera, cssDOM);
        this.orbitControl.mouseButtons = {  // 设置默认快捷键
            LEFT: -1, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.ROTATE
        };
        this.orbitControl.minDistance = 5;  // 限制透视相机缩放距离
        this.orbitControl.maxDistance = 200;
        this.orbitControl.minZoom = 0.1;  // 限制正交相机缩放比例
        this.orbitControl.maxZoom = 5;
        this.orbitControl.screenSpacePanning = false;  // 平移时沿地面拖动
        // 平移相机及其平移控制器
        this.cameraMovable = this.camera.clone();  // 克隆一个无orbitControl相机，用于控制原相机的角度
        this.pointerControl = new PointerLockControls(this.cameraMovable, cssDOM);
        // 正交相机
        const k = 10;
        this.cameraOrtho = new THREE.OrthographicCamera(-k*ratio, k*ratio, k, -k, 0, 1000);
        this.cameraOrtho.position.set(0, -25, 15);
        this.cameraOrtho.lookAt(0, 0, 0);
        this.cameraOrtho.up.copy(UP);  // 在相机里让z轴向上
        // 平行光
        this.createLight("DirectionalLight", -16, -16, 24);
        global.on("createLight", (type)=>{this.createLight(type)});
        // 物体控制器 
        controller = new TransformControls(this.camera, cssDOM);
        controller.size = 0.8;
        controller.traverse((child)=>{child.userData.controller = true});  // 对控制器做标记，以在点击时区分它和其它物体
        var controllerVisible = true;
        controller.children[0].children[0].children[0].onBeforeRender = ()=>{  // 在控制器显现之前调整其位置
            // 自动将控制器移动到物体包围盒中心
            if(!attached.userData.protected) {
                // 物体旋转时将控制器移到包围盒中心
            }
        };
        global.on("changeControllerVisibility", (x)=>{  // 改变控制器的可见性
            controllerVisible = x;
            controller.visible = x;
            if(x && attached){  // 显示控制器时将其添加回场景
                SCENE.add(controller);
                controller.attach(attached); 
            }
            if(!x && attached){  // 隐藏控制器时将其移除出场景，以免仍能被选中
                SCENE.remove(controller);
                controller.detach();
            }
        });
        global.on("controlStart", (id)=>{  // 选中物体开始控制
            attached = SCENE.getObjectById(id);
            if(!controllerVisible) return;
            SCENE.add(controller);
            if(!attached.userData.protected) {
                controller.mode = "translate";  // 开始控制时总是平移
                controller.space = "local";  // 开始控制时控制器的坐标系为世界坐标系
                controller.attach(attached);
                let center = new THREE.Vector3();
                if(attached.isGroup) {  // 拖动Group
                    let mesh = attached.DT.wireframe;
                    let arr = mesh.geometry.attributes.position.array;
                    let xmax, ymax, zmax, xmin, ymin, zmin;
                    for(let i=0, ai=arr[0]; i<arr.length; i++, ai=arr[i]){
                        if (i % 3 == 0){
                            if(ai > xmax || !xmax) xmax = ai;
                            if(ai < xmin || !xmin) xmin = ai;
                        }
                        if (i % 3 == 1){
                            if(ai > ymax || !ymax) ymax = ai;
                            if(ai < ymin || !ymin) ymin = ai;
                        }
                        if (i % 3 == 2){
                            if(ai > zmax || !zmax) zmax = ai;
                            if(ai < zmin || !zmin) zmin = ai;
                        }
                    }
                    // center.set((xmin+xmax)/2, (ymin+ymax)/2, (zmin+zmax)/2);
                    // center.applyMatrix4(attached.matrix.invert());
                }
                else if(attached.geometry) {  // 拖动有geometry的物体
                    attached.geometry.boundingBox.getCenter(center);
                }
                else {  // 拖动无geometry的物体，如灯光
                    ;
                }
                let worldScale = center.clone;  // 总比例
                attached.getWorldScale(worldScale);
                center.multiplyScalar(worldScale.x);
                controller.position.copy(center);
            } else {  // 点击地面等则移除控制器
                global.emit("controlEnd");
            }
        });
        global.on("controlEnd", ()=>{
            if(attached) attached.DT.controlEnd()
        });
        // 透视和正交相机导向器（Gizmo）
        this.gizmoPersp = new ViewHelper(this.cameraPersp, DOM);
        this.gizmoOrtho = new ViewHelper(this.cameraOrtho, DOM);
        this.gizmoOrtho.visible = false;
        global.on("changeGizmoVisibility", visible => {
            if(visible){
                this.gizmoPersp.visible = this.camera == this.cameraPersp;
                this.gizmoOrtho.visible = this.camera == this.cameraOrtho;
            } else {
                this.gizmoPersp.visible = this.gizmoOrtho.visible = false;
            }      
        });
        // 地面
        this.ground = new THREE.Mesh( 
            new THREE.PlaneGeometry(500, 500), 
            new THREE.MeshBasicMaterial({ color: groundColor })
        );
        let DTGround = new DTObject(this.ground, true);
        this.ground.castShadow = true;
        this.ground.receiveShadow = true;
        this.ground.userData.ground = true;
        this.ground.userData.protected = true;
        this.ground.DT.mass = 0 // 不可动
        this.ground.DT.rigid = true;
        this.ground.DT.rigidShape = "new Ammo.btBoxShape(new Ammo.btVector3(groundSize, groundSize, margin))";
        this.ground.DT.createRigidBody();
        DTGround.setTitle("地面");
        SCENE.add(this.ground);
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
        let lineYMaterial = new THREE.LineBasicMaterial({color: "#0B0"});
        SCENE.add( new THREE.Line( lineYGeometry, lineYMaterial ) );
        // 负主坐标轴
        const lineGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3( -groundSize, 0, 0.02 ),
            new THREE.Vector3( 0, 0, 0.02 ),
            new THREE.Vector3( 0, -groundSize, 0.02 )
        ]);
        const lineMaterial = new THREE.LineBasicMaterial({color: "black"});
        const line = new THREE.Line(lineGeometry, lineMaterial);
        SCENE.add( line );
        this.composer = new EffectComposer(this.renderer);  // 物体边缘着色器
        // 渲染器滤镜
        const renderPass = new RenderPass(SCENE, this.camera); console.log(renderPass)
        this.composer.addPass(renderPass);
        // 边缘滤镜
        const outlinePass = new OutlinePass(new THREE.Vector2(), SCENE, this.camera);
        outlinePass.visibleEdgeColor.set("red");
        outlinePass.hiddenEdgeColor.set("red");
        outlinePass.downSampleRatio = 1;
        outlinePass.edgeGlow = 3;
        outlinePass.edgeStrength = 3;
        outlinePass.edgeThickness = 3;  // console.log(outlinePass)
        // 抗锯齿滤镜
        const effectFXAA = new ShaderPass( FXAAShader );
        // 点亮或熄灭某些物体的边缘
        global.on("lightWireframe", meshes => {
            outlinePass.selectedObjects = meshes;
            if(meshes && meshes.length){
                if(!this.composer.passes.includes(outlinePass)) {
                    this.composer.addPass(outlinePass);
                    this.composer.addPass(effectFXAA);
                }
            } else {
                this.composer.removePass(outlinePass);
                this.composer.removePass(effectFXAA);
            }
        })
        // 快捷键设置
        this.canvas.addEventListener("keydown", e => {
            if(global.mode() == "edit"){  // 在编辑模式下
                if(e.code == "KeyQ") controller.setMode("translate");  // 按Q平移
                else if(e.code == "KeyW") controller.setMode("rotate");  // 按W旋转
                //else if(e.code == "KeyE") controller.setMode("scale");  // 屏蔽缩放
                else if(e.code == "KeyE") {  // 按R切换全局坐标系和局部坐标系
                    if(controller.space == "world") controller.setSpace("local");
                    else controller.setSpace("world");
                }
                else if(e.code == "KeyE") {  // 按R切换全局坐标系和局部坐标系
                    if(controller.space == "world") controller.setSpace("local");
                    else controller.setSpace("world");
                }
                else if(e.code == "Escape") controller.reset();  // 按ESC恢复
                else if(e.ctrlKey) {  // 按Ctrl将移动间距离散化
                    if(e.code == "KeyZ") controller.reset();  // 按Ctrl+Z恢复
                    controller.setTranslationSnap( 1 );
                    controller.setRotationSnap( THREE.MathUtils.degToRad( 15 ) );
                    controller.setScaleSnap( 0.25 );
                }
            }
            if(global.mode() == "view"){  // 在浏览模式下
                const step = 5;  // 相机前进步长
                this.cameraMovable.copy(this.camera);
                this.cameraMovable.userData = {};
                if(e.code == "KeyW"){  // 按W前进，但借助camera0来求相机的新位置和角度
                    this.pointerControl.moveForward(step); 
                }
                if(e.code == "KeyS"){  // 按S后退
                    this.pointerControl.moveForward(-step); 
                }
                if(e.code == "KeyA"){  // 按A左移
                    this.pointerControl.moveRight(-step); 
                }
                if(e.code == "KeyD"){  // 按D右移
                    this.pointerControl.moveRight(step);
                }
                let p0 = this.cameraMovable.position.clone();
                this.camera.position.copy(p0);
                this.cameraMovable.getWorldDirection(front);
                new THREE.Ray(p0, front).intersectPlane(Ground, this.orbitControl.target);
            }
        })
        this.canvas.addEventListener("keyup", ()=>{
            controller.setTranslationSnap( null );
			controller.setRotationSnap( null );
			controller.setScaleSnap( null );
        })
        // 预先载入自定义模型
        this.preloadModels();
        global.on("init", ()=>this.init());
    }
    init(){  // 场景更新时的操作
        // 天空
        this.setSkyboxByColor(SCENE.DT);
        global.on("updateSkybox", ()=>{this.setSkyboxByColor(SCENE.DT)});
        // 远处雾化
        SCENE.fog = new THREE.Fog(this.ground.material.color, 5, 200);
        global.on("changeFogColor", (isGround)=>{  // 更改地面颜色时同时更改雾的颜色
            if(isGround) SCENE.fog.color.copy(this.ground.material.color);
        });
        emulateMode = "stop";
        loading = false;
        if(!animate){
            animate = () => {
                try{ requestAnimationFrame(animate) }
                catch{ return }
                if(moveToId > 0){  // 开始移动相机到双击的物体
                    global.emit("controlStart", moveToId);  // 防止相机移动时控制器消失
                    targetObject = SCENE.getObjectById(moveToId);     
                    p_start = this.camera.position.clone();  // 起点
                    let center = targetObject.position.clone();  // 中心点
                    var d = 10;  // 默认距离
                    if(!targetObject.userData.protected){  // 让物体包围盒越小，相机距离物体越近，反之亦然
                        // 求物体包围盒中心
                        targetObject.getWorldPosition(center);
                        let centerDelta = center.clone();
                        controller.getWorldPosition(centerDelta);
                        center.add(centerDelta);
                        // 求相机到物体的距离d与d*相机朝向
                        let wireframe = targetObject.children.filter(child=>child.userData.wireframe)[0];
                        if(wireframe){
                            let r = wireframe.geometry.boundingSphere.radius;  // 包围球半径
                            d = r * targetObject.DT.scale * 2.5;  // 距离 = 包围球半径 * 物体缩放 * 2.5
                        }
                    }
                    d = Math.max(d, 5);  // 让相机不能离物体太近
                    this.camera.getWorldDirection(front);
                    let delta = front.clone();
                    delta.multiplyScalar(d);
                    // 终点 = 物体包围盒中心 - d*相机朝向
                    p_end = center.sub(delta);
                    moveToId = -1;
                }
                if(moveToId < 0){  // 移动中
                    frameCounter++;
                    this.cameraMovable.position.lerpVectors(p_start, p_end, frameCounter/60);
                    let target = this.cameraMovable.position.clone();
                    this.camera.position.copy(target);
                    new THREE.Ray(target, front).intersectPlane(Ground, this.orbitControl.target);
                    if (frameCounter >= 60){  // 结束移动
                        this.orbitControl.enableRotate = true;
                        frameCounter = moveToId = 0;
                    }
                }
                this.render();
                this.orbitControl.update();
            };
            animate();
        }
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
    createAttachPoint1(x, y) {  // 传送带入口连接点(横坐标，纵坐标)
        const geom = new THREE.BoxGeometry(0.5, 0.5, 0.5);
        const material = new THREE.MeshBasicMaterial({ color: "red" });
        const point = new THREE.Mesh(geom, material);
        point.position.x = x;
        point.position.y = y
        point.name = "ap1";
        return point;
    }
    createAttachPoint2(x, y) {  // 传送带出口连接点(横坐标，纵坐标)
        const geom = new THREE.BoxGeometry(0.5, 0.5, 0.5);
        const material = new THREE.MeshBasicMaterial({ color: "lime" });
        const point = new THREE.Mesh(geom, material);
        point.position.x = x;
        point.position.y = y
        point.name = "ap2";
        return point;
    }
    createLight(type, x=0, y=0, z=24) {  // 创建光源
        let light, iconDOM = document.createElement('img');
        const iconMesh = new CSS2DObject( iconDOM );
        iconMesh.userData.dom = iconDOM;
        iconDOM.addEventListener('mousedown', e => {  // 点击图标时选中光源
            global.emit("clickLight", {choice: light, e: e})
        });
        if(type == "DirectionalLight"){  // 平行光
            light = new THREE.DirectionalLight( "white", 3 );
            light.castShadow = true;
            light.shadow.bias = - 0.003;
            light.shadow.camera.left = - 10;
            light.shadow.camera.right = 10;
            light.shadow.camera.top = 10;
            light.shadow.camera.bottom = - 10;
            light.shadow.camera.near = 2;
            light.shadow.camera.far = 50;
            light.shadow.mapSize.x = 1024;
            light.shadow.mapSize.y = 1024;
            // 平行光图标
            iconDOM.src = bulb;
            iconDOM.style.width = "30px";
            // 辅助箭头
            let dir = light.target.position.clone();
            dir.sub(light.position);
            dir.normalize();
            let origin = light.position.clone();
            origin.addScaledVector(dir, 2.5);
            let arrow = new THREE.ArrowHelper(
                dir, // 方向
                origin, // 原点 
                3,  // 总长度
                0xff8000,  // 颜色
                0.6,  // 头部长度
                0.3  // 头部宽度
            );
            arrow.setColor("orange");
            arrow.visible = false;
            light.attach( arrow );
            // 设置平行光朝向，并使平行光旋转时，光照方向也一并旋转
            light.target = new THREE.Object3D();
            SCENE.add( light.target );
            let target = light.userData.target = light.target.clone();
            light.attach( target );
            iconMesh.onBeforeRender = () => {
                target.getWorldPosition(light.target.position);
            }
        }
        if(type == "AmbientLight"){  // 环境光
            light = new THREE.AmbientLight( "white" );
            // 环境光图标
            iconDOM.src = sun;
            iconDOM.style.width = "30px";
        }  
        SCENE.add(light);
        new DTObject(light, true).setTitle();
        light.position.set(x, y, z);
        light.rotation.x = Math.PI / 2;
        iconMesh.center.set( 0.5, 0.5 );  // 图标居中
        iconMesh.position.set( 0, 0, 0 );  // 图标的三维相对位置
        light.add( iconMesh );
    }
    createMesh(item, position: Object){  // 定义拖入的物体属性
        let indicators = [];  // 传送带的指示箭头
        let attachPoint1 = [];//连接点1
        let attachPoint2 = [];//连接点2
        let modelPath = `src/assets/models/${item.modelpath}`;
        let mesh = new THREE.Mesh();
        let DT = new DTObject(mesh);
        if(item.group == "传送带" || item.group == "其它"){
            DT.mass = 0;
            DT.rigid = true; 
            if(item.modelname == "护栏"){  // 将刚体形状设为函数以便导出，否则读取刚体形状后只有指针
                DT.geometry = new THREE.BoxGeometry( 2, 0.5, 1 );
                DT.rigidShape = "new Ammo.btBoxShape(new Ammo.btVector3( 1, 0.25, 0.5 ))";
            }
            else if(item.modelname == "传感器"){
                DT.geometry = new THREE.BoxGeometry(3, 0.1, 0.1);
                DT.rigidShape = "new Ammo.btBoxShape(new Ammo.btVector3(1.5, 0.05, 0.05))";
                DT.material = { color: "lime", opacity: 0.5, transparent: true };
                DT.code = 'let rb = this.mesh.userData.physicsBody; \n rb.setMassProps(0, new Ammo.btVector3(0, 0, 0));'
            }
            else{
                DT.scale = 0.05;
                DT.geometry = customModels[modelPath];
                if(item.modelname == "直道"){
                    DT.material = { color: "lightgray" };
                    DT.rigidShape = "convex";
                    DT.v0 = 2;
                    mesh.userData.isConveyor = true;  // 传送带标记
                    indicators = [this.createArrow(0.5, 0, 0)]
                    attachPoint1 = [this.createAttachPoint1(0, 0)]
                    attachPoint2 = [this.createAttachPoint2(150, 0)]
                }
                if(item.modelname == "顺时针弯道"){
                    DT.material = { color: "lightgray" };
                    DT.v0 = 2;
                    mesh.userData.isConveyor = true;  // 传送带标记
                    let shape = new THREE.Shape(), pi = Math.PI, r = 3.6 / DT.scale, R = 6.4 / DT.scale;
                    shape.moveTo(0, R);
                    shape.absarc(0, 0, R, pi/2, pi, false);
                    shape.lineTo(-r, 0);
                    shape.absarc(0, 0, r, pi, pi/2, true);
                    shape.closePath();  
                    DT.rigidShape = new THREE.ExtrudeGeometry( shape, {
                        bevelEnabled: false,
                        curveSegments: 5,  // 曲线上取的点数，越少性能越好，越多精度越高
                        depth: -12,
                        steps: 1,
                    });
                    indicators = [this.createArrow(-5, 0, 90)]
                    attachPoint1 = [this.createAttachPoint1(-100, 0)]
                    attachPoint2 = [this.createAttachPoint2(0, 100)]
                }
                if(item.modelname == "逆时针弯道"){
                    DT.material = { color: "lightgray" };
                    DT.v0 = 2;
                    mesh.userData.isConveyor = true;  // 传送带标记
                    let shape = new THREE.Shape(), pi = Math.PI, r = 3.6 / DT.scale, R = 6.4 / DT.scale;
                    shape.moveTo(0, R);
                    shape.absarc(0, 0, R, pi/2, pi, false);
                    shape.lineTo(-r, 0);
                    shape.absarc(0, 0, r, pi, pi/2, true);
                    shape.closePath();  
                    DT.rigidShape = new THREE.ExtrudeGeometry( shape, {
                        bevelEnabled: false,
                        curveSegments: 5,  // 曲线上取的点数，越少性能越高，越多精度越高
                        depth: -12,
                        steps: 1,
                    });
                    indicators = [this.createArrow(0, 5, 180)]
                    attachPoint1 = [this.createAttachPoint1(0, 100)]
                    attachPoint2 = [this.createAttachPoint2(-100, 0)]
                }
                if(item.modelname == "弯道（凸集）"){
                    DT.material = { color: "lightgray" };
                    DT.rigidShape = "convex"
                    DT.v0 = 2;
                    mesh.userData.isConveyor = true;  // 传送带标记
                    indicators = [this.createArrow(-5, 0, 90)]
                    attachPoint1 = [this.createAttachPoint1(-100, 0)]
                    attachPoint2 = [this.createAttachPoint2(0, 100)]
                }      
            }
            attachObjects.add(DT.mesh);
            localStorage.setItem('attachObjects', JSON.stringify(attachObjects));
        }
        else {  
            if(item.modelname == "发生器"){  
                DT.geometry = new THREE.BoxGeometry( 1, 1, 1 );
                DT.material = { color: "lime", opacity: 0.5, transparent: true };
                DT.special = true;
                DT.timeInterval = 5000;
            }
            else if(item.modelname == "回收器"){  
                DT.geometry = new THREE.BoxGeometry( 1, 1, 1 );
                DT.material = { color: "red", opacity: 0.5, transparent: true };
                DT.mass = 0;
                DT.rigid = true;
                DT.rigidShape = "new Ammo.btBoxShape(new Ammo.btVector3( 0.5, 0.5, 0.5 ))"; 
                DT.special = true;
            }
            else if(item.modelname == "货物"){  
                DT.geometry = new THREE.BoxGeometry( 1, 1, 1 );
                DT.material = { color: "blue" };
                DT.mass = 1;
                DT.rigid = true;
                DT.rigidShape = "new Ammo.btBoxShape(new Ammo.btVector3( 0.5, 0.5, 0.5 ))"; 
                DT.temp = true;  // 临时实体
            }
            else if(item.modelname == "正方体"){
                DT.geometry = new THREE.BoxGeometry( 1, 1, 1 );
                DT.material = { color: "lime" };
                DT.mass = 1;
                DT.rigid = true;
                DT.rigidShape = "new Ammo.btBoxShape(new Ammo.btVector3( 0.5, 0.5, 0.5 ))"; 
                DT.temp = true;
            }
            else if(item.modelname == "球"){
                DT.geometry = new THREE.SphereGeometry( 0.5 );
                DT.material = { color: "red" };
                DT.mass = 1;
                DT.rigid = true;
                DT.rigidShape = "new Ammo.btSphereShape(0.5)";
                DT.temp = true;
            }
            else if(item.modelname == "锥体"){
                DT.geometry = new THREE.ConeGeometry( 0.5, 1, 12 );
                DT.material = { color: "yellow" };
                DT.mass = 1;
                DT.rigid = true;
                DT.rigidShape = "new Ammo.btConeShape(0.5, 1, 12)";
                DT.temp = true;
            }
            else if(item.modelname == "圆柱"){
                DT.geometry = new THREE.CylinderGeometry(0.5, 0.5, 1);
                DT.material = { color: "blue" };
                DT.mass = 1;
                DT.rigid = true;
                DT.rigidShape = "new Ammo.btCylinderShape(new Ammo.btVector3( 0.5, 1, 0.5 ))";
                DT.temp = true;
            }
        }

        mesh.material = new THREE.MeshPhongMaterial(DT.material);
        if(item.group == "基本几何体"){mesh.rotateX(Math.PI/2);}
        DT.name = item.modelname;
        mesh.geometry = DT.geometry;
        DT.setTitle();
        DT.updateWireframes();

        if(indicators.length){  // 指示箭头
            for(let i of indicators){
                i.scale.setScalar(1/DT.scale);
                i.userData.indicator = true; 
                i.visible = global.layers().includes("指示箭头");
                mesh.add(i);
            }
        } 
        if (attachPoint1.length) {  // 传送带入口连接点
            for (let i of attachPoint1) {
                i.scale.setScalar(1 / DT.scale);
                mesh.add(i);
            }
        }
        if (attachPoint2.length) {  // 传送带出口连接点
            for (let i of attachPoint2) {
                i.scale.setScalar(1 / DT.scale);
                mesh.add(i);
            }
        }  

        mesh.castShadow = mesh.receiveShadow = true;
        mesh.position.copy(position);
        if(DT.scale != 1){ mesh.scale.setScalar(DT.scale); }
        SCENE.add(mesh);
        return mesh;
    }  
    createMeshFromAsset(DT, position){  // 定义从组件库中拖入的组件的物体属性
        let mesh0 = DT.mesh.clone();
        mesh0.traverse((mesh)=>{
            if(mesh.isGroup || mesh.isMesh) {
                mesh.castShadow = mesh.receiveShadow = true;
                mesh.material = new THREE.MeshPhongMaterial({color: "lightgray"});
                let DT0 = new DTObject(mesh, true);
                if(mesh.parent) mesh.parent.DT.children.push(DT0);
            }
        });
        let DT0 = mesh0.DT;
        DT0.name = DT.name;
        DT0.scale = DT.scale;
        DT0.setTitle();
        DT0.updateWireframes();
        mesh0.scale.setScalar(DT0.scale);
        mesh0.rotateX(Math.PI/2);
        mesh0.position.copy(position);
        SCENE.add(mesh0);
        return mesh0;
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
    render(){  // 渲染
        this.updatePhysics(clock.getDelta());
        //this.renderer.render(SCENE, this.camera);
        this.composer.render();
        this.cssRenderer.render(SCENE, this.camera);
        this.gizmoPersp.render(this.renderer);
        this.gizmoOrtho.render(this.renderer);
    } 
    setSkyboxByColor(DTScene) {  // 根据上中下三种颜色设置天空盒
        let skybox = DTScene.skybox;
        const radius: number = 600;
        const widthSegments: number = 32;
        const heightSegments: number = 15;
        const skyGeo = new THREE.SphereGeometry(radius, widthSegments, heightSegments);
        const uniforms = {
            topColor: { value: skybox.skyColor },
            skylineColor: { value: skybox.skyline },
            bottomColor: { value: skybox.groundColor },
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
          vec3 position = vec3(vWorldPosition.x - skyCenter.x, vWorldPosition.y - skyCenter.y, 
            vWorldPosition.z - skyCenter.z);
          float h = normalize( position + offset ).z;
          vec3 color;
          if (h > 0.0) {
            color = mix( skylineColor, topColor, max( pow( max( h, 0.0 ), exponent ), 0.0 ) );
          } else {
            color = mix( skylineColor, bottomColor, max( pow( max( -h, 0.0 ), exponent ), 0.0 ) );
          }
          gl_FragColor = vec4(color , 1.0);
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
            let DT0 = mesh0.DT, DT1 = mesh1.DT;
            
            if(DT1.temp){// 让临时实体排在前面
                let t=rb0; rb0=rb1; rb1=t; 
                t=mesh0; mesh0=mesh1; mesh1=t; 
                t=DT0; DT0=DT1; DT1=t;
            }
            if(mesh1.userData.isConveyor){  // 让临时实体遇到货物时受摩擦力作用
                let J = 5;  // 转动惯量J
                let k = Math.min(DT0.friction, DT1.friction);  // 滑动摩擦系数k
                let kw = k;  // 转动摩擦系数kw
                let m = DT0.mass;  // 质量m
                let v;  // 货物速度v
                let v0 = DT1.v0;  // 传送带中轴线速度v0
                let theta = mesh1.rotation.z;  //传送带旋转角θ 
                let R = 5;  // 传送带中轴线半径R
                if(DT1.name == "直道"){  // 摩擦力 F = kmg(v0-v)/||v0-v||，v和v0为向量
                    // 将v0从标量转换为货物处的速度矢量v0_real
                    let v0_real = new Ammo.btVector3(v0*Math.cos(theta), v0*Math.sin(theta), 0);
                    v = rb0.getLinearVelocity();
                    let F = new Ammo.btVector3();
                    F.op_add(v0_real).op_sub(v).normalize();
                    F.op_mul(k*m*g);
                    rb0.applyCentralForce(F);
                }
                else if(DT1.name && DT1.name.includes("弯道")){
                    let dir = DT1.name == "逆时针弯道" ? -1 : 1;  // 传送带移动方向（顺/逆时针）
                    let r = new THREE.Vector3();
                    r.add(mesh0.position).sub(mesh1.position);
                    r.setZ(0);
                    let ra = r.length();  // 径向矢量r=v0-v，模ra=||v0-v||
                    if(ra>=3.2 && ra<=6.4){  // 当货物到弯道的半径为3.2≤ra≤6.4时向其质心施力
                        // 将v0从标量转换为货物处的速度矢量v0_vec
                        let v0_vec = new Ammo.btVector3(r.y, -r.x, 0);  // 旋转v0
                        v0_vec.normalize();
                        v0_vec.op_mul(dir * v0 * ra / R);  // 将传送带上r=R处的速度转换为r=ra处的速度
                        v = rb0.getLinearVelocity();
                        let F = new Ammo.btVector3();  // 摩擦力 F = μmg(v0-v)/||v0-v||，v和v0为向量
                        F.op_add(v0_vec);
                        F.op_sub(v);
                        F.normalize();
                        F.op_mul(k*m*g);
                        rb0.applyCentralForce(F);
                        // 然后施加转矩
                        let w0 = -dir * v0_vec.length() / ra;  //传送带角速度ω0 
                        let w = rb0.getAngularVelocity().z();  //货物角速度ω0
                        let M = new Ammo.btVector3(0, 0, kw*J*(w0 - w));
                        rb0.applyTorque(M);  // 同理，摩擦力矩 M = kw*J*(ω0-ω)
                    }  
                }
                else if(DT1.name == "回收器"){
                    DT0.destroy();
                    global.emit("print", `【${DT0.name}${mesh0.id}】被【${DT1.name}${DT1.id}】回收`);
                }
                else if (DT1.name == "传感器") {
                    DT0.sensorStop();
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
                        let mesh0 = this.createMesh({group:"货物", modelname:"货物"}, mesh.position);  
                        // createrigid                    
                        mesh0.rotation.copy(mesh.rotation);
                        DTObjects.value.push(mesh0.DT);
                        SCENE.DT.children.push(mesh0.DT);
                        global.emit("print", `【${DT.name}${DT.id}】创建了【${mesh0.DT.name}${mesh0.id}】`);
                        DT.timer = now;
                    }
                }
                continue;
            };
            if(!DT.mesh.userData.physicsBody) continue;
            if(!mesh.isDrag){  // 刚体未被拖动时才计算
                if (mesh.position.manhattanDistanceTo(origin) > 10000 || 
                    Number.isNaN(mesh.position.x) ||
                    Number.isNaN(mesh.position.y) ||
                    Number.isNaN(mesh.position.z)){
                    mesh.DT.destroy();  // 物体太远或位置变为NaN时则清除
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