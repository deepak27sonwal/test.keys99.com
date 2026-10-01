const { chromium } = require("playwright");
const ROW = { id:"abc-123", slug:"lodha-dighi-pune", developer:"Lodha", city:"Pune", locality:"Dighi",
  state:"Maharashtra", status:"New Launch", overview:"Text.", title:"Mangalam Momento",
  bhk_options:[{type:"2 BHK",price:7500000,sqft:785,areaUnit:"Sq.Ft"}], amenities:[], gallery_images:[],
  nearby_landmarks:[], main_image:null, views:1 };

function stub(match){
  return `window.supabase={createClient:()=>({
    from:()=>{const b={_col:null,_val:null,
      select:()=>b, eq:(c,v)=>{b._col=c;b._val=v;return b;},
      single:async()=>({data:${JSON.stringify(ROW)},error:null}),
      maybeSingle:async()=>({data: b._val===${JSON.stringify(match)} ? ${JSON.stringify(ROW)} : null, error:null}),
      order:()=>b, limit:()=>b, then:r=>r({data:[],error:null})};return b;},
    auth:{getSession:async()=>({data:{session:null},error:null}),getUser:async()=>({data:{user:null},error:null}),
          onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
    rpc:async()=>({data:null,error:null})})};`;
}

(async () => {
  const b = await chromium.launch({ executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    proxy:{ server:process.env.HTTPS_PROXY, bypass:"127.0.0.1,localhost" } });

  for(const [label, url, known] of [
    ["known slug",   "projects/property-details.html?slug=lodha-dighi-pune", "lodha-dighi-pune"],
    ["unknown slug", "projects/property-details.html?slug=nagpur",           "lodha-dighi-pune"],
  ]){
    const ctx = await b.newContext({ ignoreHTTPSErrors:true });
    const p = await ctx.newPage();
    await p.addInitScript(stub(known));
    await p.route("**/cdn.jsdelivr.net/**", r=>r.fulfill({status:200,contentType:"application/javascript",body:""}));
    await p.route("**/*.supabase.co/**", r=>r.abort());
    await p.goto("http://127.0.0.1:8080/"+url,{waitUntil:"domcontentloaded"});
    await p.waitForTimeout(2500);
    const finalUrl = p.url().replace("http://127.0.0.1:8080/","");
    const heading = await p.locator("#propertyName").textContent().catch(()=>"(none)");
    console.log(`  ${label.padEnd(13)} -> ${finalUrl}`);
    console.log(`  ${"".padEnd(13)}    heading: ${heading.trim() || "(empty)"}`);
    await ctx.close();
  }
  await b.close();
})();
