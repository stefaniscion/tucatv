export function browserNetworkError(error){
 if(error?.name==='TimeoutError'||error?.name==='AbortError')return Error('Tempo di attesa scaduto. Controlla la connessione e riprova.');
 if(error instanceof TypeError||error?.name==='NetworkError')return Error('Il browser non riesce a scaricare la playlist. La causa può essere la connessione, un certificato non valido oppure i permessi CORS della sorgente. Apri il link in una nuova scheda, salva il file M3U e importalo da «Carica file», oppure usa l’app installata.');
 return error;
}
export async function playlistResponse(url,{pageProtocol=location.protocol,fetcher=fetch}={}){
 if(pageProtocol==='https:'&&new URL(url).protocol==='http:')throw Error('Questo link usa HTTP: il browser non può scaricarlo dalla pagina HTTPS di TucaTV. Apri il link in una nuova scheda e salva il file M3U, poi usa «Carica file». In alternativa importa il link nell’app installata.');
 try{const response=await fetcher(url,{signal:AbortSignal.timeout(120000)});if(!response.ok)throw Error('La sorgente ha risposto con errore HTTP '+response.status+'. Verifica che il link sia valido e l’accesso autorizzato.');return response;}catch(error){throw browserNetworkError(error);}
}
