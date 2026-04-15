import { useState, useEffect } from "react";
import Head from "next/head";
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ComposedChart, Bar, Line } from "recharts";

var CC = {bg:"#F7F8FA",card:"#FFF",bdr:"#E8ECF1",bdrL:"#F0F2F5",tx:"#1A1F36",tx2:"#5E6278",txM:"#8A92A6",txL:"#9CA3B8",grn:"#0D9F6E",red:"#E02D3C",org:"#D97706",blu:"#2563EB",pur:"#7C3AED"};
var FF = "'Outfit','Avenir Next',system-ui,sans-serif";
var thS = {padding:"8px 10px",fontSize:10,fontWeight:700,color:"#9CA3B8",letterSpacing:0.8,textTransform:"uppercase",textAlign:"right",borderBottom:"2px solid #E8ECF1"};
var tdSt = {padding:"8px 12px",textAlign:"right",fontVariantNumeric:"tabular-nums",color:"#1A1F36",fontSize:12.5};

function nF(v){return(v==null||isNaN(v))?"—":Math.round(v).toLocaleString();}
function pF(v){return(v==null||isNaN(v))?"—":v.toFixed(1)+"%";}
function a5(a,i){var s=Math.max(0,i-5);var sl=a.slice(s,i).filter(function(v){return v!=null;});return sl.length?sl.reduce(function(x,y){return x+y;},0)/sl.length:null;}
function vpct(c,a){return(c==null||a==null||a===0)?null:((c-a)/a)*100;}
function vdel(c,a){return(c==null||a==null)?null:c-a;}
function shortWk(w){return w.replace("W0","W")+" '26";}

function KPI({label,val,fmt,dv,pp}){
  var up=dv!=null&&dv>0.5,dn=dv!=null&&dv<-0.5,col=up?CC.grn:dn?CC.red:CC.txM;
  var ar=up?"▲":dn?"▼":"",isR=pp||fmt==="pct";
  return(
    <div style={{background:CC.card,borderRadius:10,padding:"18px 22px",border:"1px solid "+CC.bdr,flex:1,minWidth:155}}>
      <div style={{fontSize:10,fontWeight:700,color:CC.txL,letterSpacing:1.1,textTransform:"uppercase",marginBottom:8,fontFamily:FF}}>{label}</div>
      <div style={{fontSize:isR?28:32,fontWeight:700,color:isR?CC.blu:CC.tx,fontFamily:FF,letterSpacing:-1,lineHeight:1}}>{fmt==="pct"?pF(val):nF(val)}</div>
      {dv!=null&&(<div style={{fontSize:11,color:col,fontWeight:600,marginTop:7,fontFamily:FF}}>{ar} {Math.abs(dv).toFixed(1)}{pp?"pp":"%"} vs 5w avg</div>)}
    </div>
  );
}

function ChartTip({active,payload,label}){
  if(!active||!payload||!payload.length) return null;
  return(
    <div style={{background:"#fff",border:"1px solid "+CC.bdr,borderRadius:8,padding:"10px 14px",boxShadow:"0 4px 16px rgba(0,0,0,0.08)",fontFamily:FF}}>
      <div style={{fontWeight:700,fontSize:13,color:CC.tx,marginBottom:4}}>{label}</div>
      {payload.filter(function(e){return e.value!=null;}).map(function(e,j){
        return(<div key={j} style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}>
          <span style={{width:10,height:3,borderRadius:2,background:e.color,display:"inline-block"}}/>
          <span style={{color:CC.tx2,fontSize:12}}>{e.name}:</span>
          <span style={{color:CC.tx,fontWeight:600,fontSize:12}}>{typeof e.value==="number"?e.value.toLocaleString(undefined,{maximumFractionDigits:1}):"—"}</span>
        </div>);
      })}
    </div>
  );
}

function LeadsChart({data,color,soldLabel}){
  return(<ResponsiveContainer width="100%" height={250}><ComposedChart data={data} barGap={2}>
    <CartesianGrid strokeDasharray="3 3" stroke={CC.bdrL} vertical={false}/>
    <XAxis dataKey="wk" tick={{fill:CC.txM,fontSize:10,fontFamily:FF}} axisLine={{stroke:CC.bdr}} tickLine={false}/>
    <YAxis yAxisId="l" tick={{fill:CC.txM,fontSize:10}} axisLine={false} tickLine={false}/>
    <YAxis yAxisId="r" orientation="right" tick={{fill:CC.grn,fontSize:10}} axisLine={false} tickLine={false} tickFormatter={function(v){return v+"%";}} domain={[0,100]}/>
    <Tooltip content={<ChartTip/>}/><Legend wrapperStyle={{fontSize:11,fontFamily:FF,paddingTop:4}}/>
    <Bar yAxisId="l" dataKey="gen" name="Generated" fill={color} radius={[3,3,0,0]} barSize={16} opacity={0.85}/>
    <Bar yAxisId="l" dataKey="sold" name={soldLabel||"Sold"} fill={CC.blu} radius={[3,3,0,0]} barSize={16} opacity={0.7}/>
    <Line yAxisId="r" type="monotone" dataKey="sp" name="Sell-Through %" stroke={CC.grn} strokeWidth={2.5} dot={{r:2.5,fill:CC.grn}}/>
  </ComposedChart></ResponsiveContainer>);
}

