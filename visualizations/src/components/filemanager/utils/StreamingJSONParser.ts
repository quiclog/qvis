import oboe from "oboe"; 

interface DeduplicationContext {
    JSONroot:any,
    currentDepth:number,
}

export default class StreamingJSONParser {

    // this expects to get a valid qlog-formatted string and parses it to JSON format
    // we don't directly use JSON.parse since the qlog string might not be valid JSON in and of itself (e.g., missing closing brackets)
    public static parseQlogText( text:string, streamOnlyAsFallback:boolean = true ):any {

        // by default, first tries to use JSON.parse (because it's more performant)
        // Falls back to a streaming parser in case JSON.parse produces errors (e.g., file wasn't closed correctly)

        if ( streamOnlyAsFallback ) {
            try { 
                return JSON.parse( text );
            }
            catch (e) {
                console.error("StreamingJSONParser:parse : JSON.parse returned an error, trying again with oboe.js fallback parser! Error was: : ", e);

                return StreamingJSONParser.parseQlogText( text, false );
            }
        }
        else {

            let finalOutput:any = undefined;
            let cleanExit = false;

            // if there are event entries after the closing of the file (e.g., the closing brackets are written by thread 1, then thread 2 writes more events)
            // the oboe parser will start generating a new root, which is not exactly the one we want (the old one is typically better)
            // As long as we're parsing normally, the original root shouldn't change
            // so we track that one and then, if there are errors, compare it with the latest one and pick the most likely candidate
            let initialRoot:any = undefined;

            const oboeStream = oboe()
                // .node({
                //     'node:*': ( node:any, path:any ) => {
                //         return node; // successful parse just gives us the value, which we can return, is gathered correctly by oboe
                //     },
                // })

                .on('node:*', (node:any, path:Array<any>, ancestors:any) => {

                    if ( !initialRoot ) {
                        initialRoot = oboeStream.root();
                    }

                    // console.log("Node parsed", oboeStream.root());

                    return node;
                })
                .done( (output:any) => {
                    finalOutput = output;
                    cleanExit = true;
                })
                .fail( (errorReport:any ) => {
                    // any fails will get here, and we can ignore them for the final output
                    console.error( "StreamingJSONParser: There were errors in your qlog/JSON file. It was parsed with the fallback parser up until the point of the error.", errorReport, oboeStream.root() );
                
                    let initialLength = 0;
                    let currentLength = 0;

                    const currentRoot = oboeStream.root();

                    if ( initialRoot && initialRoot.traces && initialRoot.traces.length && initialRoot.traces.length > 0 && initialRoot.traces[0].events && initialRoot.traces[0].events.length > 0 ) {
                        initialLength = initialRoot.traces[0].events.length;
                    }

                    if ( currentRoot && currentRoot.traces && currentRoot.traces.length && currentRoot.traces.length > 0 && currentRoot.traces[0].events && currentRoot.traces[0].events.length > 0 ) {
                        currentLength = currentRoot.traces[0].events.length;
                    }

                    if ( currentLength >= initialLength ) {
                        finalOutput = currentRoot;
                    }
                    else {
                        finalOutput = initialRoot;
                    }

                });

            oboeStream.emit('data', text);

            // so, it depends on what's wrong with the input file what we get
            // if the JSON simply isn't properly closed, the done() callback never fires (neither does fail())
            // fail() mainly seems to fire when we have an error in the middle of the file instead of at the end
            //  -> parsing then also only goes so far and stops there 
            // this means we get here after the emit() call and have to figure out if it worked or not. 
            // we use oboeStream.root() to get the parsed JSON up to this point (because finalOutput is probably not set)

            if ( cleanExit ) {
                // assume all is up to snuff, just return the output
                return finalOutput;
            }
            else {

                if ( !finalOutput ) {
                    finalOutput = oboeStream.root();
                }

                // oboe parses field-by-field, so if the JSON is cut off after some fields but not enough to form a full qlog event, it still fails...
                // (in other words: we have valid JSON, but not valid qlog)
                // so, need to make sure our events are of proper shape (each event_field is present)
                // this is probably not enough to deal with all problems, but should be ok for most

                if ( finalOutput.traces ) {
                    for ( const trace of finalOutput.traces ) {
                        if ( trace.event_fields ) {
                            const eventFieldsLength = trace.event_fields.length;

                            if ( trace.events ) {
                                const eventCount = trace.events.length;

                                for ( let i = eventCount - 1; i >= 0; --i ){
                                    if ( trace.events[i].length !== eventFieldsLength ) {
                                        const removed = trace.events.pop();
                                        console.error("StreamingJSONParser: incomplete event found, ignored in output.", removed);
                                    }
                                }
                            }
                        }
                    }
                }

                return finalOutput;
            }
        }
    }

    // this expects raw JSON of any format and de-duplicates its key entries
    // main use-case is for loading wireshark/tshark JSON packet captures, since those often contain duplicate keys
    public static parseJSONWithDeduplication( text:string ) {

        const context:DeduplicationContext = {
            JSONroot:undefined,
            currentDepth:0,
        };

        const oboeStream = oboe()
            .on('node:*', (node:any, path:Array<any>, ancestors:any) => {

                return StreamingJSONParser.onFieldParsed( context, node, path );
            })
            .done( (output:any) => {
                console.log( "Result from deduped parser (which we will discard) :", output );
            })
            .fail( (errorReport:any ) => {
                // any fails will get here, and we can ignore them for the final output
                console.log( "Oboe failed, ignoring", errorReport  );
            });

        oboeStream.emit('data', text);

        return context.JSONroot;
    }

