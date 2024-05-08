<script lang="ts">
  import { ref } from "vue";
  import {
    CloseOutlined,  // 清除图标
  } from "@ant-design/icons-vue";
  import global from "./Global"
  var models = ref({
    "传送带": [
      ["直道","直道.jpg"],
      ["弯道（圆环）","弯道.jpg"],
      ["弯道（凸集）","弯道.jpg"],
      ["护栏","护栏.jpg"],
      ["传感器","传感器.jpg"],
    ],
    "货物": [
      ["发生器","发生器.jpg"],
      ["货物","货物.jpg"],
      ["回收器","回收器.jpg"],
      ["模型","cube.jpg"],
    ],
    "基本几何体":[
      ["正方体","cube.jpg"],
      ["球","sphere.jpg"],
      ["锥体","cone.jpg"],
      ["圆柱","cylinder.jpg"],
    ],
  })
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
        let result;
        function findImg(DOM){
          for(let child of DOM.children){
            if(child.localName == "img") {result = child; return;}
            findImg(child);
          }
        }
        findImg(e.srcElement);
        e.dataTransfer.setDragImage(document.createElement("img"), 0, 0); 
        //e.dataTransfer.setDragImage(result, 0, 0);
        global.emit("dragModelStart", {type: "model", data: data});
      },
      onRightClick(e){
        let option = e.key;
        if(option == "全部展开"){
          activeKeys.value = Object.keys(models.value);
        }
        else if(option == "全部折叠"){
          activeKeys.value = [];
        }
      },
      search(){  // 搜索栏内容改变时
        if(searchValue.value){
          let result = [];
          for(let items in models.value){
            for(let item of models.value[items]){
              if(item[0].indexOf(searchValue.value) > -1) {
                result.push([items].concat(item));
              }
            }
          }
          searchResult.value = result;
        }
      }
    },
    setup() {return {activeKeys, models, searchValue, searchResult}},
    mounted(){
      for(let items in models.value){
        for(let item of models.value[items]){
          item[1] = "../assets/icons/" + item[1];
        }
      }
    }
  }
</script>

<style>
  .img {  
    display:flex; 
    width:100%; 
    height:100%; 
    object-fit: contain;
  }  
  .title {
    display:flex; margin-top: -36px; margin-left: 45px;
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
  <a-dropdown :trigger="['contextmenu']">
    <div>
      <!--模型列表-->
      <a-collapse v-if="!searchValue" v-model:activeKey="activeKeys" 
      id="collapse" style="user-select: none">
        <a-collapse-panel v-for="(items, key) in models" 
        :header="key" :key="key" style="text-align: left;">
          <a-card v-for="item in items" :draggable="true" hoverable 
          @dragstart="(e)=>transfer(e, {modeltype:key, modelname:item[0]})" 
          style="display:flex; width:100%; height:50px; text-align: center;">
            <div style="
              border-right: 1px solid lightgrey; 
              width:50px; 
              height:48px;
              margin-top: -25px;
              margin-left: -20px;
              padding-right: 4px;
            ">
              <img :src="getIMG(item[1])" class="img" draggable="false"/>
            </div>
            <div class="title">{{item[0]}}</div>
          </a-card>
        </a-collapse-panel>
      </a-collapse>
      <!--搜索列表-->
      <div v-else>
        <a-card v-for="item of searchResult" hoverable draggable="true" 
        @dragstart="(e)=>transfer(e, {modeltype:item[0], modelname:item[1]})" 
        style="display:flex; width:100%; height:50px; text-align: center;">
          <div style="
            border-right: 1px solid lightgrey; 
            width:50px; 
            height:48px;
            margin-top: -25px;
            margin-left: -20px;
            padding-right: 4px;
          ">
            <img :src="getIMG(item[2])" class="img" draggable="false"/>
          </div>
          <div class="title">
            <span>{{ item[1].substring(0, item[1].indexOf(searchValue)) }}</span>
            <span style="color: red"><strong>{{ searchValue }}</strong></span>
            <span>{{ item[1].substring(item[1].indexOf(searchValue) + searchValue.length) }}</span>
          </div>
        </a-card>
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
./Global./Global