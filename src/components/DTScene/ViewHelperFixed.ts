import {
    BackSide,
    BufferAttribute,
    BufferGeometry,
    CanvasTexture,
    Clock,
    Color,
    Euler,
    LineBasicMaterial,
    LineSegments,
    Mesh,
    MeshBasicMaterial,
    Object3D,
    OrthographicCamera,
    Quaternion,
    Raycaster,
    RepeatWrapping,
    SphereGeometry,
    Sprite,
    SpriteMaterial,
    Vector2,
    Vector3,
    Vector4
} from 'three';

//表示不同轴方向的索引
const [POS_X, POS_Y, POS_Z, NEG_X, NEG_Y, NEG_Z] = Array(6)
    .fill(0)
    .map((_, i) => i);

//轴颜色
const axesColors = [
    new Color(0xff3653),
    new Color(0x8adb00),
    new Color(0x2c8fff),
];

const clock = new Clock();//获取render方法的时间差
const dim = 128;//视图组件宽度和高度尺寸
const dummy = new Object3D();//辅助对象
const euler = new Euler();//记录初始旋转角度
const mouse = new Vector2();//归一化设备坐标
const mouseAngle = new Vector2();//鼠标移动的像素值对应的角度变化
const mouseStart = new Vector2();//鼠标点击时初始坐标
const point = new Vector3();//用于根据相机的方向调整坐标轴箭头的透明度
const q1 = new Quaternion();//记录焦点位置看向当前相机位置的四元数
const q2 = new Quaternion();//记录焦点位置看向目标位置的四元数
const raycaster = new Raycaster();
const targetPosition = new Vector3();//目标位置
const targetQuaternion = new Quaternion();//目标四元数
const turnRate = 2 * Math.PI;//旋转速度
let radius = 0;//记录相机到目标点的距离

class ViewHelper extends Object3D {
    dim = 128;
    point = new Vector3();
    constructor(camera, renderer, placement = "bottom-right", size = 128) {

        super();

        //类型标识符
        this.isViewHelper = true;

        this.camera = camera;
        this.renderer = renderer;
        this.domElement = renderer.domElement;

        //标识是否正在进行动画
        this.animating = false;
        //拖拽标识
        this.dragging = false;

        //目标点，orbitcontrols的目标点
        this.target = new Vector3();
        //存储渲染器的视口信息，定义了渲染输出在画布上的位置和大小
        this.viewport = new Vector4();

        //背景球体
        this.backgroundSphere = getBackgroundSphere();
        //坐标轴线条
        this.axesLines = getAxesLines();
        //坐标轴箭头
        this.spritePoints = getAxesSpritePoints();
        this.add(this.backgroundSphere, this.axesLines, ...this.spritePoints);

        //正交投影，射线检测，渲染坐标轴、箭头，
        this.orthoCamera = new OrthographicCamera(-1.8, 1.8, 1.8, -1.8, 0, 4);
        this.orthoCamera.position.set(0, 0, 2);

        //DOM容器，用于挂载显示辅助视图
        this.domContainer = getDomContainer(placement, size);
        //This may cause confusion if the parent isn't the body and doesn't have a `position:relative`
        this.domElement.parentElement.appendChild(this.domContainer);

        //获取domContainer的位置和尺寸信息
        this.domRect = this.domContainer.getBoundingClientRect();

        //监听事件
        this.startListening();

        //定义监听器对象，当相机控制变化时，确保辅助试图与相机方向保持一致
        this.controlsChangeEvent = { listener: () => this.updateOrientation() };

        //更新viewhelper的各种状态和属性
        this.update();
        //更新viewhelper的朝向
        this.updateOrientation();

        //渲染viewhelper
        this.render = function () {
            const delta = clock.getDelta();//获取自上一帧以来经过的时间
            if (this.animating) this.animate(delta);//动画更新逻辑

            this.updateOrientation();

            this.point.set(0, 0, 1);
            this.point.applyQuaternion(this.camera.quaternion);

            this.domRect = this.domContainer.getBoundingClientRect();

            //计算视口位置
            const x = this.domElement.offsetWidth - this.dim;

            //保存并修改渲染器设置
            const autoClear = this.renderer.autoClear;
            //禁用自动清除，以便在同一帧画面中多次渲染不同的场景
            this.renderer.autoClear = false;
            //清除深度缓冲区，确保视图助手不会被其他渲染内容遮挡
            this.renderer.clearDepth();

            //保存当前渲染器的视口设置
            this.renderer.getViewport(this.viewport);
            //设置渲染器的视口区域，视口默认从左下角开始，且原点位于canvas左下角
            this.renderer.setViewport(x, 0, this.dim, this.dim);

            //渲染视图助手
            this.renderer.render(this, this.orthoCamera);

            //恢复渲染器设置
            this.renderer.setViewport(this.viewport);
            this.renderer.autoClear = autoClear;
        }

        //设置控制器
        this.setControls = function (controls) {
            //移除现有控制器的事件监听器
            if (this.controls) {
                this.controls.removeEventListener(
                    "change",
                    this.controlsChangeEvent.listener
                );
                this.target = new Vector3();
            }

            if (!controls) return;

            this.controls = controls;
            controls.addEventListener("change", this.controlsChangeEvent.listener);
        }
    }

