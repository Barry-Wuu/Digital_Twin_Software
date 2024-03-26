<script lang="ts" setup>
  import { ref } from 'vue'
  import { 
    CodeOutlined,
    FileTwoTone,
    FolderOpenTwoTone,
    GiftTwoTone,
    PictureTwoTone
  } from '@ant-design/icons-vue'
  import BUS from "./EventBus"
  import DTScene from './ThreeScene/DTScene';
  import * as THREE from 'three';

  const assets = ref([
    { id: 0, name: "文件夹", type: "folder"},
    { id: 1, content:{
      color: "white", opacity: 1
    }, name: "材质", type: "material"},
    { id: 2, name: "脚本", type: "code"},
    { id: 3, name: "模型", type: "model"},
    { id: 4, name: "模型", type: "model"},
    { id: 5, name: "模型", type: "model"},
    { id: 6, name: "模型", type: "model"},
    { id: 7, name: "模型", type: "model"},
  ])
  var DT;

  function chooseAsset(asset) {
    if(asset.type == "material"){
      let mesh = new THREE.Mesh(
        new THREE.BoxGeometry(), 
        new THREE.MeshPhongMaterial(asset.content)
      );
      let DT = new DTScene.DTObject(mesh, inScene=false);
      window.asset = DT;
      BUS.emit("showProperty", "asset");
    }
  }
</script>

<template>
  <div style="margin-left: 1em">
    <a-breadcrumb>
      <a-breadcrumb-item>场景</a-breadcrumb-item>
      <a-breadcrumb-item>路径1</a-breadcrumb-item>
    </a-breadcrumb>
  </div>
  <div id='files' style="display: flex; flex-wrap: wrap;">
    <a-card v-for="asset in assets" hoverable style="
      height: 100px;
      margin: 3px;
      margin-left: 10px;
    " @click="()=>{chooseAsset(asset)}">
      <div style="margin-top: -6px">
        <FolderOpenTwoTone v-if="asset.type == 'folder'" 
        twoToneColor="olive" style="fontSize:50px;"/>
        <CodeOutlined v-else-if="asset.type == 'code'" 
        twoToneColor="black" style="fontSize:50px;"/>   
        <PictureTwoTone v-else-if="asset.type == 'material'"
        twoToneColor="grey" style="fontSize:50px;"/>    
        <GiftTwoTone v-else-if="asset.type == 'model'"
        twoToneColor="grey" style="fontSize:50px;"/>
        <FileTwoTone v-else style="fontSize:50px;"/>
        <div style="padding-bottom: 1px; text-align: center;">{{ asset.name }}</div>
      </div>
    </a-card>
  </div>
</template>