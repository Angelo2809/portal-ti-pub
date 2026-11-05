import React, { useEffect, useRef } from 'react';

const TAU = Math.PI * 2;
const waves = [
  { points: [[-.12,.23],[0,.26],[.16,.34],[.32,.58],[.52,.62],[.72,.53],[.87,.34],[1.12,-.06]], depth:.20, dots:1 },
  { points: [[-.12,.49],[0,.50],[.16,.51],[.35,.72],[.54,.82],[.73,.88],[.88,.72],[1.12,.54]], depth:.19, dots:.8 },
  { points: [[-.12,.93],[0,.85],[.18,.69],[.35,.78],[.53,1.02],[.68,1.08],[.83,.81],[1.12,.59]], depth:.20, dots:.65 },
];

function curve(points, x) {
  let i = 0;
  while (i < points.length - 2 && x > points[i + 1][0]) i++;
  const [x0, y0] = points[i], [x1, y1] = points[i + 1];
  const before = points[Math.max(0, i - 1)], after = points[Math.min(points.length - 1, i + 2)];
  const t = Math.max(0, Math.min(1, (x - x0) / (x1 - x0)));
  const m0 = (y1 - before[1]) / (x1 - before[0]) * (x1 - x0);
  const m1 = (after[1] - y0) / (after[0] - x0) * (x1 - x0);
  return (2*t*t*t - 3*t*t + 1)*y0 + (t*t*t - 2*t*t + t)*m0 + (-2*t*t*t + 3*t*t)*y1 + (t*t*t - t*t)*m1;
}

