<script lang="ts">
import global from "../Global"
import Prop from "./Prop.vue"
import { ref } from 'vue'
import {
  CaretDownOutlined
} from '@ant-design/icons-vue';
import { nodeManager } from "../utils/nodeManager"
import * as THREE from "three"
const DT: any = ref("未选择物体");
const tube = new EyeDropper();  // 颜色吸管

export default {
  components: {
    CaretDownOutlined,
    Prop
  },
  data() {
    return {
      angle: Math.PI / 180,
      customCodeMap: {
        "开始碰撞时": "onCollisionStart",
        "碰撞进行时": "onCollision",
        "结束碰撞时": "onCollisionEnd",
      },
      DT,
      global,
      inputUUID: '',
      deviceData: [] as Array<[string, Record<string, any>]>,
      showRemark: false,
      remarkMap: new Map(), // 存储路径-备注映射
    }
  },
  computed: {  // 动态列配置
    deviceColumns() {
      const baseColumns = [
        {
          title: '节点路径',
          dataIndex: 'path',
        },
        {
          title: '当前值',
          dataIndex: 'value',
        }
      ];
      return this.showRemark ?
        [
          {
            title: '备注',
            dataIndex: 'remark',
            slots: { customRender: 'remark' },
            width: 200
          },
          ...baseColumns
        ] : baseColumns;
    },
    processedDeviceData() {  // 处理后的设备数据
      return this.deviceData.flatMap(([path, values]) =>
        Object.entries(values).map(([key, val]) => ({
          key: `${path}-${key}`,
          path: `${path}.${key}`,
          value: val,
          remark: this.remarkMap.get(`${path}.${key}`),
          editing: false,  // 编辑状态
          tempRemark: ''   // 临时输入值
        }))
      );
    }
  },
  watch: {
    // 当选中物体变化时，自动加载其deviceUUID对应的数据
    DT: {
      deep: true,
      immediate: true, // 初始化时立即执行
      handler(newDT) {
        // 类型验证：DT必须是DT对象而非字符串
        if (typeof newDT === 'string') return;

        // 当deviceUUID存在且有效时
        if (newDT?.deviceUUID && this.validateUUID(newDT.deviceUUID)) {
          this.inputUUID = newDT.deviceUUID;
          this.loadDeviceData();
        }
      }
    }
  },
  methods: {
    changeFogColor() {  // 更改雾的颜色
      global.emit("changeFogColor", DT.value.mesh.userData.ground)
    },
    updateJoint(joint: any, value: number) { // 调用物理约束更新逻辑
      global.physicsWorld.getJoint(joint.handle).configureMotorPosition(
        THREE.MathUtils.degToRad(value), // 角度转弧度
        1.0,  // 刚度
        0.5   // 阻尼
      );
      joint.currentValue = value;
      this.$forceUpdate();
    },
    loadDeviceData() {
      // 确保UUID有效
      if (!this.validateUUID(this.inputUUID)) {
        this.$message.error('请输入有效的UUID格式');
        return;
      }
      this.updateDeviceData();
    },
    // 新增更新设备数据的方法
    updateDeviceData() {
      if (!this.inputUUID) return;

      const deviceMap = nodeManager.getDeviceData(this.inputUUID);
      this.deviceData = deviceMap
        ? Array.from(deviceMap.entries())
        : [];
    },
    validateUUID(uuid: string) {
      this.deviceUUIDInvalid = !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid);
      return !this.deviceUUIDInvalid;
    },
    toggleRemark() {// 切换备注列
      this.showRemark = !this.showRemark;
    },
    startEdit(record) {// 开始编辑
      record.editing = true;
      record.tempRemark = record.remark || '';
    },
    saveRemark(record) {// 保存备注
      this.remarkMap.set(record.path, record.tempRemark);
      record.editing = false;
    }
  },
  provide: { tube },
  mounted() {
    global.on("hideProperty", () => DT.value = "未选择物体");  // 清空属性
    global.on("showMultipleProperty", (x) => DT.value = `已选择${x}个物体`);  // 选择多个物体
    global.on("showProperty", (id: any) => {  // 显示单个物体的属性
      id = parseInt(id);  // 若id为数字字符串则转换为数字
      DT.value = global.SCENE.DT.findDTObjectById(id);
    });
    if (this.DT?.deviceUUID) {
      this.inputUUID = this.DT.deviceUUID;
      this.$nextTick(this.loadDeviceData);
    }
    this.unsubscribe = nodeManager.subscribe((updatedUUID) => {
      // 仅在当前展示的UUID更新时刷新
      if (updatedUUID === this.inputUUID) {
        this.updateDeviceData();
      }
    });
  },
  beforeUnmount() {
    // 组件销毁时取消订阅
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  },

}
</script>

