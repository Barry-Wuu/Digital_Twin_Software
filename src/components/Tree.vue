<script lang="ts">
    import BUS from "./EventBus"
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
    import { defineComponent, ref, watch } from 'vue';

    var choices = ref([]);  // 已选项，内为各个被选中模型的ID
    var clipboard;  //  剪贴板，即被复制的选项
    var DTObjects;
    var expanded = ref([]);  // 展开的选项
    var lastChoice;  //  上一个选项
    var shift = false;  // 是否按下Shift键
    const searchValue = ref("");
    var t0 = -999;
    var TREE = ref();
    var TREEs = ref([]);
    function emitProperty(){  // 将物体id发送到属性栏
      let len = choices.value.length;
      if(len == 0){BUS.emit("showProperty", "未选择对象")}
      else if(len == 1){BUS.emit("showProperty", choices.value[0])}
      else {BUS.emit("showProperty", `已选择${len}个对象`)}
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
        BUS.on("clickModel", (id_shift: string)=>{  // 点击屏幕中的物体
          let id_shift_split = id_shift.split(',');
          let selection = JSON.parse(id_shift_split[0]);
          let shift = JSON.parse(id_shift_split[1]);
          if(shift){  // 按住shift为多选模式
            if(choices.value.includes(selection))  // 多选取消
              choices.value = choices.value.filter(k => k != selection);
            else choices.value.push(selection);  // 多选选择
          }
          else{
            choices.value = [selection]; 
          }  // 单选
          //BUS.emit("BottomMessage", choices.value.length>0 ? `选择${choices.value.length}个物体` : "无");
        });
        BUS.on("deselect", ()=>{
          this.deselect();
          //BUS.emit("BottomMessage", "无");
        });
        BUS.on("deleteChoices", ()=>{this.deleteChoices()});
        BUS.on("foldAll", ()=>{this.foldAll()});
        BUS.on("updateSearch", ()=>{this.search(TREE.value)});
        BUS.on("updateTree", ()=>{
          try {BUS.getDTScene().setRow(expanded.value);} 
          catch(e) {console.log(e)}
          let DTScene = BUS.getDTScene();
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
          this.update();
        },
        deleteChoices(){
          for(let id of choices.value){
            let DTObject = BUS.getDTScene().findDTObjectById(id);
            if(DTObject) DTObject.destroy();
          }
          BUS.emit("updateTree");
        },  // 删除所选模型
        deselect(){choices.value = []},  // 点别处取消点选模型
        dragFrom(e){  // 开始拖拽
          // console.log(e)
        },
        dragTo(e){  // 结束拖拽
          let sourceDT = e.dragNode.dataRef, targetDT = e.node.dataRef;
          console.log(targetDT);
          if(!targetDT.children.includes(sourceDT)){
            targetDT.mesh.add(sourceDT.mesh);
            sourceDT.mesh.rotation.set(0, 0, 0);
            sourceDT.mesh.scale.set(1, 1, 1);
            BUS.getDTScene().updateChildren();
            if(!expanded.value.includes(targetDT.key)) expanded.value.push(targetDT.key);
            this.update();
          }
        },
        foldAll(){  // 折叠全部并隐藏连接线
          this.expanded.value = [];
          this.update();
        },
        onClick(_, Selection){  // 点击Tree中的项目
          let selection = Selection.node.key;
          let time = new Date().getTime();
          let dt = time - t0;
          if(choices.value.length == 1 && selection == lastChoice)  // 取消选择
            choices.value = choices.value.filter(k => k != selection);
          else if(shift){  // 按shift进入默认的多选模式
            if(choices.value.includes(selection))  // 多选取消
              choices.value = choices.value.filter(k => k != selection);
            else choices.value.push(selection);  // 多选选择
          }
          else{
            choices.value = [selection];
          }  // 单选
          if(dt < 300) BUS.emit("moveTo", selection);  // 双击拉近
          lastChoice = selection;
          t0 = time;
        },
        onKeydown(k){
          if(k.code == "Delete") {this.deleteChoices();}
          else if(k.code == "ShiftLeft") shift = true;
        },
        search(){  // 搜索栏内容改变时
          if(searchValue.value){
            let result = [];
            for(let DT of DTObjects){
              if(DT.title.indexOf(searchValue.value) > -1) {
                let DT0 = JSON.parse(JSON.stringify(DT));
                DT0.children = [];  // 清除搜索项的父子关系
                result.push(DT0)
              };
            }
            TREEs.value = result;
          }
        },
        update(){  // 更新层级树的连接线和内容
          BUS.emit("updateTree");   
        }
      },
      mounted(){
        window.addEventListener('click', (k)=>{
          //this.deselect();
        });  
        window.addEventListener('keydown', (k)=>{
          
        });  
        window.addEventListener('keyup', (k)=>{
          if(k.code == "ShiftLeft") shift = false;
        });  
      },
      setup() {
        function onExpand(k){
          expanded.value = k;
        };
        watch(choices, (choices)=>{  // 根据选项变化来确定被选物体，并展示或隐藏物体边框
          emitProperty();
          for(let DT of BUS.getDTScene().getDTObjects()){
            if(DT.wireframe) DT.wireframe.visible = choices.includes(DT.id);
          };
        });
        watch(TREE, ()=>{BUS.emit('updateSearch');});
        return {choices, onExpand, searchValue};
      },
    });
