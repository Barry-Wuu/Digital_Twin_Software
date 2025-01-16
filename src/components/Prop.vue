<script lang="ts">
  import * as THREE from "three"
  import global from "../Global"
  import { ref } from 'vue'
  import colorRing from "../assets/icons/colorRing.jpg"
  import tubeIcon from "../assets/icons/吸管.jpg"
  import { CaretDownOutlined, CheckOutlined } from '@ant-design/icons-vue';

  const chosenProp: any = ref('');
  var colorEdit = '';
  const DT: any = ref("未选择对象");
  const input_value = ref(null);
  const map = {
              "a5197017-c560-4713-aacd-01f097dda18f": "192.168.137.21",
              "f70042be-5fef-4d45-9b3c-6ab06f384ae7": "192.168.137.22",
              "75292a01-6d17-4d50-bb75-d42718f75fe8": "192.168.137.23",
              "f6e1de24-a3c4-4263-b19e-7c6451c992a1": "192.168.137.24",
              "7f698a28-d9d4-456a-9814-19d6c9b2f1a1": "192.168.137.25",
              "cc29f8d0-736e-4474-a02b-f05d93a735aa": "192.168.137.26",
  };  // 设备IP地址
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
      width: {default: "80px"},
    },
    components: {CaretDownOutlined, CheckOutlined},
    computed: {  // 计算属性
      computedProp: {
        get() {
          if(this.propActive) return this.format(this.propActive);  // 拖动物体时强制更新属性值
          if(chosenProp.value == this.prop) return input_value.value;  // 编辑中
          let result = eval("DT.value." + this.prop);
          if(this.type == "inputString") return result;  // 显示字符串
          else if(this.prop == "name" && !result) return "未命名";
          else if(this.type == "inputColor"){  // 显示颜色
            return '#' + result.getHexString();
          }
          return this.format(result);  // 显示属性
        },
        set(value, item='') {
          if(chosenProp.value == this.prop) input_value.value = value;  // 编辑中
          else{
            let result = "DT.value." + this.prop;
            if(this.type == "inputString") {  // 更改字符串
              eval(`${result} = "${value}"`);
              return;
            }
            else if(DT.value.mesh.isLight) {  // 显示或隐藏光源图标
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
          let mesh = DT.value.mesh;
          let result = eval("DT.value." + this.prop);
          if(!result && mesh){
            if(this.prop == "world_position"){  // 更新绝对位移
              let P = mesh.getWorldPosition(new THREE.Vector3());
              return this.format(P.x);
            }
            else if(this.prop == "world_rotation"){  // 更新绝对旋转
              let Q = mesh.getWorldQuaternion(new THREE.Quaternion());
              let R = new THREE.Euler().setFromQuaternion(Q);
              return this.format(R.x);
            }
          }
          else if(result?.isVector3 || result?.isEuler){  // 编辑向量
            if(chosenProp.value == this.prop + '.x') return input_value.value;  // 编辑中
            else return this.format(result.x);
          }
          else if(result?.isColor){  // 编辑颜色
            if(chosenProp.value == this.prop + '.r') return input_value.value;  // 编辑中
            return this.format(result.r, 255);
          }
          return;
        },
        set(value){
          let result = eval("DT.value." + this.prop);
          let mesh = DT.value.mesh;
          if(!result && mesh){
            if(this.prop == "world_position"){  // 改变绝对位移
              let parent = mesh.parent;
              mesh.removeFromParent();
              mesh.position.x = value;
              parent.attach(mesh);
              input_value.value = value;
            }
            else if(this.prop == "world_rotation"){  // 改变绝对旋转
              let parent = mesh.parent;
              mesh.removeFromParent();
              mesh.rotation.x = value;
              parent.attach(mesh);
              input_value.value = value;
            }
          }
          else if(result?.isVector3 || result?.isEuler){  // 编辑向量
            if(chosenProp.value == this.prop + '.x') input_value.value = value;  // 编辑中
          }
          else if(result?.isColor){  // 编辑向量
            if(chosenProp.value == this.prop + '.r') input_value.value = value;  // 编辑中
          }
        }
      },
      computedY: {
        get(){
          if(this.propY) return this.format(this.propY);  // 拖动物体时强制更新属性值
          let mesh = DT.value.mesh;
          let result = eval("DT.value." + this.prop);
          if(!result && mesh){
            if(this.prop == "world_position"){  // 更新绝对位移
              let P = mesh.getWorldPosition(new THREE.Vector3());
              return this.format(P.y);
            }
            else if(this.prop == "world_rotation"){  // 更新绝对旋转
              let Q = mesh.getWorldQuaternion(new THREE.Quaternion());
              let R = new THREE.Euler().setFromQuaternion(Q);
              return this.format(R.y);
            }
          }
          else if(result?.isVector3 || result?.isEuler){  // 编辑向量
            if(chosenProp.value == this.prop + '.y') return input_value.value;  // 编辑中
            else return this.format(result.y); 
          }
          else if(result?.isColor){  // 编辑颜色
            if(chosenProp.value == this.prop + '.g') return input_value.value;  // 编辑中
            return this.format(result.g, 255);
          }
          return;
        },
        set(value){
          let result = eval("DT.value." + this.prop);
          let mesh = DT.value.mesh;
          if(!result && mesh){
            if(this.prop == "world_position"){  // 改变绝对位移
              let parent = mesh.parent;
              mesh.removeFromParent();
              mesh.position.y = value;
              parent.attach(mesh);
              input_value.value = value;
            }
            else if(this.prop == "world_rotation"){  // 改变绝对旋转
              let parent = mesh.parent;
              mesh.removeFromParent();
              mesh.rotation.y = value;
              parent.attach(mesh);
              input_value.value = value;
            }
          }
          else if(result?.isVector3 || result?.isEuler){  // 编辑向量
            if(chosenProp.value == this.prop + '.y') input_value.value = value;  // 编辑中
          }
          else if(result?.isColor){  // 编辑向量
            if(chosenProp.value == this.prop + '.g') input_value.value = value;  // 编辑中
          }
        }
      },
      computedZ: {
        get(){
          if(this.propZ) return this.format(this.propZ);  // 拖动物体时强制更新属性值
          let mesh = DT.value.mesh;
          let result = eval("DT.value." + this.prop);
          if(!result && mesh){
            if(this.prop == "world_position"){  // 更新绝对位移
              let P = mesh.getWorldPosition(new THREE.Vector3());
              return this.format(P.z);
            }
            else if(this.prop == "world_rotation"){  // 更新绝对旋转
              let Q = mesh.getWorldQuaternion(new THREE.Quaternion());
              let R = new THREE.Euler().setFromQuaternion(Q);
              return this.format(R.z);
            }
          }
          else if(result?.isVector3 || result?.isEuler){  // 编辑向量
            if(chosenProp.value == this.prop + '.z') return input_value.value;  // 编辑中
            else return this.format(result.z);   
          }
          else if(result?.isColor){  // 编辑颜色
            if(chosenProp.value == this.prop + '.b') return input_value.value;  // 编辑中
            return this.format(result.b, 255);
          }
          return;
        },
        set(value){
          let result = eval("DT.value." + this.prop);
          let mesh = DT.value.mesh;
          if(!result && mesh){
            if(this.prop == "world_position"){  // 改变绝对位移
              let parent = mesh.parent;
              mesh.removeFromParent();
              mesh.position.z = value;
              parent.attach(mesh);
              input_value.value = value;
            }
            else if(this.prop == "world_rotation"){  // 改变绝对旋转
              let parent = mesh.parent;
              mesh.removeFromParent();
              mesh.rotation.z = value;
              parent.attach(mesh);
              input_value.value = value;
            }
          }
          else if(result?.isVector3 || result?.isEuler){  // 编辑向量
            if(chosenProp.value == this.prop + '.z') input_value.value = value;  // 编辑中
          }
          else if(result?.isColor){  // 编辑向量
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
        propActive: null,
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
      changeValue({e, item='',  // 更改属性值时调用，超出范围时取边界值，fixed为小数位数
        unit=null, min=null, max=null, delta=1, fixed=2, loop=false, type="number"}){
        input_value.value = e.target.value;
        let blur = e.type == "blur";
        let enter = e.type == "keydown" && e.key == "Enter";
        let mesh = DT.value.mesh;
        let wheel = e.type == "wheel";
        if(!(blur || enter || wheel)) return;
        let result = input_value.value;
        if(type == "number" && this.type != "inputString"){
          result = JSON.parse(input_value.value);
          if(wheel) result -= e.deltaY / 100 * delta;
          if(loop) result = this.loop(result);
          if(typeof min == "number" && result < min) result = min;
          if(typeof max == "number" && result > max) result = max;
          if(typeof fixed == "number") result = result.toFixed(fixed);
          if(unit) result *= unit;
          input_value.value = result;
        }
        if(this.prop == "world_position"){  // 改变绝对位移
          let parent = mesh.parent;
          mesh.removeFromParent();
          mesh.position[item] = result;
          parent.attach(mesh);
          this.$emit("change");
          chosenProp.value = null;  // 结束编辑
          this.confirm(e, true);  // 修改属性之后让元素自动失焦
          return;
        }
        else if(this.prop == "world_rotation"){  // 改变绝对旋转
          let parent = mesh.parent;
          mesh.removeFromParent();
          mesh.rotation[item] = result;
          parent.attach(mesh);
          this.$emit("change");
          chosenProp.value = null;  // 结束编辑
          this.confirm(e, true);  // 修改属性之后让元素自动失焦
          return;
        }
        else if(this.prop == "scale") {  // 改变导入模型的比例
          mesh.scale.setScalar(result);
        }

        let prop = "DT.value." + this.prop + (item ? '.' + item : '');  // 结束编辑时更改属性值
        if(eval(prop).isColor) eval(prop).setStyle(result);
        else if(this.type == "inputString") {
          if(this.prop == "physicalID"){
            let targetDT = global.physicalIDMap[result]
            if(targetDT && targetDT != DT.value){
                input_value.value = DT.value.physicalID;
                chosenProp.value = null;  // 结束编辑
                e.target.blur();  // 修改属性之后让元素自动失焦；
                alert("该物理实体ID已被占用，请重新输入");
                return;
            }
            eval(`${prop} = "${result}"`);
            DT.value.updatePhysicalIDMap();  // 更新物理实体ID到物体的映射关系
          }
          else eval(`${prop} = "${result}"`);
        }
        else if(this.options.max_warn) {  // 属性值设置过大时弹窗确认
          const confirm = this.options.confirm ? () => {  // 确认修改
            this.options.confirm(JSON.parse(e.target.value));
            eval(`${prop} = ${result}`);
            global.emit("updateProp", {action: "mouseup"});
          } : ()=>eval(`${prop} = ${result}`);
          if(JSON.parse(e.target.value) > this.options.max_warn){
            global.emit("popup", {  // 弹窗确认修改
              title: `确认修改${this.title}`,
              type: "yes_no",
              content: `${this.title}过大可能会导致场景无法正常工作，是否确认修改？`,
              yes: confirm,
              no: () => {}  // no为取消
            });
          }
          else confirm();
        }
        else eval(`${prop} = ${result}`);
        if(this.prop == "name") {DT.value.setTitle(); global.emit("updateTree");}

        this.$emit("change");
        chosenProp.value = null;  // 结束编辑
        this.confirm(e, true);  // 修改属性之后让元素自动失焦
      },   
      confirm(e=null, force=false){  // 按回车键确认并失焦
        if(force || e?.type == "keydown" && e?.key == "Enter") {
          e.target.blur();
          if(this.prop == "v0"){  // 更改某传送装置元件的速度时，也更改所有相同节点元件的速度
            global.emit("popup", {  // 弹窗确认修改
                title: "确认修改传送装置速度",
                type: "yes_no",
                content: "要更改所有相同节点的传送装置元件的速度吗？",
                yes: () => {  // 更改所有相同节点元件的速度
                  global.SCENE.DT.traverse(DT0 => {
                    if(DT0 && DT0 != DT.value && DT0.node == DT.value.node){
                      DT0.v0 = DT.value.v0;
                    }
                  });
                  // 发送消息
                  if(DT.value.label == "conveyor"){
                    let DT0 = DT.value;
                    let speed = DT0.v0 / 1.5 * 200;
                    let ip = map[DT0.node] ?? '';
                    let port = "4844";
                    let uri = DT0.node + "/AAS/Static/Composition/Conveyor/AAS/Dynamic/Belt_Speed:value@Value"
                    global.emit("postRequest", {
                      url: "http://192.168.137.155:8888/NodeWrite",
                      data:{
                        writenumber: "1",
                        writerequestjson: {
                          "1": {
                            ip: ip,
                            port: port,
                            suffix: "",
                            namspaceindex: "3",
                            nodeID: uri,
                            value: speed.toFixed(2),
                            datatype: "String"
                          }
                        }
                      }
                    });
                  }
                },
                no: () => {}  // 仅更改当前元件的速度
            });
          }
        }
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
      global.on("changeProperty", data => {chosenProp.value = data});
      global.on("showProperty", data => {
        if('未已'.includes(data[0])) DT.value = data;
        else if(typeof data == "number") DT.value = global.SCENE.DT.findDTObjectById(data);
        else DT.value = data;
      });
      global.on("updateProp", (data: any) => {  // 拖动物体时在属性栏实时更新其位移和旋转属性
        if(data.action == "mouseup") 
          this.propActive = this.propX = this.propY = this.propZ = null;
        else if(data.mesh){
          if(this.prop == "world_position") {  // 更新绝对位移
            let P = data.mesh.getWorldPosition(new THREE.Vector3());
            this.propX = P.x;
            this.propY = P.y;
            this.propZ = P.z;
          }
          else if(this.prop == "world_rotation") {  // 更新绝对旋转
            let Q = data.mesh.getWorldQuaternion(new THREE.Quaternion());
            let R = new THREE.Euler().setFromQuaternion(Q);
            this.propX = R.x;
            this.propY = R.y;
            this.propZ = R.z;
          }
          else if(this.prop == "mesh.position") {  // 更新相对位移
            this.propX = data.mesh.position.x;
            this.propY = data.mesh.position.y;
            this.propZ = data.mesh.position.z;
          }
          else if(this.prop == "mesh.rotation") {  // 更新相对旋转
            this.propX = data.mesh.rotation.x;
            this.propY = data.mesh.rotation.y;
            this.propZ = data.mesh.rotation.z;
          }
        }
        else if(data.action == "mousemove" && this.prop == "mesh.scale.x"){  // 更新直道传送带长度
          this.propActive = data.mesh.scale.x;
        }
      });
      global.emit("updateProp", DT.value);
    },
  }
</script>

<style> 
  .colorHelper{  /* 指示圆 */
    box-shadow: inset 0 0 0 2px black, /* 朝内的黑色边框，粗细为3px */
                inset 0 0 0 4px white;
    border-radius: 10px;
    position: absolute;
    width: 20px;
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
  .editColor:hover{ cursor: pointer; }  
  .inline {display: inline;}
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
  <div v-if="hasProp(prop) || prop=='world_position' || prop=='world_rotation'" class="inputRow">
    <!--属性名-->
    <strong> {{title}}：</strong>

    <!--编辑布尔变量属性-->
    <a-checkbox v-if="type=='checkbox'" v-model:checked="computedProp"
    :disabled="DT.label=='protected'">
      {{ computedProp ? "是" : "否" }}
    </a-checkbox>

    <!--编辑颜色属性-->
    <span v-else-if="type=='inputColor'">
      <a-input class="propInput" placeholder="无"
      :style="{width: width}" :title="help.input" v-model:value="computedProp"
      @blur="e=>changeValue({e:e, type:'string'})" 
      @click="startEdit" @dblclick="selectAll" @keydown="confirm"/>
    </span> 

    <!--编辑数值属性-->
    <span v-else-if="type=='inputNumber'">
      <a-input class="propInput" placeholder="无"
      :style="{width: width}" :title="help.input" v-model:value="computedProp"
      @blur="e=>changeValue(getOptions(e))" 
      @click="startEdit" @dblclick="selectAll" @keydown="confirm"
      @wheel="e=>changeValue(getOptions(e))" @wheel.prevent/>
      <div v-if="options.suffix" class="inline">{{ options.suffix }}</div>
    </span> 

    <!--编辑字符串属性-->
    <span v-else-if="type=='inputString'">
      <a-input class="propInput" placeholder="无" 
      :style="{width: width}" :title="help.input" v-model:value="computedProp"
      @blur="e=>changeValue(getOptions(e))"
      @click="startEdit" @dblclick="selectAll" @keydown="confirm"
      @wheel="e=>changeValue(getOptions(e))" @wheel.prevent/>
    </span> 

    <!--编辑三维向量属性，chosenProp=prop代表正在编辑-->
    <span v-else-if="type=='inputVector'"><br>
      <!--THREE三维向量-->
      <span v-if="prop=='world_position' || prop=='world_rotation' ||
      getProp().isVector3 || getProp().isEuler">
        <strong>x:</strong>
        <a-input class="propInput" :style="{width: width}" :title="help.input" 
          v-model:value="computedX" :disabled="DT.label=='protected'"
          @blur="e=>changeValue(getOptions(e, 'x'))" 
          @click="e=>startEdit(e, 'x')" @dblclick="selectAll" @keydown="confirm"
          @wheel="e=>changeValue(getOptions(e, 'x'))" @wheel.prevent
        />
        <div v-if="options.suffix" class="inline">{{ options.suffix }}</div>&nbsp;
        <strong>y:</strong>
        <a-input class="propInput" :style="{width: width}" :title="help.input" 
          v-model:value="computedY" :disabled="DT.label=='protected'"
          @blur="e=>changeValue(getOptions(e, 'y'))" 
          @click="e=>startEdit(e, 'y')" @dblclick="selectAll" @keydown="confirm"
          @wheel="e=>changeValue(getOptions(e, 'y'))" @wheel.prevent
        />
        <div v-if="options.suffix" class="inline">{{ options.suffix }}</div>&nbsp; 
        <strong>z:</strong>
        <a-input class="propInput" :style="{width: width}" :title="help.input" 
          v-model:value="computedZ" :disabled="DT.label=='protected'"
          @blur="e=>changeValue(getOptions(e, 'z'))" 
          @click="e=>startEdit(e, 'z')" @dblclick="selectAll" @keydown="confirm"
          @wheel="e=>changeValue(getOptions(e, 'z'))" @wheel.prevent
        />
        <div v-if="options.suffix" class="inline">{{ options.suffix }}</div>
      </span>
      <!--THREE颜色向量-->
      <span v-else-if="getProp().isColor">
        <strong>R:</strong>
        <a-input class="propInput" :style="{width: width}" :title="help.input" 
        v-model:value="computedX"
        @blur="e=>changeColor(e, 'r')" 
        @click="e=>startEdit(e, 'r')" @dblclick="selectAll" @keydown="confirm"
        @wheel="e=>changeColor(e, 'r')" @wheel.prevent/>
        &nbsp;
        <strong>G:</strong>
        <a-input class="propInput" :style="{width: width}" :title="help.input" 
        v-model:value="computedY"
        @blur="e=>changeColor(e, 'g')" 
        @click="e=>startEdit(e, 'g')" @dblclick="selectAll" @keydown="confirm"
        @wheel="e=>changeColor(e, 'g')" @wheel.prevent/>
        &nbsp; 
        <strong>B:</strong>
        <a-input class="propInput" :style="{width: width}" :title="help.input" 
        v-model:value="computedZ"
        @blur="e=>changeColor(e, 'b')" 
        @click="e=>startEdit(e, 'b')" @dblclick="selectAll" @keydown="confirm"
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

    <!--运动位姿-->
    <span v-else-if="type=='follow'">
      <a-dropdown-button :trigger="['click']">
        <a class="ant-dropdown-link" @click.prevent>
          {{ DT.rigidFollow ? "跟随物体" : "跟随刚体" }}
        </a>
        <template #icon><CaretDownOutlined/></template>
        <template #overlay>
          <a-menu>
            <a-menu-item>
              <a :style="{'color': DT.rigidFollow ? '#bbbbbb' : 'black'}" 
              @click="DT.rigidFollow = true">
                跟随物体
                <CheckOutlined v-if="DT.rigidFollow"/>
              </a>
            </a-menu-item>
            <a-menu-item>
              <a :style="{'color': DT.rigidFollow ? 'black' : '#bbbbbb'}"
              @click="DT.rigidFollow = false">
                跟随刚体
                <CheckOutlined v-if="!DT.rigidFollow"/>
              </a>
            </a-menu-item>
          </a-menu>
        </template>
      </a-dropdown-button>
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
      <div v-else class="inline"> {{ prop ? prop : "无" }} </div>
    </div>
  </div>
</template>