function TLChart({data}){
  return(<ResponsiveContainer width="100%" height={250}><ComposedChart data={data} barGap={2}>
    <CartesianGrid strokeDasharray="3 3" stroke={CC.bdrL} vertical={false}/>
    <XAxis dataKey="wk" tick={{fill:CC.txM,fontSize:10,fontFamily:FF}} axisLine={{stroke:CC.bdr}} tickLine={false}/>
    <YAxis yAxisId="l" tick={{fill:CC.txM,fontSize:10}} axisLine={false} tickLine={false}/>
    <YAxis yAxisId="r" orientation="right" tick={{fill:CC.pur,fontSize:10}} axisLine={false} tickLine={false} tickFormatter={function(v){return v+"%";}}/>
    <Tooltip content={<ChartTip/>}/><Legend wrapperStyle={{fontSize:11,fontFamily:FF,paddingTop:4}}/>
    <Bar yAxisId="l" dataKey="tlS" name="Routed to TL" fill={CC.blu} radius={[3,3,0,0]} barSize={16} opacity={0.6}/>
    <Bar yAxisId="l" dataKey="tlC" name="Contracts Signed" fill={CC.grn} radius={[3,3,0,0]} barSize={16}/>
    <Line yAxisId="r" type="monotone" dataKey="tlR" name="Conv Rate %" stroke={CC.pur} strokeWidth={2.5} dot={{r:2.5,fill:CC.pur}}/>
  </ComposedChart></ResponsiveContainer>);
}

function PWChart({data}){
  return(<ResponsiveContainer width="100%" height={250}><ComposedChart data={data} barGap={2}>
    <CartesianGrid strokeDasharray="3 3" stroke={CC.bdrL} vertical={false}/>
    <XAxis dataKey="wk" tick={{fill:CC.txM,fontSize:10,fontFamily:FF}} axisLine={{stroke:CC.bdr}} tickLine={false}/>
    <YAxis yAxisId="l" tick={{fill:CC.txM,fontSize:10}} axisLine={false} tickLine={false}/>
    <YAxis yAxisId="r" orientation="right" tick={{fill:CC.org,fontSize:10}} axisLine={false} tickLine={false} tickFormatter={function(v){return v+"%";}}/>
    <Tooltip content={<ChartTip/>}/><Legend wrapperStyle={{fontSize:11,fontFamily:FF,paddingTop:4}}/>
    <Bar yAxisId="l" dataKey="pwS" name="Sent to PW" fill={CC.org} radius={[3,3,0,0]} barSize={16} opacity={0.6}/>
    <Bar yAxisId="l" dataKey="pwC" name="PW Signed" fill={CC.grn} radius={[3,3,0,0]} barSize={16}/>
    <Line yAxisId="r" type="monotone" dataKey="pwR" name="Conv Rate %" stroke={CC.red} strokeWidth={2.5} dot={{r:2.5,fill:CC.red}} connectNulls={false}/>
  </ComposedChart></ResponsiveContainer>);
}

function StateTable({states,w,wkLabels}){
  if(!states||Object.keys(states).length===0) return null;
  return(
    <div style={{overflowX:"auto",borderRadius:10,border:"1px solid "+CC.bdr,background:CC.card}}>
      <table style={{width:"100%",borderCollapse:"collapse",fontFamily:FF,fontSize:12.5}}>
        <thead><tr><th style={{...thS,textAlign:"left"}}>State</th><th style={thS}>Metric</th>
          {wkLabels.map(function(wl,ci){return(<th key={ci} style={{...thS,minWidth:48,background:ci===w?"#EFF6FF":"transparent",color:ci===w?CC.blu:CC.txL}}>{wl}</th>);})}
        </tr></thead>
        <tbody>{Object.keys(states).map(function(st){
          var d=states[st];var metrics=[{k:"gen",l:"Leads Gen"},{k:"rt",l:"Routed"},{k:"ts",l:"TL Sent"},{k:"tp",l:"% Sent",pct:true},{k:"cs",l:"Signed"},{k:"cr",l:"Conv %",pct:true}].filter(function(m){return d[m.k];});
          return metrics.map(function(m,mi){return(
            <tr key={st+m.k} style={{borderBottom:mi===metrics.length-1?"2px solid "+CC.bdr:"1px solid "+CC.bdrL}}>
              {mi===0&&<td rowSpan={metrics.length} style={{padding:"8px 12px",fontWeight:700,color:CC.tx,fontSize:13,borderRight:"1px solid "+CC.bdr,verticalAlign:"top",background:"#FAFBFC"}}>{st}</td>}
              <td style={{padding:"5px 10px",color:CC.tx2,fontSize:11,fontWeight:600,whiteSpace:"nowrap",borderRight:"1px solid "+CC.bdrL}}>{m.l}</td>
              {(d[m.k]||[]).map(function(v,vi){return(<td key={vi} style={{padding:"5px 7px",textAlign:"right",fontVariantNumeric:"tabular-nums",color:m.k==="cs"&&v>0?CC.grn:m.k==="cr"&&v>10?CC.grn:m.k==="cr"&&v>0?CC.org:CC.tx,fontWeight:vi===w?700:400,background:vi===w?"#EFF6FF":"transparent",fontSize:11.5}}>{v==null?"—":m.pct?v.toFixed(1)+"%":typeof v==="number"?v.toLocaleString(undefined,{maximumFractionDigits:1}):"—"}</td>);})}
            </tr>);});
        })}</tbody>
      </table>
    </div>
  );
}

