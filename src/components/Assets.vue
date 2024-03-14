<script lang="ts" setup>
  import { ref } from 'vue'
  import { 
    CodeOutlined,
    FileTwoTone,
    FolderOpenTwoTone,
    PictureTwoTone
  } from '@ant-design/icons-vue'
  import BUS from "./EventBus"
  import DTScene from './ThreeScene/DTScene';
  import * as THREE from 'three';

  const assets = ref([
    { id: 0, name: "文件1", type: "folder"},
    { id: 1, content:{
      color: "white", opacity: 1
    }, name: "材质", type: "material"},
    { id: 2, name: "文件3", type: "code"},
    { id: 3, name: "文件4", type: "file"},
    { id: 4, name: "文件5", type: "file"},
    { id: 5, name: "文件6", type: "file"},
    { id: 6, name: "文件7", type: "file"},
    { id: 7, name: "文件8", type: "file"},
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
        <FileTwoTone v-if="asset.type == 'file'" style="fontSize:50px;"/>
        <PictureTwoTone v-if="asset.type == 'material'" 
        style="fontSize:50px;" :style="{'opacity': asset.content.opacity}"/> 
        <div style="padding-bottom: 1px; text-align: center;">{{ asset.name }}</div>
      </div>
    </a-card>
  </div>
</template>