    startListening() {
        this.domContainer.onpointerdown = (e) => this.onPointerDown(e);
        this.domContainer.onpointermove = (e) => this.onPointerMove(e);
        this.domContainer.onpointerleave = () => this.onPointerLeave();
    }

    onPointerDown(e) {
        //拖拽移动
        const drag = (e) => {
            if (!this.dragging && isClick(e, mouseStart)) return;
            if (!this.dragging) {
                resetSprites(this.spritePoints);
                this.dragging = true;
            }

            //鼠标移动的像素距离转换为归一化值，再转换为角度变化
            mouseAngle
                .set(e.clientX, e.clientY)
                .sub(mouseStart)
                .multiplyScalar((1 / this.domRect.width) * Math.PI);

            //更新旋转角度
            this.rotation.x = clamp(
                rotationStart.x + mouseAngle.y,
                Math.PI / -1 + 0.001,
                0 - 0.001
            );
            this.rotation.z = rotationStart.z + mouseAngle.x;

            this.updateMatrixWorld();

            //更新相机位置和方向
            q1.copy(this.quaternion).invert();

            this.camera.position
                .set(0, 0, 1)
                .applyQuaternion(q1)
                .multiplyScalar(radius)
                .add(this.target);

            this.camera.rotation.setFromQuaternion(q1);

            //更新视图方向
            this.updateOrientation(false);
        }
        //结束拖拽
        const endDrag = () => {
            document.removeEventListener("pointermove", drag, false);
            document.removeEventListener("pointerup", endDrag, false);

            if (!this.dragging) {
                this.handleClick(e);
                return;
            }

            this.dragging = false;
        };

        //ViewHelper的DOM容器覆盖Three.js场景的渲染区域，导致点击事件和拖拽事件被ViewHelper捕获，而不是传递给Three.js场景
        //防止事件冒泡，事件冒泡：事件从出发的元素开始，沿着DOM树向上传播，直到被根节点捕获。
        e.stopPropagation();

        if (this.animating === true) return;
        e.preventDefault();//阻止浏览器默认事件行为

        mouseStart.set(e.clientX, e.clientY);
        const rotationStart = euler.copy(this.rotation);//复制当前旋转角度

        setRadius(this.camera, this.target);

        document.addEventListener("pointermove", drag, false);
        document.addEventListener("pointerup", endDrag, false);
    }

    onPointerMove(e) {
        if (this.dragging) return;
        this.backgroundSphere.material.opacity = 0.2;
        this.handleHover(e);
    }

    onPointerLeave() {
        if (this.dragging) return;
        this.backgroundSphere.material.opacity = 0;
        resetSprites(this.spritePoints);
        this.domContainer.stylecursor = "";
    }

    //点击事件
    handleClick(e) {
        const object = getIntersectionObject(
            e,
            this.domRect,
            this.orthoCamera,
            this.spritePoints
        );

        if (!object) return;

        this.setOrientation(object.userData.type);
    }

    //鼠标移动事件
    handleHover(e) {
        const object = getIntersectionObject(
            e,
            this.domRect,
            this.orthoCamera,
            this.spritePoints
        );

        resetSprites(this.spritePoints);

        if (!object) {
            this.domContainer.stylecursor = "";
        } else {
            object.material.map.offset.x = 0.5;
            object.scale.multiplyScalar(1.2);
            this.domContainer.stylecursor = "pointer";
        }
    }

    //更新viewhelper的朝向，确保与相机方向保持一致
    updateOrientation(fromCamera = true) {
        if (fromCamera) {
            this.quaternion.copy(this.camera.quaternion).invert();
            this.updateMatrixWorld();
        }

        updateSpritesOpacity(this.spritePoints, this.camera);
    }

    //更新viewhelper的各种状态和属性
    update() {
        this.domRect = this.domContainer.getBoundingClientRect();
        setRadius(this.camera, this.target);
        this.renderer.getViewport(this.viewport);

        this.updateOrientation();
    }

