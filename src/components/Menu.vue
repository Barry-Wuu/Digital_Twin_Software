<template>
  <a-cascader
    v-model:value="value"
    :options="options"
    :display-render="displayRender"
    expand-trigger="hover"
    placeholder="选项1"
  />
</template>
<script lang="ts">
  import { defineComponent, ref } from 'vue';
  interface Option {
    value: string;
    label: string;
    children?: Option[];
  }
  const options: Option[] = [
    { value: 'A', label: 'A', children: [
      { value: 'AA', label: 'AA', children: [
        { value: 'AAA', label: 'AAA',},
        { value: 'AAB', label: 'AAB',},
      ],},
      { value: 'AB', label: 'AB', children: [
        { value: 'ABA', label: 'ABA',},
        { value: 'ABB', label: 'ABB',},
      ],},
    ],},
    { value: 'B', label: 'B', children: [
      { value: 'BA', label: 'BA', children: [
        { value: 'BAA', label: 'BAA',},
        { value: 'BAB', label: 'BAB',},
      ],},
      { value: 'BB', label: 'BB', children: [
        { value: 'BBA', label: 'BBA',},
        { value: 'BBB', label: 'BBB',},
      ],},
    ],},
  ];
  export default defineComponent({
    setup() {
      const displayRender = () => {return "选项1"};
      return { value: ref<string[]>([]), options, displayRender,
      };
    },
  });
</script>