import { readdir, readFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
const root = resolve("dist");
let count = 0;
async function walk(dir) {
  for (const e of await readdir(dir, {withFileTypes:true})) {
    const p = resolve(dir,e.name);
    if(e.isDirectory()) { await walk(p); continue; }
    count++;
    if(/\.(js|css|html)$/.test(e.name)) {
      const bytes=await readFile(p);
      assert(!(bytes[0]===239&&bytes[1]===187&&bytes[2]===191),"Unexpected BOM");
    }
    if(e.name.endsWith(".js")) execFileSync(process.execPath,["--check",p],{stdio:"inherit"});
    if(!e.name.endsWith(".html")) continue;
    const html=await readFile(p,"utf8");
    assert(html.includes('lang="ko"')&&html.includes('name="viewport"')&&html.includes('<title>'),"Missing metadata");
    assert(html.includes("connect-src 'none'")&&html.includes("object-src 'none'"),"Missing connection policy");
    assert(!/<iframe\b|\son\w+=/i.test(html),"Inline execution or frame");
    for(const [,ref] of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
      if(/^(https?:|data:)/.test(ref)) continue;
      const target=resolve(dirname(p),ref.endsWith("/")?ref+"index.html":ref);
      assert(target.startsWith(root+sep),"Asset escaped dist");
      await readFile(target);
    }
  }
}
await walk(root);
console.log(`PASS: ${count} public files; syntax, local references, metadata, CSP and UTF-8 without BOM.`);
