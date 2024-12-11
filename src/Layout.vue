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
  
<style>
    .showBorder{ border: 2px solid dodgerblue; }
    .hideBorder{ border: 2px solid white; }
</style>

<template>
    <!--根列布局模块-->
    <div v-if="item.info == 'root'" :id="item.id"
    style="
        display: flex; 
        flex-direction: row;
        flex-grow: 1;
        overflow-x: hidden;
        overflow-y: hidden"
        :style="{'maxHeight': item.size/10 + '%'}
    ">
        <Layout v-for="(i) in item.children" :item='i' parent="row"/>
    </div>
    <!--列布局模块-->
    <div v-else-if="item.info == 'col'" :id="item.id"
        style="margin-bottom:5px"
        :style="{'width': item.size/10 + '%'}">
        <Layout v-for="(i) in item.children" :item='i' parent="col"/>
    </div>
    <!--列分隔模块-->
    <div v-else-if="item.info == 'col-split'" class="hideBorder" :id="item.id"
        style="cursor: ew-resize; margin-left: 1px; margin-right: 1px;"
        :style="{'width': item.size/10 + '%'}"
        @mouseover = "e => e.target.style.border = '2px solid dodgerblue'"
        @mouseout = "e => e.target.style.border = '2px solid white'"
    />
    <!--行布局模块-->
    <div v-else-if="item.info == 'row'" :id="item.id"
    style="flex-grow: 1;" :style="{'height': item.size/10 + '%'}">
        <Layout v-for="i in item.children" :item='i' parent="row"/>
    </div>
    <!--行分隔模块-->
    <div v-else-if="item.info == 'row-split'" class="hideBorder" :id="item.id"
        style="cursor: ns-resize; flex-grow: 1;  margin-top: 1px; margin-bottom: 1px;" 
        :style="{'width': item.size/10 + '%',}"
        @mouseover = "e => e.target.style.border = '2px solid dodgerblue'"
        @mouseout = "e => e.target.style.border = '2px solid white'"
    />
    <!--功能模块-->
    <div v-else  :id="item.id" style="display: flex; flex-direction: column; height: 100%;"
    >
        <Module :tabs="item.info.split('+')"/>
    </div>
</template>