<script lang="ts" setup>
  import { ref, onMounted } from 'vue'
  import { FileOutlined } from '@ant-design/icons-vue'
  interface Item {id: number; text: string}

  const cards = ref<Item[]>([
    { id: 1, text: '文件1'},
    { id: 2, text: '文件2'},
    { id: 3, text: '文件3'},
    { id: 4, text: '文件4'},
    { id: 5, text: '文件5'},
    { id: 6, text: '文件6'},
    { id: 7, text: '文件7'},
  ])

  const moveCard = (dragIndex: number, hoverIndex: number) => {
    const item = cards.value[dragIndex]
    cards.value.splice(dragIndex, 1) // 减去
    cards.value.splice(hoverIndex, 0, item) // 增加
    console.log(cards)
  }
</script>

<template><!--index暂时没用上-->
  <div style="margin-left: 1em">
    <a-breadcrumb>
      <a-breadcrumb-item>场景</a-breadcrumb-item>
      <a-breadcrumb-item>路径1</a-breadcrumb-item>
    </a-breadcrumb>
  </div>
  <div id='files' style="display: flex;">
    <a-card v-for="(card, index) in cards">
      <file-outlined style="fontSize:50px;"/><br>
      {{ card.text }}
    </a-card>
  </div>
</template>