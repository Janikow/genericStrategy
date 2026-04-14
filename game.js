const rnd=(a,b)=>Math.floor(Math.random()*(b-a+1))+a;
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const CRIT_CAP=95,EVADE_CAP=75;

function positionTooltip(wrapEl){
  const tip=wrapEl.querySelector('.tooltip-box');if(!tip)return;
  const r=wrapEl.getBoundingClientRect(),tipW=220;
  const offRight=r.right+tipW>window.innerWidth-10;
  if(offRight)tip.classList.add('tip-auto-left');else tip.classList.remove('tip-auto-left');
}
document.addEventListener('mouseover',e=>{const w=e.target.closest('.tooltip-wrap');if(w)positionTooltip(w);});

const ARROW_KEYS=[{key:'ArrowUp',label:'↑'},{key:'ArrowDown',label:'↓'},{key:'ArrowLeft',label:'←'},{key:'ArrowRight',label:'→'}];
const OPPOSITE_ARROW={ArrowUp:'ArrowDown',ArrowDown:'ArrowUp',ArrowLeft:'ArrowRight',ArrowRight:'ArrowLeft'};

function genArrowSeq(len,invertChance=0){
  const seq=[];
  for(let i=0;i<len;i++){
    let k;do{k=ARROW_KEYS[rnd(0,3)];}while(seq.length>0&&k.key===seq[seq.length-1].key);
    seq.push({...k,inverted:Math.random()<invertChance});
  }
  return seq;
}

let mgActive=false,mgAnimFrame=null;
function runMinigame(moveName,tier,enemyEvade=5){
  return new Promise(resolve=>{
    mgActive=true;
    const numKeys=clamp(5+tier*2,5,16);
    const timePerKey=Math.max(300,1000-tier*90);
    const invertChance=clamp(enemyEvade/EVADE_CAP*0.4,0,0.40);
    const seq=genArrowSeq(numKeys,invertChance);
    let idx=0,hits=0,totalHitTime=0,hitCount=0;
    document.getElementById('mg-move-name').textContent='Move: '+moveName;
    document.getElementById('mg-result').textContent='';
    document.getElementById('mg-hint').textContent='Press the highlighted key! Dashed = INVERTED (press OPPOSITE)!';
    document.getElementById('mg-progress').textContent='Key 1 / '+numKeys;
    document.getElementById('mg-threshold').textContent='Hit 50%+ to land | Hit fast for +25% dmg bonus';
    document.getElementById('mg-speed-bar').style.width='0%';
    const invertCount=seq.filter(s=>s.inverted).length;
    document.getElementById('mg-inverted-label').textContent=invertCount>0?'⚠ '+invertCount+' inverted key'+(invertCount>1?'s':''):'';
    const keysRow=document.getElementById('mg-keys-row');keysRow.innerHTML='';
    const keyEls=seq.map((k,i)=>{
      const el=document.createElement('div');
      el.className='mg-key'+(i===0?' next':' pending')+(k.inverted?' inverted':'');
      el.textContent=k.label;
      if(k.inverted){const sp=document.createElement('span');sp.style.cssText='font-size:9px;position:absolute;top:1px;right:2px';sp.textContent='⊗';el.style.position='relative';el.appendChild(sp);}
      keysRow.appendChild(el);return el;
    });
    document.getElementById('minigame-overlay').classList.add('active');
    const bar=document.getElementById('mg-timer-bar'),speedBar=document.getElementById('mg-speed-bar');
    let keyStart=performance.now();
    function tick(){
      if(!mgActive)return;
      const elapsed=performance.now()-keyStart,pct=Math.max(0,1-elapsed/timePerKey);
      bar.style.width=(pct*100).toFixed(1)+'%';
      if(hitCount>0){const af=totalHitTime/(hitCount*timePerKey);speedBar.style.width=Math.round(clamp((1-af)*100,0,100))+'%';}
      if(elapsed>timePerKey){keyEls[idx].className='mg-key miss'+(seq[idx].inverted?' inverted':'');advance(false,timePerKey);return;}
      mgAnimFrame=requestAnimationFrame(tick);
    }
    function advance(wasHit,hitTime){
      if(wasHit){hitCount++;totalHitTime+=hitTime;hits++;}
      idx++;if(idx>=seq.length){finish();return;}
      keyEls[idx].className='mg-key next'+(seq[idx].inverted?' inverted':'');
      document.getElementById('mg-progress').textContent='Key '+(idx+1)+' / '+numKeys;
      keyStart=performance.now();mgAnimFrame=requestAnimationFrame(tick);
    }
    function finish(){
      mgActive=false;cancelAnimationFrame(mgAnimFrame);bar.style.width='0%';
      const ratio=hits/numKeys;
      if(ratio<0.5){
        document.getElementById('mg-result').textContent='FAILED — '+hits+'/'+numKeys+' — attack misses!';
        document.getElementById('mg-hint').textContent='';
        document.removeEventListener('keydown',onKey);
        setTimeout(()=>{document.getElementById('minigame-overlay').classList.remove('active');resolve(0);},900);return;
      }
      let speedMult=1.0;
      if(hitCount>0){const af=totalHitTime/(hitCount*timePerKey);speedMult=1.0+clamp((1-af)*0.25,0,0.25);}
      let grade=speedMult>=1.22?'PERFECT':speedMult>=1.15?'GREAT':speedMult>=1.08?'GOOD':'OK';
      const fsp=hitCount>0?Math.round(clamp((1-(totalHitTime/(hitCount*timePerKey)))*100,0,100)):0;
      speedBar.style.width=fsp+'%';
      document.getElementById('mg-result').textContent=grade+'  '+hits+'/'+numKeys+' keys  ×'+speedMult.toFixed(2)+' DMG';
      document.getElementById('mg-hint').textContent='';
      document.removeEventListener('keydown',onKey);
      setTimeout(()=>{document.getElementById('minigame-overlay').classList.remove('active');resolve(speedMult);},900);
    }
    function onKey(e){
      if(!mgActive||idx>=seq.length)return;
      if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key))return;
      e.preventDefault();
      const hitTime=performance.now()-keyStart;
      const expected=seq[idx].inverted?OPPOSITE_ARROW[seq[idx].key]:seq[idx].key;
      if(e.key===expected){keyEls[idx].className='mg-key hit';cancelAnimationFrame(mgAnimFrame);setTimeout(()=>advance(true,hitTime),70);}
      else{keyEls[idx].className='mg-key miss';cancelAnimationFrame(mgAnimFrame);setTimeout(()=>advance(false,hitTime),70);}
    }
    document.addEventListener('keydown',onKey);
    mgAnimFrame=requestAnimationFrame(tick);
  });
}

const ENEMY_BASE_NAMES=['Beta','Gamma','Delta','Epsilon','Omega','Nemesis','Titan','Singularity','Vortex','Dreadnought','Phantom','Colossus'];
function getEnemyName(wi){const b=ENEMY_BASE_NAMES[wi%ENEMY_BASE_NAMES.length],c=Math.floor(wi/ENEMY_BASE_NAMES.length);return'Unit '+b+(c>0?' MK'+(c+1):'');}

const SHOP_CATALOG=[
  {id:'s_heal',name:'Medpack',desc:'Restore 35+HP',cost:60,shopOnly:false,apply:G=>{G.items.heal+=1;}},
  {id:'s_ether',name:'Ether',desc:'Restore all PP',cost:90,shopOnly:false,apply:G=>{G.items.ether+=1;}},
  {id:'s_boost',name:'Stim',desc:'ATK +40% for 3 turns',cost:80,shopOnly:false,apply:G=>{G.items.boost+=1;}},
  {id:'s_shield',name:'Shield Cell',desc:'DEF x2 for 2 turns',cost:75,shopOnly:false,apply:G=>{G.items.shield=(G.items.shield||0)+1;}},
  {id:'s_flash',name:'Flash Grenade',desc:'Guarantee stun next turn',cost:100,shopOnly:false,apply:G=>{G.items.flash=(G.items.flash||0)+1;}},
  {id:'s_clens',name:'Critical Lens',desc:'+20% ACC & guarantee next effect on next move',cost:70,shopOnly:false,apply:G=>{G.items.clens=(G.items.clens||0)+1;}},
  {id:'s_atkup',name:'ATK Shard',desc:'Permanently +4 ATK',cost:140,shopOnly:true,rare:true,apply:G=>{G.player.bAtk+=4;}},
  {id:'s_defup',name:'DEF Shard',desc:'Permanently +4 DEF',cost:140,shopOnly:true,rare:true,apply:G=>{G.player.bDef+=4;}},
  {id:'s_spdboost',name:'Velocity Core',desc:'Permanently +3 SPD',cost:130,shopOnly:true,rare:true,apply:G=>{G.player.spd+=3;}},
  {id:'s_critring',name:'Sniper Ring',desc:'Crit +12% permanently',cost:150,shopOnly:true,rare:true,apply:G=>{G.player.critBonus=(G.player.critBonus||0)+12;}},
  {id:'s_hpboost',name:'Biotic Cell',desc:'Max HP +50, heal 30',cost:160,shopOnly:true,rare:true,apply:G=>{G.player.maxHp+=50;G.player.hp=Math.min(G.player.hp+30,G.player.maxHp);}},
  {id:'s_vampserum',name:'Vamp Serum',desc:'All attacks drain 10% HP',cost:200,shopOnly:true,rare:true,apply:G=>{G.player.vamp=true;G.player.vampBonus=(G.player.vampBonus||0)+0.10;}},
  {id:'s_elixir',name:'Elixir of Power',desc:'ATK+3, DEF+3, SPD+2, HP+25',cost:250,shopOnly:true,rare:true,apply:G=>{G.player.bAtk+=3;G.player.bDef+=3;G.player.spd+=2;G.player.maxHp+=25;G.player.hp=Math.min(G.player.hp+25,G.player.maxHp);}},
  {id:'s_pp3all',name:'Memory Module',desc:'All moves +4 Max PP',cost:110,shopOnly:true,rare:true,apply:G=>{G.player.moves.forEach(m=>{m.maxPp+=4;m.pp=Math.min(m.pp+4,m.maxPp);});}},
  {id:'s_fullheal',name:'Revival Kit',desc:'Fully restore HP',cost:180,shopOnly:true,rare:true,apply:G=>{G.player.hp=G.player.maxHp;}},
  {id:'s_trait_medic',name:'Field Medic Chip',desc:'Trait: Medpacks +15 HP',cost:170,shopOnly:true,rare:true,traitId:'t_medic',apply:G=>{if(!G.traits.find(t=>t.id==='t_medic')){const t=TRAITS.find(x=>x.id==='t_medic');if(t)G.traits.push(t);renderTraits();}}},
  {id:'s_trait_swift',name:'Overdrive Core',desc:'Trait: Always win SPD ties',cost:150,shopOnly:true,rare:true,traitId:'t_swift',apply:G=>{if(!G.traits.find(t=>t.id==='t_swift')){const t=TRAITS.find(x=>x.id==='t_swift');if(t)G.traits.push(t);renderTraits();}}},
  {id:'s_trait_scav',name:'Salvage Module',desc:'Trait: +25g per wave clear',cost:130,shopOnly:true,rare:true,traitId:'t_scavenger',apply:G=>{if(!G.traits.find(t=>t.id==='t_scavenger')){const t=TRAITS.find(x=>x.id==='t_scavenger');if(t)G.traits.push(t);renderTraits();}}},
  {id:'s_trait_tank',name:'Reactive Armor',desc:'Trait: Incoming dmg -10%',cost:160,shopOnly:true,rare:true,traitId:'t_tank',apply:G=>{if(!G.traits.find(t=>t.id==='t_tank')){const t=TRAITS.find(x=>x.id==='t_tank');if(t)G.traits.push(t);renderTraits();}}},
  {id:'s_trait_momentum',name:'Momentum Engine',desc:'Trait: Consecutive hits +5% dmg',cost:200,shopOnly:true,rare:true,traitId:'t_momentum',apply:G=>{if(!G.traits.find(t=>t.id==='t_momentum')){const t=TRAITS.find(x=>x.id==='t_momentum');if(t)G.traits.push(t);renderTraits();}}},
  {id:'s_trait_vampire',name:'Bloodthirst Core',desc:'Trait: Drain 8% dmg as HP',cost:220,shopOnly:true,rare:true,traitId:'t_vampire_tr',apply:G=>{if(!G.traits.find(t=>t.id==='t_vampire_tr')){const t=TRAITS.find(x=>x.id==='t_vampire_tr');if(t){G.traits.push(t);G.player.vamp=true;G.player.vampBonus=Math.max(G.player.vampBonus||0,0.08);}renderTraits();}}},
  {id:'s_trait_critmast',name:'Critical OS',desc:'Trait: DoT on crit hits',cost:190,shopOnly:true,rare:true,traitId:'t_critburn',apply:G=>{if(!G.traits.find(t=>t.id==='t_critburn')){const t=TRAITS.find(x=>x.id==='t_critburn');if(t)G.traits.push(t);renderTraits();}}},
];

function rollShop(){
  const standard=SHOP_CATALOG.filter(x=>!x.shopOnly).filter(()=>Math.random()<0.55);
  const rareItems=SHOP_CATALOG.filter(x=>x.shopOnly&&x.rare).filter(()=>Math.random()<0.18);
  return[...standard,...rareItems];
}
function renderShop(){
  const grid=document.getElementById('shop-grid');grid.innerHTML='';
  document.getElementById('gold-display').textContent=G.gold;
  if(!G.shop||!G.shop.length){document.getElementById('shop-status').textContent='Sold out';grid.innerHTML='<div class="shop-empty">Sold out — restocks next wave</div>';return;}
  document.getElementById('shop-status').textContent='Open';
  G.shop.forEach((item,i)=>{
    if(item.traitId&&G.traits.find(t=>t.id===item.traitId))return;
    const wrap=document.createElement('div');wrap.className='tooltip-wrap';
    const btn=document.createElement('button');btn.className='shop-item';
    btn.disabled=G.gold<item.cost||G.busy||G.phase!=='player';
    btn.innerHTML='<span class="shop-item-name">'+item.name+(item.rare?'★':'')+'</span><span class="shop-item-cost">'+item.cost+'g</span>';
    btn.addEventListener('click',async()=>{
      if(G.gold<item.cost||G.busy)return;
      G.gold-=item.cost;
      if(item.apply.constructor.name==='AsyncFunction')await item.apply(G);else item.apply(G);
      G.shop.splice(i,1);addLog('> Shop: bought '+item.name+' (-'+item.cost+'g)','proj');
      renderShop();renderAll();
    });
    const tip=document.createElement('div');tip.className='tooltip-box';
    tip.textContent=item.name+(item.rare?' [RARE]':'')+'\nCost: '+item.cost+'g\n'+item.desc;
    wrap.appendChild(btn);wrap.appendChild(tip);grid.appendChild(wrap);
  });
}

