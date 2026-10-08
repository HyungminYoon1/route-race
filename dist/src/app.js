import {defaultBoard,randomBoard,solve,paint} from "./model.js";
import {expose,tool,canvasPointer,clamp,number} from "./ui.js";
const $=s=>document.querySelector(s),algorithms=["bfs","dijkstra","astar"],colors={bfs:"#4f92d7",dijkstra:"#5a9f73",astar:"#9d78c8"};
let board=defaultBoard(),mode="wall",cursor={x:1,y:5},results=null,progress=0,running=false,last=0,seed=10,drawing=false,lastCell=-1;
function summary(){return {width:board.width,height:board.height,start:board.start,end:board.end,wallCount:board.cells.filter(v=>v===-1).length,weightedCount:board.cells.filter(v=>v===5).length,progress,results:results?.map(r=>({algorithm:r.algorithm,found:r.found,visited:r.visited.length,cost:r.cost,steps:r.steps}))??null};}
function draw(canvas,result){
  const ctx=canvas.getContext("2d"),w=canvas.width/board.width,h=canvas.height/board.height,visited=new Set(result?.visited.slice(0,progress)??[]),finished=result&&progress>=result.visited.length,path=finished?new Set(result.path):new Set();
  ctx.clearRect(0,0,canvas.width,canvas.height);
  for(let i=0;i<board.cells.length;i++){const x=i%board.width*w,y=Math.floor(i/board.width)*h;ctx.fillStyle=board.cells[i]===-1?"#273a57":board.cells[i]===5?"#f2d4af":"#f0f4fa";if(visited.has(i))ctx.fillStyle=colors[result.algorithm]+"55";if(path.has(i))ctx.fillStyle=colors[result.algorithm];
    ctx.fillRect(x+1,y+1,w-2,h-2);if(board.cells[i]===5&&!path.has(i)){ctx.fillStyle="#9d6c32";ctx.font="16px system-ui";ctx.textAlign="center";ctx.fillText("5",x+w/2,y+h*.64);}
    if(i===board.start||i===board.end){ctx.fillStyle=i===board.start?"#3578cd":"#e1be5a";ctx.fillRect(x+1,y+1,w-2,h-2);ctx.fillStyle=i===board.start?"#fff":"#263c5e";ctx.font="bold 22px system-ui";ctx.textAlign="center";ctx.fillText(i===board.start?"S":"E",x+w/2,y+h*.69);}
  }
  if(!result){ctx.strokeStyle="#d77e21";ctx.lineWidth=3;ctx.strokeRect(cursor.x*w+2,cursor.y*h+2,w-4,h-4);}
}
function render(){
  draw($("#map"));$("#cursor").textContent="선택한 칸: "+(cursor.x+1)+"열 · "+(cursor.y+1)+"행";
  const max=Math.max(1,...(results??[]).map(r=>r.visited.length));$("#progress").max=max;$("#progress").value=progress;$("#stepOut").textContent=progress+" / "+(results?max:"—");$("#play").textContent=running?"일시 정지":"재생";
  for(const a of algorithms){const r=results?.find(r=>r.algorithm===a);draw($("#"+a),r);const done=r&&progress>=r.visited.length,container=$("#"+a+"Metrics");container.replaceChildren();
    for(const [label,value]of [["방문한 칸",r?Math.min(progress,r.visited.length):"—"],["이동 횟수",done?(r.found?r.steps:"없음"):"—"],["경로 비용",done?(r.found?r.cost:"없음"):"—"]]){const div=document.createElement("div"),span=document.createElement("span"),strong=document.createElement("strong");span.textContent=label;strong.textContent=value;div.append(span,strong);container.append(div);}
  }
}
function solveAll(reveal=false){
  results=algorithms.map(a=>solve(board,a));running=!reveal;progress=reveal?Math.max(...results.map(r=>r.visited.length)):0;
  $("#status").textContent=results.every(r=>r.found)?"같은 지도에서 탐색을 시작합니다. 주황색 험지를 피하는지 비교하세요.":"경로가 없는 지도입니다. 도착점 주변의 벽을 지워 다시 시도해 보세요.";
  render();return summary();
}
function applyPaint(x,y,newMode=mode){
  const next=paint(board,x,y,newMode);board=next;cursor={x,y};results=null;running=false;progress=0;$("#status").textContent="지도가 변경되었습니다. 세 알고리즘 실행을 눌러 다시 비교하세요.";render();return summary();
}
function replace(next){board=next;results=null;running=false;progress=0;cursor={x:board.start%board.width,y:Math.floor(board.start/board.width)};render();$("#status").textContent="새 지도입니다. 지형을 바꾼 뒤 알고리즘을 실행해 보세요.";}
for(const b of document.querySelectorAll("[data-mode]"))b.addEventListener("click",()=>{mode=b.dataset.mode;for(const item of document.querySelectorAll("[data-mode]"))item.setAttribute("aria-pressed",String(item===b));});
const map=$("#map");
function pointer(event){const p=canvasPointer(map,event),x=clamp(Math.floor(p.x/map.width*board.width),0,board.width-1),y=clamp(Math.floor(p.y/map.height*board.height),0,board.height-1),i=y*board.width+x;if(i!==lastCell){lastCell=i;applyPaint(x,y);}}
map.addEventListener("pointerdown",e=>{drawing=true;lastCell=-1;map.setPointerCapture(e.pointerId);pointer(e);});
map.addEventListener("pointermove",e=>{if(drawing)pointer(e);});map.addEventListener("pointerup",()=>{drawing=false;lastCell=-1;});map.addEventListener("pointercancel",()=>drawing=false);
map.addEventListener("keydown",e=>{const keys={ArrowRight:[1,0],ArrowLeft:[-1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};if(keys[e.key]){e.preventDefault();cursor={x:clamp(cursor.x+keys[e.key][0],0,board.width-1),y:clamp(cursor.y+keys[e.key][1],0,board.height-1)};render();}else if(e.key===" "){e.preventDefault();applyPaint(cursor.x,cursor.y);}});
$("#run").addEventListener("click",()=>solveAll());$("#sample").addEventListener("click",()=>replace(defaultBoard()));$("#random").addEventListener("click",()=>replace(randomBoard(++seed)));$("#clear").addEventListener("click",()=>{const next=defaultBoard();next.cells.fill(1);replace(next);});
$("#play").addEventListener("click",()=>{if(!results){solveAll();return;}if(progress>=Math.max(...results.map(r=>r.visited.length)))progress=0;running=!running;render();});
$("#next").addEventListener("click",()=>{if(!results)solveAll();running=false;progress=Math.min(progress+1,Math.max(...results.map(r=>r.visited.length)));render();});
$("#finish").addEventListener("click",()=>{if(!results)solveAll(true);running=false;progress=Math.max(...results.map(r=>r.visited.length));render();});
$("#progress").addEventListener("input",e=>{running=false;progress=Number(e.target.value);render();});
document.addEventListener("visibilitychange",()=>{if(document.hidden){running=false;render();}});
function frame(now){if(running&&now-last>35){progress=Math.min(progress+1,Math.max(...results.map(r=>r.visited.length)));if(progress>=Math.max(...results.map(r=>r.visited.length)))running=false;render();last=now;}requestAnimationFrame(frame);}
render();requestAnimationFrame(frame);
expose([
  tool("read_route_state","Read board parameters and actual shortest-path result summaries.",{},()=>summary(),true),
  tool("paint_route_cell","Paint a bounded grid cell with the same editor modes as the page.",{x:{type:"integer",minimum:0,maximum:19},y:{type:"integer",minimum:0,maximum:11},mode:{type:"string",enum:["wall","weight","erase","start","end"]}},input=>applyPaint(input.x,input.y,input.mode)),
  tool("solve_route_race","Compute all three algorithms on the current map and show full results.",{},()=>solveAll(true))
]);
