import { defineComponent, ref, watch } from "vue"
import * as THREE from "three"
import DTScene from "./DTScene"
import global from "../../Global"

const storedattachObjects = localStorage.getItem('attachObjects');
const attachObjects = JSON.parse(storedattachObjects);
// console.log(attachObjects);
var app;
var canvas;
var collection = []; // 存放框选模型的id
const conveyorRay = new THREE.Ray();
const delta = new THREE.Vector3();
const delta1 = new THREE.Vector3();
const delta_angle = 15;  // 滚轮旋转物体的角度
const cos_theta = Math.cos(delta_angle * Math.PI / 180);
const sin_theta = Math.sin(delta_angle * Math.PI / 180);
var downLeft = new THREE.Vector3(); // 视锥体近截面下方点
var downRight = new THREE.Vector3();
var dragFromOutside;  // 是否从外界拖入
var dragData;
var dragModel;
var dragModelByXYZ;
var dragPoint;  // 拖动开始时的拖动点
var dragPoint0;  // 新的拖动点
var endPoint = new THREE.Vector3();
var farDownLeft = new THREE.Vector3(); // 视锥体远截面
var farDownRight = new THREE.Vector3();
var farTopLeft = new THREE.Vector3();
var farTopRight = new THREE.Vector3();
var front = new THREE.Vector3();
var frustum = new THREE.Frustum(); // 视锥体
var fullscreen = false;
var helperBottomRight = new THREE.Vector2(); // 框选辅助点
var helperStartPoint = new THREE.Vector2();
var helperTopLeft = new THREE.Vector2();
var isDrag = false;  // 是否在用鼠标移动模型
var isSelect = false; // 是否在框选
const keys: any = {};  // 同一时刻按下的按键
var mouseType = [false, false, false];  // 左、中、右键是否按下
var near = new THREE.Vector3(); // 构建视锥体时存放相机的位置
const ray = new THREE.Raycaster();  // 从鼠标发出的射线检测器
var parent;
var pointLast_XYZ; 
var pointNew_XYZ;
var resizeObserver;
var selectionHelper = document.createElement( 'div' ); // 框选辅助
var startPoint = new THREE.Vector3(); 
var style;
var temp1 = new THREE.Vector3(); // 构建视锥体所用中间点
var temp2 = new THREE.Vector3();
var temp3 = new THREE.Vector3();
var tempTransform = {  // 在物体吸附到传送带之前临时存储位姿，解除吸附后恢复
  alignMode: false,
  position: new THREE.Vector3(),
  rotation: new THREE.Euler(),
};
var tempModel;
var tempOpacity;
var tmpPoint = new THREE.Vector3(); // 构建视锥体所用中间点
var topLeft = new THREE.Vector3(); // 视锥体近截面上方点
var topRight = new THREE.Vector3();
var transformControls;  // 是否使用控制器移动模型

const box = new THREE.Box3();  // 被拖动物体的包围盒
const closestPoint = new THREE.Vector3();  // 垂足
const MOVE = THREE.MOUSE.PAN;
const ROTATE = THREE.MOUSE.ROTATE;
const ZOOM = THREE.MOUSE.DOLLY;
const RIGHT = new THREE.Vector3(1, 0, 0);  // x轴朝右
const UP = new THREE.Vector3(0, 0, 1);  // z轴朝上

