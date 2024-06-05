<script lang="ts">
  import * as THREE from "three"
  import global from "../Global"
  import { ref } from 'vue'
  import colorRing from "../assets/icons/colorRing.jpg"
  import tubeIcon from "../assets/icons/吸管.jpg"
import { progressProps } from "ant-design-vue/es/progress/props"

  const chosenProp = ref('');
  var colorEdit = '';
  const DT: any = ref("未选择对象");
  const input_value = ref(null);
  const options: any = {  // options为变量格式要求，此处为其默认值，其各参数为：
    e: null,  // 操作事件
    item: '',  // 被选择的属性名，在点击输入框时由内部设置
    min: null,  // 最小值
    max: null,  // 最大值
    delta: 1,  // 用滚轮滚动时的变化量
    fixed: 2,  // 保留小数位数
    loop: false,  // 是否循环（如角度）
    type: "number",  // 属性类型
    suffix: '',  // 后缀
    unit: null,  // 比例尺（如弧度转角度时为π/180，系数转百分比时为0.01）
  };
  const tempAngle = ref(-1);

  export default {
    inject: ['tube'],
    props: {  // 单独传入的参数
      bold: {default: true},
      content: {},
      options: {default: options},
      prop: {},
      title: {},
      type: {},
      width: {default: 80},
    },
    computed:{  // 计算属性
      computedProp: {
        get() {
          if(chosenProp.value == this.prop) return input_value.value;  // 编辑中
          let result = eval("DT.value." + this.prop);
          if(this.prop == "name" && !result) return "未命名";
          else if(this.type == "inputColor"){  // 显示颜色
            return '#' + result.getHexString();
          }
          return this.format(result);  // 显示属性
        },
        set(value, item='') {
          if(chosenProp.value == this.prop) input_value.value = value;  // 编辑中
          else{
            let result = "DT.value." + this.prop;
            if(DT.value.mesh.isLight) {  // 显示或隐藏光源图标
              let e = DT.value.mesh.children.filter(mesh => mesh.isCSS2DObject)[0].element;
              e.style.height = value ? "30px" : "0px";
            }
            if(this.type == "inputColor") eval(result).setStyle(value);  // 更改颜色
            else if(item) eval(`${result+'.'+item} = ${value}`);  // 更改分量
            else eval(`${result} = ${value}`);  // 更改属性
          }
        }
      },
      computedX: {
        get(){
          if(this.propX) return this.format(this.propX);  // 拖动物体时强制更新属性值
          let result = eval("DT.value." + this.prop);
          if(result.isVector3 || result.isEuler){  // 编辑向量
            if(chosenProp.value == this.prop + '.x') return input_value.value;  // 编辑中
            else return this.format(result.x);
          }
          if(result.isColor){  // 编辑颜色
            if(chosenProp.value == this.prop + '.r') return input_value.value;  // 编辑中
            return this.format(result.r, 255);
          }
          return;
        },
        set(value){
          let result = eval("DT.value." + this.prop);
          if(result.isVector3 || result.isEuler){  // 编辑向量
            if(chosenProp.value == this.prop + '.x') input_value.value = value;  // 编辑中
          }
          if(result.isColor){  // 编辑向量
            if(chosenProp.value == this.prop + '.r') input_value.value = value;  // 编辑中
          }
        }
      },
      computedY: {
        get(){
          if(this.propY) return this.format(this.propY);  // 拖动物体时强制更新属性值
          let result = eval("DT.value." + this.prop);
          if(result.isVector3 || result.isEuler){  // 编辑向量
            if(chosenProp.value == this.prop + '.y') return input_value.value;  // 编辑中
            else return this.format(result.y); 
          }
          if(result.isColor){  // 编辑颜色
            if(chosenProp.value == this.prop + '.g') return input_value.value;  // 编辑中
            return this.format(result.g, 255);
          }
          return;
        },
        set(value){
          let result = eval("DT.value." + this.prop);
          if(result.isVector3 || result.isEuler){  // 编辑向量
            if(chosenProp.value == this.prop + '.y') input_value.value = value;  // 编辑中
          }
          if(result.isColor){  // 编辑向量
            if(chosenProp.value == this.prop + '.g') input_value.value = value;  // 编辑中
          }
        }
      },
      computedZ: {
        get(){
          if(this.propZ) return this.format(this.propZ);  // 拖动物体时强制更新属性值
          let result = eval("DT.value." + this.prop);
          if(result.isVector3 || result.isEuler){  // 编辑向量
            if(chosenProp.value == this.prop + '.z') return input_value.value;  // 编辑中
            else return this.format(result.z);   
          }
          if(result.isColor){  // 编辑颜色
            if(chosenProp.value == this.prop + '.b') return input_value.value;  // 编辑中
            return this.format(result.b, 255);
          }
          return;
        },
        set(value){
          let result = eval("DT.value." + this.prop);
          if(result.isVector3 || result.isEuler){  // 编辑向量
            if(chosenProp.value == this.prop + '.z') input_value.value = value;  // 编辑中
          }
          if(result.isColor){  // 编辑向量
            if(chosenProp.value == this.prop + '.b') input_value.value = value;  // 编辑中
          }
        }
      }
    },
    data(){
      return {
        chosenProp, 
        colorRing,
        DT,
        help:{
          color: "点击此处更改颜色",
          input: "点此可修改参数，按下回车键确认修改",
          tube: "点此可使用吸管吸取颜色",
        },
        input_value, 
        propX: null,
        propY: null,
        propZ: null,
        tempAngle,
        tubeIcon,
      };
    },
    methods:{
      changeColor(e, item){  // 修改颜色的分量
        this.changeValue({e:e, item:item, unit:1/255, min:0, max:255});
      },
      changeValue({e, item='',  // 按回车键或滚轮时更改属性的值，超出范围时取边界值，fixed为小数位数
        unit=null, min=null, max=null, delta=1, fixed=2, loop=false, type="number"}){
        input_value.value = e.target.value;
        let blur = e.type == "blur";
        let enter = e.type == "keydown" && e.key == "Enter";
        let wheel = e.type == "wheel";
        if(!(blur || enter || wheel)) return;
        let result = input_value.value;
        if(type == "number"){
          result = JSON.parse(input_value.value);
          if(wheel) result -= e.deltaY / 100 * delta;
          if(loop) result = this.loop(result);
          if(typeof min == "number" && result < min) result = min;
          if(typeof max == "number" && result > max) result = max;
          if(typeof fixed == "number") result = result.toFixed(fixed);
          if(unit) result *= unit;
          input_value.value = result;
        }
        if(this.prop == "scale") {  // 改变导入模型的比例
            DT.value.mesh.scale.setScalar(result);
        }
        let prop = "DT.value." + this.prop + (item ? '.' + item : '');  // 结束编辑时更改属性值
        if(eval(prop).isColor) eval(prop).setStyle(result);
        else {eval(`${prop} = ${result}`);}
        this.$emit("change");
        global.emit("controlStart", DT.value.id);
        chosenProp.value = null;  // 结束编辑
      },   
      format(prop, N=1){  // 将输出参数格式化
        try{
          prop = JSON.parse(prop);
          if(N!=1) return Math.floor(prop*N);  // 将属性值放大N或unit倍    
          if(this.options.unit) prop /= this.options.unit; 
          if(this.options.loop){  // 归一化循环的变量，比如将角度归一化到0~360
            prop = this.loop(prop);
          }
          if(typeof this.options.fixed == "number"){  // 保留fixed位小数
            prop = prop.toFixed(this.options.fixed);
          }
          else prop = prop.toFixed(2);  // 默认保留两位小数
          return prop;
        }
        catch {return prop;}  // 字符串型变量
      },
      getColor(){  // 异步吸取颜色
        const promise = this.tube.open();
        promise.then(
          (result) => {  // 完成吸色
            let color = eval("DT.value." + this.prop);
            color.setStyle(result.sRGBHex);
          }, 
          ()=>{}  // 退出吸色
        );
      },
      getHSL(item){
        let hsl = {h:0, s:0, l:0};
        this.getProp().getHSL(hsl);
        return hsl[item];
      },
      getHSLpos(){  // 获取颜色在调色方块上的坐标
        let rgb = {r:0, g:0, b:0}, rgb0 = {r:0, g:0, b:0}, hsl = {h:0, s:0, l:0};
        this.getProp().getRGB(rgb);
        this.getProp().getHSL(hsl);
        let color0 = new THREE.Color();
        color0.setHSL(hsl.h, 1, 0.5);
        color0.getRGB(rgb0);
        let r = rgb.r, g = rgb.g, r0 = rgb0.r, g0 = rgb0.g;
        let x = (r*g0 - g*r0) / (g*(1-r0)-r*(1-g0));
        let y = r / (r0 + x*(1-r0));
        return [x, y];
      },
      getOptions(e, item=''){
        this.options.e = e;
        this.options.item = item;
        return this.options;
      },
      getProp(prop=this.prop){
        return eval('DT.value.' + prop);
      },
      hasProp(prop){  // 检查DT对象有无某属性，有则显示，无则不显示
        let node = DT.value;
        for(let p of prop.split('.')){
          if(node[p] == undefined) return false;
          node = node[p];
        }
        return true;
      },
      loop(x){  // 限定x在0~max之间循环，比如角度
        let max = this.options.max;
        let result = x % max + (x < 0 ? max : 0);
        if(Math.abs(result-max) < 1e-6) result = 0;
        return result;
      },
      onClickRing(e){  // 点击调色圆环
        tempAngle.value = -1; 
        if(e.type == "click") colorEdit = "color-ring"  // 防止拖动时把指示器拖到方块上
        else if(colorEdit != "color-ring") return;
        let dom = document.getElementById("color-ring");
        let rect = dom.getBoundingClientRect();
        let dx = e.clientX - rect.left + dom.offsetLeft - 92;
        let dy = 100 - e.clientY + rect.top - dom.offsetTop;
        let r = (dx**2 + dy**2) ** 0.5;
        if(r>=60 && r<=80){  // 限定拖动区域在圆环内
          let h = Math.atan2(dy, dx) / 2 / Math.PI;
          if(h<0) h++;
          this.getProp().setHSL(h, this.getHSL('s'), this.getHSL('l'));
        }
        this.$emit("change");
      },
      onClickSquare(e){  // 点击调色方块
        if(e.type == "click") {  // 防止拖动时把指示器拖到方块上
          // 若颜色为灰度则保存角度，改为其它颜色后恢复，以免圆环上的色相角度归零
          if(tempAngle.value == -1) tempAngle.value = this.getHSL('h');
          colorEdit = "color-square"
        }
        else if(colorEdit != "color-square") return;
        let dom = document.getElementById("color-square");
        let rect = dom.getBoundingClientRect();
        let x = 1 - (e.clientX - rect.left) / 80;
        let y = 1 - (e.clientY - rect.top) / 80;
        if (0 <= x && x <= 1 && 0 <= y && y <= 1){  // 限定拖动区域在方块内
          let rgb0 = {r:0, g:0, b:0};
          let color0 = new THREE.Color();
          color0.setHSL(this.getHSL('h'), 1, 0.5);
          color0.getRGB(rgb0);
          let r0 = rgb0.r, g0 = rgb0.g, b0 = rgb0.b;
          this.getProp().setRGB((r0+(1-r0)*x)*y, (g0+(1-g0)*x)*y, (b0+(1-b0)*x)*y);
        }
        this.$emit("change");
      },
      propStyle(){  // 属性样式
        return { "width": this.width + "px" };
      },
      selectAll(e){  // 全选input中的内容（避免双击颜色代码时井号未选中）
        let x = e.target;
        x.setSelectionRange(0, x.value.length);  
      },
      startEdit(e, item=''){  // 开始编辑
        input_value.value = e.target.value;
        chosenProp.value = this.prop + (item ? '.' + item : '');
      },
    },
    mounted(){
      global.on("changeProperty", (data)=>{chosenProp.value = data});
      global.on("showProperty", (data)=>{
        if('未已'.includes(data[0])) DT.value = data;
        else if(typeof data == "number") DT.value = global.DTScene().findDTObjectById(data);
        else DT.value = data;
      });
      global.on("updateProp", (data)=>{  // 拖动物体时在属性栏实时更新其位移和旋转属性
        if(data.action == "mouseup") this.propX = this.propY = this.propZ = null;
        else if(this.prop == "mesh.position") {  // 更新位移
          this.propX = data.mesh.position.x;
          this.propY = data.mesh.position.y;
          this.propZ = data.mesh.position.z;
        }
        else if(this.prop == "mesh.rotation") {  // 更新旋转
          this.propX = data.mesh.rotation.x;
          this.propY = data.mesh.rotation.y;
          this.propZ = data.mesh.rotation.z;
        }
      });
    },
  }
