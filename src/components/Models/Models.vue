<script lang="ts">
  import {CloseOutlined, EditOutlined} from "@ant-design/icons-vue";  // 清除图标
  import DTObject from "../DTScene/DTObject";
  const fs = require("fs");
  import global from "../../Global"
  import modelData from "./modelData.json";
  import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader.js";
  import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js"
  import { ref } from "vue";

  // JSON格式的模型列表，模型路径为src/assets/models，图标路径为src/assets/icons
  const activeKeys1 = ref([]);
  const activeKeys2 = ref([]);
  const currentModel = ref();
  const customModelGroup = ref([]);
  const customModels: any = ref([]);
  const dragAsset = ref({title: '', loading: 0});
  var fileOutput;
  const loadedRobots = {};
  var modelInput;
  const model_definition = modelData.model_definition;
  const model_layout: any = ref(modelData.model_layout);
  const searchResult = ref([]);
  const searchValue = ref('');
  var txt;

  export default {
    components: {CloseOutlined, EditOutlined},
    methods:{
      action(e){  // 选择菜单选项
        let option = e.key;
        if(option == "全部展开"){
          const recursive = (object, activeKeys) => {
            if(!activeKeys.includes(object.title)) activeKeys.push(object.title);
            if(object.children)
              for(let child of object.children) recursive(child, activeKeys);
          }
          recursive({title: "内置模型", children: model_layout.value}, activeKeys1.value);
          activeKeys2.value = Object.keys(customModels.value);
        }
        if(option == "全部折叠"){
          activeKeys1.value = activeKeys2.value = [];
        }
        if(option == "添加到自定义模型"){
          this.saveCustomModel(currentModel.value);
        }
        if(option == "导入自定义模型"){
          modelInput.click();
        }
        if(option == "导出自定义模型"){
          this.exportCustomModel();
        }
        if(option == "修改模型名称"){
          global.emit("popup", {  // 弹窗查看名称和确认重命名
              title: "确认重命名",
              type: "rename",
              content: "重命名模型：",
              value: currentModel.value.name,
              yes: newValue => {currentModel.value.name = newValue;},  // 确认重命名
              // no为取消关闭
          });
        }
        if(option == "修改物理实体ID"){
          global.emit("popup", {  // 弹窗查看名称和确认重命名
              title: "确认重命名",
              type: "rename",
              content: "重命名物理实体ID：",
              value: currentModel.value.physicalID,
              yes: newValue => {currentModel.value.physicalID = newValue;},  // 确认重命名
              // no为取消关闭
          });
        }
        if(option == "删除自定义模型"){
          customModels.value = customModels.value.filter(item=>item != currentModel.value);
          if(!customModels.value.length) customModelGroup.value = [];
        }
        if(option == "清空自定义模型"){
          customModels.value = customModelGroup.value = [];
        }
      },
      deselect(){  // 点击卡片时取消选择物体
        global.emit("deselect");
      },
      dragModelStart(e, data) {  // 发送要拖动的模型
        let obj = JSON.parse(JSON.stringify(model_definition[data.title]));
        e.dataTransfer.setDragImage(document.createElement("img"), 0, 0); 
        if(obj.label == "robot") {
          if(!loadedRobots[data.title]) return;
          global.emit("dragModelStart", {type: "asset", data: {
            DT: loadedRobots[data.title],
            name: data.title,
            type: "model",
          }});
        }
        else global.emit("dragModelStart", {type: "model", data: data});
      },
      exportCustomModel(){  // 导出自定义模型到JSON文件
        try{
          txt = JSON.stringify(customModels.value);
          fs.writeFileSync("src/temp/customModels.txt", txt);
          fileOutput.href = "src/temp/customModels.txt";  // 被下载的文件
          fileOutput.download = "customModels.txt";  // 默认文件名
          fileOutput.click();  
        }
        catch (e) {console.log(e)}
      },
      getIMG(item){  // src为预览时的图片根目录，public/assets为打包后对应的图片根目录
        return new URL(`${
          "../../assets/icons/" + modelData.model_definition[item.title].icon
        }`, import.meta.url).href
      },
      importCustomModel(e){  // 导入自定义模型
        try{
          txt = fs.readFileSync(e.target.files[0].path, "utf-8");
          customModels.value = JSON.parse(txt);
        }
        catch {}
      },
      loadAsset(item){
        let objPath = "src/assets/models/" + item.modelPath;  // 从input选择路径导入
        let mtlPath = objPath.replace(".obj", ".mtl");
        let MTLloader = new MTLLoader();
        let OBJloader = new OBJLoader();
        MTLloader.load(mtlPath, function(material) {
          material.preload();
          OBJloader.setMaterials(material);
          OBJloader.load(objPath, 
            function loaded(mesh){  // 模型加载完成
              setTimeout(function(){  // 过1s后隐藏进度条
                let DT = loadedRobots[item.title] = new DTObject(mesh, false, "model");
                DT.name = item.title;
                DT.scale = item.scale;
                dragAsset.value.title = '';
                dragAsset.value.loading = 0;
              }, 1000);
            },
            function loading(e){  // 模型加载时
              let progress = e.loaded / e.total * 100;
              dragAsset.value.loading = progress;
            },
            function err(){  // 模型读取错误时弹窗，并删除刚创建的模型组件
              alert("模型读取错误");
              this.deleteAsset(dragAsset.value);
              dragAsset.value.title = '';
              dragAsset.value.loading = 0;
            }
          )
        });
      },
      onClick(card){
        let item = JSON.parse(JSON.stringify(modelData.model_definition[card.title]));
        item.title = card.title;
        if(item.label == "robot") {
          if(!loadedRobots[item.title]){
            dragAsset.value.title = item.title;
            dragAsset.value.loading = 0;
            this.loadAsset(item);
          }
        }
      },
      onRightClick(item){  // 在自定义模型上按右键编辑物体名称、物理实体ID或删除物体
        if(!currentModel.value) while(!currentModel.value) currentModel.value = item;
        else this.$nextTick(()=>{currentModel.value = item; currentModel.value});
      },
      saveCustomModel(data){  // 保存自定义模型
        // 根据title补齐basename，或者根据basename补齐title
        data = JSON.parse(JSON.stringify(data));  // 复制data，避免ref变量被改变
        if(!data.title) data.title = data.basename;
        else if(!data.basename) data.basename = data.title;
        if(!data.name) data.name = data.basename;
        if(!data.physicalID) data.physicalID = '0';
        customModels.value.push(data);
        if(!customModelGroup.value.includes("自定义模型"))
          customModelGroup.value.push("自定义模型");
      },
      search(){  // 搜索栏内容改变时
        if(searchValue.value){
          let result = [];
          for(let c1ass of model_layout.value){
            for(let group of c1ass.children){
              for(let item of group.children){
                if(item.title.indexOf(searchValue.value) > -1) {
                  let newItem = Object.assign({group: ''}, item);
                  newItem.group = group.title;
                  result.push(newItem);
                }
              }
            }
          }
          searchResult.value = result;
        }
      },
      searchText(item){  // 搜索匹配文字
        let text = searchValue.value;
        return [
          item.title.substring(0, item.title.indexOf(text)),
          text,
          item.title.substring(item.title.indexOf(text) + text.length),
        ];
      },
    },
    setup() {return {
      activeKeys1, 
      activeKeys2, 
      currentModel,
      customModelGroup,
      customModels,
      dragAsset,
      loadedRobots,
      modelData,
      model_definition: model_definition,
      model_layout,
      searchValue, 
      searchResult
    }},
    mounted(){
      global.on("saveCustomModel", data => this.saveCustomModel(data));
      document.addEventListener("contextmenu", ()=>{currentModel.value = null}, true);
      fileOutput = document.getElementById("fileOutput");
      modelInput= document.getElementById("modelInput");
    }
  }
