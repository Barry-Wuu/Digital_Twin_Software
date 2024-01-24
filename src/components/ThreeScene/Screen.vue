<style lang="scss">@import "./ThreeScene.scss"</style>

<script lang="ts" src="./ThreeScene.ts">
</script>

<template>
    <div 
    id="three-sketch" 
    class="sketch-container"
    @dragstart = "dragstart"
    @dragend = "dragend"
    @dragenter = "dragenter"
    @dragleave = "dragleave"
    @dragover = "dragover" 
    @drop = "drop"
    @wheel = "wheel"
    ref="sketch"></div> 
</template>