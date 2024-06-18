<script lang="ts">
  import { ref } from "vue";
  import {
    CloseOutlined,  // 清除图标
  } from "@ant-design/icons-vue";
  import modelData from "./Models/modelData.json";
  import global from "../Global"

  // JSON格式的模型列表，模型路径为src/assets/models，图标路径为src/assets/icons
  const activeKeys = ref([]);
  const model_layout = ref(modelData.model_layout);
  const searchResult = ref([]);
  const searchValue = ref("");

  export default {
    components: {
      CloseOutlined,
    },
    computed: {
      activeAll() {
        let x = [];
        for(let i in Object.keys(model_layout)){x.push(String(i))};
        return x;
      }
    },
    methods:{
      getIMG(item){  // src为预览时的图片根目录，public/assets为打包后对应的图片根目录
        return new URL(`${"../assets/icons/" + item.icon}`, import.meta.url).href
      },
      transfer(e, item, groupType=null) {
        e.dataTransfer.setDragImage(document.createElement("img"), 0, 0); 
        global.emit("dragModelStart", {type: "model", item: {
          group: groupType ? groupType : item.group, 
          modelname: item.title,
          modelpath: item.model,
        }});
      },
      onRightClick(e){
        let option = e.key;
        if(option == "全部展开"){
          activeKeys.value = Object.keys(model_layout.value);
        }
        else if(option == "全部折叠"){
          activeKeys.value = [];
        }
      },
      search(){  // 搜索栏内容改变时
        if(searchValue.value){
          let result = [];
          for(let group of model_layout.value){
            for(let item of group.children){
              if(item.title.indexOf(searchValue.value) > -1) {
                let newItem = Object.assign({group: ''}, item);
                newItem.group = group.title;
                result.push(newItem);
              }
            }
          }
          searchResult.value = result;
        }
      },
      searchText(item){  // 搜索匹配文字
        let text = searchValue.value;
        return [
          item.title.substring(0, item.title.indexOf(text)),
          text,
          item.title.substring(item.title.indexOf(text) + text.length),
        ];
      }
    },
    setup() {return {activeKeys, model_layout, searchValue, searchResult}},
    mounted(){}
  }
</script>

<style>
  .model-card {  
    display:flex; 
    text-align: center;
    width:100%; 
    height:50px; 
  }  
  .model-img {  
    display: flex; 
    width: 100%; 
    height: 100%; 
    object-fit: contain;
  }  
  .model-imgBorder {  
    border-right: 1px solid lightgrey; 
    width: 50px; 
    height: 48px;
    margin-top: -25px;
    margin-left: -20px;
    padding-right: 4px;
  } 
  .model-title {
    font-weight: bold;
    margin-top: -34px; 
    margin-left: 45px;
  }
</style>

<template>
  <!--搜索栏-->
  <a-input-search v-model:value="searchValue" placeholder="搜索"
    style="margin-bottom: 8px" @change="search()" @search="()=>{searchValue = ''}">
      <template #enterButton>
        <a-button :disabled="!searchValue" type="primary"><CloseOutlined/></a-button>
      </template>
  </a-input-search>
  <!--模型列表-->
  <a-dropdown :trigger="['contextmenu']">
    <div>
      <!--模型列表-->
      <a-collapse v-if="!searchValue" v-model:activeKey="activeKeys" 
      id="collapse" style="user-select: none">
        <a-collapse-panel v-for="group of model_layout" 
        :header="group.title" style="text-align: left;">
          <a-card v-for="item of group.children" class="model-card" draggable="true" hoverable 
          @dragstart="e=>transfer(e, item, group.title)">
            <div class="model-imgBorder">
              <img :src="getIMG(item)" class="model-img" draggable="false"/>
            </div>
            <div class="model-title">{{item.title}}</div>
          </a-card>
        </a-collapse-panel>
      </a-collapse>
      <!--搜索列表-->
      <div v-else>
        <a-card v-if="searchResult.length" v-for="item of searchResult" 
        class="model-card" draggable="true" hoverable 
        @dragstart="e=>transfer(e, item)">
          <div class="model-imgBorder">
            <img :src="getIMG(item)" class="model-img" draggable="false"/>
          </div>
          <div v-for="str of [searchText(item)]" class="model-title">
            <span>{{ str[0] }} </span>
            <span style="color: red; margin-left: 0px;"> {{ str[1] }} </span> 
            <span>{{ str[2] }} </span>
          </div>
        </a-card>
        <a-alert v-else message="无匹配结果" style="width:100%" type="error" />
      </div>
    </div>
    <!--右键菜单-->
    <template #overlay>
      <a-menu @click="onRightClick">
        <a-menu-item key="全部展开">全部展开</a-menu-item>
        <a-menu-item key="全部折叠">全部折叠</a-menu-item>
      </a-menu>
    </template>
  </a-dropdown>
</template>