    //通过插值动画逐步调整相机的位置和方向
    animate(delta) {
        //计算动画步长
        const step = delta * turnRate;

        //通过球面线性插值（slerp）动画化位置变化，并在单位球面上进行缩放

        //更新相机位置
        q1.rotateTowards(q2, step);
        this.camera.position
            .set(0, 0, 1)
            .applyQuaternion(q1)
            .multiplyScalar(radius)
            .add(this.target);

        //更新相机方向
        this.camera.quaternion.rotateTowards(targetQuaternion, step);

        this.updateOrientation();

        //检查动画是否完成
        if (this.camera.quaternion.angleTo(targetQuaternion) === 0) {
            this.animating = false;
            //强制对齐
            this.camera.quaternion.copy(targetQuaternion);
            this.camera.position.copy(targetPosition);
        }
    }

    //设置新的视角方向，并启动动画
    setOrientation(orientation) {
        prepareAnimationData(this.camera, this.target, orientation);
        this.animating = true;
    }

    //释放资源
    dispose() {
        this.axesLines.geometry.dispose();
        this.axesLines.material.dispose();

        this.backgroundSphere.geometry.dispose();
        this.backgroundSphere.material.dispose();

        this.spritePoints.forEach((sprite) => {
            sprite.material.map.dispose();
            sprite.material.dispose();
        });

        this.domContainer.remove();

        if (this.controls)
            this.controls.removeEventListener(
                "change",
                this.controlsChangeEvent.listener
            );
    }
}

//获取dom容器
function getDomContainer(placement, size) {
    const div = document.createElement("div");
    const style = div.style;

    style.height = `${size}px`;
    style.width = `${size}px`;
    style.borderRadius = "100%";
    style.position = "absolute";

    const [y, x] = placement.split("-");

    style.transform = "";
    style.left = x === "left" ? "0" : x === "center" ? "50%" : "";
    style.right = x === "right" ? "0" : "";
    style.transform += x === "center" ? "translateX(-50%)" : "";
    style.top = y === "top" ? "0" : y === "bottom" ? "" : "50%";
    style.bottom = y === "bottom" ? "0" : "";
    style.transform += y === "center" ? "translateY(-50%)" : "";

    return div;
}

//获取坐标轴线条
function getAxesLines() {
    const distance = 0.9;
    const position = Array(3)
        .fill(0)
        .map((_, i) => [
            !i ? distance : 0,
            i === 1 ? distance : 0,
            i === 2 ? distance : 0,
            0,
            0,
            0,
        ])
        .flat();
    const color = Array(6)
        .fill(0)
        .map((_, i) =>
            i < 2
                ? axesColors[0].toArray()
                : i < 4
                    ? axesColors[1].toArray()
                    : axesColors[2].toArray()
        )
        .flat();

    const geometry = new BufferGeometry();
    geometry.setAttribute(
        "position",
        new BufferAttribute(new Float32Array(position), 3)
    );
    geometry.setAttribute(
        "color",
        new BufferAttribute(new Float32Array(color), 3)
    );

    return new LineSegments(
        geometry,
        new LineBasicMaterial({
            linewidth: 3,
            vertexColors: true,
        })
    );
}

//获取背景球体
function getBackgroundSphere() {
    const geometry = new SphereGeometry(1.6);
    const sphere = new Mesh(
        geometry,
        new MeshBasicMaterial({
            color: 0x000000,
            side: BackSide,
            transparent: true,
            opacity: 0,
            depthTest: false,
        })
    );

    return sphere;
}

//获取坐标轴箭头
function getAxesSpritePoints() {
    const axes = ["x", "y", "z"];
    return Array(6)
        .fill(0)
        .map((_, i) => {
            const isPositive = i < 3;
            const sign = isPositive ? "+" : "-";
            const axis = axes[i % 3];
            const color = axesColors[i % 3];

            const sprite = new Sprite(
                getSpriteMaterial(color, isPositive ? axis : null)
            );
            sprite.userData.type = `${sign}${axis}`;
            sprite.scale.setScalar(isPositive ? 0.6 : 0.4);
            sprite.position[axis] = isPositive ? 1.2 : -1.2;
            sprite.renderOrder = 1;
            return sprite;
        });
}

//获取箭头材质
function getSpriteMaterial(color, text = null) {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 64;

    const context = canvas.getContext("2d");
    context.beginPath();
    context.arc(32, 32, 32, 0, 2 * Math.PI);
    context.closePath();
    context.fillStyle = color.getStyle();
    context.fill();

    context.beginPath();
    context.arc(96, 32, 32, 0, 2 * Math.PI);
    context.closePath();
    context.fillStyle = "#FFF";
    context.fill();

    if (text !== null) {
        context.font = "bold 48px Arial";
        context.textAlign = "center";
        context.fillStyle = "#000";
        context.fillText(text.toUpperCase(), 32, 48);
        context.fillText(text.toUpperCase(), 96, 48);
    }

    const texture = new CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = RepeatWrapping;
    texture.repeat.x = 0.5;

    return new SpriteMaterial({
        map: texture,
        toneMapped: false,
        transparent: true,
    });
}

