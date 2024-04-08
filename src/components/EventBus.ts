import mitt from 'mitt'
// 组件间通信函数
const MITT = mitt();
// 全局变量
var DTScene = {};  
// 自定义函数
var functions = {
    emit: null,
    getDTScene: function() {return DTScene},
    on: null,
    setDTScene: function(x) {DTScene = x},
};
for(let f in MITT) functions[f] = MITT[f];
// 导出所有函数
export default functions;