<script lang="ts">
    import { defineComponent, ref } from 'vue'
    import Assets from './Assets.vue'
    import Canvas from './ThreeScene/Canvas.vue'
    import Console from './Console.vue'
    import Menu from './Menu.vue'
    import Models from './Models.vue'
    import Properties from './Properties.vue'
    import Demo from './Demo.vue'
    import Tree from './Tree.vue'
    export default defineComponent({
        components:{Assets, Canvas, Console, Menu, Models, Properties, Tree},
        methods:{
        },
        props:{modules:[], tabs:[]}, 
        setup(props) {
            const modules = ref(props.modules);
            const tabs = ref(props.tabs);
            const activeTab = ref(tabs.value[0]);
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
                if (tabs.value.length && activeTab.value === targetKey) {
                    if (lastIndex >= 0) {
                        activeTab.value = tabs.value[lastIndex].key;
                    } else {
                        activeTab.value = tabs.value[0].key;
                    }
                }
            };
            return {
                activeTab, 
                callback, 
                modules, 
                onEdit, 
                tabs,
            };
        },
    });
</script>
  
<template>
    <a-tabs v-model:activeKey="activeTab" :hideAdd="true" type="editable-card" @edit="onEdit"
    style = "border:3px solid black; border-radius: 10px; flex-grow: 1; "
    :style="{'overflowY': activeTab == '场景' ? 'hidden' : 'scroll'}">
        <a-tab-pane v-for="tab in tabs" :key="tab" :tab="tab" :closable="false" 
        style="height:100%; margin-top:-12px; text-align:left">
            <Models v-if="tab=='模型库'"/>
            <Tree v-if="tab=='层级'"/>
            <Canvas v-if="tab=='场景'"/>
            <div v-if="tab=='演示场景'" style="display:block">  
                <Demo style="border:1px solid black"/>
            </div>  
            <Assets v-if="tab=='组件库'"/>
            <Console v-if="tab=='控制台'"/>  
            <Properties v-if="tab=='属性'"/>
        </a-tab-pane>
    </a-tabs>

</template>