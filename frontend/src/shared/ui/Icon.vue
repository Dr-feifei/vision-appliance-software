<script setup lang="ts">
import { House, Activity, Video, FilePlus, Bot, Box, Settings, Search, Bell, Menu, LogOut, ChevronRight, Monitor, Cpu, Database, Siren, Plus, Upload, Play, RefreshCw, Camera, Film, Radio, ShieldCheck, SlidersHorizontal, Server, Info, CircleAlert, CircleCheck, Clock, HardDrive, CircleHelp, Wifi, X, ExternalLink, Inbox } from 'lucide-vue-next'
import type { Component } from 'vue'
const props=withDefaults(defineProps<{name:string;size?:number}>(),{size:20})
const icons:Record<string,Component>={house:House,activity:Activity,video:Video,'file-plus':FilePlus,bot:Bot,box:Box,settings:Settings,search:Search,bell:Bell,menu:Menu,logout:LogOut,chevron:ChevronRight,monitor:Monitor,cpu:Cpu,database:Database,siren:Siren,plus:Plus,upload:Upload,play:Play,refresh:RefreshCw,camera:Camera,film:Film,radio:Radio,shield:ShieldCheck,sliders:SlidersHorizontal,server:Server,info:Info,alert:CircleAlert,check:CircleCheck,clock:Clock,disk:HardDrive,help:CircleHelp,wifi:Wifi,x:X,external:ExternalLink,inbox:Inbox}
</script>
<template><component :is="icons[props.name] || icons.info" :size="size" :stroke-width="1.8" aria-hidden="true"/></template>
