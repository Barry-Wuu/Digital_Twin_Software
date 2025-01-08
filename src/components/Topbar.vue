<script lang="ts">
    import global from "../Global"
    const electron = require("electron");
    const fs = require("fs");
    const JSZip = require("jszip");  // 用于压缩解压文件的库
    const path = require("path");
    import { defineComponent, ref } from "vue";
    import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
    import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
    import { 
        AppstoreAddOutlined,
        BlockOutlined,
        CameraOutlined,
        CaretDownOutlined,
        CaretRightOutlined,
        CheckOutlined,
        CloseOutlined,
        CodepenOutlined,
        CodeSandboxOutlined,
        DeleteTwoTone, 
        FormOutlined,
        ForwardOutlined,
        FullscreenOutlined,
        MinusOutlined,
        PauseOutlined,
        PlusOutlined,
        QuestionCircleOutlined,
        ReloadOutlined,
        SettingOutlined,
        StepForwardOutlined,
        VideoCameraOutlined,
    } from "@ant-design/icons-vue";

    var BottomMessage;
    var BottomSpeed;
    const cameraMode = ref("透视");
    const customViews = ref([]);
    const emulateMode = ref("stop");  // 仿真状态
    var fast = ref(25);  // 快进速度
    var fileInput;  // 文件选择器
    var fileOutput;  // 文件保存器
    const GLTFexporter = new GLTFExporter();
    const GLTFloader = new GLTFLoader();
    const ipc = electron.ipcRenderer;   // 向页面发送信息 
    const layersActive = ref([
        "special", 
        "WIP", 
        "gizmo", 
        "controller",
        "indicator",
        "label",
        "attachPoint",
        "lightArrow",
    ]);
    const layersAll = ref({
        "special": "特殊物体", 
        "WIP": "在制品", 
        "gizmo": "Gizmo", 
        "controller": "物体控制器",
        "indicator": "指示箭头",
        "label": "物体名称",
        "rigidHelper": "碰撞体",
        "attachPoint": "传送带吸附点",
        "lightArrow": "光照方向",
    });
    const marks = {0:'1x', 25: '2x', 50: '4x', 75: '8x', 100: '10x'};
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
    const viewName = ref('');  // 自定义视角名称
    const wireframe = ref("包围盒");  // 物体边框

    export default defineComponent({
        components: {
            global, 
            AppstoreAddOutlined,
            BlockOutlined,
            CameraOutlined,
            CaretDownOutlined,
            CaretRightOutlined,
            CheckOutlined,
            CloseOutlined,
            CodepenOutlined,
            CodeSandboxOutlined,
            DeleteTwoTone, 
            FormOutlined,
            ForwardOutlined,
            FullscreenOutlined,
            MinusOutlined,
            PauseOutlined,
            PlusOutlined,
            QuestionCircleOutlined,
            ReloadOutlined,
            SettingOutlined,
            StepForwardOutlined,
            VideoCameraOutlined,
        },
        methods:{
            action(option){  // 场景操作
                if(option == "新建场景") this.loadScene(null, "src/temp/New.DTScene");
                if(option == "载入场景") fileInput.click();
                if(option == "保存场景") this.saveScene();
            },
            changeCamera(e){  // 切换相机类型（投影/正交）
                cameraMode.value = e.key;
                global.emit("changeCamera", e.key);
            },
            changeFullscreen(){  // 切换全屏显示
                global.emit("changeFullscreen");
            },
            changeEmulateMode(mode){  // 切换仿真状态
                emulateMode.value = mode;
                global.emit("changeEmulateMode", mode);
                if(mode == "stop") this.message("仿真停止");
                if(mode == "play") this.message("仿真开始");
                if(mode == "step") this.message("仿真步进");
                if(mode == "fast") this.message("仿真快进");
                speed.value = mode == "fast" ? fast.value : 0;
                global.emit("changeSpeed", marks[speed.value]);
                BottomSpeed.textContent = marks[speed.value];
            },
            changeLayers(e){  // 更改各类物体的显隐性
                let layer = e.target.value;  // 更改的图层中文名
                let layers = layersActive.value;  // 显示的图层，其用中文名表示
                let show = !layers.includes(layer);  // 显示或隐藏
                layers = show ? [...layers, layer] : layers.filter(item => item!=layer);  // 更改显示图层
                global.layers = layers;
                if(layer == "controller") global.emit("changeControllerVisibility", show);
                else if(layer == "gizmo") global.emit("changeGizmoVisibility", show);
                else{
                    for(let DT of global.SCENE.DT.getDTObjects()){
                        if(layer in DT.layers){
                            for(let mesh of DT.layers[layer]){
                                mesh.visible = show;
                            }
                        }
                        else if(layer == DT.label){
                            DT.mesh.visible = show;
                        }
                    }
                }
            },
            changeSpeed(value){  // 更改速度，value为滑动条百分比，marks[value]为实际速度倍率
                if(value.key) value = value.key;
                emulateMode.value = value==0 ? "play" : "fast";
                this.message(value==0 ? "仿真开始" : "仿真快进"); 
                speed.value = value;
                global.emit("changeSpeed", marks[value]);
                BottomSpeed.textContent = marks[value];
            },
            changeTab(key){  // 切换顶部栏目及其标题颜色
                tab.value = key;
            },
            changeView(e){  // 切换视角
                global.emit("changeView", e.key)
            },
            changeWireframe(e){  // 切换物体边框
                wireframe.value = e.key;
                global.emit("changeWireframe", e.key);
            },
            clearViewName(){
                this.$nextTick(()=>{viewName.value = ''});
            },
            clearLoads(){global.emit("clearLoads")},  // 清除所有货物
            lightON(e, condition = true){  // 鼠标移入图标时将其点亮
                if(condition) e.target.style.color = 'dodgerblue';
            },
            lightOFF(e, condition = true){  // 鼠标移入图标时将其熄灭
                if(condition) e.target.style.color = 'black';
            },
            loadScene(e=null, target=null){
                let DTFilePath;  // 选择路径
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
                        global.emit("loadScene", "src/temp/DemoScene.json");             
                    })
                }) 
            },
            message(data){ BottomMessage.textContent = data; },
            reload(){  // 重新加载
                global.emit("popup", {  // 弹窗询问是否重新加载页面
                    title: "重新加载页面",
                    type: "yes_no",
                    content: "确定要重载界面吗？",
                    yes: ()=>{ipc.send("reload")},  // 确认重命名
                    // no为取消关闭
                });
            },
            saveScene(target=null, DTObjects="src/temp/DTObjects.txt", Scene="src/temp/Scene.txt"){
                let DTScene = global.SCENE.DT;
                // 暂时移除位姿控制器
                let children = DTScene.mesh.children;
                let controller = children.filter(mesh => mesh.isTransformControls)[0];
                DTScene.mesh.remove(controller);
                // 保存DTObject
                let data = JSON.stringify(DTScene.clone());
                try {fs.readdirSync("src/temp");}  // 无临时文件夹则创建临时文件夹
                catch {fs.mkdirSync("src/temp");}
                fs.writeFileSync(DTObjects, data);
                // 保存GLTF场景文件，克隆场景并自动去除其中的DT，以节省文件大小
                let clone = DTScene.mesh.clone();
                GLTFexporter.parse(clone, function (scene) {
                    DTScene.mesh.add(controller);  // 恢复控制器
                    // 压缩
                    const file = JSON.stringify(scene);
                    fs.writeFileSync(Scene, file);
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
            sendData(){  // 设置发送数据
                global.emit("popup", {type: "sendData", title: "数据发送设置"});
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
                fs.writeFileSync("src/config/recentOpened.txt", JSON.stringify(recent));
            },
            setMode(newMode){  // 切换编辑/浏览模式
                global.mode = newMode;
                mode.value = newMode;
            },
            viewAdd(){  // 新建视角
                customViews.value.push({
                    name: viewName.value,
                    position: global.camera.position.clone(),
                    target: global.camera.userData.orbitControl.target.clone()
                });
                customViews.value.sort(  // 将视角按名称拼音排序
                    (a,b) => a.name.localeCompare(b.name, 'zh-cn', {sensitivity:'accent'})
                );
                viewName.value = '';
                this.viewSave();
            },
            viewClear(){  // 清空自定义视角
                customViews.value = [];
                this.viewSave();
            },
            viewExists(){  // 视角名称是否存在
                return customViews.value.filter(view=>view.name==viewName.value)[0]; 
            },
            viewSave(){  // 保存自定义视角
                fs.writeFileSync("src/config/customViews.txt", JSON.stringify(customViews.value));
            },
            viewSelect(e){  // 选择视角
                if(e.key == "新增视角" || e.key == "移除视角") return;
                viewName.value = e.key;
                let view = customViews.value.filter(item => item.name==e.key)[0];
                global.camera.position.copy(view.position);
                global.camera.userData.orbitControl.target.copy(view.target);
            },
            viewDelete(){  // 移除视角
                customViews.value = customViews.value.filter(
                    view => view.name != viewName.value
                );
                viewName.value = '';
                this.viewSave();
            },
        },
        setup() {
            const selectedKey = ref([]);
            return {
                cameraMode, customViews, global, emulateMode, fast, layersActive, layersAll, 
                marks, menu, mode, recentOpened, savepath:"",  
                selectedKey, speed, tab, viewName, wireframe
            };
        },
        mounted(){  
            ipc.send("closeDevTools");  // 默认关闭开发人员工具
            ipc.on("closeConfirm", () => {  // 退出前弹窗确认
                global.emit("popup", {  // 弹窗询问是否关闭
                    title: "关闭窗口",
                    type: "yes_no",
                    content: "确定要关闭窗口吗？",
                    yes: ()=>{  // 确认关闭
                        global.emit("closeWindow");
                        ipc.send("closeWindow");
                    },
                    // no为取消关闭
                });
            });
            BottomMessage = document.getElementById("BottomMessage");
            BottomSpeed = document.getElementById("BottomSpeed");
            fileInput = document.getElementById("fileInput");
            fileOutput = document.getElementById("fileOutput");
            fileOutput.download = this.savepath;
            global.layers = layersActive.value;

            try {  // 有历史打开记录和自定义视角则加载
                let file;
                file = fs.readFileSync("src/config/recentOpened.txt", "utf-8"); 
                recentOpened.value = JSON.parse(file);
                file = fs.readFileSync("src/config/customViews.txt", "utf-8"); 
                customViews.value = JSON.parse(file);
            } 
            catch {}

            global.on("closeWindow", () => {  // 退出时清理临时文件（src/temp文件夹）
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
            });
            global.on("saveInitScene", ()=>{this.saveScene("src/temp/New.DTScene")});
        },
    });
