import mitt from "mitt"
import { ref } from 'vue'
import * as THREE from 'three'
const MITT = mitt();  // 组件间通信函数

// 该文件用于存储全局变量、函数和组件间的通信
// 全局参数和自定义方法如下
export default {  // 导出所有数据
    camera: null,
    DTObjects: ref([]),
    layers: [],  // 当前场景的图层
    loadedRobots: {},
    mesh2rb: {},  // mesh2rb为mesh的uuid到刚体的映射表，用于防止mesh和rb之间循环引用
    mode: "edit",  // 编辑模式（edit）或浏览模式（view）
    physicalIDMap: {},  // 物理实体ID到物体的映射关系
    physicsWorld: null,
    rb2mesh: {},  // rb2mesh为刚体的handle到网格的映射表，用于防止mesh和rb之间循环引用
    SCENE: new THREE.Scene(),
    // MITT库的方法，其中emit为发送消息，on为接收消息
    emit: MITT.emit,
    on: MITT.on,
};