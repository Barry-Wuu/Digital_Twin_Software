import * as Ammo from "ammo.js"
import { ConvexGeometry } from "three/examples/jsm/geometries/ConvexGeometry.js"
import global from "../../Global"
import * as THREE from "three"
import { ObjectDirective } from "vue";

let position = new THREE.Vector3();
const zeroVector_Ammo = new Ammo.btVector3();

export default class DTObject {  // 用DTObject类包裹场景中的对象
    basename: string  // 模型在模型库中的名称
    btQuaternion = new Ammo.btQuaternion()  // 用于避免重复创建对象导致的内存不足，下同
    btTransform: Ammo.btTransform
    btVector3 = new Ammo.btVector3()
    children = []  // 子物体（自动计算）
    code = ''  // 自定义脚本
    custom = {}  // 自定义属性
    expanded: boolean  // 是否在层级树中展开
    friction0 = 0.5  // 静摩擦力
    friction = 1  // 滑动摩擦力
    geometry: THREE.object  // 模型几何体
    icon: HTMLElement  // 物体图标
    id: number  // 序号
    key: number  // 层级树的键，应等于序号
    label = "无"  // 物体类型
    layers = {
        attachPoint1: [],  //传送带入口连接点
        attachPoint2: [],  //传送带出口连接点
        indicator: [],  // 传送带指示箭头
        label: [],  // 物体标签
        lightArrow: [],  // 平行光指示箭头
        rigidHelper: [],  // 可视化碰撞体网格
        rigidShapeWorld: [],  // 为物体创建全局坐标系下的映射体，以便与刚体绑定
        wireframe: [],  // 物体的包围盒
    }  // 物体及其子孙的图层
    mass = 0  // 质量
    material: THREE.object  // 模型材质
    mesh: THREE.object  // 模型网格
    name: string  // 名称
    physicalID = '0'  // 物理实体ID，可编辑
    rb: Ammo  // 刚体
    rigidShape: string | string[]  // 刚体网格，设成字符串易于存取，若为convex则刚体为mesh的凸集
    rigidFollow = false  // 若为是则让刚体强制跟随网格，否则默认让网格跟随刚体
    row = 0  // 子树在层级树模块中占几行
    scale = 1  // 尺寸
    sensorPass = null  // 光电门是否在冷却
    skybox: object  // 天空盒
    threeQuaternion = new THREE.Quaternion()  // 用于避免重复创建对象导致的内存不足，下同
    threeVector3 = new THREE.Vector3()
    timer = performance.now()  // 定时器（自动计算）
    timeInterval: number  // 定时器触发时间
    title: string  // 标题 = 物体类型 + 名称 + 序号（自动计算）
    touchSensor: DTObject  // 是否接触到光电门
    type: string  // 物体的网格类型
    v0: number  // 传送带中轴线速度
    constructor(mesh=null, addToScene=false, asset=null) {  
        if(mesh){
            this.id = this.key = this.physicalID = mesh.id;
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
        if(addToScene) global.DTObjects.value.push(this);
        return this;
    }  
    clearLoads() {  // 重置仿真动画时遍历清除所有在制品
        if(this.label == "WIP") this.destroy();
        for(let child of this.children){
            child.clearLoads();
        }
    }
    clone() {  // 保存时返回去除一些属性的DTObject，以节省DTObject文件大小
        let newDTObject: any = new DTObject(null);
        for(let prop in this){
            if(this[prop] == undefined) continue;
            else if(prop == "children"){
                for(let child of this.children){
                    newDTObject.children.push(child.clone());
                }
            }
            else if(this[prop]["uuid"]) continue;  // 排除网格、几何体、材质等属性
            else newDTObject[prop] = this[prop];
        }
        return newDTObject;
    }
    copyFrom(obj, clearDTObjects = false){  // 将读取的普通对象变回DT对象
        if(clearDTObjects) global.DTObjects.value = [];  // 清理旧的场景
        global.DTObjects.value.push(this);
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
    createRigidBody(target=this.mesh, scale=1) {  // 添加刚体
        if(!this.rigidShape) return;
        let mass = this.mass;
        let P = this.mesh.position;
        let Q = this.mesh.quaternion;
        let shape;  // 刚体形状
        if(this.rigidShape === "box"){  // 将包围盒作为刚体形状
            let result = this.createRigidHelper();
            let box = result;
            if(this.label == "importedModel") {
                let root;
                this.mesh.traverseAncestors(mesh => {root = mesh});
                box.multiplyScalar(root.DT.scale);
            };
            shape = new Ammo.btBoxShape(new Ammo.btVector3( box.x/2, box.y/2, box.z/2 ));      
        }
        else if(this.rigidShape === "convex"){  // 将自定义几何体的凸集作为刚体形状
            shape = this.createRigidShape(this.geometry, scale); 
        }
        else if(typeof this.rigidShape == "string"){  // 根据THREE的简单几何体生成Ammo刚体
            this.createRigidHelper(); 
            shape = eval(this.rigidShape);   
        }
        else{  // 由回调函数自定义刚体形状，回调函数储存为字符串数组，其中每个元素代表一行
            shape = this.createRigidShape(eval(this.rigidShape.join(''))()); 
        }
        const transform = new Ammo.btTransform();
        transform.setIdentity();
        transform.setOrigin( new Ammo.btVector3(P.x, P.y, P.z) );
        transform.setRotation( new Ammo.btQuaternion( Q.x, Q.y, Q.z, Q.w ) );
        const motionState = new Ammo.btDefaultMotionState( transform );
        const localInertia = new Ammo.btVector3( 0, 0, 0 );
        shape.calculateLocalInertia( mass, localInertia );
        const rbInfo = new Ammo.btRigidBodyConstructionInfo( mass, motionState, shape, localInertia );
        const rb = new Ammo.btRigidBody( rbInfo );
        this.rb = rb;
        if(target == "rigidHelper") target = this.layers.rigidHelper[0];
        target.userData.physicsBody = rb;
        if (mass>0) {rb.setActivationState(4);}  // 质量为0代表为固定的刚体
        // 将光电门设置为单独的碰撞组，物体mask为1时可通过光电门，3时会碰到光电门
        if(this.label == "sensor") global.physicsWorld.addRigidBody(rb, 2, 3);
        else global.physicsWorld.addRigidBody(rb, 1, 3);
        global.rb_mesh[rb.ptr] = {mesh:this.mesh, rb:rb};
        rb.setFriction( this.friction0 );  // 静摩擦力
    }
    createRigidHelper(geom=null, scale=1){  // 根据刚体形状添加可视化碰撞体网格
        try{if(this.layers.rigidHelper.length) return;}  // 防止选择物体时重复添加可视化碰撞体
        catch{}
        const material = new THREE.LineBasicMaterial({  // 红色网状材质
            color: "red", 
        });
        let boundingBox, result, rule;
        if(!geom){
            rule = /\(([^]*)\)/;
            if(typeof this.rigidShape != "string"){  // 自定义刚体形状
                geom = this.rigidShape;
            }
            else if(this.rigidShape == "box"){  // 方型刚体
                this.mesh.geometry.computeBoundingBox();
                boundingBox = this.mesh.geometry.boundingBox;
                result = boundingBox.max.clone().sub(boundingBox.min);
                result.multiplyScalar(scale);
                geom = new THREE.BoxGeometry(result.x, result.y, result.z);
            }
            else if(this.rigidShape.includes("btBoxShape")){  // 简单几何体刚体
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
        rigidHelper.visible = global.layers.includes("rigidHelper");
        if(this.rigidShape == "box") {
            let center = new THREE.Vector3();
            boundingBox.getCenter( center );
            center.multiplyScalar(scale)
            this.mesh.add( rigidHelper );
            rigidHelper.position.copy( center );
            this.layers.rigidHelper = [rigidHelper];
            return result;
        }
        this.mesh.add(rigidHelper);
        this.layers.rigidHelper = [rigidHelper];
    }
    createRigidShape(geom, scale=1){  // 从几何形状建立刚体形状
        // points里每三个连续的点定义了一个三角形面
        let ammoMesh = new Ammo.btTriangleMesh();
        let threeVertices = [];
        let points = geom.attributes.position.array;
        for (let i=0; i < points.length; i+=9) {
            let p0 = new Ammo.btVector3(points[i]*scale, points[i+1], points[i+2]);
            let p1 = new Ammo.btVector3(points[i+3]*scale, points[i+4], points[i+5]);
            let p2 = new Ammo.btVector3(points[i+6]*scale, points[i+7], points[i+8]);
            p0.op_mul(this.scale);
            p1.op_mul(this.scale);
            p2.op_mul(this.scale);
            ammoMesh.addTriangle(p0, p1, p2);  
            p0 = new THREE.Vector3(points[i], points[i+1], points[i+2]);
            p1 = new THREE.Vector3(points[i+3], points[i+4], points[i+5]);
            p2 = new THREE.Vector3(points[i+6], points[i+7], points[i+8]);
            threeVertices.push(p0, p1, p2);
        } 
        if(this.rigidShape == "convex"){  // 凸刚体形状
            this.createRigidHelper(new ConvexGeometry(threeVertices));
            return new Ammo.btConvexTriangleMeshShape(ammoMesh);
        }
        this.createRigidHelper(geom);  // 真实碰撞网格，面太多时会卡死
        return new Ammo.btBvhTriangleMeshShape(ammoMesh);
    }
    destroy() {  // 清除自身及其网格和刚体
        if(this.label == "protected") return;  // 不能删除场景和地面
        // 如果子物体中有CSS2DObject，则先删除相应的DOM，以免其残留在屏幕上
        let css2d = this.mesh.children.filter(child => child.isCSS2DObject);
        if(css2d.length){
            for(let child of css2d) child.element?.remove();
        }
        global.emit("controlEnd");  // 如果控制器绑定了该物体，则先解绑
        delete global.physicalIDMap[this.physicalID];
        this.removeRigidBody();
        try {this.mesh.removeFromParent()} catch {}
        let index = global.DTObjects.value.indexOf(this);
        if(index != -1) global.DTObjects.value.splice(index, 1);  // 原地修改DTObject.value，以防监听不到其变化
    }
    findDTObjectById(id, loadingFile=false) {  // 根据id寻找物体 
        id = parseInt(id);  // 若id为数字字符串则转换为数字
        if(!loadingFile){
            let mesh = global.SCENE.getObjectById(id);
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
    getDTObjects() {return global.DTObjects.value;}
    newScene(){  // 新的场景
        global.emit("loading");
        for(let ptr in global.rb_mesh) 
            global.physicsWorld.removeRigidBody(global.rb_mesh[ptr].rb);
        global.rb_mesh = {};
        // 相机绑定的global.SCENE是Three.Scene，导入的场景this.mesh是Three.Group
        // 将Group克隆到global.SCENE中
        let group = this.mesh;
        let controller = global.SCENE.children.filter(child => child.isTransformControls)[0];
        for(let prop in group){
            try{ global.SCENE[prop] = group[prop] }
            catch(e){
                if(e instanceof TypeError) global.SCENE[prop].copy(group[prop]);
            }
        }
        global.SCENE.add(controller);
        this.updateChildren(true);
        this.updateWireframes(true);
        global.emit("init");
    }
    resizeRigidBody(){  // 改变物体尺寸的同时改变刚体尺寸 
        this.traverse(()=>{  // 对该物体及其所有子物体
            this.removeRigidBody();  // 移除原有的刚体
            this.createRigidBody("rigidHelper");  // 根据尺寸改变后的rigidHelper创建新的刚体
        });
    }
    removeRigidBody(){  // 移除刚体
        if(this.rb){
            let rb = this.mesh.userData.physicsBody;
            try {delete global.rb_mesh[rb.ptr]} catch{};
            global.physicsWorld.removeRigidBody(rb);
        }
    }
    setProp(prop=null, newValue=null) {  // 修改物体属性，同时更新刚体中相应的属性
        if(prop){
            let node = this, split = prop.split('.');
            let last = split.splice(-1);
            for(let p of split) node = node[p];
            node[last] = newValue;
        }
        this.updateRigidbodyTransform();  // 强制更新刚体位姿
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
    setSkyboxByColor() {  // 根据上中下三种颜色设置天空盒
        let skybox: any = this.skybox;
        const radius = 600;
        const widthSegments = 32;
        const heightSegments = 15;
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

        let skyboxMesh = new THREE.Mesh(skyGeo, skyMat);
        skyboxMesh.rotation.x = (Math.PI/2);
        this.mesh.add(skyboxMesh);
    }
    setTitle(name=null) {  // 物体在树中的标题 = 类型 + 名称 
        let title = '';
        if(this.type == "AmbientLight") title = "环境光";
        else if(this.type == "DirectionalLight") title = "平行光";
        else if(this.type == "Group") title = "群组";
        else if(this.mesh.userData.ground) title = "地面";
        else if(this.name) {  // 若标题太长则截取20个字符
            if(this.name.length <= 20) title = this.name;
            else title = this.name.slice(0, 20) + "...";
        }
        else if(this.mesh.name){
            if(this.label == "WIP") this.mesh.name += this.id  // 创建货物时为物体名称添加id
            if(this.mesh.name.length <= 20) title = this.mesh.name;  // 物体名称太长则省略
            else title = this.mesh.name.slice(0, 20) + "...";
        } 
        else if(name) title = this.name = name;
        this.title = `(${this.type}) ` + title;
    }
    traverse(callback: Function){  // 递归执行回调函数
        callback(this);
        for(let child of this.children){
            child.traverse(callback);
        }
    }
    updateChildren(loadingFile=false) {  // 更新DTObject的父子关系
        let newChildren = [];
        this.setTitle();
        for(let childMesh of this.mesh.children){  // 刷新时
            if(!childMesh.userData.id) continue;
            let childDT = global.SCENE.DT.findDTObjectById(childMesh.userData.id, loadingFile);
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
    updateGroupWireframes(){  // 更新群组的线框
        this.traverse(DT => {
            if(DT.type != "Group") return;
            const [wireframe, box, boxMesh] = DT.layers.wireframe;
            if(!wireframe.parent) DT.mesh.add(wireframe);
            box.makeEmpty();  // 更新线框 
            for(let child of DT.children) box.expandByObject(
                child.mesh
            );  
            box.getCenter(boxMesh.position); 
            let localCenter = DT.mesh.worldToLocal(boxMesh.position)
            boxMesh.position.copy(localCenter);
            boxMesh.scale.set(
                box.max.x - box.min.x, 
                box.max.y - box.min.y, 
                box.max.z - box.min.z
            );
            wireframe.update();
        })
    }
    updatePhysicalIDMap(){  // 更新物理实体ID到物体的映射关系
        global.physicalIDMap = {};
        for(let DT of global.DTObjects.value){
            global.physicalIDMap[DT.physicalID] = DT;
        }
    }
    updateConveyorRigidbody(value: number = null){  // 更新传送带刚体的长度
        if(this.layers.attachPoint1[0]) 
            this.layers.attachPoint1[0].scale.x = 
                value ? 7.5 / value / this.scale : 1/this.mesh.scale.x;
        if(this.layers.attachPoint1[0]) 
            this.layers.attachPoint2[0].scale.x = 
                value ? 7.5 / value / this.scale : 1/this.mesh.scale.x;
        this.updateConveyorArrow(value);
        this.removeRigidBody();  // 移除刚体
        let L = new THREE.Vector3();
        this.mesh.getWorldScale(L);
        L = L.x / this.scale;  // 获取传送带直道的长度缩放比
        this.createRigidBody(this.mesh, L);  // 重建刚体
        this.updateRigidbodyTransform();
    }
    updateConveyorArrow(value: number|THREE.Vector3 = null){  // 实时
        if(!value){
            value = new THREE.Vector3();
            this.mesh.getWorldScale(value);
            value = value.x / this.scale * 7.5;  // 获取传送带直道的长度缩放比
        }
        try{
            if(value >= 3) this.layers.indicator[0].scale.x = 7.5 / value / this.scale;
            else this.layers.indicator[0].scale.x =  2.5 / this.scale;
        }
        catch {}
    }
    updateRigidbodyTransform(mesh=this.mesh, force=false, target=this.mesh){  // 强制更新刚体位姿
        // 将物体的速度和角速度清零
        if(!mesh.DT?.rb && !force) return;
        this.rb.setLinearVelocity(zeroVector_Ammo);
        this.rb.setAngularVelocity(zeroVector_Ammo);

        if(this.rigidShape == "box") {
            mesh = this.layers.rigidHelper[0];
        }

        // 根据物体位姿强制设置其刚体位姿
        let rb = mesh.DT ? mesh.DT.rb : mesh.parent.DT.rb;
        let transform;  // 下两行用于改善内存泄漏
        if(this.btTransform) transform = this.btTransform;
        else this.btTransform = transform = new Ammo.btTransform();
        const motionState = rb.getMotionState();
        motionState.getWorldTransform(transform);
        let P = this.threeVector3, Q = this.threeQuaternion;  // P为位移，Q为四元数旋转
        target.getWorldPosition(P);
        target.getWorldQuaternion(Q);
        this.btVector3.setValue(P.x, P.y, P.z);
        this.btQuaternion.setValue(Q.x, Q.y, Q.z, Q.w);
        transform.setOrigin(this.btVector3);
        transform.setRotation(this.btQuaternion);
        motionState.setWorldTransform(transform);
        rb.setMotionState(motionState);
    }
    updateWireframes(loadingFile = false){  // 更新线框
        this.traverse(DT => {
            let wireframe;
            if(loadingFile){  // 读取场景时重新绑定原有的线框
                wireframe = DT.mesh.children.filter(child=>child.DT.layers.wireframe.length)[0];  
            } else {  // 创建物体时新建线框
                if(DT.mesh.isGroup) {  // 创建群组
                    DT.layers.wireframe[1] = new THREE.Box3();  // 为群组创建包围盒 
                    DT.layers.wireframe[2] = new THREE.Mesh(  // 控制该包围盒线框的物体
                        new THREE.BoxGeometry(),
                    );
                    DT.layers.wireframe[0] = new THREE.BoxHelper(  // 创建线框
                        DT.layers.wireframe[2], "cyan"
                    );
                }
                else wireframe = new THREE.BoxHelper(DT.mesh, "cyan");
                DT.mesh.add(wireframe);
            }
            if(wireframe){
                wireframe.visible = false;
                DT.layers.wireframe = [wireframe];
            }
        })
    }
}  