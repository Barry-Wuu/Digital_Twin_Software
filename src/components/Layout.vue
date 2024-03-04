<script lang="ts">
    import { defineComponent, ref } from 'vue'
    import Module from './Module.vue'
    export default defineComponent({
        components:{ Module },
        props:{item:Object, parent:String}, 
        setup(props) {
            const item = ref(props.item);
            const parent = ref(props.parent);
            return {item, parent}
        },
    });
</script>
  
<template>
    <!--根列布局模块-->
    <div v-if="item.info == 'root'" style="
        display: flex; 
        flex-direction: row;
        flex-grow: 1;
        overflow-x: hidden;
        overflow-y: hidden"
        :style="{'maxHeight': item.size + '%'}
    ">
        <Layout v-for="(i) in item.children" :item='i' parent="row"/>
    </div>
    <!--列布局模块-->
    <div v-else-if="item.info == 'col'"
        :style="{'width': item.size + '%',}
    ">
        <Layout v-for="(i) in item.children" :item='i' parent="col"/>
    </div>
    <!--行布局模块-->
    <div v-else-if="item.info == 'row'" style="
        
        flex-grow: 1;"
        :style="{'height': item.size + '%'}
    ">
        <Layout v-for="(i) in item.children" :item='i' parent="row"/>
    </div>
    <!--功能模块-->
    <div v-else style="
        border: 3px solid dodgerblue;
        display: flex;
        flex-direction: column;
        width:100%; 
        height: 100%;"
        :style="{'overflowY': item.info == '场景' ? 'hidden' : 'scroll'}"
    >
        <Module :tabs="item.info.split('+')"/>
    </div>
</template>