<template>  
  <div  
    class="draggable-window"  
    :style="{ top: `${windowTop}px`, left: `${windowLeft}px`, width: `${windowWidth}px`, height: `${windowHeight}px` }"  
    @mousedown="startDrag"  
    @mousemove="drag"  
    @mouseup="endDrag"  
  >  
    {{ windowTitle }}  
  </div>  
</template>  
  
<script lang="ts">  
import { Vue, Component, Prop, Event } from 'vue-property-decorator';  
  
interface WindowData {  
  readonly windowTitle: string;  
  readonly windowTop: number;  
  readonly windowLeft: number;  
  readonly windowWidth: number;  
  readonly windowHeight: number;  
}  
  
@Component  
export default class DraggableWindow extends Vue {  
  @Prop() private windowTitle!: string;  
  @Prop() private windowTop!: number;  
  @Prop() private windowLeft!: number;  
  @Prop() private windowWidth!: number;  
  @Prop() private windowHeight!: number;  
  
  private mouseDownX!: number;  
  private mouseDownY!: number;  
  private dragging!: boolean;  
  
  private startDrag(event: MouseEvent) {  
    this.mouseDownX = event.clientX;  
    this.mouseDownY = event.clientY;  
    this.dragging = true;  
  }  
  
  private drag(event: MouseEvent) {  
    if (!this.dragging) return;  
    const dx = event.clientX - this.mouseDownX;  
    const dy = event.clientY - this.mouseDownY;  
    this.windowTop += dy;  
    this.windowLeft += dx;  
    this.mouseDownX = event.clientX;  
    this.mouseDownY = event.clientY;  
  }  
  
  private endDrag() {  
    this.dragging = false;  
  }  
}  
</script>