//准备动画数据
function prepareAnimationData(camera, focusPoint, axis) {
    switch (axis) {
        case "+x":
            targetPosition.set(1, 0, 0);
            targetQuaternion.setFromEuler(new Euler(Math.PI * 0.5, Math.PI * 0.5, 0));
            break;

        case "+y":
            targetPosition.set(0, 1, 0);
            targetQuaternion.setFromEuler(new Euler(Math.PI * 0.5, Math.PI, 0));
            break;

        case "+z":
            targetPosition.set(0, 0, 1);
            targetQuaternion.setFromEuler(new Euler());
            break;

        case "-x":
            targetPosition.set(-1, 0, 0);
            targetQuaternion.setFromEuler(new Euler(Math.PI * 0.5, -Math.PI * 0.5, 0));
            break;

        case "-y":
            targetPosition.set(0, -1, 0);
            targetQuaternion.setFromEuler(new Euler(Math.PI * 0.5, 0, 0));
            break;

        case "-z":
            targetPosition.set(0, 0, -1);
            targetQuaternion.setFromEuler(new Euler(0, Math.PI, 0));
            break;

        default:
            console.error("ViewHelper: Invalid axis.");
    }

    setRadius(camera, focusPoint);
    prepareQuaternions(camera, focusPoint);
}

//计算相机到目标点的距离，并赋值给radius
function setRadius(camera, focusPoint) {
    radius = camera.position.distanceTo(focusPoint);
}

//计算相机到目标点的四元数，并赋值给targetQuaternion
function prepareQuaternions(camera, focusPoint) {
    targetPosition.multiplyScalar(radius).add(focusPoint);

    dummy.position.copy(focusPoint);

    dummy.lookAt(camera.position);
    q1.copy(dummy.quaternion);

    dummy.lookAt(targetPosition);
    q2.copy(dummy.quaternion);
}

//将鼠标或触摸事件的屏幕坐标转换为标准化设备坐标，并设置Raycaster进行射线检测
function updatePointer(e, domRect, orthoCamera) {
    mouse.x = ((e.clientX - domRect.left) / domRect.width) * 2 - 1;
    mouse.y = -((e.clientY - domRect.top) / domRect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, orthoCamera);
}

//判断是否为点击事件
function isClick(e, startCoords, threshold = 10) {
    return (
        Math.abs(e.clientX - startCoords.x) < threshold &&
        Math.abs(e.clientY - startCoords.y) < threshold
    );
}

//获取与相机和目标点相交的物体
function getIntersectionObject(e, domRect, orthoCamera, intersectionObjects) {
    updatePointer(e, domRect, orthoCamera);

    const intersects = raycaster.intersectObjects(intersectionObjects);

    if (!intersects.length) return null;
    return intersects[0].object;
}

//重置所有轴箭头的缩放和偏移
function resetSprites(sprites) {
    let i = sprites.length;
    while (i--) {
        const scale = i < 3 ? 0.6 : 0.4;
        sprites[i].scale.set(scale, scale, scale);
        sprites[i].material.map.offset.x = 1;
    }
}

//根据相机方向调整坐标轴箭头的透明度
function updateSpritesOpacity(sprites, camera) {
    point.set(0, 0, 1);
    point.applyQuaternion(camera.quaternion);

    if (point.x >= 0) {
        sprites[POS_X].material.opacity = 1;
        sprites[NEG_X].material.opacity = 0.5;
    } else {
        sprites[POS_X].material.opacity = 0.5;
        sprites[NEG_X].material.opacity = 1;
    }

    if (point.y >= 0) {
        sprites[POS_Y].material.opacity = 1;
        sprites[NEG_Y].material.opacity = 0.5;
    } else {
        sprites[POS_Y].material.opacity = 0.5;
        sprites[NEG_Y].material.opacity = 1;
    }

    if (point.z >= 0) {
        sprites[POS_Z].material.opacity = 1;
        sprites[NEG_Z].material.opacity = 0.5;
    } else {
        sprites[POS_Z].material.opacity = 0.5;
        sprites[NEG_Z].material.opacity = 1;
    }
}

function clamp(num, min, max) {
    return Math.min(Math.max(num, min), max);
}

export { ViewHelper };