<script lang="ts">
import { CarryOutOutlined, FormOutlined } from '@ant-design/icons-vue';
import { SelectEvent } from 'ant-design-vue/es/tree/Tree';
import { defineComponent, ref } from 'vue';
export default defineComponent({
  components: {
    CarryOutOutlined,
    FormOutlined,
  },
  setup() {
    const showLine = ref<boolean>(true);
    const showIcon = ref<boolean>(false);

    const onSelect = (selectedKeys: string[], info: SelectEvent) => {
      console.log('selected', selectedKeys, info);
    };
    return {
      showLine: true,
      showIcon: true,
      onSelect,
    };
  },
});
</script>
<template>
   <a-input-search
      v-model:value="value"
      placeholder="input search text"
      enter-button
      @search="onSearch"
    />
  <div>
    <a-tree
      :show-line="showLine"
      :show-icon="showIcon"
      :default-expanded-keys="['0-0-0', '0-0-1', '0-0-2']"
      @select="onSelect"
    >
      <template #icon><carry-out-outlined /></template>
      <a-tree-node key="0-0">
        <template #icon><carry-out-outlined /></template>
        <template #title><span style="color: #1890ff">parent 1</span></template>
        <a-tree-node title="parent 1-0" key="0-0-0">
          <template #icon><carry-out-outlined /></template>
          <a-tree-node title="leaf" key="0-0-0-0">
            <template #icon><carry-out-outlined /></template>
          </a-tree-node>
          <a-tree-node title="leaf" key="0-0-0-1">
            <template #icon><carry-out-outlined /></template>
          </a-tree-node>
          <a-tree-node title="leaf" key="0-0-0-2">
            <template #icon><carry-out-outlined /></template>
          </a-tree-node>
        </a-tree-node>
        <a-tree-node title="parent 1-1" key="0-0-1">
          <template #icon><carry-out-outlined /></template>
          <a-tree-node title="leaf" key="0-0-1-0">
            <template #icon><carry-out-outlined /></template>
          </a-tree-node>
        </a-tree-node>
        <a-tree-node title="parent 1-2" key="0-0-2">
          <template #icon><carry-out-outlined /></template>
          <a-tree-node title="leaf" key="0-0-2-0">
            <template #icon><carry-out-outlined /></template>
          </a-tree-node>
          <a-tree-node title="leaf" key="0-0-2-1">
            <template #icon><carry-out-outlined /></template>
            <template #switcherIcon><form-outlined /></template>
          </a-tree-node>
        </a-tree-node>
      </a-tree-node>
    </a-tree>
  </div>
</template>
