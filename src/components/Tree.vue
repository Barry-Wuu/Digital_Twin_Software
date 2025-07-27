<script lang="ts">
    import global from "../Global"
    import {
        BorderlessTableOutlined,  // 网格图标
        BulbOutlined,  // 灯光图标
        CloseOutlined,  // 清除图标
        CodepenOutlined,  //模型图标
        DragOutlined,  // 坐标轴图标
        DropboxOutlined,  // 根结点图标
        CarryOutOutlined, 
        FormOutlined,
        PlusSquareOutlined,
        MinusSquareOutlined
    } from '@ant-design/icons-vue';
    import { computed, defineComponent, ref, watch } from 'vue';

    var choices = ref([]);  // 已选项，内为各个被选中模型的ID
    var clipboard;  //  剪贴板，以后用于复制黏贴选项
    var DTObjects;
    var expanded = ref([]);  // 展开的选项
    var lastChoice;  //  上一个选项
    var shift = false;  // 是否按下Shift键
    var space = false;  // 是否按下空格键
    const searchValue = ref("");
    var TREE = ref();
    var TREEs = ref([]);
    var wireframe: any = "包围盒";

    function emitProperty(){  // 将物体id发送到属性栏
      let len = choices.value.length;
      if(len == 0) global.emit("hideProperty");
      else if(len == 1) global.emit("showProperty", choices.value[0]);
      else global.emit("showMultipleProperty", len);
    }

    export default defineComponent({
      components: {
        BorderlessTableOutlined,
        BulbOutlined,
        CloseOutlined,
        CodepenOutlined,
        DragOutlined,
        DropboxOutlined,
        CarryOutOutlined,
        FormOutlined,
        PlusSquareOutlined,
        MinusSquareOutlined
      },
      data(){
        global.on("changeWireframe", x => {wireframe = x;}) 
        global.on("clickModel", (data: {id, shift}) => {  // 点击屏幕中的物体
          let choice = data.id;
          if(data.shift){  // 按住shift为多选模式
            if(choices.value.includes(choice)) {  // 多选取消
              choices.value = choices.value.filter(k => k != choice);
            } else{  // 多选选择
              choices.value.push(choice);
            } 
            if(choices.value.length == 1){  // 只有一个物体被选时控制该物体
              global.emit("controlStart", choices.value[0]);
              global.SCENE.DT.updateGroupWireframes();
            }
            else global.emit("controlEnd");  // 选中多个物体时收起控制器
            this.updateTree();
          }
          else{  // 单选
            choices.value = [choice];
            global.emit("controlStart", choice);  // 选中物体开始控制
            global.SCENE.DT.updateGroupWireframes();
          }
        });
        global.on("deselect", () => this.deselect());  // 取消选择
        global.on("deleteChoices", () => this.deleteChoices());
        global.on("foldAll", () => this.foldAll());
        global.on("updateSearch", () => this.search(TREE.value));
        global.on("updateTree", () => this.updateTree());
        global.on("updateTreeLines", () => this.updateTreeLines());  // 更新层级树连接线
        return {choices, expanded, TREE, TREEs};
      },
      methods: {
        action(e){  // 从右键菜单选择操作
          let option = e.key;
          if(option == "取消选择") choices.value = []; 
          if(option == "创建群组")
            global.emit("createMesh", "Group");
          if(option == "创建平行光")
            global.emit("createMesh", "DirectionalLight");
          if(option == "创建环境光")
            global.emit("createMesh", "AmbientLight");
          if(option == "克隆"){
            let DT = this.findDTObjectById(choices.value[0]);
            if(!choices.value.includes(DT.id)) choices.value = [DT.id];
            let temp = []
            for(let id of choices.value){
              let clone = DT.clone();
              DT.parent.add(clone);
              temp.push(clone.id);
            }
            for(let id of temp)choices.value.push(id);
          }
          if(option == "添加到自定义模型"){
            for(let id of choices.value) {
              let DT = this.findDTObjectById(id);
              let data = {basename: DT.basename, name: DT.name, physicalID: DT.physicalID};
              global.emit("saveCustomModel", data);
            }
          }
          if(option == "全部展开") {
            function traverse(DTObject){
              if(!expanded.value.includes(DTObject.key)){
                expanded.value.push(DTObject.key);
              }
              for(let child of DTObject.children){
                traverse(child);
              }
            }
            traverse(TREE.value[0]);
          }
          if(option == "全部折叠") this.expanded = [];
          if(option == "删除") this.deleteChoices();
          this.updateTree();
        },
        deleteChoices(){
          for(let id of choices.value){
            let DTObject = this.findDTObjectById(id);
            if(DTObject){
              for(let child of DTObject.children){
                if(choices.value.includes(child.id)){
                  child.destroy();
                }
              }
              DTObject.destroy();
            }
          }
          global.emit("hideProperty");  // 清空属性栏
          this.updateTree();
        },  // 删除所选模型
        deselect(){  // 点别处取消点选模型
          global.emit("deselectAsset");
          choices.value = [];
          global.emit("controlEnd");  // 收起控制器
          global.emit("hideProperty");  // 清空属性栏
        },
        doubleClick(){  // 双击将相机拉近至物体
          choices.value = [lastChoice];
          global.emit("cameraMoveTo", lastChoice);
        },
        findDTObjectById(id){
          return global.SCENE.DT.findDTObjectById(id);
        },
        foldAll(){  // 折叠全部并隐藏连接线
          this.expanded.value = [];
          this.updateLine();
        },
        onClick(e, Selection){  // 点击Tree中的项目，!e.event代表用左键点击，反之则为右键点击
          let selection = e.node ? e.node.key : Selection.node.key;
          if(e.event && choices.value.length > 1) return;  // 选中多个选项时按右键不改变选项
          if(!e.event && choices.value.length == 1 && selection == lastChoice) {  // 左键取消选择
            choices.value = choices.value.filter(k => k != selection);
            global.emit("controlEnd");  // 收起控制器
          } 
          else if(!e.event && shift) {  // 按shift为左键多选
            if(choices.value.includes(selection)){  // 多选取消
              choices.value = choices.value.filter(k => k != selection);
            } else {  // 多选选择
              choices.value.push(selection);
            }
            global.emit("controlEnd");  // 收起控制器
          }
          else{  // 左键或右键单选，右键不取消单选
            choices.value = [selection];
            global.SCENE.DT.updateGroupWireframes();  // 更新Group位置
            global.emit("controlStart", {id:selection, left_click:!e.event});  // 选中物体开始控制
            lastChoice = selection;
          }
        },
        onDrop(e){  // 结束拖拽
          let sourceDT = e.dragNode.dataRef, targetDT = e.node.dataRef;
          if(!targetDT.children.includes(sourceDT)){
            targetDT.mesh.attach(sourceDT.mesh);  // attach方法改变父子关系，同时不改变物体的绝对坐标
            //sourceDT.mesh.scale.setScalar(1, 1, 1);
            sourceDT.scale = sourceDT.mesh.scale.x;
            global.SCENE.DT.updateChildren();
            if(!expanded.value.includes(targetDT.key)) expanded.value.push(targetDT.key);
            this.updateTree();
          }
        },
        onKeydown(k){
          if(k.code == "Delete") {this.deleteChoices();}
          else if(k.code == "ShiftLeft") shift = true;
          else if (k.code == "Space") space = true;
        },
        search(){  // 搜索栏内容改变时
          if(searchValue.value){
            TREEs.value = DTObjects.filter(
              DT => DT.title.indexOf(searchValue.value) > -1
            );
          }
        },
        updateTree(){  // 更新层级树的内容
          emitProperty();
          if(wireframe == "包围盒"){  // 更新物体包围盒线框
            global.emit("hideEdgeGlow");  // 熄灭被选中物体的边缘
            for(let DT of global.SCENE.DT.getDTObjects()){  // 根据标签更新各子物体是否可见
              let chosen = choices.value.includes(DT.id);
              if(DT.layers.wireframe.length){    
                if(DT.layers.label && DT.layers.label[0])
                  DT.layers.label[0].element.textContent = chosen ? DT.name : '';
                DT.layers.wireframe[0].visible = chosen;
              }
              else if(DT.mesh.isLight){
                let arrow = DT.mesh.children.filter(mesh => mesh.type == "ArrowHelper")[0];
                if(arrow) arrow.visible = chosen && global.layers.includes("lightArrow");
                if(arrow) arrow.visible = chosen && global.layers.includes("lightArrow");
                let icon = DT.mesh.children.filter(mesh => mesh.isCSS2DObject)[0].element;
                if(icon) icon.style.border = chosen ? "1px solid cyan" : "";
              }
              if(DT.label == "sensor"){
                let sensorArrow = DT.layers.indicator[0];
                sensorArrow.visible = chosen && global.layers.includes("indicator");
              }
            };
          }
          if(wireframe == "边缘发光"){  // 点亮被选中物体的边缘
            global.emit("setEdgeGlow", global.SCENE.DT.getDTObjects()
              .filter(DT => choices.value.includes(DT.id))
              .map(DT => DT.mesh)
            );
          }
          DTObjects = global.SCENE.DT.getDTObjects();
          TREE.value = [global.SCENE.DT];
          this.updateTreeLines();
        },
        updateTreeLines(){  // 更新层级树的连接线和内容 
          try {global.SCENE.DT.setRow(expanded.value);} 
          catch(e) {console.log(e)}
        }
      },
      
      setup() {
        function onExpand(k){
          expanded.value = k;
        };
        return {choices, onExpand, searchValue};
      },
      mounted(){
        window.addEventListener('click', (k)=>{
          //this.deselect();
        });  
        window.addEventListener('keydown', (k)=>{
          
        });  
        window.addEventListener('keyup', (k)=>{
          if(k.code == "ShiftLeft") shift = false;
          if (k.code == "Space") space = false;
        });  
        watch(computed(()=>choices.value[0]), ()=>{  // 根据选项变化来确定被选物体，并展示或隐藏物体边框
          this.updateTree();
        });
        watch(computed(()=>choices.value.length), ()=>{
          this.updateTree();
        });
        watch(TREE, ()=>{global.emit('updateSearch')});
      },
    });
