<script setup lang="ts">
  import {onMounted, ref} from "vue"
  import BottomBar from "./components/BottomBar.vue"
  import Layout from "./Layout.vue"
  import Popup from "./components/Popup.vue"
  import Topbar from "./components/Topbar.vue"
  import "ant-design-vue"
  import { FullscreenExitOutlined } from '@ant-design/icons-vue';
  import global from "./Global"

  import HttpClient from "./components/HttpService/HttpClient"
  import HttpServer from "./components/HttpService/HttpServer"

  var client = null; // 用于保存http-server进程的引用 
  var dragPoint = [0, 0];
  var draggedSpliter;
  var id = 0;
  var initSize = [0, 0];
  const layout = ref({
    info: "root", size: 1000, children:[
      {info: "col", size: 250, children: [
        {info: "row", size: 500, children: [{info: "模型库"}]},
        {info: "row-split"},
        {info: "row", size: 500, children: [{info: "层级"}]},
      ]},
      {info: "col-split"},
      {info: "col", size: 500, children: [
        {info: "row", size: 667, children: [{info: "场景"}]},
        {info: "row-split"},
        {info: "row", size: 333, children: [{info: "组件库+控制台"}]},
      ]},
      {info: "col-split"},
      {info: "col", size: 250, children: [{info: "属性"}]},
    ]
  });
  const showQuitFullscreen = ref(false);
  global.on("changeQuitFullscreen", (data: any)=>{showQuitFullscreen.value = JSON.parse(data)});
  const quitFullscreenStyle = ref("default");
  var target;

  function addId(layout){  // 给每个模块加id
    layout.id = "Layout" + id;
    if(layout.children){
      for(let child of layout.children){
        id++;
        addId(child);
      }
    } 
  }
  function addSplitMover(layout){  // 拖动分隔模块以改变相邻模块的尺寸
    if(layout.children){
      let children = layout.children;
      for(let index in children){
        let i = parseInt(index);
        if(children[i].info){
          let info = children[i].info, DOM = document.getElementById(children[i].id);
          let addEventListener = e=>{
            dragPoint = [e.clientX, e.clientY];
            initSize = [children[i-1].size, children[i+1].size];
            target = e.target;
          };
          if(info == "col-split"){  // 列分隔模块
            DOM.addEventListener("mousedown", e => {
              if(e.buttons == 1){
                document.body.style.userSelect = "none";  // 拖动时禁止选中文本
                addEventListener(e);
                draggedSpliter = DOM;
              }
            })
            window.addEventListener("mousemove", e => {
              if(e.buttons == 1 && draggedSpliter == DOM){
                let dX = e.clientX - dragPoint[0];
                dX = Math.floor(dX / target.parentElement.offsetWidth * 1000);
                children[i-1].size = initSize[0] + dX;
                children[i+1].size = initSize[1] - dX;
              }
            });
          } else if (info == "row-split"){  // 行分隔模块
            DOM.addEventListener("mousedown", e=>{
              if(e.buttons == 1){
                document.body.style.userSelect = "none";  // 拖动时禁止选中文本
                addEventListener(e);
                draggedSpliter = DOM;
              }
            })
            window.addEventListener("mousemove", e=>{
              if(e.buttons == 1 && draggedSpliter == DOM){
                let dY = e.clientY - dragPoint[1];
                dY = Math.floor(dY / target.parentElement.offsetHeight * 1000);
                children[i-1].size = initSize[0] + dY;
                children[i+1].size = initSize[1] - dY;
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
    client = new HttpClient({  // 启动http服务
      site:"192.168.137.155", 
      port: 8888, 
      path: "positionfeedback/frontclient",
      interval: 100,  // ms
      timeout: 500000,  // ms
      callback: async function () {  // 使用阻塞的方式连接并接收消息，全局超时时间为this.TIMEOUT=500s
        try{
          if(!client.allowConnect) return;
          if(client.thread_num >= client.max_thread_num) return;
          client.thread_num++; 
          console.log("线程数：", client.thread_num);
          let result = await client.axios.get(
              `http://${client.SITE}:${client.PORT}/${client.PATH}`, 
              {timeout: client.TIMEOUT}
          );
          let data = result.data;
          if(data.RFID && data.deviceID) {
            global.emit("updateTrayPosition", data);
          }
        } 
        catch(error) {
          console.error(error.message, error);
        }
        finally{
          client.thread_num--;
          client.callback();
        };
      }
    });
    client.callback();  // 启动连接
    
    global.on("beforeunload", () => {  // 退出时清理临时文件（src/temp文件夹）
      client.kill();
    })
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
      <Topbar/>
      <Layout style="height: calc(100vh - 186px);" :item="layout" parent="none"/>
      <BottomBar style=""/>
      <!--弹窗-->
      <Popup/>
      <!--全屏模式-->
      <a-button v-if="showQuitFullscreen" danger style="
        position: absolute; 
        top: 10px; 
        right: 10px;
        z-index: 1919810;    
      " 
      :type="quitFullscreenStyle"
      @mouseenter = "quitFullscreenStyle = 'primary'"
      @mousedown = "global.emit('changeFullscreen'); quitFullscreenStyle = 'default'"
      @mouseleave = "quitFullscreenStyle = 'default'"
      >
        <FullscreenExitOutlined/>退出全屏&nbsp;(Esc)
      </a-button>
    </a-config-provider>
  </div>
</template>
