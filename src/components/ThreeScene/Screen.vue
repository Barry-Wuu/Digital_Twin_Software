<script lang="ts" src="./SceneEvents.ts"></script>

<template>
    <div 
        class="sketch-container"
        id="canvas"
        @dragenter = "dragenter"
        @dragleave = "dragleave"
        @dragover = "dragover" 
        @drop = "drop"
        @keydown = "keydown"
        @keyup = "keyup"
        @mousedown = "mousedown"
        @mousemove = "mousemove"
        @mouseup = "mouseup"
        @wheel = "wheel"
        ref="canvas"
        style="outline:none;"
        tabindex="0"
    />
</template>./SceneEvents.js./SceneEvents.js