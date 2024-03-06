<script lang="ts" src="./ThreeScene.ts"></script>

<template>
    <div 
        class="sketch-container"
        id="canvas"
        @dragstart = "dragstart"
        @dragend = "dragend"
        @dragenter = "dragenter"
        @dragleave = "dragleave"
        @dragover = "dragover" 
        @drop = "drop"
        @mousedown = "mousedown"
        @keydown = "onKeydown"
        @wheel = "wheel"
        ref="canvas"
        style="outline:none;"
        tabindex="0"
    />
</template>