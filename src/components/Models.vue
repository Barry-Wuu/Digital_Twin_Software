<script lang="ts" setup>
  import { defineComponent, onMounted, ref} from 'vue';
  import "ant-design-vue"
  import BUS from "./EventBus"
  const props = defineProps<{getIMG: Function}>()
  onMounted(()=>{
    redraw();
  })
</script>

<script lang="ts">
  var models = {
    "传送带": [
      ["直道",'../assets/electron.svg'],
      ["弯道",'../assets/logo.svg'],
      ["护栏",'../assets/vue.svg'],
      ["模型2d",'../assets/vite.svg'],
    ],
    "货物": [
      ["发生器",'../assets/vite.svg'],
      ["回收器",'../assets/electron.svg'],
      ["货物",'../assets/logo.svg'],
      ["模型3d",'../assets/vue.svg'],
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
  function redraw(){}

  export default {
    computed: {
      activeAll() {
        let x = [];
        for(let i in Object.keys(models)){x.push(String(i))};
        return x;
      }
    },
    methods:{
      transfer(e, data) {
        e.dataTransfer.setDragImage(document.createElement("img"), 0, 0);
        e.dataTransfer.setData('modelName',data);
        BUS.emit("dragstart", {type:'modelName', data:data});
      }
    },
    setup() {
      return {
        activeKeys,
        models,
      }
    },
    mounted(){
    }
  }
</script>

<template>
  <a-input-search
      v-model:value="value"
      placeholder="input search text"
      enter-button
      @search="onSearch"
  />
  <a-dropdown :trigger="['contextmenu']">
    <div id="main">
    <a-collapse v-model:activeKey="activeKeys" :default-active-key="activeAll" id="collapse">
      <a-collapse-panel v-for="(value, key, index) in models" :header="key" :key="index" style="text-align: left;">
        <div style = "display: flex; flex-wrap: wrap;">
          <a-card v-for="item in value" hoverable draggable="true" 
          @dragstart="transfer($event, {modeltype:key, modelname:item[0]})" 
           style="width:100px; height:120px; text-align: center;">
            <img :src="getIMG(item[1])" draggable="false" style="width:100%; height:100%"/>
            {{item[0]}}
          </a-card>
        </div>
      </a-collapse-panel>
    </a-collapse>
  </div>
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
