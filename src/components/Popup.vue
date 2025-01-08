<script lang="ts">
  import global from "../Global"
  import { ref } from 'vue'
  import {
    CheckCircleOutlined,
    CheckOutlined,
    CloseOutlined,
    PlusOutlined,
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
  const loadingProgress = ref(0);
  var main;
  const newCode = ref('');
  const newProp = ref('');
  var popup;
  var popupMask;
  const popupContent = ref('');
  const popupTitle = ref('');
  const rename = ref('');
  const popupData = ref({content:'', yes:(e=null)=>{}, no:()=>{}});

  export default{
    components:{
      CheckCircleOutlined, 
      CheckOutlined, 
      CloseOutlined,
      PlusOutlined,
    },
    data(){
      return{
        addingDatabase: false,
        allowConnect: false,  // 允许连接
        allowSend: false,  // 是否正在发送数据
        allowRequest: false,  // 允许请求
        customCodeType: '',  // 自定义脚本类型
        databases: {
          cpps_db: {addingTable: false, alltable: false, tables: {orders:true, features: true}}
        },
        dataSend: {
          mode: 1,  // 数据发送模式
          sqlip: "192.168.137.121",  // 字符串
          sqlport: 30928,  // 数字
          username: "cpps",  // 字符串
          password: "cpps",  // 字符串
          alldb: false,
          nocreateinfo: false,
          wheredata: 'NULL',  // 字符串
          delaytime: 5,  // 数字，不小于3
          outputfile: 'E:\\MySOL_Workbench\\111.sql',  // 字符串，选择文件路径
        },
        inputDatabase: '',
        inputTable: '',
        startSendSite: "http://192.168.137.155:8888/DiaoDuStart",
        stopSendSite: "http://192.168.137.155:8888/DiaoDuStop"
      }
    },
    methods:{
      addDatabase(input){  // 添加数据库
        if(!this.databases[input]) {
          this.databases[input] = {addingTable: false, alltable: false, tables: {}};  // 创建数据库
        }
        this.addingDatabase = false;
        this.inputDatabase = '';
      },
      addTable(db, input){  // 添加表
        if(!db.tables[input]) db.tables[input] = true;  // 创建数据库
        db.addingTable = false;
        this.inputTable = '';
      },
      alignWindow(){  // 将弹窗居中放置在界面中央
        this.$nextTick(()=>{  // 异步更新窗口位置
          let rect = popup.getBoundingClientRect();
          popup.style.top = (main.offsetHeight - rect.height)/2 + "px";
          popup.style.left = (main.offsetWidth - rect.width)/2 + "px";
        });
      },
      changeDataMode(mode){  // 切换数据发送模式
        this.allowSend = false;
        this.dataSend.mode = mode; 
        document.getElementById("popupSendData").style.height = mode == 1 ? "auto" : "60vh";
        document.getElementById("popupSendDataScroll").style.overflowY = mode == 1 ? "auto" : "scroll";
        this.alignWindow();
      },
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
      sendData(choice){  // 发送数据
        this.allowSend = choice;
        let dataSend0 = {};
        Object.assign(dataSend0, this.dataSend);
        if(!this.dataSend.alldb){
          dataSend0["databasename"] = {};
          dataSend0["databasename"]["dbnumber"] = Object.keys(this.databases).length;
          Object.keys(this.databases).forEach((dbname, index) => {
            let db = this.databases[dbname];
            let db0 = {
              dbname: dbname,
              alltable: db.alltable + 0,
            };
            if(!db.alltable){
              db0["tablenumber"] = Object.keys(db.tables).length;
              Object.keys(db.tables).forEach((table, index)=>{
                db0[index+1] = table;
              })
            }
            dataSend0["databasename"][index+1] = db0;
          })
        }
        if(choice){
          global.emit("postRequest", {url: this.startSendSite, data: dataSend0});
        }
        else{
          global.emit("getRequest", this.stopSendSite);
        }
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
        addCustomProp, 
        DT, 
        global, 
        customCodeFont, 
        editProp, 
        editValue, 
        helpChange, 
        helpContent, 
        helpTree, 
        loadingProgress,
        newCode, 
        newProp, 
        popup, 
        popupContent, 
        popupMask, 
        popupTitle, 
        rename, 
        popupData
      }
    },
    mounted(){
      for(let node of helpTree) node.title = node.key;
      global.on("closePopup", ()=>{this.closePopup()});
      global.on("popup", (data: any)=>{  // 显示弹窗，弹窗类型由obj.type决定
        DT.value = data.DT;
        // 显示“是否确认动作或重命名组件”窗口
        popupData.value = data.content ? data : null;
        if(popupContent.value == data.type && data.type != "loading" || data.close == true){
          this.closePopup();  // 加载模型时，仅全部加载完后关闭弹窗
        }
        else {
          popupContent.value = data.type;
          popupTitle.value = data.title;
          if(data.progress) loadingProgress.value = JSON.parse(data.progress.toFixed(1));
          if(data.value) rename.value = data.value;
          popup.style.display = popupMask.style.display = "block";
          if(data.type == "code") {  // 自定义脚本
            this.customCodeType = data.customCodeType;  // 自定义脚本类型
            if(typeof DT.value.code[this.customCodeType] == "string") {
              newCode.value = DT.value.code[this.customCodeType] ?? '';
            }
            else if(typeof DT.value.code[this.customCodeType] == "function"){
              newCode.value = DT.value.code[this.customCodeType]?.toString() ?? '';
            }
            else{
              newCode.value = JSON.stringify(DT.value.code[this.customCodeType] ?? '');
            }
          }
          this.alignWindow();
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
  #popup-content .ant-collapse-header .anticon-close svg {
    fill: lightgrey;
  }
  #popup-content .ant-collapse-header .anticon-close svg :hover{
    fill: red;
  }
  #popup-content .ant-collapse-header {
    height: 20px;
  }
  #popup-content .ant-collapse-header > * {
    transform: translateY(-10px);
  }
  .yes-no-content{
    margin-top: 10px; 
    margin-bottom: 12px; 
    margin-right: 10px; 
    text-align: right;
  }
  .yes-no-confirm{
    border:#0B0 solid 1px; 
    color:#0B0; 
    margin-right:10px
  }
</style>

<style scoped>
  .row{
    display: flex;
    align-items: center;
    height: 36px;
  }
  .text{
    display: inline-block;
    width: 150px;
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
      <a-button v-if="popupContent!='loading'" id="popup-quit" danger type="primary" @click="closePopup">
        <CloseOutlined/>
      </a-button>  
    </div>  

    <div class="popup-content" id="popup-content">  
      <!--进度加载栏-->
      <div v-if="popupContent=='loading'" class="yes-no-content">
        <a-progress :percent="loadingProgress" :status="loadingProgress > 99.9 ? '' : 'active'" 
        style="margin-left: 10px; width: 400px"/>
      </div>

      <!--双项选择栏-->
      <div v-if="popupData" style="margin: 10px 10px; text-align: left">
        <div v-for="row in popupData.content.split('\r')">
          &nbsp;&nbsp;&nbsp;&nbsp;{{ row }}
        </div>
      </div>
      <div v-if="popupContent=='yes_no'" class="yes-no-content">
        <a-button class="yes-no-confirm" @click="popupData.yes(); closePopup()">
          是<CheckOutlined/>
        </a-button>
        <a-button danger @click="popupData.no ? popupData.no() : null; closePopup()">
          否<CloseOutlined/>
        </a-button>
      </div>

      <!--重命名窗口-->
      <div v-if="popupContent=='rename'" class="yes-no-content">
        <a-input v-model:value="rename" style="width: 97%; margin-bottom:10px"></a-input>
        <a-button class="yes-no-confirm" @click="popupData.yes(rename); closePopup()">
          是<CheckOutlined/>
        </a-button>
        <a-button danger @click="popupData.no ? popupData.no() : null; closePopup()">
          否<CloseOutlined/>
        </a-button>
      </div>

      <!--帮助-->
      <div v-if="popupContent=='help'" style="display: flex; margin-top: 10px; text-align: left">
        <a-tree v-model:selectedKeys="helpContent" :tree-data="helpTree"
        @select="e => helpContent = e[0]">
          <template #title="node">
            <div v-if="node.key==helpContent" style="color:dodgerblue">{{node.key}}</div>
            <div v-else>{{node.key}}</div>
          </template>
        </a-tree>
        <div v-if="helpContent=='场景'" class="help-content">
          <strong>窗口</strong><br>
          按<div class="keyboard">Ctrl</div>+<div class="keyboard">R</div>键会弹出确认重新加载窗口；<br>
          按<div class="keyboard">Ctrl</div>+<div class="keyboard">W</div>键会弹出确认退出程序窗口。<br>
          <br>
          <strong>相机控制</strong><br>
          在场景中，按鼠标中键或同时按鼠标左右键可移动相机，按右键可旋转相机，滚动滚轮可放大或缩小；<br>
          双击层级树中的结点可将镜头拉近到该物体。<br>
          <br>
          <strong>编辑模式</strong><br>
          按左键即可选中物体，此时物体上会出现控制器。在拖动控制器时：<br>
          按<div class="keyboard">Q</div>键进入移动模式；<br>
          按<div class="keyboard">W</div>键进入旋转模式；<br>
          按<div class="keyboard">E</div>键切换全局坐标系或局部坐标系；<br>
          按<div class="keyboard">Esc</div>或<div class="keyboard">Ctrl</div>+<div class="keyboard">Z</div>键撤销当前做出的移动。<br>
          <br>
          拖动物体时，若滚动滚轮，则可让物体围绕滚轮旋转；<br>  
          拖动物体时，若按下<div class="keyboard">A</div>键，则可将物体的底面吸附到鼠标所指的物体的顶面；<br>
          拖动物体时，若在物体靠近传送带时按下<div class="keyboard">S</div>键，则可将物体吸附到地面；<br>
          拖动传送带时，若按下<div class="keyboard">A</div>键，则可将控制器切换到伸缩模式，从而改变直道传送带长度；<br>
          拖动传送带时，若其靠近另一个传送带，其会自动将<div class="inline_R">入口</div>吸附到另一传送带的<div class="inline_G">出口</div>，或将其<div class="inline_G">出口</div>吸附到另一传送带的<div class="inline_R">入口</div>；<br>
          拖动物体时，若按下<div class="keyboard">Shift</div>键，则可改变物体高度；<br>
          按住<div class="keyboard">Shift</div>键再点击物体可多选或取消多选物体；<br>
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
      </div>

      <!--自定义属性工具栏-->  
      <div v-if="popupContent=='prop'" style="display:flex; margin:10px">
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
      </div>

      <!--自定义属性表--> 
      <div v-if="popupContent=='prop'">
        <a-table bordered :data-source="obj2table(DT.custom)">
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
      </div>

      <!--自定义脚本-->
      <div v-if="popupContent == 'code'">
        <div style="margin: 10px 10px 0 10px; text-align: left;">
          参数：
          <span v-if="customCodeType == 'update'">
            mesh=此物体；DT=对应的DTObject；rb=对应的刚体
          </span>
          <span v-else>
            mesh0/mesh1=此物体/与之碰撞的物体；DT=对应的DTObject；DTs=与此物体碰撞的所有物体；rb0/rb1=对应的刚体；collider0/collider1=对应的碰撞体
          </span>
        </div>
        <textarea class="customCode" id="customCode" placeholder="自定义脚本"
        v-model="newCode"
        v-on="this.$nextTick(()=>{setCustomCodeFont(customCodeFont)})"
        @keydown="e=>{ 
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
        <a-button class="buttonCustomCode"
        @click="DT.code[customCodeType]=newCode; closePopup()" :disabled="newCode==DT.code">
          保存
        </a-button>
        <a-button class="buttonCustomCode"
        @click="newCode=''" :disabled="newCode==''">
          清空
        </a-button>
        <span style="display:flex;" class="buttonCustomCode">
          <div style="margin-top:4px">字体大小：</div>
          <a-slider :min=0 :max=6 :step=1 :tooltipVisible="false" 
          @change="e=>{customCodeFont=e}" 
          :value="customCodeFont" style="width: 100px"/>
        </span>
      </div>

      <!--数据发送设置-->
      <div v-if="popupContent=='sendData'" id="popupSendData" style="
        display: flex;
        flex-direction: column;
        text-align: left; 
        margin: 10px; 
        overflow-y: hidden;
        width: 500px;
      ">
        <div class="row">
          <span class="text">允许连接服务器：</span>
          <a-checkbox style="width:100px" v-model:checked="allowConnect" 
          @change="global.emit(allowConnect ? 'startConnect' : 'stopConnect'); alignWindow()">
            {{ allowConnect ? '是': '否'}}
          </a-checkbox><br>
        </div>
        <div class="row">
          <span class="text">允许发送请求：</span>
          <a-checkbox style="width:100px" v-model:checked="allowRequest" 
          @change="global.emit('changeAllowRequest', allowRequest); alignWindow()">
            {{ allowRequest ? '是': '否'}}
          </a-checkbox><br>
        </div>
        <div style="background-color: #EEE;"> 
          数据发送模式：
          <a-radio :checked="dataSend.mode==1" @change="changeDataMode(1)">模式1（自动读取）</a-radio>
          <a-radio :checked="dataSend.mode==2" @change="changeDataMode(2)">模式2（返回SQL文件）</a-radio>
        </div>
        <div id="popupSendDataScroll" style="margin: 10px 0;">
          <div v-if="dataSend.mode == 1">自动读取JSON数据</div>
          <div v-else>
            <div class="row">
              <span class="text">IP地址：</span>
              <a-input style="width:200px" v-model:value="dataSend.sqlip"/>
              <br>
            </div>
            <div class="row">
              <span class="text">端口号：</span>
              <a-input type="number" step="1" style="width:200px" v-model:value="dataSend.sqlport"/>
              <br>
            </div>
            <div class="row">
              <span class="text">用户名：</span>
              <a-input style="width:200px" v-model:value="dataSend.username"/>
              <br>
            </div>
            <div class="row">
              <span class="text">密码：</span>
              <a-input style="width:200px" v-model:value="dataSend.password"/>
              <br>
            </div>
            <div class="row">
              <span class="text">导出所有数据库：</span>
              <a-checkbox style="width:100px" v-model:checked="dataSend.alldb" @change="alignWindow">
                {{ dataSend.alldb ? '是': '否'}}
              </a-checkbox><br>
            </div>
            <div v-if="!dataSend.alldb">选择要导出的数据库与表：</div>
            <div v-if="!dataSend.alldb" style="
              border: 1px solid black;
              border-radius: 5px;
              height: 200px; 
              margin: 10px 0;
              overflow-y: scroll;
              padding: 10px;
            ;">
              <strong v-if="Object.keys(databases).length">
                已选择{{Object.keys(databases).length}}个数据库<br>
              </strong>
              <strong v-if="Object.keys(databases).length==0">未选择数据库<br></strong>
              <a-collapse v-else accordion>
                <a-collapse-panel v-for="(item, key) in databases" :header="key" :key="key">
                  导出所有表：<a-checkbox style="width:100px" v-model:checked="item.alltable" @change="alignWindow">
                    {{ item.alltable ? '是': '否'}}
                  </a-checkbox><br>
                  <div v-if="!item.alltable">
                    <strong v-if="Object.keys(item.tables).length==0">未选择表<br></strong>
                    <div v-else>
                      <strong>已选择{{Object.keys(item.tables).length}}个表</strong>
                      <a-collapse collapsible="icon">
                        <a-collapse-panel v-for="(item0, key0) in item.tables" 
                        :header="key0" :key="key0" :show-arrow="false">
                          <template #extra><close-outlined @click="delete item.tables[key0]"/></template>
                        </a-collapse-panel>
                      </a-collapse>
                    </div>
                    <a-button v-if="!item.addingTable" @click="item.addingTable=true"
                    style="border-color: dodgerblue; color: dodgerblue; margin-top: 10px">
                      <PlusOutlined/>添加表
                    </a-button>
                    <div v-else>
                      添加表：<a-input style="width: 150px;" placeholder="请输入表名" 
                      v-model:value="inputTable"/>
                      <a-button style="border: #0B0 solid 1px; color: #0B0; margin: 0 10px;" 
                      @click="addTable(item, inputTable)" :disabled="!inputTable">
                        &nbsp;<CheckOutlined/>
                      </a-button>
                      <a-button danger @click="item.addingTable = false; inputTable = ''">
                        <CloseOutlined/>
                      </a-button>
                    </div>
                  </div>
                  <template #extra><close-outlined @click="delete databases[key]"/></template>
                </a-collapse-panel>
              </a-collapse>
              <a-button v-if="!addingDatabase" @click="addingDatabase=true"
              style="border-color: dodgerblue; color: dodgerblue; margin: 10px 0">
                <PlusOutlined/>添加数据库
              </a-button>
              <div v-else>
                添加数据库：<a-input style="width: 150px;" placeholder="请输入数据库名" 
                v-model:value="inputDatabase"/>
                <a-button style="border: #0B0 solid 1px; color: #0B0; margin: 0 10px;" 
                @click="addDatabase(inputDatabase)" :disabled="!inputDatabase">
                  &nbsp;<CheckOutlined/>
                </a-button>
                <a-button danger @click="addingDatabase = false; inputDatabase = ''">
                  <CloseOutlined/>
                </a-button>
              </div>
            </div>
            <div class="row">
              <span class="text">不导出表结构：</span>
              <a-checkbox style="width:100px" v-model:checked="dataSend.nocreateinfo">
                {{ dataSend.nocreateinfo ? '是': '否'}}
              </a-checkbox>
              <br>
            </div>
            <div class="row">
              <span class="text">数据筛选条件：</span>
              <a-input v-model:value="dataSend.wheredata" style="width:300px"/>
              <br>
            </div>
            <div class="row">
              <span class="text">导出频率：</span>
              <a-input type="number" min="3" step="1" addon-after="s"
              style="width:100px" v-model:value="dataSend.delaytime"/>
              <br>
            </div>
            <div class="row">
              <span class="text">导出位置：</span>
              <a-input v-model:value="dataSend.outputfile" 
              placeholder="选择stl文件路径" style="width:300px"/>
              <br>
            </div>
            <div class="row">
              <span class="text">数据开始发送地址：</span>
              <a-input v-model:value="startSendSite" style="width:300px"/>
              <br>
            </div>
            <div class="row">
              <span class="text">数据结束发送地址：</span>
              <a-input v-model:value="stopSendSite" style="width:300px"/>
            </div>
          </div>
        </div>
        <div style="margin: 10px 0; text-align: center; user-select:none;">
          <a-button type="primary" :disabled="allowSend" @click="sendData(true)">开始发送</a-button>
          <span style="opacity: 0; width: 10px">————</span>
          <a-button :disabled="!allowSend" @click="sendData(false)">关闭发送</a-button>
        </div>
      </div>
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