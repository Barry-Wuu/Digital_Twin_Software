<script lang="ts">
  import BUS from "./EventBus"
  import { ref } from 'vue'
  import {
    CheckCircleOutlined,
    CheckOutlined,
    CloseOutlined,
  } from '@ant-design/icons-vue';

  const addCustomProp = ref(false);
  const angle = Math.PI/180;
  const chosenDOM = ref(null);
  const chosenDOM_value = ref(null);
  const customCodeFont = ref(3);
  const DT = ref("未选择对象");
  const editProp = ref('');
  const editValue = ref();
  const helpChange = "点此可修改参数，按下回车键确认修改";
  var main;
  const newCode = ref('');
  const newProp = ref('');
  var popup;
  const popupContent = ref();

  export default{
    components:{CheckCircleOutlined, CheckOutlined, CloseOutlined},
    methods:{
      clearNewProp(){  // 清空并隐藏新增属性输入栏
        addCustomProp.value = false;
        editProp.value = '';
        newProp.value = '';
      },
      createCustomProp(e){
        if(DT.value.custom[newProp.value] == undefined) {
          DT.value.custom[newProp.value] = null;
          this.clearNewProp();
        };
      },
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
      obj2table(data){  // 将自定义属性对象转为a-table对象
        if(!data) return [];
        let result = [];
        for(let prop of Object.keys(data).sort()) {
          result.push({key:prop, prop:prop, value:data[prop]});
        }
        return result;
      },
      prefix(s){  // 获取自定义代码前一行的空格前缀，以便在换行时继承到下一行
        let lastRow = s.split('\n').splice(-1)[0];
        let result = lastRow.match(/^\s+/);
        return result ? result['0'] : '';
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
      setCustomCodeFont(size){  // 更改自定义脚本字体
        let rule = ['xx-small', 'x-small', 'small', 'medium', 'large', 'x-large', 'xx-large'];
        let style = document.getElementById("customCode").style;
        style.fontSize = rule[size];
      },
      setCustomProp(editValue, prop){
        if(editValue.length>0 && editValue[0]=='$'){ 
          DT.value.custom[prop]=JSON.parse(editValue.slice(1));
        }else DT.value.custom[prop]=editValue; 
        editProp.value = null;
      },
      // 滚轮或按回车键更改属性的值，超出范围时取边界值，fixed为小数位数
      setProp({e=null, unit=null, min=null, max=null, delta=1, fixed=0, loop=false, type="number"}){
        let result = chosenDOM_value.value;
        let enter = e.type=="keydown" && e.key=="Enter", scroll = e.type=="wheel";
        if(type=="number"){
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
      },
      showPopup(content){  // 显示自定义属性和脚本弹出窗口
        if(popupContent.value == content){
          this.clearNewProp(); popupContent.value=null; popup.style.display = "none"
        } else {
          popupContent.value = content;
          popup.style.display = "block";
          this.$nextTick(()=>{  // 异步更新窗口位置
            let rect = popup.getBoundingClientRect();
            popup.style.top = (main.offsetHeight - rect.height)/2 + "px";
            popup.style.left = (main.offsetWidth - rect.width)/2 + "px";
            if(content == "code"){
              newCode.value = DT.value.code ? DT.value.code : '';
            }
          });
        }
      },
    },
    setup(){
      return {addCustomProp, angle, BUS, chosenDOM, chosenDOM_value, customCodeFont, DT, 
        editProp, editValue, helpChange, newCode, newProp, popup, popupContent}
    },
    mounted(){
      BUS.on("showProperty", (data:string)=>{
        if('未已'.includes(data[0])) DT.value = data;
        else DT.value = BUS.getDTScene().findDTObjectById(data);
      })
      main = document.getElementById("main");
      popup = document.getElementById("popup"); 

      main.appendChild(popup);  
      var popupHeader = document.getElementById("popup-header");  
      var startM, startP;
      // 点击属性进行编辑
      window.addEventListener("mousedown", this.selectDOM);
      // 拖动弹窗  
      popupHeader.addEventListener("mousedown", (e)=>{  
        e.preventDefault();  
        startM = [e.clientX, e.clientY]
        startP = [popup.getBoundingClientRect().left, popup.getBoundingClientRect().top]
        var onMousemove = function(e) {  
            e.preventDefault();  
            popup.style.left = startP[0] + (e.clientX - startM[0]) + "px";  
            popup.style.top = startP[1] + (e.clientY - startM[1]) + "px";  
        };  
        document.addEventListener("mousemove", onMousemove);  
        document.addEventListener("mouseup", function() {  
          document.removeEventListener("mousemove", onMousemove);  
        });  
      })
      // 退出按钮  
      var popupCloseBtn = document.getElementById('popup-quit');  
      popupCloseBtn.addEventListener('click', function() {  
          popup.style.display = 'none';  
      }); 
    }
  }
</script>

<style>
  .buttonCustomCode{float:right; margin:10px;}
  .customCode{
    margin-top: 10px;
    margin-left: 0px; 
    width: calc(100% - 20px); 
    height: 500px; 
    resize: none; 
    white-space: nowrap
  }
  .input{border:1px solid dodgerblue;}
	.popup{  
    background-color: #fff;  
    border: 2px solid dodgerblue;  
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);  
    border-radius: 10px;  
    display: none;
    position: absolute;
    z-index: 1919;  
  }  
  .popup-header{  
    background: dodgerblue;
    cursor: move;  
    display: flex;  
    justify-content: space-between;  
    align-items: center;   
    padding-left:10px
  }  
  .row{display:block; margin-top:3px; margin-bottom:3px;}
</style>

<template>
  <h2 v-if="typeof DT == 'string'">{{ DT }}</h2>
  <div v-else style="text-align:left">   
    <a-collapse :default-active-key="[
      '基本属性', '几何属性', '物理属性', '材质属性', '代码属性', '自定义属性', '自定义脚本'
      ]">
      <!--基本属性-->
      <a-collapse-panel header="基本属性" key="基本属性">

        <!--物体类型-->
        <div v-if="'type' in DT" class="row">
          <strong>物体类型：</strong>{{ DT.type }}
        </div>

        <!--物体名称-->
        <div v-if="'name' in DT" class="row">
          <strong>物体名称：</strong>{{ DT.name }}
        </div>

        <!--物体ID-->
        <div v-if="'id' in DT" class="row">
          <strong>物体ID：</strong>{{ DT.id }}
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
            @keydown="(e)=>setProp({e:e, fixed:2})" @mouseout="chosenDOM=null"
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
            @keydown="(e)=>setProp({e:e, fixed:2})" @mouseout="chosenDOM=null"
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
            @keydown="(e)=>setProp({e:e, fixed:2})" @mouseout="chosenDOM=null"
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
            @mouseout="chosenDOM=null"
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
            @mouseout="chosenDOM=null"
          />
          <a-input :style="propStyle(prop[0], 80)" v-else
            :value="loop(Math.round(prop[1]/angle), 360)"
            @wheel="(e)=>setProp({e:e, unit:angle, min:0, max:360, delta:10, fixed:2, loop:true})"
          />
        </span>&nbsp;

        <span :title="helpChange" v-for="prop in hasProp('mesh.rotation.z')">
          <strong>z:</strong>
          <a-input class="input" :style="propStyle(prop[0], 80)"
            v-model:value="chosenDOM_value" v-if="chosenDOM == prop[0]" 
            @keydown="(e)=>setProp({e:e, unit:angle, min:0, max:360, fixed:2, loop:true})" 
            @mouseout="chosenDOM=null"
          />
          <a-input :style="propStyle(prop[0], 80)" v-else
            :value="loop(Math.round(prop[1]/angle), 360)"
            @wheel="(e)=>setProp({e:e, unit:angle, min:0, max:360, delta:10, fixed:2, loop:true})"
          />
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
            @keydown="(e)=>setProp({e:e, min:1, max:10, fixed:2})" @mouseout="chosenDOM=null"
          />
          <a-input :style="propStyle(prop[0], 80)" v-else
            :value="(prop[1]/1000).toFixed(3)"
            @wheel="(e)=>setProp({e:e, delta:0.001, unit:1000, min:1, max:10, fixed:3})"
          />s
        </span>

        <div v-if="DT.timer">{{DT.timer}}</div>

        <!--天空颜色-->
        <span :title="helpChange" v-for="prop in hasProp('skybox.skyColor')" class="row">
          <strong>天空颜色：</strong>
          <a-input class="input" :style="propStyle(prop[0], 120)"
            v-model:value="chosenDOM_value" v-if="chosenDOM == prop[0]" 
            @keydown="(e)=>{setProp({e:e, type:typeof prop[1]}); BUS.emit('updateSkybox')}" 
            @mouseout="chosenDOM=null"
          />
          <a-input :style="propStyle(prop[0], 120)" v-else :value="prop[1]"/>
        </span>

        <!--天际线颜色-->
        <span :title="helpChange" v-for="prop in hasProp('skybox.skyline')" class="row">
          <strong>天际线颜色：</strong>
          <a-input class="input" :style="propStyle(prop[0], 120)"
            v-model:value="chosenDOM_value" v-if="chosenDOM == prop[0]" 
            @keydown="(e)=>{setProp({e:e, type:typeof prop[1]}); BUS.emit('updateSkybox')}" 
            @mouseout="chosenDOM=null"
          />
          <a-input :style="propStyle(prop[0], 120)" v-else :value="prop[1]"/>
        </span>

        <!--地面颜色-->
        <span :title="helpChange" v-for="prop in hasProp('skybox.groundColor')" class="row">
          <strong>地面颜色：</strong>
          <a-input class="input" :style="propStyle(prop[0], 120)"
            v-model:value="chosenDOM_value" v-if="chosenDOM == prop[0]" 
            @keydown="(e)=>{setProp({e:e, type:typeof prop[1]}); BUS.emit('updateSkybox')}" 
            @mouseout="chosenDOM=null"
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
            @keydown="(e)=>setProp({e:e, min:0.1, max:5, fixed:2})" @mouseout="chosenDOM=null"
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
            @keydown="(e)=>setProp({e:e, min:0, max:1, fixed:2})" @mouseout="chosenDOM=null"
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
            @keydown="(e)=>setProp({e:e, min:0, max:1, fixed:2})" @mouseout="chosenDOM=null"
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
            @keydown="(e)=>setProp({e:e, min:0.1, max:5, fixed:2})" @mouseout="chosenDOM=null"
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
              @mouseout="chosenDOM=null"
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
              @mouseout="chosenDOM=null"
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
              @mouseout="chosenDOM=null"
            />
            <a-input :style="propStyle(prop[0], 80)" v-else
              :value="parseInt(prop[1]*255)"
              @wheel="(e)=>setProp({e:e, unit:1/255, min:0, max:255})"
            />&nbsp;
          </span>
        </div>

        <!--透明度-->
        <span :title="helpChange" v-for="prop in hasProp('mesh.material.opacity')" class="row">
          <strong>透明度：</strong>
          <a-input class="input" :style="propStyle(prop[0], 80)"
            v-model:value="chosenDOM_value" v-if="chosenDOM == prop[0]" 
            @keydown="(e)=>setProp({e:e, unit:0.01, min:0, max:100})" @mouseout="chosenDOM=null"
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
        <a-button @click="showPopup('prop')">编辑自定义属性</a-button>  
      </a-collapse-panel>

      <!--自定义脚本-->
      <a-collapse-panel v-if="DT.custom" header="自定义脚本" key="自定义脚本">
        <a-button @click="showPopup('code');">编辑自定义脚本</a-button>  
      </a-collapse-panel>
    </a-collapse>
  </div>

  <!--弹出式窗口-->
  <div id="popup" class="popup" 
  :style="popupContent=='prop' ? {'width': '600px'} : {'width': '800px'}">
    <!--头部拖动栏-->  
    <div id="popup-header" class="popup-header">  
      <strong style="color:white">
        <div v-if="popupContent=='prop'">自定义属性</div>
        <div v-if="popupContent=='code'">自定义脚本</div>
      </strong>  
      <a-button id="popup-quit" danger type="primary" @click="
        clearNewProp(); popupContent=null; popup.style.display='none';
      ">
        <CloseOutlined/>
      </a-button>  
    </div>  

    <div class="popup-content" id="popup-content">  
      <!--工具栏-->  
      <span v-if="popupContent=='prop'" style="display:flex; margin:10px">
        <a-button @click="addCustomProp=true; editProp = '';" 
        :disabled="addCustomProp">点此添加属性</a-button>&nbsp;
        <div v-if="addCustomProp">
          <a-input
            v-model:value="newProp"
            placeholder="属性名"
            style="width:200px"
            @keydown="(e)=>{if(e.key=='Enter') createCustomProp(e)}"
          />&nbsp;
          <a-button style="border:#0B0 solid 1px; color:#0B0" @click="createCustomProp(e);">
            <CheckOutlined/>
          </a-button>&nbsp;
          <a-button danger @click="clearNewProp"><CloseOutlined/></a-button>
        </div>
      </span>

      <!--自定义属性表--> 
      <a-table v-if="popupContent=='prop'" bordered :data-source="obj2table(DT.custom)">
        <a-table-column title="属性" data-index="prop">
          <template #default="{ value:prop }">
            <div>{{ prop }}</div>
          </template>
        </a-table-column>
        <a-table-column title="值" data-index="prop">
          <template #default="{ value:prop }">
            <a-input v-if="editProp==prop" v-model:value="editValue"
            size="small" style="width:120px"
            @keydown="(e)=>{if(e.key=='Enter') setCustomProp(editValue, prop)}">
            <template #suffix>
              <CheckCircleOutlined @click="setCustomProp(editValue, prop)"
            />
            </template>
            </a-input>
            <div v-else>{{ DT.custom[prop] }}</div>
          </template>
        </a-table-column>
        <a-table-column title="类型" data-index="value">
          <template #default="{ value }">
            <div>{{ typeof value }}</div>
          </template>
        </a-table-column>
        <a-table-column title="操作" data-index="prop" >
          <template #default="{ value:prop }">
            <a v-if="editProp!=prop" @click="
              editProp=prop; editValue=DT.custom[prop];
            ">编辑</a>
            <a v-else @click="editProp=null">取消</a>
            <a @click="delete DT.custom[prop]" style="margin-left:10px">删除</a>
          </template>
        </a-table-column>
      </a-table>

      <!--自定义脚本-->
      <textarea v-if="popupContent=='code'" class="customCode" id="customCode" placeholder="自定义脚本"
      v-model="newCode"
      v-on="this.$nextTick(()=>{setCustomCodeFont(customCodeFont)})"
      @keydown="(e)=>{ 
        let textarea = e.target;
        let insert = '';
        const start = textarea.selectionStart;  
        const end = textarea.selectionEnd;  
        const text = textarea.value;  
        const text0 = text.substring(0, start);  
        const text1 = text.substring(end, text.length);
        if (e.key == 'Enter'){  // 换行时继承前一行的空格前缀
          e.preventDefault(); 
          insert = '\n' + prefix(text0);
        } else if (e.key == 'Tab') {  // 按Tab键时在光标处插入制表符 
          e.preventDefault();
          insert = '    '; 
        } 
        textarea.value = text0 + insert + text1;  
        textarea.selectionStart = textarea.selectionEnd = start + insert.length;  
      }"/>
      <a-button v-if="popupContent=='code'" class="buttonCustomCode"
      @click="DT.code=newCode" :disabled="newCode==DT.code">
        保存
      </a-button>
      <a-button v-if="popupContent=='code'" class="buttonCustomCode"
      @click="newCode=''" :disabled="newCode==''">
        清空
      </a-button>
      <span style="display:flex;" class="buttonCustomCode">
        <div v-if="popupContent=='code'" style="margin-top:4px">字体大小：</div>
        <a-slider v-if="popupContent=='code'" :min=0 :max=6 :step=1 :tooltipVisible="false" 
        @change="(e)=>{customCodeFont=e;}" 
        :value="customCodeFont" style="width: 100px"/>
      </span>
    </div>  
  </div>  
</template>