    // this is some of the worst code I've ever written,
    // took me two days of nightmare filled debugging on many different input files
    // this can probably be cleaned up considerably, but I was just so happy to finally find something that works that I didn't have the heart for it.
    // This is custom de-duplication logic highly tied to how oboe.js callbacks provide data about fields that are parsed
    // I wrote this because nowhere on the internet I can seem to find a general-purpose de-duplication algorithm (though some JSON parsing websites do seem to include it...)
    // It was needed because tshark's --no-duplicate-keys option has a bug that sometimes drops data from the output (some of the duplicate key's data is replaced with earlier data)
    protected static onFieldParsed( context:DeduplicationContext, value:any, path :Array<any>) {
        // const currentDepth = context.currentDepth;
        
        if ( !context.JSONroot ) {
            console.log("StreamingJSONparser:onFieldParsed : deciding on root for JSON", value, path, context.JSONroot );
            
            // the real root hasn't been set yet because we don't know if it's an object or an array 
            if ( path[0] === 0 ) {
                context.JSONroot = [];
            }
            else {
                context.JSONroot = {};
            }
        }
            
        // oboe unrolls after parsing a complete object (e.g., first gives us 5, 5, then 4, 3, then 5, 5 again 
        // so keep track of the previous depth and only start adding new arrays if we are at that depth or lower 
        const previousDepth = context.currentDepth;
        context.currentDepth = path.length;
        
        if ( context.currentDepth < previousDepth ) {
            return; // nothing to add, simply cascading back up, only needed to set previousDepth to know that 
        }
        
        
        // 2 phases: first move towards the current root, then start adding logic 
        // -2 because depth is the length, so -1 is the last element. We want the one before that 
        const currentRootIndex = previousDepth - 2;
        // if ( currentDepth === previousDepth )
        // 	currentRootIndex -= 1; // need to move one back because new one is still adding 
        
        // console.log("Looking for root at index", currentRootIndex, path, JSON.stringify(JSONroot));
        
        let root = context.JSONroot;
        
        for ( let i = 0; i <= currentRootIndex; ++i ) {
            const currentKey = path[i];
            
            const nextPathElementIsArrayIndex = (typeof path[ i + 1 ] === "number");
            
            // console.log("current key", currentKey, JSON.stringify(root) );
            
            // dichotomy:
            // we both have arrays inside the json we want to keep, and duplicate keys that we want to make into arrays ourselves
            // the first type we want to keep the array as a root, the second we want to advanced beyond the array... 
            
            if ( Array.isArray(root[currentKey]) ) {
                
                if ( !nextPathElementIsArrayIndex ) {
                    root = root[currentKey][ root[currentKey].length - 1 ];
                }
                else {
                    root = root[currentKey];
                }
            }
            else {
                root = root[currentKey];
            }
        }
        
        // console.log("Current root found is", currentRootIndex, path, JSON.stringify(root) );
        
        const pathStartIndex = Math.max(0, currentRootIndex + 1);
        
        if ( pathStartIndex >= path.length ) {
            console.error("StreamingJSONParser: Path isn't long enough to encompass new entry, shouldn't happen!", pathStartIndex, path);

            return;
        }
        
        for ( let i = pathStartIndex; i < path.length; ++i ) {
        
            const isFinalElement = i === path.length - 1;
            const currentKey = path[i];
            
            const nextPathElementIsArrayIndex = !isFinalElement && (typeof path[ i + 1 ] === "number");
            
            
            // console.log("-".repeat(i) + "Adding as final element?", isFinalElement, JSON.stringify(root));
            
            if ( Array.isArray(root[currentKey]) ){ // we've seen it before and it's already an array, so we need to append to the array (3 or more items of the same type)
                
                if ( isFinalElement ) {
                    root[currentKey].push( value );
                }
                else {
                    if ( nextPathElementIsArrayIndex ) {
                        root[currentKey].push( [] );
                    }
                    else {
                        root[currentKey].push( {} );
                    }
                }

                root = root[currentKey][ root[currentKey].length - 1 ];
                
                // console.log("-".repeat(i) + "Current key was array, pushed now:", currentKey, JSON.stringify(JSONroot) );
            }
            else if ( !root.hasOwnProperty(currentKey) ) { // first time we see this thing
                
                if ( !isFinalElement ) {
                    if (nextPathElementIsArrayIndex ) {
                        root[currentKey] = [];
                    }
                    else {
                        root[currentKey] = {};
                    }
                }
                else {
                    root[currentKey] = value;
                }
                
                root = root[currentKey];
            
                // console.log("-".repeat(i) + "Current key was unknown object, added now:", currentKey, JSON.stringify(JSONroot));
            }
            else { // second time we see this thing: need to create an array for it 
                
                // console.log("-".repeat(i) + "Current key has to be added to a new array", currentKey, root);
                
                const curValue = root[currentKey];
                root[currentKey] = [];
                root[currentKey].push( curValue );
                
                if ( isFinalElement ) {
                    root[currentKey].push( value );
                }
                else {
                    root[currentKey].push( {} );
                }
                
                root = root[currentKey][ root[currentKey].length - 1 ];
            }
        }
        
        // && value because sometimes the value is null/undefined in the JSON and that is a valid value, believe it or not 
        if ( !root && value ) {
            console.error("StreamingJSONParser: WEIRD STUFF", root, path, context.JSONroot);
        }
        
        return value;

    }
}
