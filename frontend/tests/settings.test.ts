import {describe,it,expect} from 'vitest'
import { settingsPayload } from '../src/modules/settings/form'
describe('settings write contract',()=>{
  it('writes only editable section fields and keeps optimistic version',()=>{
    expect(settingsPayload('storage',{retention_days:30,max_upload_mb:512,export_formats:['CSV'],storage_dir:'C:/server-only',system_name:'wrong section'},7)).toEqual({values:{retention_days:30,max_upload_mb:512,export_formats:['CSV']},row_version:7})
  })
})
