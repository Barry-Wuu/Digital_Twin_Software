<script lang="ts" src="./CanvasEvents.ts"></script>

<template>
    <div 
        class="sketch-container"
        id="canvas"
        @dragenter = "onDragenter"
        @dragleave = "onDragleave"
        @dragover = "onDragover" 
        @drop = "onDrop"
        @keydown = "onKeydown"
        @keyup = "onKeyup"
        @mousedown = "onMousedown"
        @mousemove = "onMousemove"
        @mouseup = "onMouseup"
        @wheel = "onWheel"
        style="outline:none;"
        tabindex="0"
    />
</template>