function BizPage({name,d,w,color,soldLabel,showPW,wkLabels,states}){
  var sl=soldLabel||"Leads Sold";
  var cd=wkLabels.map(function(_,i){return{wk:wkLabels[i],gen:d.gen[i],sold:d.sold[i],sp:d.sp[i],tlS:d.tlS[i],tlC:d.tlC[i],tlR:d.tlR[i],pwS:d.pwS?d.pwS[i]:null,pwC:d.pwC?d.pwC[i]:null,pwR:d.pwR?d.pwR[i]:null};});
  return(
    <div>
      <h1 style={{fontSize:24,fontWeight:700,color:CC.tx,margin:"0 0 4px",fontFamily:FF}}>{name}</h1>
      <p style={{fontSize:13,color:CC.txM,margin:"0 0 20px",fontFamily:FF}}>Weekly performance · {wkLabels[w]}</p>
      <div style={{display:"flex",gap:12,marginBottom:22,flexWrap:"wrap"}}>
        <KPI label={"Leads Generated ("+wkLabels[w]+")"} val={d.gen[w]} dv={vpct(d.gen[w],a5(d.gen,w))}/>
        <KPI label={sl} val={d.sold[w]} dv={vpct(d.sold[w],a5(d.sold,w))}/>
        <KPI label="Sell-Through %" val={d.sp[w]} fmt="pct" dv={vdel(d.sp[w],a5(d.sp,w))} pp/>
        <KPI label="TL Contracts Signed" val={d.tlC[w]} dv={vpct(d.tlC[w],a5(d.tlC,w))}/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14}}>
        <div style={{background:CC.card,borderRadius:10,border:"1px solid "+CC.bdr,padding:"18px 18px 10px"}}>
          <div style={{fontSize:11,fontWeight:700,color:CC.txL,letterSpacing:0.8,textTransform:"uppercase",marginBottom:10,fontFamily:FF}}>Leads Volume & Sell-Through Rate</div>
          <LeadsChart data={cd} color={color} soldLabel={sl}/>
        </div>
        {showPW ? (
          <div style={{background:CC.card,borderRadius:10,border:"1px solid "+CC.bdr,padding:"18px 18px 10px"}}>
            <div style={{fontSize:11,fontWeight:700,color:CC.txL,letterSpacing:0.8,textTransform:"uppercase",marginBottom:10,fontFamily:FF}}>Pacific Workers Pipeline & Conversion Rate</div>
            <PWChart data={cd}/>
          </div>
        ) : (
          <div style={{background:CC.card,borderRadius:10,border:"1px solid "+CC.bdr,padding:"18px 18px 10px"}}>
            <div style={{fontSize:11,fontWeight:700,color:CC.txL,letterSpacing:0.8,textTransform:"uppercase",marginBottom:10,fontFamily:FF}}>TL Pipeline & Conversion Rate</div>
            <TLChart data={cd}/>
          </div>
        )}
      </div>
      {showPW && (
        <div style={{background:CC.card,borderRadius:10,border:"1px solid "+CC.bdr,padding:"18px 18px 10px",marginBottom:22}}>
          <div style={{fontSize:11,fontWeight:700,color:CC.txL,letterSpacing:0.8,textTransform:"uppercase",marginBottom:10,fontFamily:FF}}>TL Pipeline & Conversion Rate</div>
          <TLChart data={cd}/>
        </div>
      )}
      {!showPW && <div style={{marginBottom:22}}/>}
      <div style={{overflowX:"auto",borderRadius:10,border:"1px solid "+CC.bdr,background:CC.card,marginBottom:22}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontFamily:FF,fontSize:12.5}}>
          <thead><tr><th style={{...thS,textAlign:"left"}}></th><th colSpan={3} style={{...thS,textAlign:"center",background:"#FAFBFC"}}>Volume</th><th colSpan={3} style={{...thS,textAlign:"center"}}>TL Pipeline</th>{showPW&&<th colSpan={3} style={{...thS,textAlign:"center",background:"#FAFBFC"}}>PW Pipeline</th>}</tr>
            <tr style={{borderBottom:"2px solid "+CC.bdr}}><th style={{...thS,textAlign:"left"}}>Week</th><th style={{...thS,background:"#FAFBFC"}}>Gen</th><th style={{...thS,background:"#FAFBFC"}}>Sold</th><th style={{...thS,background:"#FAFBFC"}}>Sold%</th><th style={thS}>Sent</th><th style={{...thS,color:CC.grn}}>Signed</th><th style={thS}>Conv%</th>{showPW&&(<><th style={{...thS,background:"#FAFBFC"}}>Sent</th><th style={{...thS,background:"#FAFBFC",color:CC.grn}}>Signed</th><th style={{...thS,background:"#FAFBFC"}}>Conv%</th></>)}</tr>
          </thead>
          <tbody>{[...wkLabels].map(function(_,ri){var i=wkLabels.length-1-ri;var sel=i===w;return(
            <tr key={i} style={{borderBottom:"1px solid "+CC.bdrL,background:sel?"#EFF6FF":"transparent"}}>
              <td style={{padding:"7px 12px",fontWeight:600,color:CC.tx,fontSize:12.5}}>{wkLabels[i]}</td>
              <td style={{...tdSt,background:sel?"#EFF6FF":"#FAFBFC"}}>{nF(d.gen[i])}</td><td style={{...tdSt,background:sel?"#EFF6FF":"#FAFBFC"}}>{nF(d.sold[i])}</td><td style={{...tdSt,background:sel?"#EFF6FF":"#FAFBFC"}}>{pF(d.sp[i])}</td>
              <td style={tdSt}>{nF(d.tlS[i])}</td><td style={{...tdSt,color:(d.tlC[i]||0)>0?CC.grn:CC.txM}}>{nF(d.tlC[i])}</td><td style={{...tdSt,color:(d.tlR[i]||0)>10?CC.grn:(d.tlR[i]||0)>0?CC.org:CC.txM}}>{pF(d.tlR[i])}</td>
              {showPW&&(<><td style={{...tdSt,background:sel?"#EFF6FF":"#FAFBFC"}}>{nF(d.pwS?.[i])}</td><td style={{...tdSt,background:sel?"#EFF6FF":"#FAFBFC",color:(d.pwC?.[i]||0)>0?CC.grn:CC.txM}}>{nF(d.pwC?.[i])}</td><td style={{...tdSt,background:sel?"#EFF6FF":"#FAFBFC"}}>{pF(d.pwR?.[i])}</td></>)}
            </tr>);})}</tbody>
        </table>
      </div>
      {states&&Object.keys(states).length>0&&(<><div style={{fontSize:11,fontWeight:700,color:CC.txL,letterSpacing:0.8,textTransform:"uppercase",marginBottom:8,fontFamily:FF}}>By State</div><StateTable states={states} w={w} wkLabels={wkLabels}/></>)}
    </div>
  );
}

