<script setup lang="ts">
import { NButton } from 'naive-ui'
defineProps<{error:string}>()
defineEmits<{retry:[]}>()
</script>
<template><div v-if="error" class="error-banner" role="alert"><span>{{error}}</span><NButton size="small" secondary type="error" @click="$emit('retry')">重试</NButton></div></template>
