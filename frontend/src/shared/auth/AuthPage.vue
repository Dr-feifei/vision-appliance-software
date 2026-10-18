<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { NButton, NInput } from 'naive-ui'
import { useSession } from './store'
import { validateCredentials } from './validation'
import { humanError } from '../api/client'
import Icon from '../ui/Icon.vue'
const session=useSession(), router=useRouter(), username=ref(''),password=ref(''),confirmation=ref(''),busy=ref(false),error=ref('')
const setup=computed(()=>!session.initialized)
async function submit(){
  error.value=validateCredentials(username.value,password.value,setup.value)
  if(!error.value&&setup.value&&password.value!==confirmation.value)error.value='两次输入的密码不一致。'
  if(error.value)return
  busy.value=true
  try{await session.authenticate(username.value,password.value);await router.replace('/dashboard')}catch(e){error.value=humanError(e)}finally{busy.value=false}
}
</script>
<template><main class="auth-page"><section class="auth-brand"><div class="brand"><span class="brand-mark"/>视觉监测验证</div><h1>让每一次现场验证<br/>有据可依</h1><p>连接现场视频，掌握设备与服务状态。<br/>在本地工作空间，开展可追溯的视觉验证。</p><div class="auth-badges"><span><Icon name="shield" :size="15"/> 本地部署</span><span><Icon name="video" :size="15"/> 统一视频接入</span></div></section><section class="auth-card-wrap"><form class="auth-card" @submit.prevent="submit"><h2>{{setup?'创建管理员账号':'欢迎回来'}}</h2><p>{{setup?'首次使用，请创建管理员。账号信息仅保存在本机。':'登录视觉监测验证平台，继续你的工作。'}}</p><div class="field"><label for="username">用户名</label><NInput id="username" v-model:value="username" placeholder="请输入用户名" :input-props="{autocomplete:'username',id:'username'}" :disabled="busy"/></div><div class="field"><label for="password">{{setup?'设置密码':'密码'}}</label><NInput id="password" v-model:value="password" type="password" show-password-on="click" :input-props="{autocomplete:setup?'new-password':'current-password',id:'password'}" :placeholder="setup?'至少 12 个字符':'请输入密码'" :disabled="busy"/></div><div v-if="setup" class="field"><label for="confirmation">确认密码</label><NInput id="confirmation" v-model:value="confirmation" :input-props="{autocomplete:'new-password','aria-label':'确认密码',id:'confirmation'}" type="password" placeholder="再次输入密码" :disabled="busy"/></div><div v-if="error" class="error-banner" role="alert">{{error}}</div><NButton type="primary" block size="large" attr-type="submit" :loading="busy">{{setup?'创建账号并进入':'登录工作空间'}}</NButton><div class="auth-footer">视觉监测验证平台 · 本地工作空间</div></form></section></main></template>