const TIER_DMG_SCALE=[1.0,1.3,1.65,2.0];
const BASE_PMOVES=[
  {id:'quick',name:'Quick Strike',dmg:[14,20],acc:95,pp:18,maxPp:18,desc:'PWR 17 | ACC 95 | T0 | Always first',fx:null,tier:0,tipExtra:'Always acts first regardless of SPD. Fast and reliable.'},
  {id:'heavy',name:'Heavy Blow',dmg:[22,30],acc:82,pp:10,maxPp:10,desc:'PWR 26 | ACC 82 | T0',fx:null,tier:0,tipExtra:'Powerful but lower accuracy. Pure damage.'},
  {id:'barrage',name:'Rapid Barrage',dmg:[8,12],acc:88,pp:10,maxPp:10,desc:'PWR 10x2 | ACC 88 | Multi | T0',fx:'multihit',tier:0,tipExtra:'Hits twice.'},
  {id:'stun',name:'Shock Pulse',dmg:[18,25],acc:85,pp:10,maxPp:10,desc:'PWR 22 | 40% Stun | T0',fx:'stun',tier:0,tipExtra:'40% chance to stun. Lens guarantees stun.'},
  {id:'freeze_t0',name:'Cryo Snap',dmg:[16,22],acc:90,pp:10,maxPp:10,desc:'PWR 19 | SPD-1 2t | T0',fx:'chill',tier:0,tipExtra:'Reduces enemy SPD by 1 for 2 turns. Lens guarantees chill.'},
  {id:'thorn',name:'Thorn Strike',dmg:[12,18],acc:92,pp:12,maxPp:12,desc:'PWR 15 | Thorn 10% | T0',fx:'thornstrike',tier:0,tipExtra:'Deals damage + reflects 10% back.'},
  {id:'rend',name:'Rend',dmg:[10,16],acc:94,pp:14,maxPp:14,desc:'PWR 13 | DEF-1 2t | T0',fx:'rend',tier:0,tipExtra:'Shreds enemy DEF by 1 stage for 2 turns.'},
  {id:'sweepkick',name:'Sweep Kick',dmg:[13,19],acc:90,pp:12,maxPp:12,desc:'PWR 16 | 30% SPD-1 | T0',fx:'sweepkick',tier:0,tipExtra:'30% chance to slow. Lens guarantees slow.'},
  {id:'blast',name:'Overcharge',dmg:[30,40],acc:70,pp:7,maxPp:7,desc:'PWR 35 | ACC 70 | T1',fx:null,tier:1,tipExtra:'High damage, lower accuracy.'},
  {id:'drain',name:'Life Drain',dmg:[22,30],acc:88,pp:10,maxPp:10,desc:'PWR 26 | Heal 50% | T1',fx:'drain',tier:1,tipExtra:'Steals 50% of damage dealt as HP.'},
  {id:'pierce',name:'Void Strike',dmg:[20,28],acc:80,pp:10,maxPp:10,desc:'PWR 24 | Bypass DEF | T1',fx:'pierce',tier:1,tipExtra:'Completely bypasses enemy DEF.'},
  {id:'burn',name:'Incinerator',dmg:[16,24],acc:88,pp:12,maxPp:12,desc:'PWR 20 | Burn 3t | T1',fx:'burn',tier:1,tipExtra:'Burns enemy: 5.5% max HP/round 3 rounds. Lens guarantees burn.'},
  {id:'chill',name:'Cryo Bolt',dmg:[20,28],acc:90,pp:10,maxPp:10,desc:'PWR 24 | SPD-2 3t | T1',fx:'chill',tier:1,tipExtra:'Chills enemy: SPD-2 for 3 turns. Lens guarantees chill.'},
  {id:'poison',name:'Toxin Dart',dmg:[10,16],acc:92,pp:12,maxPp:12,desc:'PWR 13 | Poison 4t | T1',fx:'poison',tier:1,tipExtra:'Poisons: 4% max HP per round 4 rounds. Lens guarantees poison.'},
  {id:'bleedstrike',name:'Rupture',dmg:[18,26],acc:86,pp:10,maxPp:10,desc:'PWR 22 | Bleed 3t | T1',fx:'bleed',tier:1,tipExtra:'Bleeds enemy: 5% max HP per round 3 rounds.'},
  {id:'sunder',name:'Sunder',dmg:[15,22],acc:88,pp:10,maxPp:10,desc:'PWR 18 | DEF-2 3t | T1',fx:'sunder',tier:1,tipExtra:'Reduces enemy DEF by 2 stages for 3 turns.'},
  {id:'overwatch',name:'Overwatch',dmg:[18,25],acc:92,pp:10,maxPp:10,desc:'PWR 21 | Counter next | T1',fx:'overwatch',tier:1,tipExtra:'Counter-hit: if enemy attacks, auto-deal 50% back.'},
  // NEW: Gambler's Edge
  {id:'gamble',name:"Gambler's Edge",dmg:[10,60],acc:90,pp:8,maxPp:8,desc:"PWR ???  |  Luck | T1",fx:'gamble',tier:1,tipExtra:"Rolls a random outcome each use. Possible results:\n• JACKPOT: massive crit hit\n• DRAIN: heavy hit + lifesteal\n• DOUBLE: hits twice\n• SHIELD: defend + small hit\n• BUST: whiff — no damage\nWith Jackpot Synergy upgrade, each outcome is amplified.\nLens forces JACKPOT result."},
  {id:'snipe',name:'Sniper Shot',dmg:[36,50],acc:82,pp:8,maxPp:8,desc:'PWR 43 | Crit+30% | T2',fx:'highcrit',tier:2,tipExtra:'High crit chance (+30%).'},
  {id:'chain',name:'Chain Attack',dmg:[26,36],acc:92,pp:10,maxPp:10,desc:'PWR 31 | +12ea | T2',fx:'chain',tier:2,tipExtra:'Gains +12 ATK per consecutive use.'},
  {id:'regen',name:'Regenerate',dmg:[0,0],acc:100,pp:6,maxPp:6,desc:'Regen 3t | T2',fx:'regen',tier:2,tipExtra:'Restores 7% max HP each end-of-round 3 rounds.'},
  {id:'shield',name:'Iron Wall',dmg:[0,0],acc:100,pp:5,maxPp:5,desc:'DEF x2 2t | T2',fx:'ironwall',tier:2,tipExtra:'Doubles your DEF for 2 turns.'},
  {id:'leech',name:'Leech Field',dmg:[30,42],acc:88,pp:7,maxPp:7,desc:'PWR 36 | Heal+Poison | T2',fx:'leech',tier:2,tipExtra:'Drains HP (heal 50%) AND poisons enemy 3 turns.'},
  {id:'reflect',name:'Nullify',dmg:[0,0],acc:100,pp:5,maxPp:5,desc:'Negate next attack | T2',fx:'reflect',tier:2,tipExtra:'Reflects the next incoming attack back at attacker.'},
  {id:'execute_t2',name:'Finishing Blow',dmg:[28,40],acc:88,pp:8,maxPp:8,desc:'PWR 34 | +50% <30%HP | T2',fx:'executeblow',tier:2,tipExtra:'Deals +50% damage if enemy is below 30% HP.'},
  {id:'volley',name:'Arrow Volley',dmg:[10,15],acc:90,pp:10,maxPp:10,desc:'PWR 12 x3 | T2',fx:'triplehit',tier:2,tipExtra:'Hits 3 times.'},
  {id:'nuke',name:'Annihilate',dmg:[65,82],acc:62,pp:4,maxPp:4,desc:'PWR 73 | ACC 62 | T3',fx:null,tier:3,tipExtra:'Massive damage, low accuracy.'},
  {id:'glacial',name:'Glacial Nova',dmg:[46,60],acc:78,pp:5,maxPp:5,desc:'PWR 53 | Freeze+Bleed | T3',fx:'glacial',tier:3,tipExtra:'Heavy damage, 50% freeze, applies Bleed.'},
  {id:'rupture_t3',name:'Deathmark',dmg:[42,56],acc:85,pp:5,maxPp:5,desc:'PWR 49 | +20% dmg 2t | T3',fx:'deathmark',tier:3,tipExtra:'Marks enemy: your attacks +20% for 2 turns.'},
  {id:'overload_atk',name:'Overdrive',dmg:[36,50],acc:90,pp:6,maxPp:6,desc:'PWR 43 | Stacks ATK | T3',fx:'overloadhit',tier:3,tipExtra:'Each hit permanently stacks +3 ATK (up to 5 stacks).'},
  {id:'supernova',name:'Supernova',dmg:[55,72],acc:72,pp:5,maxPp:5,desc:'PWR 63 | Burn+Bleed+Chill | T3',fx:'supernova',tier:3,tipExtra:'Massive blast. Applies Burn, Bleed, AND Chill.'},
  {id:'wraithform',name:'Wraith Form',dmg:[0,0],acc:100,pp:4,maxPp:4,desc:'Evade+30% for 2t | T3',fx:'wraithform',tier:3,tipExtra:'Evade +30% for 2 turns.'},
  {id:'taunt',name:'Taunt',dmg:[0,0],acc:100,pp:6,maxPp:6,desc:'Force big moves 2t | Shop',fx:'taunt',tier:0,shopExclusive:true,tipExtra:'Forces enemy to use their highest-damage moves.'},
  {id:'fortify_atk',name:'Power Up',dmg:[0,0],acc:100,pp:8,maxPp:8,desc:'ATK +2 3t | Shop',fx:'fortify_atk',tier:0,shopExclusive:true,tipExtra:'Raises your ATK by 2 stages for 3 turns.'},
  {id:'fortify_def',name:'Brace',dmg:[0,0],acc:100,pp:8,maxPp:8,desc:'DEF +2 3t | Shop',fx:'fortify_def',tier:0,shopExclusive:true,tipExtra:'Raises your DEF by 2 stages for 3 turns.'},
  {id:'sacrifice',name:'Blood Price',dmg:[0,0],acc:100,pp:6,maxPp:6,desc:'Spend 15%HP → ATK+4 3t | Shop',fx:'sacrifice',tier:1,shopExclusive:true,tipExtra:'Sacrifice 15% HP for ATK+4 stages 3 turns.'},
  {id:'doubleedge',name:'Double Edge',dmg:[50,70],acc:88,pp:5,maxPp:5,desc:'PWR 60 | 25% recoil | Shop',fx:'doubleedge',tier:2,shopExclusive:true,tipExtra:'Massive damage but 25% recoil.'},
];

BASE_PMOVES.forEach(m=>{
  if(m.shopExclusive)return;
  const s=TIER_DMG_SCALE[m.tier]||1.0;
  if(m.dmg[0]>0)m.dmg=[Math.round(m.dmg[0]*s),Math.round(m.dmg[1]*s)];
});

const ENEMY_THEMES=[
  {name:'Brawler',aiDesc:'Aggressive melee. Prioritizes highest damage. Uses Power Up when healthy.',buildFn:(wi,ds)=>[
    {name:'Power Slam',dmg:[Math.round(22*ds),Math.round(30*ds)],acc:90,pp:14,maxPp:14,fx:null},
    {name:'Steady Jab',dmg:[Math.round(13*ds),Math.round(19*ds)],acc:100,pp:16,maxPp:16,fx:null},
    {name:'Headbutt',dmg:[Math.round(18*ds),Math.round(26*ds)],acc:88,pp:12,maxPp:12,fx:null},
    {name:'Power Up',dmg:[0,0],acc:100,pp:6,maxPp:6,fx:'fortify_atk'},
  ]},
  {name:'Leech Vampire',aiDesc:'Sustain fighter. Uses drain when HP drops. Poison counters regen.',buildFn:(wi,ds)=>[
    {name:'Power Slam',dmg:[Math.round(20*ds),Math.round(28*ds)],acc:90,pp:12,maxPp:12,fx:null},
    {name:'Life Drain',dmg:[Math.round(10*ds),Math.round(17*ds)],acc:85,pp:12,maxPp:12,fx:'drain'},
    {name:'Leech Field',dmg:[Math.round(15*ds),Math.round(21*ds)],acc:88,pp:8,maxPp:8,fx:'leech'},
    {name:'Brace',dmg:[0,0],acc:100,pp:5,maxPp:5,fx:'fortify_def'},
  ]},
  {name:'Pyromaniac',aiDesc:'DoT specialist. Stacks Burn then deals damage. Kill fast before fire accumulates.',buildFn:(wi,ds)=>[
    {name:'Burn Strike',dmg:[Math.round(14*ds),Math.round(22*ds)],acc:88,pp:12,maxPp:12,fx:'burn'},
    {name:'Inferno',dmg:[Math.round(24*ds),Math.round(34*ds)],acc:72,pp:7,maxPp:7,fx:'burn'},
    {name:'Flame Jab',dmg:[Math.round(10*ds),Math.round(16*ds)],acc:95,pp:14,maxPp:14,fx:'burn'},
    {name:'Backdraft',dmg:[Math.round(20*ds),Math.round(28*ds)],acc:82,pp:10,maxPp:10,fx:null},
    {name:'Brace',dmg:[0,0],acc:100,pp:4,maxPp:4,fx:'fortify_def'},
  ]},
  {name:'Glass Cannon',aiDesc:'Extreme damage, low DEF. Kill fast — low HP but can one-shot.',buildFn:(wi,ds)=>[
    {name:'All-In',dmg:[Math.round(36*ds),Math.round(50*ds)],acc:60,pp:6,maxPp:6,fx:null},
    {name:'Sniper Shot',dmg:[Math.round(30*ds),Math.round(42*ds)],acc:80,pp:8,maxPp:8,fx:'highcrit'},
    {name:'Quick Burst',dmg:[Math.round(16*ds),Math.round(22*ds)],acc:95,pp:14,maxPp:14,fx:null},
    {name:'Power Up',dmg:[0,0],acc:100,pp:5,maxPp:5,fx:'fortify_atk'},
  ]},
  {name:'Stunner',aiDesc:'Tries to stun every other turn. Uses big hits while paralyzed.',buildFn:(wi,ds)=>[
    {name:'Shock Blast',dmg:[Math.round(20*ds),Math.round(28*ds)],acc:82,pp:10,maxPp:10,fx:'stun'},
    {name:'Chain Shock',dmg:[Math.round(16*ds),Math.round(22*ds)],acc:88,pp:12,maxPp:12,fx:'stun'},
    {name:'EMP Strike',dmg:[Math.round(24*ds),Math.round(34*ds)],acc:75,pp:8,maxPp:8,fx:'stun'},
    {name:'Overcharge',dmg:[Math.round(30*ds),Math.round(42*ds)],acc:68,pp:5,maxPp:5,fx:null},
    {name:'Steady Jab',dmg:[Math.round(14*ds),Math.round(20*ds)],acc:100,pp:12,maxPp:12,fx:null},
  ]},
  {name:'Toxicologist',aiDesc:'Stacks poison and burn together. Prioritize burst or use immunities.',buildFn:(wi,ds)=>[
    {name:'Toxin Dart',dmg:[Math.round(8*ds),Math.round(14*ds)],acc:92,pp:12,maxPp:12,fx:'poison'},
    {name:'Venom Strike',dmg:[Math.round(16*ds),Math.round(24*ds)],acc:88,pp:10,maxPp:10,fx:'poison'},
    {name:'Leech Field',dmg:[Math.round(18*ds),Math.round(26*ds)],acc:88,pp:8,maxPp:8,fx:'leech'},
    {name:'Acid Splash',dmg:[Math.round(12*ds),Math.round(18*ds)],acc:90,pp:12,maxPp:12,fx:'burn'},
    {name:'Power Slam',dmg:[Math.round(22*ds),Math.round(32*ds)],acc:88,pp:10,maxPp:10,fx:null},
  ]},
  {name:'Berserker',aiDesc:'Gets stronger as HP drops. Bleed + heavy attacks. Frenzy below 40% HP.',buildFn:(wi,ds)=>[
    {name:'Rupture',dmg:[Math.round(22*ds),Math.round(32*ds)],acc:84,pp:9,maxPp:9,fx:'bleed'},
    {name:'Frenzy Slam',dmg:[Math.round(26*ds),Math.round(38*ds)],acc:82,pp:8,maxPp:8,fx:null},
    {name:'Barrage',dmg:[Math.round(10*ds),Math.round(16*ds)],acc:90,pp:10,maxPp:10,fx:'multihit'},
    {name:'Bleed Strike',dmg:[Math.round(18*ds),Math.round(26*ds)],acc:90,pp:11,maxPp:11,fx:'bleed'},
    {name:'Power Up',dmg:[0,0],acc:100,pp:5,maxPp:5,fx:'fortify_atk'},
  ]},
  {name:'Void Piercer',aiDesc:'All attacks bypass DEF. Iron Wall is useless. Use high HP + drain.',buildFn:(wi,ds)=>[
    {name:'Void Pierce',dmg:[Math.round(22*ds),Math.round(30*ds)],acc:82,pp:10,maxPp:10,fx:'pierce'},
    {name:'Armor Shred',dmg:[Math.round(18*ds),Math.round(26*ds)],acc:88,pp:11,maxPp:11,fx:'pierce'},
    {name:'Cryo Bolt',dmg:[Math.round(12*ds),Math.round(18*ds)],acc:90,pp:10,maxPp:10,fx:'chill'},
    {name:'Iron Wall',dmg:[0,0],acc:100,pp:4,maxPp:4,fx:'ironwall'},
    {name:'Steady Jab',dmg:[Math.round(14*ds),Math.round(20*ds)],acc:100,pp:10,maxPp:10,fx:null},
  ]},
  {name:'Frost Warden',aiDesc:'Slows and freezes. Applies Chill every chance. Burn removes chill stacks.',buildFn:(wi,ds)=>[
    {name:'Blizzard',dmg:[Math.round(18*ds),Math.round(26*ds)],acc:88,pp:12,maxPp:12,fx:'chill'},
    {name:'Ice Lance',dmg:[Math.round(24*ds),Math.round(34*ds)],acc:80,pp:9,maxPp:9,fx:'chill'},
    {name:'Frost Jab',dmg:[Math.round(12*ds),Math.round(18*ds)],acc:96,pp:14,maxPp:14,fx:'chill'},
    {name:'Iron Wall',dmg:[0,0],acc:100,pp:5,maxPp:5,fx:'ironwall'},
    {name:'Brace',dmg:[0,0],acc:100,pp:4,maxPp:4,fx:'fortify_def'},
  ]},
  {name:'Phantom Blade',aiDesc:'High evade, crit-focused. Hard to hit but glass.',buildFn:(wi,ds)=>[
    {name:'Shadow Stab',dmg:[Math.round(22*ds),Math.round(32*ds)],acc:90,pp:12,maxPp:12,fx:'highcrit'},
    {name:'Phantom Slash',dmg:[Math.round(28*ds),Math.round(40*ds)],acc:82,pp:9,maxPp:9,fx:'highcrit'},
    {name:'Nullify',dmg:[0,0],acc:100,pp:3,maxPp:3,fx:'reflect'},
    {name:'Quick Stab',dmg:[Math.round(14*ds),Math.round(20*ds)],acc:98,pp:14,maxPp:14,fx:null},
    {name:'Rupture',dmg:[Math.round(20*ds),Math.round(28*ds)],acc:85,pp:8,maxPp:8,fx:'bleed'},
  ],extraEvade:15},
  {name:'Regenerator',aiDesc:'Tanks and heals back. High DEF + Regen. Use Pierce or DoT.',buildFn:(wi,ds)=>[
    {name:'Regenerate',dmg:[0,0],acc:100,pp:6,maxPp:6,fx:'regen'},
    {name:'Slam',dmg:[Math.round(20*ds),Math.round(28*ds)],acc:88,pp:12,maxPp:12,fx:null},
    {name:'Brace',dmg:[0,0],acc:100,pp:6,maxPp:6,fx:'fortify_def'},
    {name:'Heavy Strike',dmg:[Math.round(26*ds),Math.round(36*ds)],acc:80,pp:8,maxPp:8,fx:null},
    {name:'Drain Field',dmg:[Math.round(18*ds),Math.round(26*ds)],acc:85,pp:9,maxPp:9,fx:'drain'},
  ],extraDef:8},
  {name:'Deathbringer',aiDesc:'Pure offense. No defense. Highest damage every turn. Boost DEF and heal.',buildFn:(wi,ds)=>[
    {name:'Oblivion',dmg:[Math.round(36*ds),Math.round(50*ds)],acc:64,pp:5,maxPp:5,fx:null},
    {name:'Annihilate',dmg:[Math.round(42*ds),Math.round(58*ds)],acc:58,pp:4,maxPp:4,fx:null},
    {name:'Devastate',dmg:[Math.round(28*ds),Math.round(40*ds)],acc:74,pp:7,maxPp:7,fx:null},
    {name:'Power Up',dmg:[0,0],acc:100,pp:5,maxPp:5,fx:'fortify_atk'},
    {name:'Quick Burst',dmg:[Math.round(16*ds),Math.round(22*ds)],acc:96,pp:14,maxPp:14,fx:null},
  ]},
  {name:'Armor Shredder',aiDesc:'Stacks DEF debuffs before unleashing big hits. Iron Wall early.',buildFn:(wi,ds)=>[
    {name:'Rend',dmg:[Math.round(12*ds),Math.round(18*ds)],acc:94,pp:14,maxPp:14,fx:'rend'},
    {name:'Sunder',dmg:[Math.round(15*ds),Math.round(22*ds)],acc:88,pp:10,maxPp:10,fx:'sunder'},
    {name:'Expose',dmg:[Math.round(18*ds),Math.round(28*ds)],acc:86,pp:10,maxPp:10,fx:'rend'},
    {name:'Crusher',dmg:[Math.round(28*ds),Math.round(40*ds)],acc:80,pp:7,maxPp:7,fx:null},
  ]},
  {name:'Speed Demon',aiDesc:'Extremely high SPD. Chain attack snowballs. Use Chill to slow.',buildFn:(wi,ds)=>[
    {name:'Blitz',dmg:[Math.round(18*ds),Math.round(26*ds)],acc:96,pp:14,maxPp:14,fx:null},
    {name:'Chain Strike',dmg:[Math.round(22*ds),Math.round(30*ds)],acc:92,pp:10,maxPp:10,fx:'chain'},
    {name:'Rapid Fire',dmg:[Math.round(10*ds),Math.round(16*ds)],acc:92,pp:12,maxPp:12,fx:'multihit'},
    {name:'Power Up',dmg:[0,0],acc:100,pp:5,maxPp:5,fx:'fortify_atk'},
  ],extraSpd:8},
];

