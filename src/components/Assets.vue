<script lang="ts" setup>
  import { ref, onMounted, watch } from 'vue'
  import { 
    CheckOutlined,
    CloseOutlined,
    CodeOutlined,
    FileTwoTone,
    FolderOpenTwoTone,
    GiftTwoTone,
    PictureTwoTone,
    RollbackOutlined
  } from '@ant-design/icons-vue'
  import BUS from "./EventBus"
  import DTScene from './ThreeScene/DTScene'
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
      { name: "模型1", type: "model"},
      { name: "模型2", type: "model"},
      { name: "模型3", type: "model"},
      { name: "模型4", type: "model"},
      { name: "模型5", type: "model"},
    ]}
  );
  var currentFolder = ref(assets.value);
  var dragAsset = ref();  // 被拖动的组件
  const options = ref(["114514"]);
  var Path = ref([assets.value.name]);
  const renamed = ref('');  // 重命名
  var renamingAsset = ref(false);  // 被重命名的组件
  const Returner = (location, parent)=>{  // 返回标志
    return {location: location, name:"返回", parent: parent, type: "return"};
  };
  const searchedAssets = ref([]);
  const searchValue = ref('');
  const sortMethod = ref("按组件类型排序");

  BUS.on("deselectAsset", ()=>{  // 点击外部则取消选择组件
    dragAsset.value = null;
  })

  function action(e){
    let current = currentFolder.value, option = e.key;
    if(option == "新建文件夹") createAsset("文件夹");
    if(option == "删除" && dragAsset.value.type != "return"){
      current.children = current.children.filter(asset => asset != dragAsset.value);
      sort();
    }
  }
  function clickAsset(asset) {  // 单击卡片
    rename(false);
    if(dragAsset.value == asset){  // 再次点击则取消选择
      dragAsset.value = null;
    } else {
      dragAsset.value = asset;
      if(asset.type == "return"){
        currentFolder.value = asset.parent;
        Path.value.pop();
        sort();
      }
    }
  }
  function createAsset(asset){  // 创建组件
    const dict = {"模型":"model", "材质":"material", "代码":"code", "文件夹":"folder"};
    let assetName = asset, index = 1;  // 若新文件夹名称重复，则加上最小的不重复文件夹的序号
    let current = currentFolder.value;
    while(current.children.filter(asset => asset.name==assetName).length){
      assetName = asset + index;
      index++;
    }
    let newAsset = { name: assetName, parent: current, type: dict[asset]};
    newAsset.children = [Returner(newAsset, current)];
    current.children.push(newAsset);
    sort();
  }
  function doubleClickAsset(asset){  // 双击卡片
    if(asset.type == "folder"){
      currentFolder.value = asset;
      Path.value.push(asset.name);
      sort();
    }
    if(asset.type == "material"){return;
      let mesh = new THREE.Mesh(
        new THREE.BoxGeometry(), 
        new THREE.MeshPhongMaterial(asset.children)
      );
      let DT = new DTScene.DTObject(mesh, inScene=false);
      window.asset = DT;
      BUS.emit("showProperty", "asset");
    }
  }
  function dragStart(e, asset, index){  // 开始拖拽
    let data = e.dataTransfer;
    dragAsset.value = asset;
    data.setData("type", "asset");
    data.setData("index", index);
  }
  function dropOnCard(e, target){  // 拖拽到文件夹上以放入，拖拽到返回上以放出
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
  }
  function dropOnPath(index){
    let current = currentFolder.value;
    let dragged = dragAsset.value;
    let target = goto(index, false);
    current.children.splice(current.children.indexOf(dragged), 1);
    target.children.push(dragged);
    dragAsset.value = null;
    sort();
  }
  function dropOnSplit(e, index){  // 拖拽到排序条上排序
    hide(e);
    let data = e.dataTransfer;
    if(data.getData("type") != "asset") return;  // 拖拽数据类型校验
    if(dragAsset.value.type != "return"){
      let source = parseInt(data.getData("index")), target = index;
      if(target > source) target --;
      // 将数组的第a个元素移动到第b号位
      let arr = currentFolder.value.children;
      const element = arr.splice(source, 1)[0]; // 从原来的位置取出元素
      arr.splice(target, 0, element); // 在新的位置插入元素
      sort();
    }
    dragAsset.value = null;
  }
  function goto(index, jump=true){  // 点击路径即可跳转
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
      sort();
    } else {
      return target;
    }   
  }
  function hide(e){  // 隐藏排序条
    e.target.style.opacity = 0;
  }
  function onRightClick(asset){  // 右键点击卡片
    dragAsset.value = asset.type=="return" ? null : asset;
  }
  function rename(cancelDrag = true){  // 完成重命名
    BUS.emit("deselect");  // 点击组件则取消选择外部
    if(cancelDrag) dragAsset.value = null; 
    if(renamed.value && renamed.value != renamingAsset.value.name){  // 新旧名字相同则返回
      let content = currentFolder.value.children, renaming = renamingAsset.value;
      if(!content.filter(asset => asset.name == renamed.value).length){
        renaming.name = renamed.value;
      } else {  // 若有重名文件夹，则将重命名结尾的数字（index）取出并自增，直到无重名文件夹为止
        let basename = renamed.value, folderName = renamed.value, index = 1, 
          match = renamed.value.match(/([0-9]+)$/);
        if(match){
          basename = basename.slice(0, -match[0].length);
          index = parseInt(match);
        }
        folderName = basename + index;
        while(content.filter(asset => folderName==asset.name && 
        folderName!=renamingAsset.value.name).length){
          folderName = basename + index;
          index++;
        }
        renamingAsset.value.name = folderName;  // 将数字自增后确认重命名
      }
    }
    renamed.value = renamingAsset.value = null;
    sort();
  }
  function search(){  // 搜索
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
    sort(null, result);
  }
  function setGotoParent(asset){  // 添加父对象，以便从文件夹中返回上一级
    for(let child of asset.children){
      if(child.children){
        setGotoParent(child);
        child.parent = asset;
        child.children.unshift(Returner(child, asset));
      }
    }
  }
  function show(e){  // 显示排序条
    e.target.style.opacity = 1;
  }
  function sort(newMode=null, current=currentFolder.value.children){  // 将组件进行排序
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
        return a.name > b.name ? 1 : -1;  // 文件夹之间以及其它组件之间按名称排序
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
        } else {  // 类型相同按名称排序
          return a.name > b.name ? 1 : -1;
        }
      });
    }
  }
  function startRename(){  // 开始重命名
    renamingAsset.value = dragAsset.value; 
    renamed.value = dragAsset.value.name; 
    dragAsset.value = null;
  }
  // 加载完成时
  onMounted(()=>{
    setGotoParent(assets.value);
    sort();
    window.addEventListener("keydown", (e)=>{
      if(searchValue.value) return;
      if(e.key == "Delete"){  // 按Delete键删除组件
        action({key:"删除"});
      }
      if(e.key == "F2"){  // 按F2开始重命名
        startRename();
      }
      if(e.key == "Enter"){   // 按Enter结束重命名
        rename();
      }
    })
  });
