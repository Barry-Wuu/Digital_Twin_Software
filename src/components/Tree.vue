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
    import { Tree } from "ant-design-vue";
    import { titleProps } from "ant-design-vue/es/typography/Title";
    import { defineComponent, ref, watch } from 'vue';

    var choices = ref([]);  // 已选项，内为各个被选中模型的ID
    var clipboard;  //  剪贴板，即被复制的选项
    var lastClick;
    var SCENE;
    const searchValue = ref('');
    var t0 = -999;
    var TREE = ref([]);
    
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
        BUS.on('clickModel', (model)=>{
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
        BUS.on('updateTree', (data)=>{
          TREE.value = this.expand(data);
          SCENE = TREE.value[0].item;
        });
        return {TREE, TREEs: []};
      },
      methods: {},
      setup() {
        function expand(obj){
          if(!obj)return [];
          let tree = [{
              item: obj,
              key: obj.id,
              name: obj.name,
              title: this.title(obj),
              type: obj.type,
              children: obj.children ? obj.children.filter(child=>{
                return !child.type.includes("Helper")
              }).map(child => this.expand(child)[0]) : []
          }]
          return tree;
        };
        function onClick(_, Selection){  // keys是模型对应ID的数组，Selection是选中的模型的数组
          let time = new Date().getTime();
          let dt = time - t0;
          if(dt < 300){  // 双击拉近
            BUS.emit('moveTo', Selection.node.item);
            if(!choices.value.includes(Selection.node.key)) choices.value.push(Selection.node.key);
          }else{  // 单击
          }
          t0 = time;
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
        function search(tree){
          let result = traverse(tree);
          result = result.filter(obj => title(obj).indexOf(searchValue.value) > -1);
          result = result.map(obj => {  // 让搜索树不可被展开
            let noChildren = Object.assign({}, obj);
            noChildren.children = null;
            return noChildren;
          });
          this.TREEs = ref(result);
        };
        function test(e){console.log(e)};
        function title(obj){
          return obj.type + (obj.name ? ": " + obj.name : '');
        };
        function traverse(tree){  // 返回包含场景里的所有物体的数组
          let result = []
          for(let item of tree){
            result.push(item);
            if(item.children){
              result = result.concat(traverse(item.children))
            }     
          }
          return result;
        };
        watch(choices, (x)=>{  // 根据选项变化来确定被选物体，并展示或隐藏物体边框
          BUS.emit("chooseModel", x[0] ? SCENE.getObjectById(x[0]) : {});
          SCENE.traverse((obj)=>{
            if("wireframe" in obj){obj.wireframe.visible = x.includes(obj.id);}
          });
        }, {deep: true});
        watch(TREE, ()=>{BUS.emit('updateSearch');});
        return {choices, expand, onRightClick, onClick, search, searchValue, test, title, traverse};
      },
    });
</script>
<template>
    <a-input-search v-model:value="searchValue" placeholder="搜索" 
    style="margin-bottom: 8px" @change="search(TREE)"/>
    <br/>
    <a-tree v-if="!searchValue" :tree-data="TREE" multiple show-line @select="onClick" 
    v-model:selectedKeys = "choices"><!--层级树-->
      <template #title="obj">
        <a-dropdown :trigger="['contextmenu']">
          <span v-if="obj.type != 'BoxHelper'">
            <DragOutlined v-if="obj.type=='AxesHelper'"/>
            <BorderlessTableOutlined v-if="obj.type=='GridHelper'"/>
            <BulbOutlined v-if="obj.type && obj.type.includes('Light')"/>
            <CodepenOutlined v-if="obj.type=='Mesh'"/>
            <DropboxOutlined v-if="obj.type=='Scene'"/>
            <span>&nbsp;{{ title(obj) }}</span>
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
    <a-tree v-if="searchValue" :tree-data="TREEs" multiple @select="onClick" 
    v-model:selectedKeys = "choices"><!--搜索树-->
      <template #title="obj">
        <a-dropdown :trigger="['contextmenu']">
          <span v-if="obj.type != 'BoxHelper' && 
                      obj.mesh.geometry.type != 'ShapeGeometry'
                      && title(obj).indexOf(searchValue) > -1">
            <DragOutlined v-if="obj.type=='AxesHelper'"/>
            <BorderlessTableOutlined v-if="obj.type=='GridHelper'"/>
            <BulbOutlined v-if="obj.type && obj.type.includes('Light')"/>
            <CodepenOutlined v-if="obj.type=='Mesh'"/>
            <DropboxOutlined v-if="obj.type=='Scene'"/>
            <span>&nbsp;{{ title(obj).substring(0, title(obj).indexOf(searchValue)) }}</span>
            <span style="color: red"><strong>{{ searchValue }}</strong></span>
            <span>{{ title(obj).substring(title(obj).indexOf(searchValue) + searchValue.length) }}</span>
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
