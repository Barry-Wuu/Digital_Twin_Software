<script lang="ts">
  import BUS from "./EventBus"
  import { ref } from 'vue'

  const angle = Math.PI / 180;
  const IN = ref({});
  BUS.on('chooseModel', (data)=>{IN.value = data})
  
  export default{
    inject:['model'],
    methods:{
      abc(){alert(IN)}
    },
    setup(){
      return {angle, IN}
    },
  }
</script>

<template>
  <div :IN="IN">
    <div v-if="'type' in IN" style="text-align:left">模型类型：{{ IN.type }}</div>

    <div v-if="'name' in IN" style="text-align:left">
      模型名称：<a-input style="width:100px" type="string" :value="IN.name"/>
    </div>

    <div v-if="'id' in IN" style="text-align:left">模型ID：{{ IN.id }}</div>

    <div v-if="'visible' in IN" style="text-align:left">
      是否可见：<a-checkbox :checked="IN.visible" @click="()=>{IN.visible = !IN.visible}">
        {{ IN.visible ? "是" : "否" }}
      </a-checkbox>
    </div>

    <div v-if="'position' in IN" style="text-align:left">
      位移：<br/>
      <strong>x:</strong><a-input style="width:80px" type="number" :value="IN.position.x" 
      @wheel="(e)=>{IN.position.x += 1 * (e.deltaY<0 ? 1 : -1)}"/>, 
      <strong>y:</strong><a-input style="width:80px" type="number" :value="IN.position.y" 
      @wheel="(e)=>{IN.position.y += 1 * (e.deltaY<0 ? 1 : -1)}"/>, 
      <strong>z:</strong><a-input style="width:80px" type="number" :value="IN.position.z" 
      @wheel="(e)=>{IN.position.z += 1 * (e.deltaY<0 ? 1 : -1)}"/>
    </div>

    <div v-if="'rotation' in IN" style="text-align:left">
      旋转：<br/>
      <strong>x:</strong><a-input style="width:80px" type="number" :value="IN.rotation.x*180/Math.PI" 
      @wheel="(e)=>{IN.rotation.x += angle * (e.deltaY<0 ? 1 : -1)}" suffix="°"/>, 
      <strong>y:</strong><a-input style="width:80px" type="number" :value="IN.rotation.y*180/Math.PI" 
      @wheel="(e)=>{IN.rotation.y += angle * (e.deltaY<0 ? 1 : -1)}" suffix="°"/>, 
      <strong>z:</strong><a-input style="width:80px" type="number" :value="IN.rotation.z*180/Math.PI" 
      @wheel="(e)=>{IN.rotation.z += angle * (e.deltaY<0 ? 1 : -1)}" suffix="°"/>
    </div>

    <div v-if="'scale' in IN" style="text-align:left">
      比例：<br/>
      <strong>x:</strong><a-input style="width:80px" type="number" :value="IN.scale.x" 
      @wheel="(e)=>{IN.scale.x += 0.1 * (e.deltaY<0 ? 1 : -1)}"/>, 
      <strong>y:</strong><a-input style="width:80px" type="number" :value="IN.scale.y" 
      @wheel="(e)=>{IN.scale.y += 0.1 * (e.deltaY<0 ? 1 : -1)}"/>, 
      <strong>z:</strong><a-input style="width:80px" type="number" :value="IN.scale.z" 
      @wheel="(e)=>{IN.scale.z += 0.1 * (e.deltaY<0 ? 1 : -1)}"/>
    </div>
  </div>
</template>
