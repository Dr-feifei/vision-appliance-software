import {describe,it,expect} from 'vitest'
import {uploadFile,uploadErrorMessage} from '../src/modules/sources/upload'
import type {Upload,} from '../src/shared/api/types'
import type {UploadTransport} from '../src/modules/sources/upload'
function transport(state:Upload):UploadTransport{return {create:async()=>({...state,state:'uploading'}),chunk:async()=>{},complete:async()=>{},cancel:async()=>{},get:async()=>state}}
const base:Upload={id:'u',state:'failed',received_bytes:5,size_bytes:5,source_id:null,error_code:'invalid_media',error_message:'文件没有可读取的视频轨道，请更换视频。'}
describe('upload processing diagnostics',()=>{
  it('retains the sanitized processing diagnostic instead of reporting validation failure',async()=>{
    let failure:unknown
    try{await uploadFile(new File(['video'],'bad.mp4'),transport(base),()=>{})}catch(error){failure=error}
    expect(uploadErrorMessage(failure)).toBe('文件没有可读取的视频轨道，请更换视频。')
  })
  it.each([['invalid_media','视频'],['media_timeout','超时'],['storage_error','存储'],['dependency_unavailable','处理组件']])('explains %s without inventing a gateway fault',async(code,expected)=>{
    let failure:unknown
    try{await uploadFile(new File(['video'],'bad.mp4'),transport({...base,error_code:code,error_message:null}),()=>{})}catch(error){failure=error}
    expect(uploadErrorMessage(failure)).toContain(expected)
    expect(uploadErrorMessage(failure)).not.toContain('网关')
  })
  it('distinguishes a canceled upload from processing failure',async()=>{
    let failure:unknown
    try{await uploadFile(new File(['video'],'bad.mp4'),transport({...base,state:'canceled',error_code:null,error_message:null}),()=>{})}catch(error){failure=error}
    expect(uploadErrorMessage(failure)).toContain('取消')
  })
})