function paint(canvas, time) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h) return;
  ctx.clearRect(0, 0, w, h);
  const base = ctx.createLinearGradient(0, 0, w, h);
  base.addColorStop(0, '#032760');
  base.addColorStop(.48, '#053777');
  base.addColorStop(1, '#00153f');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);

  const glow = (x, y, radius, color) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x-radius, y-radius, radius*2, radius*2);
  };
  glow(w*.76, h*.22, w*.42, 'rgba(0,115,255,.19)');
  glow(w*.09, h*.52, w*.35, 'rgba(0,137,255,.18)');
  glow(w*.59, h*.68, w*.34, 'rgba(0,78,220,.17)');

  // Broad translucent ribbons give the glowing edges some depth.
  waves.forEach((wave, band) => {
    const yAt = (u) => (curve(wave.points, u) + Math.sin(u*TAU*1.15 + time*(band%2 ? -.55 : .48))* .028) * h;
    const fill = ctx.createLinearGradient(0, 0, 0, h);
    fill.addColorStop(0, 'rgba(26,119,255,.13)');
    fill.addColorStop(.42, band === 0 ? 'rgba(2,34,93,.68)' : 'rgba(3,46,114,.58)');
    fill.addColorStop(1, 'rgba(0,18,60,.16)');
    ctx.beginPath();
    for (let x=0; x<=w+8; x+=8) x===0 ? ctx.moveTo(x,yAt(x/w)) : ctx.lineTo(x,yAt(x/w));
    for (let x=w; x>=0; x-=8) ctx.lineTo(x,yAt(x/w)+h*wave.depth);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();

    // A soft halo sits below each precise blue edge.
    ctx.beginPath();
    for (let x=0; x<=w+4; x+=4) x===0 ? ctx.moveTo(x,yAt(x/w)) : ctx.lineTo(x,yAt(x/w));
    const line = ctx.createLinearGradient(0, 0, w, 0);
    line.addColorStop(0, '#008dff');
    line.addColorStop(.22, '#8cdbff');
    line.addColorStop(.52, '#0072ef');
    line.addColorStop(.8, '#45bdff');
    line.addColorStop(1, '#009cff');
    ctx.strokeStyle = line;
    ctx.lineWidth = band === 0 ? 2.3 : 1.9;
    ctx.shadowColor = '#008cff';
    ctx.shadowBlur = 22;
    ctx.stroke();
    ctx.shadowBlur = 0;

    const cols = Math.min(160, Math.max(94, Math.floor(w/10)));
    const rows = 18;
    const direction = band % 2 ? -1 : 1;
    for (let c=0; c<cols; c++) {
      for (let r=0; r<rows; r++) {
        // Carry each row along the ribbon, with slightly different speeds for depth.
        const speed = direction * (.027 + r*.00045);
        const u = ((c/cols + time*speed + r*.002)%1 + 1)%1;
        const x = u*w;
        const seed = Math.sin(c*127.1 + r*311.7 + band*71.3)*43758.5453;
        const noise = seed-Math.floor(seed);
        const v = r/(rows-1);
        const y = yAt(u) + (v*.95 + Math.sin(u*TAU*3+r*.4+time*1.2)*.035)*h*wave.depth;
        if (y<0 || y>h) continue;
        const fade = Math.sin(v*Math.PI)*(.45+noise*.55);
        const edgeFade = Math.min(1, u*35, (1-u)*35);
        const shimmer = .8 + .2*Math.sin(time*1.8 + c*.3 + r);
        const alpha = (.10+fade*.66)*wave.dots*edgeFade*shimmer;
        ctx.beginPath();
        ctx.arc(x,y,noise>.96?1.35:.48+noise*.63,0,TAU);
        ctx.fillStyle = `rgba(0,${115+Math.floor(noise*75)},255,${alpha})`;
        ctx.fill();
      }
    }
  });

  // Dark blue folded shapes keep the background layered like the reference.
  ctx.beginPath();
  ctx.moveTo(0,0);
  ctx.bezierCurveTo(w*.16,h*.03,w*.26,h*.26,w*.43,h*.33);
  ctx.bezierCurveTo(w*.62,h*.43,w*.78,h*.30,w,0);
  ctx.closePath();
  const top = ctx.createLinearGradient(0,0,w*.8,h*.55);
  top.addColorStop(0,'rgba(0,14,51,.75)');
  top.addColorStop(1,'rgba(5,58,135,.04)');
  ctx.fillStyle=top;
  ctx.fill();

  for (let i=0; i<44; i++) {
    const seed = Math.sin(i*51.7)*10000;
    const u = ((seed-Math.floor(seed)+time*(.012+i%3*.004))%1);
    const x = u*w;
    const v = ((Math.sin(i*21.2)*10000%1-time*(.007+i%4*.002))%1+1)%1;
    const y = v*h + Math.sin(time*.8+i)*8;
    const pulse = .5+.5*Math.sin(time*1.2+i);
    ctx.beginPath();
    ctx.arc(x,y,.9+pulse*1.2,0,TAU);
    const edgeFade = Math.min(1,u*25,(1-u)*25,v*25,(1-v)*25);
    ctx.fillStyle=`rgba(0,155,255,${(.2+pulse*.45)*edgeFade})`;
    ctx.fill();
  }
}

export default function LoginMotionBackground() {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0, previous = 0, stopped = false;
    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(canvas.clientWidth*ratio);
      canvas.height = Math.round(canvas.clientHeight*ratio);
      canvas.getContext('2d').setTransform(ratio,0,0,ratio,0,0);
      paint(canvas,0);
    };
    const render = timestamp => {
      if (stopped || reduced.matches) return;
      if (timestamp-previous>=1000/30) {paint(canvas,timestamp/1000);previous=timestamp;}
      frame=requestAnimationFrame(render);
    };
    const restart = () => {cancelAnimationFrame(frame);paint(canvas,0);if(!reduced.matches)frame=requestAnimationFrame(render);};
    const observer=new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    restart();
    reduced.addEventListener('change',restart);
    return () => {stopped=true;cancelAnimationFrame(frame);observer.disconnect();reduced.removeEventListener('change',restart);};
  },[]);
  return <canvas ref={ref} className="login-motion-canvas" aria-hidden="true"/>;
}