function MADataTable({d,w,wkLabels,showTL}){
  return(
    <div style={{overflowX:"auto",borderRadius:10,border:"1px solid "+CC.bdr,background:CC.card,marginBottom:22}}>
      <table style={{width:"100%",borderCollapse:"collapse",fontFamily:FF,fontSize:12.5}}>
        <thead><tr><th style={{...thS,textAlign:"left"}}></th><th colSpan={3} style={{...thS,textAlign:"center",background:"#FAFBFC"}}>Volume</th>{showTL&&<th colSpan={3} style={{...thS,textAlign:"center"}}>TL Pipeline</th>}</tr>
          <tr style={{borderBottom:"2px solid "+CC.bdr}}><th style={{...thS,textAlign:"left"}}>Week</th><th style={{...thS,background:"#FAFBFC"}}>Gen</th><th style={{...thS,background:"#FAFBFC"}}>Sold</th><th style={{...thS,background:"#FAFBFC"}}>Sold%</th>{showTL&&(<><th style={thS}>Sent</th><th style={{...thS,color:CC.grn}}>Signed</th><th style={thS}>Conv%</th></>)}</tr>
        </thead>
        <tbody>{[...wkLabels].map(function(_,ri){var i=wkLabels.length-1-ri;var sel=i===w;return(
          <tr key={i} style={{borderBottom:"1px solid "+CC.bdrL,background:sel?"#EFF6FF":"transparent"}}>
            <td style={{padding:"7px 12px",fontWeight:600,color:CC.tx,fontSize:12.5}}>{wkLabels[i]}</td>
            <td style={{...tdSt,background:sel?"#EFF6FF":"#FAFBFC"}}>{nF(d.gen[i])}</td><td style={{...tdSt,background:sel?"#EFF6FF":"#FAFBFC"}}>{nF(d.sold[i])}</td><td style={{...tdSt,background:sel?"#EFF6FF":"#FAFBFC"}}>{pF(d.sp[i])}</td>
            {showTL&&(<><td style={tdSt}>{nF(d.tlS[i])}</td><td style={{...tdSt,color:(d.tlC[i]||0)>0?CC.grn:CC.txM}}>{nF(d.tlC[i])}</td><td style={{...tdSt,color:(d.tlR[i]||0)>10?CC.grn:(d.tlR[i]||0)>0?CC.org:CC.txM}}>{pF(d.tlR[i])}</td></>)}
          </tr>);})}</tbody>
      </table>
    </div>
  );
}

function MACombined({w,t1,t23,wkLabels,states}){
  var cd1=wkLabels.map(function(_,i){return{wk:wkLabels[i],gen:t1.gen[i],sold:t1.sold[i],sp:t1.sp[i],tlS:t1.tlS[i],tlC:t1.tlC[i],tlR:t1.tlR[i]};});
  var cd23=wkLabels.map(function(_,i){return{wk:wkLabels[i],gen:t23.gen[i],sold:t23.sold[i],sp:t23.sp[i]};});
  return(
    <div>
      <h1 style={{fontSize:24,fontWeight:700,color:CC.tx,margin:"0 0 4px",fontFamily:FF}}>MyAccident</h1>
      <p style={{fontSize:13,color:CC.txM,margin:"0 0 22px",fontFamily:FF}}>Tier 1 & Tier 2/3 · {wkLabels[w]}</p>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}><div style={{width:4,height:24,background:CC.org,borderRadius:4}}/><h2 style={{fontSize:17,fontWeight:700,color:CC.tx,margin:0,fontFamily:FF}}>Tier 1</h2></div>
      <div style={{display:"flex",gap:12,marginBottom:20,flexWrap:"wrap"}}>
        <KPI label={"Leads Generated ("+wkLabels[w]+")"} val={t1.gen[w]} dv={vpct(t1.gen[w],a5(t1.gen,w))}/>
        <KPI label="Leads Sold" val={t1.sold[w]} dv={vpct(t1.sold[w],a5(t1.sold,w))}/>
        <KPI label="Sell-Through %" val={t1.sp[w]} fmt="pct" dv={vdel(t1.sp[w],a5(t1.sp,w))} pp/>
        <KPI label="TL Contracts" val={t1.tlC[w]} dv={vpct(t1.tlC[w],a5(t1.tlC,w))}/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14}}>
        <div style={{background:CC.card,borderRadius:10,border:"1px solid "+CC.bdr,padding:"18px 18px 10px"}}><div style={{fontSize:11,fontWeight:700,color:CC.txL,letterSpacing:0.8,textTransform:"uppercase",marginBottom:10,fontFamily:FF}}>Leads Volume & Sell-Through</div><LeadsChart data={cd1} color={CC.org}/></div>
        <div style={{background:CC.card,borderRadius:10,border:"1px solid "+CC.bdr,padding:"18px 18px 10px"}}><div style={{fontSize:11,fontWeight:700,color:CC.txL,letterSpacing:0.8,textTransform:"uppercase",marginBottom:10,fontFamily:FF}}>TL Pipeline & Conversion</div><TLChart data={cd1}/></div>
      </div>
      <MADataTable d={t1} w={w} wkLabels={wkLabels} showTL={true}/>
      {states&&Object.keys(states).length>0&&(<><div style={{fontSize:11,fontWeight:700,color:CC.txL,letterSpacing:0.8,textTransform:"uppercase",marginBottom:8,fontFamily:FF}}>Tier 1 — By State</div><StateTable states={states} w={w} wkLabels={wkLabels}/></>)}
      <div style={{display:"flex",alignItems:"center",gap:10,marginTop:36,marginBottom:14}}><div style={{width:4,height:24,background:CC.pur,borderRadius:4}}/><h2 style={{fontSize:17,fontWeight:700,color:CC.tx,margin:0,fontFamily:FF}}>Tier 2/3</h2></div>
      <div style={{display:"flex",gap:12,marginBottom:20,flexWrap:"wrap"}}>
        <KPI label={"Leads Generated ("+wkLabels[w]+")"} val={t23.gen[w]} dv={vpct(t23.gen[w],a5(t23.gen,w))}/>
        <KPI label="Leads Sold" val={t23.sold[w]} dv={vpct(t23.sold[w],a5(t23.sold,w))}/>
        <KPI label="Sell-Through %" val={t23.sp[w]} fmt="pct" dv={vdel(t23.sp[w],a5(t23.sp,w))} pp/>
      </div>
      <div style={{background:CC.card,borderRadius:10,border:"1px solid "+CC.bdr,padding:"18px 18px 10px",marginBottom:14}}><div style={{fontSize:11,fontWeight:700,color:CC.txL,letterSpacing:0.8,textTransform:"uppercase",marginBottom:10,fontFamily:FF}}>Leads Volume & Sell-Through</div><LeadsChart data={cd23} color={CC.pur}/></div>
      <MADataTable d={t23} w={w} wkLabels={wkLabels} showTL={false}/>
    </div>
  );
}

