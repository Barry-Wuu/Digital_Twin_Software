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
              item: item,
              key: item.id,
              name: item.name,
              title: '1',
              type: item.type,
              children: this.expand(item.children)
            })
          }
          return tree
        },
      },
      setup() {
        function onSelect(selectedKeys, data){
          console.log(data)
          BUS.emit("chooseModel", data.selectedNodes[0].item);
        };
        return {onSelect, searchValue, TREE};
      },
    });
</script>
<template>
    <a-input-search v-model:value="searchValue" enter-button placeholder="搜索" style="margin-bottom: 8px" />
    <br/>
    <a-tree :tree-data="expand(TREE)" @select="onSelect" show-line>
      <template #title="item">
        <DragOutlined v-if="item.type=='AxesHelper'"/>
        <BorderlessTableOutlined v-if="item.type=='GridHelper'"/>
        <BulbOutlined v-if="item.type.includes('Light')"/>
        <CodepenOutlined v-if="item.type=='Mesh'"/>
        <DropboxOutlined v-if="item.type=='Scene'"/>
        <span v-if="item.type.indexOf(searchValue) > -1">
          {{ item.type.substr(0, item.type.indexOf(searchValue)) }}
          <span style="color: #f50">{{ searchValue }}</span>
          {{ item.type.substr(item.type.indexOf(searchValue) + searchValue.length) }}
        </span>
        <span v-else>{{ item.type }}</span>
        <span v-if="item.name">:&nbsp{{ item.name }}</span>
        {{ item.key }}
      </template> 
    </a-tree>  
</template>
