<script lang="ts">
    import BUS from "./EventBus"
    import {
        BorderlessTableOutlined,  // 网格图标
        BulbOutlined,  // 灯光图标
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
    var SCENE;
    var shift = false;  // 是否按下Shift键
    const searchValue = ref('');
    var t0 = -999;
    var TREE = ref([]);
    var TREEs = ref([]);
    
    export default defineComponent({
      components: {
        BorderlessTableOutlined,
        BulbOutlined,
        CodepenOutlined,
        DragOutlined,
        DropboxOutlined,
        CarryOutOutlined,
        FormOutlined,
      },
      data(){
        BUS.on('clickModel', (model: any)=>{
          if(!choices.value.includes(model.id)){  // 直接在场景中点选模型
            choices.value.push(model.id);
          }
          else  // 再次点击模型则取消选择
            choices.value = choices.value.filter(x => x!=model.id);
        });
        BUS.on("deleteChoices", ()=>{
          for(let id of choices.value)  // 删除项不在选项中，则只删除“删除项”
            SCENE.getObjectById(id).removeFromParent();
          choices.value = [];
        });  // 删除所选模型
        BUS.on('deselect', ()=>{choices.value = []});  // 点别处取消点选模型
        BUS.on('updateSearch', ()=>{this.search(TREE.value)});
        BUS.on('updateTree', ()=>{
          let DTScene = window.DTScene;
          DTObjects = DTScene.getDTObjects().value;         
          TREE.value = [DTScene];
        });
        return {TREE, TREEs};
      },
      methods: {},
      mounted(){
        window.addEventListener('keydown', (e)=>{
          if(e.code == "ShiftLeft") shift = true;
        });  
        window.addEventListener('keyup', (e)=>{
          if(e.code == "ShiftLeft") shift = false;
        });  
      },
      setup() {
        function onClick(_, Selection){  // keys是模型对应ID的数组，Selection是选中的模型的数组
          let selection = Selection.node.key;
          let time = new Date().getTime();
          let dt = time - t0;
          if(choices.value.length > 0 && selection == lastChoice)
            choices.value = choices.value.filter(k => k != selection);
          else if(shift)  // 按shift进入默认的多选模式
            choices.value.push(selection);
          else // 否则单选
            choices.value = [selection]; 
          if(dt < 300){  // 双击拉近
            BUS.emit('moveTo', selection);
          }
          lastChoice = selection;
          t0 = time;
        };
        function onExpand(k){
          expanded = k;
        };
        const onRightClick = (option, obj) => {  // 右键菜单
          if(option == '克隆'){
            if(!choices.value.includes(obj.id)) choices.value = [obj.id]
            let temp = []
            for(let id of choices.value){
              let obj = SCENE.getObjectById(id);
              let clone = obj.clone();
              clone.wireframe = clone.children.filter(x=>x.type="BoxHelper")[0];
              obj.parent.add(clone);
              temp.push(clone.id);
            }
            for(let id of temp)choices.value.push(id);
          }
          if(option == '删除'){
            if(!choices.value.includes(obj.id)) choices.value = [obj.id]  // 删除项在选项中，则删除所有选项
            for(let id of choices.value)  // 删除项不在选项中，则只删除“删除项”
              SCENE.getObjectById(id).removeFromParent();
            choices.value = []
          }
        };
        function search(){  // 搜索栏内容改变时
          if(searchValue.value){
            let result = [];
            for(let obj of DTObjects){
              if(obj.title.indexOf(searchValue.value) > -1) result.push(obj);
            }
            TREEs.value = result;
          }
        };
        watch(choices, (x)=>{  // 根据选项变化来确定被选物体，并展示或隐藏物体边框
          if(choices.value.length == 1){
            //BUS.emit("chooseModel")
            //window.chosenModel = DTObjects.filter()
          };
          for(let obj of DTObjects){
            for(let child of obj.mesh.children){
              if(child.type == "BoxHelper"){
                child.visible = x.includes(obj.key);
              }
            };
          };
        });
        watch(TREE, ()=>{BUS.emit('updateSearch');});
        return {choices, onClick, onExpand, onRightClick, search, searchValue};
      },
    });
</script>
<template>
  <!--搜索栏-->
  <a-input-search v-model:value="searchValue" placeholder="搜索"
    style="margin-bottom: 8px" @change="search()"/>
  <br/>
  <!--层级树-->
  <a-tree v-if="!searchValue" :tree-data="TREE" multiple selectable :show-icon="false" 
      @expand = "(k)=>{console.log(k)}" @select="onClick" :selectedKeys = "choices">
    <template #title="obj">
      <a-dropdown :trigger="['contextmenu']">
        <span>
          <BorderlessTableOutlined v-if="obj.type=='GridHelper'"/>
          <BulbOutlined v-if="obj.type && obj.type.includes('Light')"/>
          <CodepenOutlined v-if="obj.type=='Mesh'"/>
          <DragOutlined v-if="obj.type=='AxesHelper'"/>
          <DropboxOutlined v-if="obj.type=='Scene'"/>
          {{ obj.title }}
        </span>
        <template #overlay>
          <a-menu @click="({ key: option }) => onRightClick(option, obj.item)">
            <a-menu-item key="克隆">克隆</a-menu-item>
            <a-menu-item key="复制">复制</a-menu-item>
            <a-menu-item key="粘贴">粘贴</a-menu-item>
            <a-menu-item key="删除">删除</a-menu-item>
          </a-menu>
        </template>
      </a-dropdown>
    </template> 
  </a-tree>  
  <!--搜索树-->
  <a-tree v-if="searchValue" :tree-data="TREEs" multiple @select="onClick" 
      :selectedKeys = "choices">
    <template #title="obj">
      <a-dropdown :trigger="['contextmenu']">
        <span>
          <DragOutlined v-if="obj.type=='AxesHelper'"/>
          <BorderlessTableOutlined v-if="obj.type=='GridHelper'"/>
          <BulbOutlined v-if="obj.type && obj.type.includes('Light')"/>
          <CodepenOutlined v-if="obj.type=='Mesh'"/>
          <DropboxOutlined v-if="obj.type=='Scene'"/>
          <span>&nbsp;{{ obj.title.substring(0, obj.title.indexOf(searchValue)) }}</span>
          <span style="color: red"><strong>{{ searchValue }}</strong></span>
          <span>{{ obj.title.substring(obj.title.indexOf(searchValue) + searchValue.length) }}</span>
        </span>
        <template #overlay>
          <a-menu @click="({ key: option }) => onRightClick(option, obj.item)">
            <a-menu-item key="克隆">克隆</a-menu-item>
            <a-menu-item key="复制">复制</a-menu-item>
            <a-menu-item key="粘贴">粘贴</a-menu-item>
            <a-menu-item key="删除">删除</a-menu-item>
          </a-menu>
        </template>
      </a-dropdown>
    </template> 
  </a-tree>  
</template>
