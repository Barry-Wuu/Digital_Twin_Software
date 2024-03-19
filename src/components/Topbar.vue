<script lang="ts">
    import BUS from "./EventBus"
    import { defineComponent, ref} from 'vue';
    import { 
        DownOutlined,
        FullscreenOutlined,
        MenuFoldOutlined,
        MenuUnfoldOutlined,    
        ReloadOutlined
    } from '@ant-design/icons-vue';
    var BottomSpeed;
    const devOpened = ref(true);  // 开发人员工具是否打开
    const fullscreen = ref(false);  // 是否全屏
    const marks = {0:'1x', 25: '2x', 50: '4x', 75: '8x', 100:'10x'};
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
    const speed = ref(0);
    const tab = ref("主要功能");  // 栏目
    export default defineComponent({
        components: {
            BUS, 
            DownOutlined, 
            FullscreenOutlined,
            MenuFoldOutlined,
            MenuUnfoldOutlined,    
            ReloadOutlined
        },
        methods:{
            changeFullscreen(){  // 切换全屏显示
                BUS.emit("canvasFullscreen");
            },
            changeTab(key){tab.value = key;},  // 切换顶部栏目
            devtoolChange(){  // 展开或折叠开发人员工具
                this.ipcRenderer(devOpened.value ? "openDevTools" : "closeDevTools");
                devOpened.value = !devOpened.value;
            },
            ipcRenderer(data){ require("electron").ipcRenderer.send(data); }  // 刷新页面
        },
        setup() {
            const selectedKey = ref([]);
            return {
                change: (x)=>{
                    if(x.key) x=x.key;
                    speed.value = x;
                    BUS.emit("changeSpeed", marks[speed.value]);
                    BottomSpeed.textContent = marks[speed.value];
                },
                devOpened, marks, menu, selectedKey, speed, tab
            };
        },
        mounted(){
            this.ipcRenderer("closeDevTools");  // 默认关闭开发人员工具
            BottomSpeed = document.getElementById("BottomSpeed");
        }
  });
</script>
<style>
    .bottom {margin-bottom:10px;}
    .bottomBorder {border-top:2px solid grey; width:100%}
    .marginLR5 {margin-left:5px; margin-right:5px;}
    .marginLR10 {margin-left:10px; margin-right:10px;}
    .split {border:1px solid grey;}
    .top {margin-top:10px;}
</style>
<template>
    <a-menu v-model:selectedKeys="selectedKey" mode="horizontal">
      <a-sub-menu v-for="(key) in menu">
        <template #title>
            <div v-if="typeof key == 'object'">{{key[0]}}</div>
            <div v-else @click="changeTab(key)">{{key}}</div>
        </template>
        <li v-for="(option) in key[1]" v-if="typeof key == 'object'">  
            <a-menu-item v-if="option!='——'">{{option}}</a-menu-item>  
            <div style="border:solid lightgrey 1px; height:0px" v-else/>  
        </li>  
      </a-sub-menu>
    </a-menu>
    <!--主要功能-->
    <span v-if="tab=='主要功能'" style="border:2px solid grey; display: flex; height:100px">
        <!--动画-->
        <div style="align-items:center; height:100%;" class="bottom marginLR5">
            <span style="align-items:center; display:flex; 
            height: calc(100% - 35px); justify-content:space-evenly;" class="bottom">
                <a-slider @change="change" :marks="marks" step=25 :tooltipVisible="false" 
                :value="speed" class="marginLR10" style="width: 200px; margin-bottom: 10px"/>
                <div style="border:1px solid grey; height:100%; 
                margin-bottom:-10px; margin-left:5px; margin-right:5px;"/>
                <a-dropdown class="marginLR10" >
                    <a class="ant-dropdown-link top" @click.prevent>
                        更改速度<DownOutlined/>
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
            <div class="bottomBorder">动画</div>
        </div>
        <!--分隔符-->
        <div class="split"/>
        <!--系统操作-->
        <div style="align-items:center; display:inline; height:100%" class="bottom marginLR5">
            <span style="align-items:center; display:flex; 
            height: calc(100% - 35px); justify-content:space-evenly;" class="bottom">
                <div class="marginLR10" style="margin-top:16px">
                    <ReloadOutlined style="fontSize:36px;" @click="()=>{ipcRenderer('reload')}"/>
                    <br>重载界面
                </div>
                <div class="marginLR10" v-if="devOpened" style="margin-top:16px">
                    <MenuFoldOutlined style="fontSize:36px;" @click="devtoolChange"/>
                    <br>显示开发人员工具
                </div>
                <div class="marginLR10" v-else style="margin-top:16px">
                    <MenuUnfoldOutlined style="fontSize:36px;" @click="devtoolChange"/>
                    <br>隐藏开发人员工具
                </div>
            </span>
            <div class="bottomBorder">系统操作</div>
        </div>
        <!--分隔符-->
        <div class="split"/>
    </span>
    <span v-if="tab=='可视化'" style="border:2px solid grey; display: flex; height:100px">
        <!--屏幕-->
        <div style="align-items:center; display:inline; height:100%" class="marginLR5">
            <span style="align-items:center; display:flex; 
            height: calc(100% - 35px); justify-content:space-evenly;" class="bottom">
                <div style="margin-top:16px">
                    <FullscreenOutlined style="fontSize:36px;" @click="changeFullscreen"/>
                    <br>全屏显示
                </div>     
            </span>
            <div class="bottomBorder">屏幕</div>
        </div>
        <div class="split"/>
    </span>
</template>
  