function AIPanel({w,data,wkLabels}){
  var st1=useState(false),aiLoading=st1[0],setAiLoading=st1[1];
  var st2=useState(null),aiResult=st2[0],setAiResult=st2[1];
  var st3=useState(null),aiError=st3[0],setAiError=st3[1];
  var st4=useState(false),copied=st4[0],setCopied=st4[1];

  function getMonthIndex(){
    var wk=wkLabels[w]||"";var m=wk.match(/W(\d+)/);
    if(m){var n=parseInt(m[1]);return Math.min(11,Math.floor((n-1)/4.33));}
    return new Date().getMonth();
  }

  function doAnalyze(){
    setAiLoading(true);setAiError(null);setAiResult(null);setCopied(false);
    var mi=getMonthIndex();
    var lgm=data.lgm,spz=data.spz,t1=data.maTier1,t23=data.maTier23;
    var actuals={
      lgm:{leadsGenerated:lgm.gen[w],leadsSold:lgm.sold[w],sellThroughPct:lgm.sp[w],leadsSentToTL:lgm.tlS[w],contractSignedTL:lgm.tlC[w],conversionRateTL:lgm.tlR[w],leadsSentToPW:lgm.pwS[w],contractSignedPW:lgm.pwC[w],conversionRatePW:lgm.pwR[w]},
      spz:{leadsGenerated:spz.gen[w],leadsSold:spz.sold[w],sellThroughPct:spz.sp[w],leadsSentToTL:spz.tlS[w],contractSignedTL:spz.tlC[w],conversionRateTL:spz.tlR[w],leadsSentToPW:spz.pwS[w],contractSignedPW:spz.pwC[w],conversionRatePW:spz.pwR[w]},
      maTier1:{leadsGenerated:t1.gen[w],leadsSold:t1.sold[w],sellThroughPct:t1.sp[w],leadsSentToTL:t1.tlS[w],contractSignedTL:t1.tlC[w],conversionRateTL:t1.tlR[w]},
      maTier23:{leadsGenerated:t23.gen[w],leadsSold:t23.sold[w],sellThroughPct:t23.sp[w]}
    };
    var stateInfo={lgm:data.lgmStates,spz:data.spzStates,ma:data.maStates};
    var stateSnap={};
    ["lgm","spz","ma"].forEach(function(bu){
      var sd=stateInfo[bu];if(!sd)return;
      stateSnap[bu]={};
      Object.keys(sd).forEach(function(st){
        stateSnap[bu][st]={};
        Object.keys(sd[st]).forEach(function(mk){
          stateSnap[bu][st][mk]=sd[st][mk]?sd[st][mk][w]:null;
        });
      });
    });
    fetch("/api/analyze",{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({weekLabel:wkLabels[w],monthIndex:mi,actuals:actuals,stateData:stateSnap})
    }).then(function(r){return r.json();}).then(function(d){
      if(d.error){setAiError(d.error);setAiLoading(false);return;}
      setAiResult(d);setAiLoading(false);
    }).catch(function(e){setAiError(e.message);setAiLoading(false);});
  }

  function copyEmail(){
    if(aiResult&&aiResult.emailDraft){
      navigator.clipboard.writeText(aiResult.emailDraft);
      setCopied(true);setTimeout(function(){setCopied(false);},2000);
    }
  }

  var sevColors={high:{bg:"#FEF2F2",tx:"#DC2626",bd:"#FECACA"},medium:{bg:"#FFFBEB",tx:"#D97706",bd:"#FDE68A"},low:{bg:"#F0FDF4",tx:"#16A34A",bd:"#BBF7D0"}};

  return(
    <div style={{marginTop:28,padding:"24px 26px",background:CC.card,borderRadius:12,border:"1px solid "+CC.bdr}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:aiResult?20:0}}>
        <div>
          <div style={{fontSize:14,fontWeight:700,color:CC.tx,fontFamily:FF}}>AI Analysis & Email Draft</div>
          <div style={{fontSize:11.5,color:CC.txM,marginTop:3,fontFamily:FF}}>Compare actuals vs budget, flag anomalies, draft email for leadership</div>
        </div>
        <button onClick={doAnalyze} disabled={aiLoading} style={{padding:"8px 18px",background:aiLoading?"#94A3B8":"linear-gradient(135deg,#2563EB,#7C3AED)",color:"#fff",border:"none",borderRadius:8,fontSize:13,fontWeight:600,cursor:aiLoading?"not-allowed":"pointer",fontFamily:FF,display:"flex",alignItems:"center",gap:8,boxShadow:aiLoading?"none":"0 2px 8px rgba(37,99,235,0.25)"}}>
          {aiLoading?("⏳ Analyzing..."):("✨ AI Analysis")}
        </button>
      </div>
      {aiError&&(<div style={{padding:"10px 14px",background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:8,color:"#DC2626",fontSize:12.5,fontFamily:FF,marginTop:12}}><b>Error:</b> {aiError}</div>)}
      {aiResult&&(
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <div style={{padding:"16px 18px",background:"#F8FAFC",borderRadius:10,border:"1px solid "+CC.bdrL}}>
            <div style={{fontSize:12,fontWeight:700,color:CC.tx,marginBottom:10,fontFamily:FF}}>📊 Key Highlights</div>
            <ul style={{margin:0,paddingLeft:18,listStyleType:"disc"}}>{(aiResult.highlights||[]).map(function(h,i){return(<li key={i} style={{fontSize:12.5,color:CC.tx2,lineHeight:1.7,marginBottom:4,fontFamily:FF}}>{h}</li>);})}</ul>
          </div>
          {aiResult.anomalies&&aiResult.anomalies.length>0&&(
            <div style={{padding:"16px 18px",background:"#F8FAFC",borderRadius:10,border:"1px solid "+CC.bdrL}}>
              <div style={{fontSize:12,fontWeight:700,color:CC.tx,marginBottom:10,fontFamily:FF}}>🚨 Anomaly Alerts</div>
              {aiResult.anomalies.map(function(a,i){var sc=sevColors[a.severity]||sevColors.low;return(
                <div key={i} style={{display:"flex",alignItems:"flex-start",gap:8,marginBottom:8,fontSize:12.5,lineHeight:1.6,fontFamily:FF}}>
                  <span style={{display:"inline-block",padding:"1px 8px",borderRadius:4,fontSize:10,fontWeight:700,textTransform:"uppercase",flexShrink:0,marginTop:2,background:sc.bg,color:sc.tx,border:"1px solid "+sc.bd}}>{a.severity}</span>
                  <span style={{color:CC.tx2}}>{a.message}</span>
                </div>);
              })}
            </div>
          )}
          <div style={{padding:"16px 18px",background:"#F8FAFC",borderRadius:10,border:"1px solid "+CC.bdrL}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <div style={{fontSize:12,fontWeight:700,color:CC.tx,fontFamily:FF}}>✉️ Draft Email</div>
              <button onClick={copyEmail} style={{padding:"5px 12px",background:copied?"#22C55E":"#fff",color:copied?"#fff":"#475569",border:"1px solid "+(copied?"#22C55E":CC.bdr),borderRadius:6,fontSize:11.5,fontWeight:600,cursor:"pointer",fontFamily:FF}}>{copied?"✓ Copied!":"📋 Copy Email"}</button>
            </div>
            <pre style={{margin:0,padding:"14px 16px",background:"#fff",borderRadius:8,fontSize:12,lineHeight:1.75,color:CC.tx2,whiteSpace:"pre-wrap",wordBreak:"break-word",fontFamily:FF,border:"1px solid "+CC.bdrL,maxHeight:400,overflow:"auto"}}>{aiResult.emailDraft}</pre>
          </div>
        </div>
      )}
    </div>
  );
}