const ENEMY_BASE_POOLS=[
  {hp:110,atk:9,def:8,spd:8,evade:0,reward:80,gold:30},
  {hp:140,atk:12,def:10,spd:10,evade:2,reward:150,gold:45},
  {hp:170,atk:15,def:12,spd:12,evade:4,reward:230,gold:60},
  {hp:135,atk:18,def:14,spd:14,evade:6,reward:320,gold:80},
  {hp:240,atk:22,def:17,spd:16,evade:8,reward:450,gold:100},
  {hp:295,atk:27,def:21,spd:18,evade:10,reward:620,gold:130},
  {hp:370,atk:34,def:26,spd:21,evade:13,reward:880,gold:165},
  {hp:460,atk:42,def:32,spd:24,evade:16,reward:1200,gold:200},
  {hp:560,atk:52,def:39,spd:26,evade:18,reward:1600,gold:240},
  {hp:670,atk:62,def:46,spd:28,evade:20,reward:2100,gold:285},
  {hp:800,atk:74,def:55,spd:30,evade:23,reward:2700,gold:330},
  {hp:950,atk:88,def:64,spd:32,evade:25,reward:3400,gold:380},
];

function buildEnemy(waveIdx){
  const poolIdx=waveIdx%ENEMY_BASE_POOLS.length;
  const e=ENEMY_BASE_POOLS[poolIdx];
  const cycle=Math.floor(waveIdx/ENEMY_BASE_POOLS.length);
  const mkScale=Math.pow(1.35,cycle);
  const mkAtkScale=Math.pow(1.28,cycle);
  const withinScale=1+poolIdx*0.06;
  const dmgScale=Math.max(0.8,1+waveIdx*0.07+cycle*0.12);
  const themeIdx=poolIdx%ENEMY_THEMES.length;
  const theme=ENEMY_THEMES[themeIdx];
  const baseMoves=theme.buildFn(waveIdx,dmgScale);
  let extraMoves=[];
  if(cycle>=1)extraMoves.push({name:'MK Overdrive',dmg:[Math.round(26*dmgScale),Math.round(38*dmgScale)],acc:82,pp:7,maxPp:7,fx:'stun'});
  if(cycle>=2){extraMoves.push({name:'MK Barrage',dmg:[Math.round(16*dmgScale),Math.round(24*dmgScale)],acc:88,pp:10,maxPp:10,fx:'multihit'});extraMoves.push({name:'MK Leech',dmg:[Math.round(14*dmgScale),Math.round(22*dmgScale)],acc:88,pp:8,maxPp:8,fx:'leech'});}
  if(cycle>=3){extraMoves.push({name:'MK Destroyer',dmg:[Math.round(36*dmgScale),Math.round(52*dmgScale)],acc:68,pp:5,maxPp:5,fx:'pierce'});extraMoves.push({name:'MK Nullify',dmg:[0,0],acc:100,pp:4,maxPp:4,fx:'reflect'});}
  const allMoves=[...baseMoves,...extraMoves].slice(0,6).map(m=>({...m,pp:m.maxPp}));
  return{
    name:getEnemyName(waveIdx),theme:theme.name,aiDesc:theme.aiDesc,
    maxHp:Math.round(e.hp*mkScale*withinScale),hp:Math.round(e.hp*mkScale*withinScale),
    bAtk:Math.round(e.atk*mkAtkScale*withinScale)+(theme.extraAtk||0),
    bDef:Math.round(e.def*mkScale*withinScale)+(theme.extraDef||0),
    spd:Math.round(e.spd*Math.pow(1.1,cycle))+(theme.extraSpd||0),
    evade:Math.round((e.evade||0)+(theme.extraEvade||0)),
    atkBuf:0,defBuf:0,defMult:1,atkBufTurns:0,defBufTurns:0,critBonus:0,defDebuf:0,defDebufTurns:0,
    status:{burn:0,stun:0,regen:0,reflect:0,chill:0,poison:0,bleed:0,tauntTurns:0,shieldTurns:0},
    reward:Math.round(e.reward*Math.pow(1.5,cycle)*(1+poolIdx*0.05)),
    gold:Math.round(e.gold*Math.pow(1.4,cycle)*(1+poolIdx*0.05)),
    moves:allMoves,cycle,waveIdx,
    pendingStatus:{burn:0,poison:0,bleed:0,regen:0,chill:0},
  };
}

const ATK_PIERCE_BASE=16;
const getAtk=c=>{
  let a=Math.max(1,Math.round(c.bAtk*(1+c.atkBuf*0.22)));
  if(G.player===c&&c.berserk&&c.hp/c.maxHp<0.3)a=Math.round(a*2);
  if(G.player===c&&c.status&&c.status.stimTurns>0)a=Math.round(a*1.4);
  if(G.player===c&&c.overload)a+=c.overloadStacks*2;
  if(c.status&&c.status.chill>0)a=Math.round(a*0.88);
  if(G.deathmarkActive&&c===G.player)a=Math.round(a*1.2);
  return a;
};
const getDef=c=>{
  let d=Math.max(1,Math.round(c.bDef*(1+c.defBuf*0.22)*(c.defMult||1)));
  if(c.defDebuf&&c.defDebuf>0)d=Math.max(1,Math.round(d*(1-c.defDebuf*0.12)));
  if(G.traits.find(t=>t.id==='t_tough')&&c===G.player)d+=5;
  if(G.traits.find(t=>t.id==='t_tank')&&c===G.player)d=Math.round(d*1.10);
  return d;
};
const getCrit=c=>{
  let cr=clamp(10+(c.critBonus||0),0,CRIT_CAP);
  if(G.blurSteelUpg&&c===G.player)cr=clamp(cr+Math.floor(c.spd/5)*3,0,CRIT_CAP);
  return cr;
};
const getEvade=c=>clamp(5+(c.evadeBonus||0)+(c.status&&c.status.wraithTurns>0?30:0),0,EVADE_CAP);
const getAIEvade=c=>clamp(c.evade||0,0,EVADE_CAP);

function calcDmg(att,def,mv,ignDef,mgMult=1.0){
  if(!mv.dmg||mv.dmg[0]===0)return{dmg:0,crit:false};
  let base=rnd(mv.dmg[0],mv.dmg[1]);
  const atkVal=getAtk(att);
  let dmg;
  if(ignDef)dmg=Math.max(1,Math.round(base*(atkVal/ATK_PIERCE_BASE)*mgMult));
  else{const defVal=getDef(def);dmg=Math.max(1,Math.round(base*(atkVal/defVal)*mgMult));}
  const critChance=mv.fx==='highcrit'?clamp(getCrit(att)+30,0,CRIT_CAP):getCrit(att);
  const crit=Math.random()*100<critChance;
  if(crit)dmg=Math.round(dmg*(att.critMult||1.5));
  if(att.execute&&def.hp/def.maxHp<0.25)dmg=Math.round(dmg*1.6);
  if(G.traits.find(t=>t.id==='t_momentum')&&att===G.player)dmg=Math.round(dmg*(1+(G.momentumCount||0)*0.05));
  if(G.deathmarkActive&&att===G.player)dmg=Math.round(dmg*1.2);
  if(G.speedkillUpg&&att===G.player&&playerGoesFirst())dmg=Math.round(dmg*1.15);
  if(G.traits.find(t=>t.id==='t_tank')&&def===G.player)dmg=Math.round(dmg*0.90);
  if(crit&&G.traits.find(t=>t.id==='t_critburn')&&def!==G.player)def.pendingStatus.burn=Math.max(def.pendingStatus.burn||0,2);
  return{dmg,crit};
}

function expectedDmg(att,def,mv){
  if(!mv.dmg||mv.dmg[0]===0)return 0;
  if(mv.fx==='gamble')return Math.round((mv.dmg[0]+mv.dmg[1])/2*(getAtk(att)/getDef(def))*(mv.acc/100));
  const avg=(mv.dmg[0]+mv.dmg[1])/2;
  const r=mv.fx==='pierce'?getAtk(att)/ATK_PIERCE_BASE:getAtk(att)/getDef(def);
  const cc=clamp(getCrit(att),5,CRIT_CAP)/100;
  const ed=Math.round(avg*r*(1-cc+cc*(att.critMult||1.5)));
  const hit=mv.acc/100;
  if(mv.fx==='multihit')return Math.round(ed*2*hit);
  if(mv.fx==='triplehit')return Math.round(ed*3*hit);
  return Math.round(ed*hit);
}

function playerGoesFirst(){
  const pSpd=G.player.spd+(G.player.status&&G.player.status.stimTurns>0?3:0);
  const aSpd=G.ai.spd+(G.ai.status&&G.ai.status.chill>0?-2:0);
  if(pSpd>aSpd)return true;
  if(aSpd>pSpd)return false;
  return G.traits.find(t=>t.id==='t_swift')?true:Math.random()<0.5;
}

function getRadarData(){
  const maxStat=80;const p=G.player,a=G.ai;
  const norm=(v,max)=>Math.min(100,Math.round(v/max*100));
  return{
    player:[norm(getAtk(p),maxStat),norm(getDef(p),maxStat),norm(p.spd,40),norm(getCrit(p),CRIT_CAP),norm(getEvade(p),EVADE_CAP),norm(p.hp,p.maxHp)],
    ai:[norm(getAtk(a),maxStat),norm(getDef(a),maxStat),norm(a.spd,40),norm(10,CRIT_CAP),norm(getAIEvade(a),EVADE_CAP),norm(a.hp,a.maxHp)],
  };
}

let G={};let radarChart=null;
function updateRadar(){
  const d=getRadarData();
  if(!radarChart){
    const ctx=document.getElementById('radarChart').getContext('2d');
    radarChart=new Chart(ctx,{type:'radar',data:{labels:['ATK','DEF','SPD','CRIT','EVADE','HP'],datasets:[
      {label:'You',data:d.player,borderColor:'rgba(0,0,0,0.85)',backgroundColor:'rgba(0,0,0,0.1)',borderWidth:1.5,pointRadius:2,pointBackgroundColor:'rgba(0,0,0,0.85)'},
      {label:'Opp',data:d.ai,borderColor:'rgba(150,150,150,0.85)',backgroundColor:'rgba(150,150,150,0.1)',borderWidth:1.5,pointRadius:2,pointBackgroundColor:'rgba(150,150,150,0.85)',borderDash:[4,3]}
    ]},options:{responsive:true,maintainAspectRatio:true,plugins:{legend:{display:false}},scales:{r:{min:0,max:100,ticks:{display:true,stepSize:25,font:{size:8},color:'#999',backdropColor:'transparent'},grid:{color:'rgba(0,0,0,0.12)'},angleLines:{color:'rgba(0,0,0,0.12)'},pointLabels:{font:{size:10},color:'#333'}}},animation:{duration:300}}});
  }else{radarChart.data.datasets[0].data=d.player;radarChart.data.datasets[1].data=d.ai;radarChart.update('none');}
}

function initGame(){
  G={
    wave:1,turn:1,phase:'player',busy:false,
    score:0,waveScore:0,level:1,exp:0,expNext:100,
    gold:80,
    items:{heal:2,ether:0,boost:0,shield:0,flash:0,clens:0},
    shop:rollShop(),
    traits:[],chainCount:0,momentumCount:0,
    nextMoveAccBonus:0,
    nextMoveEffectGuarantee:false,
    deathmarkActive:false,deathmarkTurns:0,
    blurSteelUpg:false,speedkillUpg:false,dotMasterUpg:false,chainBoosted:false,pierceDegrade:false,
    jackpotSynergy:false,
    player:{
      name:'Unit Alpha',maxHp:130,hp:130,
      bAtk:10,bDef:10,spd:10,
      atkBuf:0,defBuf:0,defMult:1,
      atkBufTurns:0,defBufTurns:0,
      defDebuf:0,defDebufTurns:0,
      critBonus:0,evadeBonus:0,critMult:1.5,
      vamp:false,vampBonus:0.15,
      reflect20:false,reflect10:false,berserk:false,
      phoenix:false,phoenixUsed:false,execute:false,counter:false,
      burnImmune:false,stunImmune:false,poisonImmune:false,lastStand:false,
      overload:false,overloadStacks:0,
      overdriveCnt:0,overwatchReady:false,
      moves:['quick','heavy','barrage','stun'].map(id=>getMoveById(id)),
      status:{burn:0,stun:0,regen:0,reflect:0,stimTurns:0,chill:0,poison:0,bleed:0,shieldTurns:0,tauntTurns:0,wraithTurns:0},
      pendingStatus:{burn:0,poison:0,bleed:0,regen:0,chill:0},
    },
    ai:buildEnemy(0),
    appliedUpgrades:[],
    pendingMoveLearn:null,
    moveReplaceCallback:null,
  };
  document.getElementById('resultbox').classList.remove('show');
  document.getElementById('main-layout').style.display='';
  clearLog();renderAll();renderShop();
  setMsg('What will Unit Alpha do?',true);
  setMovesEnabled(true);renderTraits();updateWaveInfo();updateProbTable();updateRadar();
  updateEnemyMovesPanel();updateAIStrategyBox();
}

