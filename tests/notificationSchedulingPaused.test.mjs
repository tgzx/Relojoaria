import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
const app=readFileSync(new URL("../js/admin.js",import.meta.url),"utf8");
const edge=readFileSync(new URL("../supabase/functions/process-scheduled-push/index.ts",import.meta.url),"utf8");
test("disabled scheduling cannot enqueue or implicitly send even with injected dates and recurrence",async()=>{
 const save=app.slice(app.indexOf("async function saveNotification(event)"),app.indexOf("function parseDateTimeLocalValue(value)"));
 for(const editing of [null,"existing"]){
 const writes=[],calls=[],state={editingNotificationId:editing,store:{id:"s"},profile:{id:"u"},workspaceViews:{}};
 const ctx={NOTIFICATION_SCHEDULING_ENABLED:false,adminState:state,FormData:class{get(k){return {title:"Test",body:"Message",scheduled_at:"2000-01-01T00:00",recurrence_rule:"daily"}[k];}},syncNotificationScheduledAt(){throw Error("unexpected sync");},parseDateTimeLocalValue(){throw Error("unexpected parse");},adminSaveNotification:async p=>{writes.push(p);return{id:"saved"};},sendNotification:async()=>calls.push("send"),showToast(){},adminListNotifications:async()=>[],clearAdminFormDirty(){},renderAdminLayout(){},console};
 await vm.runInNewContext(save+"\nsaveNotification({preventDefault(){},currentTarget:{}});",ctx);
 assert.equal(writes.length,1);for(const k of ["scheduled_at","recurrence_rule","recurrence_next_at"])assert.equal(writes[0][k],null);
 assert.equal(writes[0].status,"draft");assert.equal(calls.length,0);
 }
});
test("scheduler returns paused after auth and before any backend read or send",async()=>{
 const code=edge.slice(edge.indexOf("const corsHeaders"),edge.indexOf("async function sendScheduledNotification"));
 let handler;const ctx={serve:h=>handler=h,Deno:{env:{get:k=>{assert.equal(k,"CRON_SECRET");return "qa";}}},jsonResponse:(p,status=200)=>({p,status}),Response,createClient(){throw Error("unexpected database");}};
 vm.runInNewContext(code,ctx);
 for(const secret of ["bad","qa"]){const r=await handler({method:"POST",headers:{get:()=>secret}});assert.equal(r.status,secret==="qa"?200:401);if(secret==="qa"){assert.equal(r.p.paused,true);assert.equal(r.p.processed,0);}}
});
test("manual send uses unchanged endpoint and remains available",()=>{
 assert.match(app,/await adminSendNotification\(notificationId\)/);
 assert.match(app,/workspaceUtilityButton\("data-send-notification"/);
 assert.match(app,/const NOTIFICATION_SCHEDULING_ENABLED = false/);
 assert.match(app,/NOTIFICATION_SCHEDULING_ENABLED \? .+notification-planning-grid/);
});
