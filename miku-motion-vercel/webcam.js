import {pick,track} from './patches.mjs';
const el=id=>document.getElementById(id);
const video=el('feed'),canvas=el('overlay'),ctx=canvas.getContext('2d'),sprite=el('poster');
const buffer=document.createElement('canvas'),capture=buffer.getContext('2d',{willReadFrequently:true});
let stream,active=false,ticket=0,frame,lastVideo=-1,lastTick=0,state=null,pixels=null;
function say(message){el('status').textContent=message}
function stop(message){
 ticket++;active=false;cancelAnimationFrame(frame);stream?.getTracks().forEach(t=>t.stop());stream=null;
 video.srcObject=null;state=null;pixels=null;lastVideo=-1;
 canvas.hidden=video.hidden=el('center').hidden=true;sprite.hidden=false;
 el('desk').style.aspectRatio='4 / 3';el('power').textContent='Bật webcam';say(message);
}
function place(x,y){
 if(!pixels)return;
 state=pick(pixels,buffer.width,buffer.height,x,y);
 say(state?'Đã đặt Miku. Nhấp vào điểm khác để đổi chỗ.':'Chỗ này thiếu chi tiết. Nhấp vào nét chữ hoặc góc của một hình.');
}
canvas.onpointerdown=e=>{
 const box=canvas.getBoundingClientRect();
 place((e.clientX-box.left)/box.width*buffer.width,(e.clientY-box.top)/box.height*buffer.height);
};
el('center').onclick=()=>place(buffer.width/2,buffer.height/2);
function draw(now){
 if(!active)return;
 if(video.readyState>=2 && video.videoWidth && lastVideo!==video.currentTime && now-lastTick>=45){
  lastTick=now;lastVideo=video.currentTime;
  const w=video.videoWidth,h=video.videoHeight;
  if(canvas.width!==w||canvas.height!==h||!pixels){
   canvas.width=w;canvas.height=h;buffer.width=280;buffer.height=Math.max(1,Math.round(h*280/w));el('desk').style.aspectRatio=w+' / '+h;state=null;
  }
  capture.drawImage(video,0,0,buffer.width,buffer.height);
  const image=capture.getImageData(0,0,buffer.width,buffer.height).data;
  pixels??=new Uint8Array(buffer.width*buffer.height);
  if(pixels.length!==image.length/4)pixels=new Uint8Array(image.length/4);
  for(let i=0;i<pixels.length;i++){const k=i*4;pixels[i]=(image[k]+2*image[k+1]+image[k+2])/4}
  ctx.clearRect(0,0,w,h);
  if(state){
   state=track(state,pixels,buffer.width,buffer.height);
   if(!state)say('Mất điểm bám. Nhấp lại vào vị trí có chi tiết để đặt Miku.');
   else{
    const height=h*.28*state.scale,width=height*sprite.naturalWidth/sprite.naturalHeight;
    ctx.save();ctx.translate(state.x*w/buffer.width,state.y*h/buffer.height);ctx.rotate(state.angle);
    ctx.drawImage(sprite,-width/2,-height,width,height);ctx.restore();
   }
  }
 }
 frame=requestAnimationFrame(draw);
}
el('power').onclick=async()=>{
 if(active){stop('Webcam đã tắt.');return}
 active=true;const id=++ticket;el('power').textContent='Tắt webcam';say('Đang mở webcam…');
 try{
  if(!navigator.mediaDevices?.getUserMedia)throw Error('unsupported');
  const input=await navigator.mediaDevices.getUserMedia({audio:false,video:{width:{ideal:960},height:{ideal:540}}});
  if(id!==ticket){input.getTracks().forEach(t=>t.stop());return}
  stream=input;video.srcObject=input;
  await Promise.all([video.play(),sprite.decode()]);if(id!==ticket)return;
  stream.getVideoTracks()[0].onended=()=>{if(id===ticket)stop('Webcam đã ngắt kết nối.')};
  video.hidden=canvas.hidden=el('center').hidden=false;sprite.hidden=true;
  say('Nhấp vào một chi tiết trong hình để đặt Miku.');frame=requestAnimationFrame(draw);
 }catch(e){if(id===ticket)stop(e.name==='NotAllowedError'?'Hãy cấp quyền camera cho trang rồi bật lại.':e.name==='NotFoundError'?'Chưa tìm thấy webcam. Hãy kết nối camera rồi thử lại.':'Không mở được webcam. Kiểm tra camera và thử lại.')}
};
window.addEventListener('pagehide',()=>stop('Webcam đã tắt.'));
