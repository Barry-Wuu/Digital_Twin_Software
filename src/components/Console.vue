<script lang="ts">
    import { defineComponent, ref } from 'vue'
    import BUS from "./EventBus"

    var Console;
    function pad(x){return x.toString().padStart(2, '0')}
    BUS.on("print", (data)=>{
      let date = new Date();
      Console.innerHTML += date.getFullYear() + '/' 
        + pad(date.getMonth() + 1) + '/'
        + pad(date.getDate()) + ' '
        + pad(date.getHours()) + ':'
        + pad(date.getMinutes()) + ':'
        + pad(date.getSeconds()) + ' —— ';
      Console.innerHTML += data;
      Console.innerHTML += "<br>";
    });
    export default{
      setup(){
        return {}
      },
      mounted(){
        Console = document.getElementById("console");
        BUS.emit("print", "程序启动")
      }
    }
</script>
  
<template>
    <div id="console" style="max-height: 50%; overflow-y: scroll; text-align:left"/>
</template> 