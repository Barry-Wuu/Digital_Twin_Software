
<script lang="ts">
    import { defineComponent, ref } from 'vue'
    import Container from './Container.vue'
    
    import Menu from './Menu.vue'
    import Models from './Models.vue'
    import Properties from './Properties.vue'
    import Screen from './ThreeScene/Screen.vue'
    import Demo from './Demo.vue'
    import Tree from './Tree.vue'
    export default defineComponent({
        components:{Container, Menu, Models, Properties, Screen, Tree},
        props:{modules:[], row:Number, tabs:[]}, 
        setup(props) {
            const getIMG = path => {  // src为预览时的图片根目录，public/assets为打包后对应的图片根目录
                return new URL(`${path}`, import.meta.url).href
            };
            const modules = ref(props.modules);
            const row = ref(props.row);
            const tabs = ref(props.tabs);
            const activeKey = ref(tabs.value[0].key);
            const callback = (key: string) => {
            console.log(key);
            };
            const onEdit = (targetKey: string | MouseEvent, action: string) => {
                if (action === 'remove') {
                    remove(targetKey as string);
                }
            };
            const remove = (targetKey: string) => {
                let lastIndex = 0;
                tabs.value.forEach((tab, i) => {
                    if (tab.key === targetKey) {
                    lastIndex = i - 1;
                    }
                });
                tabs.value = tabs.value.filter(tab => tab.key !== targetKey);
                if (tabs.value.length && activeKey.value === targetKey) {
                    if (lastIndex >= 0) {
                    activeKey.value = tabs.value[lastIndex].key;
                    } else {
                    activeKey.value = tabs.value[0].key;
                    }
                }
            };
            return {
                activeKey, 
                callback, 
                getIMG, 
                H: () => window.innerHeight,  // H()为窗口高度
                modules, 
                onEdit, 
                row, 
                tabs,
                W: () => window.innerWidth,  // W()为窗口宽度
            };
        },
    });
</script>
  
<template>
    <div v-if="row==1" v-for="(item, i) in tabs" 
    style="display:inline-flex; height:100%; overflow:hidden;"
    :style="{'width': item[0] + '%',}"><!--行模块-->
        <div v-if="typeof item != 'string'" style="border:solid dodgerblue 1px">
            <Module :row="1-row" :tabs="item.slice(1)"/>
        </div>      
        <Module v-else :row="2" :tabs="item.split('+')"/>  
    </div>

    <div v-else-if="row==0" v-for="(item, i) in tabs" 
    style="display:block; width:100%; display:inline; overflow:hidden" 
    ><!--列模块-->
        <div v-if="typeof item != 'string'" style="
            border:solid grey 1px;
            display:flex;
            width:100%
        " 
        :style="{'height': item[0] + '%'}">
            <Module :row="1-row" :tabs="item.slice(1)"/>
        </div>
        <Module v-else :row="2" :tabs="item.split('+')"/>
    </div>

    <div v-else style="
        border:1px solid black; 
        display:flex;
        width: 100%;
        height: 100%;
        overflow: scroll scroll;
    "><!--模块-->
        <a-tabs v-model:activeKey="activeKey" :hideAdd="true" type="editable-card" @edit="onEdit">
            <a-tab-pane v-for="tab in tabs" :key="tab" :tab="tab" :closable="true">
                <div>
                    <div v-if="tab=='模型'" style="height:100%; ">
                        <div v-if="tab=='模型'" style="display:inline">
                        <Models :getIMG="getIMG"/>
                    </div>
                    </div>
                    <div v-if="tab=='层级'" style="display:block;">  
                        <Tree/>
                    </div>  
                    <div v-if="tab=='场景'" style="display:block">  
                        <Menu style="width:100%"/>  
                        <Screen style="border:1px solid black"/>
                    </div>  
                    <div v-if="tab=='演示场景'" style="display:block">  
                        <Demo style="border:1px solid black"/>
                    </div>  
                    <div v-if="tab=='资源'">  
                        <Container/>
                    </div> 
                    <p v-if="tab=='控制台'" id="log" style="text-align:left"/> 
                    <div v-if="tab=='属性'" style="display:flex">  
                        <Properties/>
                    </div>
                </div>  
            </a-tab-pane>
        </a-tabs>
    </div>
</template>