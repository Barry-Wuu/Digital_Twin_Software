<script lang="ts">
  import BUS from "./EventBus"
  import { ref, watch } from 'vue'
  const angle = Math.PI / 180;
  const DT = ref("未选择对象");
  var status = "play";

  BUS.on("showProperty", (id:string)=>{
    if(!'未已'.includes(id[0])){
      DT.value = window.DTScene.findDTObjectById(id);
      //if(status == "play") updateProperty(); 
    }
    else DT.value = id;
  })
  export default{
    methods:{
      clamp(x, min, max){  // 范围限制
        return Math.min(Math.max(x, min), max);
      },
      scroll(e){  // 滚轮向上滚时返回1，否则返回-1
        return e.deltaY<0 ? 1 : -1;
      }
    },
    setup(){
      return {angle, DT}
    },
  }
</script>

<template>
  <h2 v-if="typeof DT == 'string'">{{ DT }}</h2>
  <div v-else style="text-align:left">   
    <a-collapse :default-active-key="['基本属性', '刚体属性']">
      <a-collapse-panel header="基本属性" key="基本属性">
        <div v-if="'type' in DT">物体类型：{{ DT.type }}</div>
        <div v-if="'name' in DT">物体名称：{{ DT.name }}</div>
        <div v-if="'id' in DT">物体ID：{{ DT.id }}</div>
        <div v-if="'visible' in DT.mesh">
          是否可见：<a-checkbox :checked="DT.mesh.visible" 
          @click="()=>{DT.mesh.visible = !DT.mesh.visible}">
            {{ DT.mesh.visible ? "是" : "否" }}
          </a-checkbox>
        </div>
        <div v-if="'position' in DT.mesh">
          位移：<br/>
          <strong>x:</strong><a-input style="width:80px" type="number" :value="DT.mesh.position.x"   
          @wheel="(e)=>{DT.set('x', 1 * scroll(e)) }"/>, 
          <strong>y:</strong><a-input style="width:80px" type="number" :value="DT.mesh.position.y" 
          @wheel="(e)=>{DT.set('y', 1 * scroll(e)) }"/>, 
          <strong>z:</strong><a-input style="width:80px" type="number" :value="DT.mesh.position.z" 
          @wheel="(e)=>{DT.set('z', 1 * scroll(e)) }"/>
        </div>
        <div v-if="'rotation' in DT.mesh">
          旋转：<br/>
          <strong>x:</strong><a-input style="width:80px" suffix="°" type="number" 
          :value="DT.mesh.rotation.x*180/Math.PI"   
          @wheel="(e)=>{DT.set('rx', angle*10*scroll(e)) }"/>, 
          <strong>y:</strong><a-input style="width:80px" suffix="°" type="number" 
          :value="DT.mesh.rotation.y*180/Math.PI" 
          @wheel="(e)=>{ DT.set('ry', angle*10*scroll(e)) }"/>, 
          <strong>z:</strong><a-input style="width:80px" suffix="°" type="number" 
          :value="DT.mesh.rotation.z*180/Math.PI" 
          @wheel="(e)=>{ DT.set('rz', angle*10*scroll(e)) }"/>
        </div>
        <div v-if="DT.v0">传送带速度：
          <a-input style="width:120px" suffix="单位/s" type="number" 
          :value="DT.v0" 
          @wheel="(e)=>{ DT.v0 = clamp(DT.v0 + 0.1*scroll(e), 0.1, 5) }"/>
        </div>
        <div v-if="DT.timeInterval">发生时间间隔：
          <a-input style="width:80px" suffix="s" type="number" 
          :value="DT.timeInterval" 
          @wheel="(e)=>{ DT.timeInterval = clamp(DT.timeInterval + scroll(e), 1, 10) }"/>
        </div>
        <div v-if="DT.mesh.FPS">FPS：
          <a-input style="width:120px" type="number" 
          :value="DT.mesh.FPS" 
        />
        </div>
      </a-collapse-panel>
      <!--刚体属性-->
      <a-collapse-panel v-if="DT.rigid" header="刚体属性" key="刚体属性">
        <div v-if="DT.rigid">刚体：{{ DT.rigid ? "是" : "否" }}</div>
        <div v-if="DT.mass">质量：
          <a-input :disabled="DT.mass==0" style="width:80px" type="number" :value="DT.mass" 
          @wheel="(e)=>{DT.mass = Math.max(1e-10, DT.mass + 0.1*scroll(e))}"/>
        </div>
        <div v-if="DT.friction">
          摩擦系数：<a-input style="width:80px" type="number" :value="DT.friction" 
          @wheel="(e)=>{
            DT.friction = clamp(DT.friction + 0.1*scroll(e), 1e-10, 1)
          }"/>
        </div>
      </a-collapse-panel>
    </a-collapse>
  </div>
</template>
