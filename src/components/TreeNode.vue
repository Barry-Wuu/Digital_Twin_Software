<script lang="ts">  
  import BUS from "./EventBus"
  import {
        BorderlessTableOutlined,  // 网格图标
        BulbOutlined,  // 灯光图标
        CodepenOutlined,  //模型图标
        DragOutlined,  // 坐标轴图标
        MenuOutlined,  // 根结点图标
  } from '@ant-design/icons-vue';
  import { defineComponent, ref} from 'vue'

  export default defineComponent({ 
    components: {
        BorderlessTableOutlined,
        BulbOutlined,
        CodepenOutlined,
        DragOutlined,
        MenuOutlined,
    }, 
    props:{TREE: []},
    setup(props){
      function onSelect(selectedKeys, info){
          let model = info.selectedNodes[0].model;
          BUS.emit("chooseModel", model);
      };
      var TREE = ref(props)
      return {  
        onSelect,
        TREE
      };  
    },  
    methods: {
      expand(node){
        if(!node.length)return;
        let tree = []
        for(let item of node){
          tree.push({
            title: item.type + (item.name? ': '+item.name : ''),
            key: item.id,
            model: item,
            type: item.type,
            children: this.expand(item.children)
          })
        }
        return tree
      },
      root() {  
        return [{
            title: "Scene",
            key: "Scene",
            type: "Scene",
            children: expand(TREE.TREE)
        }];
      }  
    }  
  });  
</script>

<template>  
  <a-tree :tree-data="expand(TREE.TREE)" 
  @select="onSelect"
  show-icon 
  :show-line="true">
    <template #icon="{type}">
      <template v-if="type=='AxesHelper'"><DragOutlined/></template>
      <template v-if="type=='GridHelper'"><BorderlessTableOutlined/></template>
      <template v-if="type.includes('Light')"><BulbOutlined/></template>
      <template v-if="type=='Mesh'"><CodepenOutlined/></template>
      <template v-if="type=='Scene'"><MenuOutlined/></template>
    </template>
  </a-tree>  
</template>  
  