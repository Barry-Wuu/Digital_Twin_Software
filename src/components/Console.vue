<script lang="ts">
    import { defineComponent, ref } from 'vue'
    import BUS from "./EventBus"
    import * as THREE from 'three';  // 导入库以便在控制台中执行相应命令
    var Console;
    var command = ref('')
    var DTScene;

    function pad(x){return x.toString().padStart(2, '0')};
    function print(s){BUS.emit("print", s)};
    BUS.on("print", (data)=>{
      Console.innerHTML += "<br>";
      let date = new Date();
      Console.innerHTML += date.getFullYear() + '/' 
        + pad(date.getMonth() + 1) + '/'
        + pad(date.getDate()) + ' '
        + pad(date.getHours()) + ':'
        + pad(date.getMinutes()) + ':'
        + pad(date.getSeconds()) + '.'
        + String(date.getMilliseconds()).slice(0, 2) + ' —— ';
      Console.innerHTML += data;
    });
    export default{
      methods:{
        run(str){
          eval(str);  
          command.value = '';
        }
      },
      setup(){
        return {command}
      },
      mounted(){
        Console = document.getElementById("console");
        BUS.emit("print", "程序启动")
        DTScene = window.DTScene;
      }
    }
</script>
  
<template>
  <a-input-search v-model:value="command" placeholder="指令" @search="(command)=>{run(command)}">
    <template #enterButton>
      <a-button type="primary">运行</a-button>
    </template>
  </a-input-search>
  <div id="console" style="border-top: 1px solid grey; margin:10px; text-align:left">
    <strong>输出：</strong>
  </div>
</template> 