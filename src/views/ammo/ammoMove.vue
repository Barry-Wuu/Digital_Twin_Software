<script setup>
//直道和弯道
import { onMounted, ref } from "vue";
import Base from "../Base";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
let base, controls;
const canvasDom = ref(null);
let transformAux;
onMounted(() => {
    base = new Base(canvasDom.value);
    base.addAmbientLight(0.45);
    let dir = base.addDirLight(0.5);
    dir.castShadow = true;
    dir.position.set(7, 10, 15);
    let d = 10;
    dir.shadow.camera.left = -d;
    dir.shadow.camera.right = d;
    dir.shadow.camera.top = d;
    dir.shadow.camera.bottom = -d;
    dir.shadow.camera.near = 0.5;
    dir.shadow.camera.far = 50;
    //阴影贴图宽度和高度
    dir.shadow.mapSize.x = 1024;
    dir.shadow.mapSize.y = 1024;
    dir.shadow.bias = -0.003;//阴影贴图偏差，避免布料阴影斑驳
    base.camera.position.set(0, 27, 35)
    controls = new OrbitControls(base.camera, base.renderer.domElement)
    Ammo().then((Ammolib) => {
        //console.log(Ammolib);
        Ammo = Ammolib;
        initPhysics();
        //立方体 
        createObject(1, 1, 1, 1, new THREE.Vector3(0, 0, 0), new THREE.Quaternion());
        // createObject(1, 1, 1, 1.1, new THREE.Vector3(1.5, 0, 0.5), new THREE.Quaternion());
        // createDangban()
        let quat = new THREE.Quaternion()
        quat.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2)
        // createObject(100, 1, 100, 0, new THREE.Vector3(0, -4, 0,), new THREE.Quaternion(),new THREE.MeshStandardMaterial({color:0xffffff}));
        createPlane()
        // createPlane2()
        transformAux = new Ammo.btTransform();
        update();
    })

    window.addEventListener("resize", resize);
});
let physicsworld, dispatcher, collisionConfiguration, broadphase, solver;
let objes = [];
//初始化物理世界，ammo初始化后引用
function initPhysics() {
    //     btDiscreteDynamicsWorld:: btDiscreteDynamicsWorld(
    // 离散动态世界
    // btDispatcher * dispatcher,
    //碰撞调度器，碰撞时间，地点，穿透程度
    //     btBroadphaseInterface * pairCache,
    //宽相，确定物体可能碰撞
    //     btConstraintSolver * constraintSolver,
    // 解算器，用于约束，限制物体运动，如弹簧，旋转门，摩擦力
    //     btCollisionConfiguration * collisionConfiguration
    //碰撞配置)
    collisionConfiguration = new Ammo.btDefaultCollisionConfiguration();
    dispatcher = new Ammo.btCollisionDispatcher(collisionConfiguration);
    broadphase = new Ammo.btDbvtBroadphase();
    solver = new Ammo.btSequentialImpulseConstraintSolver();
    physicsworld = new Ammo.btDiscreteDynamicsWorld(
        dispatcher,
        broadphase,
        solver,
        collisionConfiguration
    );
    //设置重力
    physicsworld.setGravity(new Ammo.btVector3(0, -10, 0))
}
let textureLoader = new THREE.TextureLoader();
//创造地板
function createPlane() {
    let plane = createObject(100, 0.5, 100, 0, new THREE.Vector3(0, -0.5, 0), new THREE.Quaternion(), new THREE.MeshLambertMaterial());
    // //赋值材质，
    // textureLoader.load("texture/grid.png", function (texture) {
    //     texture.warpS = THREE.RepeatWrapping;//水平重复
    //     texture.warpT = THREE.RepeatWrapping;//竖直重复
    //     texture.repeat.set(100, 100);
    //     //纹理在水平和垂直方向的重复次数
    //     plane.material.map = texture;
    //     plane.material.needsUpdate = true;
    // });
}
//宽度，高度，深度，质量，位置，旋转，材质
function createObject(width, height, depth, mass, pos, quat, mat = createMaterial()) {
    //创建threejs中的物体
    let box = new THREE.BoxGeometry(width, height, depth);
    let mesh = new THREE.Mesh(box, mat);
    mesh.position.copy(pos);//位置
    mesh.quaternion.copy(quat);//旋转
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    base.scene.add(mesh);
    //创建物理引擎中的形状
    let shape = new Ammo.btBoxShape(new Ammo.btVector3(width / 2, height / 2, depth / 2)
    );
    //旋转和平移信息
    let transform = new Ammo.btTransform();
    transform.setIdentity()//设置为单位矩阵，相当于初始化
    //原点
    transform.setOrigin(new Ammo.btVector3(pos.x, pos.y, pos.z));
    //旋转
    transform.setRotation(new Ammo.btQuaternion(quat.x, quat.y, quat.z, quat.w));
    //使用默认的运动状态来包裹上述信息
    let motionState = new Ammo.btDefaultMotionState(transform);
    //创建刚体配置信息（质量，运动，形状）
    let info = new Ammo.btRigidBodyConstructionInfo(mass, motionState, shape);
    //创建刚体
    let body = new Ammo.btRigidBody(info);
    body.setRestitution(0.7);//设置弹力
    let friction = 0.5; // 静摩擦系数和动摩擦系数都设置为0.5
body.setFriction(friction);
    if (mass > 0) {
        mesh.userData.body = body;
        objes.push(mesh);
    }
    physicsworld.addRigidBody(body);
}
function createMaterial() {
    //随机颜色方块，因为0fxxxxxx，16进制
    return new THREE.MeshStandardMaterial({
        color: Math.floor(Math.random() * (1 << 24)),
    })
}
let clock = new THREE.Clock();
function update() {
    requestAnimationFrame(update);
    base.update();
    controls.update();
    //步长，即更新频率
    let d = clock.getDelta();
    physicsworld.stepSimulation(d);

    for (let i = 0; i < objes.length; i++) {
        //获取刚体运动状态
        let index = i;
        let motionstate = objes[index].userData.body.getMotionState()
        //获取平移和旋转信息
        let velocity = objes[index].userData.body.getLinearVelocity();
        let speed = velocity.length();
        let force = new Ammo.btVector3(0, 0, 0)
        motionstate.getWorldTransform(transformAux);
        let p = transformAux.getOrigin();//位置信息
        let r = transformAux.getRotation();//旋转信息
        objes[index].position.set(p.x(), p.y(), p.z());
        objes[index].quaternion.set(r.x(), r.y(), r.z(), r.w());
        //于中心点施加力
        let maxSpeed //传送带速度
        maxSpeed =5;
        let mass =1;
        if (speed < maxSpeed && p.x() < 10) {
            force.setValue(5, 0, 0)//摩擦力在重力10 mass1 摩擦系数0.1时，约为0.4967
            objes[index].userData.body.applyCentralForce(force)
        }
        else if (p.x() > 10 && p.z() < 8 && speed < maxSpeed) {
            let radius = 8//半径
            let centerX=10
            let centerY=0
            let centerZ=8
            let forceLixin = mass*speed*speed/radius //离心力公式为质量*速度平方/半径，半径8速度5质量1,中心点为（10,0,8）
            const tt = Math.sqrt((p.x()-centerX) * (p.x()-centerX) + (p.z()-centerZ) * (p.z()-centerZ));//距离中心点直线距离
            const fx1 = -forceLixin * (p.x()-centerX)/tt;
            const fz1 = forceLixin * (centerZ-p.z())/tt;
                force.setValue(fx1, 9.8, fz1)
                objes[index].userData.body.applyCentralForce(force)
                objes[index].rotation.set(0, -Math.asin((p.x()-centerX)/tt), 0);//通过反三角函数计算旋转角度，设置
            }
        else if (p.x() > 10 && p.z() > 8 && p.z() < 20 && speed < maxSpeed) {
            force.setValue(0, 0, 5)
            objes[index].userData.body.applyCentralForce(force)
        }
        else {
            force.setValue(0, 0, 0)
            objes[index].userData.body.applyCentralForce(force)
        }
        console.log('速度为' + speed)
        console.log(p.x(), p.z())
        console.log(r.x(), r.y(),r.z(),r.w())
        // console.log(force)
    }
}
function resize() {
    base.resize();
}
</script>

<template>
    <canvas ref="canvasDom" id="canvasDom"></canvas>
</template>

<style scoped>
#canvasDom {
    width: 100vw;
    height: 0vh;
}
</style>