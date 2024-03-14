<script lang="ts">
  import BUS from "./EventBus"
  import { ref } from 'vue'
  const angle = Math.PI / 180;
  const DT = ref("未选择对象");
  var status = "play";

  BUS.on("showProperty", (data:string)=>{
    if(!'未已'.includes(data[0])){
      DT.value = window.DTScene.findDTObjectById(data);
      //if(status == "play") updateProperty(); 
    }
    else if(data == "asset"){
      DT.value = window.asset;
      console.log(window.asset)
    }
    else DT.value = data;
  })
  export default{
    methods:{
      clamp(x, min, max){  // 范围限制
        return Math.min(Math.max(x, min), max);
      },
      scroll(e){  // 滚轮向上滚时返回1，否则返回-1
        e.preventDefault();
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
    <a-collapse :default-active-key="['基本属性', '几何属性', '物理属性', '材质属性']">
      <!--基本属性-->
      <a-collapse-panel header="基本属性" key="基本属性">
        <!--物体类型-->
        <div v-if="'type' in DT">
          <strong>物体类型：</strong>{{ DT.type }}
        </div>
        <!--物体名称-->
        <div v-if="'name' in DT">
          <strong>物体名称：</strong>{{ DT.name }}
        </div>
        <!--物体ID-->
        <div v-if="'id' in DT">
          <strong>物体ID：</strong>{{ DT.id }}
        </div>
        <!--是否可见-->
        <div v-if="'visible' in DT.mesh">
          <strong>是否可见：</strong>
          <a-checkbox :checked="DT.mesh.visible" 
          @click="()=>{DT.mesh.visible = !DT.mesh.visible}">
            {{ DT.mesh.visible ? "是" : "否" }}
          </a-checkbox>
        </div>
        <!--位置-->
        <div v-if="'position' in DT.mesh">
          <strong>位置：</strong><br/>
          <strong>x:</strong><a-input style="width:80px" type="number" :value="DT.mesh.position.x"   
          @wheel="(e)=>{DT.set('x', 1 * scroll(e));}"/>, 
          <strong>y:</strong><a-input style="width:80px" type="number" :value="DT.mesh.position.y" 
          @wheel="(e)=>{DT.set('y', 1 * scroll(e));}"/>, 
          <strong>z:</strong><a-input style="width:80px" type="number" :value="DT.mesh.position.z" 
          @wheel="(e)=>{DT.set('z', 1 * scroll(e));}"/>
        </div>
        <!--旋转-->
        <div v-if="'rotation' in DT.mesh">
          <strong>旋转：</strong><br/>
          <strong>x:</strong><a-input style="width:80px" suffix="°" type="number" 
          :value="DT.mesh.rotation.x*180/Math.PI"   
          @wheel="(e)=>{DT.set('rx', angle*10*scroll(e));}"/>, 
          <strong>y:</strong><a-input style="width:80px" suffix="°" type="number" 
          :value="DT.mesh.rotation.y*180/Math.PI" 
          @wheel="(e)=>{DT.set('ry', angle*10*scroll(e));}"/>, 
          <strong>z:</strong><a-input style="width:80px" suffix="°" type="number" 
          :value="DT.mesh.rotation.z*180/Math.PI" 
          @wheel="(e)=>{DT.set('rz', angle*10*scroll(e));}"/>
        </div>
        <!--比例-->
        <div v-if="DT.scale">
          <strong>比例：</strong>{{DT.scale}}
        </div>
        <!--传送带速度-->
        <div v-if="DT.v0">
          <strong>传送带速度：</strong>
          <a-input style="width:120px" suffix="单位/s" type="number" 
          :value="DT.v0" 
          @wheel="(e)=>{DT.v0 = clamp(DT.v0 + 0.1*scroll(e), 0.1, 5);}"/>
        </div>
        <!--发生时间间隔-->
        <div v-if="DT.timeInterval">
          <strong>发生时间间隔：</strong>
          <a-input style="width:80px" suffix="s" type="number" 
          :value="DT.timeInterval" 
          @wheel="(e)=>{DT.timeInterval = clamp(DT.timeInterval + scroll(e), 1, 10);}"/>
        </div>
      </a-collapse-panel>
      <!--几何属性-->
      <a-collapse-panel v-if="DT.mesh.geometry" header="几何属性" key="几何属性">
        <!--几何体类型-->
        <div v-if="DT.mesh.geometry.type">
          <strong>几何体类型：</strong>
          {{DT.mesh.geometry.type}}
        </div>
        <!--模型路径-->
        <div v-if="typeof DT.mesh.geometry.userData == 'string'">
          <strong>模型路径：</strong>
          {{DT.mesh.geometry.userData}}
        </div>
        <!--顶点数-->
        <div v-if="DT.mesh.geometry.attributes.position">
          <strong>顶点数：</strong>
          {{DT.mesh.geometry.attributes.position.count}}
        </div>
        <!--法向量数-->
        <div v-if="DT.mesh.geometry.attributes.normal">
          <strong>法向量数：</strong>
          {{DT.mesh.geometry.attributes.normal.count}}
        </div>
        <!--UV坐标数-->
        <div v-if="DT.mesh.geometry.attributes.uv">
          <strong>UV坐标数：</strong>
          {{DT.mesh.geometry.attributes.uv.count}}
        </div>
        <!--包围盒-->
        <div v-if="DT.mesh.geometry.boundingBox">
          <strong>包围盒最小值：</strong>
          x:&nbsp{{DT.mesh.geometry.boundingBox.min.x}},
          y:&nbsp{{DT.mesh.geometry.boundingBox.min.y}},
          z:&nbsp{{DT.mesh.geometry.boundingBox.min.z}}
          <br><strong>包围盒最大值：</strong>
          x:&nbsp{{DT.mesh.geometry.boundingBox.max.x}},
          y:&nbsp{{DT.mesh.geometry.boundingBox.max.y}},
          z:&nbsp{{DT.mesh.geometry.boundingBox.max.z}}
        </div>
      </a-collapse-panel>
      <!--物理属性-->
      <a-collapse-panel v-if="DT.rigid" header="物理属性" key="物理属性">
        <!--刚体类型-->
        <div v-if="DT.rigidShape">
          <strong>刚体形状：</strong>
          {{DT.rigidShape.constructor.name}}
        </div>
        <!--刚体-->
        <div v-if="DT.rigid">
          <strong>刚体：</strong>
          {{ DT.rigid ? "是" : "否" }}
        </div>
        <!--质量-->
        <div v-if="DT.mass">
          <strong>质量：</strong>
          <a-input :disabled="DT.mass==0" style="width:80px" type="number" :value="DT.mass" 
          @wheel="(e)=>{DT.mass = Math.max(1e-10, DT.mass + 0.1*scroll(e));}"/>
        </div>
        <!--静摩擦系数-->
        <div v-if="DT.friction0">
          <strong>静摩擦系数：</strong>
          <a-input style="width:80px" type="number" :value="DT.friction0" 
          @wheel="(e)=>{DT.friction0 = clamp(DT.friction0 + 0.1*scroll(e), 1e-10, 1);}"/>
        </div>
        <!--滑动摩擦系数-->
        <div v-if="DT.friction">
          <strong>滑动摩擦系数：</strong>
          <a-input style="width:80px" type="number" :value="DT.friction" 
          @wheel="(e)=>{DT.friction = clamp(DT.friction + 0.1*scroll(e), 1e-10, 1);}"/>
        </div>
      </a-collapse-panel>
      <!--材质属性-->
      <a-collapse-panel v-if="DT.mesh.material" header="材质属性" key="材质属性">
        <!--材质类型-->
        <div v-if="DT.mesh.material.type">
          <strong>材质类型：</strong>
          {{ DT.mesh.material.type }}
        </div>
        <!--材质颜色-->
        <div v-if="DT.mesh.material.color">
          <strong>材质颜色：</strong><br/>
          <strong>R:</strong><a-input style="width:80px" type="number" 
          :value="parseInt(DT.mesh.material.color.r * 255)"
          @wheel="(e)=>{
            DT.set('R', scroll(e)/255);
            DT.mesh.material.color.r = clamp(DT.mesh.material.color.r, 0, 1);
          }"/>,
          <strong>G:</strong><a-input style="width:80px" type="number" 
          :value="parseInt(DT.mesh.material.color.g * 255)"
          @wheel="(e)=>{
            DT.set('G', scroll(e)/255);
            DT.mesh.material.color.g = clamp(DT.mesh.material.color.g, 0, 1);
          }"/>,
          <strong>B:</strong><a-input style="width:80px" type="number" 
          :value="parseInt(DT.mesh.material.color.b * 255)"
          @wheel="(e)=>{
            DT.set('B', scroll(e)/255);
            DT.mesh.material.color.b = clamp(DT.mesh.material.color.b, 0, 1);
          }"/>
        </div>
        <!--透明度-->
        <div v-if="DT.mesh.material.opacity">
          <strong>透明度：</strong>
          <a-input style="width:80px" suffix="%" type="number" 
          :value="parseInt(DT.mesh.material.opacity * 100)"
          @wheel="(e)=>{
            DT.set('A', scroll(e)/100);
            DT.mesh.material.opacity = clamp(DT.mesh.material.opacity, 0, 1);
          }"/>
        </div>
      </a-collapse-panel>
    </a-collapse>
  </div>
</template>
