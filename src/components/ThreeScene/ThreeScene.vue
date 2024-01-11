<style lang="scss">@import "./ThreeScene.scss"</style>

<script lang="ts" src="./ThreeScene.ts">
    
</script>

<template>
    <div 
    id="three-sketch" 
    class="sketch-container"
    @dragenter="preview"
    @dragleave="leave"
    @dragover="hover" 
    @drop="drop"
    ref="sketch"></div> 
</template>