function getMoveById(id){const m=BASE_PMOVES.find(x=>x.id===id);return m?{...m,pp:m.maxPp}:null;}

function renderAll(){
  renderFighter('player');renderFighter('ai');
  renderMoves();renderItems();renderStats();
  document.getElementById('r-wave').textContent=G.wave;
  document.getElementById('r-turn').textContent=G.turn;
  document.getElementById('r-level').textContent=G.level;
  document.getElementById('r-exp').textContent=G.exp+'/'+G.expNext;
  document.getElementById('score-top').textContent=G.score.toLocaleString();
  document.getElementById('gold-top').textContent=G.gold;
  document.getElementById('gold-display').textContent=G.gold;
  document.getElementById('wave-top').textContent=G.wave;
  document.getElementById('level-top').textContent=G.level;
  document.getElementById('round-lbl').textContent=G.turn;
  document.getElementById('arena-wave').textContent='Wave '+G.wave;
  const diffNames=['Novice','Easy','Normal','Hard','Expert','Elite','Master','Legendary','Apex','Infernal','Transcendent','Divine'];
  document.getElementById('diff-top').textContent=diffNames[clamp(G.wave-1,0,diffNames.length-1)];
  document.getElementById('turn-line').textContent=G.phase==='player'?'Turn '+G.turn+' — your move':G.phase==='ai'?'Turn '+G.turn+" — opponent's move":'Turn '+G.turn+' — battle over';
  updateProbTable();updateRadar();
  renderPendingEffects();
}

function renderPendingEffects(){
  ['player','ai'].forEach(who=>{
    const c=G[who];const el=document.getElementById('pending-'+who);if(!el)return;
    const parts=[];
    if(c.pendingStatus){
      if(c.pendingStatus.burn>0)parts.push('🔥'+c.pendingStatus.burn+'t');
      if(c.pendingStatus.poison>0)parts.push('☠'+c.pendingStatus.poison+'t');
      if(c.pendingStatus.bleed>0)parts.push('🩸'+c.pendingStatus.bleed+'t');
      if(c.pendingStatus.regen>0)parts.push('💚'+c.pendingStatus.regen+'t');
    }
    el.textContent=parts.length?'End-rnd: '+parts.join(' '):'';
  });
}

function renderFighter(who){
  const c=G[who];
  const pct=Math.max(0,c.hp/c.maxHp);
  const fill=document.getElementById(who+'-fill');
  fill.style.width=(pct*100).toFixed(1)+'%';
  fill.className='hpfill'+(pct<=0.25?' low':pct<=0.5?' mid':'');
  document.getElementById(who+'-nums').textContent=Math.max(0,c.hp)+'/'+c.maxHp;
  document.getElementById(who+'-name-el').textContent=c.name;
  const badge=document.getElementById(who+'-badge');
  const parts=[];
  if(c.atkBuf>0)parts.push('ATK+'+c.atkBuf+(c.atkBufTurns>0?' '+c.atkBufTurns+'t':''));
  if(c.defBuf>0)parts.push('DEF+'+c.defBuf+(c.defBufTurns>0?' '+c.defBufTurns+'t':''));
  if(c.defDebuf>0)parts.push('DEF-'+c.defDebuf+(c.defDebufTurns>0?' '+c.defDebufTurns+'t':''));
  if(c.defMult&&c.defMult>1)parts.push('WALL');
  if(c.status){
    if(c.status.burn>0)parts.push('BURN');if(c.status.stun>0)parts.push('STUN');
    if(c.status.regen>0)parts.push('REGEN');if(c.status.reflect>0)parts.push('REFLECT');
    if(c.status.chill>0)parts.push('CHILL');if(c.status.poison>0)parts.push('PSNT');
    if(c.status.bleed>0)parts.push('BLEED');if(c.status.tauntTurns>0)parts.push('TAUNTED');
    if(who==='player'&&c.status.stimTurns>0)parts.push('STIM '+c.status.stimTurns+'t');
    if(who==='player'&&c.status.shieldTurns>0)parts.push('SHIELD '+c.status.shieldTurns+'t');
    if(who==='player'&&c.status.wraithTurns>0)parts.push('WRAITH '+c.status.wraithTurns+'t');
  }
  if(who==='player'&&c.overload&&c.overloadStacks>0)parts.push('OVL+'+c.overloadStacks);
  if(who==='player'&&G.nextMoveAccBonus>0)parts.push('LENS+'+G.nextMoveAccBonus+'%');
  if(who==='player'&&G.nextMoveEffectGuarantee)parts.push('LENS-EFFECT');
  if(who==='player'&&G.deathmarkActive)parts.push('MARK '+G.deathmarkTurns+'t');
  if(who==='player'&&c.overwatchReady)parts.push('OVERWATCH');
  if(who==='ai'&&c.cycle>0)parts.push('MK'+(c.cycle+1));
  if(parts.length){badge.textContent=parts.join(' | ');badge.style.display='inline';}
  else badge.style.display='none';
}

function renderMoves(){
  const grid=document.getElementById('moves-grid');grid.innerHTML='';
  G.player.moves.forEach(mv=>{
    const ppZero=mv.pp<=0&&!(G.player.lastStand&&G.player.hp/G.player.maxHp<0.2);
    const wrap=document.createElement('div');wrap.className='tooltip-wrap';
    const btn=document.createElement('button');btn.className='mbtn';
    btn.disabled=ppZero||G.busy||G.phase!=='player';
    btn.innerHTML='<span class="mbtn-name">'+mv.name+'</span><span class="mbtn-sub">'+mv.desc+'</span><span class="mbtn-pp">PP '+mv.pp+'/'+mv.maxPp+'</span>';
    btn.addEventListener('click',()=>playerMove(mv.name));
    const tip=document.createElement('div');tip.className='tooltip-box';
    const expD=expectedDmg(G.player,G.ai,mv);
    tip.textContent=mv.name+'\n'+(mv.dmg&&mv.dmg[0]>0?'Damage: '+mv.dmg[0]+'-'+mv.dmg[1]+'\n':'')+'Accuracy: '+mv.acc+'%\nPP: '+mv.pp+'/'+mv.maxPp+(expD>0?'\nE[dmg]: '+expD:'')+'\n\n'+(mv.tipExtra||mv.desc);
    wrap.appendChild(btn);wrap.appendChild(tip);grid.appendChild(wrap);
  });
}

function renderItems(){
  const row=document.getElementById('item-row');row.innerHTML='';
  const ITEM_DEFS=[
    {key:'heal',label:'Medpack',tip:'Restores '+(35+G.level*2+(G.traits.find(t=>t.id==='t_medic')?15:0))+' HP instantly.'},
    {key:'ether',label:'Ether',tip:'Fully restores all move PP.'},
    {key:'boost',label:'Stim',tip:'Boosts ATK by 40% for 3 turns.'},
    {key:'shield',label:'Shield Cell',tip:'Doubles DEF for 2 turns.'},
    {key:'flash',label:'Flash Grenade',tip:'Guarantees opponent stunned next turn.'},
    {key:'clens',label:'Crit Lens',tip:'+20% ACC AND guarantees next status effect on your next move.'},
  ];
  ITEM_DEFS.forEach(({key,label,tip})=>{
    const n=G.items[key]||0;
    if(n<=0&&['shield','flash','clens'].includes(key))return;
    const wrap=document.createElement('div');wrap.className='tooltip-wrap';
    const btn=document.createElement('button');btn.id='item-'+key;
    btn.disabled=n<=0||G.busy||G.phase!=='player';
    btn.textContent=label+' ('+n+')';
    btn.addEventListener('click',()=>useItem(key));
    const tipEl=document.createElement('div');tipEl.className='tooltip-box';tipEl.textContent=label+' (x'+n+')\n'+tip;
    wrap.appendChild(btn);wrap.appendChild(tipEl);row.appendChild(wrap);
  });
}

function renderStats(){
  document.getElementById('s-atk').textContent=getAtk(G.player);
  document.getElementById('s-def').textContent=getDef(G.player);
  document.getElementById('s-spd').textContent=G.player.spd;
  document.getElementById('s-crit').textContent=getCrit(G.player)+'%'+(getCrit(G.player)>=CRIT_CAP?' [CAP]':'');
  document.getElementById('s-evade').textContent=getEvade(G.player)+'%'+(getEvade(G.player)>=EVADE_CAP?' [CAP]':'');
  document.getElementById('s-aiatk').textContent=getAtk(G.ai);
  document.getElementById('s-aidef').textContent=getDef(G.ai);
  document.getElementById('s-aispd').textContent=G.ai.spd;
  document.getElementById('s-aievade').textContent=getAIEvade(G.ai)+'%';
}

function updateProbTable(){
  const tbl=document.getElementById('prob-table');
  const rows=G.player.moves.map(mv=>{
    const exp=expectedDmg(G.player,G.ai,mv);
    const ppPct=Math.round(mv.pp/mv.maxPp*100);
    const val=exp>0?exp+' dmg':mv.fx?mv.fx:'—';
    return'<tr><td>'+mv.name+'</td><td>'+val+'</td><td>'+mv.acc+'%</td><td>'+ppPct+'%PP</td></tr>';
  });
  tbl.innerHTML='<tr><th>Move</th><th>E[dmg]</th><th>Acc</th><th>PP</th></tr>'+rows.join('');
}

function updateEnemyMovesPanel(){
  const el=document.getElementById('enemy-move-list');if(!el)return;el.innerHTML='';
  G.ai.moves.forEach(mv=>{
    const d=document.createElement('div');d.className='enemy-move-row';
    d.innerHTML='<b>'+mv.name+'</b> '+(mv.dmg&&mv.dmg[0]>0?mv.dmg[0]+'-'+mv.dmg[1]+' dmg':'—')+(mv.fx?' | '+mv.fx:'')+' PP:'+mv.pp+'/'+mv.maxPp;
    el.appendChild(d);
  });
}

function updateAIStrategyBox(){
  const el=document.getElementById('ai-strategy-box');if(!el)return;
  const e=G.ai;
  el.textContent='['+e.name+(e.cycle>0?' MK'+(e.cycle+1):'')+']'+'\nTheme: '+e.theme+'\n\n'+(e.aiDesc||'Unknown.'+(e.evade>0?'\nEvade: '+e.evade+'%':''));
}

function renderTraits(){
  const el=document.getElementById('trait-list');
  if(!G.traits.length){el.textContent='None yet';return;}
  el.innerHTML=G.traits.map(t=>'<div class="trait-item"><div class="trait-name">'+t.name+'</div><div class="trait-desc">'+t.desc+'</div></div>').join('');
}

function updateWaveInfo(){
  const e=G.ai;
  document.getElementById('wave-info').innerHTML='<b>'+e.name+'</b>'+(e.cycle>0?' [MK'+(e.cycle+1)+']':'')+'<br>Theme: '+e.theme+'<br>HP: '+e.maxHp+' | ATK: '+e.bAtk+' | DEF: '+e.bDef+'<br>SPD: '+e.spd+' | Evade: '+e.evade+'%';
}

function setMsg(txt,cur=false){
  document.getElementById('msgtxt').textContent=txt;
  document.getElementById('cursor').style.display=cur?'inline-block':'none';
}
function addLog(txt,cls=''){
  const box=document.getElementById('logbox');
  const el=document.createElement('span');el.className='le '+cls;el.textContent=txt;
  box.appendChild(el);box.scrollTop=box.scrollHeight;
}
function clearLog(){document.getElementById('logbox').innerHTML='';}

function setMovesEnabled(on){
  document.querySelectorAll('.mbtn').forEach((b,i)=>{
    if(!on){b.disabled=true;return;}
    const mv=G.player.moves[i];
    const ppZero=mv&&mv.pp<=0&&!(G.player.lastStand&&G.player.hp/G.player.maxHp<0.2);
    b.disabled=!mv||ppZero||G.phase!=='player';
  });
  renderItems();renderShop();
}

function showPop(elId,amt,heal){
  const el=document.getElementById(elId);if(!el)return;
  const r=el.getBoundingClientRect();
  const d=document.createElement('div');d.className='dpop';d.textContent=heal?'+'+amt:'-'+amt;
  d.style.color=heal?'#000':'#555';
  d.style.left=(r.left+r.width/2-14+scrollX)+'px';d.style.top=(r.top-6+scrollY)+'px';
  document.body.appendChild(d);setTimeout(()=>d.remove(),1150);
}

// ── GAMBLER'S EDGE ──────────────────────────────────────────────────────────
async function execGamble(attKey,defKey,mgMult=1.0){
  const att=G[attKey],def=G[defKey];
  const synergy=G.jackpotSynergy;
  const lensForce=G.nextMoveEffectGuarantee;
  if(lensForce)G.nextMoveEffectGuarantee=false;

  // Determine outcome — lens forces JACKPOT
  const roll=lensForce?0:Math.random();
  let outcome;
  if(roll<0.20)outcome='JACKPOT';
  else if(roll<0.45)outcome='DRAIN';
  else if(roll<0.68)outcome='DOUBLE';
  else if(roll<0.85)outcome='SHIELD';
  else outcome='BUST';

  const mv={dmg:[Math.round(20*(1+(getAtk(att)/getDef(def)))),Math.round(40*(1+(getAtk(att)/getDef(def))))],acc:90,fx:null};

  if(outcome==='JACKPOT'){
    const mult=synergy?3.0:2.0;
    const base=rnd(mv.dmg[0],mv.dmg[1]);
    const dmg=Math.max(1,Math.round(base*mult*mgMult));
    def.hp-=dmg;checkPhoenix(def);showPop(defKey+'-fill',dmg,false);
    setMsg((lensForce?'LENS → ':'')+'JACKPOT! Massive crit hit! '+dmg+' damage!');
    addLog('> Gamble: JACKPOT'+(lensForce?' (LENS)':'')+(synergy?' [SYNERGY x3]':'')+' → '+dmg+'dmg','crit');
    renderFighter(defKey);gainExpScore(dmg,attKey);if(attKey==='player')G.momentumCount++;
    await delay(900);return;
  }
  if(outcome==='DRAIN'){
    const mult=synergy?1.4:1.0;
    const base=rnd(mv.dmg[0],mv.dmg[1]);
    const dmg=Math.max(1,Math.round(base*mult*mgMult));
    const heal=synergy?Math.round(dmg*0.75):Math.round(dmg*0.50);
    def.hp-=dmg;att.hp=Math.min(att.maxHp,att.hp+heal);
    checkPhoenix(def);showPop(defKey+'-fill',dmg,false);showPop(attKey+'-fill',heal,true);
    setMsg('DRAIN! '+dmg+' dmg, +'+heal+' HP!');
    addLog('> Gamble: DRAIN'+(synergy?' [SYNERGY 75% heal]':'')+' → '+dmg+'dmg +'+heal+'HP','hit');
    renderFighter(defKey);renderFighter(attKey);gainExpScore(dmg,attKey);if(attKey==='player')G.momentumCount++;
    await delay(900);return;
  }
  if(outcome==='DOUBLE'){
    let total=0;setMsg('DOUBLE HIT!');await delay(280);
    const hits=synergy?3:2;
    for(let i=0;i<hits;i++){
      const base=rnd(mv.dmg[0],mv.dmg[1]);
      const dmg=Math.max(1,Math.round(base*mgMult));
      def.hp-=dmg;total+=dmg;showPop(defKey+'-fill',dmg,false);
      addLog('  gamble hit '+(i+1)+': '+dmg,'hit');
      renderFighter(defKey);await delay(280);
    }
    setMsg((synergy?'TRIPLE':'DOUBLE')+' HIT! '+total+' total!');
    gainExpScore(total,attKey);if(attKey==='player')G.momentumCount++;
    return;
  }
  if(outcome==='SHIELD'){
    const shieldTurns=synergy?3:2;
    att.defMult=2;att.status.shieldTurns=shieldTurns;
    const base=rnd(Math.round(mv.dmg[0]*0.3),Math.round(mv.dmg[1]*0.3));
    const dmg=Math.max(1,Math.round(base*mgMult));
    def.hp-=dmg;checkPhoenix(def);showPop(defKey+'-fill',dmg,false);
    setMsg('SHIELD! DEF x2 for '+shieldTurns+'t + '+dmg+' dmg!');
    addLog('> Gamble: SHIELD'+(synergy?' [SYNERGY 3t]':'')+' → DEF x2 '+shieldTurns+'t + '+dmg+'dmg','sys');
    renderFighter(defKey);renderFighter(attKey);gainExpScore(dmg,attKey);if(attKey==='player')G.momentumCount++;
    await delay(900);return;
  }
  // BUST
  const bustMsg=synergy?'BUST — but Jackpot Synergy mitigates: next Gamble is free PP!':'BUST — no effect!';
  if(synergy){const mv2=G.player.moves.find(m=>m.id==='gamble');if(mv2)mv2.pp=Math.min(mv2.pp+1,mv2.maxPp);}
  setMsg(bustMsg);addLog('> Gamble: BUST'+(synergy?' [SYNERGY: +1 PP recovered]':''),'miss');G.momentumCount=0;
  await delay(900);
}

