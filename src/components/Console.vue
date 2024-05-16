<script lang="ts">
    import { defineComponent, ref } from 'vue'
    import global from "../Global"
    import * as THREE from 'three';  // 导入库以便在控制台中执行相应命令
    var Console = document.createElement("div");
    var command = ref('')

    // 下列未使用函数为控制台专用指令
    function DT(){
      let DT = global.DTScene();
      console.log(DT)
      return DT;
    };
    function print(s){global.emit("print", s)};

    function pad(x, n=2) {return x.toString().padStart(n, '0')}
    global.on("print", (data)=>{
      Console.innerHTML += "<br>";
      let time = new Date();
      Console.innerHTML += time.getFullYear() + '/' 
        + pad(time.getMonth() + 1) + '/'
        + pad(time.getDate()) + ' '
        + time.toTimeString().split(' ')[0] + '.'
        + pad(time.getMilliseconds(), 3) + ' —— ';
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
        global.emit("print", "程序启动")
      }
    }
</script>
  
<style>
  .console{border-top: 1px solid grey; margin:10px; text-align:left}
</style>

<template>
  <a-input-search v-model:value="command" placeholder="指令" 
  style="padding-top: 6px; padding-left: 15px; padding-right: 15px"
  @search="(command)=>{run(command)}">
    <template #enterButton>
      <a-button type="primary">运行</a-button>
    </template>
  </a-input-search>
  <div id="console" class="console">
    <strong>输出：</strong>
  </div>
</template> ./Global./Global../Global