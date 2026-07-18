#!/usr/bin/env node
/* ============================================================================
   patterns.js — search & extend the Beautiful Decks PATTERN REGISTRY
   The registry (patterns.json) maps slide INTENT → reusable slide+motion
   patterns. This CLI is how you (and the agent) search it before building a
   slide, and how you register a new pattern after inventing one.

   USAGE
     node patterns.js find <keyword>     fuzzy search intent/tags/when/id
     node patterns.js list               one-line summary of every pattern
     node patterns.js show <id>          full detail for one pattern
     node patterns.js tags               all tags, with counts
     node patterns.js add                interactive: register a new pattern
     node patterns.js add '<json>'       non-interactive: pass an entry object

   EXAMPLES
     node patterns.js find security      → security-scanner-sweep
     node patterns.js find "before after"→ thesis-before-after, taskflow…, compare…
     node patterns.js find parallel      → worktree-branches
   ============================================================================ */
const fs=require('fs'), path=require('path');
const REG=path.join(__dirname,'patterns.json');

function load(){ return JSON.parse(fs.readFileSync(REG,'utf8')); }
function save(db){ fs.writeFileSync(REG, JSON.stringify(db,null,2)+'\n'); }

function score(p,q){
  const hay=[p.id,p.intent,p.when,(p.tags||[]).join(' '),p.archetype,p.motion].join(' ').toLowerCase();
  const terms=q.toLowerCase().split(/\s+/).filter(Boolean);
  let s=0;
  for(const t of terms){
    if((p.tags||[]).some(tag=>tag.toLowerCase()===t)) s+=5;     // exact tag hit
    else if((p.tags||[]).some(tag=>tag.toLowerCase().includes(t))) s+=3;
    if(p.id.toLowerCase().includes(t)) s+=3;
    if(p.intent.toLowerCase().includes(t)) s+=2;
    if(hay.includes(t)) s+=1;
  }
  return s;
}

const cmd=process.argv[2], arg=process.argv.slice(3).join(' ');
const db=load();

if(cmd==='find'){
  if(!arg){ console.error('usage: node patterns.js find <keyword>'); process.exit(1); }
  const hits=db.patterns.map(p=>({p,s:score(p,arg)})).filter(x=>x.s>0).sort((a,b)=>b.s-a.s);
  if(!hits.length){ console.log(`no pattern matches "${arg}". Try: node patterns.js tags`); process.exit(0); }
  console.log(`\n${hits.length} match(es) for "${arg}":\n`);
  for(const {p,s} of hits){
    console.log(`  ● ${p.id}   [${s}]`);
    console.log(`    intent : ${p.intent}`);
    console.log(`    use    : ${p.archetype}  ·  motion: ${p.motion}`);
    console.log(`    proven : ${p.proven_in}`);
    console.log('');
  }
}
else if(cmd==='list'){
  console.log(`\n${db.patterns.length} patterns in registry:\n`);
  for(const p of db.patterns) console.log(`  ${p.id.padEnd(28)} ${p.intent.slice(0,68)}`);
  console.log('');
}
else if(cmd==='show'){
  const p=db.patterns.find(x=>x.id===arg);
  if(!p){ console.error(`no pattern "${arg}". node patterns.js list`); process.exit(1); }
  console.log('');
  for(const k of ['id','intent','when','archetype','motion','markup','tags','proven_in','pitfalls']){
    const v=Array.isArray(p[k])?p[k].join(', '):p[k];
    console.log(`  ${k.padEnd(10)}: ${v}`);
  }
  console.log('');
}
else if(cmd==='tags'){
  const counts={};
  for(const p of db.patterns) for(const t of (p.tags||[])) counts[t]=(counts[t]||0)+1;
  const sorted=Object.entries(counts).sort((a,b)=>b[1]-a[1]);
  console.log(`\n${sorted.length} tags:\n`);
  console.log('  '+sorted.map(([t,c])=>`${t}(${c})`).join('  '));
  console.log('');
}
else if(cmd==='add'){
  if(arg){
    // non-interactive: parse a JSON entry
    let entry; try{ entry=JSON.parse(arg); }catch(e){ console.error('invalid JSON:',e.message); process.exit(1); }
    if(!entry.id||!entry.intent){ console.error('entry needs at least id + intent'); process.exit(1); }
    if(db.patterns.some(p=>p.id===entry.id)){ console.error(`id "${entry.id}" already exists`); process.exit(1); }
    entry.tags=entry.tags||[]; db.patterns.push(entry); save(db);
    console.log(`✓ registered "${entry.id}" (${db.patterns.length} patterns)`);
  } else {
    // interactive prompt
    const rl=require('readline').createInterface({input:process.stdin,output:process.stdout});
    const ask=q=>new Promise(r=>rl.question(q,r));
    (async()=>{
      console.log('\nRegister a new slide pattern (Enter to skip optional fields):\n');
      const e={};
      e.id=(await ask('  id (kebab-case)      : ')).trim();
      if(!e.id){ console.log('aborted'); rl.close(); return; }
      if(db.patterns.some(p=>p.id===e.id)){ console.error(`id exists`); rl.close(); return; }
      e.intent=(await ask('  intent (story beat)  : ')).trim();
      e.when=(await ask('  when to use          : ')).trim();
      e.archetype=(await ask('  archetype            : ')).trim();
      e.motion=(await ask('  motion classes       : ')).trim();
      e.markup=(await ask('  markup contract      : ')).trim();
      e.tags=(await ask('  tags (comma-sep)     : ')).split(',').map(s=>s.trim()).filter(Boolean);
      e.proven_in=(await ask('  proven in (deck/slide): ')).trim();
      e.pitfalls=(await ask('  pitfalls             : ')).trim();
      db.patterns.push(e); save(db);
      console.log(`\n✓ registered "${e.id}" (${db.patterns.length} patterns)\n`);
      rl.close();
    })();
  }
}
else{
  console.log(`Beautiful Decks — pattern registry (${db.patterns.length} patterns)\n`);
  console.log('  node patterns.js find <keyword>   search by intent/tag');
  console.log('  node patterns.js list             all patterns');
  console.log('  node patterns.js show <id>        full detail');
  console.log('  node patterns.js tags             tag cloud');
  console.log('  node patterns.js add              register a new pattern');
  console.log('\nExample: node patterns.js find security\n');
}
