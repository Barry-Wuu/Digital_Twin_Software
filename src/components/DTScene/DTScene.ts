import bulb from "../../assets/svg/bulb.svg";
import DTObject from "./DTObject";
import * as fs from "fs";
import global from "../../Global";
import modelData from "../../assets/json/modelData.json";
const path = require("path");
import RAPIER from "@dimforge/rapier3d";
import sun from "../../assets/svg/sun.svg";
import * as THREE from "three"
import { computed, ref, watch } from "vue"

import { ColladaLoader } from "three/examples/jsm/loaders/COLLADALoader.js"
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js"
import { FXAAShader } from "three/examples/jsm/shaders/FXAAShader.js"
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"
import { OutlinePassFixed } from "./OutlinePassFixed"
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls.js"
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js"
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js"
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js"
import { ViewHelper } from "./ViewHelperFixed";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js"
import { nodeManager } from "../../utils/nodeManager"

var attached;  // 控制器附着的物体
var BottomFPS, BottomTimer;
const cameraFrontRay = new THREE.Ray();
let attachObjects = new THREE.Group();
var emulateMode = "stop";  // 仿真模式
var fps = 60;  // 帧率
var frameCounter = 0;  // 帧计数器，计满60帧近似看做1秒
var frames = 0;  // 帧率计算
let front = new THREE.Vector3();
var groundColor = "azure";
const groundSize = 250;  // 地面范围：-groundSize ≤ x ≤ groundSize，-groundSize ≤ y ≤ groundSize
const Ground = new THREE.Plane(UP);  // 平面z=0
var loading = false;
const minCameraFocusDistance = 5;  // 双击拉近时相机到物体的最小距离
const model_definition = modelData.model_definition;
var origin = new THREE.Vector3(0, 0, 0);
const PI = Math.PI;
const RIGHT = new THREE.Vector3(1, 0, 0);  // x轴朝右
var speed = 1;
var temp = false;
var tempGuardrails = [];
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

global.on("changeEmulateMode", (mode: string) => {
    emulateMode = mode;
    if (mode == "play") {  // 开始仿真时
        // 清除之前生成的隐形护栏
        for (let rb of tempGuardrails) {
            global.physicsWorld.removeRigidBody(rb);
        }
        tempGuardrails = [];

        // 在每两个护栏的交点处增加一截小的隐形护栏，让在制品转弯更加流畅
        global.physicsWorld.forEachCollider(collider => {
            let rb = collider._parent;
            let mesh = global.rb2mesh[rb.handle];
            let DT = mesh?.DT;
            if (DT?.basename == "直护栏") {
                global.physicsWorld.contactPairsWith(collider, collider0 => {
                    // 寻找对应的刚体和网格
                    let rb0 = collider0._parent;
                    let mesh0 = global.rb2mesh[rb0.handle];
                    let DT0 = mesh0.DT;
                    if (DT0.basename == "直护栏" && DT0.id > DT.id) {
                        const k = 0.5;  // 隐形护栏到两直护栏的交点的距离
                        const w = 0.1;  // 隐形护栏的半宽
                        let [x1, y1, z1] = mesh.position;
                        let theta1 = mesh.rotation.z + PI / 2;
                        let [x2, y2] = mesh0.position;
                        let theta2 = mesh0.rotation.z + PI / 2;
                        let d_theta = Math.abs(theta1 - theta2)
                        if (d_theta <= 1e-5) return;  // 平行
                        // 用线性代数求直线(x1, y1, theta1)和直线(x2, y2, theta2)的交点
                        const A = Math.cos(theta1);
                        const B = -Math.cos(theta2);
                        const C = Math.sin(theta1);
                        const D = -Math.sin(theta2);
                        const det = A * D - B * C;
                        const t = (D * (x2 - x1) - B * (y2 - y1)) / det;
                        let x = x1 + A * t;
                        let y = y1 + C * t;
                        // 调整旋转角
                        let tan = Math.min(Math.tan(d_theta / 2), 1 / Math.tan(d_theta / 2));
                        let theta = (theta1 + theta2) / 2;
                        if (d_theta > PI / 2) theta += PI / 2;
                        // 调整位置
                        let sin = Math.sin(theta);
                        let cos = Math.cos(theta);
                        if (k * cos * (y1 - y) - k * sin * (x1 - x) > 0) [x, y] = [x - k * sin, y + k * cos];
                        else[x, y] = [x + k * sin, y - k * cos];
                        // 添加刚体盒子
                        const rbDesc = RAPIER.RigidBodyDesc.fixed();
                        rbDesc.setTranslation(x, y, z1);  // 刚体的初始位置
                        let Q = new THREE.Quaternion().setFromAxisAngle(UP, theta);
                        rbDesc.setRotation(new RAPIER.Quaternion(Q.x, Q.y, Q.z, Q.w));  // 刚体的初始旋转
                        // 将形状添加到刚体中
                        const rb = global.physicsWorld.createRigidBody(rbDesc);
                        const shape = RAPIER.ColliderDesc.cuboid(k / tan, w, 0.5);
                        shape.setFriction(0);
                        global.physicsWorld.createCollider(shape, rb);
                        tempGuardrails.push(rb);
                        return;

                        // 显示两直护栏交点处的隐形护栏
                        let mesh1 = new THREE.Mesh(
                            new THREE.BoxGeometry(k * 2 / tan, w * 2, 1),
                            new THREE.MeshBasicMaterial({ color: "red" })
                        )
                        mesh1.position.set(x, y, z1);
                        mesh1.rotation.set(0, 0, theta);
                        global.SCENE.add(mesh1);
                    }
                });
            }
        });
    }
});
global.on("changeSpeed", (k: string) => { speed = parseInt(k.slice(0, k.length - 1)) });
global.on("clearLoads", () => { global.SCENE.DT.clearLoads() });
global.on("loading", () => { loading = true });

