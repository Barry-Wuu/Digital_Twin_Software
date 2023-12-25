<script lang="ts">
    import { createVNode, defineComponent, ref, unref} from 'vue';
    import { DownOutlined } from '@ant-design/icons-vue';
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
    var speed = 1;
    var value = 0;
    export default defineComponent({
        components: {
            DownOutlined,
        },
        setup() {
            const current = ref<any>(['mail']);
            return {
                change: (x)=>{
                    speed = {0:1,25:2,50:4,75:8,100:10}[x];
                    document.getElementById("speed").textContent = `速度：${ speed }x`;
                },
                current,
                marks:{
                    0:  '1x',
                    25: '2x',
                    50: '4x',
                    75: '8x',
                    100:'10x',
                },
                menu,
                onClick: (x)=>{
                    speed = parseInt(x.key)
                    document.getElementById("speed").textContent = `速度：${ speed }x`;
                },
                speed,
                value: value
            };
        },
  });
</script>
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
    <div style="display:flex">
        <div id="speed">
            速度：{{ speed }}x
        </div>
        <div>
            <a-slider
                @change="change" 
                :marks="marks" step=25 
                :tooltipVisible="false" 
                v-model="value"
                style="width: 200px;"
            />
        </div>
        <a-dropdown>
            <a class="ant-dropdown-link" @click.prevent>
                更改速度<down-outlined />
            </a>
            <template #overlay>
                <a-menu @click="onClick">
                    <a-menu-item key="1">原速</a-menu-item>
                    <a-menu-item key="2">2x</a-menu-item>
                    <a-menu-item key="4">4x</a-menu-item>
                    <a-menu-item key="8">8x</a-menu-item>
                    <a-menu-item key="10">10x</a-menu-item>
                </a-menu>
            </template>
        </a-dropdown>
    </div>
</template>
  