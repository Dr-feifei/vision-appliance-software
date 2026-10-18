<script setup lang="ts">
import { computed } from 'vue'
import type { RuntimeSample } from '../../shared/api/types'
const props=defineProps<{samples:RuntimeSample[]}>()
function points(key:'cpu_percent'|'memory_percent'|'gpu_percent'){
  return props.samples.map((s,i)=>s[key]===null?null:`${48+(i/Math.max(props.samples.length-1,1))*610},${195-(s[key]??0)*1.65}`).filter(v=>v!==null).join(' ')
}
const times=computed(()=>props.samples.length?[props.samples[0]!,props.samples[props.samples.length-1]!]:[])
</script>
<template><svg class="chart" viewBox="0 0 690 230" role="img" aria-label="CPU、内存和 GPU 实测资源历史趋势"><g v-for="tick in [0,25,50,75,100]" :key="tick"><line x1="48" x2="658" :y1="195-tick*1.65" :y2="195-tick*1.65" class="chart-grid"/><text x="5" :y="199-tick*1.65" class="chart-label">{{tick}}%</text></g><polyline :points="points('cpu_percent')" stroke="#3584ee" class="chart-line"/><polyline :points="points('memory_percent')" stroke="#39af83" class="chart-line"/><polyline :points="points('gpu_percent')" stroke="#8664d9" class="chart-line"/><text v-if="times[0]" x="48" y="222" class="chart-label">{{new Date(times[0].observed_at).toLocaleTimeString('zh-CN')}}</text><text v-if="times[1]" x="658" y="222" text-anchor="end" class="chart-label">{{new Date(times[1].observed_at).toLocaleTimeString('zh-CN')}}</text></svg></template>