</script>

<style>
  #assets {display: flex; margin-left:5px; margin-top:-8px; flex-wrap: wrap;}
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
      style="display:flex;">
        <!--拖拽排序条-->
        <div class="split" v-if="asset.type!='return'" @dragenter.prevent @dragover.prevent 
        @dragenter="show" @drop="(e)=>dropOnSplit(e, index)" @dragleave="hide"/>
        <!--卡片-->
        <a-card :draggable="asset!=renamingAsset" hoverable class="card"
        :style="{'background': asset==dragAsset ? '#E6F4FF' : 'white'}"
        @click.stop @dragenter.prevent @dragover.prevent
        @click="clickAsset(asset)" 
        @contextmenu="onRightClick(asset)"
        @dblclick="doubleClickAsset(asset);"
        @dragstart="(e)=>{dragStart(e, asset, index)}"
        @drop="(e)=>dropOnCard(e, asset)"
        >
          <span class="content">
            <RollbackOutlined v-if="asset.type == 'return'" class="icon" style="color:red"/>
            <FolderOpenTwoTone v-else-if="asset.type == 'folder'" class="icon" twoToneColor="olive"/>
            <CodeOutlined v-else-if="asset.type == 'code'" class="icon" twoToneColor="black"/>   
            <PictureTwoTone v-else-if="asset.type == 'material'" class="icon" twoToneColor="blue"/>    
            <GiftTwoTone v-else-if="asset.type == 'model'" class="icon" twoToneColor="grey"/>
            <FileTwoTone v-else class="icon"/>
            <div v-if="asset!=renamingAsset" style="text-align: center;">{{ asset.name }}</div>
            <a-input v-else v-model:value="renamed" @click.stop @dragstart.stop @dragover.stop
            style="margin-left:-36%; width:140%"/>
          </span>    
        </a-card>
      </div>
      <!--搜索时-->
      <div v-else v-for="asset of searchedAssets" style="display:flex;">
        <!--拖拽排序条-->
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
      <div class="split"/>
    </span>
    <!--右键菜单-->
    <template #overlay>
      <a-menu @click="action">
        <!--新建组件-->
        <a-sub-menu key="新建组件" title="新建组件">
          <a-menu-item v-for="asset in ['模型','材质','代码']" :key="asset" 
          @click="createAsset(asset)">
            {{asset}}
          </a-menu-item>
        </a-sub-menu>
        <!--新建文件夹-->
        <a-menu-item key="新建文件夹">新建文件夹</a-menu-item>
        <!--重命名-->
        <a-menu-item key="重命名" :disabled="!dragAsset" @click="startRename">
          重命名
        </a-menu-item>
        <!--排序方式-->
        <a-sub-menu key="排序方式" title="排序方式">
          <a-menu-item v-for="mode in ['无','按组件名排序','按组件类型排序']" 
          :disabled="sortMethod==mode" :key="mode" @click="sort(mode)">
            {{mode}}
            <CheckOutlined v-if="sortMethod==mode"/>
          </a-menu-item>
        </a-sub-menu>
        <!--删除-->
        <a-menu-item key="删除" :disabled="!dragAsset">删除</a-menu-item>
      </a-menu>
    </template>
  </a-dropdown>
</template>