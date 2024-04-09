<script lang="ts">
    const JSZip = require("jszip");  // 用于压缩解压文件的库
    import BUS from "./EventBus"
    const electron = require("electron");
    var fs = require("fs");
    var path = require("path");
    import { defineComponent, ref} from "vue";
    import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
    import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
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
    } from "@ant-design/icons-vue";

    var BottomMessage;
    var BottomSpeed;
    const emulateMode = ref("stop");  // 仿真状态
    var fast = ref(25);  // 快进速度
    var fileInput;  // 文件选择器
    var fileOutput;  // 文件保存器
    const GLTFexporter = new GLTFExporter();
    const GLTFloader = new GLTFLoader();
    const marks = {0:'1x', 25: '2x', 50: '4x', 
        75: {style: {color: 'lightgrey', textDecoration: "line-through"}, label: '8x'}, 
        100: {style: {color: 'lightgrey', textDecoration: "line-through"}, label: '10x'}
    };
    var menu = [
        ["文件", [
            "新建场景", "载入场景", "保存场景", "最近打开",
            "——",
            "设置",
            "——",
            "退出"
        ]],
        "主要功能",
        "可视化"
    ]
    const mode = ref("edit");  // 编辑模式（edit）或浏览模式（view）
    const recentOpened = ref([]);  // 最近打开的场景文件
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
            action(option){  // 场景操作
                if(option == "新建场景") this.loadScene(null, "src/temp/New.DTScene");
                if(option == "载入场景") fileInput.click();
                if(option == "保存场景") this.saveScene();
            },
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
            ipcRenderer(data){ electron.ipcRenderer.send(data); },  // 刷新页面
            loadScene(e=null, target=null){
                let DTFilePath  // 选择路径
                if(e) DTFilePath = e.target.files[0].path;  // 从input选择路径导入
                else DTFilePath = target;  // 从指定路径导入
                if(DTFilePath.slice(0,3)!="src") this.setHistory(DTFilePath);  // 若从绝对路径导入则修改文件打开记录
                let zip = new JSZip();
                const zipFile = fs.readFileSync(DTFilePath), promises = [];  
                zip.loadAsync(zipFile).then(() => {  // 解压  
                    zip.forEach((relativePath, zipEntry) => {  
                        const writePath = "src/temp/" + relativePath;  
                        let promise = zipEntry.async('nodebuffer');
                        promises.push(promise);
                        promise.then((buffer) => {  
                            fs.writeFileSync(writePath, buffer);
                        });  
                    });  
                    Promise.all(promises).then(()=>{  // 文件全部解压完后读取解压文件  
                        GLTFloader.load("src/temp/Scene.txt", (file)=>{
                            let DTScene = BUS.getDTScene();
                            let obj = fs.readFileSync("src/temp/DTObjects.txt", "utf-8");
                            DTScene.copyFrom(JSON.parse(obj), true);
                            DTScene.mesh = file.scene;
                            DTScene.mesh.DT = DTScene;
                            DTScene.newScene();
                        });                  
                    })
                }) 
            },
            message(data){ BottomMessage.textContent = data; },
            saveScene(target=null, DTObjects="src/temp/DTObjects.txt", Scene="src/temp/Scene.txt"){
                // 保存DTObject
                let DTScene = BUS.getDTScene();
                let data = JSON.stringify(DTScene.clone());
                try {fs.readdirSync("src/temp");}  // 无临时文件夹则创建临时文件夹
                catch {fs.mkdirSync("src/temp");}
                fs.writeFileSync(DTObjects, data);
                // 保存GLTF场景文件，克隆场景并自动去除其中的DT，以节省文件大小
                GLTFexporter.parse(DTScene.mesh.clone(), function (scene) {
                    const file = JSON.stringify(scene);
                    fs.writeFileSync(Scene, file);
                    // 压缩
                    const zip = new JSZip(), zipFile = "src/temp/DTScene.DTScene";  
                    zip.file(path.basename(DTObjects), fs.readFileSync(DTObjects)); 
                    zip.file(path.basename(Scene), fs.readFileSync(Scene));
                    zip.generateAsync({type: "nodebuffer"}).then(data => {
                        if(target){
                            fs.writeFileSync(target, data); 
                            return;
                        }
                        fs.writeFileSync(zipFile, data);
                    }).then(()=>{  // 选择目录并下载
                        if(target) return;
                        fileOutput.href = zipFile;  // 被下载的文件
                        fileOutput.download = "场景.DTScene";  // 默认文件名
                        fileOutput.click();
                    });
                }, null, {onlyVisible: false});           
            },
            setFast(e){  // 设置快进速度
                let value = e.key;
                fast.value = parseInt(value);
            },
            setHistory(path){  // 设置文件打开记录，最多十条
                let recent = recentOpened.value;
                if(path == "clear") recentOpened.value = [];  // 清空历史记录
                else if(!recent.includes(path)){
                    recent.push(path);
                    if(recent.length>10) recent.splice(0, 1);
                }
                else{  // 若打开的文件在记录中，则将其改为最新的记录
                    let newest = recent.splice(recent.indexOf(path), 1);
                    recent.push(path);
                }
                fs.writeFileSync("src/recentOpened.txt", JSON.stringify(recent));
            }
        },
        setup() {
            const selectedKey = ref([]);
            return {
                BUS, emulateMode, fast, marks, menu, mode, recentOpened, 
                savepath:"", selectedKey, speed, tab,
            };
        },
        mounted(){
            this.ipcRenderer("closeDevTools");  // 默认关闭开发人员工具
            BottomMessage = document.getElementById("BottomMessage");
            BottomSpeed = document.getElementById("BottomSpeed");
            fileInput = document.getElementById("fileInput");
            fileOutput = document.getElementById("fileOutput");
            fileOutput.download = this.savepath;
            try {  // 有历史打开记录则加载
                let history = fs.readFileSync("src/recentOpened.txt", "utf-8"); 
                recentOpened.value = JSON.parse(history);
            } 
            catch {}
            BUS.on("saveInitScene", ()=>{this.saveScene("src/temp/New.DTScene")});
        },
        destroyed(){  // 退出时清理临时文件（src/temp文件夹）
            function deleteFolder(path) {
                if (fs.existsSync(path)) {
                    fs.readdirSync(path).forEach(function(file) {
                        const curPath = path + '/' + file;
                        if (fs.lstatSync(curPath).isDirectory()) deleteFolder(curPath); // 递归删除文件夹
                        else fs.unlinkSync(curPath); // 删除文件
                    });
                    fs.rmdirSync(path); // 删除空文件夹
                }
            }
            deleteFolder("src/temp");
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
    .split {border:1px solid lightgrey;}
    .top {margin-top:10px;}
    .top16 {margin-top:16px;}
</style>

<template>
    <!--隐藏的文件选择器input和下载器a，用于导入和导出文件-->
    <div style="display: none;">   
        <input id="fileInput" type="file" accept=".DTScene" @change="loadScene"/>
        <a id="fileOutput"/>
    </div>
    
    <!--顶部选择栏-->
    <a-menu mode="horizontal">
        <a-sub-menu v-for="key in menu">
        <template #title>
            <div v-if="typeof key == 'object'">{{key[0]}}</div>
            <div v-else @click="changeTab(key)">{{key}}</div>
        </template>

        <!--文件-->
        <a-list v-if="typeof key == 'object'" v-for="option in key[1]">  
            <a-sub-menu v-if="option=='最近打开'" title="最近打开">
                <a-menu-item v-for="(path, index) in recentOpened.slice().reverse()" :key="path" 
                @click="loadScene(null, path)">
                    {{ index + 1 + '：' + path }}
                </a-menu-item>
                <a-menu-item v-if="!recentOpened[0]" disabled>无</a-menu-item>
                <hr class="split"/>          
                <a-menu-item @click="setHistory('clear')">清空历史记录</a-menu-item>
            </a-sub-menu>
            <a-menu-item v-else-if="option!='——'" :key="option" :title="{option}" 
            @click="action(option)">
                {{option}}
            </a-menu-item>  
            <hr v-else class="split"/>  
        </a-list>  
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
                <a-slider @change="changeSpeed" :marks="marks" :step="25" :tooltipVisible="false" 
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
  