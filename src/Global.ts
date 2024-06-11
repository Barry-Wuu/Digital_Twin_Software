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
    mode: "edit",  // 编辑模式（edit）或浏览模式（view）
    physicalIDMap: {},  // 物理实体ID到物体的映射关系
    physicsWorld: null,
    rb_mesh: {},
    /* 
        rb_mesh为碰撞体到刚体和网格的映射表
        因为碰撞检测时碰撞体和刚体不同，而两者ptr相同，所以需要用ptr在此表中查找刚体和网格
    */
    SCENE: new THREE.Scene(),
    updatePhysicalIDMap(){  // 更新物理实体ID到物体的映射关系
        this.physicalIDMap = {};
        for(let DT of this.DTObjects.value){
            this.physicalIDMap[DT.physicalID] = DT;
        }
        console.log(this.physicalIDMap)
    },
    // MITT库的方法，其中emit为发送消息，on为接收消息
    emit: MITT.emit,
    on: MITT.on,
};