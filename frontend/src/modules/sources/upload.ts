import type { Upload } from '../../shared/api/types'
import { humanError } from '../../shared/api/client'
const processingMessages:Record<string,string>={
  invalid_media:'视频无法读取或没有有效的视频轨道，请更换文件。',
  media_timeout:'视频处理超时，请检查媒体组件或换用较短的文件。',
  storage_error:'存储写入失败，请检查磁盘空间与本机存储权限。',
  dependency_unavailable:'本地媒体处理组件尚未就绪，请查看运行状态。',
  upload_canceled:'本次上传已取消。',
}
export class UploadProcessingError extends Error {
  constructor(readonly code:string|null, diagnostic:string|null){
    super(diagnostic||processingMessages[code?.toLowerCase()??'']||'视频处理失败，请查看视频源详情中的诊断后重试。')
    this.name='UploadProcessingError'
  }
}
export interface UploadTransport {
  create: (filename: string,size: number) => Promise<Upload>
  chunk: (id:string,index:number,data:Blob) => Promise<unknown>
  complete: (id:string) => Promise<unknown>
  get: (id:string) => Promise<Upload>
  cancel: (id:string) => Promise<unknown>
}
export async function uploadFile(file: File, transport: UploadTransport, progress: (value: Upload) => void, options: {chunkSize?: number; wait?: () => Promise<void>; signal?: AbortSignal} = {}): Promise<Upload> {
  if (!file.size) throw new Error('EMPTY_FILE')
  const upload = await transport.create(file.name, file.size)
  const checkCanceled = async () => { if(options.signal?.aborted) { await transport.cancel(upload.id); throw new Error('UPLOAD_CANCELED') } }
  const size = options.chunkSize ?? 4 * 1024 * 1024
  for (let offset=0,index=0;offset<file.size;offset+=size,index++) {
    await checkCanceled()
    await transport.chunk(upload.id,index,file.slice(offset,offset+size))
    progress({...upload,received_bytes:Math.min(offset+size,file.size)})
  }
  await checkCanceled()
  await transport.complete(upload.id)
  for (let attempt=0; attempt<600; attempt++) {
    await checkCanceled()
    const state = await transport.get(upload.id)
    progress(state)
    if (state.state === 'ready' && state.source_id) return state
    if(state.state==='canceled')throw new UploadProcessingError('upload_canceled',null)
    if(state.state==='failed')throw new UploadProcessingError(state.error_code,state.error_message)
    await (options.wait?.() ?? new Promise<void>(resolve=>setTimeout(resolve,1000)))
  }
  throw new Error('UPLOAD_TIMEOUT')
}


export function uploadErrorMessage(error:unknown):string {
  if(error instanceof UploadProcessingError)return error.message
  if(error instanceof Error){
    if(error.message==='UPLOAD_CANCELED')return '本次上传已取消。'
    if(error.message==='EMPTY_FILE')return '文件为空，请重新选择。'
    if(error.message==='UPLOAD_TIMEOUT')return '后台处理尚未完成，请刷新列表查看状态。'
  }
  return humanError(error)
}
