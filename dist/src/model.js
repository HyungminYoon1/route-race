import {rng} from "./ui.js";
export const WIDTH=20,HEIGHT=12;
export function defaultBoard(){
  const cells=Array(WIDTH*HEIGHT).fill(1);
  for(let x=4;x<=15;x++)cells[5*WIDTH+x]=5;
  for(const y of [1,2,3,8,9,10])cells[y*WIDTH+10]=-1;
  return {width:WIDTH,height:HEIGHT,cells,start:5*WIDTH+1,end:5*WIDTH+18};
}
export function validate(board){
  if(!board||!Number.isInteger(board.width)||!Number.isInteger(board.height)||board.width<2||board.height<2||board.width>30||board.height>20||!Array.isArray(board.cells)||board.cells.length!==board.width*board.height||board.cells.some(v=>![-1,1,5].includes(v)))throw new TypeError("Invalid board");
  for(const key of ["start","end"])if(!Number.isInteger(board[key])||board[key]<0||board[key]>=board.cells.length||board.cells[board[key]]===-1)throw new TypeError("Invalid endpoint");
  return board;
}
export function neighbors(board,index){
  const x=index%board.width,y=Math.floor(index/board.width),out=[];
  for(const [dx,dy]of [[1,0],[0,1],[-1,0],[0,-1]]){const nx=x+dx,ny=y+dy;if(nx>=0&&ny>=0&&nx<board.width&&ny<board.height&&board.cells[ny*board.width+nx]!==-1)out.push(ny*board.width+nx);}
  return out;
}
export function solve(board,algorithm){
  validate(board);if(!["bfs","dijkstra","astar"].includes(algorithm))throw new TypeError("Unknown algorithm");
  const size=board.cells.length,dist=Array(size).fill(Infinity),prev=Array(size).fill(-1),closed=new Set(),visited=[],frontier=[board.start];
  dist[board.start]=0;
  const heuristic=i=>algorithm==="astar"?Math.abs(i%board.width-board.end%board.width)+Math.abs(Math.floor(i/board.width)-Math.floor(board.end/board.width)):0;
  while(frontier.length){
    let at=0;if(algorithm!=="bfs")for(let i=1;i<frontier.length;i++)if(dist[frontier[i]]+heuristic(frontier[i])<dist[frontier[at]]+heuristic(frontier[at]))at=i;
    const current=frontier.splice(at,1)[0];if(closed.has(current))continue;closed.add(current);visited.push(current);if(current===board.end)break;
    for(const next of neighbors(board,current)){
      const cost=dist[current]+(algorithm==="bfs"?1:board.cells[next]);
      if(cost<dist[next]){dist[next]=cost;prev[next]=current;frontier.push(next);}
    }
  }
  const found=closed.has(board.end),path=[];if(found)for(let cur=board.end;cur!==-1;cur=prev[cur]){path.push(cur);if(cur===board.start)break;}path.reverse();
  return {algorithm,visited,path,found,steps:found?path.length-1:null,cost:found?path.slice(1).reduce((sum,i)=>sum+board.cells[i],0):null};
}
export function paint(board,x,y,mode){
  validate(board);if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=board.width||y>=board.height||!["wall","weight","erase","start","end"].includes(mode))throw new TypeError("Invalid paint action");
  const index=y*board.width+x,next=structuredClone(board);
  if(mode==="start"||mode==="end"){next[mode]=index;next.cells[index]=1;}else if(index!==board.start&&index!==board.end)next.cells[index]={wall:-1,weight:5,erase:1}[mode];
  return next;
}
export function randomBoard(seed=1){
  const b=defaultBoard(),random=rng(seed);b.cells=b.cells.map(()=>random()<.22?-1:random()<.22?5:1);b.cells[b.start]=b.cells[b.end]=1;return b;
}
