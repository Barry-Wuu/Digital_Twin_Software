<script lang="ts">
  import { ref } from 'vue'
  import { 
    CheckOutlined,
    CloseOutlined,
    CodeOutlined,
    FileTwoTone,
    FolderOpenTwoTone,
    GiftTwoTone,
    PictureTwoTone,
    RollbackOutlined
  } from "@ant-design/icons-vue"
  import global from "../Global"
  import { DTObject } from "./ThreeScene/DTScene"
  import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js"
  const path = require("path");
  import * as THREE from 'three'

  const activeOptions = ref([]);
  const assets = ref(
    { name: "组件库", type: "root", children:[
      { name: "文件夹", type: "folder", children: [
        { name: "文件夹1", type: "folder", children: [
          { name: "脚本11", type: "code"},
          { name: "材质12", type: "model"},
        ]},
        { name: "文件夹2", type: "folder", children: [
          { name: "材质21", type: "code"},
          { name: "脚本22", type: "model"},
        ]},
        { name: "脚本00", type: "code"},
        { name: "模型01", type: "model"},
      ]},
      { name: "材质", type: "material", option:{color: "white", opacity: 1} },
      { name: "脚本", type: "code"},
    ]}
  );
  var assetInput;
  var create;
  var currentFolder = ref(assets.value);
  var dragAsset = ref();  // 被拖动的组件
  var loadingModel = false;  // 载入模型时禁止再导入其它模型
  const options = ref(["114514"]);
  var Path = ref([assets.value.name]);
  const renamed = ref('');  // 重命名
  var renamingAsset = ref();  // 被重命名的组件
  const Returner = (location, parent)=>{  // 返回标志
    return {location: location, name:"返回", parent: parent, type: "return"};
  };
  const searchedAssets = ref([]);
  const searchValue = ref('');
  const sortMethod = ref("按组件类型排序");
 
  global.on("deselectAsset", ()=>{  // 点击外部则取消选择组件
    dragAsset.value = null;
  })

  export default {
    components:{
      CheckOutlined,
      CloseOutlined,
      CodeOutlined,
      FileTwoTone,
      FolderOpenTwoTone,
      GiftTwoTone,
      PictureTwoTone,
      RollbackOutlined
    },
    methods: {
      action(e){
        let option = e.key;
        if(option == "删除" && dragAsset.value.type != "return"){
          this.deleteAsset(dragAsset.value);
        }
      },
      clickAsset(asset) {  // 单击卡片
        this.rename(false);
        if(dragAsset.value == asset){  // 再次点击则取消选择
          dragAsset.value = null;
        } else {
          dragAsset.value = asset;  // 选择
          if(asset.type == "model"){
            global.emit("showProperty", asset.DT);
          }
          if(asset.type == "return"){
            currentFolder.value = asset.parent;
            Path.value.pop();
            this.sort();
          } 
        }
      },
      createAsset(asset){  // 创建组件
        const dict = {"模型":"model", "材质":"material", "代码":"code", "文件夹":"folder"};
        let current = currentFolder.value;
        let newAsset = {
          createdTime: new Date(),  // 设置创建时间  
          name: this.newName(asset), 
          parent: current, 
          type: dict[asset]
        };
        current.children.push(newAsset);
        dragAsset.value = newAsset;
        if(asset == "模型"){  // 创建组件后将默认名称设为类型名，同时显现重命名输入框
          assetInput.click();
          loadingModel = true;
        }
        else{
          create = true;
          this.startRename();
        }
      },
      deleteAsset(deleteAsset){  // 删除组件
        let current = currentFolder.value;
        current.children = current.children.filter(asset => asset != deleteAsset);
        this.sort();
      },
      doubleClickAsset(asset){  // 双击卡片
        if(asset.type == "folder"){
          currentFolder.value = asset;
          Path.value.push(asset.name);
          this.sort();
        }
        if(asset.type == "material"){return;
          let mesh = new THREE.Mesh(
            new THREE.BoxGeometry(), 
            new THREE.MeshPhongMaterial(asset.children)
          );
        }
      },
      dragStart(e, asset, index){  // 开始拖拽
        dragAsset.value = asset;
        global.emit("dragModelStart", {type: "asset", data: dragAsset.value});
      },
      dropOnCard(e, target){  // 拖拽到文件夹上以放入，拖拽到返回上以放出
        let data = e.dataTransfer;
        if(data.getData("type") != "asset") return;  // 拖拽数据类型校验
        if(dragAsset.value != target && dragAsset.value.type != "return"){;  // 禁止将组件拖入自身或拖拽返回标志
          if(target.type == "folder"){  // 拖到文件夹上
            let children = target.parent.children;
            let popped = children.splice(data.getData("index"), 1);
            target.children.push(popped[0]);
          }
          if(target.type == "return"){  // 拖到返回标志上
            let children = target.location.children;
            let popped = children.splice(data.getData("index"), 1);
            target.parent.children.push(popped[0]);
          }
        }
        dragAsset.value = null;
      },
      dropOnPath(index){  // 拖到路径上
        let current = currentFolder.value;
        let dragged = dragAsset.value;
        let target = this.goto(index, false);
        current.children.splice(current.children.indexOf(dragged), 1);
        target.children.push(dragged);
        dragAsset.value = null;
        this.sort();
      },
      dropOnSplit(e, index){  // 拖拽到排序条上排序
        this.hide(e);
        if(dragAsset.value.type != "return"){
          let current = currentFolder.value.children;
          let source = current.indexOf(dragAsset.value), target = index;
          if(target > source) target --;
          // 将数组的第a个元素移动到第b号位
          const element = current.splice(source, 1)[0]; // 从原来的位置取出元素
          current.splice(target, 0, element); // 在新的位置插入元素
          this.sort();
        }
        dragAsset.value = null;
      },
      goto(index, jump=true){  // 点击路径即可跳转
        let target = assets.value;
        for(let i=1; i<=index; i++){
          for(let child of target.children){
            if(child.type == "folder" && child.name == Path.value[i]){
              target = child;
              break;
            }
          }
        }
        if(jump){
          currentFolder.value = target;
          Path.value = Path.value.slice(0, index+1);
          this.sort();
        } else {
          return target;
        }   
      },
      hide(e){  // 隐藏排序条
        e.target.style.opacity = 0;
      },
      loadAsset(e){
        let path0 = e.target.files[0].path;  // 从input选择路径导入
        path0 = path0.slice(path0.indexOf("src"));
        let newAsset = dragAsset.value;
        newAsset.loading = 0;
        newAsset.name = this.newName(path.basename(path0, path.extname(path0)), newAsset.name);
        let OBJloader = new OBJLoader();
        OBJloader.load(path0, 
          function loaded(mesh){  // 模型加载完成
            let index = currentFolder.value.children.indexOf(newAsset);
            newAsset = currentFolder.value.children[index];  // 使loading更新可被检测
            setTimeout(function() {  // 过1s后隐藏进度条
              delete newAsset.loading;
              newAsset.DT = new DTObject(mesh, false, newAsset.type);
              newAsset.DT.name = newAsset.name;
              newAsset.DT.scale = 20;
              loadingModel = false;
            }, 1000)
          }, 
          function loading(e){  // 模型加载时
            let index = currentFolder.value.children.indexOf(newAsset);
            newAsset = currentFolder.value.children[index];  // 使loading更新可被检测
            let progress = e.loaded / e.total * 100;
            newAsset.loading = progress;
          },
          function err(){  // 模型读取错误时弹窗，并删除刚创建的模型组件
            alert("模型读取错误");
            this.deleteAsset(dragAsset.value);
            loadingModel = false;
          }
        )
      },
      newName(name, originalName=null){  
        // 求不重名且序号最小的新名字，如name→name(1)→name(2)→……
        // 若重名组件也有数字和括号，则将重命名结尾的数字（index）和括号取出并自增，直到无重名组件为止
        let basename = name, newName = name, index = 1; 
        let content = currentFolder.value.children;
        if(name == originalName) return name;  // 未改名则返回原名
        if(!content.filter(asset => asset.name == name).length) return name;  // 未重名则返回新名
        let match = name.match(/\([0-9]*\)$/);
        let matched = match ? parseInt(match[0].slice(1, -1)) : null;
        if(matched){
          basename = basename.slice(0, -match[0].length);  // basename为去掉末尾序号的组件名
          index = matched;
        }
        // 如果新名≠basename或basename存在，则加序号和括号
        if(newName != basename || content.filter(asset => asset.name == basename).length){
          newName = `${basename}(${index})`;
          while(content.filter(asset => asset.name == newName && 
          newName != originalName).length){
            newName = `${basename}(${index})`;
            index++;
          }
        }
        return newName;
      },
      onRightClick(asset){  // 右键点击卡片
        dragAsset.value = asset.type=="return" ? null : asset;
      },
      printCreatedTime(){  // 显示组件创建时间
        function pad(x, n=2) {return x.toString().padStart(n, '0')}
        let time = dragAsset.value.createdTime;
        alert("创建时间：" + time.getFullYear() + '/' 
            + pad(time.getMonth() + 1) + '/'
            + pad(time.getDate()) + ' '
            + time.toTimeString().split(' ')[0] + '.'
            + pad(time.getMilliseconds(), 3)
        );
      },
      rename(cancelDrag=true){  // 完成重命名
        let renaming = renamingAsset.value;
        if(cancelDrag) dragAsset.value = null; 
        if(create || renamed.value && renamed.value != renaming.name){  // 新旧名字相同则返回
          global.emit("deselect");  // 点击组件则取消选择外部
          let name = this.newName(renamed.value, renaming.name);  // 计算不重复的新名称
          if(currentFolder.value.children.filter(  // 如果名称重复则弹出重命名窗口
            asset => asset.name == renamed.value && asset != renamingAsset.value
          ).length){
            global.emit("popup", {  // 弹窗询问是否重命名
              type: "yes_no",
              content: `组件“${renamed.value}”已存在。\r确定将其重命名吗？`,
              yes: ()=>{  // 确认重命名
                renaming.name = name;
                if(renaming.DT) {renaming.DT.name = name} 
                renamed.value = renamingAsset.value = null; 
                create = false;
                this.sort();
              },
              no: ()=>{},  // 取消重命名
            });
            return;
          }
          renaming.name = name;  // 将数字自增后确认重命名
          if(renaming.DT) {renaming.DT.name = name} 
        }
        renamed.value = renamingAsset.value = null; 
        create = false;
        this.sort();
      },
      search(){  // 搜索
        let result = searchedAssets.value;
        result.length = 0;
        let input = searchValue.value;
        function traverse(asset){
          for(let child of asset.children){
            if(child.name.indexOf(input)>-1 && child.type != "folder" && child.type != "return"){
              result.push(child)
            };
            if(child.children) traverse(child); 
          }
        }
        traverse(assets.value);
        this.sort(null, result);
      },
      setAssets(asset){  // 初始化组件
        for(let child of asset.children){
          child.createdTime = new Date();  // 设置创建时间  
          if(child.children){  // 添加父对象，以便从文件夹中返回上一级
            this.setAssets(child);
            child.parent = asset;
            child.children.unshift(Returner(child, asset));
          }
        }
      },
      show(e){  // 显示排序条
        e.target.style.opacity = 1;
      },
      sort(newMode=null, current=currentFolder.value.children){  // 将组件进行排序
        if(newMode) sortMethod.value = newMode;
        let mode = sortMethod.value;
        if(mode == "按组件名排序"){
          current.sort((a, b)=>{  // 结果为正代表a排在后面，反之亦然
            if(a.type != b.type){
              if(a.type == "return") return -1;  // 返回标志排在最前面
              if(b.type == "return") return 1;
              if(a.type == "folder") return -1;  // 其次是文件夹排在前面
              if(b.type == "folder") return 1;
            }
            // 文件夹之间以及其它组件之间按名称和拼音排序
            return a.name.localeCompare(b.name, 'zh-cn', {sensitivity:'accent'});
          });
        }
        if(mode == "按组件类型排序"){
          current.sort((a, b)=>{  // 结果为正代表a排在后面，反之亦然
            if(a.type != b.type){  // 先按类型名排序
              if(a.type == "return") return -1;  // 返回标志排在最前面
              if(b.type == "return") return 1;
              if(a.type == "folder") return -1;  // 其次是文件夹排在前面
              if(b.type == "folder") return 1;
              return a.type > b.type? 1 : -1;
            } else {  
              // 类型相同按名称和拼音排序
              return a.name.localeCompare(b.name, 'zh-cn', {sensitivity:'accent'});
            }
          });
        }
      },
      startRename(){  // 开始重命名
        renamingAsset.value = dragAsset.value; 
        renamed.value = dragAsset.value.name; 
        this.$nextTick(()=>{  // 自动选中所有文本
          document.getElementById("assetRenamer").select();
        })
      }
    },
    setup() {return {currentFolder, dragAsset, loadingModel,
      Path, renamed, renamingAsset, searchedAssets, searchValue, sortMethod}},
    mounted(){  // 加载完成时
      assetInput = document.getElementById("assetInput");
      this.setAssets(assets.value);
      this.sort();
      window.addEventListener("keydown", e=>{
        if(searchValue.value) return;
        if(e.key == "Delete"){  // 按Delete键删除组件
          this.action({key:"删除"});
        }
        if(e.key == "F2"){  // 按F2开始重命名
          this.startRename();
        }
        if(e.key == "Enter"){   // 按Enter结束重命名
          this.rename();
        }
      })
    }
  }
