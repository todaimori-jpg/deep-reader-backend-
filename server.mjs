import http from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = dirname(fileURLToPath(import.meta.url));
const VERSION = "deep-reader-2.1-health-static-20261106";

const PORT = process.env.PORT || 8787;
const API_KEY = process.env.OPENAI_API_KEY;
if (!API_KEY) console.warn("OPENAI_API_KEY is not set.");

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
};

const server = http.createServer(async (req,res)=>{
  const pathname = new URL(req.url, "http://localhost").pathname.replace(/\/$/, "") || "/";
  if(req.method==="OPTIONS"){res.writeHead(204,cors);return res.end();}
  if(pathname==="/api/health" && req.method==="GET"){
    res.writeHead(API_KEY?200:503,{"Content-Type":"application/json",...cors});
    return res.end(JSON.stringify({ok:!!API_KEY,service:"Deep Reader Neural Backend",version:VERSION,apiKeyConfigured:!!API_KEY}));
  }
  if(pathname==="/api/speech" && req.method==="POST"){
    if(!API_KEY){res.writeHead(503,{"Content-Type":"application/json",...cors});return res.end(JSON.stringify({error:"OPENAI_API_KEY is not configured"}));}
    let body="";
    for await (const c of req) body+=c;
    try{
      const {text,voice="marin",speed=1}=JSON.parse(body||"{}");
      if(!text?.trim()) throw new Error("No text supplied");
      const r=await fetch("https://api.openai.com/v1/audio/speech",{
        method:"POST",
        headers:{"Authorization":`Bearer ${API_KEY}`,"Content-Type":"application/json"},
        body:JSON.stringify({
          model:"gpt-4o-mini-tts",
          voice,
          input:text,
          response_format:"mp3",
          speed,
          instructions:"Read as a polished professional audiobook narrator. Use natural phrasing, subtle expressive emphasis, intelligent pauses at paragraph and sentence boundaries, and a calm human cadence. Preserve every word exactly. Do not add commentary."
        })
      });
      if(!r.ok){
        const err=await r.text();
        res.writeHead(r.status,{"Content-Type":"application/json",...cors});
        return res.end(err);
      }
      const audio=Buffer.from(await r.arrayBuffer());
      res.writeHead(200,{"Content-Type":"audio/mpeg","Content-Length":audio.length,...cors});
      return res.end(audio);
    }catch(e){
      res.writeHead(400,{"Content-Type":"application/json",...cors});
      return res.end(JSON.stringify({error:e.message}));
    }
  }
  if(req.method==="GET" && (pathname==="/" || pathname==="/reader" || pathname==="/reader/index.html")){
    try { const page = await readFile(join(ROOT,"reader","index.html")); res.writeHead(200,{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store",...cors});return res.end(page); }
    catch(e){res.writeHead(500,{"Content-Type":"application/json",...cors});return res.end(JSON.stringify({error:"Reader not found",detail:e.message}));}
  }
  res.writeHead(404,{"Content-Type":"application/json",...cors});
  res.end(JSON.stringify({error:"Not found"}));
});
server.listen(PORT,()=>console.log(`Deep Reader backend listening on ${PORT}`));
