<script setup lang="ts">
import { computed } from 'vue'
const props=defineProps<{value:string}>()
const labels:Record<string,string>={ready:'就绪',online:'在线',unverified:'未验证',connecting:'连接中',disconnected:'已断开',reconnecting:'重连中',failed:'失败',uploading:'上传中',probing:'探测中',transcoding:'转码中',canceled:'已取消',unavailable:'未就绪',degraded:'需关注',completed:'已完成',running:'运行中',waiting:'等待中',pending:'待处理',passed:'测试通过',succeeded:'测试通过'}
const tone=computed(()=>['ready','online','passed','succeeded','completed'].includes(props.value)?'good':['failed','disconnected'].includes(props.value)?'bad':['degraded','probing','transcoding','connecting','reconnecting','waiting','pending','running','uploading'].includes(props.value)?'warn':'')
</script>
<template><span class="status" :class="tone"><span class="dot"/>{{ labels[value] || value }}</span></template>