function Overview({w,data,wkLabels}){
  var lgm=data.lgm,spz=data.spz,t1=data.maTier1,t23=data.maTier23;
  var cd=wkLabels.map(function(_,i){
    var tg=(lgm.gen[i]||0)+(spz.gen[i]||0)+(t1.gen[i]||0)+(t23.gen[i]||0);
    var ts=(lgm.sold[i]||0)+(spz.sold[i]||0)+(t1.sold[i]||0)+(t23.sold[i]||0);
    var tSent=(lgm.tlS[i]||0)+(spz.tlS[i]||0)+(t1.tlS[i]||0);
    var tSig=(lgm.tlC[i]||0)+(spz.tlC[i]||0)+(t1.tlC[i]||0);
    return{wk:wkLabels[i],tg:tg,ts:ts,sp:tg?(ts/tg)*100:0,tSent:tSent,tSig:tSig,tConv:tSent>0?(tSig/tSent)*100:0,lgmS:lgm.sold[i],spzS:spz.sold[i],ma1S:t1.sold[i],ma23S:t23.sold[i]};
  });
  var c=cd[w],tga=cd.map(function(x){return x.tg;}),tsa=cd.map(function(x){return x.ts;}),tca=cd.map(function(x){return x.tSig;}),spa=cd.map(function(x){return x.sp;});
  return(
    <div>
      <h1 style={{fontSize:24,fontWeight:700,color:CC.tx,margin:"0 0 4px",fontFamily:FF}}>Overview</h1>
      <p style={{fontSize:13,color:CC.txM,margin:"0 0 20px",fontFamily:FF}}>All businesses combined · {wkLabels[w]}</p>
      <div style={{display:"flex",gap:12,marginBottom:22,flexWrap:"wrap"}}>
        <KPI label={"Total Generated ("+wkLabels[w]+")"} val={c.tg} dv={vpct(c.tg,a5(tga,w))}/>
        <KPI label="Total Sold" val={c.ts} dv={vpct(c.ts,a5(tsa,w))}/>
        <KPI label="Sell-Through %" val={c.sp} fmt="pct" dv={vdel(c.sp,a5(spa,w))} pp/>
        <KPI label="TL Contracts Signed" val={c.tSig} dv={vpct(c.tSig,a5(tca,w))}/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14}}>
        <div style={{background:CC.card,borderRadius:10,border:"1px solid "+CC.bdr,padding:"18px 18px 10px"}}>
          <div style={{fontSize:11,fontWeight:700,color:CC.txL,letterSpacing:0.8,textTransform:"uppercase",marginBottom:10,fontFamily:FF}}>Leads Sold by Business</div>
          <ResponsiveContainer width="100%" height={250}><ComposedChart data={cd} barGap={1}>
            <CartesianGrid strokeDasharray="3 3" stroke={CC.bdrL} vertical={false}/><XAxis dataKey="wk" tick={{fill:CC.txM,fontSize:10}} axisLine={{stroke:CC.bdr}} tickLine={false}/><YAxis tick={{fill:CC.txM,fontSize:10}} axisLine={false} tickLine={false}/><Tooltip content={<ChartTip/>}/><Legend wrapperStyle={{fontSize:11,fontFamily:FF}}/>
            <Bar dataKey="lgmS" name="LGM" fill={CC.blu} radius={[2,2,0,0]} barSize={12} opacity={0.85}/>
            <Bar dataKey="spzS" name="SpringZip" fill={CC.grn} radius={[2,2,0,0]} barSize={12} opacity={0.85}/>
            <Bar dataKey="ma1S" name="MA T1" fill={CC.org} radius={[2,2,0,0]} barSize={12} opacity={0.85}/>
            <Bar dataKey="ma23S" name="MA T2/3" fill={CC.pur} radius={[2,2,0,0]} barSize={12} opacity={0.85}/>
          </ComposedChart></ResponsiveContainer>
        </div>
        <div style={{background:CC.card,borderRadius:10,border:"1px solid "+CC.bdr,padding:"18px 18px 10px"}}>
          <div style={{fontSize:11,fontWeight:700,color:CC.txL,letterSpacing:0.8,textTransform:"uppercase",marginBottom:10,fontFamily:FF}}>Combined TL Pipeline & Conversion</div>
          <ResponsiveContainer width="100%" height={250}><ComposedChart data={cd} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke={CC.bdrL} vertical={false}/><XAxis dataKey="wk" tick={{fill:CC.txM,fontSize:10}} axisLine={{stroke:CC.bdr}} tickLine={false}/>
            <YAxis yAxisId="l" tick={{fill:CC.txM,fontSize:10}} axisLine={false} tickLine={false}/>
            <YAxis yAxisId="r" orientation="right" tick={{fill:CC.pur,fontSize:10}} axisLine={false} tickLine={false} tickFormatter={function(v){return v.toFixed(0)+"%";}}/>
            <Tooltip content={<ChartTip/>}/><Legend wrapperStyle={{fontSize:11,fontFamily:FF}}/>
            <Bar yAxisId="l" dataKey="tSent" name="Routed to TL" fill={CC.blu} radius={[3,3,0,0]} barSize={16} opacity={0.6}/>
            <Bar yAxisId="l" dataKey="tSig" name="Signed" fill={CC.grn} radius={[3,3,0,0]} barSize={16}/>
            <Line yAxisId="r" type="monotone" dataKey="tConv" name="Conv %" stroke={CC.pur} strokeWidth={2.5} dot={{r:2.5,fill:CC.pur}}/>
          </ComposedChart></ResponsiveContainer>
        </div>
      </div>
      <div style={{marginBottom:22}}/>
      <div style={{overflowX:"auto",borderRadius:10,border:"1px solid "+CC.bdr,background:CC.card}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontFamily:FF,fontSize:12.5}}>
          <thead><tr style={{borderBottom:"2px solid "+CC.bdr}}>
            <th style={{...thS,textAlign:"left"}}>Week</th><th style={{...thS,background:"#FAFBFC"}}>Total Gen</th><th style={{...thS,background:"#FAFBFC"}}>Total Sold</th><th style={{...thS,background:"#FAFBFC"}}>Sell-Through %</th><th style={thS}>Routed to TL</th><th style={{...thS,color:CC.grn}}>TL Signed</th><th style={thS}>Conv %</th>
          </tr></thead>
          <tbody>{[...wkLabels].map(function(_,ri){var i=wkLabels.length-1-ri;var x=cd[i];var sel=i===w;return(
            <tr key={i} style={{borderBottom:"1px solid "+CC.bdrL,background:sel?"#EFF6FF":"transparent"}}>
              <td style={{padding:"7px 12px",fontWeight:600,color:CC.tx,fontSize:12.5}}>{wkLabels[i]}</td>
              <td style={{...tdSt,background:sel?"#EFF6FF":"#FAFBFC"}}>{nF(x.tg)}</td><td style={{...tdSt,background:sel?"#EFF6FF":"#FAFBFC"}}>{nF(x.ts)}</td><td style={{...tdSt,background:sel?"#EFF6FF":"#FAFBFC"}}>{pF(x.sp)}</td>
              <td style={tdSt}>{nF(x.tSent)}</td><td style={{...tdSt,color:x.tSig>0?CC.grn:CC.txM}}>{nF(x.tSig)}</td><td style={{...tdSt,color:x.tConv>10?CC.grn:x.tConv>0?CC.org:CC.txM}}>{pF(x.tConv)}</td>
            </tr>);})}</tbody>
        </table>
      </div>
      <AIPanel w={w} data={data} wkLabels={wkLabels}/>
    </div>
  );
}