</script>
<template>
  <!--搜索栏-->
  <a-input-search v-model:value="searchValue" placeholder="搜索"
    style="margin-bottom: 8px" @change="search()" @search="()=>{searchValue = ''}">
      <template #enterButton>
        <a-button :disabled="!searchValue" type="primary"><CloseOutlined/></a-button>
      </template>
  </a-input-search>
  <a-dropdown :trigger="['contextmenu']">
    <div tabindex="0" @click="choices=[]" @keydown = "onKeydown" style="outline: none">
      <!--层级树-->
      <a-tree v-if="!searchValue" @click.stop draggable multiple selectable
      v-model:expandedKeys = "expanded"
      :selectedKeys = "choices" 
      style="margin-left: 10px"
      :tree-data="TREE" 
      @dragstart="dragFrom" @drop="dragTo" @expand="update" @select="onClick">
        <!--重写展开和折叠标志-->
        <template #switcherIcon="DT">
          <MinusSquareOutlined v-if="DT.expanded"/>
          <PlusSquareOutlined v-else/>
        </template>
        <!--各个结点-->
        <template #title="DT">
          <span :style="DT.children.length ? {} : {'margin-left': '-24px'}">
            <BorderlessTableOutlined v-if="DT.type=='GridHelper'"/>
            <BulbOutlined v-if="DT.mesh.isLight"/>
            <CodepenOutlined v-if="DT.mesh.isMesh"/>
            <DragOutlined v-if="DT.type=='AxesHelper'"/>
            <DropboxOutlined v-if="DT.mesh.isGroup || DT.mesh.isScene"/>
            {{ DT.title }}
            <!--横向连接线-->
            <div v-if="DT.title!='Scene'" style="
              background-color: lightgrey;
              position: absolute; 
              top: 11px; 
              left: -37px; 
              width: 12px;
              height: 2px;
            "/>
            <!--纵向连接线-->
            <div v-if="DT.row" style="
              background-color: lightgrey;
              position: absolute; 
              top: 28px; 
              left: -13px; 
              width: 2px;
            " :style="{'height': 12+(DT.row-1)*28+'px'}"/>
          </span>
        </template> 
      </a-tree>  
      <!--搜索树-->
      <a-tree v-else :tree-data="TREEs" multiple @select="onClick" :selectedKeys = "choices">
        <template #title="DT">
          <span>
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
        <a-menu-item key="全部展开">全部展开</a-menu-item>
        <a-menu-item key="全部折叠">全部折叠</a-menu-item>
        <a-menu-item key="删除">删除</a-menu-item>
      </a-menu>
    </template>
  </a-dropdown> 
</template>