<style>
.input {
  border: 1px solid dodgerblue;
}

.remark-toggle-button {
  margin-left: 12px;
}

/* 备注单元格样式 */
.remark-cell {
  display: flex;
  align-items: center;

  .ant-input {
    flex: 1;
    margin-right: 8px;
  }

  button {
    flex-shrink: 0;
  }
}

/* 表格宽度自适应 */
.device-table {
  width: 100%;

  .ant-table {
    table-layout: auto !important;
  }
}

.text-button {
  color: #1890ff;
  padding-left: 8px;

  &:hover {
    color: #40a9ff;
  }
}

/* 调整按钮边距 */
.remark-toggle-button {
  margin-left: 8px;
  padding: 0 4px;
  font-size: 12px;
  display: inline-block !important;
  opacity: 1 !important;
  visibility: visible !important;
}
</style>

<template>
  <!--属性栏默认文字-->
  <a-alert v-if="typeof DT == 'string'" :message="DT" style="width:100%" type="info" />
  <!--属性栏内容-->
  <div v-else-if="DT" style="text-align:left;">
    <a-collapse :default-active-key="[
      '基本属性', '几何属性', '物理属性', '设备属性','材质属性', '代码属性', '自定义属性', '自定义脚本'
    ]">

      <!--基本属性-->
      <a-collapse-panel header="基本属性" key="基本属性">
        <Prop prop="type" title="物体类型" />
        <Prop prop="basename" title="元件类型" />
        <Prop prop="id" title="物体网格ID" :options="{ fixed: 0 }" />
        <Prop prop="name" title="物体名称" type="inputString" width="150px" />
        <Prop prop="physicalID" title="物理实体ID" type="inputString" width="150px" />
        <Prop prop="deviceUUID" title="设备UUID" type="inputString" width="150px" :options="{
          validator: (val) => val === '' || validateUUID(val),
          errorMessage: '输入格式错误或留空',
          immediateValidation: true // 新增即时验证选项
        }">
          <template #extra>
            <span v-if="deviceUUIDInvalid" style="color: red">⚠ 格式错误</span>
          </template>
        </Prop>
        <Prop prop="label" title="物体标签" type="inputString" width="150px" />
        <Prop prop="node" title="所属节点" type="inputString" width="150px" />
        <Prop prop="mesh.visible" title="是否可见" type="checkbox" />
        <Prop prop="mesh.position" title="相对位移" type="inputVector" />
        <Prop prop="mesh.rotation" title="相对旋转" type="inputVector" width="75px"
          :options="{ delta: 10, loop: true, min: 0, max: 360, suffix: '°', unit: angle }" />
        <Prop prop="world_position" title="绝对位移" type="inputVector" />
        <Prop prop="world_rotation" title="绝对旋转" type="inputVector" width="75px"
          :options="{ delta: 10, loop: true, min: 0, max: 360, suffix: '°', unit: angle }" />
        <Prop prop="scale" title="比例" type="inputNumber" :options="{ delta: 0.1, min: 0.1, max_warn: 100 }" />
        <Prop v-if="DT.label == 'conveyor' && DT.basename.includes('直道')" prop="mesh.scale.x" title="长度"
          type="inputNumber" :options="{
            confirm: value => DT.updateConveyorRigidbody(value),
            delta: 0.1, min: 0.1, max_warn: 100, unit: DT.scale / 7.5
          }" />
        <Prop v-if="DT.basename?.includes('直护栏')" prop="mesh.scale.y" title="长度" type="inputNumber" :options="{
          confirm: value => DT.updateGuardRail(value),
          delta: 0.1, min: 0.1, max_warn: 100, unit: DT.scale / 6
        }" />
        <Prop prop="mesh.color" title="光源颜色" type="inputVector" />
        <Prop prop="mesh.color" title="颜色代码" type="inputColor" width="120px" />
        <Prop prop="mesh.intensity" title="光照强度" type="inputNumber" :options="{ delta: 0.1, min: 0 }" />
        <Prop prop="timeInterval" title="发生时间间隔" type="inputNumber"
          :options="{ delta: 0.01, min: 1, max: 10, suffix: 's', unit: 1000 }" />
        <Prop prop="skybox.skyColor" title="天空颜色" type="inputColor" width="120px" @change="global.emit('updateSkybox')" />
        <Prop prop="skybox.skyline" title="天际线颜色" type="inputColor" width="120px" @change="global.emit('updateSkybox')" />
        <Prop prop="skybox.groundColor" title="底面颜色" type="inputColor" width="120px"
          @change="global.emit('updateSkybox')" />
      </a-collapse-panel>

      <!--几何属性-->
      <a-collapse-panel v-if="DT.geometry" header="几何属性" key="几何属性">
        <Prop prop="geometry.type" title="几何体类型" />
        <Prop prop="geometry.userData.path" title="模型路径" />
        <Prop prop="geometry.attributes.position.count" title="顶点数" :options="{ fixed: 0 }" />
        <Prop prop="geometry.attributes.normal.count" title="法向量数" :options="{ fixed: 0 }" />
        <Prop prop="geometry.attributes.uv.count" title="UV坐标数" :options="{ fixed: 0 }" />
        <Prop prop="geometry.boundingBox.min" title="包围盒最小值" />
        <Prop prop="geometry.boundingBox.max" title="包围盒最大值" />
        <Prop prop="geometry.boundingSphere.center" title="包围球中心" />
        <Prop prop="geometry.boundingSphere.radius" title="包围球半径" />
      </a-collapse-panel>
      <a-collapse-panel v-else disabled header="几何属性（无）" />

      <!--物理属性-->
      <a-collapse-panel v-if="DT.rb" header="物理属性" key="物理属性">
        <Prop prop="rigid" title="刚体" />
        <Prop prop="rigidFollow" title="运动位姿跟随" type="follow" />
        <Prop prop="mass" title="质量" type="inputNumber" :options="{ delta: 0.1, min: 0.1, max: 20 }" />
        <Prop prop="friction0" title="静摩擦系数" type="inputNumber" :options="{ delta: 0.1, min: 0, max: 1 }" />
        <Prop prop="friction" title="滑动摩擦系数" type="inputNumber" :options="{ delta: 0.1, min: 0, max: 1 }" />
        <Prop prop="isSensor" title="是否是传感器" />
        <Prop prop="v0" title="传送带速度" type="inputNumber" :options="{ delta: 0.1, min: 0, max: 200, unit: 1.5 / 200 }" />
      </a-collapse-panel>
      <a-collapse-panel v-else disabled header="物理属性（无）" />

      <!--约束信息-->
      <a-collapse-panel v-if="DT.kinematics?.joints?.length" header="约束信息" key="约束信息">
        <div v-for="(joint, idx) in DT.kinematics.joints" :key="idx">
          <a-typography-text strong>{{ joint.name }} ({{ joint.type }})</a-typography-text>
          <!-- 关节滑动参数 -->
          <Prop :prop="`kinematics.joints[${idx}].currentValue`" :title="`${joint.axis}轴位置`" type="slider" :options="{
            disabled: !joint.limit,
            min: joint.limit?.lower ?? 0,
            max: joint.limit?.upper ?? 360,
            step: 0.1,
            unit: joint.type === 'revolute' ? '°' : 'm'
          }" @change="(val) => updateJoint(joint, val)" />
          <!-- 约束范围显示（若无限制则不展示） -->
          <Prop v-if="joint.limit" :prop="`kinematics.joints[${idx}].limit`" title="限制范围" type="text"
            :formatter="val => `${val.lower} ~ ${val.upper}`" />
        </div>
      </a-collapse-panel>
      <a-collapse-panel v-else disabled header="约束信息（无）" />

      <!--设备节点信息-->
      <a-collapse-panel header="设备数据" key="设备属性" :force-render="true">
        <template #extra>
          <a-button @click="toggleRemark" type="link" size="small" class="remark-toggle-button">
            {{ showRemark ? '隐藏备注' : '显示备注' }}
          </a-button>
        </template>
        <a-alert :type="deviceData.length > 0 ? 'success' : 'info'" :showIcon="true"
          :message="`UUID: ${inputUUID || '未选择'}`" :description="deviceData.length > 0
            ? `已加载 ${deviceData.length} 个数据节点 `
            : '暂无匹配数据'" />
        <a-table :columns="deviceColumns" :data-source="processedDeviceData" :pagination="false" size="small" bordered>
          <!-- 动态备注列渲染 -->
          <template #remark="{ record }">
            <div class="remark-cell">
              <span v-if="!record.editing">{{ record.remark || '点击编辑' }}</span>
              <a-input v-else v-model:value="record.tempRemark" size="small" @keyup.enter="saveRemark(record)" />
              <a-button type="link" @click="record.editing ? saveRemark(record) : startEdit(record)" class="text-button">
                {{ record.editing ? '保存' : '编辑' }}
              </a-button>
            </div>
          </template>
        </a-table>
      </a-collapse-panel>

      <!--材质属性-->
      <a-collapse-panel v-if="DT.mesh.material" header="材质属性" key="材质属性">
        <Prop prop="mesh.material.type" title="材质类型" />
        <Prop prop="mesh.material.color" title="材质颜色" type="inputVector" @change="changeFogColor" />
        <Prop prop="mesh.material.color" title="颜色代码" type="inputColor" width="120px" @change="changeFogColor" />
        <Prop prop="mesh.material.opacity" title="透明度" type="inputNumber"
          :options="{ fixed: 0, min: 0, max: 100, suffix: '%', unit: 0.01 }" />
      </a-collapse-panel>
      <a-collapse-panel v-else disabled header="材质属性（无）" />

      <!--自定义属性-->
      <a-collapse-panel v-if="DT.custom" header="自定义属性" key="自定义属性">
        <a-button @click="global.emit('popup', { DT: DT, title: '编辑自定义属性', type: 'prop' })">
          编辑自定义属性
        </a-button>
      </a-collapse-panel>

      <!--自定义脚本-->
      <a-collapse-panel v-if="DT.custom" header="自定义脚本" key="自定义脚本">
        每帧更新时运行的脚本：
        <a-button @click="global.emit('popup', {
          DT: DT, title: '编辑自定义脚本', type: 'code', customCodeType: 'update'
        })">
          编辑
        </a-button>
        <br>
        触发事件时运行的脚本：
        <a-dropdown :trigger="['click']">
          <template #overlay>
            <a-menu @click="e => global.emit('popup', {
              DT: DT, title: '编辑自定义脚本', type: 'code', customCodeType: customCodeMap[e.key]
            })
              ">
              <a-menu-item v-for="  key   in   Object.keys(customCodeMap)  " :key="key">{{ key }}</a-menu-item>
            </a-menu>
          </template>
          <a-button>展开
            <CaretDownOutlined />
          </a-button>
        </a-dropdown>
      </a-collapse-panel>
    </a-collapse>
  </div>
</template>