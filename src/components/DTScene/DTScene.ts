import bulb from "../../assets/svg/bulb.svg";
import demoScene from "./DemoScene.json";
import DTObject from "./DTObject";
import * as fs from "fs";
import global from "../../Global";
import modelData from "../Models/modelData.json";
const path = require("path");
import RAPIER from "@dimforge/rapier3d";
import sun from "../../assets/svg/sun.svg";
import * as THREE from "three"
import { computed, ref, watch } from "vue"

import { ColladaLoader } from "three/examples/jsm/loaders/COLLADALoader.js"
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js"
import { FXAAShader } from "three/examples/jsm/shaders/FXAAShader.js"
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"
import { OutlinePassFixed } from "./OutlinePassFixed"
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls.js"
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js"
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js"
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js"
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js"
import { ViewHelper } from "three/examples/jsm/helpers/ViewHelper.js"
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js"

var attached;  // 控制器附着的物体
var BottomFPS, BottomTimer;
const cameraFrontRay = new THREE.Ray();
let customModels = {};
let attachObjects = new THREE.Group();
var emulateMode = "stop";  // 仿真模式
var fps = 60;  // 帧率
var frameCounter = 0;  // 帧计数器，计满60帧近似看做1秒
var frames = 0;  // 帧率计算
let front = new THREE.Vector3(); 
var groundColor = "azure";
const groundSize = 250;  // 地面范围：-groundSize ≤ x ≤ groundSize，-groundSize ≤ y ≤ groundSize
const Ground = new THREE.Plane(UP);  // 平面z=0
var loader = new STLLoader();
var loading = false;
const minCameraFocusDistance = 5;  // 双击拉近时相机到物体的最小距离
const model_definition = modelData.model_definition;
var origin = new THREE.Vector3(0, 0, 0);
const PI = Math.PI;
const RIGHT = new THREE.Vector3(1, 0, 0);  // x轴朝右
var speed = 1;
var temp = false;
var UP = new THREE.Vector3(0, 0, 1);  // z轴朝上

// 物理量
var animate;
const clock = new THREE.Clock();
const g = 9.8;
const margin = 1e-5;  // rigidShape需要此间隙
var moveToId = 0;
var targetObject, p_start, p_end;  // 相机移动的目标物体，起点和终点
var renderPass;  // 边缘高亮滤镜
var T0;  // 开始仿真的时间
var time = performance.now();
var timeUpdateFPS = performance.now();

// 物理解算器
const gravity = new RAPIER.Vector3(0.0, 0.0, -9.81)
global.physicsWorld = new RAPIER.World(gravity);

global.on("changeEmulateMode", (mode: string)=>{emulateMode = mode});
global.on("changeSpeed", (k: string)=>{speed = parseInt(k.slice(0, k.length-1))});
global.on("clearLoads", ()=>{global.SCENE.DT.clearLoads()});
global.on("loading", ()=>{loading = true});

