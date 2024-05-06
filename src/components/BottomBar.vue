<script lang="ts">
  import { computed, ref, unref } from 'vue'
  import global from "./Global"
  var BottomMessage;
  var BottomWindowSize;
  global.on("BottomMessage", (data)=>{BottomMessage.textContent = data;})
  export default {
    methods:{
      showWindowSize(){
        let W = window.innerWidth;  
        let H = window.innerHeight;
        BottomWindowSize.textContent = W + 'x' + H;
      }
    },
    mounted() {  
      BottomMessage = document.getElementById("BottomMessage");
      BottomWindowSize = document.getElementById("BottomWindowSize");
      this.showWindowSize();
      window.addEventListener('resize', this.showWindowSize);  
    },  
    beforeDestroy() {  
      window.removeEventListener('resize', this.showWindowSize);  
    }
  }
</script>

<style>
.item{
  display: inline-block;
  margin-top: 3px;
}
</style>

<template>
  <div style="
    background-color: dodgerblue;
    border: 3px solid black; 
    bottom: 0px;
    color: white;
    text-align: left;
    height: 30px; 
    padding-top: 0px;
    position: absolute; 
    width: calc(100% - 6px);
  ">
    &nbsp;&nbsp;FPS：<div id="BottomFPS" class="item"/>&nbsp;&nbsp;
    <div style="border-right: 1px solid lightgrey; display: inline; "/>
    &nbsp;&nbsp;仿真速度：<div id="BottomSpeed" class="item">1x</div>&nbsp;&nbsp;
    <div style="border-right: 1px solid lightgrey; display: inline; "/>
    &nbsp;&nbsp;窗口尺寸：<div id="BottomWindowSize" class="item"/>&nbsp;&nbsp;
    <div style="border-right: 1px solid lightgrey; display: inline; "/>
    &nbsp;&nbsp;消息：<div id="BottomMessage" class="item">仿真停止</div>&nbsp;&nbsp;
    <div style="
      display: inline; 
      position: absolute; 
      right: 0px;
      top: 3px;
    ">仿真时间：<span id="BottomTimer">00:00:00.000</span>&nbsp;s&nbsp;&nbsp;</div>
  </div> 
</template>
./Global./Global