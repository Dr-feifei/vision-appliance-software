"""Safe media tooling. Commands are argument arrays, never a shell; errors never expose stderr."""
import hashlib
import json
import math
import shutil
import subprocess
from fractions import Fraction
from pathlib import Path
from app.shared.errors import Error

class MediaFailure(Exception):
    def __init__(self,code,message):
        self.code,self.message = code,message
        super().__init__(message)

def run_tool(executable,arguments,timeout):
    resolved = shutil.which(executable)
    if not resolved:
        raise MediaFailure('dependency_unavailable','本地 FFmpeg / FFprobe 不可用，请安装并配置媒体工具。')
    try:
        result = subprocess.run([resolved,*arguments],shell=False,capture_output=True,timeout=timeout,check=False,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
    except subprocess.TimeoutExpired:
        raise MediaFailure('media_timeout','媒体处理超时，请检查文件时长、编码及处理资源。')
    except OSError:
        raise MediaFailure('dependency_unavailable','无法启动本地媒体工具，请检查安装。')
    if result.returncode:
        raise MediaFailure('invalid_media','媒体解码失败或文件损坏；请使用完整的视频文件重新导入。')
    return result.stdout

LOCAL_INPUT = ['-protocol_whitelist','file,pipe','-format_whitelist','mov,matroska,webm,avi,mpeg,mpegts,flv,ogg']

def probe(config,path):
    raw = run_tool(config.ffprobe,['-v','error',*LOCAL_INPUT,'-show_streams','-show_format','-of','json',str(path)],config.media_timeout_seconds)
    try:
        data = json.loads(raw)
        video = next(stream for stream in data.get('streams',[]) if stream.get('codec_type')=='video' and not stream.get('disposition',{}).get('attached_pic'))
        width,height = int(video['width']),int(video['height'])
        duration = float(video.get('duration') or data.get('format',{}).get('duration') or 0)
        rate = video.get('avg_frame_rate') or video.get('r_frame_rate') or '0/1'
        fps = float(Fraction(rate)) if rate not in ('0/0','N/A') else None
        if not (0<width<=16384 and 0<height<=16384 and math.isfinite(duration) and duration>0):
            raise ValueError()
        return {'width':width,'height':height,'fps':fps if fps is None or (math.isfinite(fps) and fps>0) else None,'duration_ms':round(duration*1000)}
    except (ValueError,KeyError,StopIteration,TypeError,ZeroDivisionError):
        raise MediaFailure('invalid_media','未发现有效视频轨或媒体元信息不完整。')

def transcode(config,path,target,thumbnail):
    run_tool(config.ffmpeg,['-nostdin','-hide_banner','-loglevel','error','-y',*LOCAL_INPUT,'-i',str(path),'-map','0:v:0','-map','0:a:0?','-vf','scale=trunc(iw/2)*2:trunc(ih/2)*2','-c:v','libx264','-preset','veryfast','-crf','23','-pix_fmt','yuv420p','-c:a','aac','-movflags','+faststart',str(target)],config.media_timeout_seconds)
    try:
        run_tool(config.ffmpeg,['-nostdin','-hide_banner','-loglevel','error','-y','-i',str(target),'-frames:v','1','-q:v','4',str(thumbnail)],min(config.media_timeout_seconds,30))
    except MediaFailure:
        return False
    return thumbnail.is_file()
