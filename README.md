<!-- 双语切换：VS Code / 支持 HTML 的预览器中可点按切换；GitHub/GitCode 等会降级为双语并排显示 -->
<input type="radio" name="lang" id="tab-zh" checked>
<input type="radio" name="lang" id="tab-en">

<div align="center">

<label for="tab-zh">🇨🇳 中文</label>
&nbsp;&nbsp;|&nbsp;&nbsp;
<label for="tab-en">🇬🇧 English</label>

</div>

<style>
.lz, .le { display: none; }
#tab-zh:checked ~ .lz { display: block; }
#tab-en:checked ~ .le { display: block; }
input[name="lang"] { position: absolute; opacity: 0; pointer-events: none; }
</style>

<div align="center" class="lz">

# 离散制造车间数字孪生软件

**基于 Vue 3 · Three.js · Rapier.js · Electron 的桌面端数字孪生平台**

[![License](https://img.shields.io/badge/license-SCUT-blue.svg)](./LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows-0078D4.svg)](https://www.microsoft.com/windows)
[![Vue](https://img.shields.io/badge/frontend-Vue%203-42b883.svg)](https://vuejs.org)
[![Three.js](https://img.shields.io/badge/3D-Three.js-black.svg)](https://threejs.org)
[![Electron](https://img.shields.io/badge/desktop-Electron-47848f.svg)](https://www.electronjs.org)

</div>

<div align="center" class="le">

# Digital Twin Software for Discrete Manufacturing Workshops

**A desktop digital-twin platform built on Vue 3 · Three.js · Rapier.js · Electron**

[![License](https://img.shields.io/badge/license-SCUT-blue.svg)](./LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows-0078D4.svg)](https://www.microsoft.com/windows)
[![Vue](https://img.shields.io/badge/frontend-Vue%203-42b883.svg)](https://vuejs.org)
[![Three.js](https://img.shields.io/badge/3D-Three.js-black.svg)](https://threejs.org)
[![Electron](https://img.shields.io/badge/desktop-Electron-47848f.svg)](https://www.electronjs.org)

</div>

---

<div class="lz">

## 📌 项目简介

本项目是一款**面向离散制造车间的数字孪生工业软件**。它围绕离散制造"多品种、小批量"的生产特点，提供从**数字孪生模型构建、三维场景可视化、生产过程物理仿真，到与后端 / 实物设备双向数据通信与实体控制**的一体化能力，帮助车间在虚拟环境中完成产线布局验证、运行仿真与虚实联动。

> 设计文档与原理详见作者在 B 站「科技」文集的系列专栏（见文末[延伸阅读](#延伸阅读)）。

## ✨ 功能特性

- **三维场景管理**：基于 Three.js 实时渲染离散制造车间，涵盖设备、物料、人员等要素。
- **物理仿真**：集成 Rapier.js（`@dimforge/rapier3d`），为场景物体构建刚体并运行物理仿真。
- **模型库与组件库**：内置 CNC 精雕机、六轴/七轴机器人、传送道、托盘、传感器等数字孪生对象，按文件类型分类管理（`modelData.json` / `scene.json`）。
- **自定义场景布局**：借助拖拽式布局（vue3-dnd）以行/列容器自由编排虚拟产线。
- **视角存储**：保存与恢复三维场景的自定义观察视角。
- **自定义脚本**：在场景中执行用户脚本，驱动交互逻辑。
- **虚实交互**：通过 Axios 与后端服务器双向通信，实现实物与其数字孪生体之间的信息同步与实体控制。
- **桌面化交付**：基于 Electron 打包为独立的 Windows 桌面应用。

## 🛠 技术栈

| 类别 | 技术 |
| --- | --- |
| 前端框架 | Vue 3 + TypeScript |
| 3D 渲染 | Three.js (`three@0.158`) |
| 物理引擎 | Rapier.js (`@dimforge/rapier3d`) |
| 桌面框架 | Electron 26 |
| 构建工具 | Vite 4 + vite-plugin-electron |
| 通信 | Axios（前后端双向数据） |
| UI 组件 | Ant Design Vue |
| 机器人运动学 | kinematics-js |
| 打包 | electron-forge / electron-builder |

## 🖼 界面与模型库预览

**数字孪生对象库（部分内置模型）：**

<div align="center">

| | | |
| --- | --- | --- |
| ![CNC精雕机](./src/assets/icons/CNC精雕机.jpg) | ![Denso六轴机器人](./src/assets/icons/Denso六轴机器人.jpg) | ![双臂七轴机器人](./src/assets/icons/双臂七轴机器人.jpg) |
| ![托盘](./src/assets/icons/托盘.jpg) | ![传感器](./src/assets/icons/传感器.jpg) | ![光电门](./src/assets/icons/光电门.jpg) |

*内置数字孪生对象 / Built-in digital-twin objects*

</div>

<div align="center">

![产线布局（CAD）](./docs/产线尺寸.png)

*离散制造产线输送线布局图（含尺寸标注）/ Production-line conveyor layout with dimensions*

</div>

<div align="center">

![说明文档](./docs/说明文档.svg)

*系统说明文档图 / System documentation diagram*

</div>

## 📂 项目结构

```
Digital_Twin_Software/
├─ electron/              # Electron 主进程与预加载脚本
│  ├─ main/index.ts        # 主进程入口（窗口、ipcMain、安全策略）
│  └─ preload/index.ts     # 预加载脚本
├─ src/                   # 前端主体
│  ├─ assets/             # 资源：models / icons / svg / json / 场景文件
│  ├─ components/          # Vue 3 组件（DTScene / Models / HttpService …）
│  ├─ config/             # 运行配置
│  └─ js/                 # DTObject.js / DTScene.js / global.js …
├─ docs/                  # 帮助与说明文档、产线尺寸等数据
├─ public/                # 静态资源（logo 等）
├─ vite.config.ts         # Vite + Electron 构建配置
└─ package.json           # 依赖与脚本
```

## 🚀 快速开始

> 环境要求：Node.js + npm（Windows）。

```sh
# 1. 安装依赖
npm install

# 2. 开发预览（启动 Vite 开发服务器）
npm run dev
#    或通过 Electron Forge 直接启动桌面窗口
npm run start

# 3. 编译 + 打包为独立桌面程序
npm run build
node packager.js
#   产物位于 out/DemoApp-win32-x64/DemoApp.exe

# 4.（可选）生成 Windows 安装包
npm run dist
```

仓库根目录附带两个批处理脚本，对应上述流程：

- `1.软件界面预览.bat` → `npm run dev`
- `2.软件编译、打包与启动.bat` → 编译、打包并直接运行桌面程序

## 🧩 架构与模块

- **主进程（Electron）**：`electron/main` 负责创建并管理浏览器窗口，通过 `ipcMain` 监听窗口加载、移动、缩放等事件，并在初始化时校验环境、预加载脚本、配置跨域策略。
- **前端（Vue 3 + Three.js）**：`src/components` 提供界面各功能模块组件；`src/js/DTScene.js` 负责三维场景初始化、物理仿真与自定义脚本执行；`DTObject.js` 定义数字孪生对象；`global.js` 提供跨组件共享的全局变量（规避 Electron 上下文隔离限制）。
- **数据层**：三维物体、场景、模型库与组件库分别由 `modelData.json` / `scene.json` 表示、存储与解析；交互界面与自定义视角数据 likewise 持久化。
- **通信层**：通过 Axios 与后端服务器双向通信，支撑实物–孪生体的信息同步与实体控制。

## 📚 延伸阅读

作者在 B 站「科技」文集撰写了与本软件对应的系列专栏（理论 + 设计）。下面按主题整理各篇的内容简述，可作为深入文档。

### 开篇与综述

- **《面向离散制造的数字孪生三维场景管理与仿真系统绪论》**：学位论文绪论。介绍课题背景——在工业 4.0 与智能制造推进下，数字孪生通过实物与虚拟模型的实时同步与互动支撑产线全生命周期管理；并指出当前离散制造数字孪生系统仍存在场景固定、交互效率与自定义能力不足等短板，引出本文的研究目标。
- **《离散制造车间数字孪生工业软件国内外研究现状》**：综述物联网与信息技术如何为实物设备与虚拟模型搭建数据桥梁，分析现有软件在模型构建机制、虚拟场景自定义布局、生产仿真与设备通信协议统一等方面的局限，并概述本文在离散制造车间数字孪生模型构建、可视化与虚实交互上的工作。
- **《数字孪生工业软件：论文插图》**：收录论文中使用的示意图（draw.io 绘制），涵盖虚拟现实技术架构、数字孪生五维模型、离散制造车间组成与特点、三维网格建模流程、系统总体架构与功能模块、场景构建与仿真流程、Vue 3 的 MVVM 模型、Three.js 渲染管线与光照模型、面片优化与等值面提取等。

### 需求分析与架构设计

- **《数字孪生工业软件需求分析与架构设计》**：从设计目的出发做功能需求分析，并从技术架构与工具链两方面设计系统整体架构；针对场景固定、不易编辑等痛点，提出以可导入 / 管理自定义模型与场景的前端界面，配合三维物理仿真与前后端通信来提升人机交互效率与系统灵活性。
- **《离散制造车间数字孪生软件需求分析与架构设计》**：界定离散制造车间及其「多品种、小批量」的生产特点（约 95% 机械企业属此类型），梳理其设备、物料、人员三类组成；据此明确数字孪生模型构建需求与功能 / 数据交互需求，并从总体技术路线、功能模块规划与工具链选择三方面给出架构设计。

### 模型构建与三维场景

- **《离散制造车间数字孪生软件的模型构建与展现》**：分析离散制造设备建模特点并构建三维网格模型，设计数字孪生模型、场景对象与刚体对象的表示与存储方式；剖析 Three.js 的渲染与着色机制，通过分层动态优化提升渲染性能；并基于 Rapier.js 开发物理仿真功能以评估产线布局合理性。
- **《一种面向离散制造的数字孪生三维场景管理与仿真方法》**：以图示为主的专利 / 方法类文稿，系统呈现面向离散制造的数字孪生三维场景管理与仿真方法的流程与架构设计。

### 虚实通信与数据存储

- **《离散制造车间数字孪生软件的虚实通信服务实现》**：开发软件平台—后端服务器—车间设备间的双向数据通信，设计后端数据处理与任务调度；为不同协议设备开发边缘适配器以实现即插即用与协议转换，并引入基于 AML 的 OPC UA 数据节点配置实现虚实信息同步与设备控制，最后以六轴机器人实例验证。
- **《数字孪生系统数据存储框架设计与仿真功能实现》**：设计系统文件结构与组件关系，规范三维物体、场景、模型库与组件库数据的表示、存储与解析；介绍交互界面与自定义视角数据的管理；基于 Rapier.js 构建刚体对象实现物理仿真，并通过 Axios 完成前后端双向通信，达成实物与孪生体的信息同步与实体控制。

### 前端交互界面

- **《数字孪生系统前端交互界面设计与实现》**：基于 Vue 3 + JavaScript，结合 HTML 原生组件与 Ant Design 组件库搭建前端界面，划分为顶部菜单栏、三维场景展示、模型库、组件库、属性栏、层级管理等多个模块；支持以行 / 列容器嵌套与弹性布局拖拽调整模块排布，并经 Electron 打包为桌面应用。

### 实现、验证与实验平台

- **《离散制造车间数字孪生工业软件实现与验证》**：介绍实验平台软硬件基础，在前文功能机制上实现软件平台（配置项目结构、界面布局并开发各功能模块），并以实物生产线为参照，对三维场景构建、产线仿真与同步、数据通信等功能进行验证。
- **《数字孪生实验平台搭建与功能评估》**：详述实验平台，包括前端计算机硬件（联想刃 7000 / i7-7700 / GTX 1060）与实验室智能生产线（戴尔、浪潮服务器组成的私有云集群，基于 OPC UA 通信）；通过打包运行桌面应用构建数字孪生场景验证功能可行性，并结合实体产线对模块性能做测试与评估。

### 学位论文相关

- **《工业机器人数字孪生工具软件的设计与实现》**：学位论文开题报告，题为《工业机器人数字孪生工具软件的设计与实现》（英文：Design and Implementation on Industrial Robot Digital Twin Tool Software）。
- **《数字孪生工业软件：分委会意见回复与学位论文答辩PPT》**：记录根据华南理工大学学位评定分委员会三点修改意见完成的论文修改（如补充关键模块核心代码、将标题聚焦于「面向离散制造车间的数字孪生模型构建、可视化与虚实交互技术研究」），并附答辩 PPT。
## 📄 许可证

`SCUT`（与华南理工大学相关的课程设计 / 学术用途授权）。本仓库为课程设计衍生作品，具体授权与商用事宜请联系作者。

</div>

<div class="le">

## 📌 Introduction

This project is a **digital-twin industrial software for discrete manufacturing workshops**. Targeting the "high-mix, low-volume" nature of discrete manufacturing, it provides an integrated pipeline of **digital-twin model construction, 3D scene visualization, physical process simulation, and two-way data communication / entity control with back-end and physical devices** — enabling virtual production-line layout validation, run-time simulation, and physical–virtual coupling.

> Design docs and underlying principles are covered in the author's Bilibili "Tech" column series (see [Further Reading](#further-reading) at the end).

## ✨ Features

- **3D scene management**: real-time rendering of the workshop (equipment, materials, personnel, …) with Three.js.
- **Physics simulation**: rigid bodies and physics via Rapier.js (`@dimforge/rapier3d`).
- **Model & component libraries**: built-in digital-twin objects such as CNC engravers, 6-/7-axis robots, conveyors, trays and sensors, classified by file type (`modelData.json` / `scene.json`).
- **Custom scene layout**: drag-and-drop (vue3-dnd) row/column containers to freely arrange virtual production lines.
- **View storage**: save and restore custom camera viewpoints of the 3D scene.
- **Custom scripts**: execute user scripts inside the scene to drive interaction logic.
- **Physical–virtual interaction**: two-way communication with the back-end via Axios for information sync and entity control between the physical asset and its twin.
- **Desktop delivery**: packaged as a standalone Windows desktop app with Electron.

## 🛠 Tech Stack

| Category | Technology |
| --- | --- |
| Front-end | Vue 3 + TypeScript |
| 3D rendering | Three.js (`three@0.158`) |
| Physics | Rapier.js (`@dimforge/rapier3d`) |
| Desktop | Electron 26 |
| Build | Vite 4 + vite-plugin-electron |
| Comms | Axios (bi-directional data) |
| UI | Ant Design Vue |
| Kinematics | kinematics-js |
| Packaging | electron-forge / electron-builder |

## 🖼 Interface & Model Library Preview

**Built-in digital-twin objects (sample models):**

<div align="center">

| | | |
| --- | --- | --- |
| ![CNC](./src/assets/icons/CNC精雕机.jpg) | ![Denso robot](./src/assets/icons/Denso六轴机器人.jpg) | ![Dual-arm robot](./src/assets/icons/双臂七轴机器人.jpg) |
| ![Tray](./src/assets/icons/托盘.jpg) | ![Sensor](./src/assets/icons/传感器.jpg) | ![Photo-gate](./src/assets/icons/光电门.jpg) |

*Built-in digital-twin objects*

</div>

<div align="center">

![Line layout (CAD)](./docs/产线尺寸.png)

*Discrete-manufacturing conveyor-line layout with dimensions*

</div>

<div align="center">

![Docs](./docs/说明文档.svg)

*System documentation diagram*

</div>

## 📂 Project Structure

```
Digital_Twin_Software/
├─ electron/              # Electron main & preload scripts
│  ├─ main/index.ts        # Main process entry (window, ipcMain, security)
│  └─ preload/index.ts     # Preload script
├─ src/                   # Front-end source
│  ├─ assets/             # Resources: models / icons / svg / json / scenes
│  ├─ components/          # Vue 3 components (DTScene / Models / HttpService …)
│  ├─ config/             # Runtime config
│  └─ js/                 # DTObject.js / DTScene.js / global.js …
├─ docs/                  # Help docs, line dimensions, etc.
├─ public/                # Static assets (logo …)
├─ vite.config.ts         # Vite + Electron build config
└─ package.json           # Dependencies & scripts
```

## 🚀 Quick Start

> Requirements: Node.js + npm (Windows).

```sh
# 1. Install dependencies
npm install

# 2. Dev preview (start the Vite dev server)
npm run dev
#    or launch the desktop window directly via Electron Forge
npm run start

# 3. Build + package as a standalone desktop app
npm run build
node packager.js
#   output: out/DemoApp-win32-x64/DemoApp.exe

# 4. (Optional) build a Windows installer
npm run dist
```

Two batch scripts at the repo root mirror the above flow:

- `1.软件界面预览.bat` → `npm run dev`
- `2.软件编译、打包与启动.bat` → build, package and run the desktop app

## 🧩 Architecture & Modules

- **Main process (Electron)**: `electron/main` creates and manages the browser window, listens to load/move/resize events via `ipcMain`, and handles environment checks, script preloading and CORS policy at startup.
- **Front-end (Vue 3 + Three.js)**: `src/components` provide the UI feature modules; `src/js/DTScene.js` handles scene init, physics simulation and custom-script execution; `DTObject.js` defines digital-twin objects; `global.js` exposes shared globals across components (working around Electron's context isolation).
- **Data layer**: 3D objects, scenes, model & component libraries are represented, stored and parsed via `modelData.json` / `scene.json`; UI and custom-viewpoint data are likewise persisted.
- **Comms layer**: Axios provides two-way communication with the back-end, supporting information sync and entity control between the physical asset and its twin.

## 📚 Further Reading

The author's Bilibili Tech column series corresponds to this software (theory + design). The following notes summarize each piece by topic and serve as in-depth documentation.

### Overview & Introduction

- **Introduction to a Discrete-Manufacturing-Oriented Digital-Twin 3D Scene Management & Simulation System**: The thesis introduction. Sets the background-under Industry 4.0 and smart manufacturing, digital twins support full-lifecycle production-line management through real-time synchronization between physical assets and virtual models-and identifies gaps in existing discrete-manufacturing twins (rigid scenes, weak interaction/customization), leading to the research goals.
- **Research Status of Discrete-Manufacturing-Workshop Digital-Twin Industrial Software (Domestic & Abroad)**: A survey of how IoT and IT bridge physical devices and virtual models, analyzing limitations in model construction, customizable virtual layouts, process simulation and unified device protocols, and outlining this work's contributions to modeling, visualization and physical-virtual interaction.
- **Digital-Twin Industrial Software: Thesis Figures**: A collection of figures (drawn with draw.io) used in the thesis-VR tech architecture, the five-dimensional digital-twin model, workshop composition and traits, 3D mesh-modeling workflow, overall architecture and functional modules, scene-build/simulation flow, Vue 3's MVVM model, the Three.js render pipeline and Phong lighting, mesh decimation and marching-cubes simplification, etc.

### Requirement Analysis & Architecture

- **Requirement Analysis & Architecture Design of Digital-Twin Industrial Software**: Starts from design goals and functional requirements, then designs the overall architecture in terms of both tech stack and toolchain; to address rigid/uneditable scenes it proposes an importable/manageable front-end for custom models and scenes plus 3D physics simulation and front-back communication to improve interaction efficiency and flexibility.
- **Requirement Analysis & Architecture Design of Discrete-Manufacturing-Workshop Digital-Twin Software**: Defines the discrete-manufacturing workshop and its high-mix, low-volume mode (about 95% of machinery firms), reviews its equipment/material/personnel composition, derives model-building and functional/data-interaction requirements, and presents the architecture along three lines: overall tech route, functional modules, and toolchain.

### Model Construction & 3D Scenes

- **Model Construction & Rendering of Discrete-Manufacturing-Workshop Digital-Twin Software**: Analyzes equipment-modeling traits and builds 3D meshes; designs the representation and storage of digital-twin models, scene objects and rigid bodies; studies Three.js rendering/shading and applies hierarchical dynamic optimization for performance; and builds physics simulation on Rapier.js to evaluate line-layout rationality.
- **A Discrete-Manufacturing-Oriented 3D Scene Management & Simulation Method for Digital Twins**: A figure-centric patent/method write-up that presents the method's workflow and architecture for discrete-manufacturing digital-twin scene management and simulation.

### Physical-Virtual Communication & Data Storage

- **Physical-Virtual Communication Service Implementation of Discrete-Manufacturing-Workshop Digital-Twin Software**: Develops two-way communication among the desktop platform, back-end server and shop-floor devices, with back-end data processing and task scheduling; builds edge adapters for heterogeneous protocols (plug-and-produce, protocol translation) and introduces AML-based OPC UA node configuration for twin sync and device control, validated on a 6-axis robot.
- **Data Storage Framework & Simulation Implementation of the Digital-Twin System**: Designs the file structure and component relationships and standardizes representation/storage/parsing of 3D objects, scenes, model and component libraries; covers UI and custom-viewpoint data management; builds rigid bodies with Rapier.js for physics simulation and uses Axios for front-back two-way communication to sync the physical asset with its twin and enable entity control.

### Front-end Interaction UI

- **Front-end Interaction UI Design & Implementation of the Digital-Twin System**: Built on Vue 3 + JavaScript with native HTML and the Ant Design Vue component library; the UI is divided into a top menu bar, 3D scene view, model library, component library, property panel and hierarchy manager; modules are laid out via nested row/column containers with flexbox and draggable resizing, and packaged as a desktop app via Electron.

### Implementation, Verification & Experiment Platform

- **Implementation & Verification of Discrete-Manufacturing-Workshop Digital-Twin Industrial Software**: Introduces the experiment-platform hardware/software, implements the platform on top of the earlier-designed mechanisms (project structure, UI layout, functional modules) and verifies 3D scene construction, line simulation/sync and data communication against the physical production line.
- **Digital-Twin Experiment Platform Setup & Functional Evaluation**: Details the platform-front-end PC (Lenovo Blade 7000 / i7-7700 / GTX 1060) and the lab smart line (a private cloud of Dell/Inspur servers over OPC UA); runs the packaged desktop app to build twin scenes for feasibility validation and evaluates each module's performance against the physical line.

### Thesis-related

- **Design and Implementation of an Industrial-Robot Digital-Twin Tool Software**: The thesis proposal, titled Design and Implementation on Industrial Robot Digital Twin Tool Software.
- **Digital-Twin Industrial Software: Sub-committee Response & Thesis Defense PPT**: Records the thesis revisions made per the three points raised by SCUT's degree sub-committee (e.g., adding core code of key modules and refocusing the title on research on discrete-manufacturing-workshop digital-twin model construction, visualization and physical-virtual interaction), with the defense PPT attached.
## 📄 License

`SCUT` (a South-China-University-of-Technology–related academic / course-design license). This repository is a course-design derivative; for licensing or commercial use, please contact the author.

</div>