// ── EXECUTE MOVE ──────────────────────────────────────────────────────────────
async function execMove(attKey,defKey,moveName,mgMult=1.0){
  const att=G[attKey],def=G[defKey];
  const mv=att.moves.find(m=>m.name===moveName);if(!mv)return;
  const lastStandActive=attKey==='player'&&G.player.lastStand&&G.player.hp/G.player.maxHp<0.2;
  if(mv.pp>0&&!lastStandActive)mv.pp--;

  // Apply lens accuracy bonus
  let effectiveAcc=mv.acc;
  if(attKey==='player'&&G.nextMoveAccBonus>0){
    effectiveAcc=Math.min(100,mv.acc+G.nextMoveAccBonus);
    G.nextMoveAccBonus=0;
    renderFighter('player');
  }

  // Reflect check
  if(def.status&&def.status.reflect>0&&mv.dmg&&mv.dmg[0]>0){
    def.status.reflect=0;setMsg(att.name+' used '+moveName+' — REFLECTED!');
    addLog('> '+att.name+': '+moveName+' -> REFLECTED','debuff');
    const{dmg}=calcDmg(att,att,mv,false,mgMult||1.0);
    att.hp=Math.max(0,att.hp-dmg);showPop(attKey+'-fill',dmg,false);renderFighter(attKey);
    await delay(900);return;
  }

  // Stun check
  if(att.status&&att.status.stun>0){
    att.status.stun=0;setMsg(att.name+' is stunned and cannot move!');
    addLog('> '+att.name+': STUNNED — skipped','debuff');await delay(800);return;
  }

  // Taunt override
  if(attKey==='ai'&&G.ai.status&&G.ai.status.tauntTurns>0){
    const bigMv=G.ai.moves.filter(m=>m.pp>0&&m.dmg&&m.dmg[0]>0).sort((a,b)=>b.dmg[1]-a.dmg[1])[0];
    if(bigMv&&bigMv.name!==moveName){G.ai.status.tauntTurns=Math.max(0,G.ai.status.tauntTurns-1);return execMove(attKey,defKey,bigMv.name,mgMult);}
    G.ai.status.tauntTurns=Math.max(0,G.ai.status.tauntTurns-1);
  }

  if(mgMult===0){
    setMsg(att.name+' used '+moveName+' — FAILED!');
    addLog('> '+att.name+': '+moveName+' -> FAILED (minigame)','miss');
    if(attKey==='player')G.momentumCount=0;
    // Consume lens effect guarantee even on fail
    if(attKey==='player')G.nextMoveEffectGuarantee=false;
    await delay(700);return;
  }

  // Evade check
  if(attKey==='player'){
    const aiEv=getAIEvade(G.ai);
    if(aiEv>0&&Math.random()*100<aiEv){setMsg(G.ai.name+' evaded '+moveName+'!');addLog('> '+G.ai.name+' EVADED '+moveName,'miss');G.momentumCount=0;G.nextMoveEffectGuarantee=false;await delay(700);return;}
  }else{
    const pEv=getEvade(G.player);
    if(pEv>0&&Math.random()*100<pEv){setMsg(G.player.name+' evaded '+G.ai.name+"'s "+moveName+'!');addLog('> '+G.player.name+' EVADED '+moveName,'miss');await delay(700);return;}
  }

  // Helper: consume and return lens guarantee flag
  const consumeLens=()=>{const v=G.nextMoveEffectGuarantee;if(attKey==='player')G.nextMoveEffectGuarantee=false;return v;};

  // GAMBLER'S EDGE
  if(mv.fx==='gamble'){
    await execGamble(attKey,defKey,mgMult);return;
  }

  if(mv.fx==='fortify_atk'){att.atkBuf=Math.min(8,att.atkBuf+2);att.atkBufTurns=3;setMsg(att.name+' used Power Up! ATK+2 3t!');addLog('> '+att.name+': Power Up -> ATK+2 3t','sys');renderFighter(attKey);await delay(750);return;}
  if(mv.fx==='fortify_def'){att.defBuf=Math.min(8,att.defBuf+2);att.defBufTurns=3;setMsg(att.name+' used Brace! DEF+2 3t!');addLog('> '+att.name+': Brace -> DEF+2 3t','sys');renderFighter(attKey);await delay(750);return;}
  if(mv.fx==='regen'){att.pendingStatus.regen=3;setMsg(att.name+': Regenerate — Regen queued 3 rounds!');addLog('> '+att.name+': Regen queued 3t','sys');await delay(750);return;}
  if(mv.fx==='reflect'){att.status.reflect=1;setMsg(att.name+': Nullify active — next attack reflected!');addLog('> '+att.name+': REFLECT ready','sys');await delay(750);return;}
  if(mv.fx==='ironwall'){att.defMult=2;att.status.shieldTurns=2;setMsg(att.name+': Iron Wall! DEF doubled 2t!');addLog('> '+att.name+': DEF x2 for 2t','sys');renderFighter(attKey);await delay(750);return;}
  if(mv.fx==='taunt'){def.status.tauntTurns=2;setMsg(att.name+' taunts '+def.name+'!');addLog('> '+att.name+': TAUNT -> '+def.name+' forced big moves 2t','debuff');renderFighter(defKey);await delay(750);return;}
  if(mv.fx==='sacrifice'){const cost=Math.round(att.hp*0.15);att.hp=Math.max(1,att.hp-cost);att.atkBuf=Math.min(8,att.atkBuf+4);att.atkBufTurns=3;setMsg(att.name+': Blood Price! -'+cost+'HP → ATK+4 3t!');addLog('> Blood Price: -'+cost+'HP → ATK+4 3t','sys');renderFighter(attKey);await delay(750);return;}
  if(mv.fx==='wraithform'){att.status.wraithTurns=2;setMsg(att.name+': Wraith Form! Evade+30% for 2 turns!');addLog('> '+att.name+': WRAITH FORM — Evade+30% 2t','sys');renderFighter(attKey);await delay(750);return;}
  if(mv.fx==='overwatch'){att.overwatchReady=true;setMsg(att.name+' enters Overwatch stance!');addLog('> '+att.name+': OVERWATCH — will counter next attack','sys');renderFighter(attKey);await delay(750);return;}

  if(mv.fx==='rend'){
    const{dmg,crit}=calcDmg(att,def,mv,false,mgMult||1.0);def.hp-=dmg;
    def.defDebuf=Math.min(5,(def.defDebuf||0)+1);def.defDebufTurns=2;
    checkPhoenix(def);showPop(defKey+'-fill',dmg,false);
    setMsg(att.name+': Rend! '+dmg+'dmg + DEF-1 for 2t!'+(crit?' Crit!':''));
    addLog('> '+att.name+': Rend -> '+dmg+'dmg DEF-1'+(crit?' CRIT':''),crit?'crit':'hit');
    renderFighter(defKey);gainExpScore(dmg,attKey);if(attKey==='player')G.momentumCount++;await delay(900);return;
  }
  if(mv.fx==='sunder'){
    const{dmg,crit}=calcDmg(att,def,mv,false,mgMult||1.0);def.hp-=dmg;
    def.defDebuf=Math.min(5,(def.defDebuf||0)+2);def.defDebufTurns=3;
    checkPhoenix(def);showPop(defKey+'-fill',dmg,false);
    setMsg(att.name+': Sunder! '+dmg+'dmg + DEF-2 for 3t!'+(crit?' Crit!':''));
    addLog('> '+att.name+': Sunder -> '+dmg+'dmg DEF-2'+(crit?' CRIT':''),crit?'crit':'hit');
    renderFighter(defKey);gainExpScore(dmg,attKey);if(attKey==='player')G.momentumCount++;await delay(900);return;
  }
  if(mv.fx==='sweepkick'){
    const guarantee=consumeLens();
    const{dmg,crit}=calcDmg(att,def,mv,false,mgMult||1.0);def.hp-=dmg;
    if(guarantee||Math.random()<0.30)def.pendingStatus.chill=2;
    checkPhoenix(def);showPop(defKey+'-fill',dmg,false);
    setMsg(att.name+': Sweep Kick! '+dmg+'dmg'+(def.pendingStatus.chill>0?' + slow!':'')+(crit?' Crit!':''));
    addLog('> '+att.name+': Sweep -> '+dmg+'dmg'+(def.pendingStatus.chill>0?' CHILL':'')+(crit?' CRIT':''),crit?'crit':'hit');
    renderFighter(defKey);gainExpScore(dmg,attKey);if(attKey==='player')G.momentumCount++;await delay(900);return;
  }

  if(mv.fx==='multihit'||mv.fx==='triplehit'){
    const hits=mv.fx==='triplehit'?3:2;let total=0;
    setMsg(att.name+' used '+moveName+'!');await delay(280);
    for(let i=0;i<hits;i++){
      const{dmg,crit}=calcDmg(att,def,mv,false,mgMult||1.0);
      def.hp-=dmg;total+=dmg;
      if(att.vamp){const h=Math.round(dmg*(att.vampBonus||0.15));att.hp=Math.min(att.maxHp,att.hp+h);}
      checkPhoenix(def);showPop(defKey+'-fill',dmg,false);
      addLog('  hit '+(i+1)+': '+dmg+(crit?' (CRIT!)':''),crit?'crit':'hit');
      renderFighter(defKey);await delay(260);
    }
    setMsg(moveName+' hit '+hits+'x! ('+total+' total)');
    gainExpScore(total,attKey);if(attKey==='player')G.momentumCount++;return;
  }

  if(mv.fx==='drain'||mv.fx==='leech'){
    const{dmg,crit}=calcDmg(att,def,mv,false,mgMult||1.0);def.hp-=dmg;const heal=Math.round(dmg*0.5);att.hp=Math.min(att.maxHp,att.hp+heal);
    if(mv.fx==='leech'){const guarantee=consumeLens();if(guarantee||!(defKey==='player'&&G.player.poisonImmune))def.pendingStatus.poison=3;}
    checkPhoenix(def);showPop(defKey+'-fill',dmg,false);showPop(attKey+'-fill',heal,true);
    setMsg(att.name+': '+moveName+'. Drained '+dmg+'! +'+heal+'HP.'+(crit?' Crit!':''));
    addLog('> '+att.name+': '+moveName+' -> '+dmg+' drain (+'+heal+'HP)'+(crit?' CRIT':''),crit?'crit':'hit');
    renderFighter(defKey);renderFighter(attKey);gainExpScore(dmg,attKey);if(attKey==='player')G.momentumCount++;await delay(900);return;
  }

  if(mv.fx==='burn'){
    const guarantee=consumeLens();
    const{dmg,crit}=calcDmg(att,def,mv,false,mgMult||1.0);def.hp-=dmg;
    if(guarantee||!(defKey==='player'&&G.player.burnImmune))def.pendingStatus.burn=3;
    checkPhoenix(def);showPop(defKey+'-fill',dmg,false);
    setMsg(att.name+': '+moveName+'. '+(def.pendingStatus.burn?def.name+' BURNS!':'')+(crit?' Crit!':''));
    addLog('> '+att.name+': '+moveName+' -> '+dmg+'dmg'+(def.pendingStatus.burn?' BURN':'')+(crit?' CRIT':''),crit?'crit':'hit');
    renderFighter(defKey);gainExpScore(dmg,attKey);if(attKey==='player')G.momentumCount++;await delay(900);return;
  }

  if(mv.fx==='chill'){
    const guarantee=consumeLens();
    const{dmg,crit}=calcDmg(att,def,mv,false,mgMult||1.0);def.hp-=dmg;
    if(guarantee||!(defKey==='player'&&G.player.chillImmune))def.pendingStatus.chill=3;
    checkPhoenix(def);showPop(defKey+'-fill',dmg,false);
    setMsg(att.name+': '+moveName+'. '+def.name+' CHILLED!'+(crit?' Crit!':''));
    addLog('> '+att.name+': '+moveName+' -> '+dmg+'dmg CHILL'+(crit?' CRIT':''),crit?'crit':'hit');
    renderFighter(defKey);gainExpScore(dmg,attKey);if(attKey==='player')G.momentumCount++;await delay(900);return;
  }

  if(mv.fx==='poison'){
    const guarantee=consumeLens();
    const{dmg,crit}=calcDmg(att,def,mv,false,mgMult||1.0);def.hp-=dmg;
    if(guarantee||!(defKey==='player'&&G.player.poisonImmune))def.pendingStatus.poison=4;
    checkPhoenix(def);showPop(defKey+'-fill',dmg,false);
    setMsg(att.name+': '+moveName+'. '+(def.pendingStatus.poison?def.name+' POISONED!':'Resisted!')+(crit?' Crit!':''));
    addLog('> '+att.name+': '+moveName+' -> '+dmg+'dmg'+(def.pendingStatus.poison?' PSNT':'')+(crit?' CRIT':''),crit?'crit':'hit');
    renderFighter(defKey);gainExpScore(dmg,attKey);if(attKey==='player')G.momentumCount++;await delay(900);return;
  }

  if(mv.fx==='bleed'){
    const guarantee=consumeLens();
    const{dmg,crit}=calcDmg(att,def,mv,false,mgMult||1.0);def.hp-=dmg;
    def.pendingStatus.bleed=3;
    checkPhoenix(def);showPop(defKey+'-fill',dmg,false);
    setMsg(att.name+': '+moveName+'. BLEED!'+(crit?' Crit!':''));
    addLog('> '+att.name+': '+moveName+' -> '+dmg+'dmg BLEED'+(crit?' CRIT':''),crit?'crit':'hit');
    renderFighter(defKey);gainExpScore(dmg,attKey);if(attKey==='player')G.momentumCount++;await delay(900);return;
  }

  if(mv.fx==='stun'){
    const guarantee=consumeLens();
    const{dmg,crit}=calcDmg(att,def,mv,false,mgMult||1.0);def.hp-=dmg;
    const immune=defKey==='player'&&(G.player.stunImmune||G.traits.find(t=>t.id==='t_ironwill'));
    if(!immune&&(guarantee||Math.random()<0.4))def.status.stun=1;
    checkPhoenix(def);showPop(defKey+'-fill',dmg,false);
    setMsg(att.name+': '+moveName+'. '+dmg+'dmg!'+(def.status.stun?' STUNNED!':''));
    addLog('> '+att.name+': '+moveName+' -> '+dmg+'dmg'+(def.status.stun?' STUN':'')+(crit?' CRIT':''),def.status.stun?'debuff':crit?'crit':'hit');
    renderFighter(defKey);gainExpScore(dmg,attKey);if(attKey==='player')G.momentumCount++;await delay(900);return;
  }

  if(mv.fx==='pierce'){
    const{dmg,crit}=calcDmg(att,def,mv,true,mgMult||1.0);def.hp-=dmg;
    if(G.pierceDegrade&&defKey==='ai')G.ai.bDef=Math.max(1,Math.round(G.ai.bDef*0.88));
    checkPhoenix(def);showPop(defKey+'-fill',dmg,false);
    setMsg(att.name+': '+moveName+'. Bypassed armor! '+dmg+'dmg!'+(crit?' Crit!':''));
    addLog('> '+att.name+': '+moveName+' -> '+dmg+'dmg (PIERCE)'+(crit?' CRIT':''),crit?'crit':'hit');
    // Apply mirror reflection after pierce too
    if(defKey==='player'&&G.player.reflect20)att.hp-=Math.round(dmg*0.2);
    if(defKey==='player'&&G.player.reflect10)att.hp-=Math.round(dmg*0.1);
    renderFighter(defKey);gainExpScore(dmg,attKey);if(attKey==='player')G.momentumCount++;await delay(900);return;
  }

  if(mv.fx==='highcrit'){
    const{dmg,crit}=calcDmg(att,def,mv,false,mgMult||1.0);
    def.hp-=dmg;
    if(att.vamp){const h=Math.round(dmg*(att.vampBonus||0.15));att.hp=Math.min(att.maxHp,att.hp+h);}
    // Mirror reflection for highcrit too
    if(defKey==='player'&&G.player.reflect20)att.hp-=Math.round(dmg*0.2);
    if(defKey==='player'&&G.player.reflect10)att.hp-=Math.round(dmg*0.1);
    checkPhoenix(def);showPop(defKey+'-fill',dmg,false);
    setMsg(att.name+': '+moveName+' — '+dmg+'dmg!'+(crit?' CRITICAL HIT!':''));
    addLog('> '+att.name+': '+moveName+' -> '+dmg+'dmg'+(crit?' CRIT':''),crit?'crit':'hit');
    renderFighter(defKey);gainExpScore(dmg,attKey);if(attKey==='player')G.momentumCount++;await delay(900);return;
  }

  if(mv.fx==='chain'){
    G.chainCount=(G.chainCount||0)+1;
    const bonus=G.chainBoosted?8:4;
    const saved=att.bAtk;att.bAtk+=G.chainCount*bonus;
    const{dmg,crit}=calcDmg(att,def,mv,false,mgMult||1.0);att.bAtk=saved;
    def.hp-=dmg;if(att.vamp){const h=Math.round(dmg*(att.vampBonus||0.15));att.hp=Math.min(att.maxHp,att.hp+h);}
    checkPhoenix(def);showPop(defKey+'-fill',dmg,false);
    setMsg(att.name+': '+moveName+' — Chain x'+G.chainCount+'! '+dmg+'dmg!'+(crit?' Crit!':''));
    addLog('> '+att.name+': '+moveName+' -> '+dmg+'dmg [chain x'+G.chainCount+']'+(crit?' CRIT':''),crit?'crit':'hit');
    renderFighter(defKey);gainExpScore(dmg,attKey);if(attKey==='player')G.momentumCount++;await delay(900);return;
  }

  if(mv.fx==='glacial'){
    const guarantee=consumeLens();
    const{dmg,crit}=calcDmg(att,def,mv,false,mgMult||1.0);def.hp-=dmg;
    const froze=guarantee||(Math.random()<0.5);
    if(froze&&!(defKey==='player'&&G.player.stunImmune))def.status.stun=1;
    def.pendingStatus.bleed=3;
    checkPhoenix(def);showPop(defKey+'-fill',dmg,false);
    setMsg(att.name+': Glacial Nova! '+dmg+'dmg!'+(froze?' FROZE!':'')+' BLEED!');
    addLog('> '+att.name+': Glacial Nova -> '+dmg+'dmg'+(froze?' FREEZE':'')+' BLEED'+(crit?' CRIT':''),crit?'crit':'hit');
    renderFighter(defKey);gainExpScore(dmg,attKey);if(attKey==='player')G.momentumCount++;await delay(900);return;
  }

  if(mv.fx==='deathmark'){
    const{dmg,crit}=calcDmg(att,def,mv,false,mgMult||1.0);def.hp-=dmg;
    G.deathmarkActive=true;G.deathmarkTurns=2;
    checkPhoenix(def);showPop(defKey+'-fill',dmg,false);
    setMsg(att.name+': Deathmark! '+dmg+'dmg! +20% dmg for 2 turns!');
    addLog('> '+att.name+': Deathmark -> '+dmg+'dmg +MARK 2t'+(crit?' CRIT':''),crit?'crit':'hit');
    renderFighter(defKey);renderFighter('player');gainExpScore(dmg,attKey);if(attKey==='player')G.momentumCount++;await delay(900);return;
  }

  if(mv.fx==='overloadhit'){
    const{dmg,crit}=calcDmg(att,def,mv,false,mgMult||1.0);def.hp-=dmg;
    if(attKey==='player'&&att.overdriveCnt<5){att.overdriveCnt++;att.bAtk+=3;addLog('> Overdrive ATK permanently +3 (stack '+att.overdriveCnt+')','sys');}
    checkPhoenix(def);showPop(defKey+'-fill',dmg,false);
    setMsg(att.name+': Overdrive! '+dmg+'dmg! ATK stacking!');
    addLog('> '+att.name+': Overdrive -> '+dmg+'dmg'+(crit?' CRIT':''),crit?'crit':'hit');
    renderFighter(defKey);gainExpScore(dmg,attKey);if(attKey==='player')G.momentumCount++;await delay(900);return;
  }

  if(mv.fx==='executeblow'){
    const bonus=def.hp/def.maxHp<0.30?1.5:1.0;
    const{dmg,crit}=calcDmg(att,def,mv,false,mgMult||1.0);
    const finalDmg=Math.round(dmg*bonus);
    def.hp-=finalDmg;
    checkPhoenix(def);showPop(defKey+'-fill',finalDmg,false);
    setMsg(att.name+': Finishing Blow! '+finalDmg+'dmg!'+(bonus>1?' [EXECUTE +50%!]':'')+(crit?' Crit!':''));
    addLog('> '+att.name+': '+moveName+' -> '+finalDmg+'dmg'+(bonus>1?' [EXECUTE]':'')+(crit?' CRIT':''),bonus>1?'crit':crit?'crit':'hit');
    renderFighter(defKey);gainExpScore(finalDmg,attKey);if(attKey==='player')G.momentumCount++;await delay(900);return;
  }

  if(mv.fx==='supernova'){
    const guarantee=consumeLens();
    const{dmg,crit}=calcDmg(att,def,mv,false,mgMult||1.0);def.hp-=dmg;
    if(guarantee||!(defKey==='player'&&G.player.burnImmune))def.pendingStatus.burn=3;
    def.pendingStatus.bleed=3;
    if(guarantee||!(defKey==='player'&&G.player.chillImmune))def.pendingStatus.chill=3;
    checkPhoenix(def);showPop(defKey+'-fill',dmg,false);
    setMsg(att.name+': SUPERNOVA! '+dmg+'dmg! Burn+Bleed+Chill!'+(crit?' Crit!':''));
    addLog('> '+att.name+': Supernova -> '+dmg+'dmg BURN+BLEED+CHILL'+(crit?' CRIT':''),'crit');
    renderFighter(defKey);gainExpScore(dmg,attKey);if(attKey==='player')G.momentumCount++;await delay(900);return;
  }

  if(mv.fx==='doubleedge'){
    const{dmg,crit}=calcDmg(att,def,mv,false,mgMult||1.0);def.hp-=dmg;
    const recoil=Math.round(dmg*0.25);att.hp=Math.max(1,att.hp-recoil);
    checkPhoenix(def);showPop(defKey+'-fill',dmg,false);showPop(attKey+'-fill',recoil,false);
    setMsg(att.name+': Double Edge! '+dmg+'dmg! Recoil: '+recoil+'!'+(crit?' Crit!':''));
    addLog('> '+att.name+': Double Edge -> '+dmg+'dmg recoil:'+recoil+(crit?' CRIT':''),crit?'crit':'hit');
    renderFighter(defKey);renderFighter(attKey);gainExpScore(dmg,attKey);if(attKey==='player')G.momentumCount++;await delay(900);return;
  }

  if(mv.fx==='thornstrike'){
    const{dmg,crit}=calcDmg(att,def,mv,false,mgMult);
    def.hp-=dmg;const thornDmg=Math.round(dmg*0.10);def.hp-=thornDmg;
    checkPhoenix(def);showPop(defKey+'-fill',dmg+thornDmg,false);
    setMsg(att.name+': '+moveName+'. Thorn! '+dmg+'+'+thornDmg+'dmg!'+(crit?' Crit!':''));
    addLog('> '+att.name+': '+moveName+' -> '+dmg+' +thorn '+thornDmg+(crit?' CRIT':''),crit?'crit':'hit');
    renderFighter(defKey);gainExpScore(dmg+thornDmg,attKey);if(attKey==='player')G.momentumCount++;await delay(900);return;
  }

  // Default physical
  const{dmg,crit}=calcDmg(att,def,mv,false,mgMult||1.0);
  def.hp-=dmg;
  if(att.vamp){const h=Math.round(dmg*(att.vampBonus||0.15));att.hp=Math.min(att.maxHp,att.hp+h);}
  // Apply reflections consistently for all non-special attacks on player
  if(defKey==='player'&&G.player.reflect20)att.hp-=Math.round(dmg*0.2);
  if(defKey==='player'&&G.player.reflect10)att.hp-=Math.round(dmg*0.1);
  if(defKey==='player'&&G.player.counter&&dmg>=20){att.hp-=8;addLog('> Counter-Strike: 8 dmg reflected','hit');}
  if(defKey==='player'&&G.player.overwatchReady){
    const counterDmg=Math.round(dmg*0.5);att.hp-=counterDmg;G.player.overwatchReady=false;
    addLog('> OVERWATCH counter: '+counterDmg+' dmg!','crit');renderFighter('ai');
  }
  if(defKey==='player'&&G.player.overload)G.player.overloadStacks=0;
  checkPhoenix(def);showPop(defKey+'-fill',dmg,false);
  const mgTag=attKey==='player'?(mgMult>=1.22?' [PERFECT]':mgMult>=1.15?' [GREAT]':mgMult>=1.08?' [GOOD]':''):'';
  setMsg(att.name+' used '+moveName+'. '+dmg+' damage!'+(crit?' Critical hit!':'')+mgTag);
  addLog('> '+att.name+': '+moveName+' -> '+dmg+'dmg'+(crit?' CRIT':'')+mgTag,attKey==='player'?crit?'crit':'hit':crit?'crit':'ai');
  renderFighter(defKey);gainExpScore(dmg,attKey);
  if(attKey==='player')G.momentumCount++;else G.momentumCount=0;
  await delay(900);
}

