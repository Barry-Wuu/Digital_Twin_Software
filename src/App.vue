<script lang="ts">
  import {onMounted} from 'vue'
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
    border: 1px solid black;
    display: flex;
    flex-direction: column;
    margin-left: 0px;
    position: absolute;  
    top: 0;  
    left: 0;  
    width: 100vw;  
    height: 100%;
  ">
      <Navbar/>
      <div style="border: 1px solid grey; display:flex; flex-grow: 1; margin-top:-10px">
        <Layout :item='layout' parent="none"/>
      </div> 
  </div>
</template>
