import mitt from "mitt"
// 该文件用于存储全局变量或方法
const MITT = mitt();  // 组件间通信函数
var camera;
var DTScene = {};  // 当前场景的DT对象
var layers = [];  // 当前场景的图层
var mode = "edit";  // 编辑模式（edit）或浏览模式（view）
var functions = {  // 自定义函数
    camera: () => camera,
    DTScene: () => DTScene,
    emit: null,  // MITT库的发送消息方法
    layers: () => layers,
    mode: () => mode,
    on: null,  // MITT库的接收消息方法
    setCamera: (x) => {camera = x},
    setDTScene: (x) => {DTScene = x},
    setMode: (newMode) => {mode = newMode},
    updateLayers: (x) => {layers = x},
};
// 导出所有函数
for(let f in MITT) functions[f] = MITT[f];
export default functions;