<script lang="ts">
    import global from "./Global"
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
    var clipboard;  //  剪贴板，即被复制的选项
    var DTObjects;
    var expanded = ref([]);  // 展开的选项
    var lastChoice;  //  上一个选项
    var shift = false;  // 是否按下Shift键
    var space = false;  // 是否按下空格键
    const searchValue = ref("");
    var TREE = ref();
    var TREEs = ref([]);
    var wireframe = "包围盒";

    function emitProperty(){  // 将物体id发送到属性栏
      let len = choices.value.length;
      if(len == 0){global.emit("showProperty", "未选择对象")}
      else if(len == 1){global.emit("showProperty", choices.value[0])}
      else {global.emit("showProperty", `已选择${len}个对象`)}
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
        global.on("changeWireframe", (x)=>{wireframe = x;}) 
        global.on("clickModel", (id_shift: string)=>{  // 点击屏幕中的物体
          let id_shift_split = id_shift.split(',');
          let selection = JSON.parse(id_shift_split[0]);
          let shift = JSON.parse(id_shift_split[1]);
          if(shift){  // 按住shift为多选模式
            if(choices.value.includes(selection))  // 多选取消
              choices.value = choices.value.filter(k => k != selection);
            else choices.value.push(selection);  // 多选选择
            global.emit("controlEnd")  // 收起控制器
          }
          else{  // 单选
            choices.value = [selection];
            global.emit("controlStart", selection);  // 选中物体开始控制
          }
        });
        global.on("deselect", ()=>{  // 取消选择
          this.deselect();
          global.emit("controlEnd")  // 收起控制器
        });
        global.on("deleteChoices", ()=>{this.deleteChoices()});
        global.on("foldAll", ()=>{this.foldAll()});
        global.on("updateSearch", ()=>{this.search(TREE.value)});
        global.on("updateTree", ()=>{
          try {global.DTScene().setRow(expanded.value);} 
          catch(e) {console.log(e)}
          let DTScene = global.DTScene();
          DTObjects = DTScene.getDTObjects();         
          TREE.value = [DTScene];
        });
        return {choices, expanded, TREE, TREEs};
      },
      methods: {
        action(e){  // 从右键菜单选择操作
          let option = e.key;
          var DT;
          if(option == "取消选择") choices.value = []; 
          if(option == "添加平行光"){
            global.emit("createLight", "DirectionalLight");
          }
          if(option == "添加环境光"){
            global.emit("createLight", "AmbientLight");
          }
          if(option == "克隆"){
            if(!choices.value.includes(DT.id)) choices.value = [DT.id]
            let temp = []
            for(let id of choices.value){
              let clone = DT.clone();
              clone.wireframe = clone.children.filter(x=>x.type="BoxHelper")[0];
              DT.parent.add(clone);
              temp.push(clone.id);
            }
            for(let id of temp)choices.value.push(id);
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
          this.updateLine();
        },
        deleteChoices(){
          for(let id of choices.value){
            let DTObject = global.DTScene().findDTObjectById(id);
            if(DTObject) DTObject.destroy();
          }
          global.emit("updateTree");
        },  // 删除所选模型
        deselect(){  // 点别处取消点选模型
          global.emit("deselectAsset");
          choices.value = [];
          global.emit("controlEnd");  // 收起控制器
        },
        doubleClick(){  // 双击将相机拉近至物体
          choices.value = [lastChoice];
          global.emit("cameraMoveTo", lastChoice);
        },
        dragFrom(e){  // 开始拖拽
          // console.log(e)
        },
        dragTo(e){  // 结束拖拽
          let sourceDT = e.dragNode.dataRef, targetDT = e.node.dataRef;
          if(!targetDT.children.includes(sourceDT)){
            targetDT.mesh.attach(sourceDT.mesh);  // attach方法既改变父子关系，又不改变物体的绝对坐标
            //sourceDT.mesh.scale.setScalar(1, 1, 1);
            global.DTScene().updateChildren();
            if(!expanded.value.includes(targetDT.key)) expanded.value.push(targetDT.key);
            this.updateLine();
          }
        },
        foldAll(){  // 折叠全部并隐藏连接线
          this.expanded.value = [];
          this.updateLine();
        },
        onClick(_, Selection){  // 点击Tree中的项目)
          let selection = Selection.node.key;
          if(choices.value.length == 1 && selection == lastChoice) {  // 取消选择
            choices.value = choices.value.filter(k => k != selection);
            global.emit("controlEnd");  // 收起控制器
          } 
          else if(shift) {  // 按shift进入默认的多选模式
            if(choices.value.includes(selection)){  // 多选取消
              choices.value = choices.value.filter(k => k != selection);
            } else {  // 多选选择
              choices.value.push(selection);
            }
            global.emit("controlEnd");  // 收起控制器
          }
          else {  // 单选
            choices.value = [selection];
            global.emit("controlStart", selection);  // 选中物体开始控制
            lastChoice = selection;
          }
          global.emit("deselectAsset")  // 点击外部则取消选择组件
        },
        onKeydown(k){
          if(k.code == "Delete") {this.deleteChoices();}
          else if(k.code == "ShiftLeft") shift = true;
          else if (k.code == "Space") space = true;
        },
        search(){  // 搜索栏内容改变时
          if(searchValue.value){
            TREEs.value = DTObjects.filter(DT => DT.title.indexOf(searchValue.value) > -1);
          }
        },
        update(){  // 更新线框和属性栏
          emitProperty();
          if(wireframe == "包围盒"){  // 更新物体包围盒线框
            for(let DT of global.DTScene().getDTObjects()){
              if(DT.wireframe) 
                DT.wireframe.visible = choices.value.includes(DT.id);
            };
          }
          if(wireframe == "边缘发光"){  // 更新物体边缘线框
            global.emit("lightWireframe", null);
            global.emit("lightWireframe", global.DTScene().getDTObjects()
              .filter(DT => choices.value.includes(DT.id))
              .map(DT => DT.mesh)
            );
          }
          this.updateLine();
        },
        updateLine(){  // 更新层级树的连接线和内容
          global.emit("updateTree");   
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
          this.update();
        });
        watch(computed(()=>choices.value.length), ()=>{
          this.update();
        });
        watch(TREE, ()=>{global.emit('updateSearch');});
      },
    });
