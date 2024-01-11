<script lang="ts" setup>
  import { computed, ref, unref } from 'vue'
  import { useDrag, useDrop } from 'vue3-dnd'
  import type { XYCoord, Identifier } from 'dnd-core'
  import { toRefs } from '@vueuse/core'
  import { FileOutlined } from '@ant-design/icons-vue';
  const props = defineProps<{
    id: any
    text: string
    index: number
    moveCard: (dragIndex: number, hoverIndex: number) => void
  }>()

  interface DragItem {
    index: number
    id: string
    type: string
  }
  const ItemTypes = { CARD: 'card'}
  const card = ref<HTMLDivElement>()

  const [collect, drag] = useDrag({//拿起
    type: 'card',
    item: () => {return{id: props.id, index: props.index}},
    collect: (monitor: any) => ({
      isDragging: monitor.isDragging(),
    }),
  })

  const [dropCollect, drop] = useDrop<//放下
    DragItem,
    void,
    { handlerId: Identifier | null, isShallowOver: boolean }
  >({
    accept: ItemTypes.CARD,
    collect(monitor) {
      return {
        handlerId: monitor.getHandlerId(),
        isShallowOver: monitor.isOver({ shallow: true })
      }
    },
    drop(item: DragItem, monitor) {
      const dragIndex = item.index
      const hoverIndex = props.index
      if (dragIndex !== hoverIndex || DragItem!=props) {
        props.moveCard(dragIndex, hoverIndex)
        item.index = hoverIndex
      }
    }
  })

  const { handlerId, isShallowOver } = toRefs(dropCollect)
  const { isDragging } = toRefs(collect)
  const opacity = computed(() => (unref(isDragging) ? 0 : 1))
  const draggable = (el: HTMLDivElement) => {card.value = drag(drop(el)) as HTMLDivElement}
</script>

<style lang="less" scoped>
.indicator {
  position: absolute;
  bottom: 0;
  width: 2px;
  height: 100%;
  background: dodgerblue;
  &.first {
    top: 0;
    bottom: unset;
  }
}
.card {
  align-items: 'center';
  cursor: move;
  display: flex;
  justify-content:center;
  padding: 0px;
  width: 100px;
}
</style>

<template>
  <div style="display: flex; margin:5px; flex-wrap: wrap;">
    <div :data-handler-id="handlerId" :ref="draggable" :style="{ opacity }" class="card">
      <a-card>
        <!--文件图标-->
        <file-outlined style="fontSize:50px;"/><br>
        <!--文件名-->
        <div style="margin: 4px;">{{ text }}</div>
      </a-card>
      <div v-if="isShallowOver && !isDragging" :class="['indicator',{first: props.index === 0 }]" style="height:100%"></div>
    </div>
  </div> 
</template>