export default defineComponent({
  name: "DTScene",
  props: {},
  components: {},
  data() {
    resizeObserver = new ResizeObserver(() => {  // 画布大小改变时的事件
      this.resizeCanvas()
    });
    global.on("changeFullscreen", () => {  // 全屏或退出全屏
      fullscreen = !fullscreen;
      if (fullscreen) {
        parent = canvas.parentElement;
        style = canvas.style;
        canvas.style =
          "position: absolute;" +
          "top: 0px; left: 0px;" +
          "zIndex: 114514;";  // 让画布盖住其它组件
        app.appendChild(canvas);
      } else {
        canvas.style = style;
        parent.appendChild(canvas);
      }
      global.emit("changeQuitFullscreen", fullscreen);
      this.resizeCanvas();
    });
    global.on("dragModelStart", data => { dragData = data });
    global.on("dropout", () => dragModel.remove());
    return { description: null, rendered: false, }
  },
  methods: {
    alignToConveyor(dragPoint, conveyor) {
      tempModel.rotation.set(0, 0, 0);
      if (dragModel.DT.label == "WIP") tempModel.rotateOnWorldAxis(  // 旋转在制品
        RIGHT, Math.PI / 2
      );
      tempTransform.alignMode = true;
      let P = new THREE.Vector3();
      let Q = new THREE.Quaternion();
      conveyor.getWorldPosition(P);
      conveyor.getWorldQuaternion(Q);
      if(conveyor.DT.name.includes("直道")) {
        let result = RIGHT.clone();
        conveyorRay.set(P, result.applyQuaternion(Q));  // 求鼠标到传送带中轴线最近的一点
        if(dragModel.DT.name.includes("护栏")){
          let [x, y] = [tempModel.position.x, tempModel.position.y];
          if(dragModel.DT.name == "直护栏" || dragModel.DT.name == "变道护栏") {  // 仅旋转直护栏
            tempModel.rotateOnWorldAxis(  // 设置物体旋转
              UP, Math.atan(result.y / result.x) + Math.PI / 2
            );
          }
          conveyorRay.closestPointToPoint(dragPoint, closestPoint);  // 求出垂足
          tempModel.position.copy(dragPoint).sub(closestPoint);
          tempModel.position.z = 0;
          tempModel.position.normalize();
          tempModel.position.multiplyScalar(1.4);
          tempModel.position.add(closestPoint);  // 物体位移 = 垂足 + 1.4||鼠标-垂足||
          if(dragModel.DT.name != "直护栏") {  // 只改变直护栏的x和y坐标
            tempModel.position.x = x;
            tempModel.position.y = y;
          }
        }
        else if(dragModel.DT.label == "WIP") {  // 将在制品吸附到传送带中轴线上
          conveyorRay.closestPointToPoint(dragPoint, tempModel.position);  // 物体位移=垂足
          let R = new THREE.Euler();
          R.setFromQuaternion(Q);
          tempModel.rotateOnWorldAxis(UP, R.z);  // 设置物体旋转
        }
      }
      else if(conveyor.DT.name.includes("弯道")) {
        let outer;  // 物体在弯道内侧还是外侧
        let result = dragPoint.clone();  // 求鼠标到弯道圆心的位移之差
        result.sub(P);
        result.z = 0;
        outer = result.length() > 5;
        result.normalize();
        if (dragModel.DT.name == "直护栏") {  // 将直护栏贴在弯道护栏的边缘
          tempModel.rotateOnWorldAxis(UP, Math.atan(result.y / result.x));
          result.multiplyScalar(outer ? 6.4 : 3.6);
          result.add(P);
          tempModel.position.copy(result);  // 设置物体位姿
        } 
        else if(dragModel.DT.name == "弯道外侧护栏" || dragModel.DT.name == "弯道内侧护栏") {
          tempModel.position.copy(P);  // 将弯道护栏与弯道对齐
          tempModel.quaternion.copy(Q);
        }
        else {  // 将其它护栏和物体直接放在弯道上
          let [x, y] = [tempModel.position.x, tempModel.position.y];
          if(dragModel.DT.label == "WIP") {  // 在制品放在弯道中轴线上
            tempModel.rotateOnWorldAxis(
              UP, Math.atan2(result.y, result.x) + 
              (conveyor.DT.name.includes("顺时针") ? -1 : 1) * Math.PI / 2
            );
          }
          result.multiplyScalar(5);
          result.add(P);
          tempModel.position.copy(result);
          if(dragModel.DT.label != "WIP") {  // 其它物体直接放在弯道上
            tempModel.position.x = x;
            tempModel.position.y = y;
          }
        }
      }
      dragModel.rotation.copy(tempModel.rotation);
      if(dragModel.DT.label == "WIP" || dragModel.DT.name == "直护栏") {
        tempModel.position.z = 0.6 + (box.max.z - box.min.z) / 2;  // 传送带高为0.6
      }
      return tempModel.position.clone();
    },
    castRay(e) {  // 射线检测
      const mouse = new THREE.Vector2(
        e.offsetX * 2 / e.target.clientWidth - 1,
        1 - e.offsetY * 2 / e.target.clientHeight
      );
      ray.setFromCamera(mouse, this.scene.camera);
    },
    intersectObject(e, controller = true) {  // 求鼠标发出的射线与物体的交点
      this.castRay(e);  // 射线检测
      for (let intersect of ray.intersectObject(global.SCENE)) {
        let mesh = intersect.object;
        if (mesh.isTransformControlsPlane) continue;  // 忽略控制器
        if (
          mesh.DT && mesh != dragModel && mesh != tempModel ||  // 若射线检测到的物体无DT则继续往后检测
          controller && mesh.isTransformControls && !mesh.isLine  // 允许点击控制器
        ) {
          intersect.mesh = intersect.object;
          return intersect;
        }
      }
      return new THREE.Vector3(999, 999, 999)  // 若无交点
    },
    intersectPlaneH(e, P) {  // 求鼠标发出的射线与平面z=P.z的交点
      this.castRay(e);  // 射线检测
      let plane = new THREE.Plane(), result = new THREE.Vector3();
      plane.setFromNormalAndCoplanarPoint(UP, P);  // 作过点P且法向量朝上的水平平面
      ray.ray.intersectPlane(plane, result);  // 返回射线检测器与该平面的交点
      return result;
    },
    intersectPlaneV(e, P) {  // 求鼠标发出的射线与过点P且与视野正前方垂直的平面的交点
      this.castRay(e);  // 射线检测
      this.scene.camera.getWorldDirection(front);  // 求视野的正前方的方向向量
      let plane = new THREE.Plane(), result = new THREE.Vector3();
      plane.setFromNormalAndCoplanarPoint(front, P);  // 作过点P且法向量朝视野正前方的竖直平面
      ray.ray.intersectPlane(plane, result);  // 返回射线检测器与该平面的交点
      return result;
    },
    onDragByXYZ(e){
      e.preventDefault();
      if(dragModelByXYZ){
        const x = (e.offsetX/e.target.clientWidth)*2-1;
        const y = -(e.offsetY/e.target.clientHeight)*2+1;
        const stdVector = new THREE.Vector3(x,y,0.5);
        const woeldVector = stdVector.unproject(this.scene.camera);
        pointLast_XYZ = pointNew_XYZ;        
        pointNew_XYZ = woeldVector;        
        if(!pointLast_XYZ) return;
        let pointSub = pointNew_XYZ.clone().sub(pointLast_XYZ).multiplyScalar(75);
        if(keys.KeyX){
          dragModelByXYZ.position.x += pointSub.x;
        } else if(keys.KeyY){
          dragModelByXYZ.position.y += pointSub.y;
        } else if(keys.KeyZ){
          dragModelByXYZ.position.z += pointSub.z;
        }
      }
    },
    onDragenter(e) {
      let data = e.dataTransfer;
      // 隐藏拖动图像
      function findImg(DOM) {
        if (!DOM) return;
        for (let child of DOM?.children) {
          if (child.localName == "img") // {tempImg = child; return;}
            findImg(child);
        }
      }
      findImg(e.fromElement);
      data.setDragImage(document.createElement("img"), 0, 0);

      // 拖入模型
      data = dragData.data;
      let point = this.intersectObject(e).point;
      if (!point) return;  // 若拖到天空上则不创建模型
      dragFromOutside = true;
      if(dragData.type == "asset")
        dragModel = this.scene.createMeshFromAssets(data.DT, point);
      if(dragData.type == "model")
        dragModel = this.scene.createMeshFromModels(data, point);
      if(data.name) dragModel.DT.name = data.name;  // 复制自定义模型名称
      if(data.physicalID && !global.physicalIDMap[data.physicalID])  // 复制自定义模型物理实体ID
        dragModel.DT.physicalID = data.physicalID;  // 若该ID被占用则忽略

      dragModel.isDrag = true;
      dragModel.material.transparent = true;
      tempOpacity = dragModel.material.opacity;
      dragModel.material.opacity = tempOpacity / 2;
      tempModel = dragModel.clone();
      tempModel.visible = false;
      box.setFromObject(dragModel);
      let center = new THREE.Vector3();
      box.getCenter(center);  // 获取包围盒中心
      delta.copy(dragModel.position).sub(center);  // Δp = 物体坐标 - 物体的包围盒中心
    },
    onDragleave(e) {
      if (dragModel) {
        dragFromOutside = false;
        dragModel.DT.destroy();
        dragModel = null;
      }
      tempModel?.remove();
      // e.dataTransfer.setDragImage(tempImg, 0, 0);  // 隐藏拖动图像
    },
    onDragover(e) {
      e.preventDefault();
      if (dragModel && tempModel) {
        var attachPoint1, attachPoint2;
        let outrotation, inrotation, totalro;
        tempModel.position.set(0, 0, 0);  // 初始化物体位姿
        if (dragFromOutside) {  // 从外部拖入模型时将其包围盒中心移到鼠标
          let intersect = this.intersectObject(e);
          tempModel.position.copy(intersect.point);
          tempModel.position.add(delta);
          tempModel.rotation.set(0, 0, 0);  // 重置旋转
          if (dragModel.DT.label == "WIP") tempModel.rotateOnWorldAxis(  // 旋转在制品
            RIGHT, Math.PI / 2
          );
          box.setFromObject(tempModel);
          // 若被拖动物体本身不是传送带，且碰到传送带，则将物体移动到传送带中轴线上
          if (dragModel.DT.label != "conveyor" && intersect.mesh.DT.label == "conveyor") {
            this.alignToConveyor(intersect.point, intersect.mesh);
          } else {
            let box0 = new THREE.Box3().setFromObject(intersect.mesh);
            tempModel.position.z += box0.max.z - box.min.z;
            // 解除吸附时恢复物体在吸附前的旋转
            if (tempTransform.alignMode) {
              tempModel.position.copy(tempTransform.position);
              tempModel.rotation.copy(tempTransform.rotation);
              dragModel.rotation.copy(tempTransform.rotation);
            }
            tempTransform.alignMode = false;
            tempTransform.position.copy(tempModel.position);
            tempTransform.rotation.copy(tempModel.rotation);
          }
        }
        else {  // 拖动时，物体位置 = 鼠标与平面z=H的交点坐标 + Δp
          let pointc;
          if (dragModel.DT.label == "conveyor") {  // 拖入传送带时
            attachPoint1 = dragModel.getObjectByName('ap1');
          }
          if (e.shiftKey) {  // 左键+shift拖动物体以改变其高度
            dragPoint0 = dragPoint.clone();
            dragPoint0.z = this.intersectPlaneV(e, dragPoint).z;
          }
          else {  // 左键拖动物体在水平面内移动
            dragPoint0 = this.intersectPlaneH(e, dragPoint);
            if (dragModel.DT.label == "conveyor") {  // 拖动传送带时 
              attachPoint1 = dragModel.getObjectByName('ap1');
              attachPoint2 = dragModel.getObjectByName('ap2');
              let PositionAP1 = new THREE.Vector3();
              let PositionAP2 = new THREE.Vector3();
              attachPoint1.getWorldPosition(PositionAP1);  // 获取ap1在世界坐标系中的位置
              attachPoint2.getWorldPosition(PositionAP2);
              pointc = this.intersectPlaneH(e, PositionAP1);
              let minDistance1 = Infinity;
              let minDistance2 = Infinity;
              let closestAttachPoint2 = null;
              let closestAttachPoint1 = null;
              let dis1 = dragPoint0.distanceTo(PositionAP1);//鼠标到ap1的位置距离
              let dis2 = dragPoint0.distanceTo(PositionAP2);//鼠标到ap2的位置距离
              global.SCENE.traverse((child) => {  // 遍历场景中的所有对象，寻找名为'ap2'的物体
                if (child.name === 'ap2') {
                  if (child.parent === dragModel) return
                  else {
                    let childposition1 = new THREE.Vector3();
                    child.getWorldPosition(childposition1);  // 获取ap2在世界坐标系中的位置
                    let distance1 = PositionAP1.distanceTo(childposition1);
                    if (distance1 < minDistance1) { // 更新最近的ap2
                      minDistance1 = distance1;
                      closestAttachPoint2 = child;
                      const parentObject = child.parent;
                      if (distance1 < 1.5) {// 在距离小于1.5时变金色
                        attachPoint1.material.color.set('gold');
                        child.material.color.set('gold');
                      }
                      else {
                        global.SCENE.traverse((mesh) => {
                          if (mesh.name === 'ap1') mesh.material.color.set('red');
                        });
                        child.material.color.set('lime');
                      }
                      if (parentObject.DT.name.includes("顺时针弯道")) outrotation = 0
                      if (parentObject.DT.name.includes("逆时针弯道")) outrotation = Math.PI / 2
                      if (parentObject.DT.name.includes("直道")) outrotation = 0
                    }
                  }
                }
              });
              global.SCENE.traverse((child) => {  // 遍历场景中的所有对象，寻找名为'ap1'的物体
                if (child.name === 'ap1') {
                  if (child.parent === dragModel) return
                  else {
                    let childposition2 = new THREE.Vector3();
                    child.getWorldPosition(childposition2);
                    child.visible = true;
                    let distance2 = PositionAP2.distanceTo(childposition2);
                    if (distance2 < minDistance2) { // 更新最近的ap1
                      minDistance2 = distance2;
                      closestAttachPoint1 = child;
                      const parentObject = child.parent;
                      // dis1 = pointc.distanceTo(closestAttachPoint1.position);
                      if (distance2 < 1.5) {
                        // 在距离小于1.5时变金色
                        attachPoint2.material.color.set('gold');
                        child.material.color.set('gold');
                      }
                      else {
                        global.SCENE.traverse((mesh) => {  // 遍历场景中的所有对象，寻找名为'ap2'的物体
                          if (mesh.name === 'ap2') mesh.material.color.set('lime');
                        });
                        child.material.color.set('red');
                      }
                      if (parentObject.DT.name.includes("顺时针弯道")) inrotation = -Math.PI / 2
                      if (parentObject.DT.name.includes("逆时针弯道")) inrotation = - Math.PI
                      if (parentObject.DT.name.includes("直道")) inrotation = 0
                    }
                  }
                }
              });
              if (closestAttachPoint2 && minDistance1 < 1 && dis1 < 15) {//入口吸附至出口
                let newWorldPosition = new THREE.Vector3();
                closestAttachPoint2.getWorldPosition(newWorldPosition);
                let rotationChange = closestAttachPoint2.parent.rotation
                let parent = dragModel.parent;  // 将被旋转物体暂时与父物体断开关系
                let delta1 = new THREE.Vector3();
                let delta2 = new THREE.Vector3();
                global.SCENE.attach(dragModel);
                const group = new THREE.Group();
                group.position.copy(newWorldPosition);
                dragModel.add(group);
                dragModel.rotation.x = rotationChange.x;  // X轴旋转
                dragModel.rotation.y = rotationChange.y;  // Y轴旋转
                if (dragModel.DT.name.includes("直道")) inrotation = 0
                else if (dragModel.DT.name.includes("逆时针弯道")) inrotation = - Math.PI
                else if (dragModel.DT.name.includes("顺时针弯道")) inrotation = -Math.PI / 2
                totalro = dragModel.rotation.z - rotationChange.z + outrotation - inrotation
                dragModel.rotateOnWorldAxis(UP, -totalro);  // 绕z轴正方向旋转
                delta1.set(
                  dragModel.position.x - PositionAP1.x,
                  dragModel.position.y - PositionAP1.y,
                  0
                )
                delta2.set(
                  Math.cos(- totalro) * delta1.x - Math.sin(- totalro) * delta1.y,
                  Math.sin(- totalro) * delta1.x + Math.cos(- totalro) * delta1.y,
                  0
                );
                let offset1 = delta2.sub(delta1);
                group.remove(dragModel);  // 将被旋转物体从父物体中移除
                parent.attach(dragModel);  // 将被旋转物体加回原来的父物体
                let offset2 = newWorldPosition.sub(PositionAP1);// 计算从 dragModel 到 ap1 当前世界位置的偏移
                let offset = offset1.add(offset2); // 将两个偏移相加，得到最终的偏移量
                offset = dragModel.parent.worldToLocal(offset); // 将偏移转换为相对于 dragModel 父物体的局部坐标
                dragModel.position.add(offset);
                global.emit("updateProp", {action: "dragover", mesh: dragModel});  // 更新属性栏
                closestAttachPoint2 = null;
                minDistance1 = Infinity;
                global.emit("controlStart", dragModel.id);
                return
              }
              if (closestAttachPoint1 && minDistance2 < 1 && dis2 < 15) {// 出口吸附至入口
                let newWorldPosition = new THREE.Vector3();
                closestAttachPoint1.getWorldPosition(newWorldPosition);
                let rotationChange = closestAttachPoint1.parent.rotation
                let parent = dragModel.parent;  // 将被旋转物体暂时与父物体断开关系
                let delta1 = new THREE.Vector3();
                let delta2 = new THREE.Vector3();
                global.SCENE.attach(dragModel);
                const group = new THREE.Group();
                group.position.copy(newWorldPosition);
                dragModel.add(group);
                dragModel.rotation.x = rotationChange.x;  // X轴旋转
                dragModel.rotation.y = rotationChange.y;  // Y轴旋转
                if (dragModel.DT.name.includes("直道")) outrotation = 0
                else if (dragModel.DT.name.includes("逆时针弯道")) outrotation = Math.PI / 2
                else if (dragModel.DT.name.includes("顺时针弯道")) outrotation = 0
                totalro = dragModel.rotation.z - rotationChange.z - outrotation + inrotation
                dragModel.rotateOnWorldAxis(UP, -totalro);  // 绕z轴正方向旋转
                delta1.set(
                  dragModel.position.x - PositionAP2.x,
                  dragModel.position.y - PositionAP2.y,
                  0
                )
                delta2.set(
                  Math.cos(- totalro) * delta1.x - Math.sin(- totalro) * delta1.y,
                  Math.sin(- totalro) * delta1.x + Math.cos(- totalro) * delta1.y,
                  0
                );
                let offset1 = delta2.sub(delta1);
                group.remove(dragModel);  // 将被旋转物体从父物体中移除
                parent.attach(dragModel);  // 将被旋转物体加回原来的父物体
                let offset2 = newWorldPosition.sub(PositionAP2);// 计算从 dragModel 到 ap1 当前世界位置的偏移
                let offset = offset1.add(offset2); // 将两个偏移相加，得到最终的偏移量
                parent.attach(dragModel);  // 将被旋转物体加回原来的父物体
                offset = dragModel.parent.worldToLocal(offset); // 将偏移转换为相对于 dragModel 父物体的局部坐标
                dragModel.position.add(offset);
                closestAttachPoint1 = null;
                minDistance2 = Infinity;
                global.emit("controlStart", dragModel.id);
                return
              }
              //设置可见性
              global.SCENE.traverse((mesh) => {  // 遍历场景中的所有对象，寻找名为'ap2'的物体
                if (mesh.name === 'ap2') {
                  mesh.visible = true;
                  mesh.scale.set(20, 20, 20);
                }
              });
              global.SCENE.traverse((mesh) => {  // 遍历场景中的所有对象，寻找名为'ap1'的物体
                if (mesh.name === 'ap1') {
                  mesh.visible = true;
                  mesh.scale.set(20, 20, 20);
                }
              });
            }
          }
          let result;
          if (keys.KeyA && dragModel.DT.label != "conveyor") {  // 拖动非传送带类物体时，按A键对齐到传送带
            box.setFromObject(dragModel);
            this.castRay(e);
            let conveyor;
            for (let intersect of ray.intersectObject(global.SCENE)) {
              let DT = intersect.object.DT;
              if (DT?.label != "conveyor") continue;
              let box0 = new THREE.Box3().setFromObject(DT.mesh);
              if (box.intersectsBox(box0)) {  // 被拖动物体碰到传送带
                conveyor = DT.mesh;
                break;
              }
            }
            if (conveyor) {  // 找到传送带
              result = this.alignToConveyor(dragPoint0, conveyor);
            } else {
              result = dragPoint0.clone();
              result.add(delta);  // 更新模型的全局坐标
            }
          }
          else {
            // 解除吸附时恢复物体在吸附前的旋转
            if (tempTransform.alignMode) {
              tempModel.position.copy(tempTransform.position);
              tempModel.rotation.copy(tempTransform.rotation);
              dragModel.rotation.copy(tempTransform.rotation);
            }
            tempTransform.alignMode = false;
            tempTransform.position.copy(tempModel.position);
            tempTransform.rotation.copy(tempModel.rotation);
            result = dragPoint0.clone();
            result.add(delta);  // 更新模型的全局坐标
          }
          if (keys.KeyS) {  // 拖动物体时，按S键将物体z坐标吸附到地面
            box.setFromObject(dragModel);
            if (!tempTransform.alignMode) tempTransform.position.copy(delta);  // 拖动之前储存delta
            tempTransform.alignMode = true;
            result.z -= box.min.z;
            delta.z -= box.min.z;
          }
          else if (tempTransform.alignMode) {
            tempTransform.alignMode = false;
            delta.copy(tempTransform.position);  // 拖动之后释放delta
          }
          // 将模型的全局坐标转换为局部坐标
          tempModel.position.copy(dragModel.parent.worldToLocal(result));
          // 拖动时强制更新属性栏的位移和旋转
          global.emit("updateProp", { action: "dragover", mesh: dragModel });
        }
        dragModel.position.copy(tempModel.position);
      }
      else if (dragModel?.isLight) {  // 拖动光源
        e = {
          offsetX: e.offsetX + delta.dx,
          offsetY: e.offsetY + delta.dy,
          shiftKey: e.shiftKey,
          target: {
            clientWidth: e.target.clientWidth,
            clientHeight: e.target.clientHeight,
          }
        };
        if (e.shiftKey) {  // 左键+shift拖动物体以改变其高度
          dragModel.position.z = this.intersectPlaneV(e, delta).z;
        } else {  // 左键拖动物体在水平面内移动
          dragModel.position.copy(this.intersectPlaneH(e, delta));
        }
        // 拖动时强制更新属性栏的位移和旋转
        global.emit("updateProp", { action: "dragover", mesh: dragModel });
      }
    },
    onDrop(e) {
      if (dragModel) {
        dragFromOutside = dragModel.isDrag = false;
        if (tempOpacity) {
          dragModel.material.opacity = tempOpacity;
          tempOpacity = null;
        }

        let rb = dragModel.DT.rb();
        if (!rb && dragModel.DT.rigidShape) {  // 让网格跟随刚体
          dragModel.DT.createRigidBody();
          global.DTObjects.value.push(dragModel.DT);
        }
        dragModel.DT.updateRigidbodyTransform();  // 强制更新刚体位姿
        if (tempModel) {
          tempModel.clear();
          tempModel.removeFromParent();
        }
        dragModel = tempModel = null;
      }

      // 设置可见性
      global.SCENE.traverse((mesh) => {  // 遍历场景中的所有对象，寻找名为'ap2'的物体
        if (mesh.name === 'ap2') {
          mesh.visible = false;
        }
      });
      global.SCENE.traverse((mesh) => {  // 遍历场景中的所有对象，寻找名为'ap1'的物体
        if (mesh.name === 'ap1') {
          mesh.visible = false;
        }
      });

      // 更新物理实体ID映射表
      global.SCENE.DT.updatePhysicalIDMap();
    },
    onKeydown(k) {
      if (k.code == "Delete") global.emit("deleteChoices");
      else keys[k.code] = true;  // 记录按下的按键
      pointLast_XYZ = pointNew_XYZ = null;
    },
    onKeyup(k) {
      keys[k.code] = false;  // 删除按下的按键
    },
    onMousedown(e) {
      mouseType[e.button] = true;
      if (mouseType[0]) {
        if (mouseType[2]) { }  // 双击左右键则移动
        else if (global.mode == "edit") {  // 左键点击
          if (e.target.localName == "div") {
            let result = this.intersectObject(e);
            let choice = result.mesh;
            if (choice?.isTransformControls) {   // 点击控制器则忽略后文
              transformControls = true;
              return;
            }
            dragPoint = result.point;
            if (choice && !choice.DT && choice.parent.DT) {  // 点击指示箭头或吸附方块等
              choice = choice.parent;
            }
            if (choice?.DT && !choice.userData.ground && !choice.isLight) {
              global.emit("clickModel", { id: choice.id, shift: e.shiftKey });
              result.mesh.getWorldPosition(delta);
              delta.sub(result.point);  // Δp = 选中物体的全局坐标 - 物体上点击处的坐标
              dragModel = dragModelByXYZ = choice;
              dragModel.isDrag = true;
              tempModel = dragModel.clone();
              tempOpacity = dragModel.material.opacity;
              isDrag = true;
            } 
            else if(e.target.localName == "div"){
              global.emit("deselect");  // 避免点击img时取消选择
              isSelect = true;
              this.onSelectStart(e);
              startPoint.set(
                (e.offsetX/e.target.clientWidth)*2-1, 
                -(e.offsetY/e.target.clientHeight)*2+1,
                0.5
              );
            } 
          }
          else if (e.target.localName == "img") {  // 拖动灯光
            let id = parseInt(e.target.id);  // 若id为数字字符串则转换为数字
            global.emit("clickModel", { id: id, shift: e.shiftKey });
            let choice = global.SCENE.getObjectById(id);
            let rect = e.target.getBoundingClientRect();
            let P = new THREE.Vector2(
              rect.left + e.target.clientWidth / 2,
              rect.top + e.target.clientHeight / 2
            );
            let P_e = new THREE.Vector2(e.clientX, e.clientY);
            P.sub(P_e);  // Δp = 选中物体的全局坐标 - 物体上点击处的坐标
            delta.copy(choice.position);
            delta.dx = P.x;
            delta.dy = P.y;
            dragModel = choice;
            isDrag = true;
          }
        }
      }
      else if (mouseType[2]) {// 右键点击
        let pos = this.scene.camera.position;
      };
    },
    onMousemove(e) {
      if (mouseType[0]) {
        this.scene.orbitControl.mouseButtons = {
          LEFT: global.mode == "edit" ? -1 : ROTATE, MIDDLE: isDrag ? -1 : ZOOM, RIGHT: -1
        };
        if(transformControls){
          let mesh = this.scene.controller.object;
          if(mesh?.DT.name.includes("直道")){  // 不准传送带长度小于0.1
            let length = mesh.scale.x / mesh.DT.scale * 7.5;
            if(length < 0.1) mesh.scale.x = 0.1 * mesh.DT.scale / 7.5;
            mesh.DT.updateConveyorRigidbody();
          }
          else if(mesh?.DT.name == "直护栏"){  // 不准传送带长度小于0.1
            let length = mesh.scale.y / mesh.DT.scale * 7.5;
            if(length < 0.1) mesh.scale.y = 0.1 * mesh.DT.scale / 7.5;
            mesh.DT.updateGuardRail();
          }
          global.emit("updateProp", {action:"mousemove", mesh: mesh});
        }
      } else if (mouseType[2]) {
        this.scene.orbitControl.mouseButtons = {
          LEFT: -1, MIDDLE: -1, RIGHT: ROTATE
        };
      }
      if(keys.KeyX || keys.KeyY || keys.KeyZ){
        this.scene.orbitControl.enableRotate = false;
        this.scene.orbitControl.enabledPan = false;
        this.onDragByXYZ(e);
      } else {
        this.scene.orbitControl.enableRotate = true;
        this.scene.orbitControl.enabledPan = true;
      }
      if(isSelect){
        this.onSelectMove(e);
        global.emit("deselect");
        endPoint.set(
          (e.offsetX/e.target.clientWidth)*2-1, 
          -(e.offsetY/e.target.clientHeight)*2+1,
          0.5
        );
        collection = [];
        this.updateFrustum();
        this.searchChildInFrustm(frustum, global.SCENE);
        for(let i = 0; i < collection.length; i++){
          if(collection[i] != 191) global.emit("clickModel", {id: collection[i], shift: isSelect});
        }
      }
      if (isDrag) this.onDragover(e);
    },
    onMouseup(e) {
      if(this.scene.controller?.object?.DT?.label == "conveyor" 
        && transformControls && this.scene.controller.mode) {
        this.scene.controller.object?.DT.updateConveyorRigidbody();  // 改变传送带直道尺寸
      }
      mouseType[e.button] = false;
      transformControls = false;
      if (isDrag) {
        this.onDrop();
        isDrag = false;
      }
      global.emit("updateProp", {action:"mouseup"});
      if(isSelect){
        isSelect = false;
        selectionHelper.parentElement.removeChild(selectionHelper);
      }
    },
    onPointerdown(e) {
      mouseType[e.button] = true;
      if (mouseType[1]) {  // 按鼠标中键移动相机
        this.scene.orbitControl.mouseButtons = {
          LEFT: -1, MIDDLE: MOVE, RIGHT: -1
        };
      }
    },
    onSelectMove(e){  // 多选框
      selectionHelper.style.display = 'block';
      helperBottomRight.x = Math.max(helperStartPoint.x, e.clientX);
      helperBottomRight.y = Math.max(helperStartPoint.y, e.clientY);
      helperTopLeft.x = Math.min(helperStartPoint.x, e.clientX);
      helperTopLeft.y = Math.min(helperStartPoint.y, e.clientY);
      selectionHelper.style.left = helperTopLeft.x + 'px';
      selectionHelper.style.top = helperTopLeft.y + 'px';
      selectionHelper.style.width = (helperBottomRight.x - helperTopLeft.x) + 'px';
      selectionHelper.style.height = (helperBottomRight.y - helperTopLeft.y) + 'px';
    },
    onSelectStart(e){
      selectionHelper.style.display = 'none';
      this.scene.renderer.domElement.parentElement.appendChild(selectionHelper);
      selectionHelper.style.left = e.clientX + 'px';
      selectionHelper.style.top = e.clientY + 'px';
      selectionHelper.style.width = '0px';
      selectionHelper.style.height = '0px';
      helperStartPoint.x = e.clientX;
      helperStartPoint.y = e.clientY;
    },
    onWheel(e) {  // 滚轮事件
      this.scene.orbitControl.enableZoom = !dragModel;
      if (dragModel) {  // 拖动物体+滚轮=旋转物体，向前滚动为顺时针旋转，向后滚动为逆时针旋转
        let sign = e.deltaY > 0 ? 1 : -1;  // 由滚轮旋转方向获取角度变化量的符号
        this.scene.orbitControl.mouseButtons.MIDDLE = -1;
        // 设置被旋转物体的旋转角
        let parent = dragModel.parent;  // 将被旋转物体暂时与父物体断开关系
        global.SCENE.attach(dragModel);
        dragModel.rotateOnWorldAxis(UP, sign * delta_angle * Math.PI / 180);  // 绕z轴正方向旋转
        parent.attach(dragModel);  // 将被旋转物体加回原来的父物体
        // 设置被旋转物体的位移
        delta.set(  // 用滚轮旋转物体时保持物体沿过dragPoint且向上的轴移动
          cos_theta * delta.x - sign * sin_theta * delta.y,
          sign * sin_theta * delta.x + cos_theta * delta.y,
          delta.z
        );
        let result = dragPoint0.clone();
        result.add(delta);
        result = dragModel.parent.worldToLocal(result);
        dragModel.position.copy(result);
        global.emit("controlStart", dragModel.id);
        global.emit("updateProp", { action: "wheel", mesh: dragModel });
      } else {  // 滚轮放缩镜头
        this.scene.orbitControl.enableZoom = true;
      }
    },
    remove() { global.SCENE.remove(dragModel) },
    resizeCanvas() {  //让画布大小和父组件大小相适应
      const k = 10;
      let width = window.innerWidth, height = window.innerHeight;
      if (!fullscreen) {  // 直接预览
        let tab = canvas;
        for (let i = 0; i < 4; i++) { tab = tab?.parentElement; }
        width = canvas.clientWidth;
        height = tab.clientHeight - tab.children[0].clientHeight - 4;
      }  // 否则全屏预览
      let ratio = width / height;
      this.scene.cssRenderer.setSize(width, height);
      this.scene.renderer.setPixelRatio(ratio);
      this.scene.renderer.setSize(width, height);
      // 调整相机的分辨率
      this.scene.cameraOrtho.left = -k * ratio;
      this.scene.cameraOrtho.right = k * ratio;
      this.scene.cameraOrtho.top = k;
      this.scene.cameraOrtho.bottom = -k;
      this.scene.cameraPersp.aspect = ratio;
      this.scene.cameraPersp.updateProjectionMatrix();
      global.emit("updateEdgeGlow", { width: width, height: height });
    },
    searchChildInFrustm(frustum, object) {
      if (object.DT && object.isMesh) {
        const meshBox = new THREE.Box3().setFromObject(object);
        if (frustum.intersectsBox(meshBox)) {
          collection.push(object.DT.id);
        }
      }
      if (object.children.length > 0) {
        for (let j = 0; j < object.children.length; j++) {
          this.searchChildInFrustm(frustum, object.children[j]);
        }
      }
    },
    setControl(key, action) {  // 设置快捷键（左键、中间、右键：平移、旋转、放缩）
      var map = {
        "NONE": -1,  // 无
        "PAN": THREE.MOUSE.PAN,  // 平移
        "ROTATE": THREE.MOUSE.ROTATE,  // 旋转
        "DOLLY": THREE.MOUSE.DOLLY,  // 放缩
      }
      let act = map[action];
      let button = this.scene.orbitControl.mouseButtons;
      if (key == "LEFT") button.LEFT = act;  // 左键
      else if (key == "MIDDLE") button.MIDDLE = act;  // 中键
      else if (key == "RIGHT") button.RIGHT = act;  // 右键
    },
    updateFrustum(){
      if(startPoint.x === endPoint.x){
        endPoint.x += Number.EPSILON;
      }
      if(startPoint.y === endPoint.y){
        endPoint.x += Number.EPSILON;
      }
      this.scene.camera.updateProjectionMatrix();
      this.scene.camera.updateMatrixWorld();
      if(this.scene.camera.isPerspectiveCamera){
        tmpPoint.copy(startPoint);
        tmpPoint.x = Math.min(startPoint.x, endPoint.x);
        tmpPoint.y = Math.max(startPoint.y, endPoint.y);
        endPoint.x = Math.max(startPoint.x, endPoint.x);
        endPoint.y = Math.min(startPoint.y, endPoint.y);     
        near.setFromMatrixPosition(this.scene.camera.matrixWorld);     
        topLeft.copy(tmpPoint);
        topRight.set(endPoint.x, tmpPoint.y, 0);
        downRight.copy(endPoint);
        downLeft.set(tmpPoint.x, endPoint.y, 0);
        topLeft.unproject(this.scene.camera);
        topRight.unproject(this.scene.camera);
        downRight.unproject(this.scene.camera);
        downLeft.unproject(this.scene.camera);
        temp1.copy(topLeft).sub(near);
        temp2.copy(topRight).sub(near);
        temp3.copy(downRight).sub(near);
        temp1.normalize();
        temp2.normalize();
        temp3.normalize();
        temp1.multiplyScalar(Number.MAX_VALUE);
        temp2.multiplyScalar(Number.MAX_VALUE);
        temp3.multiplyScalar(Number.MAX_VALUE);
        temp1.add(near);
        temp2.add(near);
        temp3.add(near);
        frustum.planes[0].setFromCoplanarPoints(near, topLeft, topRight);
        frustum.planes[1].setFromCoplanarPoints(near, topRight, downRight);
        frustum.planes[2].setFromCoplanarPoints(downRight, downLeft, near);
        frustum.planes[3].setFromCoplanarPoints(downLeft, topLeft, near);
        frustum.planes[4].setFromCoplanarPoints(topRight, downRight, downLeft);
        frustum.planes[5].setFromCoplanarPoints(temp3, temp2, temp1);
        frustum.planes[5].normal.multiplyScalar(-1);
      } else if(this.scene.camera.isOrthographicCamera){
        const left = Math.min(startPoint.x, endPoint.x);
        const top = Math.max(startPoint.y, endPoint.y);
        const right = Math.max(startPoint.x, endPoint.x);
        const down = Math.min(startPoint.y, endPoint.y);
        topLeft.set(left, top, -1);
        topRight.set(right, top, -1);
        downRight.set(right, down, -1);
        downLeft.set(left, down, -1);
        farTopLeft.set(left, top, 1);
        farTopRight.set(right, top, 1);
        farDownRight.set(right, down, 1);
        farDownLeft.set(left, down, 1);
        topLeft.unproject( this.scene.camera );
        topRight.unproject( this.scene.camera );
        downRight.unproject( this.scene.camera );
        downLeft.unproject( this.scene.camera );
        farTopLeft.unproject( this.scene.camera );
        farTopRight.unproject( this.scene.camera );
        farDownRight.unproject( this.scene.camera );
        farDownLeft.unproject( this.scene.camera );
        frustum.planes[0].setFromCoplanarPoints(topLeft, farTopLeft, farTopRight );
        frustum.planes[1].setFromCoplanarPoints(topRight, farTopRight, farDownRight );
        frustum.planes[2].setFromCoplanarPoints(farDownRight, farDownLeft, downLeft );
        frustum.planes[3].setFromCoplanarPoints(farDownLeft, farTopLeft, topLeft );
        frustum.planes[4].setFromCoplanarPoints(topRight, downRight, downLeft );
        frustum.planes[5].setFromCoplanarPoints(farDownRight, farTopRight, farTopLeft );
        frustum.planes[5].normal.multiplyScalar(-1);
      };
    }
  },
  mounted() {
    app = document.getElementById("app");
    canvas = document.getElementById("canvas");
    this.scene = new DTScene(canvas);
    this.scene.init();
    this.rendered = true;
    this.resizeCanvas();
    resizeObserver.observe(canvas.parentElement.parentElement.parentElement);
    selectionHelper.classList.add('selectBox');
    selectionHelper.style.pointerEvents = 'none';
    canvas.addEventListener("keydown", k => {  // 全屏模式下按ESC退出
      if (k.code == "Escape" && fullscreen) {
        global.emit("changeFullscreen");
      }
    });
  },
});