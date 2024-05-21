<script lang="ts">
  import { ref } from "vue";
  import {
    CloseOutlined,  // 清除图标
  } from "@ant-design/icons-vue";
  import global from "../Global"
  // JSON格式的模型列表，模型路径为src/assets/models，图标路径为src/assets/icons
  var models = ref([
    {title: "传送带", children: [
      {title: "直道", model: "传送带-直道.stl", icon: "直道.jpg"},
      {title: "顺时针弯道", model: "传送带-弯道.stl", icon: "弯道1.jpg"},
      {title: "逆时针弯道", model: "传送带-弯道.stl", icon: "弯道2.jpg"},
      {title: "护栏", model: "", icon: "护栏.jpg"},
      {title: "传感器", model: "", icon: "传感器.jpg"},
    ]},
    {title: "货物", children: [
      {title: "发生器", model: "", icon: "发生器.jpg"},
      {title: "货物", model: "", icon: "货物.jpg"},
      {title: "回收器", model: "", icon: "回收器.jpg"},
    ]},
    {title: "基本几何体", children: [
      {title: "正方体", model: "", icon: "cube.jpg"},
      {title: "球", model: "", icon: "sphere.jpg"},
      {title: "锥体", model: "", icon: "cone.jpg"},
      {title: "圆柱", model: "", icon: "cylinder.jpg"},
    ]},
    {title:"其它", children: [
      {title: "弯道（凸集）", model: "传送带-弯道.stl", icon: "弯道1.jpg"},
    ]},
  ])
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
          activeKeys.value = Object.keys(models.value);
        }
        else if(option == "全部折叠"){
          activeKeys.value = [];
        }
      },
      search(){  // 搜索栏内容改变时
        if(searchValue.value){
          let result = [];
          for(let group of models.value){
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
    setup() {return {activeKeys, models, searchValue, searchResult}},
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
  <a-dropdown :trigger="['contextmenu']">
    <div>
      <!--模型列表-->
      <a-collapse v-if="!searchValue" v-model:activeKey="activeKeys" 
      id="collapse" style="user-select: none">
        <a-collapse-panel v-for="group of models" 
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
        <a-card v-for="item of searchResult" class="model-card" draggable="true" hoverable 
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
