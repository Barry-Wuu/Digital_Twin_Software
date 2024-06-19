<script lang="ts">
  import global from "../Global"
  import { ref } from 'vue'
  import {
    CheckCircleOutlined,
    CheckOutlined,
    CloseOutlined,
  } from '@ant-design/icons-vue';

  const addCustomProp = ref(false);
  const customCodeFont = ref(3);
  const DT = ref();
  const editProp = ref('');
  const editValue = ref();
  const helpChange = "点此可修改参数，按下回车键确认修改";
  const helpTree = [
    {key: "场景"}, 
    {key: "组件库"}
  ]
  const helpContent = ref("场景");
  var main;
  const newCode = ref('');
  const newProp = ref('');
  var popup;
  var popupMask;
  const popupContent = ref('');
  const popupTitle = ref('');
  const yesNoContent = ref({content:'', yes:()=>{}, no:()=>{}});

  export default{
    components:{
        CheckCircleOutlined, 
        CheckOutlined, 
        CloseOutlined
    },
    methods:{
      closePopup(quit=true){  // 清空并隐藏新增属性输入栏，关闭弹窗
        if(quit){
          popupContent.value = ''; 
          popup.style.display = popupMask.style.display="none";
        }
        addCustomProp.value = false;
        editProp.value = newProp.value = '';
      },
      createCustomProp(){
        if(DT.value.custom[newProp.value] == undefined) {
          DT.value.custom[newProp.value] = null;
          this.closePopup(false);
        };
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
      setCustomCodeFont(size){  // 更改自定义脚本字体
        let rule = ['xx-small', 'x-small', 'small', 'medium', 'large', 'x-large', 'xx-large'];
        let style = document.getElementById("customCode").style;
        style.fontSize = rule[size];
      },
      setCustomProp(editValue, prop){
        if(editValue.length>0 && editValue[0]=='$'){ 
          DT.value.custom[prop]=JSON.parse(editValue.slice(1));
        } 
        else DT.value.custom[prop] = editValue; 
        editProp.value = '';
      },
    },
    setup(){
      return {
        addCustomProp, DT, global, customCodeFont, editProp, editValue, 
        helpChange, helpContent, helpTree, newCode, newProp, 
        popup, popupContent, popupMask, popupTitle, yesNoContent
      }
    },
    mounted(){
      for(let node of helpTree) node.title = node.key;
      global.on("popup", (data: any)=>{  // 显示弹窗，弹窗类型由obj.type决定
        DT.value = data.DT;
        yesNoContent.value = data.type == "yes_no" ? data : null;  // 显示“是否确认重命名组件”窗口
        if(popupContent.value == data.type) this.closePopup();
        else {
          popupContent.value = data.type;
          popupTitle.value = data.title;
          popup.style.display = popupMask.style.display = "block";
          this.$nextTick(()=>{  // 异步更新窗口位置
            let rect = popup.getBoundingClientRect();
            popup.style.top = (main.offsetHeight - rect.height)/2 + "px";
            popup.style.left = (main.offsetWidth - rect.width)/2 + "px";
            if(data.type == "code"){
              newCode.value = DT.value.code ? DT.value.code : '';
            }
          });
        }
      });
      main = document.getElementById("main");
      popup = document.getElementById("popup"); 
      main.appendChild(popup);  
      popupMask = document.getElementById("popupMask");
      main.appendChild(popupMask);  
      var popupHeader = document.getElementById("popup-header");  
      var startM, startP;
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
        document.addEventListener("mouseup", () => {  
          document.removeEventListener("mousemove", onMousemove);  
        });  
      })
      // 退出按钮  
      var popupQuit = document.getElementById('popup-quit');  
      popupQuit.addEventListener('click', () => {  
        popup.style.display = 'none';  
      }); 
    }
  }
</script>

<style>
  .buttonCustomCode{
    float:right; 
    margin:10px;
  }
  .customCode{
    margin-top: 10px;
    margin-left: 0px; 
    width: calc(100% - 20px); 
    height: 500px; 
    resize: none; 
    white-space: nowrap
  }
  .help-content{
    border:1px solid black; 
    width:666px; 
    height:400px; 
    margin-left:50px; 
    overflow-y: scroll;
  }
  .inline_R{color: red; display: inline}
  .inline_G{color: limegreen; display: inline}
  .keyboard{  /*模拟按键样式*/
    background: #eee;
    border: 1px solid black; 
    border-radius: 4px;
    display: inline;
    font-family: "宋体";
    margin: 0px 3px;
    padding: 0px 5px;
    text-align: center;
  }
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
  .yes-no-content{
    margin-top: 10px; 
    margin-bottom: -12px; 
    margin-right: 10px; 
    text-align: right;
  }
  .yes-no-confirm{
    border:#0B0 solid 1px; 
    color:#0B0; 
    margin-right:10px
    }
</style>

