<script lang="ts">
  import {onMounted} from 'vue'
  import BottomBar from './components/BottomBar.vue'
  import Layout from './components/Layout.vue'
  import Navbar from './components/Navbar.vue'
  import "ant-design-vue"
  import BUS from "./components/EventBus"
  var layout = {
    info: 'root', size: 100, children:[
      {info: 'col', size: 25, children: [
        {info: 'row', size: 50, children: [{info: '模型'}]},
        {info: 'row', size: 50, children: [{info: '层级'}]},
      ]},
      {info: 'col', size: 50, children: [
        {info: 'row', size: 67, children: [{info: '场景'}]},
        {info: 'row', size: 33, children: [{info: '组件库+控制台'}]},
      ]},
      {info: 'col', size: 25, children: [{info: '属性'}]},
    ]
  }
</script>

<script setup lang="ts">
  onMounted(() => {  // 加载完成时
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
