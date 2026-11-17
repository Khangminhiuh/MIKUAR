// Each feature keeps its original brightness patch and its last screen position.
const radius=3;
function sample(frame,w,x,y){
 const values=[];
 for(let j=-radius;j<=radius;j++)for(let i=-radius;i<=radius;i++)values.push(frame[(y+j)*w+x+i]);
 const mean=values.reduce((a,b)=>a+b,0)/values.length;
 return values.map(v=>v-mean);
}
export function pick(frame,w,h,x,y){
 const candidates=[];
 for(let j=Math.max(5,Math.round(y)-34);j<Math.min(h-5,y+35);j+=3){
  for(let i=Math.max(5,Math.round(x)-34);i<Math.min(w-5,x+35);i+=3){
   let xx=0,yy=0,xy=0;
   for(let v=-2;v<=2;v++)for(let u=-2;u<=2;u++){
    const k=(j+v)*w+i+u,gx=frame[k+1]-frame[k-1],gy=frame[k+w]-frame[k-w];
    xx+=gx*gx;yy+=gy*gy;xy+=gx*gy;
   }
   const score=(xx+yy-Math.hypot(xx-yy,2*xy))/2;
   if(score>1900)candidates.push({x:i,y:j,score});
  }
 }
 const points=[];
 for(const c of candidates.sort((a,b)=>b.score-a.score)){
  if(points.some(p=>Math.hypot(p.x-c.x,p.y-c.y)<9))continue;
  points.push({...c,ox:c.x,oy:c.y,patch:sample(frame,w,c.x,c.y)});
  if(points.length===14)break;
 }
 return points.length>=4?{points,x,y,scale:1,angle:0,origin:[x,y]}:null;
}
function match(p,frame,w,h){
 let bx=0,by=0,best=Infinity;
 for(let y=Math.max(radius,p.y-11);y<=Math.min(h-radius-1,p.y+11);y++){
  for(let x=Math.max(radius,p.x-11);x<=Math.min(w-radius-1,p.x+11);x++){
   let sum=0,square=0,k=0;
   for(let j=-radius;j<=radius;j++)for(let i=-radius;i<=radius;i++){
    const diff=frame[(y+j)*w+x+i]-p.patch[k++];sum+=diff;square+=diff*diff;
   }
   const cost=square/k-(sum/k)**2+.08*((x-p.x)**2+(y-p.y)**2);
   if(cost<best){best=cost;bx=x;by=y}
  }
 }
 return best<560?{...p,x:bx,y:by}:null;
}
export function track(state,frame,w,h){
 const matches=state.points.map(p=>match(p,frame,w,h)).filter(Boolean);
 let best=[],fit=null;
 for(let i=0;i<matches.length;i++)for(let j=i+1;j<matches.length;j++){
  const p=matches[i],q=matches[j],ox=q.ox-p.ox,oy=q.oy-p.oy,den=ox*ox+oy*oy;
  if(den<121)continue;
  const dx=q.x-p.x,dy=q.y-p.y,a=(dx*ox+dy*oy)/den,b=(dy*ox-dx*oy)/den,s=Math.hypot(a,b);
  if(s<.55||s>1.8)continue;
  const tx=p.x-a*p.ox+b*p.oy,ty=p.y-b*p.ox-a*p.oy;
  const agree=matches.filter(m=>Math.hypot(a*m.ox-b*m.oy+tx-m.x,b*m.ox+a*m.oy+ty-m.y)<2.6);
  if(agree.length>best.length){best=agree;fit={a,b,tx,ty,s}}
 }
 if(best.length<Math.max(3,Math.ceil(state.points.length*.42)))return null;
 const {a,b,tx,ty,s}=fit,[ox,oy]=state.origin;
 const points=state.points.map(p=>({...p,x:Math.round(a*p.ox-b*p.oy+tx),y:Math.round(b*p.ox+a*p.oy+ty)}));
 return {...state,points,x:a*ox-b*oy+tx,y:b*ox+a*oy+ty,scale:s,angle:Math.atan2(b,a)};
}
