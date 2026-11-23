/* Actarium Storage & Cleanup v1.0 — browser-only, origin-safe.
   Data owned by other GitHub Pages applications is never a cleanup candidate. */
(() => {
  'use strict';

  const APP = 'actarium';
  const BACKUP_VERSION = 1;
  const LAST_CLEAN = 'actarium.storageManager.lastCleanup';
  const registry = {
    'actarium.theme': {category:'Settings & Preferences',description:'Dark or light theme',validate:'text'},
    'actarium.mobileView': {category:'Settings & Preferences',description:'Mobile navigation view',validate:'text'},
    'actarium.taskModeView': {category:'Settings & Preferences',description:'Task display mode',validate:'text'},
    'actarium.taskGridColumns': {category:'Settings & Preferences',description:'Task cards per row',validate:'number'},
    'actarium.taskGridForce': {category:'Settings & Preferences',description:'Force task grid on smaller screens',validate:'boolean'},
    'actarium.timeVisible': {category:'Settings & Preferences',description:'Clock visibility',validate:'boolean'},
    'actarium.timePosition': {category:'Settings & Preferences',description:'Clock position',validate:'text'},
    'actarium.timeSize': {category:'Settings & Preferences',description:'Clock text size',validate:'number'},
    'actarium.tabletView': {category:'Settings & Preferences',description:'Tablet display mode',validate:'boolean'},
    'actarium.weatherVisible': {category:'Settings & Preferences',description:'Temperature visibility',validate:'boolean'},
    'actarium.berlinWeather': {category:'Cache & Previews',description:'Regenerable Berlin weather response',validate:'json',safe:true},
    'actarium.localRecords.v1': {category:'Projects & Saved Work',description:'Legacy locally saved Actarium records',validate:'json',sensitive:true},
    'actarium.localTasks.v2': {category:'User Data',description:'Legacy locally saved tasks',validate:'json',sensitive:true},
    'actarium.theme.v2': {category:'Settings & Preferences',description:'Legacy theme preference',validate:'text'},
    'actarium.activeView.v1': {category:'Settings & Preferences',description:'Legacy dashboard view',validate:'text'},
    [LAST_CLEAN]: {category:'History & Logs',description:'Last successful storage cleanup',validate:'text'}
  };
  const categories = [
    ['Settings & Preferences','Your display and app preferences'],
    ['Projects & Saved Work','Saved local work, never automatically deleted'],
    ['Drafts & Unsaved Changes','Recovery data and unfinished edits'],
    ['User Data','Locally created information'],
    ['Server-Synced Copies','Copies confirmed identical to published data'],
    ['Temporary Data','Verified disposable processing information'],
    ['Cache & Previews','Items that can safely be regenerated'],
    ['History & Logs','Diagnostic history that may need review'],
    ['Unknown / Unclassified','Ownership or purpose has not been proved']
  ];
  const ui = {
    opened:false, tab:'overview', entries:[], capabilities:[], totals:null,
    scanError:'', busy:false, safeOnly:false, filter:'', technology:'all',
    selection:new Set(), message:'', awaiting:null, lastScan:0
  };
  const protectedKey = /pass(word)?|auth|token|secret|session|credential|api.?key|cookie/i;
  const managerSelector = '.actarium-storage-manager-backdrop';

  function node(tag, cls, text) {
    const element = document.createElement(tag);
    if(cls) element.className = cls;
    if(text !== undefined) element.textContent = String(text);
    return element;
  }
  function action(label, fn, cls, disabled) {
    const b=node('button', 'asm-button'+(cls?' '+cls:''), label);
    b.type='button'; b.disabled=Boolean(disabled);
    if(fn) b.addEventListener('click', fn);
    return b;
  }
  function textLine(parent, text, cls) { const p=node('p',cls,text); parent.append(p); return p; }
  function bytes(size) {
    if(size===null || size===undefined || !Number.isFinite(size)) return 'Not available';
    if(size<1024) return Math.round(size)+' B';
    if(size<1048576) return (size/1024).toFixed(1)+' KB';
    return (size/1048576).toFixed(2)+' MB';
  }
  function sizeOf(key,value) { return (String(key).length+String(value).length)*2; }
  function definition(key) { return Object.prototype.hasOwnProperty.call(registry,key) ? registry[key] : null; }
  function canEdit(entry) { return entry.owned && entry.technology==='localStorage'; }
  function ownEntry(technology,key,value) {
    const def=technology==='localStorage' ? definition(key) : null;
    const registered=Boolean(def);
    const foreign= !registered && !String(key).startsWith('actarium.');
    return {
      id:technology+':'+key,technology,key,
      category: registered?def.category:'Unknown / Unclassified',
      description:registered?def.description:foreign?'Not registered as Actarium storage':'Unregistered Actarium-prefixed entry; ownership not verified',
      ownership:registered?'Current application':foreign?'Other / unconfirmed':'Unknown',
      owned:registered, protected:!def?.safe, safe:Boolean(def?.safe),
      server:'Not configured', modified:'Not recorded', value:registered?value:null,
      approximateBytes:sizeOf(key,value), contentsAvailable:registered, validate:def?.validate||'unknown',
      sensitive:Boolean(def?.sensitive)||protectedKey.test(key)
    };
  }
  function capability(name,supported,detail) {
    ui.capabilities.push({name,supported,detail:detail||''});
  }
  function scanStorage(area,label) {
    try {
      if(!area) {capability(label,false,'Not supported or blocked by this browser');return;}
      const length=area.length;
      const max=Math.min(length,2500);
      for(let i=0;i<max;i++) {
        const key=area.key(i);
        if(key===null) continue;
        let value;
        try {value=area.getItem(key);} catch(_) {value=null;}
        const entry=ownEntry(label,key,value||'');
        if(value===null) {entry.contentsAvailable=false;entry.approximateBytes=null;}
        ui.entries.push(entry);
      }
      capability(label,true,length>max?'First '+max+' of '+length+' entries inspected':'Accessible: '+length+' entries');
    } catch(e) { capability(label,false,'Blocked or unavailable: '+e.message); }
  }
  async function scanIndexedDB() {
    if(!('indexedDB' in window)) {capability('IndexedDB',false,'Not available');return;}
    if(typeof indexedDB.databases!=='function') {
      capability('IndexedDB',true,'Database listing unavailable in this browser. No databases opened or modified.');
      return;
    }
    try {
      const dbs=await indexedDB.databases();
      for(const db of dbs.slice(0,300)) {
        const name=db.name||'(unnamed database)';
        ui.entries.push({id:'IndexedDB:'+name,technology:'IndexedDB',key:name,
          category:'Unknown / Unclassified',description:'Database detected; no application ownership registry',
          ownership:'Unknown',owned:false,protected:true,safe:false,server:'Not configured',
          modified:'Not recorded',approximateBytes:null,contentsAvailable:false,
          details:'Version '+String(db.version??'unknown')+'; contents not inspected to avoid interfering with active databases'});
      }
      capability('IndexedDB',true,dbs.length+' database(s) listed; unknown databases protected');
    } catch(e) {capability('IndexedDB',false,e.message);}
  }
  async function scanCaches() {
    if(!('caches' in window)) {capability('Cache Storage',false,'Unavailable');return;}
    try {
      const names=await caches.keys();
      for(const name of names.slice(0,300)) {
        ui.entries.push({id:'Cache Storage:'+name,technology:'Cache Storage',key:name,
          category:'Unknown / Unclassified',description:'Cache is not registered as exclusively owned by Actarium',
          ownership:'Unknown',owned:false,protected:true,safe:false,server:'Not configured',
          modified:'Not recorded',approximateBytes:null,contentsAvailable:false});
      }
      capability('Cache Storage',true,names.length+' cache(s) listed; none approved for deletion');
    } catch(e) {capability('Cache Storage',false,e.message);}
  }
  async function scanOPFS() {
    if(!navigator.storage?.getDirectory) {capability('OPFS',false,'Not available in this browser or context');return;}
    try {
      const root=await navigator.storage.getDirectory();
      let count=0;
      if(root?.values) {
        for await(const entry of root.values()) {
          if(++count>300) break;
          ui.entries.push({id:'OPFS:'+entry.name,technology:'OPFS',key:entry.name,
            category:'Unknown / Unclassified',description:'Origin-private file or folder; ownership not established',
            ownership:'Unknown',owned:false,protected:true,safe:false,server:'Not configured',
            modified:'Not recorded',approximateBytes:null,contentsAvailable:false});
        }
      }
      capability('OPFS',true, count+' root entries; unregistered files protected');
    } catch(e) {capability('OPFS',false,'Access restricted: '+e.message);}
  }
  function scanCookies() {
    try {
      const list=(document.cookie||'').split(';').map(x=>x.trim()).filter(Boolean);
      list.forEach(cookie=>{
        const key=cookie.split('=')[0];
        ui.entries.push({id:'Cookies:'+key,technology:'Cookies',key,
          category:'Unknown / Unclassified',description:'Cookie value hidden; not registered for Actarium cleanup',
          ownership:'Unknown',owned:false,protected:true,safe:false,server:'Not configured',
          modified:'Not recorded',approximateBytes:null,contentsAvailable:false,sensitive:true});
      });
      capability('JavaScript-accessible cookies',true,list.length+' name(s); values hidden');
    } catch(e) {capability('JavaScript-accessible cookies',false,'Restricted: '+e.message);}
  }
  async function refresh() {
    ui.busy=true; ui.scanError='';ui.entries=[];ui.capabilities=[];ui.selection.clear();
    render();
    scanStorage(window.localStorage,'localStorage');
    scanStorage(window.sessionStorage,'sessionStorage');
    const tasks=[scanIndexedDB(),scanCaches(),scanOPFS()];
    scanCookies();
    try {
      await Promise.all(tasks);
      if(navigator.storage?.estimate) {
        try {
          const estimate=await navigator.storage.estimate();
          ui.totals={used:estimate.usage??null,quota:estimate.quota??null};
        } catch(_) {ui.totals=null;}
      } else ui.totals=null;
    } catch(e) {ui.scanError=e.message;}
    ui.lastScan=Date.now();ui.busy=false;render();
  }
  function owned() { return ui.entries.filter(x=>x.owned); }
  function safe() { return owned().filter(x=>x.safe); }
  function heading(parent,text) {parent.append(node('h3','asm-subhead',text));}
  function buttonBar(parent,items) {
    const bar=node('div','asm-actions');
    items.forEach(x=>bar.append(x));parent.append(bar);
  }
  function count(label,n) {return label+': '+n;}
  function row(label,value) {
    const container=node('div','asm-stat');
    container.append(node('span','',label),node('strong','',value));
    return container;
  }
  function showMessage(text) {ui.message=text; render();}
  function overview(panel) {
    const current=owned(), disposable=safe();
    const totalBytes=current.reduce((sum,e)=>sum+(e.approximateBytes||0),0);
    const protectedItems=current.filter(e=>e.protected);
    const stats=node('div','asm-stats');
    stats.append(row('Known Actarium data',bytes(totalBytes)),
      row('Stored entries',String(current.length)),
      row('Protected',String(protectedItems.length)),
      row('Safe to clean',String(disposable.length)),
      row('Server verified','0'),
      row('Need review',String(ui.entries.length-current.length)));
    panel.append(stats);
    const meter=node('div','asm-meter');
    const percent=totalBytes?100*disposable.reduce((s,e)=>s+(e.approximateBytes||0),0)/totalBytes:0;
    const fill=node('div','asm-meter-fill');fill.style.width=percent+'%';meter.append(fill);
    panel.append(meter);
    textLine(panel,'Teal represents confirmed removable Actarium data. All other known data remains protected.','asm-muted');
    if(ui.totals) textLine(panel,'Origin-wide browser estimate (includes other apps on this domain): '+bytes(ui.totals.used)+' used'+(ui.totals.quota?' of '+bytes(ui.totals.quota)+' quota':'')+'. This is NOT Actarium-only usage.','asm-muted');
    else textLine(panel,'Browser-wide/origin-wide usage estimate unavailable on this device.','asm-muted');
    heading(panel,'Categories');
    const categoryList=node('div','asm-categories');
    categories.forEach(([category,desc])=>{
      const entries=current.filter(e=>e.category===category);
      const valid=entries.filter(e=>e.safe);
      const card=node('label','asm-category');
      const check=node('input');check.type='checkbox';check.disabled=valid.length===0;
      check.checked=valid.length>0 && valid.every(e=>ui.selection.has(e.id));
      check.addEventListener('change',()=>{
        valid.forEach(e=>check.checked?ui.selection.add(e.id):ui.selection.delete(e.id));
        render();
      });
      card.append(check);
      const info=node('div','asm-category-main');
      info.append(node('strong','',category),node('small','',desc));
      const countText=node('small','',entries.length+' items · '+bytes(entries.reduce((n,e)=>n+(e.approximateBytes||0),0))+
        (valid.length?' · '+valid.length+' safe':' · protected/no eligible cleanup'));
      info.append(countText);card.append(info);categoryList.append(card);
    });
    panel.append(categoryList);
    heading(panel,'Actions');
    buttonBar(panel,[
      action('⚡ Quick Clean',()=>clean(safe(),'Quick Clean'),'primary',!disposable.length),
      action('Clear Selected',()=>clean(safe().filter(e=>ui.selection.has(e.id)),'Clear Selected'),'secondary',ui.selection.size===0),
      action('Remove Server-Verified Copies',()=>showMessage('No server verification source configured.'),'secondary',true),
      action('Browse Storage',()=>{ui.tab='browse';render();}),
      action('Backup / Export',exportBackup),
      action('Clear Everything',clearAllPrompt,'danger',!current.length)
    ]);
    const note=node('div','asm-notice');
    note.append(node('strong','', 'Server verification'));
    textLine(note,'No server verification source configured. Actarium uses a live Google Sheet for tasks and reminders, but no matching browser-stored dataset is registered for content comparison. Server-copy removal and automatic deletion remain unavailable.','asm-muted');
    panel.append(note);
    const last=(localStorage.getItem(LAST_CLEAN)||'');
    if(last) textLine(panel,'Last successful cleanup: '+last,'asm-muted');
  }
  function filteredEntries() {
    const term=ui.filter.toLowerCase();
    return ui.entries.filter(e=>(!ui.safeOnly || e.safe)&&
      (ui.technology==='all' || e.technology===ui.technology) &&
      (!term || [e.key,e.description,e.category,e.ownership].some(v=>String(v||'').toLowerCase().includes(term))));
  }
  function browse(panel) {
    const controls=node('div','asm-filters');
    const search=node('input');search.type='search';search.placeholder='Search keys, categories, ownership';
    search.value=ui.filter;search.addEventListener('input',()=>{ui.filter=search.value;renderBrowseRows();});
    const select=node('select');
    ['all','localStorage','sessionStorage','IndexedDB','Cache Storage','OPFS','Cookies'].forEach(t=>{
      const opt=node('option','',t==='all'?'All storage':t);opt.value=t;opt.selected=ui.technology===t;select.append(opt);
    });
    select.addEventListener('change',()=>{ui.technology=select.value;renderBrowseRows();});
    const safeOnly=node('label','asm-filter-check');
    const check=node('input');check.type='checkbox';check.checked=ui.safeOnly;
    check.addEventListener('change',()=>{ui.safeOnly=check.checked;renderBrowseRows();});
    safeOnly.append(check,node('span','','Safe items only'));
    controls.append(search,select,safeOnly);panel.append(controls);
    const list=node('div','asm-browser-results');panel.append(list);
    function renderBrowseRows() {
      list.replaceChildren();
      const filtered=filteredEntries();
      textLine(list,filtered.length+' matching storage entries · values from unrelated storage remain hidden','asm-muted');
      filtered.slice(0,500).forEach(e=>{
        const item=node('div','asm-entry');
        const info=node('div','asm-entry-main');
        info.append(node('strong','asm-entry-key',e.key),node('small','',e.technology+' · '+e.category+' · '+e.ownership));
        info.append(node('small','',bytes(e.approximateBytes)+' · '+(e.safe?'Safe to regenerate':e.owned?'Protected':'Not eligible for cleanup')));
        const controls=node('div','asm-entry-actions');
        controls.append(action('View',()=>entryDetail(e),'',!e.contentsAvailable),
          action('Export',()=>exportEntry(e),'',!e.contentsAvailable||e.sensitive),
          action('Edit',()=>editEntry(e),'',!canEdit(e)),
          action('Delete',()=>deleteEntry(e),'danger',!canEdit(e)));
        item.append(info,controls);list.append(item);
      });
      if(filtered.length>500) textLine(list,'Showing first 500 matches; refine your filters to see more.','asm-muted');
    }
    renderBrowseRows();
    buttonBar(panel,[action('Show largest items',()=>{
      ui.entries.sort((a,b)=>(b.approximateBytes||0)-(a.approximateBytes||0));renderBrowseRows();
    }),action('Copy storage report',copyReport),action('Back to overview',()=>{ui.tab='overview';render();})]);
    heading(panel,'Available storage technologies');
    const listCap=node('div','asm-capabilities');
    ui.capabilities.forEach(c=>listCap.append(row(c.name,(c.supported?'Available':'Unavailable')+' · '+c.detail)));
    panel.append(listCap);
    textLine(panel,'Dates are shown as “Not recorded” when the browser does not provide them. Unknown databases, cookies, files, and shared-origin caches are protected and cannot be edited or deleted here.','asm-muted');
  }
  function getRaw(e) {
    if(!e.contentsAvailable || e.technology!=='localStorage') return null;
    try{return localStorage.getItem(e.key);}catch(_){return null;}
  }
  function closeDetail() {document.querySelector('.asm-detail-backdrop')?.remove();}
  function dialog(title,makeBody) {
    closeDetail();
    const background=node('div','asm-detail-backdrop');
    const modal=node('section','asm-detail');
    const head=node('div','asm-head');
    head.append(node('h2','',title),action('✕',closeDetail,'close'));
    const body=node('div','asm-detail-body');
    makeBody(body);
    modal.append(head,body);background.append(modal);
    background.addEventListener('click',e=>{if(e.target===background)closeDetail();});
    document.body.append(background);
  }
  function entryDetail(e) {
    const value=getRaw(e);
    dialog(e.key,body=>{
      textLine(body,e.description+' · '+e.category+' · '+e.technology,'asm-muted');
      textLine(body,'Ownership: '+e.ownership+' · '+bytes(e.approximateBytes)+' · Modified: Not recorded','asm-muted');
      const area=node('textarea','asm-content');
      area.readOnly=true;
      if(value===null) area.value='Unable to access this entry.';
      else if(e.sensitive) area.value='Contents protected in preview. Export individual data only after reviewing its sensitivity.';
      else {
        try {area.value=JSON.stringify(JSON.parse(value),null,2);} catch(_) {area.value=value;}
      }
      body.append(area);
      buttonBar(body,[action('Copy',()=>copyText(value===null?'':value),'',value===null||e.sensitive),
        action('Export',()=>exportEntry(e),'',value===null||e.sensitive),
        action('Edit',()=>editEntry(e),'',!canEdit(e)),
        action('Close',closeDetail)]);
    });
  }
  function validateValue(e, value) {
    if(value.length>8_000_000) return 'Value is too large for this editor (8 MB maximum).';
    const def=definition(e.key);
    if(!def) return 'This key is not registered as Actarium-owned.';
    if(def.validate==='boolean' && !/^(true|false)$/.test(value)) return 'Expected true or false.';
    if(def.validate==='number' && !/^\d+$/.test(value)) return 'Expected an integer.';
    if(def.validate==='json') {
      try {
        const obj=JSON.parse(value);
        if(e.key==='actarium.localTasks.v2' && !Array.isArray(obj)) return 'Expected an array of tasks.';
        if(e.key==='actarium.localRecords.v1' && (!obj || Array.isArray(obj) || typeof obj!=='object')) return 'Expected an object of legacy records.';
        if(e.key==='actarium.berlinWeather' && (!obj || !Number.isFinite(obj.temperature) || !Number.isFinite(obj.savedAt))) return 'Expected temperature and savedAt numbers.';
      } catch(_) {return 'Invalid JSON.';}
    }
    return '';
  }
  function editEntry(e) {
    if(!canEdit(e)) return;
    dialog('Edit: '+e.key,body=>{
      textLine(body,'Protected local settings and records require extra care. Changes may affect the running app; reload afterwards.','asm-muted');
      const textarea=node('textarea','asm-content');
      textarea.value=getRaw(e)||'';body.append(textarea);
      buttonBar(body,[action('Save value',()=>{
        const error=validateValue(e,textarea.value);
        if(error){textLine(body,error,'asm-error');return;}
        if(!window.confirm('Replace the saved value for '+e.key+'? This may affect how Actarium works.')) return;
        try {localStorage.setItem(e.key,textarea.value);closeDetail();showMessage('Value saved. Reload Actarium to apply the change.');refresh();}
        catch(err){textLine(body,'Save failed: '+err.message,'asm-error');}
      },'primary'),action('Cancel',closeDetail)]);
    });
  }
  function deleteEntry(e) {
    if(!canEdit(e)) return;
    dialog('Delete: '+e.key,body=>{
      textLine(body,e.protected?'This is protected Actarium data. Removing it may erase preferences, saved work or recovery data.':'This is verified regenerable browser cache.','asm-muted');
      if(e.protected) textLine(body,'Only continue if you understand the loss. A backup is recommended.','asm-error');
      buttonBar(body,[action('Export backup',exportBackup),action('Delete this entry',async()=>{
        if(!window.confirm('Delete '+e.key+' from this browser? This cannot necessarily be undone.'))return;
        try {localStorage.removeItem(e.key);closeDetail();showMessage('Removed '+e.key+'. Reload Actarium if a setting or draft was changed.');await refresh();}
        catch(err){textLine(body,err.message,'asm-error');}
      },'danger'),action('Cancel',closeDetail)]);
    });
  }
  function report() {
    const items=owned();
    return [
      'Actarium Storage Report', 'Generated '+new Date().toISOString(),
      'App-owned entries: '+items.length,
      'Approximate size: '+bytes(items.reduce((s,e)=>s+(e.approximateBytes||0),0)),
      'Protected: '+items.filter(x=>x.protected).length,
      'Safe to clean: '+items.filter(x=>x.safe).length,
      'Server verified: 0 (no configured source)',
      ...categories.map(([cat])=>cat+': '+items.filter(x=>x.category===cat).length),
      'Storage capability summary:',
      ...ui.capabilities.map(c=>c.name+': '+(c.supported?'available':'unavailable')+', '+c.detail),
      'No individual values or sensitive records included.'
    ].join('\n');
  }
  async function copyText(value) {
    try{await navigator.clipboard.writeText(value);showMessage('Copied to clipboard.');}
    catch(_){showMessage('Clipboard unavailable; use manual selection or export.');}
  }
  function copyReport(){copyText(report());}
  function download(name,content,type='application/json') {
    const blob=new Blob([content],{type});
    const url=URL.createObjectURL(blob);
    const anchor=document.createElement('a');anchor.href=url;anchor.download=name;
    document.body.append(anchor);anchor.click();anchor.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1500);
    showMessage('Export generated. Your browser handles the actual file download.');
  }
  function exportEntry(e) {
    const raw=getRaw(e);
    if(raw===null||e.sensitive){showMessage('This entry cannot be safely exported individually.');return;}
    download('actarium-'+e.key.replace(/[^a-z0-9.-]+/gi,'-')+'.txt',raw,'text/plain');
  }
  function exportBackup() {
    const entries=[];
    const omitted=[];
    for(const e of owned()) {
      const value=getRaw(e);
      if(value===null) {omitted.push(e.key+' (inaccessible)');continue;}
      if(e.sensitive && protectedKey.test(value.slice(0,40000))) {
        omitted.push(e.key+' (potential sensitive contents)');continue;
      }
      entries.push({storage:'localStorage',key:e.key,category:e.category,value});
    }
    const backup={format:'actarium-browser-storage',schema:BACKUP_VERSION,application:APP,
      exportedAt:new Date().toISOString(),origin:location.origin,entries,omitted};
    download('actarium-browser-storage-'+new Date().toISOString().slice(0,10)+'.json',
      JSON.stringify(backup,null,2));
  }
  function showImportPicker() {
    const input=node('input');input.type='file';input.accept='.json,application/json';
    input.addEventListener('change',async()=>{
      const file=input.files?.[0];if(!file)return;
      if(file.size>8_000_000){showMessage('Backup exceeds the 8 MB import limit.');return;}
      try {await importBackup(JSON.parse(await file.text()));}
      catch(e) {showMessage('Could not read backup: '+e.message);}
    });
    input.click();
  }
  async function importBackup(backup) {
    if(backup?.format!=='actarium-browser-storage'||backup.application!==APP||backup.schema!==BACKUP_VERSION||!Array.isArray(backup.entries)) {
      showMessage('Not a compatible Actarium Storage Manager backup.');return;
    }
    const changes=[], skipped=[], seen=new Set();
    for(const entry of backup.entries.slice(0,3000)) {
      if(entry.storage!=='localStorage'||typeof entry.key!=='string'||typeof entry.value!=='string'||!definition(entry.key)||seen.has(entry.key)) {
        skipped.push(entry.key||'(unknown)');continue;
      }
      seen.add(entry.key);
      const error=validateValue({key:entry.key},entry.value);
      if(error){skipped.push(entry.key+' ('+error+')');continue;}
      const old=localStorage.getItem(entry.key);
      if(old===entry.value) {skipped.push(entry.key+' (identical)');continue;}
      changes.push({key:entry.key,value:entry.value,existing:old!==null});
    }
    dialog('Restore Actarium backup',body=>{
      textLine(body,changes.length+' entries to add or replace; '+skipped.length+' skipped.','asm-muted');
      changes.forEach(e=>textLine(body,(e.existing?'REPLACE ':'ADD ')+e.key,e.existing?'asm-warning':'asm-muted'));
      if(skipped.length) textLine(body,'Skipped: '+skipped.slice(0,15).join(', '),'asm-muted');
      if(!changes.length){buttonBar(body,[action('Close',closeDetail)]);return;}
      textLine(body,'Replacing an existing entry may overwrite newer browser data. The manager cannot independently compare modification dates.','asm-error');
      buttonBar(body,[action('Backup current data',exportBackup),action('Restore these entries',()=>{
        if(!window.confirm('Restore '+changes.length+' entries? Existing values will be replaced.'))return;
        try {
          changes.forEach(c=>localStorage.setItem(c.key,c.value));
          closeDetail();window.location.reload();
        } catch(e){textLine(body,'Import failed: '+e.message,'asm-error');}
      },'danger'),action('Cancel',closeDetail)]);
    });
  }
  async function clean(items,label) {
    if(!items.length){showMessage('No confirmed safe items available for cleanup.');return;}
    const space=items.reduce((n,e)=>n+(e.approximateBytes||0),0);
    dialog(label,body=>{
      textLine(body,'Ready to clean '+items.length+' verified regenerable item(s), approximately '+bytes(space)+'.','asm-muted');
      items.forEach(e=>textLine(body,e.description+' ('+e.key+')','asm-muted'));
      textLine(body,'Preferences, projects, drafts and local user data will be preserved.','asm-muted');
      buttonBar(body,[action('Confirm cleanup',async()=>{
        let removed=0,failed=0;
        for(const e of items) {
          if(!e.safe||!e.owned||!definition(e.key)?.safe)continue;
          try{localStorage.removeItem(e.key);removed++;}
          catch(_){failed++;}
        }
        try {if(removed) localStorage.setItem(LAST_CLEAN,new Date().toISOString());}catch(_){}
        closeDetail();
        await refresh();
        showMessage(label+': '+removed+' removed, '+failed+' failed. Approximately '+bytes(space)+' identified for cleanup.');
      },'primary'),action('Cancel',closeDetail)]);
    });
  }
  function clearAllPrompt() {
    const entries=owned();
    dialog('Clear Everything — Actarium only',body=>{
      textLine(body,'This clears '+entries.length+' registered Actarium browser entries, including protected preferences, legacy saved records and weather cache.','asm-error');
      textLine(body,'Other apps on this GitHub Pages origin, unknown entries, Google Sheet tasks, server files and hard-drive files are excluded.','asm-muted');
      textLine(body,'Any unsaved in-memory changes may be lost. Export a backup first. This cannot necessarily be undone.','asm-error');
      const field=node('label','asm-strong-confirm');
      field.append(node('span','', 'Type DELETE ACTARIUM to confirm:'));
      const input=node('input');input.placeholder='DELETE ACTARIUM';field.append(input);body.append(field);
      const deleteButton=action('Clear registered Actarium storage',()=>{
        if(input.value!=='DELETE ACTARIUM')return;
        if(!window.confirm('Final confirmation: permanently reset registered Actarium browser storage?'))return;
        let removed=0,failed=0;
        entries.forEach(e=>{
          if(!e.owned||e.technology!=='localStorage'||!definition(e.key))return;
          try{localStorage.removeItem(e.key);removed++;}
          catch(_){failed++;}
        });
        if(failed){closeDetail();refresh();showMessage(removed+' removed; '+failed+' failed.');}
        else window.location.reload();
      },'danger',true);
      input.addEventListener('input',()=>{deleteButton.disabled=input.value!=='DELETE ACTARIUM';});
      buttonBar(body,[action('Backup first',exportBackup),deleteButton,action('Cancel',closeDetail)]);
    });
  }
  function render() {
    if(!ui.opened)return;
    let backdrop=document.querySelector(managerSelector);
    if(!backdrop) {
      backdrop=node('div','actarium-storage-manager-backdrop');
      const modal=node('section','actarium-storage-manager');
      backdrop.append(modal);
      document.body.append(backdrop);
      backdrop.addEventListener('click',e=>{if(e.target===backdrop)close();});
    }
    const modal=backdrop.firstChild;
    const header=node('div','asm-head');
    header.append(node('h2','','💾 Storage & Cleanup'),action('✕',close,'close'));
    const body=node('div','asm-body');
    const tabs=node('div','asm-tabs');
    tabs.append(action('Overview',()=>{ui.tab='overview';render();},ui.tab==='overview'?'active':''),
      action('Browse Storage',()=>{ui.tab='browse';render();},ui.tab==='browse'?'active':''));
    body.append(tabs);
    if(ui.message) {
      const notification=node('div','asm-message',ui.message);
      notification.append(action('Dismiss',()=>{ui.message='';render();},'small'));
      body.append(notification);
    }
    if(ui.scanError) textLine(body,'Scan warning: '+ui.scanError,'asm-error');
    if(ui.busy) textLine(body,'Inspecting available browser storage…','asm-muted');
    if(ui.tab==='overview')overview(body);else browse(body);
    const footer=node('div','asm-footer');
    buttonBar(footer,[action('Refresh Storage',refresh,'secondary',ui.busy),
      action('Import Backup',showImportPicker),
      action('Close',close)]);
    modal.replaceChildren(header,body,footer);
  }
  function open() {
    ui.opened=true;ui.message='';ui.tab='overview';render();refresh();
  }
  function close() {
    ui.opened=false;
    document.querySelector(managerSelector)?.remove();
    closeDetail();
  }
  function injectSettingsButton() {
    const modal=[...document.querySelectorAll('.actarium-modal')].find(el=>
      el.querySelector('.actarium-modal-head h2')?.textContent.trim()==='Settings');
    const body=modal?.querySelector('.actarium-modal-body');
    if(!body||body.querySelector('.actarium-storage-entry'))return;
    const button=action('💾 Storage & Cleanup',open,'actarium-storage-entry');
    button.title='Inspect, back up and safely clean Actarium browser storage';
    body.prepend(button);
  }
  let scheduled=false;
  const observer=new MutationObserver(()=>{
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(()=>{scheduled=false;injectSettingsButton();});
  });
  const root=document.getElementById('app');
  if(root)observer.observe(root,{childList:true,subtree:true});
  document.addEventListener('DOMContentLoaded',injectSettingsButton);
  injectSettingsButton();
  window.ActariumStorageManager={open,refresh};
})();