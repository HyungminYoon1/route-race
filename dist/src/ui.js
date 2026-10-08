export function rng(seed=1) {
  let s=(Number(seed)>>>0)||1;
  return () => { s=(Math.imul(s,1664525)+1013904223)>>>0; return s/4294967296; };
}
export function clamp(n,min,max) { return Math.min(max,Math.max(min,n)); }
export function number(value,min,max,label="value") {
  const n=Number(value);
  if(!Number.isFinite(n)||n<min||n>max) throw new RangeError(`Invalid ${label}`);
  return n;
}
export function expose(tools) {
  const context=document.modelContext;
  if(!context?.registerTool) return false;
  const lifecycle=new AbortController();
  for(const tool of tools) {
    try { Promise.resolve(context.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{}); } catch {}
  }
  window.addEventListener("pagehide",()=>lifecycle.abort(),{once:true});
  return true;
}
export function tool(name,description,properties,execute,readOnly=false) {
  return {name,description,inputSchema:{type:"object",properties,additionalProperties:false},annotations:{readOnlyHint:readOnly,untrustedContentHint:false},
    execute(input={}) {
      if(!input||typeof input!=="object"||Array.isArray(input)||Object.keys(input).some(k=>!Object.hasOwn(properties,k))) throw new TypeError("Unexpected input");
      return execute(input);
    }};
}
export function canvasPointer(canvas,event) {
  const r=canvas.getBoundingClientRect();
  return {x:(event.clientX-r.left)*canvas.width/r.width,y:(event.clientY-r.top)*canvas.height/r.height};
}
