import { Box3, Frustum, Vector3 } from "three";
import { ref } from "vue";

const tmpPoint = new Vector3();

const near = new Vector3();
const topLeft = new Vector3();
const topRight = new Vector3();
const downRight = new Vector3();
const downLeft = new Vector3();

const farTopLeft = new Vector3();
const farTopRight = new Vector3();
const farDownRight = new Vector3();
const farDownLeft = new Vector3();

const temp1 = new Vector3();
const temp2 = new Vector3();
const temp3 = new Vector3();

export class SelectionBoxFixed {
  camera;
  collection = ref([]); // 存放框选模型的id
  collectionMesh = ref([]); // 存放框选模型
  deep = Number.MAX_VALUE;
  endPoint = new Vector3();
  frustum = new Frustum();
  groundId; // 地面模型的id
  mainObject; // 框选后选中的模型
  positionDiff = []; // 存放其他模型相对于被选中模型的世界位置差值
  requestId;
  scene;
  startPoint = new Vector3();

  constructor(camera, scene) {
    this.camera = camera;
    this.scene = scene;
    for (let i = 0; i < this.scene.children.length; i++) {
      const child = this.scene.children[i];
      if (child.DT?.title === "(Mesh) 地面") {
        this.groundId = child.id;
        break;
      }
    }
  }

  initialStatus(mesh) { // 控制器附着模型mesh
    this.reset();
    this.mainObject = mesh;
    const mainWorldPosition = new Vector3();
    mesh.getWorldPosition(mainWorldPosition);
    for (let i = 0; i < this.collection.value.length; i++) {
      const worldPosition = new Vector3();
      this.collectionMesh.value[i].getWorldPosition(worldPosition);
      this.positionDiff.push(worldPosition.sub(mainWorldPosition));
    }
    this.updateStatus();
  }

  reset() {
    this.mainObject = null;
    this.positionDiff = [];
    if (this.requestId) {  // 终止requestAnimationFrame
      cancelAnimationFrame(this.requestId);
      this.requestId = null;
    }
  }

  searchChildInFrustum(object) {
    if (object.isMesh && object.id != this.groundId) {
      const meshBox = new Box3().copy(object.geometry.boundingBox).applyMatrix4(object.matrixWorld);
      if (this.frustum.intersectsBox(meshBox)) {
        if (object.parent.type != "Scene") {
          let parent = object.parent;
          while (parent.parent.type != "Scene") {
            parent = parent.parent;
          }
          if (!this.collection.value.includes(parent.id)) {
            this.collection.value.push(parent.id);
            this.collectionMesh.value.push(parent);
          }
        } else {
          this.collection.value.push(object.id);
          this.collectionMesh.value.push(object);
        }
      }
    }
    for (let j = 0; j < object.children.length; j++) {
      if (object.children[j].DT) {
        this.searchChildInFrustum(object.children[j]);
      }
    }
  }

  updateFrustum(startPoint, endPoint) {  // 更新视锥体
    startPoint = startPoint || this.startPoint;
    endPoint = endPoint || this.endPoint;

    if (startPoint.x === endPoint.x) {
      endPoint.x += Number.EPSILON;
    }

    if (startPoint.y === endPoint.y) {
      endPoint.y += Number.EPSILON;
    }

    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();

    if (this.camera.isPerspectiveCamera) {
      tmpPoint.copy(startPoint);
      tmpPoint.x = Math.min(startPoint.x, endPoint.x);
      tmpPoint.y = Math.max(startPoint.y, endPoint.y);
      endPoint.x = Math.max(startPoint.x, endPoint.x);
      endPoint.y = Math.min(startPoint.y, endPoint.y);

      near.setFromMatrixPosition(this.camera.matrixWorld);
      topLeft.copy(tmpPoint);
      topRight.set(endPoint.x, tmpPoint.y, 0);
      downRight.copy(endPoint);
      downLeft.set(tmpPoint.x, endPoint.y, 0);

      topLeft.unproject(this.camera);
      topRight.unproject(this.camera);
      downRight.unproject(this.camera);
      downLeft.unproject(this.camera);

      temp1.copy(topLeft).sub(near);
      temp2.copy(topRight).sub(near);
      temp3.copy(downRight).sub(near);
      temp1.normalize();
      temp2.normalize();
      temp3.normalize();

      temp1.multiplyScalar(this.deep);
      temp2.multiplyScalar(this.deep);
      temp3.multiplyScalar(this.deep);
      temp1.add(near);
      temp2.add(near);
      temp3.add(near);

      const planes = this.frustum.planes;

      planes[0].setFromCoplanarPoints(near, topLeft, topRight);
      planes[1].setFromCoplanarPoints(near, topRight, downRight);
      planes[2].setFromCoplanarPoints(downRight, downLeft, near);
      planes[3].setFromCoplanarPoints(downLeft, topLeft, near);
      planes[4].setFromCoplanarPoints(topRight, downRight, downLeft);
      planes[5].setFromCoplanarPoints(temp3, temp2, temp1);
      planes[5].normal.multiplyScalar(-1);
    } else if (this.camera.isOrthographicCamera) {
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

      topLeft.unproject(this.camera);
      topRight.unproject(this.camera);
      downRight.unproject(this.camera);
      downLeft.unproject(this.camera);

      farTopLeft.unproject(this.camera);
      farTopRight.unproject(this.camera);
      farDownRight.unproject(this.camera);
      farDownLeft.unproject(this.camera);

      const planes = this.frustum.planes;

      planes[0].setFromCoplanarPoints(topLeft, farTopLeft, farTopRight);
      planes[1].setFromCoplanarPoints(topRight, farTopRight, farDownRight);
      planes[2].setFromCoplanarPoints(farDownRight, farDownLeft, downLeft);
      planes[3].setFromCoplanarPoints(farDownLeft, farTopLeft, topLeft);
      planes[4].setFromCoplanarPoints(topRight, downRight, downLeft);
      planes[5].setFromCoplanarPoints(farDownRight, farTopRight, farTopLeft);
      planes[5].normal.multiplyScalar(-1);
    }
  }

  updateStatus = () => {
    this.requestId = requestAnimationFrame(this.updateStatus);
    const worldPosition = new Vector3();
    this.mainObject.getWorldPosition(worldPosition);
    for (let i = 0; i < this.collection.value.length; i++) {
      let targetPosition = worldPosition.clone().add(this.positionDiff[i]);
      const parent = this.scene.DT.findDTObjectById(this.collection.value[i]).mesh.parent
      if (!parent.isScene) parent.worldToLocal(targetPosition);
      this.collectionMesh.value[i].position.copy(targetPosition);
    }
  }
}
