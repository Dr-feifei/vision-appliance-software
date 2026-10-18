<script setup lang="ts">
import Icon from './Icon.vue'
withDefaults(defineProps<{title:string;description?:string;icon?:string;compact?:boolean;large?:boolean}>(),{icon:'inbox'})
</script>
<template><div class="empty-state" :class="{compact,large}"><div class="empty-icon"><Icon :name="icon" :size="26"/></div><strong>{{title}}</strong><p v-if="description">{{description}}</p><slot/></div></template>
