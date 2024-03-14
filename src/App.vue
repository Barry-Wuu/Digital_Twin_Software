<script setup lang="ts">
  import {onMounted, ref} from "vue"
  import BottomBar from "./components/BottomBar.vue"
  import Layout from "./components/Layout.vue"
  import Navbar from "./components/Navbar.vue"
  import "ant-design-vue"
  import BUS from "./components/EventBus"

  var dragPoint = [0, 0];
  var draggedSpliter;
  var id = 0;
  var initSize = [0, 0];
  var layout = ref({
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
  })
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
      for(let I in children){
        let i = parseInt(I);
        if(children[i].info){
          let info = children[i].info, DOM = document.getElementById(children[i].id);
          let addEventListener = (e)=>{
            dragPoint = [e.clientX, e.clientY];
            initSize = [children[i-1].size, children[i+1].size];
            target = e.target;
          };
          if(info == "col-split"){
            DOM.addEventListener("mousedown", (e)=>{
              addEventListener(e);
              draggedSpliter = DOM;
            })
            window.addEventListener("mousemove", (e)=>{
              if(draggedSpliter == DOM){
                let dX = e.clientX - dragPoint[0];
                dX = Math.floor(dX / target.parentElement.offsetWidth * 1000);
                children[i-1].size = initSize[0] + dX;
                children[i+1].size = initSize[1] - dX;
              }
            });
          } else if (info == "row-split"){
            DOM.addEventListener("mousedown", (e)=>{
              addEventListener(e);
              draggedSpliter = DOM;
            })
            window.addEventListener("mousemove", (e)=>{
              if(draggedSpliter == DOM){
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
    window.addEventListener("drop", ()=>{
      draggedSpliter = null;
    });
    window.addEventListener("mouseup", ()=>{
      draggedSpliter = null;
    });
    window.addEventListener('resize', ()=>BUS.emit("resize"));
  })
</script>

<template>
  <div style = "
    border: 0px solid grey;
    display: block;
    margin-left: 0px;
    position: absolute;  
    top: 0;  
    left: 0;  
    width: 100vw;  
    height: 100vh;
  ">
      <Navbar/>
      <Layout style="height: calc(100vh - 149px); margin-top:-10px" :item='layout' parent="none"/>
      <BottomBar style=""/>
  </div>
</template>