export default class SceneBuilder {
    camera  // 默认相机
    cameraMovable: THREE.PerspectiveCamera  // 可平移透视相机
    cameraOrtho: THREE.OrthographicCamera  // 正交相机
    cameraPersp: THREE.PerspectiveCamera  // 透视相机
    canvas: HTMLElement
    composer  // 边缘高亮着色器
    controller: TransformControls
    cssRenderer: THREE.CSS2DRenderer
    gizmoPersp: ViewHelper
    gizmoOrtho: ViewHelper
    ground
    orbitControl: OrbitControls
    outlinePass: any  // OutlinePassFixed
    pointerControl: PointerLockControls
    renderer: THREE.WebGLRenderer
    private deviceHandlers = new Map<string, Function>();  // 设备事件监听器
    constructor(canvas: HTMLElement) {
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
        watch(computed(() => global.DTObjects.value.length), () => {  // 只检测DTObjects的长度变化
            if (loading) return;
            global.SCENE.DT.updateChildren();
            global.emit("updateTree");
            temp = true;
        });

        // 场景渲染器
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
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
            this.camera = { "透视": this.cameraPersp, "正交": this.cameraOrtho }[data];
            this.camera.position.copy(position);
            this.gizmoPersp.visible = visible && data == "透视";
            this.gizmoPersp.domContainer.style.zIndex = data == "透视" ? 999 : 1;
            this.gizmoOrtho.visible = visible && data == "正交";
            this.gizmoOrtho.domContainer.style.zIndex = data == "正交" ? 999 : 1;
            this.orbitControl.object = this.camera;
            this.orbitControl.target.copy(target);
            renderPass.camera = this.camera;
            this.outlinePass.renderCamera = this.camera;
        })
        global.on("changeView", key => {
            let camera = this.camera;
            if (key == "默认视图") camera.position.set(0, -25, 15);
            if (key == "俯视图") camera.position.set(0, 0, 20);
            if (key == "正视图") camera.position.set(0, -30, 5);
            if (key == "左视图") camera.position.set(-30, 0, 5);
            if (key == "右视图") camera.position.set(30, 0, 5);
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
        this.cameraOrtho = new THREE.OrthographicCamera(-k * ratio, k * ratio, k, -k, 0, 1000);
        this.cameraOrtho.position.set(0, -25, 15);
        this.cameraOrtho.lookAt(0, 0, 0);
        this.cameraOrtho.up.copy(UP);  // 在相机里让z轴向上

        // 平行光
        this.createLight("DirectionalLight", -16, -16, 24);
        this.createLight("AmbientLight", -20, -16, 24);

        // 物体控制器 
        this.controller = new TransformControls(this.camera, cssRendererDOM);
        this.controller.size = 0.8;
        this.controller.traverse(  // 对控制器做标记，以在点击时区分它和其它物体
            child => { child.isTransformControls = true }
        );
        this.controller.children[0].children[0].children[0].onBeforeRender = () => {  // 在控制器显现之前调整其位置
            // 自动将控制器移动到物体包围盒中心
            if (attached?.DT.label != "protected") {
                // 物体旋转时将控制器移到包围盒中心
            }
        };
        global.on("changeControllerVisibility", x => {  // 改变控制器的可见性
            this.controller.visible = x;
            if (x && attached) {  // 显示控制器时将其添加回场景
                global.SCENE.add(this.controller);
                this.controller.attach(attached);
            }
            if (!x && attached) {  // 隐藏控制器时将其移除出场景，以免其仍能被选中
                global.SCENE.remove(this.controller);
                this.controller.detach();
            }
        });
        global.on("controlStart", (data: any) => {  // 选中物体开始控制
            let id, left_click;
            if (typeof data == "object") { left_click = data.left_click; data = data.id };
            id = parseInt(data);  // 若id为数字字符串则转换为数字
            attached = global.SCENE.getObjectById(id);
            if (!global.layers.includes("controller")) return;
            global.SCENE.add(this.controller);
            if (attached?.DT.label != "protected") {
                this.controller.space = "local";  // 开始控制时控制器的坐标系为世界坐标系
                this.controller.attach(attached);
                this.controller.showX = true;
                this.controller.showY = true;
                this.controller.showZ = true;
                // 将控制器移动到被控制物体的包围盒中心
                if (!attached.isLight) {
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
            else if (left_click) global.emit("controlEnd");  // 点击地面等则移除控制器
        });
        global.on("controlEnd", () => {  // 取消选择时移除控制器
            if (!attached) return;
            attached.DT.setProp();
            attached = null;
            global.SCENE.remove(this.controller);
            this.controller.detach();
            this.controller.setMode("translate");  // 取消选择时把控制器恢复为平移模式
        });
        this.canvas.addEventListener("keyup", () => {
            this.controller.setTranslationSnap(null);
            this.controller.setRotationSnap(null);
            this.controller.setScaleSnap(null);
        })

        // 透视和正交相机导向器（Gizmo）
        this.gizmoPersp = new ViewHelper(this.cameraPersp, this.renderer);
        this.gizmoPersp.setControls(this.orbitControl);
        this.gizmoPersp.domContainer.style.zIndex = 999;
        this.gizmoOrtho = new ViewHelper(this.cameraOrtho, this.renderer);
        this.gizmoOrtho.domContainer.style.zIndex = 1;
        this.gizmoOrtho.setControls(this.orbitControl);
        this.gizmoOrtho.visible = false;
        global.on("changeGizmoVisibility", visible => {
            this.gizmoPersp.visible = visible && this.camera == this.cameraPersp;
            this.gizmoPersp.domContainer.style.zIndex = this.camera == this.cameraPersp ? 999 : 1;
            this.gizmoOrtho.visible = visible && this.camera == this.cameraOrtho;
            this.gizmoOrtho.domContainer.style.zIndex = this.camera == this.cameraOrtho ? 999 : 1;
        });

        // 地面
        this.ground = new THREE.Mesh(
            new THREE.PlaneGeometry(1000, 1000),
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
        const gridHelper = new THREE.GridHelper(1000, 100, groundColor, "#AAAAAA");
        gridHelper.rotateX(PI / 2);
        global.SCENE.add(gridHelper);
        gridHelper.position.z = 0.01;

        // 正主坐标轴（不包括z轴）
        const lineXGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(groundSize, 0, 0.02),
            new THREE.Vector3(0, 0, 0.02)
        ]);
        const lineXMaterial = new THREE.LineBasicMaterial({ color: "red" });
        global.SCENE.add(new THREE.Line(lineXGeometry, lineXMaterial));
        let lineYGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, groundSize, 0.02),
            new THREE.Vector3(0, 0, 0.02)
        ]);
        let lineYMaterial = new THREE.LineBasicMaterial({ color: "#0B0" });
        global.SCENE.add(new THREE.Line(lineYGeometry, lineYMaterial));

        // 负主坐标轴
        const lineGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(-groundSize, 0, 0.02),
            new THREE.Vector3(0, 0, 0.02),
            new THREE.Vector3(0, -groundSize, 0.02)
        ]);
        const lineMaterial = new THREE.LineBasicMaterial({ color: "black" });
        const line = new THREE.Line(lineGeometry, lineMaterial);
        global.SCENE.add(line);

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
        const antialiasingPass = new ShaderPass(FXAAShader);
        global.on("hideEdgeGlow", () => {  // 隐藏被选中物体边缘的发光
            this.composer.passes = [renderPass];
        })
        global.on("setEdgeGlow", (meshes: THREE.Object3D[]) => {  // 显示被选中物体边缘的发光
            this.outlinePass.selectedObjects = meshes;
            if (meshes && meshes.length) {
                this.composer.passes = [
                    renderPass,
                    this.outlinePass,
                    outputPass,
                    antialiasingPass
                ];
            }
            global.emit("updateEdgeGlow", { width: DOM.clientWidth, height: DOM.clientHeight });
        })
        global.on("updateEdgeGlow", (options: any) => {  // 更新滤镜的分辨率
            let width = options.width, height = options.height;
            this.composer.setPixelRatio(width / height);
            this.composer.setSize(width, height);
            this.outlinePass.resolution.set(options.width, options.height);
            antialiasingPass.uniforms["resolution"].value.set(1 / width, 1 / height);
        })

        // 创建物体
        global.on("createMesh", (type: any) => {
            let mesh, DT;
            if (type.includes("Light")) {
                mesh = this.createLight(type);  // 创建灯光
                if (mesh.isAmbientLight) mesh.intensity = 0.5;  // 降低默认创建的环境光强度
            }
            else {
                if (type == "Group") {  // 创建群组
                    mesh = new THREE.Group();
                }
                global.SCENE.add(mesh);
                DT = new DTObject(mesh, true);
                DT.setTitle();
                DT.updateWireframes();
            }
            global.emit("clickModel", { id: mesh.id, shift: false });  // 创建物体后模拟点击该物体
        });
        //global.emit("consolebyid", {id: 220})
        global.on("consolebyid", (data: any) => {  // 输出检索id物体
            let mesh = global.SCENE.getObjectById(data.id);
            console.log(mesh, mesh.material);
        });
        // global.emit("rotateMesh", {mesh: global.SCENE.getObjectById(220), angle: 45})
        global.on("rotateMesh", (data: any) => {  // 让变道护栏接收到消息时旋转
            let T = data.T ?? 1;
            let mesh = data.mesh;
            let angle = data.angle;
            let t1 = mesh.rotation.z % (2 * PI);
            let t2 = (t1 + angle / 180 * PI + 2 * PI) % (2 * PI);
            let theta = t1;
            if (angle > 0) {  // angle为正是逆顺时针
                if (theta > t2) theta -= 2 * PI;
            } else {  // 逆时针
                if (theta < t2) theta += 2 * PI;
            }
            let dTheta = (t2 - theta) / (T * 60);
            let counter = T * 60;
            mesh.DT.code.update = () => {
                mesh.rotation.z += dTheta;
                theta = mesh.rotation.z;
                counter--;
                if (counter <= 0) {
                    mesh.rotation.z = t2;
                    mesh.DT.code.update = '';
                }
            };
        });
        //global.emit("Denso1",{ID1: 1860})
        global.on("Denso1", (data: any) => {//Denso机器人进入待机状态1
            const ID1 = data.ID1;
            const ID2 = ID1 - 1;
            const ID3 = ID1 - 2;
            const ID5 = ID1 - 4;
            global.emit("Daerotate", { mesh: global.SCENE.getObjectById(ID1), angle: -280, axis: 'y' })
            global.emit("Daerotate", { mesh: global.SCENE.getObjectById(ID2), angle: 20, axis: 'y' })
            global.emit("Daerotate", { mesh: global.SCENE.getObjectById(ID3), angle: 70, axis: 'x' })
            global.emit("Daerotate", { mesh: global.SCENE.getObjectById(ID5), angle: 30, axis: 'x' })
        })
        global.on("DensoPickPlate", (data: any) => {//Denso机器人从传送带抓取至缓冲区
            const ID1 = data.ID1;
            const ID2 = ID1 - 1;
            const ID3 = ID1 - 2;
            global.emit("Daerotate", { mesh: global.SCENE.getObjectById(ID1), angle: 80, axis: 'y', T: 2.2 })
            global.emit("Daerotate", { mesh: global.SCENE.getObjectById(ID2), angle: -10, axis: 'y', T: 2.2 })
            global.emit("Daerotate", { mesh: global.SCENE.getObjectById(ID3), angle: -20, axis: 'x', T: 2.2 })
            setTimeout(() => {
                global.emit("Daerotate", { mesh: global.SCENE.getObjectById(ID2), angle: -30, axis: 'y' ,T:1})
                global.emit("Daerotate", { mesh: global.SCENE.getObjectById(ID3), angle: -10, axis: 'x' ,T:1})
            }, 2200);
            setTimeout(() => {
                global.emit("Daerotate", { mesh: global.SCENE.getObjectById(ID2), angle: 30, axis: 'y' })
                global.emit("Daerotate", { mesh: global.SCENE.getObjectById(ID3), angle: 10, axis: 'x' })
            }, 5700);
            setTimeout(() => {
                global.emit("Daerotate", { mesh: global.SCENE.getObjectById(ID2), angle: 10, axis: 'y' })
                global.emit("Daerotate", { mesh: global.SCENE.getObjectById(ID3), angle: 20, axis: 'x' })
            }, 6700);
            setTimeout(() => {
                global.emit("Daerotate", { mesh: global.SCENE.getObjectById(ID1), angle: 40, axis: 'y', T: 2.2 })
            }, 7700);
            setTimeout(() => {
                global.emit("Daerotate", { mesh: global.SCENE.getObjectById(ID2), angle: -10, axis: 'y' })
            }, 9900);
            setTimeout(() => {
                global.emit("Daerotate", { mesh: global.SCENE.getObjectById(ID2), angle: 10, axis: 'y' })
            }, 13400);
            setTimeout(() => {
                global.emit("Daerotate", { mesh: global.SCENE.getObjectById(ID1), angle: -120, axis: 'y', T: 2 })
            }, 14400);
        })
        global.on("DensoPutPlate", (data: any) => {//Denso机器人从缓冲区放置至传送带
            const ID1 = data.ID1;
            const ID2 = ID1 - 1;
            const ID3 = ID1 - 2;
            global.emit("Daerotate", { mesh: global.SCENE.getObjectById(ID1), angle: 120, axis: 'y', T: 2 })
            setTimeout(() => {
                global.emit("Daerotate", { mesh: global.SCENE.getObjectById(ID2), angle: -10, axis: 'y' })
            }, 2000);
            setTimeout(() => {
                global.emit("Daerotate", { mesh: global.SCENE.getObjectById(ID2), angle: 10, axis: 'y' })
            }, 5500);
            setTimeout(() => {
                global.emit("Daerotate", { mesh: global.SCENE.getObjectById(ID1), angle: -40, axis: 'y', T: 2.2 })
            }, 6700);
            setTimeout(() => {
                global.emit("Daerotate", { mesh: global.SCENE.getObjectById(ID2), angle: -10, axis: 'y' })
                global.emit("Daerotate", { mesh: global.SCENE.getObjectById(ID3), angle: -20, axis: 'x' })
            }, 8700);
            setTimeout(() => {
                global.emit("Daerotate", { mesh: global.SCENE.getObjectById(ID2), angle: -30, axis: 'y' })
                global.emit("Daerotate", { mesh: global.SCENE.getObjectById(ID3), angle: -10, axis: 'x' })
            }, 9700);
            setTimeout(() => {
                global.emit("Daerotate", { mesh: global.SCENE.getObjectById(ID2), angle: 30, axis: 'y' })
                global.emit("Daerotate", { mesh: global.SCENE.getObjectById(ID3), angle: 10, axis: 'x' })
            }, 13200);
            setTimeout(() => {
                global.emit("Daerotate", { mesh: global.SCENE.getObjectById(ID1), angle: -80, axis: 'y', T: 2 })
                global.emit("Daerotate", { mesh: global.SCENE.getObjectById(ID2), angle: 10, axis: 'y', T: 2 })
                global.emit("Daerotate", { mesh: global.SCENE.getObjectById(ID3), angle: 20, axis: 'x', T: 2 })
            }, 14200);
        })
        global.on("DensoPutCNC", (data: any) => {//六轴机器人待机至抓取缓冲，至放置进CNC，至待机
            const ID1 = data.ID1;
            const ID2 = ID1 - 1;
            const ID3 = ID1 - 2;
            const ID5 = ID1 - 4;
            global.emit("Daerotate", { mesh: global.SCENE.getObjectById(ID1), angle: 120, axis: 'y', T: 2 })
            setTimeout(() => {
                global.emit("Daerotate", { mesh: global.SCENE.getObjectById(ID2), angle: -10, axis: 'y', T: 2 })
            }, 2000);
            setTimeout(() => {
                global.emit("Daerotate", { mesh: global.SCENE.getObjectById(ID2), angle: 10, axis: 'y', T: 2 })
            }, 4000);
            setTimeout(() => {
                global.emit("Daerotate", { mesh: global.SCENE.getObjectById(ID1), angle: -120, axis: 'y', T: 2 })
            }, 6000);
            setTimeout(() => {
                global.emit("Daerotate", { mesh: global.SCENE.getObjectById(ID2), angle: -50, axis: 'y', T: 2 })
                global.emit("Daerotate", { mesh: global.SCENE.getObjectById(ID3), angle: -95, axis: 'x', T: 2 })
                global.emit("Daerotate", { mesh: global.SCENE.getObjectById(ID5), angle: -20, axis: 'x', T: 2 })
            }, 8000);
            setTimeout(() => {
                global.emit("Daerotate", { mesh: global.SCENE.getObjectById(ID2), angle: -5, axis: 'y' ,T:1})
            }, 10000);
            setTimeout(() => {
                global.emit("Daerotate", { mesh: global.SCENE.getObjectById(ID2), angle: 5, axis: 'y' ,T:1})
            }, 12000);
            setTimeout(() => {
                global.emit("Daerotate", { mesh: global.SCENE.getObjectById(ID2), angle: 50, axis: 'y', T: 2 })
                global.emit("Daerotate", { mesh: global.SCENE.getObjectById(ID3), angle: 95, axis: 'x', T: 2 })
                global.emit("Daerotate", { mesh: global.SCENE.getObjectById(ID5), angle: 20, axis: 'x', T: 2 })
            }, 13000);
        })
        global.on("DensoPickCNC", (data: any) => {//六轴机器人待机至抓取CNC，至放置进缓冲区，至待机
            const ID1 = data.ID1;
            const ID2 = ID1 - 1;
            const ID3 = ID1 - 2;
            const ID5 = ID1 - 4;
            global.emit("Daerotate", { mesh: global.SCENE.getObjectById(ID2), angle: -50, axis: 'y',T:2 })
            global.emit("Daerotate", { mesh: global.SCENE.getObjectById(ID3), angle: -95, axis: 'x' ,T:2})
            global.emit("Daerotate", { mesh: global.SCENE.getObjectById(ID5), angle: -20, axis: 'x' ,T:2})
            setTimeout(() => {
                global.emit("Daerotate", { mesh: global.SCENE.getObjectById(ID2), angle: -5, axis: 'y' ,T:1})
            }, 2000);
            setTimeout(() => {
                global.emit("Daerotate", { mesh: global.SCENE.getObjectById(ID2), angle: 5, axis: 'y' ,T:1})
            }, 4500);
            setTimeout(() => {
                global.emit("Daerotate", { mesh: global.SCENE.getObjectById(ID2), angle: 50, axis: 'y', T: 2 })
                global.emit("Daerotate", { mesh: global.SCENE.getObjectById(ID3), angle: 95, axis: 'x', T: 2 })
                global.emit("Daerotate", { mesh: global.SCENE.getObjectById(ID5), angle: 20, axis: 'x', T: 2 })
            }, 5500);
            setTimeout(() => {
                global.emit("Daerotate", { mesh: global.SCENE.getObjectById(ID1), angle: 120, axis: 'y', T: 2 })
            }, 7500);
            setTimeout(() => {
                global.emit("Daerotate", { mesh: global.SCENE.getObjectById(ID2), angle: -10, axis: 'y' ,T:2})
            }, 9500);
            setTimeout(() => {
                global.emit("Daerotate", { mesh: global.SCENE.getObjectById(ID2), angle: 10, axis: 'y' ,T:2})
            }, 11500);
            setTimeout(() => {
                global.emit("Daerotate", { mesh: global.SCENE.getObjectById(ID1), angle: -120, axis: 'y', T: 2 })
            }, 13500);
        })
        //global.emit("4robot",{ID1: 1661,ID2: 1660})
        global.on("4robot", (data: any) => { //四轴机器人进入待机状态
            const ID1 = data.ID1;
            const ID2 = data.ID2;
            global.emit("Daerotate", { mesh: global.SCENE.getObjectById(ID1), angle: -30, axis: 'z' })
            global.emit("Daerotate", { mesh: global.SCENE.getObjectById(ID2), angle: -80, axis: 'z' })
        })
        //global.emit("4robot1",{ID1: 1661,ID2: 1660})
        global.on("4robot1", (data: any) => { //四轴机器人上料动画
            const ID1 = data.ID1;
            const ID2 = data.ID2;
            global.emit("Daerotate", { mesh: global.SCENE.getObjectById(ID1), angle: -60, axis: 'z', T: 3 })
            setTimeout(() => {
                global.emit("Daetranslate", { mesh: global.SCENE.getObjectById(ID2), distance: -5, axis: 'z' })
            }, 3000);
            setTimeout(() => {
                global.emit("Daetranslate", { mesh: global.SCENE.getObjectById(ID2), distance: 5, axis: 'z' })
            }, 4000);
            setTimeout(() => {
                global.emit("Daerotate", { mesh: global.SCENE.getObjectById(ID1), angle: 105, axis: 'z', T: 5 })
            }, 5000);
            setTimeout(() => {
                global.emit("Daetranslate", { mesh: global.SCENE.getObjectById(ID2), distance: -5, axis: 'z' })
            }, 10000);
            setTimeout(() => {
                global.emit("Daetranslate", { mesh: global.SCENE.getObjectById(ID2), distance: 5, axis: 'z' })
            }, 11000);
            setTimeout(() => {
                global.emit("Daerotate", { mesh: global.SCENE.getObjectById(ID1), angle: -45, axis: 'z', T: 3 })
            }, 12000);
        })
        //global.emit("4robot2",{ID1: 1757})
        global.on("4robot2", (data: any) => { //四轴机器人木块装盒动画
            const ID1 = data.ID1;
            const ID2 = ID1 - 1;
            const ID3 = ID1 - 3;
            global.emit("Daerotate", { mesh: global.SCENE.getObjectById(ID1), angle: -20, axis: 'z' })
            global.emit("Daerotate", { mesh: global.SCENE.getObjectById(ID2), angle: 40, axis: 'z' })
            setTimeout(() => {
                global.emit("Daetranslate", { mesh: global.SCENE.getObjectById(ID3), distance: -2, axis: 'z' })
            }, 1000);
            setTimeout(() => {
                global.emit("Daetranslate", { mesh: global.SCENE.getObjectById(ID3), distance: 2, axis: 'z' })
            }, 2000);
            setTimeout(() => {
                global.emit("Daerotate", { mesh: global.SCENE.getObjectById(ID1), angle: 10, axis: 'z' })
            }, 3000);
            setTimeout(() => {
                global.emit("Daetranslate", { mesh: global.SCENE.getObjectById(ID3), distance: -2, axis: 'z' })
            }, 4000);
            setTimeout(() => {
                global.emit("Daetranslate", { mesh: global.SCENE.getObjectById(ID3), distance: 2, axis: 'z' })
            }, 5000);
            setTimeout(() => {
                global.emit("Daerotate", { mesh: global.SCENE.getObjectById(ID1), angle: 10, axis: 'z' })
                global.emit("Daerotate", { mesh: global.SCENE.getObjectById(ID2), angle: -40, axis: 'z' })
            }, 6000);
        })
        //global.emit("CNC1",{ID1: 2092})
        global.on("CNC1", (data: any) => {
            const ID1 = data.ID1;
            const ID2 = ID1 - 1;
            global.emit("Daetranslate", { mesh: global.SCENE.getObjectById(ID1), distance: 0.17, axis: 'x' })
            global.emit("Daetranslate", { mesh: global.SCENE.getObjectById(ID2), distance: 0.15, axis: 'y' })
            for (let i = 1; i < 11; i++) {
                setTimeout(() => {
                    global.emit("Daetranslate", { mesh: global.SCENE.getObjectById(ID1), distance: 0.05, axis: 'x', T: 0.5 })
                }, i * 1000);
                setTimeout(() => {
                    global.emit("Daetranslate", { mesh: global.SCENE.getObjectById(ID1), distance: -0.05, axis: 'x', T: 0.5 })
                }, i * 1000 + 500);
            }
            setTimeout(() => {
                global.emit("Daetranslate", { mesh: global.SCENE.getObjectById(ID2), distance: -0.15, axis: 'y' })
                global.emit("Daetranslate", { mesh: global.SCENE.getObjectById(ID1), distance: -0.17, axis: 'x' })
            }, 11000);
        })
        //global.emit("install",{ID1: 2158})  上盖机
        global.on("install", (data: any) => {
            const ID1 = data.ID1;
            const ID2 = ID1 - 2;
            global.emit("Daetranslate", { mesh: global.SCENE.getObjectById(ID1), distance: -0.305, axis: 'x' })
            setTimeout(() => {
                global.emit("Daetranslate", { mesh: global.SCENE.getObjectById(ID2), distance: -0.05, axis: 'y', T: 0.5 })
            }, 1000);
            setTimeout(() => {
                global.emit("Daetranslate", { mesh: global.SCENE.getObjectById(ID2), distance: 0.05, axis: 'y', T: 0.5 })
            }, 1500);
            setTimeout(() => {
                global.emit("Daetranslate", { mesh: global.SCENE.getObjectById(ID1), distance: 0.305, axis: 'x' })
            }, 2000);
            setTimeout(() => {
                global.emit("Daetranslate", { mesh: global.SCENE.getObjectById(ID2), distance: -0.05, axis: 'y', T: 0.5 })
            }, 3000);
            setTimeout(() => {
                global.emit("Daetranslate", { mesh: global.SCENE.getObjectById(ID2), distance: 0.05, axis: 'y', T: 0.5 })
            }, 3500);
        })
        //global.emit("RBJ",{ID1: 2309})  下盒机
        global.on("RBJ", (data: any) => {
            const ID1 = data.ID1;
            const ID2 = ID1 - 1;
            global.emit("Daetranslate", { mesh: global.SCENE.getObjectById(ID1), distance: 0.27, axis: 'z' })
            setTimeout(() => {
                global.emit("Daetranslate", { mesh: global.SCENE.getObjectById(ID2), distance: -0.1, axis: 'y', T: 0.5 })
            }, 1000);
            setTimeout(() => {
                global.emit("Daetranslate", { mesh: global.SCENE.getObjectById(ID2), distance: 0.1, axis: 'y', T: 0.5 })
            }, 1500);
            setTimeout(() => {
                global.emit("Daetranslate", { mesh: global.SCENE.getObjectById(ID1), distance: -0.27, axis: 'z' })
            }, 2000);
        })
        // global.emit("Daerotate", {mesh: global.SCENE.getObjectById(493), angle: 45,axis: 'z'})
        global.on("Daerotate", (data: any) => {
            const T = data.T ?? 1;           // 持续时间（秒）
            const mesh = data.mesh;          // 目标物体
            const angle = data.angle;        // 旋转角度（角度制）
            const axis = data.axis ?? 'z';   // 旋转轴参数（x/y/z，默认为z轴）
            if (!['x', 'y', 'z'].includes(axis)) {            // 有效性校验
                console.error('Invalid rotation axis, use x/y/z');
                return;
            }
            const parent = mesh.parent;            // 准备初始参数（动态访问旋转属性）
            let t1 = parent.rotation[axis] % (2 * PI);
            let t2 = (t1 + THREE.MathUtils.degToRad(angle) + 2 * PI) % (2 * PI);
            let theta = t1;
            if (angle > 0) {  // 正向旋转角度修正            
                if (theta > t2) theta -= 2 * PI;
            } else {          // 逆向旋转修正
                if (theta < t2) theta += 2 * PI;
            }
            const dTheta = (t2 - theta) / (T * 60);            // 计算步长（保持原有帧数逻辑）
            let counter = T * 60;
            mesh.DT.code.update = () => {            // 更新旋转逻辑（动态属性访问）
                parent.rotation[axis] += dTheta;
                theta = parent.rotation[axis];
                parent.rotation.order = 'XYZ';
                parent.updateMatrixWorld(true);
                if (--counter <= 0) {                // 终止条件
                    parent.rotation[axis] = t2;
                    parent.updateMatrixWorld(true);
                    mesh.DT.code.update = null; // 清除更新回调
                }
            };
        });
        // global.emit("Daetranslate", {mesh: global.SCENE.getObjectById(403), distance: 20,axis: 'z'})
        global.on("Daetranslate", (data: any) => {
            const T = data.T ?? 1;           // 持续时间（秒）
            const mesh = data.mesh;          // 目标物体
            const distance = data.distance;  // 移动距离（单位：Three.js场景单位）
            const axis = data.axis ?? 'z';   // 移动轴（x/y/z，默认为z轴）
            if (!['x', 'y', 'z'].includes(axis)) {            // 有效性校验
                console.error('Invalid movement axis, use x/y/z');
                return;
            }
            const parent = mesh.parent;
            const start = parent.position[axis];         // 记录起始位置
            const target = start + distance;             // 计算目标位置
            const dPos = (target - start) / (T * 60);    // 计算每帧移动量
            let counter = T * 60;
            mesh.DT.code.update = () => {                // 更新位置逻辑
                parent.position[axis] += dPos;
                parent.updateMatrixWorld(true);
                if (--counter <= 0) {                    // 终止条件
                    parent.position[axis] = target;      // 确保精确到达目标位置
                    parent.updateMatrixWorld(true);
                    mesh.DT.code.update = null;          // 清除更新回调
                }
            };
        });
        //global.emit("rotateJoint", {id: 220, joint: "J1", angle: 45});
        global.on("rotateJoint", (data: { id: number, joint: string, angle: number }) => {
            const targetMesh = global.SCENE.getObjectById(data.id);
            if (!targetMesh?.DT) return;
            targetMesh.DT.updateJoint(
                data.joint,
                data.angle,
                1000 // 默认1秒完成旋转
            );
        })
        // 更新物体位置
        global.on("updateMeshPosition", (data: any) => {
            if (emulateMode != "play") return;  // 暂停时不更新
            data.mesh.position.copy(data.position);
            data.mesh.updateMatrixWorld(true);
            data.mesh.updateRigidbodyTransform();
        });

        // 更新托盘位置
        global.on("updateTrayPosition", (data: { deviceID, RFID }) => {
            if (emulateMode != "play") return;  // 暂停时不更新
            if (data.RFID == "\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00")
                data.RFID = "822fbee2-1fe0-45c8-b403-8b5cdb31cb25";
            let sensorDT = global.physicalIDMap[data.deviceID];
            let trayDT = global.physicalIDMap[data.RFID];
            if (!sensorDT || !trayDT) return;  // 若传感器或托盘不存在，则不执行后续操作
            if (trayDT && !trayDT.sensorPass) {  // 修改托盘的碰撞掩码，使之可通过光电门
                // 若同步位置时实物比在制品先到光电门
                if (!trayDT.touchSensor || trayDT.touchSensor != sensorDT) {
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
                    trayDT.mesh.rotation.set(PI / 2, 0, 0);
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
            else if (trayDT.sensorPass) {
                console.log("光电门冷却中");
            }
            else {
                console.log("光电门不存在");
            }
        })
        global.on("updateDeviceValue", (data: { nodeID, value }) => {
            let fourRobot1 = 0;
            let sixRobot1 = 0;
            if (data.nodeID == "24461a2c-b0cf-4f4e-8bda-a3b523ef3c5b/AAS/Capability_UploadMaterial/Input/InputCmd:value@Value") {//四轴机器人抓取木块上料
                if (data.value == 1 && fourRobot1 == 0) {
                    global.emit("4robot", { ID1: 1661, ID2: 1660 })
                    fourRobot1 = 1;
                }
                if (data.value == 2 && fourRobot1 == 1) {
                    global.emit("4robot1", { ID1: 1661, ID2: 1659 })
                    fourRobot1 = 1;
                }
            }
            if (data.nodeID == "xxx" && data.value == 1) { //CNC加工动画
                global.emit("CNC1", { ID1: 2092 })
            }
            if (data.nodeID == "xxx" && data.value == 1) { //上盖机动画
                global.emit("install", { ID1: 2158 })
            }
            if (data.nodeID == "xxx" && data.value == 1) { //下盒机动画
                global.emit("RBJ", { ID1: 2309 })
            }
            if (data.nodeID == "xxx" && data.value == 1) { //四轴机器人抓取物料进盒动画
                global.emit("4robot2", { ID1: 1757 })
            }
            if (data.nodeID == "ac8496d6-c7ee-4512-8e0f-e0ee2ccf0a82") { //六轴机器人抓取木块进cnc加工
                if (data.value == "PutCNC1") {
                    global.emit("DensoPutCNC", { ID1: 1860 })
                    sixRobot1 = 1;
                }
                if (data.value == "PutCNC1") {
                    global.emit("DensoPutCNC", { ID1: 1860 })
                    sixRobot1 = 2;
                }
                if (data.value == "PickCNC1") {
                    global.emit("DensoPickCNC", { ID1: 1860 })
                    sixRobot1 = 3;
                }
                if (data.value == "PickCNC2") {
                    global.emit("DensoPickCNC", { ID1: 1860 })
                    sixRobot1 = 4;
                }
                if (data.value == 4 && sixRobot1 == 4) {
                    global.emit("6robot5", { ID1: 1860 })
                    sixRobot1 = 1;
                    console.log("设备6robot位姿为", sixRobot1)
                }
            }
        })
        global.on("loadScene", jsonPath => { this.loadScene(jsonPath) });

        // 控制器快捷键设置
        this.canvas.addEventListener("keydown", e => {
            if (global.mode == "edit") {  // 在编辑模式下
                // 光电门1：a5197017-c560-4713-aacd-01f097dda18f
                // 光电门3：75292a01-6d17-4d50-bb75-d42718f75fe8
                // 光电门5：7f698a28-d9d4-456a-9814-19d6c9b2f1a1
                // 调试发送虚拟光电门信号
                if(e.code == "Digit1") global.emit("updateTrayPosition", {deviceID: "a5197017-c560-4713-aacd-01f097dda18f", RFID: "822fbee2-1fe0-45c8-b403-8b5cdb31cb25"});
                if(e.code == "Digit3") global.emit("updateTrayPosition", {deviceID: "75292a01-6d17-4d50-bb75-d42718f75fe8", RFID: "822fbee2-1fe0-45c8-b403-8b5cdb31cb25"});
                if(e.code == "Digit5") global.emit("updateTrayPosition", {deviceID: "7f698a28-d9d4-456a-9814-19d6c9b2f1a1", RFID: "822fbee2-1fe0-45c8-b403-8b5cdb31cb25"}); 
                if(e.code == "KeyQ") this.controller.setMode("translate");  // 按Q平移
                if(e.code == "KeyW") this.controller.setMode("rotate");  // 按W旋转
                if(e.code == "KeyE") {  // 按R切换全局坐标系和局部坐标系
                    if(this.controller.space == "world") this.controller.setSpace("local");
                    else this.controller.setSpace("world");this.updateRigidBodies();
                }
                if(e.code == "KeyA") {  // 按A拉伸直道传送带
                    let target = this.controller.object;
                    if (target.DT.basename.includes("直道") || target.DT.basename == "直护栏") {
                        this.controller.setMode("scale");
                    }
                    if(attached.DT.basename == "平行传送装置-直道"){
                        if(this.controller.mode == "scale"){
                            this.controller.showX = true;
                            this.controller.showY = false;
                            this.controller.showZ = false;
                        }
                    }
                    if(attached.DT.basename == "直护栏"){
                        if(this.controller.mode == "scale"){
                            this.controller.showX = false;
                            this.controller.showY = true;
                            this.controller.showZ = false;
                        }
                    }
                }
                else {
                    this.controller.showX = true;
                    this.controller.showY = true;
                    this.controller.showZ = true;
                }
                if(e.code == "Escape") this.controller.reset();  // 按ESC恢复
                if(e.ctrlKey) {  // 按Ctrl将移动间距离散化
                    if(e.code == "KeyZ") this.controller.reset();  // 按Ctrl+Z恢复
                    this.controller.setTranslationSnap( 1 );
                    this.controller.setRotationSnap( THREE.MathUtils.degToRad( 15 ) );
                    this.controller.setScaleSnap( 0.25 );
                }
            }
            if (global.mode == "view") {  // 在浏览模式下
                const step = 5;  // 相机前进步长
                this.cameraMovable.copy(this.camera);
                this.cameraMovable.userData = {};
                if (e.code == "KeyW") {  // 按W前进，但借助camera0来求相机的新位置和角度
                    this.pointerControl.moveForward(step);
                }
                if (e.code == "KeyS") {  // 按S后退
                    this.pointerControl.moveForward(-step);
                }
                if (e.code == "KeyA") {  // 按A左移
                    this.pointerControl.moveRight(-step);
                }
                if (e.code == "KeyD") {  // 按D右移
                    this.pointerControl.moveRight(step);
                }
                let p0 = this.cameraMovable.position.clone();
                this.camera.position.copy(p0);
                this.cameraMovable.getWorldDirection(front);
                new THREE.Ray(p0, front).intersectPlane(Ground, this.orbitControl.target);
            }
        })
        global.on("init", () => this.init());
        // this.initDeviceListeners();
    }
    private handleDenso(state: string) {

    }
    async init() {  // 场景更新时的操作
        // 天空
        global.SCENE.DT.setSkyboxByColor();
        global.on("updateSkybox", () => { global.SCENE.DT.setSkyboxByColor() });
        // 远处雾化
        global.SCENE.fog = new THREE.Fog(this.ground.material.color, 5, 600);
        global.on("changeFogColor", (isGround) => {  // 更改地面颜色时同时更改雾的颜色
            if (isGround) global.SCENE.fog.color.copy(this.ground.material.color);
        });
        global.SCENE.DT.updatePhysicalIDMap();
        emulateMode = "stop";
        loading = false;


        if (!animate) {
            animate = () => {
                requestAnimationFrame(animate);
                if (moveToId > 0) {  // 开始移动相机到双击的物体
                    global.emit("controlStart", moveToId);  // 防止相机移动时控制器消失
                    targetObject = global.SCENE.getObjectById(moveToId);
                    p_start = this.camera.position.clone();  // 起点
                    let center = targetObject.position.clone();  // 中心点
                    var d = 10;  // 默认距离
                    var r;  // 包围球半径

                    if (targetObject.isGroup) {  // 拉近至群组时将目标设为其包围盒中心
                        let wireframe = targetObject.DT.layers.wireframe[0];
                        let boundingSphere = wireframe.geometry.boundingSphere;
                        center = boundingSphere.center;
                        r = boundingSphere.radius;
                    }
                    else {
                        // 求物体包围盒中心
                        targetObject.getWorldPosition(center);
                        let centerDelta = center.clone();
                        this.controller.getWorldPosition(centerDelta);
                        center.add(centerDelta);
                        r = targetObject.DT.geometry?.boundingSphere.radius;
                    }

                    // 求相机到物体的距离d与d*相机朝向
                    if (!r || targetObject.DT.label == "protected") r = minCameraFocusDistance;
                    d = r * targetObject.DT.scale * 2.5;  // 距离 = 包围球半径 * 物体缩放 * 2.5
                    d = Math.max(d, minCameraFocusDistance);  // 让相机不能离物体太近
                    this.camera.getWorldDirection(front);
                    let delta = front.clone();
                    delta.multiplyScalar(d);
                    // 终点 = 物体包围球中心 - d*相机朝向
                    p_end = center.sub(delta);
                    moveToId = -1;
                }
                else if (moveToId < 0) {  // 移动中
                    frameCounter++;
                    this.cameraMovable.position.lerpVectors(p_start, p_end, frameCounter / 60);
                    this.camera.position.copy(this.cameraMovable.position);
                    cameraFrontRay.set(this.cameraMovable.position, front);
                    cameraFrontRay.intersectPlane(Ground, this.orbitControl.target);
                    if (frameCounter >= 60) {  // 移动结束
                        this.orbitControl.enableRotate = true;
                        frameCounter = moveToId = 0;
                    }
                }
                this.render();
            };
            animate();
        }
    }

    createArrow(x, y, theta) {  // 指示箭头(横坐标，纵坐标，旋转角)
        let theta0 = theta * PI / 180;
        let theta1 = (theta + 90) * PI / 180;
        let theta2 = (theta - 90) * PI / 180;
        const triangle = new THREE.Shape();
        triangle.moveTo(x + 2 * Math.cos(theta0), y + 2 * Math.sin(theta0));
        triangle.lineTo(x + 0.5 * Math.cos(theta1), y + 0.5 * Math.sin(theta1));
        triangle.lineTo(x + 0.5 * Math.cos(theta2), y + 0.5 * Math.sin(theta2));
        const geom = new THREE.ShapeGeometry(triangle);
        const material = new THREE.MeshBasicMaterial({ color: "white" });
        return new THREE.Mesh(geom, material);
    }
    createAttachPoint1(x, y) {  // 传送带入口连接点(横坐标，纵坐标)
        const geom = new THREE.BoxGeometry(0.5, 0.5, 0.5);
        const material = new THREE.MeshBasicMaterial({ color: "red" });
        const point = new THREE.Mesh(geom, material);
        point.position.x = x;
        point.position.y = y
        point.name = "ap1";
        point.visible = false;
        return point;
    }
    createAttachPoint2(x, y) {  // 传送带出口连接点(横坐标，纵坐标)
        const geom = new THREE.BoxGeometry(0.5, 0.5, 0.5);
        const material = new THREE.MeshBasicMaterial({ color: "lime" });
        const point = new THREE.Mesh(geom, material);
        point.position.x = x;
        point.position.y = y
        point.name = "ap2";
        point.visible = false;
        return point;
    }
    createCircle(x, y, r, color = "white") {  // 圆形(横坐标，纵坐标，半径)
        const circle = new THREE.Shape();
        circle.absarc(x, y, r, 0, 2 * PI);
        const geom = new THREE.ShapeGeometry(circle);
        const material = new THREE.MeshBasicMaterial({ color: color });
        return new THREE.Mesh(geom, material);
    }
    createLabel(mesh) {  // 创建名牌
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
    createLight(type, x = 0, y = 0, z = 24) {  // 创建光源
        let arrow, light, lightDOM = document.createElement("img");
        // 光源物体
        const iconMesh = new CSS2DObject(lightDOM);
        iconMesh.userData.dom = lightDOM;
        if (type == "DirectionalLight") {  // 平行光
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
            light.attach(arrow);
            // 设置平行光朝向，并使平行光旋转时，光照方向也一并旋转
            light.target = new THREE.Object3D();
            global.SCENE.add(light.target);
            let target = light.userData.target = light.target.clone();
            light.attach(target);
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
        if (type == "AmbientLight") {  // 环境光
            light = new THREE.AmbientLight("white");
            light.intensity = 0.5;
            lightDOM.src = sun;  // 环境光图标
        }
        // 光源图标
        lightDOM.id = light.id;
        lightDOM.style.width = "30px";
        // 光源物体
        global.SCENE.add(light);
        light.position.set(x, y, z);
        light.rotation.set(PI / 2, PI / 4, PI / 4);
        iconMesh.center.set(0.5, 0.5);  // 图标居中
        iconMesh.position.set(0, 0, 0);  // 图标的三维相对位置
        light.add(iconMesh);
        // 光源DT
        let lightDT = new DTObject(light, true)
        lightDT.icon = lightDOM;
        if (arrow) lightDT.layers.lightArrow = [arrow];
        lightDT.setTitle();
        return light;
    }
    createMeshFromAssets(DT, position, rotation) {  // 定义从组件库中拖入的组件的物体属性
        let mesh0 = DT.mesh.clone();
        mesh0.traverse(mesh => {
            if (mesh.isGroup || mesh.isMesh) {
                mesh.castShadow = mesh.receiveShadow = true;
                if (mesh.isMesh) {
                    if (Array.isArray(mesh.material)) {  // 导入模型存在多个material的情况
                        const materials = [];
                        for (const material of mesh.material) {
                            const tmpMaterial = new THREE.MeshPhongMaterial();
                            tmpMaterial.color.copy(material.color);
                            materials.push(tmpMaterial);
                        }
                        mesh.material = materials;
                    } else {
                        const tmpMaterial = new THREE.MeshPhongMaterial();
                        tmpMaterial.color.copy(mesh.material.color);
                        mesh.material = tmpMaterial;
                    }
                } else mesh.material = new THREE.MeshPhongMaterial;
                let DT0 = new DTObject(mesh, true);
                if (mesh.parent) mesh.parent.DT.children.push(DT0);
            }
        });
        let DT0 = mesh0.DT;
        DT0.basename = DT0.name = DT.name;
        DT0.custom = JSON.parse(JSON.stringify(DT.custom));
        DT0.scale = DT.scale;
        DT0.setTitle();
        DT0.updateWireframes();
        DT0.traverse(DT => {
            // 递归地给所有从外部导入组件库并从组件库拖入场景的模型加上标签
            DT.label = "importedModel";
            if (DT.mesh.isMesh) {  // 递归地给导入模型加上与包围盒相同的刚体形状
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
        mesh0.position.copy(position);
        if (rotation) mesh0.rotation.copy(rotation);
        global.SCENE.add(mesh0);
        return mesh0;
    }
    createMeshFromModels(
        data,
        position: THREE.Vector3,
        rotation: THREE.Euler = null,
        DToptions = {}
    ) {  // 定义拖入的物体属性
        let mesh = new THREE.Mesh();
        let DT = new DTObject(mesh);
        let obj = JSON.parse(JSON.stringify(model_definition[data.title]));
        let path = obj.modelPath;
        if (obj.label == "robot") {
            let groupDT = new DTObject(new THREE.Group());
            for (let key in obj) groupDT[key] = obj[key];
            groupDT.children.push(DT);
            groupDT.mesh.add(mesh);
            return this.createMeshFromAssets(groupDT, position, rotation);
        };
        if (path) DT.geometry = global.loadedModels[data.title];
        // 先复制JSON中的模型定义再使用，以免相应的模型定义在使用时被自动修改
        for (let key in obj) DT[key] = obj[key];
        if (DT.geometry instanceof Array) {  // 如果模型的json定义为写成多行的回调函数，则合并为一行并调用
            DT.geometry = eval(DT.geometry.join(''))();
        }
        else if (typeof DT.geometry == "string") DT.geometry = eval(DT.geometry);
        DT.basename = DT.name = data.title;
        mesh.geometry = DT.geometry;
        mesh.material = new THREE.MeshPhongMaterial(DT.material);
        DT.rigidFollow = !DT.mass;
        DT.setTitle();
        DT.updateWireframes();

        if (DT.label == "conveyor") {
            attachObjects.add(mesh);
            // localStorage.setItem('attachObjects', JSON.stringify(attachObjects));
        }

        for (let layer in DT.layers) {  // 解析图层
            let result = DT.layers[layer];
            if (typeof result == "string") DT.layers[layer] = eval(result);
        }
        if (DT.layers.indicator) for (let item of DT.layers.indicator) {  // 指示箭头
            item.scale.setScalar(1 / DT.scale);
            item.userData.indicator = true;
            item.visible = global.layers.includes("indicator");
            mesh.add(item);
            if (DT.label == "guardrail") item.position.z += 1 / DT.scale;
            item.position.z += 0.01 / DT.scale;  // 将箭头稍微上调，以免和物体重叠
        }
        if (DT.layers.attachPoint1) for (let item of DT.layers.attachPoint1) {  // 传送带入口连接点
            item.scale.setScalar(1 / DT.scale);
            mesh.add(item);
        }
        if (DT.layers.attachPoint2) for (let item of DT.layers.attachPoint2) {  // 传送带出口连接点
            item.scale.setScalar(1 / DT.scale);
            mesh.add(item);
        }
        mesh.castShadow = mesh.receiveShadow = true;
        for (let option of Object.keys(DToptions)) {
            DT[option] = DToptions[option];
        }
        this.createLabel(mesh);

        global.SCENE.add(mesh);
        if (position) mesh.position.copy(position);
        if (rotation) mesh.rotation.copy(rotation);
        if (DT.scale != 1) mesh.scale.setScalar(DT.scale);
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
    loadScene(jsonPath) {  // 加载场景
        // 清除场景中原有的模型，地面、灯光等除外
        global.SCENE.DT.traverse(DT => {
            if (DT.label != "protected" && !DT.mesh.isLight) DT.destroy();
        });
        // 如果有较大的模型则全部加载并弹窗展示加载进度
        let scene = JSON.parse(fs.readFileSync(jsonPath).toString());
        let mesh, loadingModel = {}, loadingProgress = {}, loadedModels = 0, loadedTotal = 0;
        const createItem = ({ title, position, rotation, length = null, prop = null }) => {  // 创建直护栏
            if (model_definition[title].label == "robot") {
                let mesh = this.createMeshFromAssets(
                    global.loadedModels[title],
                    new THREE.Vector3(position.x, position.y, position.z),
                    new THREE.Euler(rotation.x * PI / 180, rotation.y * PI / 180, rotation.z * PI / 180)
                );
                if (prop && prop.scale) {  // 若场景文件中有定义比例则采用，否则使用模型定义里的默认比例
                    mesh.scale.setScalar(prop.scale);
                    mesh.DT.scale = prop.scale;
                }
                return;
            }
            else {
                mesh = this.createMeshFromModels({ title: title },
                    new THREE.Vector3(position.x, position.y, position.z),
                    new THREE.Euler(rotation.x * PI / 180, rotation.y * PI / 180, rotation.z * PI / 180),
                );
                if (prop?.scale) {  // 若场景文件中有定义比例则采用，否则使用模型定义里的默认比例
                    mesh.scale.setScalar(prop.scale);
                    mesh.DT.scale = prop.scale;
                }
                if (title.includes("直道") && length) {
                    mesh.scale.x = length / 7.5 * mesh.DT.scale;
                    mesh.DT.updateConveyorRigidbody();
                }
                else if (title == "直护栏" && length) {
                    mesh.scale.y = length / 6 * mesh.DT.scale;
                    mesh.DT.updateConveyorRigidbody();
                }
                else mesh.DT.createRigidBody();
            }

            if (prop) {
                for (let key in prop) mesh.DT[key] = prop[key];
            }
            global.SCENE.DT.children.push(mesh.DT);
        }

        function createScene() {
            // 传送带演示场景，从左下角开始顺时针创建，存储在同级目录的DemoScene.json中
            for (let group of Object.values(scene)) {
                for (let item of group) {
                    createItem(item);
                };
            }
            global.SCENE.DT.updatePhysicalIDMap();
            global.SCENE.DT.updateWireframes();
        }

        for (let group of Object.values(scene)) {  // 搜索有无较大的模型
            for (let item of group) {
                let title = item.title;
                if (model_definition[title].label == "robot" &&
                    !global.loadedModels[title] && !loadingModel[title]) {
                    loadingModel[title] = item;
                    loadingProgress[title] = 0;
                }
            };
        }
        loadedTotal = Object.keys(loadingModel).length;
        if (!loadedTotal) {  // 无较大的模型则直接创建场景，否则等模型加载完再创建
            createScene();
            return;
        }

        for (let title in loadingModel) {  // 加载较大的模型
            let item = model_definition[title];
            let objPath = item.modelPath;  // 从input选择路径导入
            let mtlPath = objPath.replace(".obj", ".mtl");
            let MTLloader = new MTLLoader();
            let OBJloader = new OBJLoader();
            function updateProgress(close = false) {
                let progress = Object.values(loadingProgress).reduce((a, b) => a + b, 0);
                let progressTotal = loadedTotal * 100;
                global.emit("popup", {
                    type: "loading",
                    title: "场景加载中",
                    content: `已加载${loadedModels}/${loadedTotal}个模型`,
                    progress: progress / progressTotal * 100,
                    close: close
                });
            }
            MTLloader.load(mtlPath, function (material) {
                material.preload();
                OBJloader.setMaterials(material);
                OBJloader.load(objPath,
                    function loaded(mesh) {  // 模型加载完成
                        let DT = global.loadedModels[title] = new DTObject(mesh, false, "model");
                        DT.name = title;
                        DT.scale = item.scale;
                        updateProgress();
                        loadedModels++;
                        if (loadedModels == loadedTotal) {  // 模型全部加载完成
                            createScene();
                            updateProgress(true);
                        }
                    },
                    function loading(e) {  // 模型加载时
                        let progress = e.loaded / e.total * 100;
                        loadingProgress[title] = progress;
                        // updateProgress();
                    },
                    function err(e) {  // 模型读取错误时弹窗，并删除刚创建的模型组件
                        alert("模型读取错误");
                        console.error(e);
                    }
                )
            });
        }
    }
    onCollision() {  // 检测物理世界中的物体是否与传送带碰撞，若有则施力
        global.physicsWorld.forEachCollider(collider => {
            let rb = collider._parent;
            let mesh = global.rb2mesh[rb.handle];
            if (!mesh) return;
            let DT = mesh.DT;
            DT.touchObject = [];

            // 让在制品排在前面，即等于mesh0
            let label = global.rb2mesh[collider._parent.handle].DT.label;
            let onConveyor = false;  // 记录在制品是否在传送带上，若不在则清空施力
            global.physicsWorld.contactPairsWith(collider, collider0 => {
                // 寻找对应的刚体和网格
                let rb0 = collider0._parent;
                let mesh0 = global.rb2mesh[rb0.handle];
                let DT0 = mesh0.DT;
                DT.touchObject.push(DT0);

                if (label == "WIP" || collider.isSensor()) {
                    if (DT0.label == "conveyor") {  // 让在制品遇到货物时受摩擦力作用
                        rb.resetForces();
                        rb.resetTorques();
                        onConveyor = true;
                        let J = 10;  // 转动惯量J
                        let k = Math.min(DT.friction, DT0.friction);  // 滑动摩擦系数k
                        let kw = k;  // 转动摩擦系数kw
                        let m = DT.mass;  // 质量m
                        let P = new THREE.Vector3(), Q = new THREE.Quaternion(), R = new THREE.Euler();
                        mesh0.getWorldPosition(P);
                        mesh0.getWorldQuaternion(Q);
                        R.setFromQuaternion(Q);
                        let v;  // 货物速度v
                        let v0 = DT0.v0 * 2 * 60 / fps;  // 传送带中轴线速度v0，运行时根据帧率进行调整
                        let theta = R.z;  //传送带旋转角θ 
                        R = 5;  // 传送带中轴线半径R
                        if (DT0.basename?.includes("直道")) {  // 摩擦力 F = kmg(v0-v)/||v0-v||，v和v0为向量
                            let v0_vec = new THREE.Vector3(v0 * Math.cos(theta), v0 * Math.sin(theta), 0);  // 将v0从标量转换为货物处的速度矢量v0_vec
                            v = rb.linvel();
                            v = new THREE.Vector3(v.x, v.y, v.z);
                            let F = v0_vec.clone();
                            F.sub(v);
                            F.normalize();
                            F.multiplyScalar(2 * k * m * g);
                            rb.addForce(new RAPIER.Vector3(F.x, F.y, F.z));
                        } else if (DT0.basename?.includes("弯道")) {
                            let dir = DT0.basename.includes("逆时针弯道") ? -1 : 1;  // 传送带移动方向（顺/逆时针）
                            let r = new THREE.Vector3();
                            r.add(mesh.position).sub(P);
                            r.setZ(0);
                            let ra = r.length();  // 周向矢量r=v0-v，模ra=||v0-v||
                            if (ra >= 3.2 && ra <= 6.4) {  // 当货物到弯道的半径为3.2≤ra≤6.4时向其质心施力
                                // 将v0从标量转换为货物处的速度矢量v0_vec
                                let v0_vec = new THREE.Vector3(r.y, -r.x, 0);  // 旋转v0
                                v0_vec.normalize();
                                v0_vec.multiplyScalar(dir * v0 * ra / R, v0_vec);  // 将传送带上r=R处的速度转换为r=ra处的速度
                                v = rb.linvel();
                                let F = v0_vec.clone();  // 周向摩擦力F = μmg(v0-v)/||v0-v||，v和v0为向量
                                F.sub(v, F);
                                F.normalize();
                                F.multiplyScalar(2 * k * m * g, F);
                                rb.addForce(new RAPIER.Vector3(F.x, F.y, F.z));
                                // 然后施加转矩，使在制品尽量对准中轴线
                                let w0 = -dir * v0_vec.length() / ra;  //传送带角速度ω0 
                                let w = rb.angvel().z;  //货物角速度ω0
                                let M = new RAPIER.Vector3(0, 0, 1.5 * kw * J * (w0 - w));
                                rb.addTorque(M);  // 同理，摩擦力矩 M = kw*J*(ω0-ω)
                            }
                        }
                    }
                    else if (DT0.label == "sensor") {
                        DT.touchSensor = DT0;
                    }
                    else if (DT0.label == "special") {
                        if (DT0.basename == "回收器") {
                            DT.destroy();
                            global.emit("print", `【${DT.name}${mesh.id}】被【${DT0.name}${DT0.id}】回收`);
                        }
                    }

                    if (!onConveyor) {  // 若在制品不在传送带上则清空施力
                        let rb0 = collider._parent;
                        rb0.resetForces();
                        rb0.resetTorques();
                    }
                };
            });

            if (collider.isSensor()) {  // 传感器与物体的重叠检测
                global.physicsWorld.intersectionPairsWith(collider, collider0 => {
                    let rb0 = collider0._parent;
                    let mesh0 = global.rb2mesh[rb0.handle];
                    let DT0 = mesh0.DT;
                    DT.touchObject.push(DT0);
                });
            }

            // 比较这一帧和上一帧的碰撞的物体，前者为空则触发开始碰撞事件，后者为空则触发结束碰撞事件
            let DTs = DT.touchObject;

            try {  // 刚体与物体碰撞时运行的脚本
                if (DT.code.onCollision) eval(DT.code.onCollision);
            }
            catch (err) { console.log(err); }

            if (!DT.touchObjectBefore?.length && DT.touchObject?.length) {  // 触发开始碰撞事件
                try {  // 开始碰撞时运行的脚本
                    if (DT.code.onCollisionStart) eval(DT.code.onCollisionStart);
                }
                catch (err) { console.log(err); }
            }

            if (DT.touchObjectBefore?.length && !DT.touchObject?.length) {  // 触发结束碰撞事件
                try {  // 开始碰撞时运行的脚本
                    if (DT.code.onCollisionEnd) eval(DT.code.onCollisionEnd);
                }
                catch (err) { console.log(err); }
            }

            DT.touchObjectBefore = DT.touchObject;
        })
    }
    removeRigidBody(mesh) {  // 移除刚体
        let rb = mesh.DT.rb();
        global.physicsWorld.removeBody(rb);
        mesh.DT.layers.rigidShapeWorld = [];
    }
    render() {  // 渲染
        this.updatePhysics();
        this.composer.render();
        this.cssRenderer.render(global.SCENE, this.camera);
        if (this.camera == this.cameraPersp) this.gizmoPersp.render(this.renderer);
        if (this.camera == this.cameraOrtho) this.gizmoOrtho.render(this.renderer);
    }
    updateFPSandTime(now, pause, stop) {  // 更新帧率和用时
        if (stop) {
        if(this.camera == this.cameraPersp) this.gizmoPersp.render();
        if(this.camera == this.cameraOrtho) this.gizmoOrtho.render();
    } 
    updateFPSandTime(now, pause, stop){  // 更新帧率和用时
        if(stop){ 
            BottomTimer.textContent = "00:00:00.000"
        } else {
            let totalTime = new Date(now - T0);
            function pad(x, n = 2) { return x.toString().padStart(n, '0') };
            BottomTimer.textContent = pad(totalTime.getHours() - 8) + ':'
                + pad(totalTime.getMinutes()) + ':'
                + pad(totalTime.getSeconds()) + '.'
                + pad(totalTime.getMilliseconds(), 3);
        }
        if (time - timeUpdateFPS < 1000) {  // 未到一秒则统计一秒钟的步进次数，将其作为帧数
            frames++;
            time = now;
        }
        else {  // 到一秒时更新帧率显示          
            BottomFPS.textContent = fps = frames;
            frames = 0;
            timeUpdateFPS = time;
        }
    }
    updateRigidBodies() {  // 改变物体的父子关系后，将刚体位置更新为物体的全局坐标
        Object.values(global.rb2mesh).forEach((mesh: any) => {
            let DT = mesh.DT;
            let rigidShapeWorld = mesh.layers.rigidShapeWorld;
            if (DT.mass != 0) return;
            if (rigidShapeWorld?.length) rigidShapeWorld[0].removeFromParent();
            let clone = new THREE.Mesh();
            clone.position.copy(mesh.position);
            clone.quaternion.copy(mesh.quaternion);
            global.SCENE.add(clone);
            mesh.getWorldPosition(clone.position);
            mesh.getWorldQuaternion(clone.quaternion);
            DT.layers.rigidShapeWorld = [clone];
        }
        )
    }
    updatePhysics() {  // 步进 
        let now = performance.now();
        let pause = emulateMode == "pause", stop = emulateMode == "stop";  // 是否暂停或停止
        this.updateFPSandTime(now, pause, stop);
        if (stop) { T0 = performance.now(); }  // 暂停后停止计时
        if (pause || stop) return;  // 未暂停时更新刚体
        if (emulateMode == "step") global.physicsWorld.step();  // 单步更新;
        else {
            for (let i = 0; i < speed; i++) global.physicsWorld.step();
        }

        Object.values(global.rb2mesh).forEach((mesh: any) => {  // 让网格位置等于刚体位置
            const rb = global.mesh2rb[mesh.uuid];
            const DT = mesh.DT;
            try {  // 若物体有自定义脚本则执行
                if (typeof DT.code.update == "function") (DT.code.update)();
                else if (typeof DT.code.update == "string") eval(DT.code.update);
            }
            catch (e) { }
            if (!stop && DT.basename == "发生器") {  // 未暂停时制造货物
                if (now - DT.timer >= DT.timeInterval) {  // 秒变毫秒
                    let mesh0 = this.createMeshFromModels({ title: "货物" }, mesh.position);
                    mesh0.position.copy(mesh.position);
                    mesh0.rotation.copy(mesh.rotation);
                    global.DTObjects.value.push(mesh0.DT);
                    global.SCENE.DT.children.push(mesh0.DT);
                    mesh0.DT.createRigidBody();
                    global.emit("print", `【${DT.name}${DT.id}】创建了【${mesh0.DT.name}${mesh0.id}】`);
                    DT.timer = now;
                }
            }
            else if (true || !mesh.isDrag) {  // 刚体未被拖动时才计算
                if (  // 物体太远或位置变为NaN时则清除
                    mesh.position.manhattanDistanceTo(origin) > 10000 ||
                    Number.isNaN(mesh.position.x) ||
                    Number.isNaN(mesh.position.y) ||
                    Number.isNaN(mesh.position.z)
                ) {
                    mesh.DT.destroy();
                }
                if (DT.rigidFollow) {  // 强制让刚体位姿等于网格位姿
                    DT.updateRigidbodyTransform();
                }
                else {  // 运行时将网格位姿更新为刚体位姿
                    let P = rb.translation(), Q = rb.rotation();
                    mesh.position.set(P.x, P.y, P.z);  // 将网格位移设为刚体位移
                    mesh.quaternion.set(Q.x, Q.y, Q.z, Q.w);  // 将网格旋转设为刚体旋转
                }
            }
        });

        this.onCollision();
        if (emulateMode == "step") emulateMode = "pause";  // 步进模式下，每仿真完一步就停止
    }

    // 演示场景，1单位长度=50mm
    // 用DT().traverse(dt=>dt.v0=2)改变所有传送带速度
    // 用global.emit("updateTrayPosition", {deviceID:'A', RFID:'a'})向托盘发送消息
    // 光电门1物理实体ID：a5197017-c560-4713-aacd-01f097dda18f
    // 光电门3物理实体ID：75292a01-6d17-4d50-bb75-d42718f75fe8
    // 光电门5物理实体ID：7f698a28-d9d4-456a-9814-19d6c9b2f1a1
    // 托盘16物理实体ID：822fbee2-1fe0-45c8-b403-8b5cdb31cb25   
}