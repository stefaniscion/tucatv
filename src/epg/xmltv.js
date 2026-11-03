import {SaxesParser} from 'saxes';
export function xmltvDate(value){
 const m=value?.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?\s*([+-]\d{4})?$/);
 return m?Date.parse(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]||'00'}${m[7]?m[7].slice(0,3)+':'+m[7].slice(3):'Z'}`):NaN;
}
// SAX keeps one programme in memory. External entities are never fetched.
export function xmltvParser(onProgramme,{now=Date.now()}={}){
 const parser=new SaxesParser();let depth=0,root=false,programme=null,field='',text='',fieldDepth=0,count=0;
 parser.on('doctype',value=>{if(value.includes('['))throw Error('Invalid or unsupported XMLTV/XZ file.');});
 parser.on('opentag',tag=>{
  depth++;
  if(depth===1){if(tag.name!=='tv')throw Error('Invalid or unsupported XMLTV/XZ file.');root=true;}
  if(depth===2&&tag.name==='programme')programme={channel:tag.attributes.channel||'',start:xmltvDate(tag.attributes.start),end:xmltvDate(tag.attributes.stop),title:'',description:''};
  if(programme&&depth===3&&['title','desc'].includes(tag.name)){field=tag.name;text='';fieldDepth=depth;}
 });
 const append=value=>{if(field){text+=value;if(text.length>32768)throw Error('The guide exceeds the 256 MiB limit or contains an oversized field.');}};
 parser.on('text',append);parser.on('cdata',append);
 parser.on('closetag',tag=>{
  if(field&&depth===fieldDepth){const key=field==='title'?'title':'description';if(!programme[key])programme[key]=text;field='';text='';}
  if(depth===2&&tag.name==='programme'&&programme){
   const p=programme;programme=null;
   if(p.channel&&p.channel.length<=512&&Number.isFinite(p.start)&&p.end>p.start){
    count++;
    // Bound persistent history while retaining all channels and the next two weeks.
    if(p.end>now-86400000&&p.start<now+14*86400000)onProgramme(p);
   }
  }
  depth--;
 });
 return {write:text=>parser.write(text),close(){parser.close();if(!root||!count)throw Error('The guide contains no valid programmes.');return count;}};
}