</script>

<style>
  #assets {display: flex; margin-left:5px; margin-top:-8px; flex-wrap: wrap;}
  #assetRenamer{
    margin-left:-36%; 
    width:140%; 
    text-align: center;
  }
  .card{
    width: 80px;
    height: 80px;
    margin-top: 10px;
    text-align: center;
  }
  .content {position: absolute; left:20px; top:12px} 
  .icon {font-size:40px;}
  .split {background-color:dodgerblue; opacity:0; width:5px;}
</style>

<template>
  <!--隐藏的文件选择器input和下载器a，用于导入和导出文件-->
  <div style="display: none;">   
    <input id="assetInput" type="file" accept=".obj" @change="loadAsset"/>
  </div>
  <!--文件路径显示与搜索框-->
  <div style="display: flex; margin-left: 1em">
    <!--文件路径显示-->
    <a-breadcrumb style="margin-top:6px; width:calc(100% - 210px);">
      路径：
      <a-breadcrumb-item v-for="(node, index) of Path">
        <a :style="index==Path.length-1 ? {'color': 'black'} : {}"
        @dragenter.prevent @dragover.prevent 
        @click="()=>{if(index != Path.length-1) goto(index)}"
        @drop="dropOnPath(index)">
          {{ node }}
        </a>
      </a-breadcrumb-item>
    </a-breadcrumb>
    <!--搜索框-->
    <a-input-search v-model:value="searchValue" placeholder="搜索" style="width:200px" 
    @change="search" @search="()=>{searchValue = ''}">
      <template #enterButton>
        <a-button :disabled="!searchValue" type="primary"><CloseOutlined/></a-button>
      </template>
    </a-input-search>
  </div>
  <div style="background-color:lightgrey; margin:10px; height:1px;"/>
  <!--组件库-->
  <a-dropdown :trigger="['contextmenu']" @click="rename">
    <span id="assets" @dragenter.prevent @dragover.prevent @drop="dragAsset=null">
      <!--默认-->
      <div v-if="!searchValue" v-for="(asset, index) of currentFolder.children" 
      style="display: flex;">
        <!--拖拽排序条-->
        <div v-if="asset.type!='return'" class="split" @dragenter.prevent @dragover.prevent 
        @dragenter="show" @drop="e=>dropOnSplit(e, index)" @dragleave="hide"/>
        <!--加载中卡片-->
        <a-card v-if="asset.loading" class="card">
          <span class="content" style="margin-top:11px;">
            <a-progress :percent="asset.loading" :show-info="false"
            />
            <div style="margin-bottom: 10px; text-align: center;">
              {{ asset.name }}
            </div>
          </span>    
        </a-card>
        <!--加载完成卡片-->
        <a-card v-else :draggable="asset!=renamingAsset" class="card" hoverable 
        :style="{'background': asset==dragAsset ? '#E6F4FF' : 'white'}"
        @click.stop @dragenter.prevent @dragover.prevent
        @click="clickAsset(asset)" 
        @contextmenu="onRightClick(asset)"
        @dblclick="doubleClickAsset(asset);"
        @dragstart="e=>{dragStart(e, asset, index)}"
        @drop="e=>dropOnCard(e, asset)"
        >
          <span class="content">
            <RollbackOutlined v-if="asset.type == 'return'" class="icon" style="color:red"/>
            <FolderOpenTwoTone v-else-if="asset.type == 'folder'" class="icon" twoToneColor="olive"/>
            <CodeOutlined v-else-if="asset.type == 'code'" class="icon" twoToneColor="black"/>   
            <PictureTwoTone v-else-if="asset.type == 'material'" class="icon" twoToneColor="blue"/>    
            <GiftTwoTone v-else-if="asset.type == 'model'" class="icon" twoToneColor="grey"/>
            <FileTwoTone v-else class="icon"/>
            <div v-if="asset!=renamingAsset" style="text-align: center;">
              {{ asset.name }}
            </div>
            <!--重命名输入框-->
            <a-input v-else v-model:value="renamed" id="assetRenamer"
            @click.stop @dblclick.stop @dragstart.stop @dragover.stop/>
          </span>    
        </a-card>
      </div>
      <!--搜索时-->
      <div v-else v-for="asset of searchedAssets" style="display:flex;">
        <!--无效拖拽排序条-->
        <div class="split"/>
        <!--卡片-->
        <a-card :draggable="asset!=renamingAsset" hoverable class="card"
        :style="{'background': asset==dragAsset ? '#E6F4FF' : 'white'}"
        @click.stop
        @click="clickAsset(asset)"
        @dblclick="doubleClickAsset(asset);"
        >
          <span class="content">
            <RollbackOutlined v-if="asset.type == 'return'" class="icon" style="color:red"/>
            <FolderOpenTwoTone v-else-if="asset.type == 'folder'" class="icon" twoToneColor="olive"/>
            <CodeOutlined v-else-if="asset.type == 'code'" class="icon" twoToneColor="black"/>   
            <PictureTwoTone v-else-if="asset.type == 'material'" class="icon" twoToneColor="blue"/>    
            <GiftTwoTone v-else-if="asset.type == 'model'" class="icon" twoToneColor="grey"/>
            <FileTwoTone v-else class="icon"/>
            <div style="text-align: center;">
              <span>{{ asset.name.substring(0, asset.name.indexOf(searchValue)) }}</span>
              <span style="color: red"><strong>{{ searchValue }}</strong></span>
              <span>
                {{ asset.name.substring(asset.name.indexOf(searchValue) + searchValue.length) }}
              </span>
            </div>
          </span>    
        </a-card>
      </div>
      <!--末尾拖拽排序条-->
      <div v-if="!searchValue" class="split" @dragenter.prevent @dragover.prevent @dragenter="show"
      @drop="e=>dropOnSplit(e, currentFolder.children.length)" @dragleave="hide"/>
      <!--末尾无效拖拽排序条-->
      <div v-else class="split"/>
    </span>
    <!--右键菜单-->
    <template #overlay>
      <a-menu @click="action">
        <!--导入-->
        <a-sub-menu title="导入" :disabled="loadingModel">
          <a-menu-item v-for="asset in ['模型','材质']" :key="asset" 
          @click="createAsset(asset)">
            {{asset}}
          </a-menu-item>
        </a-sub-menu>
        <!--新建-->
        <a-sub-menu title="新建">
          <a-menu-item v-for="asset in ['文件夹','代码']" :key="asset" 
          @click="createAsset(asset)">
            {{asset}}
          </a-menu-item>
        </a-sub-menu>
        <!--重命名-->
        <a-menu-item key="重命名" :disabled="!dragAsset" @click="startRename">
          重命名
        </a-menu-item>
        <!--排序方式-->
        <a-sub-menu title="排序方式">
          <a-menu-item v-for="mode in ['无','按组件名排序（文件夹在前）','按组件类型排序']" 
          :disabled="sortMethod==mode" :key="mode" @click="sort(mode)">
            {{mode}}
            <CheckOutlined v-if="sortMethod==mode"/>
          </a-menu-item>
        </a-sub-menu>
        <!--创建时间-->
        <a-menu-item key="创建时间" :disabled="!dragAsset" @click="printCreatedTime">
          创建时间
        </a-menu-item>
        <!--删除-->
        <a-menu-item key="删除" :disabled="!dragAsset">删除</a-menu-item>
      </a-menu>
    </template>
  </a-dropdown>
</template>