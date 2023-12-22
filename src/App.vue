<script lang="ts" setup>
  import { onMounted, ref} from 'vue'
  import { DndProvider } from 'vue3-dnd'
  import { HTML5Backend } from 'react-dnd-html5-backend'
  import Container from './components/Container.vue'
  import Models from './components/Models.vue'
  import Menu from './components/Menu.vue'
  import Navbar from './components/Navbar.vue'
  import Three from './components/ThreeScene/ThreeScene.vue'
  import Tree from './components//Tree.vue'
  import "ant-design-vue"
  import { UserOutlined, DownOutlined } from '@ant-design/icons-vue';
  function Goto(event, tabName) { // 切换栏目
    var pages = document.getElementsByClassName("page");
    for (var i = 0; i < pages.length; i++) {
      pages[i].style.display = "none";
    }
    document.getElementById(tabName).style.display = "block";
  }
  var mouse;
  var tabHeight = 28
  var windows: { [key: string]: any } = {}
  var winSize = ["0%", "0%"]

  interface Window{direction:string; sizes: number[]; children:[]};
  const wl: Window = {
    direction: 'col',
    sizes: [50,50],
    children: [["模型"],["层级"]]
  };
  const wm: Window = {
    direction: 'col',
    sizes: [67,33],
    children: [["场景"],["资源","控制台"]]
  };
  const w0: Window = {
    direction: 'row',
    sizes: [25,50,25],
    children:[wl, wm , ["属性"]]
  };

  function changeWindow(ID){  //切换栏目
    var children = findChildren(ID, w0);
    for(let j=0; j<children.length; j++){
      windows[children[j]].style.display = children[j] == ID ? "block" : "none";
    }
  }
  function createWindow(window: Window){
    var div = document.createElement('div');  //板块组
    if(window.direction == "row"){div.style.display = "flex";}
    var arr = []
    for(let i=0; i<window.children.length; i++){
      //if(i>0){var div1 = div0;}
      let div0;
      if(i>0){
        var puller = document.createElement('div');  // 拖动杆
        puller.style.border = "solid dodgerblue 2px"
        if(window.direction == "row"){  // 左右拖动杆
          puller.style.cursor = "e-resize"
          puller.style.margin = "1px"
          puller.style.width = "5px"
          puller.style.height = "100%"
          puller.addEventListener("dragstart", function(){
            mouse = event.clientX
            winSize = [arr[i-1].style.width, div0.style.width]
          });
          puller.ondrag = function(){resize(mouse, "row", arr[i-1], div0)};
        }
        if(window.direction == "col"){  // 上下拖动杆
          puller.style.cursor = "n-resize"
          puller.style.margin = "1px"
          puller.style.width = "100%"
          puller.style.height = "5px"
          puller.addEventListener("dragstart", function(){
            mouse = event.clientY
            winSize = [arr[i-1].style.height, div0.style.height]
          });
          puller.ondrag = function(){resize(mouse, "col", arr[i-1], div0)};
        }    
        div.appendChild(puller)
      }
      if(typeof(window.children[i][0]) != "string"){
        div0 = createWindow(window.children[i]);  //子级板块组
        if(window.direction == "row"){div0.style.width = `${window.sizes[i]}%`}
        if(window.direction == "col"){div0.style.height = `${window.sizes[i]}%`}
      }else{
        div0 = document.createElement('div');  //板块
        div0.style.overflow = "scroll scroll"
        if(window.direction == "row"){
          div0.style.width = `${window.sizes[i]}%`
          div0.style.height = "100%"
        }
        if(window.direction == "col"){div0.style.height = `${window.sizes[i]}%`}
        div0.style.border = "1px solid black"

        var divhead = document.createElement('div');  //板块头部
        divhead.style.background = "lightgrey"
        divhead.style.display="flex"
        divhead.style.width="width:100%"
        for (let j=0; j<window.children[i].length; j++){
          var buttonlabel = document.createElement('button');  //板块栏目
          //sdivlabel:ref = "draggable";
          //divlabel:style = "{ opacity }"
          buttonlabel.style.background = "white"
          buttonlabel.style.border = "1px solid black"
          buttonlabel.style.padding = "2px"
          buttonlabel.style.userSelect = "none"
          buttonlabel.style.width = "100px"
          buttonlabel.textContent = window.children[i][j];
          buttonlabel.addEventListener("click", function(){changeWindow(window.children[i][j])});  //点击栏目切换板块
          divhead.appendChild(buttonlabel);
        } 
        div0.appendChild(divhead)

        for (let j=0; j<window.children[i].length; j++){  //板块内容
          var divContent = document.createElement('div');
          divContent.style.height = "100%"
          var ID = window.children[i][j]
          divContent.id = ID
          divContent.style.display = j==0 ? "block" : "none"
          if(ID == "模型"){
            divContent.appendChild(document.getElementById("page1"))
          }else if(ID == "层级"){
            divContent.appendChild(document.getElementById("page2"))
          }else if(ID == "场景"){
            divContent.appendChild(document.getElementById("page3"))
          }else if(ID == "资源"){
            divContent.appendChild(document.getElementById("page4"))
          }else if(ID == "控制台"){
            divContent.appendChild(document.getElementById("page5"))
          }else if(ID == "属性"){
            divContent.appendChild(document.getElementById("page6"))
          }else{
            divContent.textContent = divContent.id + "的内容"
          }
          div0.appendChild(divContent)
          windows[ID] = divContent
        }
      }
      div.appendChild(div0)
      arr.push(div0)
    }
    return div;
  }
  function findChildren(ID, object){  //在窗口中寻找含有名为ID的栏目的板块
    var result = 0;
    if(object.children){
      for (let j=0; j<object.children.length; j++){
        result = findChildren(ID, object.children[j]);
        if(result) return result;
      }
    }else{
      if(object.includes(ID))return object;
    }
    return result;
  }
  const getIMG = path => {  // src为预览时的图片根目录，public/assets为打包后对应的图片根目录
    return new URL(`${path}`, import.meta.url).href
  };
  function print(str){  // 在控制台上显示信息
    windows["控制台"].textContent = str
  }
  function resize(m, dir, i0, i1){  // 拖动改变板块尺寸
    if(dir == "row"){
      var delta = event.clientX - m;
      i0.style.width = `${parseInt(winSize[0]) + delta/4}%`;
      i1.style.width = `${parseInt(winSize[1]) - delta/4}%`;
    }
    if(dir == "col"){
      var delta = event.clientY - m;
      i0.style.height = `${parseInt(winSize[0]) + delta/4}%`;
      i1.style.height = `${parseInt(winSize[1]) - delta/4}%`;
    }
  }
  onMounted(() => {  // 加载完成时
    const menu = createWindow(w0);
    menu.style.overflow = "hidden hidden"
    menu.id = "menu";
    menu.style.width = `${window.innerWidth-8}px`;
    menu.style.height = `${window.innerHeight-8}px`;
    window.addEventListener('resize', function() {
      menu.style.width = `${window.innerWidth-8}px`;
      menu.style.height = `${window.innerHeight-8}px`;
    })
    document.getElementById("id0").appendChild(menu)

    var keys = Object.keys(windows);  // 调整板块尺寸
    for(let i=0; i<keys.length; i++){
      let item = windows[keys[i]]
      item.style.height = `${item.parentNode.offsetHeight - tabHeight}px`
    }
  })
