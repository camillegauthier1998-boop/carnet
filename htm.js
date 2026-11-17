(function(){
const M='\u0001';
function htm(statics){
  const h=this;const fields=Array.prototype.slice.call(arguments,1);
  let s='';for(let k=0;k<statics.length;k++){s+=statics[k];if(k<fields.length)s+=M+k+M;}
  const re=new RegExp(M+'(\\d+)'+M,'g');
  const val=str=>{const m=str.match(new RegExp('^'+M+'(\\d+)'+M+'$'));if(m)return fields[+m[1]];
    if(!str.includes(M))return str;return str.replace(re,(_,n)=>fields[+n]);};
  let i=0;const stack=[{t:null,p:null,c:[]}];
  const pushText=txt=>{ if(txt.includes('\n'))txt=txt.replace(/^\s*\n\s*|\s*\n\s*$/g,''); if(!txt)return;
    let last=0,m;re.lastIndex=0;const top=stack[stack.length-1];
    while((m=re.exec(txt))){ if(m.index>last)top.c.push(txt.slice(last,m.index)); top.c.push(fields[+m[1]]); last=re.lastIndex;}
    if(last<txt.length)top.c.push(txt.slice(last)); };
  while(i<s.length){
    const lt=s.indexOf('<',i);
    if(lt<0){pushText(s.slice(i));break;}
    if(lt>i)pushText(s.slice(i,lt));
    i=lt+1;
    if(s.startsWith('!--',i)){i=s.indexOf('-->',i)+3;continue;}
    if(s[i]==='/'){ i=s.indexOf('>',i)+1; const el=stack.pop();
      const node=h.apply(null,[el.t,el.p].concat(el.c)); stack[stack.length-1].c.push(node); continue;}
    let j=i;while(j<s.length&&!/[\s\/>]/.test(s[j]))j++;
    let tname=val(s.slice(i,j));i=j;let props=null;let self=false;
    for(;;){
      while(i<s.length&&/\s/.test(s[i]))i++;
      if(s[i]==='>'){i++;break;}
      if(s[i]==='/'&&s[i+1]==='>'){i+=2;self=true;break;}
      if(s.startsWith('...',i)){ i+=3;let k=i;while(k<s.length&&!/[\s\/>]/.test(s[k]))k++; props=Object.assign(props||{},val(s.slice(i,k)));i=k;continue;}
      let k=i;while(k<s.length&&!/[\s=\/>]/.test(s[k]))k++;
      const name=s.slice(i,k);i=k;
      if(s[i]==='='){ i++; let v;
        if(s[i]==='"'||s[i]==="'"){const q=s[i];const e=s.indexOf(q,i+1);v=val(s.slice(i+1,e));i=e+1;}
        else{let e=i;while(e<s.length&&!/[\s>]/.test(s[e])&&!(s[e]==='/'&&s[e+1]==='>'))e++;v=val(s.slice(i,e));i=e;}
        (props=props||{})[name]=v;
      } else (props=props||{})[name]=true;
    }
    if(self){ stack[stack.length-1].c.push(h(tname,props)); }
    else stack.push({t:tname,p:props,c:[]});
  }
  const kids=stack[0].c;return kids.length>1?kids:kids[0];
}
window.htm=htm;
})();