export default function Home(){
  var st=useState("overview"),pg=st[0],setPg=st[1];
  var st2=useState(-1),w=st2[0],setW=st2[1];
  var st3=useState(false),sc=st3[0],setSc=st3[1];
  var st4=useState(null),data=st4[0],setData=st4[1];
  var st5=useState(true),loading=st5[0],setLoading=st5[1];
  var st6=useState(null),error=st6[0],setError=st6[1];

  useEffect(function(){
    fetch("/api/data").then(function(r){return r.json();}).then(function(d){
      if(d.error){setError(d.error);setLoading(false);return;}
      setData(d);setW(d.weeks.length-1);setLoading(false);
    }).catch(function(e){setError(e.message);setLoading(false);});
  },[]);

  if(loading) return(<div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh",background:CC.bg,fontFamily:FF}}><div style={{textAlign:"center"}}><div style={{width:40,height:40,borderRadius:10,background:"linear-gradient(135deg,#2563EB,#7C3AED)",margin:"0 auto 16px",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:800,color:"#fff"}}>LG</div><div style={{fontSize:16,fontWeight:600,color:CC.tx}}>Loading dashboard...</div></div></div>);
  if(error) return(<div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh",background:CC.bg,fontFamily:FF}}><div style={{textAlign:"center",maxWidth:400}}><div style={{fontSize:16,fontWeight:600,color:CC.red,marginBottom:8}}>Error loading data</div><div style={{fontSize:13,color:CC.tx2}}>{error}</div></div></div>);
  if(!data||w<0) return null;

  var wkLabels=data.weeks.map(shortWk);

  return(
    <><Head><title>Lead Gen BUs Performance Dashboard</title><link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap" rel="stylesheet"/></Head>
    <div style={{display:"flex",minHeight:"100vh",background:CC.bg,fontFamily:FF}}>
      {!sc&&(<div style={{width:210,minWidth:210,background:"#fff",borderRight:"1px solid "+CC.bdr,padding:"18px 12px",display:"flex",flexDirection:"column"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,padding:"0 6px",marginBottom:24}}>
          <div style={{width:32,height:32,borderRadius:8,background:"linear-gradient(135deg,#2563EB,#7C3AED)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:800,color:"#fff"}}>LG</div>
          <div><div style={{fontSize:12,fontWeight:800,color:CC.tx,lineHeight:1.2}}>Lead Gen BUs</div><div style={{fontSize:10,color:CC.txM,fontWeight:500}}>Performance Dashboard</div></div>
        </div>
        <div style={{fontSize:10,fontWeight:700,color:CC.txL,letterSpacing:1.1,textTransform:"uppercase",padding:"0 8px",marginBottom:6}}>Dashboard</div>
        <button onClick={function(){setPg("overview");}} style={{display:"flex",alignItems:"center",gap:9,width:"100%",padding:"8px 14px",borderRadius:7,border:"none",background:pg==="overview"?"#EFF6FF":"transparent",color:pg==="overview"?CC.blu:CC.tx2,cursor:"pointer",fontSize:13,fontWeight:pg==="overview"?700:500,fontFamily:FF,textAlign:"left",marginBottom:1}}>Overview</button>
        <div style={{fontSize:10,fontWeight:700,color:CC.txL,letterSpacing:1.1,textTransform:"uppercase",padding:"0 8px",marginTop:14,marginBottom:6}}>Businesses</div>
        {[{id:"lgm",l:"LGM"},{id:"spz",l:"SpringZip"},{id:"ma",l:"MyAccident"}].map(function(item){return(
          <button key={item.id} onClick={function(){setPg(item.id);}} style={{display:"flex",alignItems:"center",gap:9,width:"100%",padding:"7px 12px 7px 28px",borderRadius:7,border:"none",background:pg===item.id?"#EFF6FF":"transparent",color:pg===item.id?CC.blu:CC.tx2,cursor:"pointer",fontSize:13,fontWeight:pg===item.id?700:500,fontFamily:FF,textAlign:"left",marginBottom:1}}>{item.l}</button>
        );})}
        <div style={{flex:1}}/>
      </div>)}
      <div style={{flex:1,overflow:"auto"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 28px",borderBottom:"1px solid "+CC.bdr,background:"#fff",position:"sticky",top:0,zIndex:50}}>
          <button onClick={function(){setSc(!sc);}} style={{background:"none",border:"1px solid "+CC.bdr,borderRadius:6,padding:"4px 8px",cursor:"pointer",color:CC.tx2,fontSize:14}}>☰</button>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:12,color:CC.txM,fontWeight:500}}>Week:</span>
            <select value={w} onChange={function(e){setW(Number(e.target.value));}} style={{background:"#fff",color:CC.tx,border:"1px solid "+CC.bdr,borderRadius:6,padding:"5px 10px",fontSize:12.5,fontWeight:600,fontFamily:FF,cursor:"pointer",outline:"none"}}>
              {wkLabels.map(function(wl,i){return(<option key={i} value={i}>{wl}</option>);})}
            </select>
          </div>
        </div>
        <div style={{padding:"24px 28px 44px",maxWidth:1200}}>
          {pg==="overview"&&<Overview w={w} data={data} wkLabels={wkLabels}/>}
          {pg==="lgm"&&<BizPage name="LGM — Legal Growth Marketing" d={data.lgm} w={w} color={CC.org} showPW={true} wkLabels={wkLabels} states={data.lgmStates}/>}
          {pg==="spz"&&<BizPage name="SpringZip" d={data.spz} w={w} color={CC.org} soldLabel="Sold (excl. LGM)" showPW={true} wkLabels={wkLabels} states={data.spzStates}/>}
          {pg==="ma"&&<MACombined w={w} t1={data.maTier1} t23={data.maTier23} wkLabels={wkLabels} states={data.maStates}/>}
        </div>
      </div>
    </div></>
  );
}
