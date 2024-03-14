import * as fs from 'fs';  
import * as THREE from 'three';
import * as Ammo from 'ammo.js';  
import { ColladaLoader } from 'three/examples/jsm/loaders/COLLADALoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ref, onMounted, toRaw, watch } from 'vue';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import BUS from "../EventBus"
import { contentQuotesLinter } from 'ant-design-vue/es/_util/cssinjs/linters';

var BottomFPS, BottomTimer;
var DTObjects = ref([]);
var geom0;
var loader = new STLLoader();
var origin = new THREE.Vector3(0, 0, 0);
var protectedObjects = [];
var speed = 1;
var SCENE = new THREE.Scene();
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
// 物理解算器
var physicsWorld;
const broadphase = new Ammo.btDbvtBroadphase();
const collisionConfiguration = new Ammo.btDefaultCollisionConfiguration(); 
const dispatcher = new Ammo.btCollisionDispatcher( collisionConfiguration );
const solver = new Ammo.btSequentialImpulseConstraintSolver();
physicsWorld = new Ammo.btDiscreteDynamicsWorld(dispatcher, broadphase, solver, collisionConfiguration);
physicsWorld.setGravity( G );
// 碰撞体到刚体和网格的映射表，因为碰撞检测时碰撞体和刚体不同，而两者ptr相同，所以需要用ptr在此表中查找刚体和网格
var rb_mesh = new Map();
BUS.on("changeSpeed", (k: String)=>{
    speed = parseInt(k.slice(0, k.length-1));
})
class DTObject {  // 用DTObject类包裹场景中的对象
    children: []  // 子物体（自动计算）
    friction0: number  // 静摩擦力
    friction: number  // 滑动摩擦力
    id: number  // 序号
    key: number  // 层级数的键
    mass: number  // 质量
    material: Object  // 材质属性
    mesh: THREE.Object  // 模型网格
    name: string  // 名称
    rigid: Boolean  // 是否为刚体
    rigidShape: Ammo.Object  // 刚体网格（自动计算）
    scale: number  // 尺寸
    timer: number  // 定时器（自动计算）
    timeInterval: number  // 定时器触发时间
    title: string  // 标题 = 物体类型 + 名称 + 序号（自动计算）
    type: string  // 模型类型
    v0: number  // 传送带中轴线速度
    constructor(mesh, inScene=true) {  
        this.children = [];
        this.friction0 = 0.5;  
        this.friction = 0.8;  
        this.id = mesh.id;
        this.key = mesh.id;
        this.material = {};
        this.mesh = mesh;
        this.rigid = false;
        this.scale = 1;
        this.timer = performance.now();
        this.timeInterval = 0;    
        this.type = mesh.type;
        mesh.DT = this;
        if(inScene) DTObjects.value.push(this);
        return this;
    }  
    createRigidBody() {  // 添加刚体
        let pos = this.mesh.position;
        let quat = this.mesh.quaternion;
        let mass = this.mesh.DT.mass;
        let shape = this.mesh.DT.rigidShape;
        const transform = new Ammo.btTransform();
        transform.setIdentity();
        transform.setOrigin( new Ammo.btVector3(pos.x, pos.y, pos.z) );
        transform.setRotation( new Ammo.btQuaternion( quat.x, quat.y, quat.z, quat.w ) );
        const motionState = new Ammo.btDefaultMotionState( transform );
        const localInertia = new Ammo.btVector3( 0, 0, 0 );
        shape.calculateLocalInertia( mass, localInertia );
        const rbInfo = new Ammo.btRigidBodyConstructionInfo( mass, motionState, shape, localInertia );
        const rb = new Ammo.btRigidBody( rbInfo );
        this.mesh.userData.physicsBody = rb;
        SCENE.add( this.mesh );
        if (mass > 0) {rb.setActivationState( 4 );}  // 质量为0代表为固定的刚体
        physicsWorld.addRigidBody( rb );
        rb_mesh.set(rb.ptr, {mesh:this.mesh, rb:rb});
        rb.setFriction( this.mesh.DT.friction0 );  // 静摩擦力
    }
    destroy() {  
        if(protectedObjects.includes(this)) return;  // 不能删除场景和地面
        let rb = this.mesh.userData.physicsBody;
        if(rb){
            rb_mesh.delete(rb.ptr);
            physicsWorld.removeRigidBody( rb );
        }
        this.mesh.removeFromParent();
        this.mesh.remove();
        DTObjects.value = DTObjects.value.filter(x => x != this);  
    }  
    findDTObjectById(id) {  // 根据id/key寻找物体 
        let result = DTObjects.value.filter(DT => DT.id == id);
        return result.length > 0 ? result[0] : null;
    }
    getDTObjects() {return DTObjects.value;}
    setTitle() {  // 物体在树中的标题 = 类型 + 名称 
        if(this.name){
            this.title = this.type + '【' + this.name + this.id + '】';
        } else {
            this.title = this.type;
        }
    }
    set(prop, delta) {
        if(this.rigid){  // 非刚体
            let rb = this.mesh.userData.physicsBody;
            let transform = new Ammo.btTransform();
            const motionState = rb.getMotionState();
            motionState.getWorldTransform( transform );
            const p = transform.getOrigin();
            let q = new THREE.Quaternion();  // q代表四元数
            const r = this.mesh.rotation;  // r代表欧拉角
            if(prop == "x"){p.setX(p.x() + delta)}
            if(prop == "y"){p.setY(p.y() + delta)}
            if(prop == "z"){p.setZ(p.z() + delta)}
            if(prop == 'rx'){r.x += delta};
            if(prop == 'ry'){r.y += delta};
            if(prop == 'rz'){r.z += delta};
            q.setFromEuler(r);
            q = new Ammo.btQuaternion(q.x, q.y, q.z, q.w);
            transform.setOrigin(p);
            transform.setRotation(q);
            motionState.setWorldTransform( transform );
            rb.setMotionState(motionState);
        }else{
            if(prop == "x") this.mesh.position.x += delta;
            if(prop == "y") this.mesh.position.y += delta;
            if(prop == "z") this.mesh.position.z += delta;
            if(prop == "rx") this.mesh.rotation.x += delta;
            if(prop == "ry") this.mesh.rotation.y += delta;
            if(prop == "rz") this.mesh.rotation.z += delta;
        }
        if(prop == 'R'){this.mesh.material.color.r += delta};
        if(prop == 'G'){this.mesh.material.color.g += delta};
        if(prop == 'B'){this.mesh.material.color.b += delta};
        if(prop == 'A'){this.mesh.material.opacity += delta};
    }
    updateChildren() {  // 刷新DTObject的父子关系
        this.children = []
        for(let child of this.mesh.children){
            if(child.DT){
                this.children.push(child.DT);
                child.DT.updateChildren();
            }
        }
    }
}  

