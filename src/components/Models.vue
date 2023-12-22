<script lang="ts" setup>
  import { defineComponent, onMounted, ref} from 'vue';
  import "ant-design-vue"
import { contentQuotesLinter } from 'ant-design-vue/es/_util/cssinjs/linters';
  const props = defineProps<{getIMG: Function}>()
  onMounted(()=>{
    redraw();
  })
</script>

<script lang="ts">
  var models = {
    "类别1":[
      ["模型1a",'electron.svg'],
      ["模型1b",'vite.svg'],
      ["模型1c",'vue.svg'],
      ["模型1d",'logo.svg'],
    ],
    "类别2": [
      ["模型2a",'electron.svg'],
      ["模型2b",'logo.svg'],
      ["模型2c",'vue.svg'],
      ["模型2d",'vite.svg'],
    ],
    "类别3": [
      ["模型3a",'vite.svg'],
      ["模型3b",'electron.svg'],
      ["模型3c",'logo.svg'],
      ["模型3d",'vue.svg'],
    ],
  }
  //let active0 = []
  //for(let i in Object.keys(models))active0.push(String(i))

  function redraw(){
  }
  export default {
    computed: {
      activeAll() {
        let x = [];
        for(let i in Object.keys(models)){x.push(String(i))};
        return x;
      }
    },
    setup() {
      var activeKeys = ref([])
      return {
        activeKeys,
        models,
      }
    }
  }

</script>

<template>
  <a-dropdown :trigger="['contextmenu']">
    <div id="main">
    <a-collapse v-model:activeKey="activeKeys" :default-active-key="activeAll" id="collapse">
      <a-collapse-panel v-for="(value, key, index) in models" :header="key" :key="index" style="text-align: left;">
        <div style = "display: flex; flex-wrap: wrap;">
          <a-card v-for="item in value" style="width:100px; height:120px">
              <img :src="getIMG(item[1])" style="width:100%; height:100%"/>
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
