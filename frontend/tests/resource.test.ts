import {mount,flushPromises} from '@vue/test-utils'
import {defineComponent,h} from 'vue'
import {describe,it,expect} from 'vitest'
import {useResource} from '../src/shared/ui/resource'
describe('snapshot refresh ordering',()=>{
  it('keeps the newest query when an older request finishes late',async()=>{
    const pending:Array<(value:string)=>void>=[]
    let refresh:(()=>Promise<void>)|undefined
    const component=defineComponent({setup(){const state=useResource(()=>new Promise<string>(resolve=>pending.push(resolve)));refresh=state.refresh;return ()=>h('div',state.data.value??'')}})
    const wrapper=mount(component)
    const second=refresh!()
    pending[1]!('newest');await second
    pending[0]!('outdated');await flushPromises()
    expect(wrapper.text()).toBe('newest')
    wrapper.unmount()
  })
})
