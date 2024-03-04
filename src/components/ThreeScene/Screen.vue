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
        @wheel = "wheel"
        ref="sketch"
    />
</template>