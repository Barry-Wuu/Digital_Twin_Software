<script lang="ts">
    import BUS from "./EventBus"
    import { defineComponent, ref} from 'vue';
    import { 
        CameraOutlined,
        CaretDownOutlined,
        CaretRightOutlined,
        CheckOutlined,
        DeleteTwoTone,
        FormOutlined,
        ForwardOutlined,
        FullscreenOutlined,
        PauseOutlined,
        ReloadOutlined,
        StepForwardOutlined,
    } from '@ant-design/icons-vue';
    var BottomMessage;
    var BottomSpeed;
    const emulateMode = ref("stop");  // 仿真状态
    var fast = ref(25);  // 快进速度
    const fullscreen = ref(false);  // 是否全屏
    const marks = {0:'1x', 25: '2x', 50: '4x', 
        75: {style: {color: 'lightgrey', textDecoration: "line-through"}, label: '8x'}, 
        100: {style: {color: 'lightgrey', textDecoration: "line-through"}, label: '10x'}
    };
    var menu = [
        ["文件", [
            "新建",
            "导入",
            "导出",
            "——",
            "设置",
            "——",
            "退出"
        ]],
        "主要功能",
        "可视化"
    ]
    const mode = ref("edit");  // 编辑模式（edit）或浏览模式（view）
    const speed = ref(0);
    const tab = ref("主要功能");  // 栏目

    export default defineComponent({
        components: {
            BUS, 
            CameraOutlined,
            CaretDownOutlined,
            CaretRightOutlined,
            CheckOutlined,
            DeleteTwoTone,
            FormOutlined,
            ForwardOutlined,
            FullscreenOutlined,
            PauseOutlined,  
            ReloadOutlined,
            StepForwardOutlined,
        },
        methods:{
            changeFullscreen(){  // 切换全屏显示
                BUS.emit("canvasFullscreen");
            },
            changeEmulateMode(mode){  // 切换仿真状态
                emulateMode.value = mode;
                BUS.emit("changeEmulateMode", mode);
                if(mode == "stop") {this.message("仿真停止");}
                if(mode == "play") {this.message("仿真开始");}
                if(mode == "step") {this.message("仿真步进");}
                if(mode == "fast") {this.message("仿真快进");}
                speed.value = mode == "fast" ? fast.value : 0;
                BUS.emit("changeSpeed", marks[speed.value]);
                BottomSpeed.textContent = marks[speed.value];
            },
            changeSpeed(value){  // 更改速度，value为滑动条百分比，marks[value]为实际速度倍率
                if(value.key) value=value.key;
                if(value>=75) value=50;
                emulateMode.value = value==0 ? "play" : "fast";
                this.message(value==0 ? "仿真开始" : "仿真快进"); 
                speed.value = value;
                BUS.emit("changeSpeed", marks[value]);
                BottomSpeed.textContent = marks[value];
            },
            changeTab(key){tab.value = key;},  // 切换顶部栏目
            clearTemp(){BUS.emit('clearTemp')},  // 清除临时实体
            ipcRenderer(data){ require("electron").ipcRenderer.send(data); },  // 刷新页面
            message(data){ BottomMessage.textContent = data; },
            setFast(e){  // 设置快进速度
                let value = e.key;
                fast.value = parseInt(value);
            }
        },
        setup() {
            const selectedKey = ref([]);
            return {
                BUS, emulateMode, fast, marks, menu, mode, selectedKey, speed, tab
            };
        },
        mounted(){
            this.ipcRenderer("closeDevTools");  // 默认关闭开发人员工具
            BottomSpeed = document.getElementById("BottomSpeed");
            BottomMessage = document.getElementById("BottomMessage");
        }
  });
</script>

<style>
    .bottom {margin-bottom:10px;}
    .bottomBorder {border-top:2px solid grey; width:100%}
    .logo {border-radius:5px; cursor:pointer}
    .logoBig {font-size:36px;}
    .marginLR5 {margin-left:5px; margin-right:5px;}
    .marginLR10 {margin-left:10px; margin-right:10px;}
    .split {border:1px solid grey;}
    .top {margin-top:10px;}
    .top16 {margin-top:16px;}