<template>
  <!--弹出式窗口-->
  <div id="popup" class="popup" 
  :style="{'width':{
    'code': '800px', 
    'help': '800px', 
    'prop': '600px',
    'yes_no': '400px'
  }[popupContent]}">
    <!--头部拖动栏-->  
    <div id="popup-header" class="popup-header">  
      <strong style="color:white">{{ popupTitle }}</strong>
      <!--退出-->
      <a-button id="popup-quit" danger type="primary" @click="closePopup">
        <CloseOutlined/>
      </a-button>  
    </div>  

    <div class="popup-content" id="popup-content">  
      <!--双项选择栏-->
      <div v-if="yesNoContent" style="margin-top: 10px; text-align: left">
        <div v-for="row in yesNoContent.content.split('\r')">
          &nbsp;&nbsp;&nbsp;&nbsp;{{ row }}
        </div>
      </div>
      <div v-if="popupContent=='yes_no'" class="yes-no-content">
        <a-button class="yes-no-confirm" @click="yesNoContent.yes(); closePopup()">
          是<CheckOutlined/>
        </a-button>
        <a-button danger @click="yesNoContent.no(); closePopup()">
          否<CloseOutlined/>
        </a-button>
      </div>

      <!--帮助-->
      <span v-if="popupContent=='help'" style="display: flex; margin-top: 10px; text-align: left">
        <a-tree v-model:selectedKeys="helpContent" :tree-data="helpTree"
        @select="e => helpContent = e[0]">
          <template #title="node">
            <div v-if="node.key==helpContent" style="color:dodgerblue">{{node.key}}</div>
            <div v-else>{{node.key}}</div>
          </template>
        </a-tree>
        <div v-if="helpContent=='场景'" class="help-content">
          <strong>相机控制</strong><br>
          在场景中，按鼠标中键或同时按鼠标左右键可移动相机，按右键可旋转相机，滚动滚轮可放大或缩小。<br>
          双击层级树中的结点可将镜头拉近到该物体。<br>
          <br>
          <strong>编辑模式</strong><br>
          按左键即可选中物体，此时物体上会出现控制器。在拖动控制器时：<br>
          按<div class="keyboard">Q</div>键进入移动模式；<br>
          按<div class="keyboard">W</div>键进入旋转模式；<br>
          按<div class="keyboard">E</div>键切换全局坐标系或局部坐标系；<br>
          按<div class="keyboard">Esc</div>或<div class="keyboard">Ctrl</div>+<div class="keyboard">Z</div>键撤销当前做出的移动。<br>
          <br>
          拖动物体时，若滚动滚轮，则可让物体围绕滚轮旋转。<br>  
          拖动物体时，若按下<div class="keyboard">A</div>键，则可将物体的底面吸附到鼠标所指的物体的顶面。<br>
          拖动物体时，若在物体靠近传送带时按下<div class="keyboard">S</div>键，则可将物体吸附到地面。<br>
          拖动传送带时，若其靠近另一个传送带，按住<div class="keyboard">Space</div>键可将其<div class="inline_R">入口</div>吸附到另一传送带的<div class="inline_G">出口</div>，或将其<div class="inline_G">出口</div>吸附到另一传送带的<div class="inline_R">入口</div>。<br>
          拖动物体时，若按下<div class="keyboard">Shift</div>键，则可改变物体高度。<br>
          按住<div class="keyboard">Shift</div>键再点击物体可多选或取消多选物体。<br>
          按<div class="keyboard">Delete</div>键将删除所有被选中的物体。<br>
          <br>
          <strong>浏览模式</strong><br>
          按
          <div class="keyboard">W</div>、
          <div class="keyboard">S</div>、
          <div class="keyboard">A</div>、
          <div class="keyboard">D</div>
          键可前后左右移动相机。
        </div>
        <div v-if="helpContent=='组件库'" class="help-content">
          组件库中有三种排序模式：<br>
          （1）<strong>无排序方式：</strong>用户在该模式中可以用鼠标左键拖动组件来改变同一层级中组件的顺序；<br>
          （2）<strong>按组件名排序（默认）：</strong>按组件名的拼音顺序自动排序，且文件夹排在其它组件前面；<br>
          （3）<strong>按组件类型排序：</strong>相同类型的组件被自动排在一起，同类型组件按拼音顺序排序。<br>
        </div>
      </span>

      <!--自定义属性工具栏-->  
      <span v-if="popupContent=='prop'" style="display:flex; margin:10px">
        <a-button @click="addCustomProp=true; editProp='';" 
        :disabled="addCustomProp">点此添加属性</a-button>&nbsp;
        <div v-if="addCustomProp">
          <a-input
            v-model:value="newProp"
            placeholder="属性名"
            style="width:200px"
            @keydown="e => {if(e.key=='Enter') createCustomProp()}"
          />&nbsp;
          <a-button style="border:#0B0 solid 1px; color:#0B0" @click="createCustomProp();">
            <CheckOutlined/>
          </a-button>&nbsp;
          <a-button danger @click="closePopup(false)"><CloseOutlined/></a-button>
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
        let textarea: any = e.target;
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
      @click="DT.code=newCode; closePopup()" :disabled="newCode==DT.code">
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

  <!--弹窗时显示遮罩，禁止在弹窗外的操作-->
  <span id="popupMask" style="
    background-color: grey;
    display: none;
    position: absolute;
    left: 0px;
    top: 0px;
    width: 100%;
    height: 100%;
    opacity: 50%;
    z-index: 100;
  "/>
</template>
./Global../Global