import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { describe, it, expect, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import AuthPage from '../src/shared/auth/AuthPage.vue'
import { useSession } from '../src/shared/auth/store'
import { api } from '../src/shared/api'
describe('administrator setup form',()=>{
  it('keeps short passwords local and submits original password without trimming',async()=>{
    const pinia=createPinia();setActivePinia(pinia)
    const session=useSession();session.initialized=false
    const router=createRouter({history:createMemoryHistory(),routes:[{path:'/',component:{template:'<div />'}}]})
    const authenticate=vi.spyOn(api,'authenticate').mockResolvedValue({id:'u1',username:'admin',role:'admin'})
    const wrapper=mount(AuthPage,{global:{plugins:[pinia,router]}})
    await wrapper.find('input[autocomplete="username"]').setValue('admin')
    await wrapper.find('input[autocomplete="new-password"]').setValue('short')
    await wrapper.find('input[aria-label="确认密码"]').setValue('short')
    await wrapper.find('form').trigger('submit')
    expect(wrapper.text()).toContain('12')
    expect(authenticate).not.toHaveBeenCalled()
    await wrapper.find('input[autocomplete="new-password"]').setValue(' pass word 123 ')
    await wrapper.find('input[aria-label="确认密码"]').setValue(' pass word 123 ')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(authenticate).toHaveBeenCalledWith(true,'admin',' pass word 123 ')
  })
})