export default class SceneBuilder{
    camera: THREE.PerspectiveCamera
    cameraControls: OrbitControls
    DTScene: DTObject
    DTObjects = DTObjects
    material
    ground
    group
    renderer: THREE.WebGLRenderer
    root: HTMLElement
    SCENE = SCENE
    constructor(root: HTMLElement){ 
        // 初始化
        animate = () => {
            requestAnimationFrame(animate);  
            this.render();
        }
        BottomFPS = document.getElementById("BottomFPS");
        BottomTimer = document.getElementById("BottomTimer");
        T0 = performance.now();
        //this.group = new THREE.Group();
        this.root = root;
        // 场景
        SCENE.fog = new THREE.Fog("white", 5, 400);  // 设置远端雾化
        protectedObjects.push(SCENE.id);
        this.DTScene = new DTObject(SCENE);
        this.DTScene.setTitle();
        window.DTScene = this.DTScene;
        // 渲染器
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.shadowMap.enabled = true;
        this.root.appendChild( this.renderer.domElement );
        // 天空
        //SCENE.background = new THREE.Color("dodgerblue");
        this.createSkyBoxFromShader();
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
        this.cameraControls = new OrbitControls( this.camera, this.renderer.domElement );
        this.cameraControls.mouseButtons = {  // 清除默认快捷键
            LEFT: -1, MIDDLE: -1, RIGHT: -1
        };
        // 限制相机缩放距离
        this.cameraControls.minDistance = 1;
        this.cameraControls.maxDistance = 300;
        // 网格
        const gridHelper = new THREE.GridHelper(500, 100, "red", "white");
        gridHelper.rotateX(Math.PI/2);
        SCENE.add( gridHelper );
        // 坐标轴
        const axesHelper = new THREE.AxesHelper( 10 );
        SCENE.add( axesHelper );
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
        SCENE.add( light );
        let DTLight = new DTObject(light);
        DTLight.setTitle();
        // 地面
        this.ground = new THREE.Mesh( 
            new THREE.PlaneGeometry(500, 500), 
            new THREE.MeshPhongMaterial({ color: "grey" })
        );
        let DTGround = new DTObject(this.ground);
        DTGround.setTitle();
        protectedObjects.push(this.ground.id);
        this.ground.castShadow = true;
        this.ground.receiveShadow = true;
        this.ground.DT.mass = 0 // 不可动
        this.ground.DT.name = "地面";
        this.ground.DT.rigidShape = new Ammo.btBoxShape( new Ammo.btVector3( 250, 250, margin ) );
        this.ground.DT.createRigidBody();
        SCENE.add( this.ground );
        // 地面边框
        let wireframe = new THREE.BoxHelper(this.ground, "red");
        this.ground.wireframe = wireframe;
        wireframe.visible = false;
        this.ground.add(wireframe);
        // 物体数量变化时
        watch(DTObjects.value, ()=>{
            this.DTScene.updateChildren();
            window.DTScene = this.DTScene;
            BUS.emit('updateTree');
        }, { immediate:true });
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
            if(data.modelname == "护栏"){
                mesh.geometry = new THREE.BoxGeometry( 2, 0.5, 1 );
                DT.rigidShape = new Ammo.btBoxShape( new Ammo.btVector3( 1, 0.25, 0.5 ) );
            }
            else if(data.modelname == "传感器"){
                mesh.geometry = new THREE.BoxGeometry( 2, 0.5, 1 );
                DT.rigidShape = new Ammo.btBoxShape( new Ammo.btVector3( 1, 0.25, 0.5 ) );
                DT.material = { color: "red", opacity: 0.5, transparent: true };
            }
            else{
                modelPath = `src/assets/models/传送带-${data.modelname}.stl`;
                loader.load(modelPath, function(geom){ 
                    geom0 = geom; 
                })
                DT.scale = 0.05;
                DT.rigidShape = this.geom2rigidShape(geom0, DT.scale);
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
            mesh.geometry = new THREE.BoxGeometry( 1, 1, 1 );
            DT.material = { color: "lime", opacity: 0.5, transparent: true };
            DT.timeInterval = 3;
        }
        else if(name == "货物-回收器"){  
            mesh.geometry = new THREE.BoxGeometry( 1, 1, 1 );
            DT.material = { color: "red", opacity: 0.5, transparent: true };
            DT.mass = 0;
            DT.rigid = true;
            DT.rigidShape = new Ammo.btBoxShape( new Ammo.btVector3( 0.5, 0.5, 0.5 ) ); 
        }
        else if(name == "货物-货物"){  
            mesh.geometry = new THREE.BoxGeometry( 1, 1, 1 );
            DT.material = { color: "blue" };
            DT.mass = 1;
            DT.rigid = true;
            DT.rigidShape = new Ammo.btBoxShape( new Ammo.btVector3( 0.5, 0.5, 0.5 ) ); 
        }
        else if(name == "基本几何体-正方体"){
            mesh.geometry = new THREE.BoxGeometry( 1, 1, 1 );
            DT.material = { color: "lime" };
        }
        else if(name == "基本几何体-球"){
            mesh.geometry = new THREE.SphereGeometry( 0.5 );
            DT.material = { color: "red" };
        }
        else if(name == "基本几何体-锥体"){
            mesh.geometry = new THREE.ConeGeometry( 0.5, 1, 12 );
            DT.material = { color: "yellow" };
        }
        else if(name == "基本几何体-圆柱"){
            mesh.geometry = new THREE.CylinderGeometry(0.5, 0.5);
            DT.material = { color: "blue" };
        }

        mesh.material = new THREE.MeshPhongMaterial(DT.material);
        if(data.modeltype == "基本几何体"){mesh.rotateX(Math.PI/2);}
        DT.name = data.modelname;
        DT.setTitle();

        if(geom0){
            mesh.geometry = geom0;
            geom0 = null;
        }
        if(modelPath) mesh.geometry.userData = modelPath;
        let wireframe = new THREE.BoxHelper(mesh, "white");  // 线框
        wireframe.visible = false;
        if(indicators.length){  // 指示箭头
            for(let i of indicators){
                i.scale.set(1/DT.scale, 1/DT.scale, 1/DT.scale);
                mesh.add(i);
            }
        }
        
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.wireframe = wireframe
        mesh.add(wireframe);
        mesh.position.copy(position);
        if(DT.scale != 1){ mesh.scale.set(DT.scale, DT.scale, DT.scale); }
        SCENE.add(mesh);
        return(mesh);
    }  
    createSkyBoxFromShader(skyColor: number = 0x86B6F5, lineColor: number = 0xffffff, groundColor: number = 0xffffff) {
        const radius: number = 600;
        const widthSegments: number = 32;
        const heightSegments: number = 15;
        const skyGeo = new THREE.SphereGeometry(radius, widthSegments, heightSegments);

        const uniforms = {
            topColor: { value: new THREE.Color(skyColor) },
            skylineColor: { value: new THREE.Color(lineColor) },
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
    createSkyBoxFromTexture() {
        // 图片路径有要求，需要放在public文件夹下
        const picPath = '../src/assets/skybox/'; // 默认为public内
        const skybox = new THREE.CubeTextureLoader().setPath(picPath)
        .load( [ 'px.jpg', 'nx.jpg', 'py.jpg', 'ny.jpg', 'pz.jpg', 'nz.jpg', ] );
        skybox.format = THREE.RGBAFormat;
        this.scene.background = skybox;
    }
    geom2rigidShape(geom, scale){  // 从几何形状建立刚体形状
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
        //let shape = new Ammo.btbvhTriangleMeshShape(triangleMesh);  // 真实碰撞网格，几千个面同时导入后碰撞时会卡死
        let shape = new Ammo.btConvexTriangleMeshShape(triangleMesh);  // 凸碰撞网格
        return shape
    }
    init(){
        animate(this.render());
    }
    removeRigidBody( mesh ){  // 移除刚体
        let rb = mesh.userData.physicsBody;
        rb_mesh.delete(rb.ptr);
        physicsWorld.removeRigidBody( rb );
        mesh.userData = {};
    }
    render(){
        this.updatePhysics( clock.getDelta() );
        this.renderer.render(toRaw(SCENE), this.camera)
        //this.cameraControls.update();
    } 
    setControl(key, action){  // 设置快捷键（左键、中间、右键：平移、旋转、放缩）
        var map = {
          "NONE": -1,  // 无
          "PAN": THREE.MOUSE.PAN,  // 平移
          "ROTATE": THREE.MOUSE.ROTATE,  // 旋转
          "DOLLY": THREE.MOUSE.DOLLY,  // 放缩
        }
        let act = map[action];
        let button = this.cameraControls.mouseButtons;
        if(key == "LEFT") button.LEFT = act;  // 左键
        else if(key == "MIDDLE") button.MIDDLE = act;  // 中键
        else if(key == "RIGHT") button.RIGHT = act;  // 右键
        this.cameraControls.enablePan = action == "PAN";
        this.cameraControls.enableRotate = action == "ROTATE";
        this.cameraControls.enableZoom = action == "DOLLY";
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
    updateFPSandTime(now){  // 更新帧率和用时
        let totalTime = new Date(now - T0);
        function pad(x){return x.toString().padStart(2, '0')};
        BottomTimer.textContent = pad(totalTime.getHours() - 8) + ':'
        + pad(totalTime.getMinutes()) + ':'
        + pad(totalTime.getSeconds()) + '.'
        + String(totalTime.getMilliseconds()).slice(0, 2);
        if(time - timeUpdateFPS >= 1000){
            BottomFPS.textContent = (1000/(now - time)).toFixed(0);
            timeUpdateFPS = time;
        }
        else{
            time = now;
        }
    }
    updatePhysics( deltaTime ) {  // 步进 
        let now = performance.now();     
        this.updateFPSandTime(now);
        for(let i=0; i<speed; i++) physicsWorld.stepSimulation( deltaTime );  // 更新刚体
        for(let DT of DTObjects.value){  // 让网格位置等于刚体位置
            const mesh = DT.mesh;
            if(!DT.rigid){
                if(DT.name == "发生器"){
                    if(now - DT.timer >= DT.timeInterval * 1000){  // 秒变毫秒
                        let mesh0 = this.createGeometry({modeltype:"货物", modelname:"货物"}, mesh.position);                      
                        mesh0.rotation.copy(mesh.rotation);
                        mesh0.DT.createRigidBody();
                        BUS.emit("print", `【${DT.name}${DT.id}】创建了【${mesh0.DT.name}${mesh0.id}】`);
                        DT.timer = now;
                    }
                }
                continue;
            };
            if(!DT.mesh.userData.physicsBody) continue;
            const rb = DT.mesh.userData.physicsBody;
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
                    mesh.position.set( p.x(), p.y(), p.z() );
                    mesh.quaternion.set( q.x(), q.y(), q.z(), q.w() );
                }
            }
        }
        this.transport();
    }
}