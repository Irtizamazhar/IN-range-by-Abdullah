/** Read-only live geographic acceptance. Never prints keys, tokens, URLs or private configuration. */
import nextEnv from '@next/env';
nextEnv.loadEnvConfig(process.cwd(), true, {info(){},error(){}});
const {searchServiceLocations,verifyPlace}=await import('../lib/service-locations.ts');
const wait=()=>new Promise(r=>setTimeout(r,350));
let calls=0;
async function search(query,city){await wait();calls++;const rows=await searchServiceLocations(query,city);for(const row of rows)verifyPlace(row,city?.id||null);console.log(JSON.stringify({query,selectedCity:city?.name||null,accepted:rows.map(r=>({name:r.name,kind:r.kind,sourceId:r.id,proof:r.proof.method})),supported:rows.length>0}));return rows}
try{
 const lahore=(await search('Lahore')).find(r=>r.name==='Lahore');
 if(!lahore)throw Error('Verified Lahore unavailable');
 if(lahore){const johar=await search('Johar Town',lahore);if(!johar.length)throw Error('Verified Johar Town unavailable');if(johar.some(r=>r.name!=='Johar Town'))throw Error('Unrelated Johar Town result accepted');const dha=await search('DHA',lahore);if(dha.some(r=>r.name==='Walled City of Lahore'))throw Error('DHA regression');await search('Gulberg',lahore);const other=(await search('Rawalpindi')).find(r=>r.name==='Rawalpindi');if(other){const cross=await search('Johar Town',other);if(cross.some(r=>johar.some(j=>j.id===r.id)))throw Error('Cross-city result admitted')}}
 const cant=(await search('Lahore Cant')).find(r=>r.name==='Lahore Cant');if(cant)await search('Gulberg',cant);
 for(const city of (process.argv.includes('--quick')?['Wah Cantt','Wah Cantonment']:['Islamabad','Rawalpindi','Karachi','Faisalabad','Peshawar','Multan','Sialkot','Abbottabad','Wah Cantt','Swabi'])){const rows=await search(city);if(rows.some(r=>/\b(?:Tehsil|Division|District)\b/i.test(r.name)))throw Error('Administrative division admitted as city')}
 console.log(JSON.stringify({status:'completed',searches:calls,note:'Empty results mean unsupported or uncorroborated source evidence, not invented fallback coverage.'}));
}catch(error){console.error(JSON.stringify({status:'failed',safeMessage:error?.name==='ApiError'?error.message:'Acceptance assertion or provider check failed; credentials withheld'}));process.exitCode=1}