</script>

<style>
  .model-card {  
    display: flex; 
    width: 110%; 
    height: 50px;
    margin-left: -5%;
    text-align: center;
    white-space: nowrap;
  }  
  .model-collapse{
    border: 1px solid darkgray;
    margin: -14px; 
    user-select: none;
  }
  .model-img {  
    display: flex; 
    width: 100%; 
    height: 100%; 
    object-fit: contain;
  }  
  .model-imgBorder {  
    border-right: 1px solid lightgrey; 
    width: 50px; 
    height: 48px;
    margin-top: -25px;
    margin-left: -20px;
    padding-right: 4px;
  } 
  .model-title {
    font-weight: bold;
    margin-top: -34px; 
    margin-left: 45px;
  }
</style>

<template>
  <input id="modelInput" type="file" accept=".txt" style="display: none;"
  @change="importCustomModel"/> 

  <!--搜索栏-->
  <a-input-search v-model:value="searchValue" placeholder="搜索"
    style="margin-bottom: 8px" @change="search()" @search="()=>{searchValue = ''}">
      <template #enterButton>
        <a-button :disabled="!searchValue" type="primary"><CloseOutlined/></a-button>
      </template>
  </a-input-search>
  <!--模型列表-->
  <a-dropdown :trigger="['contextmenu']">
    <div>
      <!--模型列表-->
      <div v-if="!searchValue">
        <!--内置模型-->
        <a-collapse v-model:activeKey="activeKeys1">
          <a-collapse-panel key="内置模型" header="内置模型" style="white-space: nowrap;">
            <a-collapse v-model:activeKey="activeKeys1" class="model-collapse">
              <a-collapse-panel v-for="c1ass of model_layout" :header="c1ass.title" :key="c1ass.title">
                <a-collapse v-model:activeKey="activeKeys1" class="model-collapse">
                  <a-collapse-panel v-for="group of c1ass.children" 
                    :disabled="!group.children.length"
                    :header="group.title + (group.children.length ? '' : '（无）')" 
                    :key="group.title" 
                    style="text-align: left;"
                  >
                    <a-card v-for="item of group.children" class="model-card" draggable="true" hoverable
                      @click="onClick(item)"
                      @contextmenu="onRightClick(item)"
                      @dragstart="e=>{onClick(item); dragModelStart(e, item)}" 
                      @mousedown="deselect"
                    >
                      <div class="model-imgBorder">
                        <img :src="getIMG(item)" class="model-img" draggable="false"/>
                      </div>
                      <div class="model-title">
                        <span v-if="dragAsset.title==item.title">
                          <div style="color: #AAA; text-align: left;">模型加载中</div>
                          <a-progress style="width:8em; transform:translateY(-0.6em)" 
                          :percent="dragAsset.loading ?? 0" :show-info="false"/>
                        </span>
                        <span v-else>{{item.title}}</span>
                      </div>
                    </a-card>
                  </a-collapse-panel>
                </a-collapse>
              </a-collapse-panel>
            </a-collapse>
          </a-collapse-panel>
        </a-collapse>
        <!--自定义模型-->
        <a-collapse v-model:activeKey="customModelGroup">
          <a-collapse-panel key="自定义模型" 
            :disabled="!Object.keys(customModels).length"
            :header="'自定义模型' + (Object.keys(customModels).length ? '' : '（无）')"
          >
            <a-card v-for="item of customModels" class="model-card" draggable="true" hoverable
              style="justify-content:space-between;" 
              @click="onClick(item)"
              @contextmenu="onRightClick(item)"
              @dragstart="e=>{onClick(item); dragModelStart(e, item)}" 
              @mousedown="deselect"
            >
              <div class="model-imgBorder">
                <img :src="getIMG(item)" class="model-img" draggable="false"/>
              </div>
              <div class="model-title">
                <span v-if="dragAsset.title==item.title">
                  <div style="color: #AAA; text-align: left;">模型加载中</div>
                  <a-progress style="width:8em; transform:translateY(-0.6em)" 
                  :percent="dragAsset.loading ?? 0" :show-info="false"/>
                </span>
                <span v-else>{{item.title + (item.name ? `（${item.name}）` : '')}}</span>
              </div>
            </a-card>
          </a-collapse-panel>
        </a-collapse>
      </div>
      <!--搜索列表-->
      <div v-else>
        <a-card v-if="searchResult.length" v-for="item of searchResult" 
        class="model-card" draggable="true" hoverable style="margin: 0 2.5%; width: 95%"
          @click="onClick(item)"
          @contextmenu="onRightClick(item)"
          @dragstart="e=>{onClick(item); dragModelStart(e, item)}" 
          @mousedown="deselect"
        >
          <div class="model-imgBorder">
            <img :src="getIMG(item)" class="model-img" draggable="false"/>
          </div>
          <div v-for="str of [searchText(item)]" class="model-title">
            <span>{{ str[0] }} </span>
            <span style="color: red; margin-left: 0px;"> {{ str[1] }} </span> 
            <span>{{ str[2] }} </span>
          </div>
        </a-card>
        <a-card v-else style="text-align: center;">
          <div style="margin-top: 10px;">
            <span>无匹配结果</span>
          </div>
        </a-card>
        <a-alert v-else message="无匹配结果" style="width:100%" type="error" />
      </div>
    </div>
    <!--右键菜单-->
    <template #overlay>
      <a-menu @click="action">
        <a-menu-item key="全部展开">全部展开</a-menu-item>
        <a-menu-item key="全部折叠">全部折叠</a-menu-item>
        <hr class="splitH"/>
        <a-menu-item v-if="currentModel && ['sensor', 'WIP'].includes(
          modelData.model_definition[currentModel.title].label
        )" key="添加到自定义模型">
          添加到自定义模型
        </a-menu-item>
        <a-menu-item key="导入自定义模型">导入自定义模型</a-menu-item>
        <a-menu-item key="导出自定义模型">导出自定义模型</a-menu-item>
        <!--编辑自定义模型--> 
        <div v-if="currentModel && currentModel.name">
          <hr class="splitH"/>
          <a-menu-item key="修改模型名称">修改模型名称</a-menu-item>
          <a-menu-item key="修改物理实体ID">修改物理实体ID</a-menu-item>
          <a-menu-item key="删除该模型" danger>删除自定义模型</a-menu-item>
          <a-menu-item key="清空自定义模型" danger>清空自定义模型</a-menu-item>
        </div>
      </a-menu>
    </template>
  </a-dropdown>
</template>
