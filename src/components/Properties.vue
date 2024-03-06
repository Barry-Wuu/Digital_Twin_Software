<script lang="ts">
  import BUS from "./EventBus"
  import { ref, watch } from 'vue'
  const angle = Math.PI / 180;
  const obj = ref("未选择对象");
  var status = "play";

  BUS.on("showProperty", (key:string)=>{
    if(!'未已'.includes(key[0])){
      obj.value = window.DTScene.findDTObjectByKey(key);
      if(status == "play") updateProperty(); 
    }
    else obj.value = key;
  })
  async function updateProperty(){
    if(status == "play"){  // 播放时不停地更新状态
      //objPos.value = obj.value.mesh.position;  
    }
  }
  export default{
    setup(){
      return {angle, obj}
    },
  }
</script>

<template>
  <div v-if="typeof obj == 'string'">{{ obj }}</div>
  <div v-else style="text-align:left">    
    <div v-if="'type' in obj">物体类型：{{ obj.type }}</div>
    <div v-if="'name' in obj">物体名称：{{ obj.name }}</div>
    <div v-if="'key' in obj">物体ID：{{ obj.key }}</div>
    <div v-if="'visible' in obj.mesh">
      是否可见：<a-checkbox :checked="obj.mesh.visible" 
      @click="()=>{obj.mesh.visible = !obj.mesh.visible}">
        {{ obj.mesh.visible ? "是" : "否" }}
      </a-checkbox>
    </div>
    <div v-if="'position' in obj.mesh">
      位移：<br/>
      <strong>x:</strong><a-input style="width:80px" type="number" :value="obj.mesh.position.x"   
      @wheel="(e)=>{obj.set('x', 1 * (e.deltaY<0 ? 1 : -1)) }"/>, 
      <strong>y:</strong><a-input style="width:80px" type="number" :value="obj.mesh.position.y" 
      @wheel="(e)=>{obj.set('y', 1 * (e.deltaY<0 ? 1 : -1)) }"/>, 
      <strong>z:</strong><a-input style="width:80px" type="number" :value="obj.mesh.position.z" 
      @wheel="(e)=>{obj.set('z', 1 * (e.deltaY<0 ? 1 : -1)) }"/>
    </div>
    <div v-if="'rotation' in obj.mesh">
      旋转：<br/>
      <strong>x:</strong><a-input style="width:80px" suffix="°" type="number" 
      :value="obj.mesh.rotation.x*180/Math.PI"   
      @wheel="(e)=>{obj.set('rx', angle*10*(e.deltaY<0 ? 1 : -1)) }"/>, 
      <strong>y:</strong><a-input style="width:80px" suffix="°" type="number" 
      :value="obj.mesh.rotation.y*180/Math.PI" 
      @wheel="(e)=>{obj.set('ry', angle*10*(e.deltaY<0 ? 1 : -1)) }"/>, 
      <strong>z:</strong><a-input style="width:80px" suffix="°" type="number" 
      :value="obj.mesh.rotation.z*180/Math.PI" 
      @wheel="(e)=>{obj.set('rz', angle*10*(e.deltaY<0 ? 1 : -1)) }"/>
    </div>
    <div v-if="'rigid' in obj">刚性：{{ obj.rigid ? "是" : "否" }}</div>
    <div v-if="obj.rigid">
      质量：<a-input :disabled="obj.mass==0" style="width:80px" type="number" :value="obj.mass" 
      @wheel="(e)=>{obj.mass = Math.max(1e-10, obj.mass + 0.1 * (e.deltaY<0 ? 1 : -1))}"/>
    </div>
  </div>
</template>