function checkPhoenix(unit){
  if(unit===G.player&&G.player.phoenix&&!G.player.phoenixUsed&&unit.hp<=0){
    unit.hp=1;G.player.phoenixUsed=true;
    setMsg('PHOENIX PROTOCOL — survived fatal blow at 1 HP!');
    addLog('> PHOENIX PROTOCOL TRIGGERED','sys');
  }
}

function gainExpScore(dmg,attKey){
  if(attKey==='player'){
    const expGain=Math.round(dmg*0.8);
    const mult=1+(G.traits.find(t=>t.id==='t_tactician')?0.5:0);
    G.exp+=expGain;G.waveScore+=Math.round(dmg*mult);G.score+=Math.round(dmg*mult);
    while(G.exp>=G.expNext){G.exp-=G.expNext;G.level++;G.expNext=Math.round(G.expNext*1.35);addLog('> LEVEL UP! Level '+G.level,'sys');}
    if(G.player.overload)G.player.overloadStacks=Math.min(G.player.overloadStacks+1,10);
  }
}

function tickStatusEndOfRound(who){
  const c=G[who];if(!c)return;
  if(c.pendingStatus){
    if(c.pendingStatus.burn>0){c.status.burn=Math.max(c.status.burn||0,c.pendingStatus.burn);c.pendingStatus.burn=0;}
    if(c.pendingStatus.poison>0){c.status.poison=Math.max(c.status.poison||0,c.pendingStatus.poison);c.pendingStatus.poison=0;}
    if(c.pendingStatus.bleed>0){c.status.bleed=Math.max(c.status.bleed||0,c.pendingStatus.bleed);c.pendingStatus.bleed=0;}
    if(c.pendingStatus.regen>0){c.status.regen=Math.max(c.status.regen||0,c.pendingStatus.regen);c.pendingStatus.regen=0;}
    if(c.pendingStatus.chill>0){c.status.chill=Math.max(c.status.chill||0,c.pendingStatus.chill);c.pendingStatus.chill=0;if(c.spd>3)c.spd=Math.max(3,c.spd-2);addLog('> '+c.name+': CHILL! SPD-2','debuff');}
  }
  if(!c.status)return;
  const dotMult=G.dotMasterUpg?1.3:1.0;
  if(c.status.burn>0){const d=Math.round(c.maxHp*0.055*dotMult);c.hp=Math.max(0,c.hp-d);c.status.burn--;addLog('> '+c.name+': BURN — '+d+' dmg ('+c.status.burn+'t left)','debuff');renderFighter(who);}
  if(c.status.poison>0){const d=Math.round(c.maxHp*0.04*dotMult);c.hp=Math.max(0,c.hp-d);c.status.poison--;addLog('> '+c.name+': PSNT — '+d+' dmg ('+c.status.poison+'t left)','debuff');renderFighter(who);}
  if(c.status.bleed>0){const d=Math.round(c.maxHp*0.05*dotMult);c.hp=Math.max(0,c.hp-d);c.status.bleed--;addLog('> '+c.name+': BLEED — '+d+' dmg ('+c.status.bleed+'t left)','debuff');renderFighter(who);}
  if(c.status.chill>0){c.status.chill--;if(c.status.chill===0){c.spd+=2;addLog('> '+c.name+': CHILL faded — SPD restored','debuff');}renderFighter(who);}
  if(c.status.regen>0){const h=Math.round(c.maxHp*0.07);c.hp=Math.min(c.maxHp,c.hp+h);c.status.regen--;showPop(who+'-fill',h,true);addLog('> '+c.name+': REGEN +'+h+'HP ('+c.status.regen+'t left)','hit');renderFighter(who);}
  if(c.status.wraithTurns>0){c.status.wraithTurns--;if(c.status.wraithTurns===0){addLog('> '+c.name+': Wraith Form faded','debuff');renderFighter(who);}}
  if(c.defDebuf>0&&c.defDebufTurns>0){c.defDebufTurns--;if(c.defDebufTurns===0){c.defDebuf=0;addLog('> '+c.name+': DEF debuff faded','debuff');renderFighter(who);}}
  if(c.atkBufTurns>0){c.atkBufTurns--;if(c.atkBufTurns===0){c.atkBuf=Math.max(0,c.atkBuf-2);addLog('> '+c.name+': ATK boost faded','debuff');}}
  if(c.defBufTurns>0){c.defBufTurns--;if(c.defBufTurns===0){c.defBuf=Math.max(0,c.defBuf-2);addLog('> '+c.name+': DEF boost faded','debuff');}}
  if(c.status.stimTurns>0)c.status.stimTurns--;
  if(c.status.shieldTurns>0){c.status.shieldTurns--;if(c.status.shieldTurns===0){c.defMult=1;addLog('> '+c.name+': Iron Wall faded','debuff');renderFighter(who);}}
}

