<script lang="ts">
  import global from "./Global"
  import { ref } from 'vue'

  const angle = Math.PI/180;
  const chosenDOM = ref(null);
  const chosenDOM_value = ref(null);
  const DT = ref("未选择对象");

  export default{
    methods:{
      hasProp(prop){  // DT对象有某属性则显示，无则不显示
        let node = DT.value;
        for(let p of prop.split('.')){
          if(node[p] == undefined) return [];
          node = node[p];
        }
        return [[[prop], node]];  // 也返回该属性的值
      },
      loop(x, max){  // 限定x在0~max之间循环，比如角度
        x = JSON.parse(x);
        return x%max + (x<0 ? max : 0);
      },
      propStyle(prop, width){
        return {editable:true, prop:prop, width:width + "px"};
      },
      selectDOM(e){  // 点击属性进行编辑
        let DOM = e.target;
        try{
          if(DOM.style.editable){
            chosenDOM_value.value = DOM.value;
            chosenDOM.value = DOM.style.prop;
          } else {
            chosenDOM_value.value = null;
            chosenDOM.value = null;
          }
        } catch {}
      },
      setColor(e){  // 更改材质颜色
        if(e.type=='keydown' && e.key=='Enter'){
          DT.value.mesh.material.color.setStyle(e.target.value);
          if(DT.value.mesh.userData.ground){  // 更改地面颜色时同时更改雾的颜色
            global.emit("changeFogColor");
          }
        }
      },
      // 滚轮或按回车键更改属性的值，超出范围时取边界值，fixed为小数位数
      setProp({e=null, unit=null, min=null, max=null, delta=1, fixed=0, loop=false, type="number"}){
        let result = chosenDOM_value.value;
        let enter = e.type=="keydown" && e.key=="Enter", scroll = e.type=="wheel";
        if(type == "number"){
          if(enter){result = JSON.parse(chosenDOM_value.value);}
          else if(scroll){
            e.preventDefault();
            result = e.target.value - e.deltaY/100*delta;
          }
          else return;
          let clamped = result.toFixed(fixed);
          if(loop) result = this.loop(clamped, 360);
          else if(min!=null && result<min) {result = min; clamped = result;}
          else if(max!=null && result>max) {result = max; clamped = result;}
          clamped = result;
          if(unit) result *= unit;
          if(enter || scroll){
            DT.value.setProp(e.target.style.prop, result);
          } 
          chosenDOM_value.value = unit ? clamped : clamped.toFixed(2);
        } else if(enter || scroll){
          DT.value.setProp(e.target.style.prop, result);
        } 
        if(DT.value.mesh.userData.ground){  // 更改地面颜色时同时更改雾的颜色
          global.emit("changeFogColor");
        }
      },
    },
    setup(){
      return {angle, global, chosenDOM, chosenDOM_value, DT}
    },
    mounted(){
      global.on("showProperty", (data)=>{
        if('未已'.includes(data[0])) DT.value = data;
        else if(data == "asset") {DT.value = window.assetDT;}
        else DT.value = global.DTScene().findDTObjectById(data);
      })
      // 点击属性进行编辑
      window.addEventListener("mousedown", this.selectDOM);
    }
  }
</script>

<style>
  .input{
    border:1px solid dodgerblue;
  }
  .row{
    display:block;
    margin-top:3px; 
    margin-bottom:3px;
  }
</style>