</style>

<template>
    <!--顶部选择栏-->
    <a-menu v-model:selectedKeys="selectedKey" mode="horizontal">
      <a-sub-menu v-for="(key) in menu">
        <template #title>
            <div v-if="typeof key == 'object'">{{key[0]}}</div>
            <div v-else @click="changeTab(key)">{{key}}</div>
        </template>
        <!--文件-->
        <li v-for="(option) in key[1]" v-if="typeof key == 'object'">  
            <a-menu-item v-if="option!='——'" :title="{option}">{{option}}</a-menu-item>  
            <div v-else style="border:solid lightgrey 1px; height:0px"/>  
        </li>  
      </a-sub-menu>
    </a-menu>

    <!--主要功能-->
    <span v-if="tab=='主要功能'" style="border:2px solid grey; display: flex; height:100px">
        <!--模式选择-->
        <div style="align-items:center; display:inline; height:100%" class="bottom marginLR5">
            <span style="align-items:center; display:flex; 
            height: calc(100% - 35px); justify-content:space-evenly;" class="bottom">
                <!--编辑模式-->
                <div class="logo marginLR10 top16" @click="mode='edit'; BUS.emit('modeSelect', 'edit')"
                :style="{'background': mode=='edit' ? 'powderblue' : ''}"
                @mousedown = "e => e.preventDefault()"
                @mouseenter = "e => e.target.style.color = 'dodgerblue'"
                @mouseleave = "e => e.target.style.color = 'black'">
                    <FormOutlined class="logoBig"/>
                    <br>编辑模式
                </div>
                <!--浏览模式-->
                <div class="logo marginLR10 top16" @click="mode='view'; BUS.emit('modeSelect', 'view')"
                :style="{'background': mode=='view' ? 'powderblue' : ''}"
                @mousedown = "e => e.preventDefault()"
                @mouseenter = "e => e.target.style.color = 'dodgerblue'"
                @mouseleave = "e => e.target.style.color = 'black'">
                    <CameraOutlined class="logoBig"/>
                    <br>浏览模式
                </div>
            </span>
            <div class="bottomBorder">模式选择</div>
        </div>
        <div class="split"/><!--分隔符-->

        <!--动画-->
        <div style="align-items:center; height:100%;" class="bottom marginLR5">
            <span style="align-items:center; display:flex; 
            height: calc(100% - 78px); justify-content:space-evenly;" class="bottom">
                <div class="marginLR10" style="display:flex; margin-top:16px">
                    <!--重置-->
                    <div class="logo" @click="clearTemp(); changeEmulateMode('stop')" 
                    @mousedown = "e => e.preventDefault()"
                    @mouseenter = "e => e.target.style.color = 'red'"
                    @mouseleave = "e => e.target.style.color = 'black'">              
                        <DeleteTwoTone twoToneColor="red"/>重置&nbsp;&nbsp;
                    </div>
                    <!--暂停-->
                    <div @click="() => {if(emulateMode!='stop') changeEmulateMode('stop')}" 
                    :style="
                        emulateMode=='stop' ? {color:'grey', cursor:'default'} : {color:'black', cursor:'pointer'}
                    " 
                    @mousedown = "e => e.preventDefault()"
                    @mouseenter = "e => {if(emulateMode!='stop') e.target.style.color = 'dodgerblue'}"
                    @mouseleave = "e => {if(emulateMode!='stop') e.target.style.color = 'black'}">     
                        <PauseOutlined/>暂停&nbsp;&nbsp; 
                    </div>
                    <!--运行-->
                    <div @click="() => {if(emulateMode!='play') changeEmulateMode('play')}" 
                    :style="
                        emulateMode=='play' ? {color:'grey', cursor:'default'} : {color:'black', cursor:'pointer'}
                    " 
                    @mousedown = "e => e.preventDefault()"
                    @mouseenter = "e => {if(emulateMode!='play') e.target.style.color = 'dodgerblue'}"
                    @mouseleave = "e => {if(emulateMode!='play') e.target.style.color = 'black'}">              
                        <StepForwardOutlined/>运行&nbsp;&nbsp;
                    </div>
                    <!--步进-->
                    <div class="logo" @click="changeEmulateMode('step')" 
                    @mousedown = "e => e.preventDefault()"
                    @mouseenter = "e => e.target.style.color = 'dodgerblue'"
                    @mouseleave = "e => e.target.style.color = 'black'">              
                        <StepForwardOutlined/>步进&nbsp;&nbsp;
                    </div>
                    <!--快进-->
                    <div class="logo"
                    @mousedown = "e => {e.preventDefault(); changeEmulateMode('fast');}"
                    @mouseup = "e => changeEmulateMode('play')"
                    @mouseenter = "e => e.target.style.color = 'dodgerblue'"
                    @mouseleave = "e => e.target.style.color = 'black'">              
                        <ForwardOutlined/>快进&nbsp;&nbsp;
                    </div>
                    <a-dropdown>
                        <a-button style="margin-top:-3px">
                            快进速度：{{ marks[fast] }}<CaretDownOutlined/>
                        </a-button>
                        <template #overlay>
                            <a-menu @click="setFast">
                                <a-menu-item key="25">
                                    2x&nbsp;&nbsp;<CheckOutlined v-if="fast==25"/>
                                </a-menu-item>
                                <a-menu-item key="50">
                                    4x&nbsp;&nbsp;<CheckOutlined v-if="fast==50"/>
                                </a-menu-item>
                                <a-menu-item key="75" :disabled="true">
                                    8x&nbsp;&nbsp;<CheckOutlined v-if="fast==75"/>
                                </a-menu-item>
                                <a-menu-item key="100" :disabled="true">
                                    10x&nbsp;&nbsp;<CheckOutlined v-if="fast==100"/>
                                </a-menu-item>
                            </a-menu>
                        </template>
                    </a-dropdown>
                </div>
            </span>
            <span style="display:inline-flex">
                <div style="margin-top:10px">仿真速度：</div>
                <a-slider @change="changeSpeed" :marks="marks" step=25 :tooltipVisible="false" 
                :value="speed" class="marginLR10" style="width: 200px; margin-bottom: 20px"/>
            </span>
            <div class="bottomBorder">仿真动画</div>
        </div>
        <div class="split"/><!--分隔符-->
    </span>

    <!--可视化-->
    <span v-if="tab=='可视化'" style="border:2px solid grey; display: flex; height:100px">
        <!--屏幕-->
        <div style="align-items:center; display:inline; height:100%" class="marginLR5">
            <span style="align-items:center; display:flex; 
            height: calc(100% - 35px); justify-content:space-evenly;" class="bottom">
                <div class="logo marginLR10 top16" @click="changeFullscreen"
                @mousedown = "e => e.preventDefault()"
                @mouseenter = "e => e.target.style.color = 'dodgerblue'"
                @mouseleave = "e => e.target.style.color = 'black'">
                    <FullscreenOutlined class="logoBig"/>
                    <br>全屏显示
                </div>     
            </span>
            <div class="bottomBorder">屏幕</div>
        </div>
        <div class="split"/><!--分隔符-->

        <!--系统操作-->
        <div style="align-items:center; display:inline; height:100%" class="bottom marginLR5">
            <span style="align-items:center; display:flex; 
            height: calc(100% - 35px); justify-content:space-evenly;" class="bottom">
                <!--重载界面-->
                <div class="logo marginLR10 top16" @click="()=>{ipcRenderer('reload')}"
                @mousedown = "e => e.preventDefault()"
                @mouseenter = "e => e.target.style.color = 'dodgerblue'"
                @mouseleave = "e => e.target.style.color = 'black'">
                    <ReloadOutlined class="logoBig"/>
                    <br>重载界面
                </div>
            </span>
            <div class="bottomBorder">系统操作</div>
        </div>
        <div class="split"/><!--分隔符-->
    </span>
</template>
  