</script>

<style>
    .bottom {margin-bottom:10px;}
    .bottomBorder {border-top:2px solid grey; width:100%;}
    .layerSelect {
        padding-left:8px; 
        user-select: none; 
        width:120px;
    }
    .logo {border-radius:5px; cursor:pointer;}
    .logoBig {font-size:36px;}
    .marginLR5 {margin-left:5px; margin-right:5px;}
    .marginLR10 {margin-left:10px; margin-right:10px;}
    .splitH {border:1px solid lightgrey;}
    .splitV {border:1px solid lightgrey;}
    .top {margin-top:10px;}
    .toptab {
        border:2px solid grey; 
        display: flex; 
        height:100px; 
        user-select: none;
    }
    .top16 {margin-top:16px;}
</style>

<template>
    <!--隐藏的文件选择器input和下载器a，用于导入和导出文件-->
    <div style="display: none;">   
        <input id="fileInput" type="file" accept=".DTScene" @change="loadScene"/>
        <a id="fileOutput"/>
    </div>
    
    <!--顶部选择栏-->
    <a-menu mode="horizontal" style="user-select: none">
        <a-sub-menu v-for="key in menu">
            <template #title>
                <div v-if="typeof key == 'object'">{{key[0]}}</div>
                <div v-else @click="changeTab(key);"
                :style="{'color': tab == key ? 'dodgerblue': 'black'}">
                    {{key}}
                </div>
            </template>

            <!--文件-->
            <a-list v-if="typeof key == 'object'" v-for="option in key[1]">  
                <a-sub-menu v-if="option=='最近打开'" title="最近打开">
                    <a-menu-item v-for="(path, index) in recentOpened.slice().reverse()" 
                    :key="path"  @click="loadScene(null, path)">
                        {{ index + 1 + '：' + path }}
                    </a-menu-item>
                    <a-menu-item v-if="!recentOpened[0]" disabled>（无）</a-menu-item>
                    <hr class="splitH"/>          
                    <a-menu-item @click="setHistory('clear')">清空历史记录</a-menu-item>
                </a-sub-menu>
                <a-menu-item v-else-if="option!='——'" :key="option"
                :style="option == '退出' ? {color: 'red'} : {}" :title="{option}"
                @click="action(option)">
                    {{option}}
                </a-menu-item>  
                <hr v-else class="splitH"/>  
            </a-list>  
        </a-sub-menu>
    </a-menu>

    <!--主要功能-->
    <span v-if="tab=='主要功能'" class="toptab" @click="global.emit('deselect')">
        <!--模式选择-->
        <div style="align-items:center; display:inline; height:100%" class="bottom marginLR5">
            <span style="align-items:center; display:flex; 
            height: calc(100% - 35px); justify-content:space-evenly;" class="bottom">
                <!--编辑模式-->
                <div class="logo marginLR10 top16"
                :style="{'background': mode=='edit' ? 'powderblue' : ''}"
                @click="setMode('edit'); global.emit('modeSelect', 'edit')" @click.prevent
                @mouseenter = "lightON" @mouseleave = "lightOFF">      
                    <FormOutlined class="logoBig"/>
                    <br>编辑模式
                </div>
                <!--浏览模式-->
                <div class="logo marginLR10 top16"
                :style="{'background': mode=='view' ? 'powderblue' : ''}"
                @click="setMode('view'); global.emit('modeSelect', 'view')" @click.prevent
                @mouseenter = "lightON" @mouseleave = "lightOFF">      
                    <CameraOutlined class="logoBig"/>
                    <br>浏览模式
                </div>
            </span>
            <div class="bottomBorder">模式选择</div>
        </div>
        <vr class="splitV"/><!--分隔符-->

        <!--仿真动画-->
        <div style="align-items:center; height:100%;" class="bottom marginLR5">
            <span style="align-items:center; display:flex; 
            height: calc(100% - 78px); justify-content:space-evenly;" class="bottom">
                <div class="marginLR10" style="display:flex; margin-top:16px">
                    <!--重置-->
                    <div class="logo" @click="clearLoads(); changeEmulateMode('stop')" 
                    @mousedown.prevent @mouseenter = "lightON" @mouseleave = "lightOFF">          
                        <DeleteTwoTone twoToneColor="red"/>重置&nbsp;&nbsp;
                    </div>
                    <!--暂停-->
                    <div @click="() => {if(emulateMode!='stop') changeEmulateMode('stop')}" 
                    :style="
                        emulateMode=='stop' ? {color:'grey', cursor:'default'} : {color:'black', cursor:'pointer'}
                    " 
                    @mousedown.prevent
                    @mouseenter = "e => lightON(e, emulateMode!='stop')" 
                    @mouseleave = "e => lightOFF(e, emulateMode!='stop')">      
                        <PauseOutlined/>暂停&nbsp;&nbsp; 
                    </div>
                    <!--运行-->
                    <div @click="() => {if(emulateMode!='play') changeEmulateMode('play')}" 
                    :style="
                        emulateMode=='play' ? {color:'grey', cursor:'default'} : {color:'black', cursor:'pointer'}
                    " 
                    @mousedown.prevent
                    @mouseenter = "e => lightON(e, emulateMode!='play')"
                    @mouseleave = "e => lightOFF(e, emulateMode!='play')">              
                        <CaretRightOutlined/>运行&nbsp;&nbsp;
                    </div>
                    <!--步进-->
                    <div class="logo" @click="changeEmulateMode('step')" 
                    @mousedown.prevent @mouseenter = "lightON" @mouseleave = "lightOFF">             
                        <StepForwardOutlined/>步进&nbsp;&nbsp;
                    </div>
                    <!--快进-->
                    <div class="logo"
                    @mousedown = "changeEmulateMode('fast')" @mousedown.prevent
                    @mouseup = "changeEmulateMode('play')"
                    @mouseenter = "lightON" @mouseleave = "lightOFF">          
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
                                <a-menu-item key="75">
                                    8x&nbsp;&nbsp;<CheckOutlined v-if="fast==75"/>
                                </a-menu-item>
                                <a-menu-item key="100">
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
        <vr class="splitV"/><!--分隔符-->

        <!--系统操作-->
        <div style="align-items:center; display:inline; height:100%" class="bottom marginLR5">
            <span style="align-items:center; display:flex; 
            height: calc(100% - 35px); justify-content:space-evenly;" class="bottom">
                <!--数据发送设置-->
                <div class="logo marginLR10 top16" @click="sendData"
                @mousedown.prevent @mouseenter = "lightON" @mouseleave = "lightOFF">
                    <SettingOutlined class="logoBig"/>
                    <br>数据发送设置
                </div>

                <!--重新加载-->
                <div class="logo marginLR10 top16" @click="reload"
                @mousedown.prevent @mouseenter = "lightON" @mouseleave = "lightOFF">
                    <ReloadOutlined class="logoBig"/>
                    <br>重新加载
                </div>

                <!--帮助-->
                <div class="logo marginLR10 top16"
                 @click="global.emit('popup', {title:'帮助', type:'help'})"
                @mousedown.prevent @mouseenter = "lightON" @mouseleave = "lightOFF">
                    <QuestionCircleOutlined class="logoBig"/>
                    <br>帮助
                </div>
            </span>
            <div class="bottomBorder">系统操作</div>
        </div>
        <vr class="splitV"/><!--分隔符-->
    </span>

    <!--可视化-->
    <span v-if="tab=='可视化'" class="toptab" @click="global.emit('deselect')">
        <!--屏幕-->
        <div style="align-items:center; display:inline; height:100%" class="marginLR5">
            <span style="align-items:center; display:flex; 
            height: calc(100% - 35px); justify-content:space-evenly;" class="bottom">
                <!--显示图层--> 
                <a-dropdown :trigger="['click']">
                    <div class="logo marginLR10 top16 ant-dropdown-link" @click.prevent>
                        <BlockOutlined class="logoBig"/>
                        <br>显示图层
                    </div>
                    <!--左键菜单-->
                    <template #overlay>
                        <a-menu class="layerSelect">
                            <a-checkbox-group v-model:value="layersActive">
                                <a-row>
                                    <a-col v-for="(title, layer) of layersAll" :span="24">
                                        <a-checkbox :value="layer" @click="changeLayers">
                                            {{title}}
                                        </a-checkbox>
                                    </a-col>
                                </a-row>
                            </a-checkbox-group>
                        </a-menu>
                    </template>
                </a-dropdown>
                <!--物体边框--> 
                <a-dropdown :trigger="['click']">
                    <div class="logo marginLR10 top16 ant-dropdown-link" @click.prevent>
                        <CodepenOutlined class="logoBig"/>
                        <br>物体边框
                    </div>
                    <!--左键菜单-->
                    <template #overlay>
                        <a-menu @click="changeWireframe">
                            <a-menu-item v-for="item in ['包围盒', '边缘发光']" :key="item"
                            :disabled="item==wireframe">
                                {{item}}&nbsp;
                                <CheckOutlined v-if="item==wireframe"/>
                            </a-menu-item>
                        </a-menu>
                    </template>
                </a-dropdown>
                <!--全屏显示-->   
                <div class="logo marginLR10 top16" @click="changeFullscreen"
                @mousedown = "global.emit('help')">
                    <FullscreenOutlined class="logoBig"/>
                    <br>全屏显示
                </div>     
            </span>
            <div class="bottomBorder">屏幕</div>
        </div>
        <vr class="splitV"/><!--分隔符-->

        <!--相机控制-->
        <div style="align-items:center; display:inline; height:100%" class="bottom marginLR5">
            <span style="align-items:center; display:flex; 
            height: calc(100% - 35px); justify-content:space-evenly;" class="bottom">
                <!--投影模式-->
                <a-dropdown :trigger="['click']">
                    <div class="logo marginLR10 top16 ant-dropdown-link" @click.prevent>
                        <VideoCameraOutlined class="logoBig"/>
                        <br>投影模式
                    </div>
                    <!--左键菜单-->
                    <template #overlay>
                        <a-menu @click="changeCamera">
                            <a-menu-item v-for="item in ['透视', '正交']" :key="item"
                            :disabled="item==cameraMode">
                                {{item}}&nbsp;
                                <CheckOutlined v-if="item==cameraMode"/>
                            </a-menu-item>
                        </a-menu>
                    </template>
                </a-dropdown>
                <!--视角选择-->
                <a-dropdown :trigger="['click']">
                    <div class="logo marginLR10 top16" @click.prevent>
                        <CodeSandboxOutlined class="logoBig"/>
                        <br>视角选择
                    </div>
                    <!--左键菜单-->
                    <template #overlay>
                        <a-menu @click="changeView">
                            <a-menu-item key="默认视图">默认视图</a-menu-item>
                            <a-menu-item key="俯视图">俯视图</a-menu-item>
                            <a-menu-item key="正视图">正视图</a-menu-item>
                            <a-menu-item key="左视图">左视图</a-menu-item>
                            <a-menu-item key="右视图">右视图</a-menu-item>
                        </a-menu>
                    </template>
                </a-dropdown>
                <!--自定义视角-->
                <a-dropdown :trigger="['click']">
                    <div class="logo marginLR10 top16" @click.prevent>
                        <AppstoreAddOutlined class="logoBig"/>
                        <br>自定义视角
                    </div>
                    <!--左键菜单-->
                    <template #overlay>
                        <a-menu @click="viewSelect">
                            <a-menu-item v-if="!customViews[0]" disabled>（无）</a-menu-item>
                            <a-menu-item v-for="view in customViews" :key="view.name">
                                {{ view.name }}
                            </a-menu-item>
                            <hr class="splitH"/>
                            <a-input v-model:value="viewName" placeholder="视角名称" 
                            style="width: 100%"/>
                            <a-menu-item key="新增视角" @click="viewAdd" 
                            :disabled="viewName.trim() == ''||viewExists()">
                                <PlusOutlined/>&nbsp;新增视角
                            </a-menu-item>
                            <a-menu-item key="移除视角" @click="viewDelete" :disabled="!viewExists()">
                                <MinusOutlined/>&nbsp;移除视角
                            </a-menu-item>
                            <a-popconfirm title="确定清空视角吗？"
                            placement="bottom" ok-text="否" cancel-text="是"
                            @cancel="viewClear"><!--左边的为cancel，右边的为ok-->
                                <a-menu-item danger href="#"  key="清空视角" 
                                :disabled="!customViews[0]" @click="clearViewName">
                                    <CloseOutlined/>&nbsp;清空视角
                                </a-menu-item>
                            </a-popconfirm>
                        </a-menu>
                    </template>
                </a-dropdown>
            </span>
            <div class="bottomBorder">相机控制</div>
        </div>
        <vr class="splitV"/><!--分隔符-->
    </span>
</template>
