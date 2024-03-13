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
        FormOutlined 
    } from '@ant-design/icons-vue';
    import { contentQuotesLinter } from "ant-design-vue/es/_util/cssinjs/linters";
    import { titleProps } from "ant-design-vue/es/typography/Title";
    import { defineComponent, ref, watch } from 'vue';

    var choices = ref([]);  // 已选项，内为各个被选中模型的ID
    var clipboard;  //  剪贴板，即被复制的选项
    var DTObjects;
    var expanded;  // 展开的选项
    var lastChoice;  //  上一个选项
    var shift = false;  // 是否按下Shift键
    const searchValue = ref("");
    var t0 = -999;
    var TREE = ref([]);
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
      },
      data(){
        BUS.on("clickModel", (id_shift)=>{  // 点击屏幕中的物体
          id_shift = id_shift.split(',');
          let selection = JSON.parse(id_shift[0]);
          let shift = JSON.parse(id_shift[1]);
          if(shift){  // 按住shift为多选模式
            if(choices.value.includes(selection))  // 多选取消
              choices.value = choices.value.filter(k => k != selection);
            else choices.value = choices.value.concat([selection]);  // 多选选择
          }
          else{
            choices.value = [selection]; 
            console.log(window.DTScene.findDTObjectById(selection))
          }  // 单选
          BUS.emit(
            "BottomMessage", 
            choices.value.length>0 ? `选择${choices.value.length}个物体` : "无"
          );
        });
        BUS.on("deselect", ()=>{
          this.deselect();
          BUS.emit("BottomMessage", "无");
        });
        BUS.on("deleteChoices", ()=>{this.deleteChoices()});
        BUS.on("updateSearch", ()=>{this.search(TREE.value)});
        BUS.on("updateTree", ()=>{
          let DTScene = window.DTScene;
          DTObjects = DTScene.getDTObjects();         
          TREE.value = [DTScene];
        });
        return {TREE, TREEs};
      },
      methods: {
        deleteChoices(){
          for(let id of choices.value){
            let DTObject = window.DTScene.findDTObjectById(id);
            if(DTObject) DTObject.destroy();
          }
          BUS.emit("updateTree");
        },  // 删除所选模型
        deselect(){choices.value = []},  // 点别处取消点选模型
        onClick(_, Selection){  // 点击Tree中的项目
          let selection = Selection.node.key;
          let time = new Date().getTime();
          let dt = time - t0;
          if(choices.value.length == 1 && selection == lastChoice)  // 取消选择
            choices.value = choices.value.filter(k => k != selection);
          else if(shift){  // 按shift进入默认的多选模式
            if(choices.value.includes(selection))  // 多选取消
              choices.value = choices.value.filter(k => k != selection);
            else choices.value = choices.value.concat([selection]);  // 多选选择
          }
          else{
            choices.value = [selection];
            console.log(window.DTScene.findDTObjectById(selection))
          }  // 单选
          if(dt < 300) BUS.emit("moveTo", selection);  // 双击拉近
          lastChoice = selection;
          t0 = time;
        },
        onRightClick(option){  // 右键菜单
          var DT;
          if(option == '取消选择') choices.value = []; 
          if(option == '克隆'){
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
          if(option == '删除'){
            this.deleteChoices();
          }
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
          expanded = k;
        };
        watch(choices, (x)=>{  // 根据选项变化来确定被选物体，并展示或隐藏物体边框
          emitProperty();
          for(let DT of window.DTScene.getDTObjects()){
            for(let child of DT.mesh.children){
              if(child.type == "BoxHelper"){
                child.visible = x.includes(DT.id);
              }
            };
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
    <div tabindex="0" @keydown = "onKeydown" style="outline: none">
      <!--层级树-->
      <a-tree v-if="!searchValue" :tree-data="TREE" multiple selectable :show-icon="false"
          @expand = "(k)=>{console.log(k)}" 
          @select="onClick" :selectedKeys = "choices">
        <template #title="DT">
          <span>
            <BorderlessTableOutlined v-if="DT.type=='GridHelper'"/>
            <BulbOutlined v-if="DT.type && DT.type.includes('Light')"/>
            <CodepenOutlined v-if="DT.type=='Mesh'"/>
            <DragOutlined v-if="DT.type=='AxesHelper'"/>
            <DropboxOutlined v-if="DT.type=='Scene'"/>
            {{ DT.title }}
          </span>
        </template> 
      </a-tree>  
      <!--搜索树-->
      <a-tree v-else :tree-data="TREEs" multiple @select="onClick" 
          :selectedKeys = "choices">
        <template #title="DT">
          <a-dropdown :trigger="['contextmenu']">
            <span>
              <DragOutlined v-if="DT.type=='AxesHelper'"/>
              <BorderlessTableOutlined v-if="DT.type=='GridHelper'"/>
              <BulbOutlined v-if="DT.type && DT.type.includes('Light')"/>
              <CodepenOutlined v-if="DT.type=='Mesh'"/>
              <DropboxOutlined v-if="DT.type=='Scene'"/>
              <span>&nbsp;{{ DT.title.substring(0, DT.title.indexOf(searchValue)) }}</span>
              <span style="color: red"><strong>{{ searchValue }}</strong></span>
              <span>{{ DT.title.substring(DT.title.indexOf(searchValue) + searchValue.length) }}</span>
            </span>
          </a-dropdown>
        </template> 
      </a-tree> 
    </div>
    <!--右键菜单-->
    <template #overlay>
      <a-menu @click="({ key: option }) => onRightClick(option)">
        <a-menu-item key="取消选择">取消选择</a-menu-item>
        <a-menu-item key="克隆">克隆</a-menu-item>
        <a-menu-item key="复制">复制</a-menu-item>
        <a-menu-item key="粘贴">粘贴</a-menu-item>
        <a-menu-item key="删除">删除</a-menu-item>
      </a-menu>
    </template>
  </a-dropdown> 
</template>
