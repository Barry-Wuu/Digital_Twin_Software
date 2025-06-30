<script setup lang="ts">
import { onMounted, ref } from "vue"
import BottomBar from "./components/BottomBar.vue"
import Layout from "./Layout.vue"
import Popup from "./components/Popup.vue"
import Topbar from "./components/Topbar.vue"
import "ant-design-vue"
import { FullscreenExitOutlined } from '@ant-design/icons-vue';
import global from "./Global"

import HttpClient from "./components/HttpService/HttpClient"
import HttpServer from "./components/HttpService/HttpServer"
import { nodeManager } from "./utils/nodeManager"

var client = null; // 用于保存http-server进程的引用 
var deviceClient = null; // 用于保存http-server进程设备相关的引用 
var dragPoint = [0, 0];
var draggedSpliter;
var id = 0;
var initSize = [0, 0];
const layout = ref({
  info: "root", size: 1000, children: [
    {
      info: "col", size: 250, children: [
        { info: "row", size: 500, children: [{ info: "模型库" }] },
        { info: "row-split" },
        { info: "row", size: 500, children: [{ info: "层级" }] },
      ]
    },
    { info: "col-split" },
    {
      info: "col", size: 500, children: [
        { info: "row", size: 667, children: [{ info: "场景" }] },
        { info: "row-split" },
        { info: "row", size: 333, children: [{ info: "组件库+控制台" }] },
      ]
    },
    { info: "col-split" },
    { info: "col", size: 250, children: [{ info: "属性" }] },
  ]
});
const showQuitFullscreen = ref(false);
global.on("changeQuitFullscreen", (data: any) => { showQuitFullscreen.value = JSON.parse(data) });
const quitFullscreenStyle = ref("default");
var target;

function addId(layout) {  // 给每个模块加id
  layout.id = "Layout" + id;
  if (layout.children) {
    for (let child of layout.children) {
      id++;
      addId(child);
    }
  }
}
function addSplitMover(layout) {  // 拖动分隔模块以改变相邻模块的尺寸
  if (layout.children) {
    let children = layout.children;
    for (let index in children) {
      let i = parseInt(index);
      if (children[i].info) {
        let info = children[i].info, DOM = document.getElementById(children[i].id);
        let addEventListener = e => {
          dragPoint = [e.clientX, e.clientY];
          initSize = [children[i - 1].size, children[i + 1].size];
          target = e.target;
        };
        if (info == "col-split") {  // 列分隔模块
          DOM.addEventListener("mousedown", e => {
            if (e.buttons == 1) {
              document.body.style.userSelect = "none";  // 拖动时禁止选中文本
              addEventListener(e);
              draggedSpliter = DOM;
            }
          })
          window.addEventListener("mousemove", e => {
            if (e.buttons == 1 && draggedSpliter == DOM) {
              let dX = e.clientX - dragPoint[0];
              dX = Math.floor(dX / target.parentElement.offsetWidth * 1000);
              children[i - 1].size = initSize[0] + dX;
              children[i + 1].size = initSize[1] - dX;
            }
          });
        } else if (info == "row-split") {  // 行分隔模块
          DOM.addEventListener("mousedown", e => {
            if (e.buttons == 1) {
              document.body.style.userSelect = "none";  // 拖动时禁止选中文本
              addEventListener(e);
              draggedSpliter = DOM;
            }
          })
          window.addEventListener("mousemove", e => {
            if (e.buttons == 1 && draggedSpliter == DOM) {
              let dY = e.clientY - dragPoint[1];
              dY = Math.floor(dY / target.parentElement.offsetHeight * 1000);
              children[i - 1].size = initSize[0] + dY;
              children[i + 1].size = initSize[1] - dY;
            }
          });
        }
      }
      addSplitMover(children[i]);
    }
  }
}

