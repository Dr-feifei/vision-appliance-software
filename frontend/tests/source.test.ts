import { describe,it,expect } from 'vitest'
import { cameraPatch } from '../src/modules/sources/validation'
import { uploadFile } from '../src/modules/sources/upload'
describe('camera edit and upload completion',()=>{
  it('preserves credentials unless explicitly supplied or cleared',()=>{
    expect(cameraPatch({name:'Door',address:'rtsp://127.0.0.1/live',username:'',password:''},3)).toEqual({name:'Door',address:'rtsp://127.0.0.1/live',row_version:3})
    expect(cameraPatch({name:'Door',address:'rtsp://127.0.0.1/live',username:'',password:' secret '},3).password).toBe(' secret ')
    expect(cameraPatch({name:'Door',address:'rtsp://127.0.0.1/live',username:'',password:''},3,true).password).toBe('')
  })
  it('does not confuse a source id during probing with successful processing',async()=>{
    let polls=0
    const result=await uploadFile(new File(['video'],'a.mp4'),{
      create:async()=>({id:'u',state:'uploading',received_bytes:0,size_bytes:5,source_id:null,error_code:null,error_message:null}),
      chunk:async()=>{},complete:async()=>{},cancel:async()=>{},
      get:async()=>({id:'u',state:++polls===1?'probing':'ready',received_bytes:5,size_bytes:5,source_id:'s',error_code:null,error_message:null}),
    },()=>{},{wait:async()=>{}})
    expect(polls).toBe(2);expect(result.state).toBe('ready')
  })
})
