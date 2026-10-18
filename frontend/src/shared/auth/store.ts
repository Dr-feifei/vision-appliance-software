import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '../api'
import type { User } from '../api/types'
export const useSession = defineStore('session',()=>{
  const user=ref<User|null>(null), initialized=ref(true), ready=ref(false)
  async function restore() {
    try {
      initialized.value=(await api.setupStatus()).initialized
      if(initialized.value) { try {user.value=await api.me()} catch {user.value=null} }
      ready.value=true
    } catch {ready.value=false;throw new Error('SERVICE_OFFLINE')}
  }
  async function authenticate(username:string,password:string) {
    user.value=await api.authenticate(!initialized.value,username.trim(),password)
    initialized.value=true
  }
  async function logout() {await api.logout();user.value=null}
  return {user,initialized,ready,restore,authenticate,logout}
})