</script>

<style>
  .border {border:3px solid black}
  .flex-center {
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .left { position: absolute; left: 0;  } 
  .leftText{text-align:left}
  .logo {
    height: 6em;
    padding: 1.5em;
    will-change: filter;
    transition: filter 300ms;
  }
  .logo.electron:hover {filter: drop-shadow(0 0 2em #9FEAF9);}
  .logo:hover {filter: drop-shadow(0 0 2em #646cffaa);}
  .logo.vue:hover {filter: drop-shadow(0 0 2em #42b883aa);}
  .navbar {  
    overflow: hidden;   
    border:3px solid black;
    background-color: #EEE; 
    display: flex;
    justify-content: space-between;
    width:100%
  }  
  .navbar a {  
    float: left;  
    color: black;  
    text-align: center;  
    padding: 8px 8px;  
    text-decoration: none;  
  }  
  .navbar a:hover {  
    background-color: dodgerblue;  
    color: white 
  }  
  .split0{border:0px solid black;}
  .split{border:1px solid black;}
  .up { position: absolute; top: 0;}   
</style>

<template>
  <div class="left up" style = "width:{window.innerWidth}">
    <Navbar></Navbar>
    <div id="main">  
      <div style="margin:3px" id="id0">
      </div>
      <!--模型-->
      <div id="page1" class="page">
        <Models :getIMG="getIMG"/>
        <div class="flex-center">
        </div>
      </div>
      <!--层级-->
      <div id="page2">  
        <Tree/>
      </div>  
      <!--场景-->
      <div id="page3">  
        <Menu style="width:100%"/>  
        <Three style="border:3px solid black"/>
      </div>  
      <!--资源-->
      <div id="page4">  
        <DndProvider :backend="HTML5Backend">
          <Container/>
        </DndProvider>
      </div> 
      <!--控制台-->
      <div id="page5">  
      </div> 
      <!--属性-->
      <div id="page6">  
        <h2 class="leftText">a-button</h2>
        <a-button type="primary">Primary Button</a-button>
        <a-button>Default Button</a-button>
        <a-button type="dashed">Dashed Button</a-button>
        <a-button type="text" danger>Text Button</a-button>
        <a-button type="link" >Link Button</a-button>
        <h2 class="leftText">a-cascader</h2>
        <Menu/>
        <h2 class="leftText">a-input</h2>
        <Input/>
        <h2 class="leftText">a-slider</h2>
        <a-slider step=10></a-slider>
      </div>  
    </div>  
  </div>
</template>