</script>

<style>
  #hierarchy{
    display:flex; outline: none
  }
  .treelineH1{
    background-color: lightgrey;
    position: absolute; 
    top: 11px; 
    left: -14px;
    width: 12px;
    height: 2px;
  }
  .treelineH2{
    background-color: lightgrey;
    position: absolute; 
    top: 11px; 
    left: -6px;
    width: 4px;
    height: 2px;
  }
  .treelineV{
    background-color: lightgrey;
    position: absolute; 
    top: 28px; 
    left: 10px; 
    width: 2px;
  }
</style>

<template>
  <!--搜索栏-->
  <a-input-search v-model:value="searchValue" placeholder="搜索"
    style="margin-bottom: 8px" @change="search" @search="()=>{searchValue = ''}">
      <template #enterButton>
        <a-button :disabled="!searchValue" type="primary"><CloseOutlined/></a-button>
      </template>
  </a-input-search>
  <a-dropdown :trigger="['contextmenu']">
    <div id="hierarchy" tabindex="0" @click="deselect" @keydown="onKeydown">
      <!--层级树-->
      <a-tree v-if="!searchValue" @click.stop draggable multiple selectable
      v-model:expandedKeys = "expanded"
      :selectedKeys="choices" 
      :tree-data="TREE" 
      style="margin-left: 6px"
      @dblclick="doubleClick" @expand="updateTree" @select="onClick" @rightClick="onClick"
      @drop="onDrop">
        <!--各个结点-->
        <template #title="DT">
          <span style="white-space: nowrap">
            <BorderlessTableOutlined v-if="DT.type=='GridHelper'"/>
            <BulbOutlined v-if="DT.mesh.isLight"/>
            <CodepenOutlined v-if="DT.mesh.isMesh"/>
            <DragOutlined v-if="DT.type=='AxesHelper'"/>
            <DropboxOutlined v-if="DT.mesh.isGroup || DT.mesh.isScene"/>
            {{ DT.title }}
            <!--横向连接线-->
            <sup v-if="DT.title!='Scene' && DT.isLeaf" class="treelineH1"/>
            <div v-else class="treelineH2"/>
            <!--纵向连接线-->
            <div v-if="DT.tree.row" class="treelineV" :style="{'height': 12+(DT.tree.row-1)*28+'px'}"/>
          </span>
        </template> 
        <!--展开和折叠标志-->
        <template #switcherIcon="DT">
          <span style="background-color: white; margin-left: -2px;">
            <MinusSquareOutlined v-if="DT.tree.expanded"/>
            <PlusSquareOutlined v-else/>
          </span>
        </template>
      </a-tree>  
      <!--搜索树-->
      <a-tree v-else-if="TREEs.length"
      multiple :selectedKeys="choices" :tree-data="TREEs" 
      @click.stop @dblclick="doubleClick" @select="onClick">
        <template #title="DT">
          <span style="margin-left: -18px">
            <BorderlessTableOutlined v-if="DT.type=='GridHelper'"/>
            <BulbOutlined v-if="DT.mesh.isLight"/>
            <CodepenOutlined v-if="DT.mesh.isMesh"/>
            <DragOutlined v-if="DT.type=='AxesHelper'"/>
            <span>&nbsp;{{ DT.title.substring(0, DT.title.indexOf(searchValue)) }}</span>
            <span style="color: red"><strong>{{ searchValue }}</strong></span>
            <span>{{ DT.title.substring(DT.title.indexOf(searchValue) + searchValue.length) }}</span>
          </span>
        </template> 
      </a-tree>
      <a-alert v-else message="无匹配结果" style="width:100%" type="error" />
    </div>
    <!--右键菜单-->
    <template #overlay v-if="!searchValue">
      <a-menu @click="action">
        <a-menu-item v-if="choices.length" key="取消选择">取消选择</a-menu-item>
        <a-menu-item key="全部展开">全部展开</a-menu-item>
        <a-menu-item key="全部折叠">全部折叠</a-menu-item>
        <hr v-if="choices.length" class="splitH"/>
        <a-sub-menu title="创建">
          <a-menu-item key="创建群组">群组</a-menu-item>
          <a-menu-item key="创建平行光">平行光</a-menu-item>
          <a-menu-item key="创建环境光">环境光</a-menu-item>
        </a-sub-menu>
        <a-menu-item v-if="choices.length == 1 && ['sensor', 'WIP'].includes(
        findDTObjectById(choices[0])?.label)" key="添加到自定义模型">
          添加到自定义模型
        </a-menu-item>
        <hr v-if="choices.length" class="splitH"/>
        <a-menu-item v-if="choices.length" key="删除" style="color:red">删除</a-menu-item>
      </a-menu>
    </template>
  </a-dropdown> 
</template>
