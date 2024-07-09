<script lang="ts">
  import global from "../Global"
  import Prop from "./Prop.vue"
  import { ref } from 'vue'

  const DT:any = ref("未选择物体");
  const tube = new EyeDropper();  // 颜色吸管

  export default{
    components:{ Prop },
    data(){
      return {
        angle: Math.PI/180,
        DT, 
        global,
      }
    },  
    methods:{
      changeFogColor() {  // 更改雾的颜色
        global.emit("changeFogColor" , DT.value.mesh.userData.ground)
      },
    },
    provide:{ tube },
    mounted(){
      global.on("hideProperty", ()=>DT.value = "未选择物体");  // 清空属性
      global.on("showMultipleProperty", (x)=>DT.value = `已选择${x}个物体`);  // 选择多个物体
      global.on("showProperty", (id: any)=>{  // 显示单个物体的属性
        id = parseInt(id);  // 若id为数字字符串则转换为数字
        DT.value = global.SCENE.DT.findDTObjectById(id);
      });
    },
  }
</script>

<style>
  .input{
    border:1px solid dodgerblue;
  }
</style>

<template>
  <!--属性栏默认文字-->
  <a-alert v-if="typeof DT == 'string'" :message="DT" style="width:100%" type="info"/>
  <!--属性栏内容-->
  <div v-else style="text-align:left;">   
    <a-collapse :default-active-key="[
      '基本属性', '几何属性', '物理属性', '材质属性', '代码属性', '自定义属性', '自定义脚本'
      ]">

      <!--基本属性-->
      <a-collapse-panel header="基本属性" key="基本属性">
        <Prop prop="type" title="物体类型"/>
        <Prop prop="id" title="物体网格ID" :options="{fixed:0}"/>
        <Prop prop="name" title="物体名称" type="inputString" width="120"/>
        <Prop prop="physicalID" title="物理实体ID" type="inputString" width="120"/>
        <Prop prop="label" title="物体标签"/>
        <Prop prop="mesh.visible" title="是否可见" type="checkbox"/>
        <Prop prop="mesh.position" title="位移" type="inputVector"/>
        <Prop prop="mesh.rotation" title="旋转" type="inputVector" 
        :options="{delta:10, loop:true, min:0, max:360, suffix:'°', unit:angle}"/>
        <Prop v-if="DT.label=='importedModel'" prop="scale" title="比例" type="inputNumber"
        :options="{delta:1, min:0.01, max:100}"/>
        <Prop v-else prop="scale" title="比例"/>
        <Prop v-if="DT.label=='conveyor' && DT.name.includes('直道')" prop="mesh.scale.x" 
        title="长度" type="inputNumber"
        :options="{delta:0.1, min:0.1, unit:DT.scale / 7.5}"/>
        <Prop prop="mesh.color" title="光源颜色" type="inputVector"/>
        <Prop prop="mesh.color" title="颜色代码" type="inputColor" width="120"/>
        <Prop prop="mesh.intensity" title="光照强度" type="inputNumber"
        :options="{delta:0.1, min:0}"/>
        <Prop prop="timeInterval" title="发生时间间隔" type="inputNumber"
        :options="{delta:0.01, min:1, max:10, suffix:'s', unit:1000}"/>
        <Prop prop="skybox.skyColor" title="天空颜色" type="inputColor" width="120"
        @change="global.emit('updateSkybox')"/>
        <Prop prop="skybox.skyline" title="天际线颜色" type="inputColor" width="120"
        @change="global.emit('updateSkybox')"/>
        <Prop prop="skybox.groundColor" title="底面颜色" type="inputColor" width="120"
        @change="global.emit('updateSkybox')"/>
      </a-collapse-panel>

      <!--几何属性-->
      <a-collapse-panel v-if="DT.geometry" header="几何属性" key="几何属性">
        <Prop prop="geometry.type" title="几何体类型"/>
        <Prop prop="geometry.userData.path" title="模型路径"/>
        <Prop prop="geometry.attributes.position.count" title="顶点数" :options="{fixed:0}"/>
        <Prop prop="geometry.attributes.normal.count" title="法向量数" :options="{fixed:0}"/>
        <Prop prop="geometry.attributes.uv.count" title="UV坐标数" :options="{fixed:0}"/>
        <Prop prop="geometry.boundingBox.min" title="包围盒最小值"/>
        <Prop prop="geometry.boundingBox.max" title="包围盒最大值"/>
        <Prop prop="geometry.boundingSphere.center" title="包围球中心"/>
        <Prop prop="geometry.boundingSphere.radius" title="包围球半径"/>
      </a-collapse-panel>
      <a-collapse-panel v-else disabled header="几何属性（无）"/>

      <!--物理属性-->
      <a-collapse-panel v-if="DT.rb" header="物理属性" key="物理属性">
        <Prop prop="rigid" title="刚体"/>
        <Prop prop="rb.constructor.name" title="刚体类型"/>
        <Prop prop="rigidFollow" title="运动位姿跟随" type="follow"/>
        <Prop prop="mass" title="质量" type="inputNumber"
        :options="{delta:0.1, min:0.1, max:5}"/>
        <Prop prop="friction0" title="静摩擦系数" type="inputNumber"
        :options="{delta:0.1, min:0, max:1}"/>
        <Prop prop="friction" title="滑动摩擦系数" type="inputNumber"
        :options="{delta:0.1, min:0, max:1}"/>
        <Prop prop="v0" title="传送带速度" type="inputNumber"
        :options="{delta:0.1, min:0.1, max:5}"/>
      </a-collapse-panel>
      <a-collapse-panel v-else disabled header="物理属性（无）"/>

      <!--材质属性-->
      <a-collapse-panel v-if="DT.mesh.material" header="材质属性" key="材质属性">
        <Prop prop="mesh.material.type" title="材质类型"/>
        <Prop prop="mesh.material.color" title="材质颜色" type="inputVector"
        @change="changeFogColor"/>
        <Prop prop="mesh.material.color" title="颜色代码" type="inputColor" width="120"
        @change="changeFogColor"/>
        <Prop prop="mesh.material.opacity" title="透明度" type="inputNumber"
        :options="{fixed:0, min:0, max:100, suffix:'%', unit:0.01}"/>
      </a-collapse-panel>
      <a-collapse-panel v-else disabled header="材质属性（无）"/>

      <!--自定义属性-->
      <a-collapse-panel v-if="DT.custom" header="自定义属性" key="自定义属性">
        <a-button @click="global.emit('popup', {DT: DT, title: '编辑自定义属性', type: 'prop'})">
          编辑自定义属性
        </a-button>  
      </a-collapse-panel>

      <!--自定义脚本-->
      <a-collapse-panel v-if="DT.custom" header="自定义脚本" key="自定义脚本">
        <a-button @click="global.emit('popup', {DT: DT, title: '编辑自定义脚本', type: 'code'})">
          编辑自定义脚本
        </a-button>  
      </a-collapse-panel>
    </a-collapse>
  </div>
</template>