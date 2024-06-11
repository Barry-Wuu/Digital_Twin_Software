import mitt from "mitt"
import { ref } from 'vue'
import * as THREE from 'three'

// 该文件用于存储全局变量、函数和组件间的通信
const MITT = mitt();  // 组件间通信函数
var camera;
const DTObjects = ref([]);
var layers = [];  // 当前场景的图层
var mode = "edit";  // 编辑模式（edit）或浏览模式（view）
var physicsWorld;
/* 
    rb_mesh为碰撞体到刚体和网格的映射表
    因为碰撞检测时碰撞体和刚体不同，而两者ptr相同，所以需要用ptr在此表中查找刚体和网格
*/
let rb_mesh = {};
const SCENE = new THREE.Scene();
// 自定义函数
var functions = {
    camera: () => camera,
    clear_rb_mesh: () => {rb_mesh = {}},  // 清空rb_mesh
    DTObjects: () => DTObjects,
    emit: null,  // MITT库的发送消息方法
    layers: () => layers,
    mode: () => mode,
    on: null,  // MITT库的接收消息方法
    physicsWorld: () => physicsWorld,
    rb_mesh: () => rb_mesh,
    SCENE: () => SCENE,
    setCamera: x => {camera = x},
    setMode: x => {mode = x},
    setPhysicsWorld: x => {physicsWorld = x},
    updateLayers: x => {layers = x},
};
// 导出所有函数
for(let f in MITT) functions[f] = MITT[f];
export default functions;