import type { CameraInput } from '../../shared/api/types'
export interface CameraForm {name:string;address:string;username:string;password:string}
export function cameraPatch(form:CameraForm,row_version:number,clear=false):Partial<CameraInput>&{row_version:number} {
  return {name:form.name.trim(),address:form.address.trim(),row_version,...(form.username?{username:form.username}:{}),...(form.password?{password:form.password}:{}),...(clear?{username:'',password:''}:{})}
}
export function validateCamera(form:CameraForm):string {
  if(!form.name.trim())return '请输入视频源名称。'
  try{const url=new URL(form.address);if(url.protocol!=='rtsp:')return '当前支持 RTSP 摄像头地址。'}catch{return '请输入有效的 RTSP 地址。'}
  return ''
}