</script>

<style>
  #hierarchy{
    display:flex; outline: none
  }
  .treelineH{
    background-color: lightgrey;
    position: absolute; 
    top: 11px; 
    left: -14px;
    width: 12px;
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
      :selectedKeys = "choices" 
      style="margin-left: 6px"
      :tree-data="TREE" 
      @contextmenu="(e)=>console.log(e)"
      @dblclick="doubleClick" @expand="update" @select="onClick"
      @dragstart="dragFrom" @drop="dragTo">
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
            <div v-if="DT.title!='Scene' && DT.isLeaf" class="treelineH"/>
            <!--纵向连接线-->
            <div v-if="DT.row" class="treelineV" :style="{'height': 12+(DT.row-1)*28+'px'}"/>
          </span>
        </template> 
        <!--展开和折叠标志-->
        <template #switcherIcon="DT">
          <span style="background-color:white; margin-left: -2px">
            <MinusSquareOutlined v-if="DT.expanded"/>
            <PlusSquareOutlined v-else/>
          </span>
        </template>
      </a-tree>  
      <!--搜索树-->
      <a-tree v-else :tree-data="TREEs" multiple @select="onClick" :selectedKeys = "choices">
        <template #title="DT">
          <span style="margin-left: -18px">
            <BorderlessTableOutlined v-if="DT.type=='GridHelper'"/>
            <BulbOutlined v-if="DT.mesh.isLight"/>
            <CodepenOutlined v-if="DT.mesh.isMesh"/>
            <DragOutlined v-if="DT.type=='AxesHelper'"/>
            <DropboxOutlined v-if="DT.mesh.isGroup || DT.mesh.isScene"/>
            <span>&nbsp;{{ DT.title.substring(0, DT.title.indexOf(searchValue)) }}</span>
            <span style="color: red"><strong>{{ searchValue }}</strong></span>
            <span>{{ DT.title.substring(DT.title.indexOf(searchValue) + searchValue.length) }}</span>
          </span>
        </template> 
      </a-tree> 
    </div>
    <!--右键菜单-->
    <template #overlay v-if="!searchValue">
      <a-menu @click="action">
        <a-menu-item :disabled="!choices.length" key="取消选择">取消选择</a-menu-item>
        <a-sub-menu title="添加">
          <a-menu-item key="添加平行光">平行光</a-menu-item>
          <a-menu-item key="添加环境光">环境光</a-menu-item>
        </a-sub-menu>
        <a-menu-item key="全部展开">全部展开</a-menu-item>
        <a-menu-item key="全部折叠">全部折叠</a-menu-item>
        <a-menu-item key="删除">删除</a-menu-item>
      </a-menu>
    </template>
  </a-dropdown> 
</template>
./Global./Global