function aiPick(){
  const avail=G.ai.moves.filter(m=>m.pp>0);
  if(!avail.length)return G.ai.moves[0].name;
  const pp=G.player.hp/G.player.maxHp,ap=G.ai.hp/G.ai.maxHp;
  const theme=G.ai.theme;
  if(ap<0.32&&G.ai.status.shieldTurns===0){const w=avail.find(m=>m.fx==='ironwall');if(w)return w.name;}
  if(ap<0.42){const rg=avail.find(m=>m.fx==='regen');if(rg&&G.ai.status.regen===0&&Math.random()<0.5)return rg.name;}
  if(ap<0.55&&G.ai.atkBuf<4){const b=avail.find(m=>m.fx==='fortify_def');if(b&&Math.random()<0.35)return b.name;}
  if(ap>0.5&&G.ai.atkBuf<4){const pu=avail.find(m=>m.fx==='fortify_atk');if(pu&&Math.random()<0.25)return pu.name;}
  if(ap<0.55&&(theme==='Leech Vampire'||theme==='Regenerator')){const d=avail.find(m=>m.fx==='drain'||m.fx==='leech');if(d)return d.name;}
  if(G.ai.status.reflect===0){const rf=avail.find(m=>m.fx==='reflect');if(rf&&Math.random()<0.2)return rf.name;}
  if(theme==='Stunner'){const s=avail.find(m=>m.fx==='stun');if(s&&G.player.status.stun===0&&Math.random()<0.5)return s.name;}
  if(theme==='Pyromaniac'||theme==='Toxicologist'){const b=avail.find(m=>m.fx==='burn');if(b&&!G.player.status.burn&&!G.player.burnImmune&&Math.random()<0.55)return b.name;}
  const psn=avail.find(m=>m.fx==='poison');if(psn&&!G.player.status.poison&&!G.player.poisonImmune&&Math.random()<0.35)return psn.name;
  const bl=avail.find(m=>m.fx==='bleed');if(bl&&!G.player.status.bleed&&Math.random()<0.3)return bl.name;
  const ch=avail.find(m=>m.fx==='chill');if(ch&&G.player.spd>G.ai.spd&&Math.random()<0.35)return ch.name;
  if(theme==='Armor Shredder'&&G.player.defDebuf<3){const rnd=avail.find(m=>m.fx==='rend'||m.fx==='sunder');if(rnd&&Math.random()<0.6)return rnd.name;}
  if(theme==='Glass Cannon'||theme==='Deathbringer'){const big=avail.filter(m=>m.dmg&&m.dmg[0]>0).sort((a,b)=>b.dmg[1]-a.dmg[1])[0];if(big&&Math.random()<0.75)return big.name;}
  if(pp<0.3){const big=avail.filter(m=>m.dmg&&m.dmg[0]>0).sort((a,b)=>b.dmg[1]-a.dmg[1])[0];if(big&&Math.random()<0.8)return big.name;}
  const aggression=clamp(0.25+G.ai.cycle*0.10,0.25,0.65);
  if(Math.random()<aggression){const dmgMoves=avail.filter(m=>m.dmg&&m.dmg[0]>0);if(dmgMoves.length)return dmgMoves.sort((a,b)=>b.dmg[1]-a.dmg[1])[0].name;}
  let r=Math.random()*avail.reduce((s,m)=>s+m.pp,0);
  for(const m of avail){r-=m.pp;if(r<=0)return m.name;}
  return avail[0].name;
}

function autoScalePlayer(){
  const e=G.ai;
  if(e.bAtk>G.player.bAtk){const gain=Math.max(1,Math.round((e.bAtk-G.player.bAtk)*0.15));G.player.bAtk+=gain;addLog('> Auto-scale: ATK +'+gain,'proj');}
  if(e.bDef>G.player.bDef){const gain=Math.max(1,Math.round((e.bDef-G.player.bDef)*0.12));G.player.bDef+=gain;addLog('> Auto-scale: DEF +'+gain,'proj');}
  if(e.spd>G.player.spd+3){G.player.spd+=1;addLog('> Auto-scale: SPD +1','proj');}
  if(e.maxHp>G.player.maxHp*1.6){const gain=Math.round((e.maxHp-G.player.maxHp)*0.08);G.player.maxHp+=gain;addLog('> Auto-scale: MaxHP +'+gain,'proj');}
}

async function playerMove(name){
  if(G.busy||G.phase!=='player')return;
  const mv=G.player.moves.find(m=>m.name===name);if(!mv)return;
  const isDmgMove=mv.dmg&&mv.dmg[0]>0;
  let mgMult=1.0;
  if(isDmgMove){G.busy=true;setMovesEnabled(false);mgMult=await runMinigame(name,mv.tier||0,getAIEvade(G.ai));}
  G.busy=true;G.phase='ai';
  if(mv.fx!=='chain')G.chainCount=0;
  setMovesEnabled(false);

  // BUG FIX: Quick Strike always goes first regardless of SPD
  const quickStrikeFirst=mv.id==='quick';
  const pFirst=quickStrikeFirst||playerGoesFirst();

  if(!pFirst){
    setMsg(G.ai.name+' is faster and strikes first!',false);await delay(500);
    if(G.ai.status&&G.ai.status.stun>0){G.ai.status.stun=0;addLog('> '+G.ai.name+': STUNNED — skip','debuff');setMsg(G.ai.name+' is stunned!');await delay(700);}
    else await execMove('ai','player',aiPick(),1.0);
    if(G.player.hp<=0){
      checkPhoenix(G.player); // BUG FIX: was missing this check in non-first-strike branch
      if(G.player.hp<=0){G.player.hp=0;renderFighter('player');await delay(300);endBattle('ai');return;}
    }
    await execMove('player','ai',name,mgMult);
  }else{
    await execMove('player','ai',name,mgMult);
    if(G.ai.hp<=0){G.ai.hp=0;renderFighter('ai');
      tickStatusEndOfRound('player');tickStatusEndOfRound('ai');
      renderAll();await delay(300);endBattle('player');return;
    }
    setMsg(G.ai.name+' is computing...',false);await delay(400+G.wave*15);
    if(G.ai.status&&G.ai.status.stun>0){G.ai.status.stun=0;addLog('> '+G.ai.name+': STUNNED — skip','debuff');setMsg(G.ai.name+' is stunned!');await delay(700);}
    else await execMove('ai','player',aiPick(),1.0);
  }

  addLog('--- end of round ---','sys');
  tickStatusEndOfRound('player');tickStatusEndOfRound('ai');
  if(G.deathmarkActive){G.deathmarkTurns--;if(G.deathmarkTurns<=0){G.deathmarkActive=false;addLog('> Deathmark expired','debuff');}}
  renderAll();

  if(G.player.hp<=0){G.player.hp=0;renderFighter('player');await delay(300);endBattle('ai');return;}
  if(G.ai.hp<=0){G.ai.hp=0;renderFighter('ai');await delay(300);endBattle('player');return;}

  G.turn++;G.phase='player';G.busy=false;renderAll();
  setMsg('What will '+G.player.name+' do?',true);setMovesEnabled(true);
  updateEnemyMovesPanel();
}

function useItem(type){
  if(G.busy||G.phase!=='player')return;
  const n=G.items[type]||0;if(n<=0)return;
  G.items[type]--;
  if(type==='heal'){const bonus=G.traits.find(t=>t.id==='t_medic')?15:0;const amt=35+G.level*2+bonus;G.player.hp=Math.min(G.player.maxHp,G.player.hp+amt);setMsg('Medpack used! +'+amt+' HP.');addLog('> Item: Medpack -> +'+amt+'HP','proj');renderFighter('player');}
  else if(type==='ether'){G.player.moves.forEach(m=>{m.pp=m.maxPp;});setMsg('Ether! All PP restored.');addLog('> Item: Ether -> Full PP','proj');renderMoves();}
  else if(type==='boost'){G.player.status.stimTurns=3;setMsg('Stim! ATK+40% 3 turns.');addLog('> Item: Stim -> ATK x1.4 3t','proj');renderFighter('player');}
  else if(type==='shield'){G.player.defMult=2;G.player.status.shieldTurns=2;setMsg('Shield Cell! DEF doubled 2 turns.');addLog('> Item: Shield -> DEF x2 2t','proj');renderFighter('player');}
  else if(type==='flash'){G.ai.status.stun=1;setMsg('Flash Grenade! '+G.ai.name+' stunned!');addLog('> Item: Flash -> STUN','proj');renderFighter('ai');}
  else if(type==='clens'){
    // BUG FIX: Critical Lens now ALSO guarantees the effect of the next move
    G.nextMoveAccBonus=20;
    G.nextMoveEffectGuarantee=true;
    setMsg('Critical Lens! Next move +20% ACC AND guaranteed effect!');
    addLog('> Item: Lens -> next +20% ACC + guaranteed status effect','proj');
    renderFighter('player');
  }
  renderItems();
}

function showMoveReplace(newMove,onConfirm,onCancel){
  const overlay=document.getElementById('move-replace-overlay');
  const infoEl=document.getElementById('mr-new-info');const listEl=document.getElementById('mr-move-list');
  infoEl.innerHTML='<div class="mr-new-name">New: '+newMove.name+'</div><div class="mr-new-desc">'+newMove.desc+'<br>'+(newMove.tipExtra||'')+'</div>';
  listEl.innerHTML='';
  G.player.moves.forEach((mv,i)=>{
    const card=document.createElement('div');card.className='mr-move-card';
    card.innerHTML='<div class="mr-move-name">'+mv.name+'</div><div class="mr-move-desc">'+mv.desc+' | PP '+mv.pp+'/'+mv.maxPp+'<br>'+(mv.tipExtra||'')+'</div>';
    card.addEventListener('click',()=>{overlay.classList.remove('active');onConfirm(i);});
    listEl.appendChild(card);
  });
  overlay.classList.add('active');
  G.moveReplaceCallback={onCancel};
}
function cancelMoveReplace(){
  document.getElementById('move-replace-overlay').classList.remove('active');
  if(G.moveReplaceCallback&&G.moveReplaceCallback.onCancel)G.moveReplaceCallback.onCancel();
  G.moveReplaceCallback=null;
}
function promptMoveReplace(newMove){return new Promise(resolve=>{showMoveReplace(newMove,(idx)=>{resolve(idx);},()=>{resolve(-1);});});}

const ALL_UPGRADES=[
  {id:'u_atk1',name:'Targeting Module',desc:'ATK permanently +3',rarity:'common',apply:G=>{G.player.bAtk+=3},check:()=>true},
  {id:'u_def1',name:'Armor Plating',desc:'DEF permanently +3',rarity:'common',apply:G=>{G.player.bDef+=3},check:()=>true},
  {id:'u_spd1',name:'Speed Boosters',desc:'SPD +2',rarity:'common',apply:G=>{G.player.spd+=2},check:()=>true},
  {id:'u_crit1',name:'Precision Core',desc:'Crit chance +8%',rarity:'common',apply:G=>{G.player.critBonus=(G.player.critBonus||0)+8},check:()=>true},
  {id:'u_evade1',name:'Evasion Matrix',desc:'Dodge chance +7%',rarity:'common',apply:G=>{G.player.evadeBonus=(G.player.evadeBonus||0)+7},check:()=>true},
  {id:'u_hp1',name:'Reinforced Frame',desc:'Max HP +35, heal 20',rarity:'common',apply:G=>{G.player.maxHp+=35;G.player.hp=Math.min(G.player.hp+20,G.player.maxHp)},check:()=>true},
  {id:'u_medpacks',name:'Medpacks x2',desc:'Gain 2 Medpacks',rarity:'common',apply:G=>{G.items.heal+=2},check:()=>true},
  {id:'u_ethers',name:'Ethers x2',desc:'Gain 2 Ethers',rarity:'common',apply:G=>{G.items.ether+=2},check:()=>true},
  {id:'u_stims',name:'Stims x2',desc:'Gain 2 Stims',rarity:'common',apply:G=>{G.items.boost+=2},check:()=>true},
  {id:'u_ppup',name:'Extended Reserves',desc:'All move max PP +3',rarity:'common',apply:G=>{G.player.moves.forEach(m=>{m.maxPp+=3;m.pp=Math.min(m.pp+3,m.maxPp)})},check:()=>true},
  {id:'u_sharpen',name:'Sharpened Edge',desc:'ATK +2 and Crit +5%',rarity:'common',apply:G=>{G.player.bAtk+=2;G.player.critBonus=(G.player.critBonus||0)+5},check:()=>true},
  {id:'u_shields',name:'Shield Cells x2',desc:'Gain 2 Shield Cells',rarity:'common',apply:G=>{G.items.shield=(G.items.shield||0)+2},check:()=>true},
  {id:'u_spd_def',name:'Reactive Plating',desc:'SPD +1, DEF +2',rarity:'common',apply:G=>{G.player.spd+=1;G.player.bDef+=2;},check:()=>true},
  {id:'u_atk_hp',name:'Combat Frame',desc:'ATK +2, Max HP +20',rarity:'common',apply:G=>{G.player.bAtk+=2;G.player.maxHp+=20;G.player.hp=Math.min(G.player.hp+20,G.player.maxHp);},check:()=>true},
  {id:'u_evade_spd',name:'Ghost Steps',desc:'Evade +5%, SPD +1',rarity:'common',apply:G=>{G.player.evadeBonus=(G.player.evadeBonus||0)+5;G.player.spd+=1;},check:()=>true},
  {id:'u_fullpp',name:'PP Restore',desc:'All moves fully restored',rarity:'common',apply:G=>{G.player.moves.forEach(m=>{m.pp=m.maxPp;});},check:G=>G.player.moves.some(m=>m.pp<m.maxPp)},
  {id:'u_atk2',name:'Overclock Module',desc:'ATK permanently +6',rarity:'rare',apply:G=>{G.player.bAtk+=6},check:()=>true},
  {id:'u_def2',name:'Reactive Shielding',desc:'DEF +5, reflect 20% damage taken',rarity:'rare',apply:G=>{G.player.bDef+=5;G.player.reflect20=true},check:()=>true},
  {id:'u_vamp',name:'Vampiric Rounds',desc:'Attacks restore 15% dmg as HP',rarity:'rare',apply:G=>{G.player.vamp=true;G.player.vampBonus=Math.max(G.player.vampBonus||0,0.15)},check:G=>!G.player.vamp},
  {id:'u_doublepp',name:'Overclocked Reserves',desc:'All move PP doubled',rarity:'rare',apply:G=>{G.player.moves.forEach(m=>{m.maxPp*=2;m.pp=m.maxPp})},check:()=>true},
  {id:'u_crit2',name:'Lethal Config',desc:'Crit +15%, crit mult 2.0x',rarity:'rare',apply:G=>{G.player.critBonus=(G.player.critBonus||0)+15;G.player.critMult=2.0},check:()=>true},
  {id:'u_berserker',name:'Berserker Protocol',desc:'Below 30% HP: ATK doubles',rarity:'rare',apply:G=>{G.player.berserk=true},check:G=>!G.player.berserk},
  {id:'u_counteratk',name:'Counter-Strike',desc:'When hit 20+ dmg, retaliate 8',rarity:'rare',apply:G=>{G.player.counter=true},check:G=>!G.player.counter},
  {id:'u_burnimmune',name:'Heat Sink',desc:'Immune to Burn',rarity:'rare',apply:G=>{G.player.burnImmune=true},check:G=>!G.player.burnImmune},
  {id:'u_stunimmune',name:'Iron Will',desc:'Immune to Stun',rarity:'rare',apply:G=>{G.player.stunImmune=true},check:G=>!G.player.stunImmune},
  {id:'u_poisonimmune',name:'Antitoxin Glands',desc:'Immune to Poison & Leech',rarity:'rare',apply:G=>{G.player.poisonImmune=true},check:G=>!G.player.poisonImmune},
  {id:'u_executioner',name:'Executioner',desc:'Attacks on <25% HP +60%',rarity:'rare',apply:G=>{G.player.execute=true},check:G=>!G.player.execute},
  {id:'u_laststand',name:'Last Stand',desc:'Below 20% HP: 0 PP cost',rarity:'rare',apply:G=>{G.player.lastStand=true},check:G=>!G.player.lastStand},
  {id:'u_chain_boost',name:'Chain Reactor',desc:'Chain Attack gains +8 ATK per use',rarity:'rare',apply:G=>{G.chainBoosted=true;},check:G=>G.player.moves.some(m=>m.fx==='chain')&&!G.chainBoosted},
  {id:'u_dot_master',name:'DoT Master',desc:'All DoT effects deal +30% per tick',rarity:'rare',apply:G=>{G.dotMasterUpg=true;},check:G=>!G.dotMasterUpg&&G.player.moves.some(m=>['burn','poison','bleed','leech'].includes(m.fx))},
  {id:'u_pierce_upgrade',name:'Armor Annihilator',desc:'Pierce moves reduce enemy DEF 12% per hit',rarity:'rare',apply:G=>{G.pierceDegrade=true;},check:G=>G.player.moves.some(m=>m.fx==='pierce')&&!G.pierceDegrade},
  {id:'u_speedkill',name:'Speedkill Bonus',desc:'Acting first: +15% damage',rarity:'rare',apply:G=>{G.speedkillUpg=true;},check:G=>!G.speedkillUpg&&G.player.spd>=12},
  // NEW: Jackpot Synergy — pairs with Gambler's Edge
  {id:'u_gamble_synergy',name:"Jackpot Synergy",desc:"Gambler's Edge outcomes amplified: Jackpot 3x, Drain 75% heal, Double becomes Triple, Shield lasts 3t, Bust refunds 1 PP",rarity:'rare',apply:G=>{G.jackpotSynergy=true;},check:G=>G.player.moves.some(m=>m.fx==='gamble')&&!G.jackpotSynergy},
  {id:'u_allstats',name:'Hyper Calibration',desc:'ATK, DEF, SPD all +5',rarity:'epic',apply:G=>{G.player.bAtk+=5;G.player.bDef+=5;G.player.spd+=5},check:()=>true},
  {id:'u_phoenix',name:'Phoenix Protocol',desc:'Survive fatal blow at 1 HP (once)',rarity:'epic',apply:G=>{G.player.phoenix=true},check:G=>!G.player.phoenix},
  {id:'u_omni',name:'Omni-Matrix',desc:'Crit+12%, Evade+12%, Vamp, Reflect10%',rarity:'epic',apply:G=>{G.player.critBonus=(G.player.critBonus||0)+12;G.player.evadeBonus=(G.player.evadeBonus||0)+12;G.player.vamp=true;G.player.reflect10=true},check:()=>true},
  {id:'u_warmaster',name:'War Master',desc:'ATK+8, DEF+4, unlock Annihilate',rarity:'epic',apply:async G=>{G.player.bAtk+=8;G.player.bDef+=4;const m=BASE_PMOVES.find(x=>x.id==='nuke');if(m&&!G.player.moves.find(x=>x.id===m.id))await tryLearnMove({...m,pp:m.maxPp});},check:()=>true,isAsync:true},
  {id:'u_overload',name:'Overload Core',desc:'+2 ATK per hit, resets when hit',rarity:'epic',apply:G=>{G.player.overload=true;G.player.overloadStacks=0},check:G=>!G.player.overload},
  {id:'u_glacialcore',name:'Glacial Core',desc:'Unlock Glacial Nova (T3) + Chill immune',rarity:'epic',apply:async G=>{G.player.chillImmune=true;const m=BASE_PMOVES.find(x=>x.id==='glacial');if(m&&!G.player.moves.find(x=>x.id===m.id))await tryLearnMove({...m,pp:m.maxPp});},check:G=>!G.player.moves.find(x=>x.id==='glacial'),isAsync:true},
  {id:'u_spd_crit',name:'Blur of Steel',desc:'Each 5 SPD = +3% Crit',rarity:'epic',apply:G=>{G.blurSteelUpg=true;const bonus=Math.floor(G.player.spd/5)*3;G.player.critBonus=(G.player.critBonus||0)+bonus;},check:G=>G.player.spd>=15&&!G.blurSteelUpg},
  {id:'u_supernova_unlock',name:'Stellar Core',desc:'Unlock Supernova (T3) + all DoT+1t',rarity:'epic',apply:async G=>{G.dotMasterUpg=true;const m=BASE_PMOVES.find(x=>x.id==='supernova');if(m&&!G.player.moves.find(x=>x.id===m.id))await tryLearnMove({...m,pp:m.maxPp});},check:G=>!G.player.moves.find(x=>x.id==='supernova'),isAsync:true},
];