<template>
  <h2 v-if="typeof DT == 'string'">{{ DT }}</h2>
  <div v-else style="text-align:left; wrap:nowrap;">   
    <a-collapse :default-active-key="[
      '基本属性', '几何属性', '物理属性', '材质属性', '代码属性', '自定义属性', '自定义脚本'
      ]">
      <!--基本属性-->
      <a-collapse-panel header="基本属性" key="基本属性">

        <!--物体类型-->
        <div v-if="'type' in DT" class="row">
          <strong>物体类型：</strong>{{ DT.type }}
        </div>

        <!--物体ID-->
        <div v-if="'id' in DT" class="row">
          <strong>物体ID：</strong>{{ DT.id }}
        </div>

        <!--物体名称-->
        <div v-if="'name' in DT" class="row">
          <strong>物体名称：</strong>{{ DT.name }}
        </div>

        <!--是否可见-->
        <div v-if="'visible' in DT.mesh" class="row">
          <strong>是否可见：</strong>
          <a-checkbox :checked="DT.mesh.visible" 
          @click="()=>{DT.mesh.visible = !DT.mesh.visible}">
            {{ DT.mesh.visible ? "是" : "否" }}
          </a-checkbox>
        </div>

        <!--位置-->
        <div v-if="'position' in DT.mesh" class="row">
          <strong>位置：</strong>
        </div>

        <span :title="helpChange" v-for="prop in hasProp('mesh.position.x')">
          <strong>x:</strong>
          <a-input class="input" :style="propStyle(prop[0], 80)"
            v-model:value="chosenDOM_value" v-if="chosenDOM == prop[0]" 
            @keydown="(e)=>setProp({e:e, fixed:2})"
          />
          <a-input :style="propStyle(prop[0], 80)" v-else
            :value="prop[1].toFixed(2)"
            @wheel="(e)=>setProp({e:e, fixed:2})"
          />
        </span>&nbsp;
        
        <strong>y:</strong>
        <span :title="helpChange" v-for="prop in hasProp('mesh.position.y')">
          <a-input class="input" :style="propStyle(prop[0], 80)"
            v-model:value="chosenDOM_value" v-if="chosenDOM == prop[0]" 
            @keydown="(e)=>setProp({e:e, fixed:2})"
          />
          <a-input :style="propStyle(prop[0], 80)" v-else
            :value="prop[1].toFixed(2)" 
            @wheel="(e)=>setProp({e:e, fixed:2})"
          />
        </span>&nbsp;
        
        <strong>z:</strong>
        <span :title="helpChange" v-for="prop in hasProp('mesh.position.z')">
          <a-input class="input" :style="propStyle(prop[0], 80)"
            v-model:value="chosenDOM_value" v-if="chosenDOM == prop[0]" 
            @keydown="(e)=>setProp({e:e, fixed:2})"
          />
          <a-input :style="propStyle(prop[0], 80)" v-else
            :value="prop[1].toFixed(2)" 
            @wheel="(e)=>setProp({e:e, fixed:2})"
          />
        </span>
        
        <!--旋转-->
        <div v-if="'rotation' in DT.mesh" class="row">
          <strong>旋转：</strong>
        </div>
          
        <span :title="helpChange" v-for="prop in hasProp('mesh.rotation.x')">
          <strong>x:</strong>
          <a-input class="input" :style="propStyle(prop[0], 80)"
            v-model:value="chosenDOM_value" v-if="chosenDOM == prop[0]" 
            @keydown="(e)=>setProp({e:e, unit:angle, min:0, max:360, fixed:2, loop:true})" 
           
          />
          <a-input :style="propStyle(prop[0], 80)" v-else
            :value="loop(Math.round(prop[1]/angle), 360)"
            @wheel="(e)=>setProp({e:e, unit:angle, min:0, max:360, delta:10, fixed:2, loop:true})"
          />°
        </span>

        <span :title="helpChange" v-for="prop in hasProp('mesh.rotation.y')">
          <strong>y:</strong>
          <a-input class="input" :style="propStyle(prop[0], 80)"
            v-model:value="chosenDOM_value" v-if="chosenDOM == prop[0]" 
            @keydown="(e)=>setProp({e:e, unit:angle, min:0, max:360, fixed:2, loop:true})" 
           
          />
          <a-input :style="propStyle(prop[0], 80)" v-else
            :value="loop(Math.round(prop[1]/angle), 360)"
            @wheel="(e)=>setProp({e:e, unit:angle, min:0, max:360, delta:10, fixed:2, loop:true})"
          />°
        </span>&nbsp;

        <span :title="helpChange" v-for="prop in hasProp('mesh.rotation.z')">
          <strong>z:</strong>
          <a-input class="input" :style="propStyle(prop[0], 80)"
            v-model:value="chosenDOM_value" v-if="chosenDOM == prop[0]" 
            @keydown="(e)=>setProp({e:e, unit:angle, min:0, max:360, fixed:2, loop:true})" 
           
          />
          <a-input :style="propStyle(prop[0], 80)" v-else
            :value="loop(Math.round(prop[1]/angle), 360)"
            @wheel="(e)=>setProp({e:e, unit:angle, min:0, max:360, delta:10, fixed:2, loop:true})"
          />°
        </span>  

        <!--比例-->
        <div v-if="DT.scale" class="row">
          <strong>比例：</strong>{{DT.scale}}
        </div>

        <!--发生时间间隔-->
        <span :title="helpChange" v-for="prop in hasProp('timeInterval')" class="row">
          <strong>发生时间间隔：</strong>
          <a-input class="input" :style="propStyle(prop[0], 80)"
            v-model:value="chosenDOM_value" v-if="chosenDOM == prop[0]" 
            @keydown="(e)=>setProp({e:e, min:1, max:10, fixed:2})"
          />
          <a-input :style="propStyle(prop[0], 80)" v-else
            :value="(prop[1]/1000).toFixed(3)"
            @wheel="(e)=>setProp({e:e, delta:0.001, unit:1000, min:1, max:10, fixed:3})"
          />s
        </span>

        <!--天空颜色-->
        <span :title="helpChange" v-for="prop in hasProp('skybox.skyColor')" class="row">
          <strong>天空颜色：</strong>
          <a-input class="input" :style="propStyle(prop[0], 120)"
            v-model:value="chosenDOM_value" v-if="chosenDOM == prop[0]" 
            @keydown="(e)=>{setProp({e:e, type:typeof prop[1]}); global.emit('updateSkybox')}" 
           
          />
          <a-input :style="propStyle(prop[0], 120)" v-else :value="prop[1]"/>
        </span>

        <!--天际线颜色-->
        <span :title="helpChange" v-for="prop in hasProp('skybox.skyline')" class="row">
          <strong>天际线颜色：</strong>
          <a-input class="input" :style="propStyle(prop[0], 120)"
            v-model:value="chosenDOM_value" v-if="chosenDOM == prop[0]" 
            @keydown="(e)=>{setProp({e:e, type:typeof prop[1]}); global.emit('updateSkybox')}" 
           
          />
          <a-input :style="propStyle(prop[0], 120)" v-else :value="prop[1]"/>
        </span>

        <!--地面颜色-->
        <span :title="helpChange" v-for="prop in hasProp('skybox.groundColor')" class="row">
          <strong>地面颜色：</strong>
          <a-input class="input" :style="propStyle(prop[0], 120)"
            v-model:value="chosenDOM_value" v-if="chosenDOM == prop[0]" 
            @keydown="(e)=>{setProp({e:e, type:typeof prop[1]}); global.emit('updateSkybox')}" 
           
          />
          <a-input :style="propStyle(prop[0], 120)" v-else :value="prop[1]"/>
        </span>
      </a-collapse-panel>

      <!--几何属性-->
      <a-collapse-panel v-if="DT.geometry" header="几何属性" key="几何属性">
        <!--几何体类型-->
        <div v-if="DT.geometry.type">
          <strong>几何体类型：</strong>
          {{DT.geometry.type}}
        </div>

        <!--模型路径-->
        <div v-if="typeof DT.geometry.userData == 'string'" class="row">
          <strong>模型路径：</strong>
          {{DT.geometry.userData}}
        </div>

        <!--顶点数-->
        <div v-if="DT.geometry.attributes.position" class="row">
          <strong>顶点数：</strong>
          {{DT.geometry.attributes.position.count}}
        </div>

        <!--法向量数-->
        <div v-if="DT.geometry.attributes.normal" class="row">
          <strong>法向量数：</strong>
          {{DT.geometry.attributes.normal.count}}
        </div>

        <!--UV坐标数-->
        <div v-if="DT.geometry.attributes.uv" class="row">
          <strong>UV坐标数：</strong>
          {{DT.geometry.attributes.uv.count}}
        </div>

        <!--包围盒-->
        <div v-if="DT.geometry.boundingBox" class="row">
          <strong>包围盒最小值：</strong>
          x:&nbsp{{(DT.geometry.boundingBox.min.x * DT.scale).toFixed(2)}},
          y:&nbsp{{(DT.geometry.boundingBox.min.y * DT.scale).toFixed(2)}},
          z:&nbsp{{(DT.geometry.boundingBox.min.z * DT.scale).toFixed(2)}}
          <br><strong>包围盒最大值：</strong>
          x:&nbsp{{(DT.geometry.boundingBox.max.x * DT.scale).toFixed(2)}},
          y:&nbsp{{(DT.geometry.boundingBox.max.y * DT.scale).toFixed(2)}},
          z:&nbsp{{(DT.geometry.boundingBox.max.z * DT.scale).toFixed(2)}}
        </div>
      </a-collapse-panel>
      <a-collapse-panel v-else disabled header="几何属性（无）"/>

      <!--物理属性-->
      <a-collapse-panel v-if="DT.rigid" header="物理属性" key="物理属性">

        <!--刚体类型-->
        <div v-if="DT.rigidShape" class="row">
          <strong>刚体形状：</strong>
          {{DT.rb.constructor.name}}
        </div>

        <!--刚体-->
        <div v-if="DT.rigid" class="row">
          <strong>刚体：</strong>{{ DT.rigid ? "是" : "否" }}
        </div>

        <!--质量-->
        <span :title="helpChange" v-for="prop in hasProp('mass')" class="row">
          <strong>质量：</strong>
          <a-input class="input" :style="propStyle(prop[0], 80)"
            v-model:value="chosenDOM_value" v-if="chosenDOM == prop[0]" 
            @keydown="(e)=>setProp({e:e, min:0.1, max:5, fixed:2})"
          />
          <a-input :style="propStyle(prop[0], 80)" v-else
            :value="prop[1].toFixed(2)"
            @wheel="(e)=>setProp({e:e, delta:0.1, min:0.1, max:5, fixed:2})"
          />
        </span>

        <!--静摩擦系数-->
        <span :title="helpChange" v-for="prop in hasProp('friction0')" class="row">
          <strong>静摩擦系数：</strong>
          <a-input class="input" :style="propStyle(prop[0], 80)"
            v-model:value="chosenDOM_value" v-if="chosenDOM == prop[0]" 
            @keydown="(e)=>setProp({e:e, min:0, max:1, fixed:2})"
          />
          <a-input :style="propStyle(prop[0], 80)" v-else
            :value="prop[1].toFixed(2)"
            @wheel="(e)=>setProp({e:e, delta:0.1, min:0, max:1, fixed:2})"
          />
        </span>

        <!--滑动摩擦系数-->
        <span :title="helpChange" v-for="prop in hasProp('friction')" class="row">
          <strong>滑动摩擦系数：</strong>
          <a-input class="input" :style="propStyle(prop[0], 80)"
            v-model:value="chosenDOM_value" v-if="chosenDOM == prop[0]" 
            @keydown="(e)=>setProp({e:e, min:0, max:1, fixed:2})"
          />
          <a-input :style="propStyle(prop[0], 80)" v-else
            :value="prop[1].toFixed(2)"
            @wheel="(e)=>setProp({e:e, delta:0.1, min:0, max:1, fixed:2})"
          />
        </span>

        <!--传送带速度-->
        <span :title="helpChange" v-for="prop in hasProp('v0')" class="row">
          <strong>传送带速度：</strong>
          <a-input class="input" :style="propStyle(prop[0], 80)"
            v-model:value="chosenDOM_value" v-if="chosenDOM == prop[0]" 
            @keydown="(e)=>setProp({e:e, min:0.1, max:5, fixed:2})"
          />
          <a-input :style="propStyle(prop[0], 80)" v-else
            :value="prop[1].toFixed(2)"
            @wheel="(e)=>setProp({e:e, delta:0.1, min:0.1, max:5, fixed:2})"
          />m/s
        </span>
      </a-collapse-panel>
      <a-collapse-panel v-else disabled header="物理属性（无）"/>

      <!--材质属性-->
      <a-collapse-panel v-if="DT.mesh.material" header="材质属性" key="材质属性">

        <!--材质类型-->
        <div v-if="DT.mesh.material.type" class="row">
          <strong>材质类型：</strong>
          {{ DT.mesh.material.type }}
        </div>

        <!--材质颜色-->
        <div v-if="DT.mesh.material.color" class="row">
          <strong>材质颜色：</strong><br/>

          <span :title="helpChange" v-for="prop in hasProp('mesh.material.color.r')">
            <strong>R:</strong>
            <a-input class="input" :style="propStyle(prop[0], 80)"
              v-model:value="chosenDOM_value" v-if="chosenDOM == prop[0]" 
              @keydown="(e)=>setProp({e:e, unit:1/255, min:0, max:255})" 
             
            />
            <a-input :style="propStyle(prop[0], 80)" v-else
              :value="parseInt(prop[1]*255)"
              @wheel="(e)=>setProp({e:e, unit:1/255, min:0, max:255})"
            />&nbsp;
          </span>

          <span :title="helpChange" v-for="prop in hasProp('mesh.material.color.g')">
            <strong>G:</strong>
            <a-input class="input" :style="propStyle(prop[0], 80)"
              v-model:value="chosenDOM_value" v-if="chosenDOM == prop[0]" 
              @keydown="(e)=>setProp({e:e, unit:1/255, min:0, max:255})" 
             
            />
            <a-input :style="propStyle(prop[0], 80)" v-else
              :value="parseInt(prop[1]*255)"
              @wheel="(e)=>setProp({e:e, unit:1/255, min:0, max:255})"
            />&nbsp;
          </span>

          <span :title="helpChange" v-for="prop in hasProp('mesh.material.color.b')">
            <strong>B:</strong>
            <a-input class="input" :style="propStyle(prop[0], 80)"
              v-model:value="chosenDOM_value" v-if="chosenDOM == prop[0]" 
              @keydown="(e)=>setProp({e:e, unit:1/255, min:0, max:255})"
             
            />
            <a-input :style="propStyle(prop[0], 80)" v-else
              :value="parseInt(prop[1]*255)"
              @wheel="(e)=>setProp({e:e, unit:1/255, min:0, max:255})"
            />&nbsp;
          </span><br>

          <!--更改颜色-->
          更改颜色：
          <span :title="helpChange">
            <a-input style="width: 120px" placeholder="输入CSS颜色"
            @keydown="setColor"/>
          </span> 
        </div>

        <!--透明度-->
        <span :title="helpChange" v-for="prop in hasProp('mesh.material.opacity')" class="row">
          <strong>透明度：</strong>
          <a-input class="input" :style="propStyle(prop[0], 80)"
            v-model:value="chosenDOM_value" v-if="chosenDOM == prop[0]" 
            @keydown="(e)=>setProp({e:e, unit:0.01, min:0, max:100})"
          />
          <a-input :style="propStyle(prop[0], 80)" v-else
            :value="parseInt(prop[1]*100)"
            @wheel="(e)=>setProp({e:e, unit:0.01, min:0, max:100})"
          />%
        </span>

      </a-collapse-panel>
      <a-collapse-panel v-else disabled header="材质属性（无）"/>

      <!--自定义属性-->
      <a-collapse-panel v-if="DT.custom" header="自定义属性" key="自定义属性">
        <a-button @click="global.emit('popup', {DT: DT, type: 'prop'})">
          编辑自定义属性
        </a-button>  
      </a-collapse-panel>

      <!--自定义脚本-->
      <a-collapse-panel v-if="DT.custom" header="自定义脚本" key="自定义脚本">
        <a-button @click="global.emit('popup', {DT: DT, type: 'code'})">
          编辑自定义脚本
        </a-button>  
      </a-collapse-panel>
    </a-collapse>
  </div>
</template>./Global