<script lang="ts">
    import BUS from "./EventBus"
    import { defineComponent, ref} from 'vue';
    import { DownOutlined } from '@ant-design/icons-vue';
    var marks = {0:'1x', 25: '2x', 50: '4x', 75: '8x', 100:'10x'};
    var menu = {
        "文件": [
            "新建",
            "导入",
            "导出",
            "——",
            "设置",
            "——",
            "退出"
        ],
        "编辑": [
            "撤销",
            "恢复"
        ],
        "视图": [
            "视图A",
            "视图B"
        ],
    }
    var speed = ref<number>(0);
    export default defineComponent({
        components: {
            BUS, DownOutlined,
        },
        setup() {
            const current = ref<any>(['mail']);
            return {
                change: (x)=>{
                    if(x.key) x=x.key;
                    speed.value = x;
                    BUS.emit("changeSpeed", marks[speed.value])
                },
                current, marks, menu, speed
            };
        },
  });
</script>
<style>
    .bottom {margin-bottom:10px;}
    .top {margin-top:10px;}
</style>
<template>
    <a-menu v-model:selectedKeys="current" mode="horizontal">
      <a-sub-menu v-for="(option, tab) in menu">
        <template #title >{{tab}}</template>
        <li v-for="(value, index) in option" >  
            <a-menu-item v-if="value!='——'">{{value}}</a-menu-item>  
            <div style="border:solid lightgrey 1px; height:0px" v-else/>  
        </li>  
      </a-sub-menu>
    </a-menu>
    <span>
        <div style="align-items:center; border:1px solid black; display:block; 
        width:400px" class="bottom">
            <span style="align-items:center; display:flex; height: 30px; 
            justify-content:space-evenly;" class="bottom">
                <div id="speed" class="top"> 速度：{{ marks[speed] }} </div>
                <div style="border:1px solid grey; display:flex; height: 40px" class="top"/>
                <a-slider @change="change" :marks="marks" step=25 :tooltipVisible="false" 
                    :value="speed" style="width: 200px; margin-bottom: 10px"/>
                <div style="border:1px solid grey; display:flex; height: 40px" class="top"/>    
                <a-dropdown>
                    <a class="ant-dropdown-link top" @click.prevent>
                        更改速度<down-outlined />
                    </a>
                    <template #overlay>
                        <a-menu @click="change">
                            <a-menu-item key="0">原速</a-menu-item>
                            <a-menu-item key="25">2x</a-menu-item>
                            <a-menu-item key="50">4x</a-menu-item>
                            <a-menu-item key="75">8x</a-menu-item>
                            <a-menu-item key="100">10x</a-menu-item>
                        </a-menu>
                    </template>
                </a-dropdown>
            </span>
            <div style="border:1px solid black; width:100%"/>
            动画
        </div>
    </span>
</template>
  