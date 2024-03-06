<script lang="ts">
  import { ref } from 'vue';
  import {
    CloseOutlined,  // 清除图标
  } from '@ant-design/icons-vue';
  import BUS from "./EventBus"
  var models = {
    "传送带": [
      ["直道",'../assets/直道.jpg'],
      ["弯道",'../assets/弯道.jpg'],
      ["护栏",'../assets/护栏.jpg'],
      ["模型",'../assets/cube.jpg'],
    ],
    "货物": [
      ["发生器",'../assets/发生器.jpg'],
      ["货物",'../assets/货物.jpg'],
      ["回收器",'../assets/回收器.jpg'],
      ["模型",'../assets/cube.jpg'],
    ],
    "基本几何体":[
      ["正方体",'../assets/cube.jpg'],
      ["球",'../assets/sphere.jpg'],
      ["锥体",'../assets/pyramid.jpg'],
      ["圆柱",'../assets/cone.jpg'],
    ],
  }
  //let active0 = []
  //for(let i in Object.keys(models))active0.push(String(i))
  const activeKeys = ref([]);
  const searchResult = ref([]);
  const searchValue = ref("");

  export default {
    components: {
        CloseOutlined,
    },
    computed: {
      activeAll() {
        let x = [];
        for(let i in Object.keys(models)){x.push(String(i))};
        return x;
      }
    },
    methods:{
      getIMG(path){  // src为预览时的图片根目录，public/assets为打包后对应的图片根目录
        return new URL(`${path}`, import.meta.url).href
      },
      transfer(e, data) {
        e.dataTransfer.setDragImage(document.createElement("img"), 0, 0);
        e.dataTransfer.setData('modelName',data);
        BUS.emit("dragstart", {type:'modelName', data:data});
      },
      search(){  // 搜索栏内容改变时
        if(searchValue.value){
          let result = [];
          for(let items in models){
            for(let item of models[items]){
              if(item[0].indexOf(searchValue.value) > -1) {
                result.push([items].concat(item));
              }
            }
          }
          searchResult.value = result;
          console.log(searchResult.value)
        }
      }
    },
    setup() {return {activeKeys, models, searchValue, searchResult}},
    mounted(){}
  }
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
    <!--模型列表-->
    <div v-if="!searchValue">
      <a-collapse accordion v-model:activeKey="activeKeys" :default-active-key="activeAll" id="collapse">
        <a-collapse-panel v-for="(items, key, index) in models" 
        :header="key" :key="index" style="text-align: left;">
          <div style="flex-wrap: wrap;">
            <a-card v-for="item in items" hoverable draggable="true" 
            @dragstart="transfer($event, {modeltype:key, modelname:item[0]})" 
            style="display:flex; width:100%; height:50px; text-align: center;">
              <template #cover>
                <img :src="getIMG(item[1])" draggable="false" style="display:flex; width:100%; height:100%"/>
              </template>
              <p style="display:flex; margin-top: -10px;">{{item[0]}}</p>
            </a-card>
          </div>
        </a-collapse-panel>
      </a-collapse>
    </div>
    <!--搜索列表-->
    <div v-else>
      <a-card v-for="item of searchResult" hoverable draggable="true" 
      @dragstart="transfer($event, {modeltype:item[0], modelname:item[1]})" 
      style="display:flex; width:100%; height:50px; text-align: center;">
        <template #cover>
          <img :src="getIMG(item[2])" draggable="false" style="display:flex; width:100%; height:100%"/>
        </template>
        <div style="margin-top: -10px;">
          <span>{{ item[1].substring(0, item[1].indexOf(searchValue)) }}</span>
          <span style="color: red"><strong>{{ searchValue }}</strong></span>
          <span>{{ item[1].substring(item[1].indexOf(searchValue) + searchValue.length) }}</span>
        </div>
      </a-card>
    </div>
    <!--右键菜单-->
    <template #overlay>
      <a-menu @click="(x)=>{
        if(x.key == 'A'){
          let i;
          for(i in Object.keys(models)){
            if(!activeKeys.includes(String(i)))activeKeys.push(String(i))
          }
        }
        else{
          while(activeKeys.length)activeKeys.pop()
        }
      }">
        <a-menu-item key="A">全部展开</a-menu-item>
        <a-menu-item key="B">全部折叠</a-menu-item>
      </a-menu>
    </template>
  </a-dropdown>
</template>
