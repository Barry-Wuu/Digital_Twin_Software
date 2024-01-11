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
    import { defineComponent, ref } from 'vue';

    const searchValue = ref<string>('');
    const TREE = ref({})
    BUS.on('updateModel', (data)=>{TREE.value = [data]})

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
        return {TREE:[]}
      },
      methods: {
        expand(node){
          if(!node || !node.length)return;
          let tree = []
          for(let item of node){
            tree.push({
              key: item.id,
              item: item,
              type: item.type,
              children: this.expand(item.children)
            })
          }
          return tree
        },
      },
      setup() {
        function onSelect(selectedKeys, info){
          BUS.emit("chooseModel", info.selectedNodes[0].model);
        };
        return {onSelect, searchValue, TREE};
      },
    });
</script>
<template>
    <a-input-search v-model:value="searchValue" enter-button placeholder="搜索" style="margin-bottom: 8px" />
    <br/>
    <a-tree :tree-data="expand(TREE)" @select="onSelect" show-line>
      <template #title="type">
        <DragOutlined v-if="type.type=='AxesHelper'"/>
        <BorderlessTableOutlined v-if="type.type=='GridHelper'"/>
        <BulbOutlined v-if="type.type.includes('Light')"/>
        <CodepenOutlined v-if="type.type=='Mesh'"/>
        <DropboxOutlined v-if="type.type=='Scene'"/>
        <span v-if="type.type.indexOf(searchValue) > -1">
          {{ type.type.substr(0, type.type.indexOf(searchValue)) }}
          <span style="color: #f50">{{ searchValue }}</span>
          {{ type.type.substr(type.type.indexOf(searchValue) + searchValue.length) }}
        </span>
        <span v-else>{{ type.type }}</span>
        {{ item }}
      </template> 
    </a-tree>  
</template>