</script>

<style> 
  .colorHelper{  /* 指示圆 */
    box-shadow: inset 0 0 0 2px black, /* 朝内的黑色边框，粗细为3px */
                inset 0 0 0 4px white;
    border-radius: 10px;
    position:absolute;
    width:20px;
    height: 20px; 
  }
  #color-square{  /* 调色方块 */
    background-blend-mode: multiply;
    width: 80px;
    height: 80px;
    position: absolute;
    left: 52px;
    top: 60px;
  }
  .editColor {
    border: 1px solid black; 
    display: inline-block;
    width: 20px;
    height: 20px;
    line-height: 20px;
    margin-left: 10px;
  }
  .editColor:hover{ cursor:pointer; }  
  .inline {display:inline;}
  .inputRow {
    display:block;
    margin-top:3px; 
    margin-bottom:3px;
  }
  .tube{ 
    display:inline; 
    height:20px; 
    margin-left:8px;
    transform: translate(0%, 30%); 
  }
  .tube:hover{ cursor:pointer; }  
</style>

<template>
  <div v-if="hasProp(prop)" class="inputRow">
    <!--属性名-->
    <strong> {{title}}：</strong>

    <!--编辑布尔变量属性-->
    <a-checkbox v-if="type=='checkbox'" v-model:checked="computedProp"
    :disabled="DT.label=='protected'">
      {{ computedProp ? "是" : "否" }}
    </a-checkbox>

    <!--编辑数值属性-->
    <span v-else-if="type=='inputNumber'">
      <a-input class="propInput" :style="propStyle()" :title="help.input" 
      v-model:value="computedProp"
      @blur="e=>changeValue(getOptions(e))" 
      @click="startEdit" 
      @keydown="e=>changeValue(getOptions(e))"
      @wheel="e=>changeValue(getOptions(e))" @wheel.prevent/>
      <div v-if="options.suffix" class="inline">{{ options.suffix }}</div>
    </span> 

    <!--编辑颜色属性-->
    <span v-else-if="type=='inputColor'">
      <a-input class="propInput" :style="propStyle()" :title="help.input" 
      v-model:value="computedProp"
      @blur="e=>changeValue({e:e, type:'string'})" 
      @click="startEdit" 
      @dblclick="selectAll" 
      @keydown="e=>changeValue({e:e, type:'string'})"/>
    </span> 

    <!--编辑三维向量属性，chosenProp=prop代表正在编辑-->
    <span v-else-if="type=='inputVector'"><br>
      <!--THREE三维向量-->
      <span v-if="getProp().isVector3 || getProp().isEuler">
        <strong>x:</strong>
        <a-input class="propInput" :style="propStyle()" :title="help.input" 
        v-model:value="computedX" :disabled="DT.label=='protected'"
        @blur="e=>changeValue(getOptions(e, 'x'))" 
        @click="e=>startEdit(e, 'x')"
        @keydown="e=>changeValue(getOptions(e, 'x'))"
        @wheel="e=>changeValue(getOptions(e, 'x'))" @wheel.prevent/>
        <div v-if="options.suffix" class="inline">{{ options.suffix }}</div>&nbsp;
        <strong>y:</strong>
        <a-input class="propInput" :style="propStyle()" :title="help.input" 
        v-model:value="computedY" :disabled="DT.label=='protected'"
        @blur="e=>changeValue(getOptions(e, 'y'))" 
        @click="e=>startEdit(e, 'y')" 
        @keydown="e=>changeValue(getOptions(e, 'y'))"
        @wheel="e=>changeValue(getOptions(e, 'y'))" @wheel.prevent/>
        <div v-if="options.suffix" class="inline">{{ options.suffix }}</div>&nbsp; 
        <strong>z:</strong>
        <a-input class="propInput" :style="propStyle()" :title="help.input" 
        v-model:value="computedZ" :disabled="DT.label=='protected'"
        @blur="e=>changeValue(getOptions(e, 'z'))" 
        @click="e=>startEdit(e, 'z')" 
        @keydown="e=>changeValue(getOptions(e, 'z'))"
        @wheel="e=>changeValue(getOptions(e, 'z'))" @wheel.prevent/>
        <div v-if="options.suffix" class="inline">{{ options.suffix }}</div>
      </span>
      <!--THREE颜色向量-->
      <span v-if="getProp().isColor">
        <strong>R:</strong>
        <a-input class="propInput" :style="propStyle()" :title="help.input" 
        v-model:value="computedX"
        @blur="e=>changeColor(e, 'r')" 
        @click="e=>startEdit(e, 'r')" 
        @keydown="e=>changeColor(e, 'r')"
        @wheel="e=>changeColor(e, 'r')" @wheel.prevent/>
        &nbsp;
        <strong>G:</strong>
        <a-input class="propInput" :style="propStyle()" :title="help.input" 
        v-model:value="computedY"
        @blur="e=>changeColor(e, 'g')" 
        @click="e=>startEdit(e, 'g')" 
        @keydown="e=>changeColor(e, 'g')"
        @wheel="e=>changeColor(e, 'g')" @wheel.prevent/>
        &nbsp; 
        <strong>B:</strong>
        <a-input class="propInput" :style="propStyle()" :title="help.input" 
        v-model:value="computedZ"
        @blur="e=>changeColor(e, 'b')" 
        @click="e=>startEdit(e, 'b')" 
        @keydown="e=>changeColor(e, 'b')"
        @wheel="e=>changeColor(e, 'b')" @wheel.prevent/>
        <!--预览与编辑颜色-->
        <a-popconfirm :draggable="false" icon="" style="user-select: none;">
          <template #cancelButton></template>
          <template #okButton>
            <!--调色圆环-->
            <img :src="colorRing" id="color-ring" @click="onClickRing" @mousedown.prevent
            @mousemove="e=>{if (e.buttons==1) onClickRing(e)}"/>
            <!--调色方块-->
            <div id="color-square" @click="onClickSquare" @mousedown.prevent
            :style="{background: `
              linear-gradient(to right, white, hsl(${(
                tempAngle == -1 ? this.getHSL('h') : tempAngle
              )*360}, 100%, 50%)),
              linear-gradient(to top, black, white)
            `}"/>
            <!--外侧指示圆-->
            <div class="colorHelper" :draggable="false"  @click="onClickRing" @mousedown.prevent
            @mousemove="e=>{if (e.buttons==1) onClickRing(e)}"
            :style="{
              left: 82 + 70*Math.cos(
                (tempAngle == -1 ? this.getHSL('h') : tempAngle)
              *2*Math.PI) + 'px',
              top: 90 - 70*Math.sin(
                (tempAngle == -1 ? this.getHSL('h') : tempAngle)
              *2*Math.PI) + 'px'
            }"/>    
            <!--内侧指示圆-->
            <div class="colorHelper" :draggable="false" @click="onClickSquare" @mousedown.prevent
            @mousemove="e=>{if (e.buttons==1) onClickSquare(e)}"
            :style="{
              left: 122 - 80*getHSLpos()[0] + 'px',
              top: 130 - 80*getHSLpos()[1] + 'px'
            }"/>  
          </template>
          <div class="editColor" :title="help.color"
          :style="{backgroundColor: '#' + getProp().getHexString()}"> &emsp; </div>
        </a-popconfirm>
        <img :src="tubeIcon" class="tube" @click="getColor" :draggable="false"
        :title="help.tube"/>
      </span>
    </span> 

    <!--只显示向量-->
    <div v-else-if="getProp().isVector3" v-for="(item, index) of Object.keys(getProp())"
    class="inline">
      <strong>{{ item }}</strong>:&nbsp;{{ getProp()[item].toFixed(2) }}
      <div v-if="index<Object.keys(getProp()).length-1" class="inline">,&nbsp;</div>
    </div>

    <!--只显示属性-->
    <div v-else v-for="prop of [format(computedProp)]" class="inline">
      <div v-if="typeof prop == 'boolean'" class="inline"> {{ prop ? "是" : "否"}} </div>
      <div v-else class="inline"> {{ prop }} </div>
    </div>
  </div>
</template>