const TRAITS=[
  {id:'t_tough',name:'Unyielding',desc:'+5 DEF passively',buildSynergy:'tank'},
  {id:'t_swift',name:'Overclocked',desc:'Always win SPD ties',buildSynergy:'speed'},
  {id:'t_tactician',name:'Tactician',desc:'Earn +50% score per battle',buildSynergy:'any'},
  {id:'t_ironwill',name:'Iron Will',desc:'Cannot be stunned',buildSynergy:'any'},
  {id:'t_medic',name:'Field Medic',desc:'Medpacks restore +15 extra HP',buildSynergy:'sustain'},
  {id:'t_momentum',name:'Momentum',desc:'Consecutive hits +5% damage each',buildSynergy:'aggro'},
  {id:'t_glasscannon',name:'Glass Cannon',desc:'ATK +8, DEF -4 permanently',buildSynergy:'aggro'},
  {id:'t_scavenger',name:'Scavenger',desc:'+25g every wave clear',buildSynergy:'economy'},
  {id:'t_tank',name:'Iron Fortress',desc:'Incoming damage -10% (passive)',buildSynergy:'tank'},
  {id:'t_momentum',name:'Momentum',desc:'Consecutive hits +5% damage each',buildSynergy:'aggro'},
  {id:'t_vampire_tr',name:'Bloodthirst',desc:'All attacks passively drain 8% HP',buildSynergy:'sustain'},
  {id:'t_critburn',name:'Critical OS',desc:'Critical hits apply 2-turn Burn on enemy',buildSynergy:'dot'},
  {id:'t_crit_spec',name:'Sniper Mind',desc:'Crits deal 2.2x instead of 1.5x',buildSynergy:'crit'},
  {id:'t_hp_regen',name:'Regenerative Frame',desc:'Passively regen 2% max HP each end of round',buildSynergy:'sustain'},
  {id:'t_gold_finder',name:'Gold Seeker',desc:'Gold rewards increased 20%',buildSynergy:'economy'},
  // NEW: Lucky trait that pairs with Gambler's Edge
  {id:'t_lucky',name:'Lady Luck',desc:"Gambler's Edge JACKPOT chance +15%. Non-combat: random 20g per wave",buildSynergy:'gamble'},
];

function rollUpgrades(){
  const avail=ALL_UPGRADES.filter(u=>{
    if(G.appliedUpgrades.includes(u.id)&&!['u_medpacks','u_ethers','u_stims','u_ppup','u_shields','u_fullpp'].includes(u.id))return false;
    return u.check(G);
  });
  const shuffled=[...avail].sort(()=>Math.random()-0.5);
  const picks=[];
  const epics=shuffled.filter(u=>u.rarity==='epic');
  const rares=shuffled.filter(u=>u.rarity==='rare');
  const commons=shuffled.filter(u=>u.rarity==='common');
  if(G.wave>=3&&epics.length&&Math.random()<0.45)picks.push(epics[0]);
  if(picks.length<3&&rares.length&&(G.wave>=2||Math.random()<0.5)){const r=rares.find(u=>!picks.includes(u));if(r)picks.push(r);}
  while(picks.length<3&&commons.length){const u=commons.find(u=>!picks.includes(u));if(!u)break;picks.push(u);commons.splice(commons.indexOf(u),1);}
  while(picks.length<3&&shuffled.length){const u=shuffled.find(u=>!picks.includes(u));if(!u)break;picks.push(u);}
  return picks.slice(0,3);
}

function offerMoveUnlock(){
  const tier=clamp(Math.floor((G.wave-1)/2),0,3);
  const eligible=BASE_PMOVES.filter(m=>!m.shopExclusive&&m.tier===tier&&!G.player.moves.find(x=>x.id===m.id));
  if(!eligible.length)return null;
  return eligible[rnd(0,eligible.length-1)];
}

function rollShopMoves(){
  const shopMoves=BASE_PMOVES.filter(m=>m.shopExclusive);
  return shopMoves.filter(()=>Math.random()<0.28).map(m=>({
    id:'sm_'+m.id,name:'Learn: '+m.name,desc:m.desc+'\n'+(m.tipExtra||''),cost:100+m.tier*40,shopOnly:true,rare:true,
    apply:async G=>{await tryLearnMove({...m,pp:m.maxPp});}
  }));
}

async function tryLearnMove(newMove){
  if(G.player.moves.find(m=>m.id===newMove.id))return;
  if(G.player.moves.length<6){G.player.moves.push({...newMove,pp:newMove.maxPp});addLog('> Learned: '+newMove.name,'proj');}
  else{
    const replaceIdx=await promptMoveReplace(newMove);
    if(replaceIdx>=0){const old=G.player.moves[replaceIdx];addLog('> Replaced '+old.name+' with '+newMove.name,'proj');G.player.moves[replaceIdx]={...newMove,pp:newMove.maxPp};}
    else addLog('> Cancelled learning '+newMove.name,'proj');
  }
  renderMoves();updateProbTable();
}

function showStatUpgrade(onDone){
  const sec=document.getElementById('stat-up-section');const grid=document.getElementById('stat-up-grid');
  sec.style.display='block';grid.innerHTML='';
  G.player.maxHp+=15;G.player.hp=Math.min(G.player.hp+15,G.player.maxHp);
  G.player.bAtk+=1;G.player.bDef+=1;
  addLog('> Level Up: MaxHP+15 ATK+1 DEF+1','proj');
  const stats=[
    {label:'ATK +3',apply:()=>{G.player.bAtk+=3;addLog('> Stat: ATK +3','proj');}},
    {label:'DEF +3',apply:()=>{G.player.bDef+=3;addLog('> Stat: DEF +3','proj');}},
    {label:'SPD +2',apply:()=>{G.player.spd+=2;addLog('> Stat: SPD +2','proj');}},
    {label:'HP +30',apply:()=>{G.player.maxHp+=30;G.player.hp=Math.min(G.player.hp+30,G.player.maxHp);addLog('> Stat: HP +30','proj');}},
    {label:'CRIT +6%',apply:()=>{G.player.critBonus=(G.player.critBonus||0)+6;addLog('> Stat: CRIT +6%','proj');}},
    {label:'EVADE +6%',apply:()=>{G.player.evadeBonus=(G.player.evadeBonus||0)+6;addLog('> Stat: EVADE +6%','proj');}},
  ];
  stats.forEach(s=>{
    const btn=document.createElement('button');btn.textContent=s.label;
    btn.style.cssText='font-size:11px;padding:3px 4px;text-align:center;width:100%';
    btn.addEventListener('click',()=>{s.apply();sec.style.display='none';updateRadar();onDone();});
    grid.appendChild(btn);
  });
}

function applyTraitPassives(){
  if(G.traits.find(t=>t.id==='t_hp_regen')){
    const h=Math.round(G.player.maxHp*0.02);
    if(G.player.hp<G.player.maxHp){G.player.hp=Math.min(G.player.maxHp,G.player.hp+h);addLog('> Passive Regen: +'+h+'HP','hit');}
  }
  if(G.traits.find(t=>t.id==='t_crit_spec'))G.player.critMult=2.2;
  // Lady Luck: +20g each wave
  if(G.traits.find(t=>t.id==='t_lucky')){G.gold+=20;addLog('> Lady Luck: +20g','proj');}
}

function endBattle(winner){
  G.phase='end';setMovesEnabled(false);
  document.getElementById('main-layout').style.display='none';
  const box=document.getElementById('resultbox');
  document.getElementById('stat-up-section').style.display='none';
  if(winner==='player'){
    document.getElementById('result-title').textContent='VICTORY';
    const goldMult=G.traits.find(t=>t.id==='t_gold_finder')?1.20:1.0;
    const base=G.ai.reward,goldEarned=Math.round((G.ai.gold+(G.traits.find(t=>t.id==='t_scavenger')?25:0))*goldMult);
    G.gold+=goldEarned;
    const spd=Math.max(0,(20-G.turn)*10),hp=Math.round(G.player.hp/G.player.maxHp*100),total=base+spd+hp;
    G.waveScore+=total;G.score+=total;
    document.getElementById('result-detail').textContent='Wave '+G.wave+' cleared!\n\nBase reward:  '+base+'\nSpeed bonus:  +'+spd+'\nHP bonus:     +'+hp+'\nTotal:        '+total+'\nGold earned:  +'+goldEarned+'g\n\nCumulative:   '+G.score.toLocaleString()+'\nGold:         '+G.gold+'g\nLevel:        '+G.level;
    addLog('=== VICTORY Wave '+G.wave+' — +'+total+' (+'+goldEarned+'g) ===','sys');
    autoScalePlayer();
    const restockChance=Math.min(0.98,0.65+G.wave*0.03);
    if(Math.random()<restockChance||!G.shop||G.shop.length===0){
      G.shop=rollShop();const shopMovesExtra=rollShopMoves();G.shop.push(...shopMovesExtra);
      addLog('> Shop restocked for Wave '+(G.wave+1),'proj');
    }
    const upgrades=rollUpgrades();
    const upDiv=document.getElementById('upgrade-pick');const chDiv=document.getElementById('upgrade-choices');
    upDiv.style.display='block';chDiv.innerHTML='';
    const newMove=offerMoveUnlock();
    if(newMove){
      upgrades.unshift({id:'move_'+newMove.id,name:'Learn: '+newMove.name,desc:'Add '+newMove.name+' ('+newMove.desc+')\n'+(newMove.tipExtra||''),rarity:'rare',apply:async g=>{await tryLearnMove({...newMove,pp:newMove.maxPp});},check:()=>true,isAsync:true});
    }
    let upgradeChosen=false;
    const checkBothChosen=()=>{if(upgradeChosen)document.getElementById('next-btn').style.display='inline-block';};
    upgrades.slice(0,3).forEach(u=>{
      const card=document.createElement('div');card.className='upgrade-card';card.style.width='175px';
      card.innerHTML='<div class="utitle">'+u.name+'</div><div class="urarity '+(u.rarity==='epic'?'rarity-epic':u.rarity==='rare'?'rarity-rare':'rarity-common')+'">['+u.rarity+']</div><div class="udesc">'+u.desc+'</div><button style="width:100%;margin-top:3px">Select</button>';
      card.querySelector('button').addEventListener('click',async()=>{
        G.appliedUpgrades.push(u.id);
        if(u.isAsync)await u.apply(G);else u.apply(G);
        upDiv.style.display='none';addLog('> Upgrade: '+u.name,'proj');
        upgradeChosen=true;showStatUpgrade(checkBothChosen);
      });
      chDiv.appendChild(card);
    });
    // Trait offer every 3 waves
    if(G.wave%3===0){
      const pool=TRAITS.filter(t=>!G.traits.find(x=>x.id===t.id));
      if(pool.length){
        const t=pool[rnd(0,pool.length-1)];
        const card=document.createElement('div');card.className='upgrade-card';card.style.cssText='width:175px;border:2px solid #000';
        card.innerHTML='<div class="utitle">'+t.name+'</div><div class="urarity" style="font-style:italic">[passive trait]</div><div class="udesc">'+t.desc+'</div><button style="width:100%;margin-top:3px">Unlock</button>';
        card.querySelector('button').addEventListener('click',()=>{
          G.traits.push(t);
          if(t.id==='t_glasscannon'){G.player.bAtk+=8;G.player.bDef=Math.max(1,G.player.bDef-4);}
          if(t.id==='t_crit_spec')G.player.critMult=2.2;
          if(t.id==='t_vampire_tr'){G.player.vamp=true;G.player.vampBonus=Math.max(G.player.vampBonus||0,0.08);}
          upDiv.style.display='none';addLog('> Trait: '+t.name,'proj');upgradeChosen=true;showStatUpgrade(checkBothChosen);
        });
        chDiv.appendChild(card);
      }
    }
    document.getElementById('next-btn').style.display='none';
  }else{
    document.getElementById('result-title').textContent='DEFEAT';
    document.getElementById('result-detail').textContent='Eliminated on Wave '+G.wave+', Turn '+G.turn+'.\n\nFinal score:  '+G.score.toLocaleString()+'\nGold:         '+G.gold+'g\nLevel:        '+G.level+'\nUpgrades:     '+G.appliedUpgrades.length+'\nTraits:       '+G.traits.length;
    addLog('=== DEFEAT ===','ai');
    document.getElementById('upgrade-pick').style.display='none';
    document.getElementById('next-btn').style.display='none';
  }
  renderAll();box.classList.add('show');
}

function nextWave(){
  const p={...G.player,
    moves:G.player.moves.map(m=>({...m,pp:m.maxPp})),
    status:{burn:0,stun:0,regen:0,reflect:0,stimTurns:0,chill:0,poison:0,bleed:0,shieldTurns:0,tauntTurns:0,wraithTurns:0},
    pendingStatus:{burn:0,poison:0,bleed:0,regen:0,chill:0},
    phoenixUsed:false,overloadStacks:0,defMult:1,atkBuf:0,defBuf:0,atkBufTurns:0,defBufTurns:0,
    defDebuf:0,defDebufTurns:0,overwatchReady:false};
  G.wave++;G.turn=1;G.waveScore=0;G.phase='player';G.busy=false;G.chainCount=0;G.momentumCount=0;
  G.nextMoveAccBonus=0;G.nextMoveEffectGuarantee=false;G.deathmarkActive=false;G.deathmarkTurns=0;
  if(G.traits.find(t=>t.id==='t_berserker_tr')){p.bAtk+=2;p.bDef=Math.max(1,p.bDef-1);}
  p.hp=p.maxHp;G.player=p;G.ai=buildEnemy(G.wave-1);
  applyTraitPassives();
  document.getElementById('resultbox').classList.remove('show');
  document.getElementById('main-layout').style.display='';
  document.getElementById('next-btn').style.display='none';
  clearLog();renderAll();renderTraits();updateWaveInfo();renderShop();
  setMsg('Wave '+G.wave+' — What will '+G.player.name+' do?',true);
  setMovesEnabled(true);
  addLog('=== WAVE '+G.wave+' START — '+G.ai.name+' ['+G.ai.theme+'] ===','sys');
  updateEnemyMovesPanel();updateAIStrategyBox();
}

initGame();