addId(layout.value);
onMounted(() => {  // 加载完成时
  addSplitMover(layout.value);
  // client = new HttpClient({  // 启动http服务
  //   max_thread_num: 1,
  //   site: "192.168.137.155", 
  //   port: 8888, 
  //   path: "positionfeedback/frontclient",
  //   interval: 100,  // ms
  //   timeout: 50000000,  // ms
  //   callback: async function () {  // 使用阻塞的方式连接并接收消息，全局超时时间为this.TIMEOUT=50000s
  //     try{
  //       if(!client.allowConnect) return;
  //       if(client.thread_num >= client.max_thread_num) return;
  //       client.thread_num++; 
  //       console.log("线程数：", client.thread_num);
  //       let result = await client.axios.get(
  //           `http://${client.SITE}:${client.PORT}/${client.PATH}`, 
  //           {timeout: client.TIMEOUT}
  //       );
  //       let data = result.data;
  //       console.log("接收到信息：", data);
  //       if(data.RFID && data.deviceID) {
  //         global.emit("updateTrayPosition", data);
  //       }
  //     } 
  //     catch(error) {
  //       console.error(error.message, error);
  //     }
  //     finally{
  //       client.thread_num--;
  //       client.callback();
  //     };
  //   }
  // });
  deviceClient = new HttpClient({
    max_thread_num: 3,
    site: "192.168.137.155",
    port: 8888,
    path: "nodedatafeedback", // 设备信息接口
    interval: 100,  // ms
    timeout: 50000000,  // ms
    callback: async function () {
      try {
        if (!deviceClient.allowConnect) return;
        if (deviceClient.thread_num >= deviceClient.max_thread_num) return;
        deviceClient.thread_num++;
        console.log("设备信息线程数：", deviceClient.thread_num);
        const result = await deviceClient.axios.get(
          `http://${deviceClient.SITE}:${deviceClient.PORT}/${deviceClient.PATH}`,
          { timeout: deviceClient.TIMEOUT }
        );
        const nodeData = result.data;
        const normalizedNodeID = nodeData.nodeID
          .replace(/"/g, '') // 去除可能存在的非法引号
          .replace(/(Capability)[ _]+(Pick)/gi, '$1_$2')
          .replace(/0utput/gi, 'Output');
        const splitIndex = normalizedNodeID.indexOf('/');
        const uuid = normalizedNodeID.slice(0, splitIndex);
        const fullPath = normalizedNodeID.slice(splitIndex + 1);
        const unifiedFullPath = fullPath
          .replace(/(Input|Output)cmd/gi, '$1Cmd')   // 修正大小写
          .replace(/:([a-z]+)@/gi, (_, p1) => `_${p1.toLowerCase()}@`); // 标准化属性符
        // 添加调试日志
        // console.log('[路径处理]', {
        //   uuid: uuid,
        //   rawPath: fullPath,
        //   normalized: unifiedFullPath,
        //   value: nodeData.value
        // });
        nodeManager.update(uuid, unifiedFullPath, nodeData.value);
        const handleUpdate = () => {
          Promise.resolve().then(() => { // 微任务队列保证触发时机
            // console.log("进入Promise");
            if (unifiedFullPath === 'AAS/Capability_Pick/Output/Information_value@Value' && nodeData.value.toLowerCase() === '') {
              global.emit("Denso1", { ID1: 1794 });
            }
            else if (unifiedFullPath === 'AAS/Capability_Pick/Output/Information_value@Value' && nodeData.value.toLowerCase() === 'working') {
              const commandPath = 'AAS/Capability_Pick/Input/InputCmd_value@Value';
              // 正确访问路径（使用新解析逻辑）
              const commandNode = nodeManager.getDeviceData(uuid)?.get('AAS/Capability_Pick/Input');
              const commandNode1 = nodeManager.getDeviceData(uuid);
              const commandValue = commandNode?.['InputCmd_value@Value'];
              /* console.log('Command Value:', {
                exists: !!commandNode,  // 验证此节点是否存在
                value: commandValue,
                1: commandNode1
              }); */
              console.log('当前命令状态:', { uuid, commandValue });
              // console.log('完整命令节点:', commandNode);
              // global.emit("DensoPutCNC", { ID1: 1794 });
              if (typeof commandValue === 'string') {
                const normalizedCmd = commandValue.toLowerCase();
                console.log('匹配工作状态:', nodeData.value);
                if (normalizedCmd.includes('pickcnc')) {
                  setTimeout(() => {
                    global.emit("DensoPickCNC", { ID1: 1794 });
                  }, 1200);
                  console.log('发出PickCNC命令');
                } else if (normalizedCmd.includes('putcnc')) {
                  setTimeout(() => {
                    global.emit("DensoPutCNC", { ID1: 1794 });
                  }, 1200);
                  console.log('发出PutCNC命令');
                } else if (normalizedCmd.includes('putplate')) {
                  setTimeout(() => {
                    global.emit("DensoPutPlate", { ID1: 1794 });
                  }, 1200);
                  console.log('发出PutPlate命令');
                } else if (normalizedCmd.includes('pickplate')) {
                  setTimeout(() => {
                    global.emit("DensoPickPlate", { ID1: 1794 });
                  }, 1200);
                  console.log('发出PickPlate命令');
                } else {
                  console.log('未匹配到具体命令');
                }
              }
            }
            else {
              console.log(unifiedFullPath, nodeData.value + '未匹配到命令');
            }
          });
        };
        setTimeout(() => {
          handleUpdate();
        }, 20);
        // console.log("设备状态更新：", nodeData);
        // console.log('完整设备数据:', nodeManager.getSnapshot());
        // 转换为JSON格式（处理嵌套Map）
        const jsonData = nodeManager.getSnapshot().map(([uuid, paths]) => ({
          uuid,
          paths: Array.from(paths).map(([path, value]) => ({ path, ...value }))
        }));
        // console.log('JSON格式:', JSON.stringify(jsonData, null, 2));
      } catch (error) {
        console.error("设备错误：", error.message);
      } finally {
        deviceClient.thread_num--;
        deviceClient.callback(); // 继续轮询
      }
    }
  });
  // client.callback();  启动连接

  global.on("beforeunload", () => {  // 退出时清理临时文件（src/temp文件夹）
    // client.kill();
    deviceClient.kill();
  })
  global.on("postResponseSuccess", (data) => {
    console.log("收到POST响应:", data);
    // 解析原始请求中的设备ID和RFID
    const { deviceID, rFID } = data.originalData;
    if (data.url.includes("simulateActivateJob")) {
      // 根据rFID找到对应的托盘对象
      const trayMesh = global.uuid2mesh.get(rFID);
      if (trayMesh && trayMesh.DT?.playAnimation) {
        // 启动托盘运送动画
        trayMesh.DT.playAnimation("conveyorTransport");
        global.emit("print",
          `托盘 ${trayMesh.name} 开始沿 ${deviceID} 传送`);
      }
      // 检查响应数据是否包含机械臂任务
      if (data.response && data.response.includes("ROBOT_TASK")) {
        // 找到对应设备的机械臂
        const robotMesh = global.uuid2mesh.get(deviceID);

        if (robotMesh && robotMesh.DT?.playRobotAnimation) {
          // 启动机械臂动画
          setTimeout(() => {
            robotMesh.DT.playRobotAnimation("pickAndPlace");
          }, 3000);
        }
      }
    }
  });
  global.on("postResponseError", (errorData) => {
        console.error("请求失败:", errorData);
    });
  window.addEventListener("drop", () => {
    document.body.style.userSelect = '';  // 恢复文本选择功能
    draggedSpliter = null;
  });
  window.addEventListener("mouseup", () => {
    document.body.style.userSelect = '';  // 恢复文本选择功能
    draggedSpliter = null;
  });
});
</script>

<template>
  <div :DTScene="{}" id="main" ref="main" style="
    border: 0px solid grey;
    display: block;
    margin-left: 0px;
    position: absolute;  
    top: 0;  
    left: 0;  
    width: 100vw;  
    height: 100vh;
  ">
    <a-config-provider :autoInsertSpaceInButton="false"><!--禁止ant自动在两字按钮之间加空格-->
      <!--主界面-->
      <Topbar />
      <Layout style="height: calc(100vh - 186px);" :item="layout" parent="none" />
      <BottomBar style="" />
      <!--弹窗-->
      <Popup />
      <!--全屏模式-->
      <a-button v-if="showQuitFullscreen" danger style="
        position: absolute; 
        top: 10px; 
        right: 10px;
        z-index: 1919810;    
      " :type="quitFullscreenStyle" @mouseenter="quitFullscreenStyle = 'primary'"
        @mousedown="global.emit('changeFullscreen'); quitFullscreenStyle = 'default'"
        @mouseleave="quitFullscreenStyle = 'default'">
        <FullscreenExitOutlined />退出全屏&nbsp;(Esc)
      </a-button>
    </a-config-provider>
  </div>
</template>