export default class SceneBuilder{
    camera  // 默认相机
    cameraMovable: THREE.PerspectiveCamera  // 可平移透视相机
    cameraOrtho: THREE.OrthographicCamera  // 正交相机
    cameraPersp: THREE.PerspectiveCamera  // 透视相机
    canvas: HTMLElement
    composer  // 边缘高亮着色器
    controller: TransformControls
    cssRenderer: THREE.CSS2DRenderer
    gizmoOrtho: THREE.ViewHelper
    gizmoPersp: THREE.ViewHelper
    ground
    orbitControl: OrbitControls
    outlinePass: any  // OutlinePassFixed
    pointerControl: PointerLockControls
    renderer: THREE.WebGLRenderer
    constructor(canvas: HTMLElement){ 
        // 初始化
        BottomFPS = document.getElementById("BottomFPS");
        BottomTimer = document.getElementById("BottomTimer"); 
        const DOM = document.getElementById("canvas");
        T0 = performance.now();
        this.canvas = canvas;

        // 场景
        new DTObject(global.SCENE, true);
        global.SCENE.DT.skybox = {
            skyColor: new THREE.Color("skyblue"), 
            skyline: new THREE.Color("white"), 
            groundColor: new THREE.Color("darkkhaki"), 
        };
        global.SCENE.DT.label = "protected";
        // 物体数量变化时
        watch(computed(()=>global.DTObjects.value.length), ()=>{  // 只检测DTObjects的长度变化
            if(loading) return;
            global.SCENE.DT.updateChildren();
            global.emit("updateTree");
            if(!temp) global.emit("saveInitScene");
            temp = true;
        });

        // 场景渲染器
        this.renderer = new THREE.WebGLRenderer({antialias: true});
        this.renderer.autoClear = false;
        this.renderer.shadowMap.enabled = true;
        const canvasDOM = this.renderer.domElement;
        this.canvas.appendChild(canvasDOM);

        // CSS渲染器
        this.cssRenderer = new CSS2DRenderer();
        let cssRendererDOM = this.cssRenderer.domElement;
        cssRendererDOM.style.position = 'absolute';
        cssRendererDOM.style.top = '0px';
        this.canvas.appendChild(cssRendererDOM);

        // 透视相机
        const near = 0.1;
        const far = 1000;
        const fov = 75;
        const ratio = DOM.offsetWidth / DOM.offsetHeight;
        this.cameraPersp = new THREE.PerspectiveCamera(fov, ratio, near, far);
        this.cameraPersp.position.set(0, -25, 15);
        this.cameraPersp.lookAt(0, 0, 0);
        this.cameraPersp.up.copy(UP);  // 在相机里让z轴向上
        this.camera = this.cameraPersp;
        global.camera = this.camera;
        global.on("cameraMoveTo", (id: number) => {  // 双击将相机拉近至物体
            moveToId = id;
        });   
        global.on("changeCamera", (data: any) => {  // 切换相机类型（透视/正交）
            let camera = this.camera;  // 前一个相机
            let position = camera.position;
            let target = this.orbitControl.target;
            let visible = global.layers.includes("gizmo");
            this.camera = {"透视": this.cameraPersp, "正交": this.cameraOrtho} [data];
            this.camera.position.copy(position);
            this.gizmoPersp.visible = visible && data == "透视";
            this.gizmoOrtho.visible = visible && data == "正交";
            this.orbitControl.object = this.camera;
            this.orbitControl.target.copy(target);
            renderPass.camera = this.camera;
            this.outlinePass.renderCamera = this.camera;
        })
        global.on("changeView", key => {
            let camera = this.camera;
            if(key == "默认视图") camera.position.set(0, -25, 15);           
            if(key == "俯视图") camera.position.set(0, 0, 20);
            if(key == "正视图") camera.position.set(0, -30, 5);
            if(key == "左视图") camera.position.set(-30, 0, 5);
            if(key == "右视图") camera.position.set(30, 0, 5);
            this.orbitControl.target.set(0, 0, 0)
        })

        // 透视/正交相机的轨道控制器
        this.orbitControl = new OrbitControls(this.camera, cssRendererDOM);
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
        this.pointerControl = new PointerLockControls(this.cameraMovable, cssRendererDOM);

        // 正交相机
        const k = 10;
        this.cameraOrtho = new THREE.OrthographicCamera(-k*ratio, k*ratio, k, -k, 0, 1000);
        this.cameraOrtho.position.set(0, -25, 15);
        this.cameraOrtho.lookAt(0, 0, 0);
        this.cameraOrtho.up.copy(UP);  // 在相机里让z轴向上

        // 平行光
        this.createLight("DirectionalLight", -16, -16, 24);

        // 物体控制器 
        this.controller = new TransformControls(this.camera, cssRendererDOM);
        this.controller.size = 0.8;
        this.controller.traverse(  // 对控制器做标记，以在点击时区分它和其它物体
            child => {child.isTransformControls = true}
        );
        this.controller.children[0].children[0].children[0].onBeforeRender = ()=>{  // 在控制器显现之前调整其位置
            // 自动将控制器移动到物体包围盒中心
            if(attached?.DT.label != "protected") {
                // 物体旋转时将控制器移到包围盒中心
            }
        };
        global.on("changeControllerVisibility", x => {  // 改变控制器的可见性
            this.controller.visible = x;
            if(x && attached){  // 显示控制器时将其添加回场景
                global.SCENE.add(this.controller);
                this.controller.attach(attached); 
            }
            if(!x && attached){  // 隐藏控制器时将其移除出场景，以免其仍能被选中
                global.SCENE.remove(this.controller);
                this.controller.detach();
            }
        });
        global.on("controlStart", (data: any) => {  // 选中物体开始控制
            let id, left_click;
            if(typeof data == "object") {left_click=data.left_click; data=data.id};
            id = parseInt(data);  // 若id为数字字符串则转换为数字
            attached = global.SCENE.getObjectById(id);
            if(!global.layers.includes("controller")) return;
            global.SCENE.add(this.controller);
            if(attached?.DT.label != "protected") {
                this.controller.space = "local";  // 开始控制时控制器的坐标系为世界坐标系
                this.controller.attach(attached);
                // 将控制器移动到被控制物体的包围盒中心
                if(!attached.isLight){
                    let POS = new THREE.Vector3();
                    attached.getWorldPosition(POS);
                    let wireframe = attached.DT.layers.wireframe[0];
                    let center = new THREE.Vector3();
                    wireframe.geometry.computeBoundingBox();
                    wireframe.geometry.boundingBox.getCenter(center);
                    center = attached.localToWorld(center);
                    this.controller.position.copy(center.sub(POS));
                }
            }
            else if(left_click) global.emit("controlEnd");  // 点击地面等则移除控制器
        });
        global.on("controlEnd", ()=>{  // 取消选择时移除控制器
            if(!attached) return;
            attached.DT.setProp();
            attached = null;
            global.SCENE.remove(this.controller);
            this.controller.detach();
            this.controller.setMode("translate");  // 取消选择时把控制器恢复为平移模式
        });
        this.canvas.addEventListener("keyup", ()=>{
            this.controller.setTranslationSnap( null );
			this.controller.setRotationSnap( null );
			this.controller.setScaleSnap( null );
        })

        // 透视和正交相机导向器（Gizmo）
        this.gizmoPersp = new ViewHelper(this.cameraPersp, canvasDOM);
        this.gizmoOrtho = new ViewHelper(this.cameraOrtho, canvasDOM);
        this.gizmoOrtho.visible = false;
        global.on("changeGizmoVisibility", visible => {
            this.gizmoPersp.visible = visible && this.camera == this.cameraPersp;
            this.gizmoOrtho.visible = visible && this.camera == this.cameraOrtho;
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
        this.ground.DT.label = "protected";
        this.ground.DT.mass = 0 // 不可动
        this.ground.DT.rigidShape = `RAPIER.ColliderDesc.cuboid(${groundSize}, ${groundSize}, ${margin})`;
        this.ground.DT.createRigidBody();
        global.SCENE.add(this.ground);
        DTGround.setTitle("地面"); 

        // 网格
        const gridHelper = new THREE.GridHelper(500, 100, groundColor, "#AAAAAA");
        gridHelper.rotateX(PI/2);
        global.SCENE.add( gridHelper );
        gridHelper.position.z = 0.01;

        // 正主坐标轴（不包括z轴）
        const lineXGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3( groundSize, 0, 0.02 ),
            new THREE.Vector3( 0, 0, 0.02 )
        ]);
        const lineXMaterial = new THREE.LineBasicMaterial({color: "red"});
        global.SCENE.add( new THREE.Line( lineXGeometry, lineXMaterial ) );
        let lineYGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3( 0, groundSize, 0.02 ),
            new THREE.Vector3( 0, 0, 0.02 )
        ]);
        let lineYMaterial = new THREE.LineBasicMaterial({color: "#0B0"});
        global.SCENE.add( new THREE.Line( lineYGeometry, lineYMaterial ) );

        // 负主坐标轴
        const lineGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3( -groundSize, 0, 0.02 ),
            new THREE.Vector3( 0, 0, 0.02 ),
            new THREE.Vector3( 0, -groundSize, 0.02 )
        ]);
        const lineMaterial = new THREE.LineBasicMaterial({color: "black"});
        const line = new THREE.Line(lineGeometry, lineMaterial);
        global.SCENE.add( line );

        // 物体边缘发光渲染器
        this.composer = new EffectComposer(this.renderer);
        // 渲染器滤镜
        renderPass = new RenderPass(global.SCENE, this.camera);
        this.composer.addPass(renderPass);
        // 边缘滤镜
        this.outlinePass = new OutlinePassFixed(
            new THREE.Vector2(DOM.clientWidth, DOM.clientHeight), 
            global.SCENE, this.camera);
        // 在边缘发光颜色中设负值可以将边缘颜色与浅色背景区分开，滤镜中是将边缘和背景的颜色直接相加
        this.outlinePass.visibleEdgeColor.set(1, -0.9, -0.9);
        this.outlinePass.hiddenEdgeColor.set(0.5, 0, 0);  // 隐藏边缘发出的光应更暗
        this.outlinePass.edgeGlow = 0.8;
        this.outlinePass.edgeStrength = 2.5;
        // 输出滤镜（使屏幕在任何模式下都变得模糊）
        const outputPass = new OutputPass();
        // 抗锯齿滤镜
        const antialiasingPass = new ShaderPass( FXAAShader );
        global.on("hideEdgeGlow", ()=>{  // 隐藏被选中物体边缘的发光
            this.composer.passes = [renderPass];
        })
        global.on("setEdgeGlow", (meshes: THREE.Object3D[]) => {  // 显示被选中物体边缘的发光
            this.outlinePass.selectedObjects = meshes;
            if(meshes && meshes.length){
                this.composer.passes = [
                    renderPass, 
                    this.outlinePass,
                    outputPass, 
                    antialiasingPass
                ];
            }
            global.emit("updateEdgeGlow", {width: DOM.clientWidth, height: DOM.clientHeight});
        })
        global.on("updateEdgeGlow", (options: any) => {  // 更新滤镜的分辨率
            let width = options.width, height = options.height;
            this.composer.setPixelRatio(width / height);
            this.composer.setSize(width, height);
            this.outlinePass.resolution.set(options.width, options.height);
            antialiasingPass.uniforms["resolution"].value.set(1/width, 1/height);
        })

        // 创建物体
        global.on("createMesh", (type: any) => {
            let mesh, DT;
            if(type.includes("Light")) mesh = this.createLight(type);  // 创建灯光
            else{
                if(type == "Group") {  // 创建群组
                    mesh = new THREE.Group();
                }
                global.SCENE.add(mesh);
                DT = new DTObject(mesh, true);
                DT.setTitle();
                DT.updateWireframes();
            }
            global.emit("clickModel", {id:mesh.id, shift:false});  // 创建物体后模拟点击该物体
        });

        // global.emit("rotateMesh", {mesh: global.SCENE.getObjectById(220), angle: 45})
        global.on("rotateMesh", (data: any) => {  // 让变道护栏接收到消息时旋转
            let T = data.T ?? 1;
            let mesh = data.mesh;
            let angle = data.angle;
            let t1 = mesh.rotation.z % (2*PI);
            let t2 = (t1 + angle/180*PI + 2*PI) % (2*PI);
            let theta = t1;
            if(angle > 0){  // angle为正是逆顺时针
                if(theta > t2) theta -= 2*PI;
            } else {  // 逆时针
                if(theta < t2) theta += 2*PI;
            }
            let dTheta = (t2 - theta)/(T*60);
            let counter = T*60;

            mesh.DT.code.update = () => {
                mesh.rotation.z += dTheta;
                theta = mesh.rotation.z;
                counter--;
                if(counter <= 0){
                    mesh.rotation.z = t2;
                    mesh.DT.code.update = '';
                }
            };
        });

        // 更新物体位置
        global.on("updateMeshPosition", (data: any) => {
            if(emulateMode != "play") return;  // 暂停时不更新
            data.mesh.position.copy(data.position);
            data.mesh.updateMatrixWorld(true);
            data.mesh.updateRigidbodyTransform();
            //data.mesh.code.update = 
        });

        // 更新托盘位置
        global.on("updateTrayPosition", (data: {deviceID, RFID}) => {
            console.log(data)
            if(emulateMode != "play") return;  // 暂停时不更新
            if(data.RFID == "\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00")
                data.RFID = "822fbee2-1fe0-45c8-b403-8b5cdb31cb25";
            let sensorDT = global.physicalIDMap[data.deviceID];
            let trayDT = global.physicalIDMap[data.RFID];
            if(!sensorDT || !trayDT) return;  // 若传感器或托盘不存在，则不执行后续操作
            if(trayDT && !trayDT.sensorPass){  // 修改托盘的碰撞掩码，使之可通过光电门
                // 若同步位置时实物比在制品先到光电门
                if(!trayDT.touchSensor || trayDT.touchSensor != sensorDT) {
                    // 让在制品瞬移到光电门处
                    let target = sensorDT.mesh.position.clone();
                    let delta = new THREE.Vector3();
                    let Q = new THREE.Quaternion();
                    sensorDT.mesh.getWorldQuaternion(Q);
                    delta.applyQuaternion(Q);
                    target.sub(delta);
                    target.z -= 0.1;  // 托盘高0.6，光电门高0.8，两者中心的高差0.1
                    trayDT.mesh.position.copy(target);
                    // 调整在制品的旋转角
                    trayDT.mesh.rotation.set(PI/2, 0, 0);
                    let R = new THREE.Euler().setFromQuaternion(Q);
                    trayDT.mesh.rotateOnWorldAxis(UP, R.z);
                    trayDT.updateRigidbodyTransform();  // 强制更新刚体位姿
                }
                // 光电门1延时20s，其它光电门延时5s
                let timeout = data.deviceID == "a5197017-c560-4713-aacd-01f097dda18f" ? 5000 : 5000;
                setTimeout(() => {  // 五秒后修改托盘的碰撞掩码，允许其通过光电门
                    let sensor_collider = global.physicsWorld.colliders.get(sensorDT.rb().handle);
                    trayDT.sensorPass = true;
                    // 将光电门的collider的enabled属性设为false，使托盘能通过
                    sensor_collider.setEnabled(false);
                    setTimeout(() => {  // 一坤秒后修改托盘的碰撞掩码，禁止其通过光电门
                        sensor_collider.setEnabled(true);
                        trayDT.sensorPass = false;
                        trayDT.touchSensor = null;
                    }, 5000);
                }, timeout);
            }
            else if (trayDT.sensorPass){
                console.log("光电门冷却中");
            }
            else{
                console.log("光电门不存在");
            }
        })
        global.on("demoScene", ()=>{this.demoScene()});

        // 控制器快捷键设置
        this.canvas.addEventListener("keydown", e => {
            if(global.mode == "edit"){  // 在编辑模式下
                // 光电门1：a5197017-c560-4713-aacd-01f097dda18f
                // 光电门3：75292a01-6d17-4d50-bb75-d42718f75fe8
                // 光电门5：7f698a28-d9d4-456a-9814-19d6c9b2f1a1
                // 调试发送虚拟光电门信号
                if(e.code == "Digit1") global.emit("updateTrayPosition", {deviceID: "a5197017-c560-4713-aacd-01f097dda18f", RFID: "822fbee2-1fe0-45c8-b403-8b5cdb31cb25"});
                if(e.code == "Digit3") global.emit("updateTrayPosition", {deviceID: "75292a01-6d17-4d50-bb75-d42718f75fe8", RFID: "822fbee2-1fe0-45c8-b403-8b5cdb31cb25"});
                if(e.code == "Digit5") global.emit("updateTrayPosition", {deviceID: "7f698a28-d9d4-456a-9814-19d6c9b2f1a1", RFID: "822fbee2-1fe0-45c8-b403-8b5cdb31cb25"}); 
                if(e.code == "KeyQ") this.controller.setMode("translate");  // 按Q平移
                else if(e.code == "KeyW") this.controller.setMode("rotate");  // 按W旋转
                else if(e.code == "KeyE") {  // 按R切换全局坐标系和局部坐标系
                    if(this.controller.space == "world") this.controller.setSpace("local");
                    else this.controller.setSpace("world");this.updateRigidBodies();
                }
                else if(e.code == "KeyA") {  // 按A拉伸直道传送带
                    let target = this.controller.object;
                    if(target.DT.name.includes("直道") || target.DT.name == "直护栏"){
                        this.controller.setMode("scale");
                    }
                }
                else if(e.code == "Escape") this.controller.reset();  // 按ESC恢复
                else if(e.ctrlKey) {  // 按Ctrl将移动间距离散化
                    if(e.code == "KeyZ") this.controller.reset();  // 按Ctrl+Z恢复
                    this.controller.setTranslationSnap( 1 );
                    this.controller.setRotationSnap( THREE.MathUtils.degToRad( 15 ) );
                    this.controller.setScaleSnap( 0.25 );
                }
            }
            if(global.mode == "view"){  // 在浏览模式下
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

        // 预先载入自定义模型
        this.preloadModels();
        global.on("init", ()=>this.init());
    }
    async init(){  // 场景更新时的操作
        // 天空
        global.SCENE.DT.setSkyboxByColor();
        global.on("updateSkybox", ()=>{global.SCENE.DT.setSkyboxByColor()});
        // 远处雾化
        global.SCENE.fog = new THREE.Fog(this.ground.material.color, 5, 300);
        global.on("changeFogColor", (isGround)=>{  // 更改地面颜色时同时更改雾的颜色
            if(isGround) global.SCENE.fog.color.copy(this.ground.material.color);
        });
        global.SCENE.DT.updatePhysicalIDMap();
        emulateMode = "stop";
        loading = false;
            

        if(!animate){
            animate = () => {
                requestAnimationFrame(animate);
                if(moveToId > 0){  // 开始移动相机到双击的物体
                    global.emit("controlStart", moveToId);  // 防止相机移动时控制器消失
                    targetObject = global.SCENE.getObjectById(moveToId);  
                    p_start = this.camera.position.clone();  // 起点
                    let center = targetObject.position.clone();  // 中心点
                    var d = 10;  // 默认距离
                    var r;  // 包围球半径

                    if(targetObject.isGroup){  // 拉近至群组时将目标设为其包围盒中心
                        let wireframe = targetObject.DT.layers.wireframe[0];
                        let boundingSphere = wireframe.geometry.boundingSphere;
                        center = boundingSphere.center;
                        r = boundingSphere.radius;
                    }
                    else{
                        // 求物体包围盒中心
                        targetObject.getWorldPosition(center);
                        let centerDelta = center.clone();
                        this.controller.getWorldPosition(centerDelta);
                        center.add(centerDelta);
                        r = targetObject.DT.geometry?.boundingSphere.radius;
                    }
                    
                    // 求相机到物体的距离d与d*相机朝向
                    if(!r || targetObject.DT.label == "protected") r = minCameraFocusDistance;
                    d = r * targetObject.DT.scale * 2.5;  // 距离 = 包围球半径 * 物体缩放 * 2.5
                    d = Math.max(d, minCameraFocusDistance);  // 让相机不能离物体太近
                    this.camera.getWorldDirection(front);
                    let delta = front.clone();
                    delta.multiplyScalar(d);
                    // 终点 = 物体包围球中心 - d*相机朝向
                    p_end = center.sub(delta);
                    moveToId = -1;
                }
                else if(moveToId < 0){  // 移动中
                    frameCounter++;
                    this.cameraMovable.position.lerpVectors(p_start, p_end, frameCounter/60);
                    this.camera.position.copy(this.cameraMovable.position);
                    cameraFrontRay.set(this.cameraMovable.position, front);
                    cameraFrontRay.intersectPlane(Ground, this.orbitControl.target);
                    if (frameCounter >= 60){  // 移动结束
                        this.orbitControl.enableRotate = true;
                        frameCounter = moveToId = 0;
                    }
                }
                this.render();
            };
            animate();
        }
    }
    
    createArrow(x, y, theta){  // 指示箭头(横坐标，纵坐标，旋转角)
        let theta0 = theta * PI / 180;
        let theta1 = (theta+90) * PI / 180;
        let theta2 = (theta-90) * PI / 180;
        const triangle = new THREE.Shape();
        triangle.moveTo(x + 2*Math.cos(theta0), y + 2*Math.sin(theta0));
        triangle.lineTo(x + 0.5*Math.cos(theta1), y + 0.5*Math.sin(theta1));
        triangle.lineTo(x + 0.5*Math.cos(theta2), y + 0.5*Math.sin(theta2));
        const geom = new THREE.ShapeGeometry(triangle);
        const material = new THREE.MeshBasicMaterial({ color: "white" });
        return new THREE.Mesh(geom, material) ;
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
        const material = new THREE.MeshBasicMaterial({color: "lime"});
        const point = new THREE.Mesh(geom, material);
        point.position.x = x;
        point.position.y = y
        point.name = "ap2";
        return point;
    }
    createCircle(x, y, r, color="white") {  // 圆形(横坐标，纵坐标，半径)
        const circle = new THREE.Shape();
        circle.absarc(x, y, r, 0, 2 * PI);
        const geom = new THREE.ShapeGeometry(circle);
        const material = new THREE.MeshBasicMaterial({ color: color });
        return new THREE.Mesh(geom, material) ;
    }
    createLabel(mesh){  // 创建名牌
        let labelDOM = document.createElement("div");
        labelDOM.style.backgroundColor = "rgba(0, 0, 0, 0.5)";  // 加上半透明背景和文字边缘
        labelDOM.style.color = "white";
        labelDOM.style.paddingLeft = "3px";
        labelDOM.style.paddingRight = "3px";
        const label = new CSS2DObject(labelDOM); 
        mesh.add(label);
        mesh.DT.layers.label = [label];
        const mesh0 = mesh.clone();
        mesh0.position.setScalar(0);
        const delta = new THREE.Vector3(0, 0, 3);  // 标签与包围盒中心之差 
        label.position.copy(mesh0.worldToLocal(delta));
    }
    createLight(type, x=0, y=0, z=24) {  // 创建光源
        let arrow, light, lightDOM = document.createElement("img");
        // 光源物体
        const iconMesh = new CSS2DObject(lightDOM);
        iconMesh.userData.dom = lightDOM;
        if(type == "DirectionalLight"){  // 平行光
            light = new THREE.DirectionalLight("white", 3);
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
            lightDOM.src = bulb;
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
            global.SCENE.add( light.target );
            let target = light.userData.target = light.target.clone();
            light.attach( target );
            /*
            let cube = new THREE.Mesh();
            cube.geometry = new THREE.BoxGeometry( 0.1, 0.1, 0.1 );
            cube.material = new THREE.MeshBasicMaterial({color: "white"});
            light.add(cube);
            */
            iconMesh.onBeforeRender = () => {
                target.getWorldPosition(light.target.position);
                // 判断光源有无被遮挡，有则隐藏其图标
                /*let pos = light.position.clone();
                pos.project(this.camera);
                ray.setFromCamera(pos, this.camera);
                let results = ray.intersectObject(this.global.SCENE);
                let result;
                for(let item of results){
                    if(item.object.isTransformControls) continue;
                    result = item.object == cube;
                    break;
                }
                console.log(result);*/
            }
        }
        if(type == "AmbientLight"){  // 环境光
            light = new THREE.AmbientLight("white");
            // 环境光图标
            lightDOM.src = sun;
        }  
        // 光源图标
        lightDOM.id = light.id;
        lightDOM.style.width = "30px";
        // 光源物体
        global.SCENE.add(light);
        light.position.set(x, y, z);
        light.rotation.x = PI / 2;
        iconMesh.center.set( 0.5, 0.5 );  // 图标居中
        iconMesh.position.set( 0, 0, 0 );  // 图标的三维相对位置
        light.add( iconMesh );
        // 光源DT
        let lightDT = new DTObject(light, true)
        lightDT.icon = lightDOM; 
        if(arrow) lightDT.layers.lightArrow = [arrow];
        lightDT.setTitle();
        return light;
    }
    createMeshFromAssets(DT, position){  // 定义从组件库中拖入的组件的物体属性
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
        DT0.traverse(DT => {
            // 递归地给所有从外部导入组件库并从组件库拖入场景的模型加上标签
            DT.label = "importedModel";
            if(DT.mesh.isMesh){  // 递归地给导入模型加上与包围盒相同的刚体形状
                let rb_mesh = new THREE.Mesh();
                DT.mesh.add(rb_mesh);
                DT.mass = 0;
                DT.rigidFollow = true;
                DT.rigidShape = "box";
                DT.createRigidBody("rigidHelper");
            }
        });
        mesh0.castShadow = mesh0.receiveShadow = true;
        mesh0.scale.setScalar(DT0.scale);
        mesh0.rotateX(PI/2);
        mesh0.position.copy(position);
        global.SCENE.add(mesh0);
        return mesh0;
    }   
    createMeshFromModels(
        data, 
        position: THREE.Vector3, 
        rotation: THREE.Euler=null,
        DToptions={}
    ){  // 定义拖入的物体属性
        let mesh = new THREE.Mesh();
        let DT = new DTObject(mesh);
        let title = data.title;
        let path = modelData.model_definition[title].modelPath;
        if(path){
            path = `src/assets/models/${path}`;
            DT.geometry = customModels[path];  
        }
        // 先复制JSON中的模型定义再使用，以免相应的模型定义在使用时被自动修改
        let obj = JSON.parse(JSON.stringify(model_definition[data.title]));
        for(let key in obj) DT[key] = obj[key];
        if(DT.geometry instanceof Array){  // 如果模型的json定义为写成多行的回调函数，则合并为一行并调用
            DT.geometry = eval(DT.geometry.join(''))();
        }
        else if(typeof DT.geometry == "string") DT.geometry = eval(DT.geometry);
        mesh.material = new THREE.MeshPhongMaterial(DT.material);
        DT.basename = DT.name = data.title;
        mesh.geometry = DT.geometry;
        DT.rigidFollow = !DT.mass;
        DT.setTitle();
        DT.updateWireframes();

        if(DT.label == "conveyor"){
            attachObjects.add(mesh);
            // localStorage.setItem('attachObjects', JSON.stringify(attachObjects));
        }
        if(DT.label == "WIP") mesh.rotateX(PI/2);

        for(let layer in DT.layers){  // 解析图层
            let result = DT.layers[layer];
            if(typeof result == "string") DT.layers[layer] = eval(result); 
        }
        if(DT.layers.indicator) for(let item of DT.layers.indicator){  // 指示箭头
            item.scale.setScalar(1 / DT.scale);
            item.userData.indicator = true; 
            item.visible = global.layers.includes("indicator");
            mesh.add(item);
            if(DT.label == "guardrail") item.position.z += 1 / DT.scale;
            item.position.z += 0.01 / DT.scale;  // 将箭头稍微上调，以免和物体重叠
        }
        if(DT.layers.attachPoint1) for (let item of DT.layers.attachPoint1) {  // 传送带入口连接点
            item.scale.setScalar(1 / DT.scale);
            mesh.add(item);
        }
        if(DT.layers.attachPoint2) for (let item of DT.layers.attachPoint2) {  // 传送带出口连接点
            item.scale.setScalar(1 / DT.scale);
            mesh.add(item);
        }
        mesh.castShadow = mesh.receiveShadow = true;
        mesh.position.copy(position);
        if(rotation) mesh.rotation.copy(rotation);
        if(DT.scale != 1) mesh.scale.setScalar(DT.scale);
        for(let option of Object.keys(DToptions)){
            DT[option] = DToptions[option];
        }
        this.createLabel(mesh);
        global.SCENE.add(mesh);
        return mesh;
    }  
    createSkyBoxFromTexture() {
        // 图片路径有要求，需要放在public文件夹下
        const picPath = "../src/assets/skybox/"; // 默认为public内
        const skybox = new THREE.CubeTextureLoader().setPath(picPath)
        .load(["px.jpg", "nx.jpg", "py.jpg", "ny.jpg", "pz.jpg", "nz.jpg"]);
        skybox.format = THREE.RGBAFormat;
        global.SCENE.background = skybox;
    }
    onCollision(){  // 检测物理世界中的物体是否与传送带碰撞，若有则施力
        global.physicsWorld.forEachCollider(collider0 => {
            // 让在制品排在前面，即等于mesh0
            let label = global.rb2mesh[collider0._parent.handle].DT.label;
            if(label != "WIP" && !collider0.isSensor()) return;
            let onConveyor = false;  // 记录在制品是否在传送带上，若不在则清空施力
            global.physicsWorld.contactPairsWith(collider0, collider1 => {
                // 寻找对应的刚体和网格
                let rb0 = collider0._parent, rb1 = collider1._parent;
                let mesh0 = global.rb2mesh[rb0.handle], mesh1 = global.rb2mesh[rb1.handle];
                let DT0 = mesh0.DT, DT1 = mesh1.DT;
                if(DT1.label == "conveyor"){  // 让在制品遇到货物时受摩擦力作用
                    rb0.resetForces();
                    rb0.resetTorques();
                    onConveyor = true;
                    let J = 10;  // 转动惯量J
                    let k = Math.min(DT0.friction, DT1.friction);  // 滑动摩擦系数k
                    let kw = k;  // 转动摩擦系数kw
                    let m = DT0.mass;  // 质量m
                    let P = new THREE.Vector3(), Q = new THREE.Quaternion(), R = new THREE.Euler();
                    mesh1.getWorldPosition(P);
                    mesh1.getWorldQuaternion(Q);
                    R.setFromQuaternion(Q);
                    let v;  // 货物速度v
                    let v0 = DT1.v0 * 2 * 60 / fps;  // 传送带中轴线速度v0，运行时根据帧率进行调整
                    let theta = R.z;  //传送带旋转角θ 
                    R = 5;  // 传送带中轴线半径R
                    if(DT1.basename?.includes("直道")){  // 摩擦力 F = kmg(v0-v)/||v0-v||，v和v0为向量
                        let v0_vec = new THREE.Vector3(v0*Math.cos(theta), v0*Math.sin(theta), 0);  // 将v0从标量转换为货物处的速度矢量v0_vec
                        v = rb0.linvel();
                        v = new THREE.Vector3(v.x, v.y, v.z);
                        let F = v0_vec.clone();
                        F.sub(v);
                        F.normalize();
                        F.multiplyScalar(2*k*m*g);
                        rb0.addForce(new RAPIER.Vector3(F.x, F.y, F.z));
                    } else if(DT1.basename?.includes("弯道")) {
                        let dir = DT1.basename.includes("逆时针弯道") ? -1 : 1;  // 传送带移动方向（顺/逆时针）
                        let r = new THREE.Vector3();
                        r.add(mesh0.position).sub(P);
                        r.setZ(0);
                        let ra = r.length();  // 周向矢量r=v0-v，模ra=||v0-v||
                        if(ra>=3.2 && ra<=6.4){  // 当货物到弯道的半径为3.2≤ra≤6.4时向其质心施力
                            // 将v0从标量转换为货物处的速度矢量v0_vec
                            let v0_vec = new THREE.Vector3(r.y, -r.x, 0);  // 旋转v0
                            v0_vec.normalize();
                            v0_vec.multiplyScalar(dir*v0*ra/R, v0_vec);  // 将传送带上r=R处的速度转换为r=ra处的速度
                            v = rb0.linvel();
                            let F = v0_vec.clone();  // 周向摩擦力F = μmg(v0-v)/||v0-v||，v和v0为向量
                            F.sub(v, F);
                            F.normalize();
                            F.multiplyScalar(2*k*m*g, F);
                            rb0.addForce(new RAPIER.Vector3(F.x, F.y, F.z));
                            // 然后施加转矩，使在制品尽量对准中轴线
                            let w0 = -dir * v0_vec.length() / ra;  //传送带角速度ω0 
                            let w = rb0.angvel().z;  //货物角速度ω0
                            let M = new RAPIER.Vector3(0, 0, 1.5*kw*J*(w0 - w));
                            rb0.addTorque(M);  // 同理，摩擦力矩 M = kw*J*(ω0-ω)
                        }  
                    }
                }
                else if (DT1.label == "sensor"){
                    DT0.touchSensor = DT1;
                }
                else if (DT1.label == "special"){
                    if (DT1.basename == "回收器"){
                        DT0.destroy();
                        global.emit("print", `【${DT0.name}${mesh0.id}】被【${DT1.name}${DT1.id}】回收`);
                    }
                }

                try{  // 刚体与物体碰撞时运行的脚本
                    if(DT0.code.onCollision){
                        eval(DT0.code.onCollision);
                    }
                }
                catch(err) {console.log(err);}
            });

            try{
                let rb0 = collider0._parent;
                let mesh0 = global.rb2mesh[rb0.handle];
                let DT0 = mesh0.DT;
                if(collider0.isSensor()){  // 传感器与物体的重叠时运行的脚本
                    global.physicsWorld.intersectionPairsWith(collider0, collider1 => {
                        if(DT0.code.onCollision){ 
                            let rb1 = collider1._parent;
                            let mesh1 = global.rb2mesh[rb1.handle];
                            let DT1 = mesh1.DT; 
                            eval(DT0.code.onCollision);
                        }
                    });
                } 
            }
            catch(err) {console.log(err);}

            if(!onConveyor){  // 若在制品不在传送带上则清空施力
                let rb0 = collider0._parent;
                rb0.resetForces();
                rb0.resetTorques();
            }
        })
    } 
    preloadModels(){  // 事先载入所有的已有模型
        const modelPath = "src/assets/models";
        function searchFiles(dir) {  // 使用同步操作
            fs.readdirSync(modelPath + dir).forEach(fileName => {
                let filePath = modelPath + dir + '/' + fileName;
                let stats = fs.statSync(filePath);
                if (stats.isDirectory()) {  // 如果是文件夹
                    searchFiles(dir + '/' + fileName);  // 递归子目录
                }
                else if (path.extname(filePath) == ".stl") {  // 如果是stl文件
                    customModels[filePath] = true; // 保存模型文件的路径
                }
            });
        }
        searchFiles('');  // 然后异步载入相应几何体（THREE.geometry）
        for(let modelPath in customModels){
            loader.loadAsync(modelPath).then(geom => {customModels[modelPath] = geom;});   
        }
    }
    removeRigidBody(mesh){  // 移除刚体
        let rb = mesh.DT.rb();
        global.physicsWorld.removeBody(rb);
        mesh.DT.layers.rigidShapeWorld = [];
    }
    render(){  // 渲染
        this.updatePhysics();
        this.composer.render();
        this.cssRenderer.render(global.SCENE, this.camera);
        if(this.camera == this.cameraPersp) this.gizmoPersp.render(this.renderer);
        if(this.camera == this.cameraOrtho) this.gizmoOrtho.render(this.renderer);
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
            BottomFPS.textContent = fps = frames;
            frames = 0;
            timeUpdateFPS = time;
        }
    }
    updateRigidBodies(){  // 改变物体的父子关系后，将刚体位置更新为物体的全局坐标
        Object.values(global.rb2mesh).forEach((mesh: any) => {
            let DT = mesh.DT;
            let rigidShapeWorld = mesh.layers.rigidShapeWorld;
            if(DT.mass != 0) return;
            if(rigidShapeWorld?.length) rigidShapeWorld[0].removeFromParent();
            let clone = new THREE.Mesh();
            clone.position.copy(mesh.position);
            clone.quaternion.copy(mesh.quaternion);
            global.SCENE.add(clone);
            mesh.getWorldPosition(clone.position);
            mesh.getWorldQuaternion(clone.quaternion);
            DT.layers.rigidShapeWorld = [clone];
        }
    )}
    updatePhysics(){  // 步进 
        let now = performance.now();     
        let pause = emulateMode == "pause", stop = emulateMode == "stop";  // 是否暂停或停止
        this.updateFPSandTime(now, pause, stop);
        if(stop) {T0 = performance.now();}  // 暂停后停止计时
        if(pause || stop) return;  // 未暂停时更新刚体
        if(emulateMode == "step") global.physicsWorld.step();  // 单步更新;
        else{
            for(let i=0; i<speed; i++) global.physicsWorld.step();
        }

        Object.values(global.rb2mesh).forEach((mesh: any) => {  // 让网格位置等于刚体位置
            const rb = global.mesh2rb[mesh.uuid];
            const DT = mesh.DT;
            try{  // 若物体有自定义脚本则执行
                if(typeof DT.code.update == "function") (DT.code.update)();
                else if(typeof DT.code.update == "string") eval(DT.code.update);
            }
            catch(e) {}
            if(!stop && DT.name == "发生器"){  // 未暂停时制造货物
                if(now - DT.timer >= DT.timeInterval){  // 秒变毫秒
                    let mesh0 = this.createMeshFromModels({title:"货物"}, mesh.position);                 
                    mesh0.rotation.copy(mesh.rotation);
                    global.DTObjects.value.push(mesh0.DT);
                    global.SCENE.DT.children.push(mesh0.DT);
                    mesh0.DT.createRigidBody();
                    global.emit("print", `【${DT.name}${DT.id}】创建了【${mesh0.DT.name}${mesh0.id}】`);
                    DT.timer = now;
                }
            }
            else if(true || !mesh.isDrag){  // 刚体未被拖动时才计算
                if (  // 物体太远或位置变为NaN时则清除
                    mesh.position.manhattanDistanceTo(origin) > 10000 || 
                    Number.isNaN(mesh.position.x) ||
                    Number.isNaN(mesh.position.y) ||
                    Number.isNaN(mesh.position.z)
                ){
                    console.log(mesh)
                    mesh.DT.destroy();
                }
                if(DT.rigidFollow){  // 强制让刚体位姿等于网格位姿
                    DT.updateRigidbodyTransform();
                }
                else{  // 运行时将网格位姿更新为刚体位姿
                    let P = rb.translation(), Q = rb.rotation();
                    mesh.position.set(P.x, P.y, P.z);  // 将网格位移设为刚体位移
                    mesh.quaternion.set(Q.x, Q.y, Q.z, Q.w);  // 将网格旋转设为刚体旋转
                }
            }
        });

        this.onCollision();
        if(emulateMode == "step") emulateMode = "pause";  // 步进模式下，每仿真完一步就停止
    }

    // 演示场景，1单位长度=50mm
    // 用global.emit("demoScene")启动，用DT().traverse(dt=>dt.v0=2)改变所有传送带速度
    // 用global.emit("updateTrayPosition", {deviceID:'A', RFID:'a'})向托盘发送消息
    // 光电门1物理实体ID：a5197017-c560-4713-aacd-01f097dda18f
    // 光电门3物理实体ID：75292a01-6d17-4d50-bb75-d42718f75fe8
    // 光电门5物理实体ID：7f698a28-d9d4-456a-9814-19d6c9b2f1a1
    // 托盘16物理实体ID：822fbee2-1fe0-45c8-b403-8b5cdb31cb25
    demoScene(){
        let mesh;
        const create = ({title, x, y, z, angle=0, length=1, prop=null}) => {  // 创建直护栏
            mesh = this.createMeshFromModels({title: title}, 
                new THREE.Vector3(x, y, z),
                new THREE.Euler(0, 0, angle*PI/180),
            );
            if(title.includes("直道")) {
                mesh.scale.x = length / 7.5 * mesh.DT.scale;
                mesh.DT.updateConveyorRigidbody();
            }
            else if(length!=1) mesh.DT.createRigidBody(null, 1, mesh.scale.y=length/6);
            else mesh.DT.createRigidBody();   

            if(prop){
                for(let key in prop) mesh.DT[key] = prop[key];
            }
            global.SCENE.DT.children.push(mesh.DT);
            return mesh;
        }

        // 传送带演示场景，从左下角开始顺时针创建，存储在同级目录的DemoScene.json中
        for(let group of Object.values(demoScene)){
            for(let key in group){
                create(group[key]);
            };
        }
        mesh.DT.updatePhysicalIDMap();
    }       
}