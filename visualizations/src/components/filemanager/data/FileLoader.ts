
import StreamingJSONParser from '../utils/StreamingJSONParser';
import TCPToQLOG from "../pcapconverter/tcptoqlog";
import NetlogToQLOG from "../netlogconverter/netlogtoqlog";
import NewlineJSONToQlog from '../newlineconverter/newlinejsontoqlog';
import TextSequenceJSONToQlog from '../newlineconverter/textsequencejsontoqlog';

export interface FileResult {
    qlogJSON: any | undefined,
    error: any | string | undefined
}

export enum FileType {
    qlog_normal, // a normal JSON-formatted qlog file
    qlog_newline, // a newline-delimited JSON file (streaming qlog) : NDJSON format

    qlog_textsequence, // a record separator+newline-delimited JSON file : json-seq format (RFC 7464)

    netlog, // internal JSON-based Chromium logging format
    pcap_json,   // JSON obtained from processing a .pcap with tshark

    // we support other file types as well in qvis, like pcap_binary and pcap_secrets, but those need to be pre-processed by the qvisserver backend first
    // as such, we treat them as "Unsupported" here
    // similarly, in turn we want to support brotli and zip encoded files later on, but not yet
    // for those, we'd add types here and add another decoding step in :Load below

    unclear, // it's a supported JSON file, but we're not sure what type yet
    unsupported,
}

export default class FileLoader {

    public static async Load( rawContents:File|string, name:string ): Promise<FileResult> {
        const loader = new FileLoader();

        const output:FileResult = {
            qlogJSON: undefined,
            error: undefined,
        };

        // 2 main stages:
        // - 1. determine the file type
        //      1.1 either based on file extension
        //      1.2 or on the first part of the file
        // - 2. parse the file and transform to valid qlog JSON

        // 1.
        // Loading a file means we need to figure out what type of file it is first
        // For some, this is easily done just by looking at the extension.
        // For others, one extension can map to a variety of different interpretations of the contents (especially true for .json)
        // for example, since qlog uses JSON formatting, we ideally should accept .json files as valid qlog as well. 

        // This would be easy if we would just treat all files as strings directly (e.g., load from URL)
        // However, for efficiency, we sometimes want to work on the raw File stream instead (e.g., local upload)
        // So, if we are uploading locally, we need to extract the first x-bytes first, then determine how to load the file, then determine how to process it

        // 1.1 so first, try to figure it out purely on extension
        let type:FileType = loader.GuesstimateFileTypeFromExtension( name );

        // file type is unsupported
        if ( type === FileType.unsupported ) {
            throw Error("File extension unsupported: " + name );
        }

        // 1.2 type is (probably) supported, but unclear at this time. We need to derive it from the first few bytes of the file.
        else if ( type === FileType.unclear ) {

            let firstFewCharacters = "";

            // if it's a file stream, read just the first few bytes
            if ( rawContents instanceof File ) {
                firstFewCharacters = await loader.LoadFirstFewCharacters ( rawContents );
            }
            // it's a string already, just get the first few characters directly
            else { 
                firstFewCharacters = rawContents.substring(0, 1024);
            }

            type = loader.GuesstimateFileTypeFromHeader(firstFewCharacters);

            // e.g., it's a JSON file, but doesn't seem to contain valid netlog/qlog/pcap data
            if ( type === FileType.unsupported ) {
                throw Error("File format unsupported (for qlogs, make sure qlog_version and qlog_format are at the top of the file): " + name + " : " + firstFewCharacters);
            }
        }

        console.log("FileLoader:Load : we guess filetype for ", name, "is", FileType[type] );

        // 2. at this point, we know the FileType, now we need to process the file's contents


        let contents:string|ReadableStream<any> = "";

        if ( rawContents instanceof File ) {
            
            if ( type === FileType.qlog_newline || type === FileType.qlog_textsequence ) {
                // for newline delimited qlogs, we have a special streaming parser that can read from a File directly, so prefer that
                contents = new Response(rawContents).body!;
            }
            else {
                contents = await loader.LoadFileAsText( rawContents );
            }
        }
        // it's a string already
        else {
            if ( type === FileType.qlog_newline || type === FileType.qlog_textsequence ) {
                // we only have a streaming parser for this, so even if we have a string, we need to transform it to a stream
                const blob = new Blob([rawContents]);
                contents = new Response(blob).body!;
            }
            else {
                contents = rawContents;
            }
        }

        let contentsJSON:any = undefined;

        if ( type === FileType.qlog_normal ) {
            contentsJSON = StreamingJSONParser.parseQlogText( contents as string );
        }
        else if ( type === FileType.pcap_json ) {
            const rawJSON = StreamingJSONParser.parseJSONWithDeduplication( contents as string );

            contentsJSON = TCPToQLOG.convert( rawJSON );
        } 
        else if ( type === FileType.netlog ) {
            const rawJSON = JSON.parse( contents as string );
            
            contentsJSON = NetlogToQLOG.convert( rawJSON );
        }
        else if ( type === FileType.qlog_newline ) {
            if ( !(contents instanceof ReadableStream) ) {
                console.error("FileLoader:Load : problem loading newline-delimited JSON file: contents wasn't a ReadableStream!", contents);

                throw Error("Could not load NDJSON file from stream : " + name );
            }

            contentsJSON = await NewlineJSONToQlog.convert( contents );
        }
        else if ( type === FileType.qlog_textsequence ) {
            if ( !(contents instanceof ReadableStream) ) {
                console.error("FileLoader:Load : problem loading textsequence JSON file: contents wasn't a ReadableStream!", contents);

                throw Error("Could not load json-seq file from stream : " + name );
            }

            contentsJSON = await TextSequenceJSONToQlog.convert( contents );
            
            if ( contentsJSON === undefined ) {
                console.error("FileLoader:Load : problem loading textsequence JSON file: contents was undefined!", contentsJSON, contents);

                throw Error("Could not load json-seq file from stream : " + name );
            }
        }

        output.qlogJSON = contentsJSON;

        return output;
    }

    protected GuesstimateFileTypeFromExtension( filename:string ) : FileType {

        // note: the .br, .brotli, .gz, .gzip and .zip files are expected to be unzipped/decompressed already at this time
        // however, since they still contain these additions in the extensions, we need to deal with them here
        // we -could- use indexOf instead of .endsWith, but what then with weird people doing things like .qlog.json or .netlog.json etc. 
        // better to be explicit here

        // this works as an allowlist. Everything not listed here is Unsupported by default
        const typeMap:Map<string, FileType> = new Map<string, FileType>([
            // we don't really want to promote the use of these two extensions, so also don't support their compressed versions directly at this time
            [".qlognd",         FileType.qlog_newline],
            [".qlogseq",        FileType.qlog_textsequence],
            [".sqlog",          FileType.qlog_textsequence],
            [".pcap.json",      FileType.pcap_json], // make sure this is before .json to enforce largest-suffix-first logic

            [".netlog",         FileType.netlog],
            [".netlog.br",      FileType.netlog],
            [".netlog.brotli",  FileType.netlog],
            [".netlog.gz",      FileType.netlog],
            [".netlog.gzip",    FileType.netlog],
            [".netlog.zip",     FileType.netlog],

            // qlog and especially JSON are ambiguous and require additional logic to interpret
            [".qlog",           FileType.unclear],
            [".qlog.br",        FileType.unclear],
            [".qlog.brotli",    FileType.unclear],
            [".qlog.gz",        FileType.unclear],
            [".qlog.gzip",      FileType.unclear],
            [".qlog.zip",       FileType.unclear],

            [".json",           FileType.unclear],
            [".json.br",        FileType.unclear],
            [".json.brotli",    FileType.unclear],
            [".json.gz",        FileType.unclear],
            [".json.gzip",      FileType.unclear],
            [".json.zip",       FileType.unclear],
        ]);

        // javascript does not have a Path module (because, y'know, why would it)
        // so have to loop over all and figure out if the extension is in the filename manually

        for ( const extension of typeMap.keys() ) {
            if ( filename.endsWith(extension) ) {
                return typeMap.get(extension)!;
            }
        }
        
        return FileType.unsupported;
    }

    protected GuesstimateFileTypeFromHeader( firstFewCharacters:string ) : FileType {
        // depending on the file type, we expect to find different things in the file "header"

        // .qlog file 
        if ( firstFewCharacters.indexOf("qlog_version") >= 0 ) {
            // two main options:
            // either it's a normal JSON file, or a newline-delimited JSON file
            if ( firstFewCharacters.indexOf("qlog_format") >= 0 ) {
                if ( firstFewCharacters.indexOf("NDJSON") >= 0 ) {
                    return FileType.qlog_newline;
                }
                else if( firstFewCharacters.indexOf("JSON-SEQ") >= 0 ) {
                    return FileType.qlog_textsequence;
                }
                else if ( firstFewCharacters.indexOf("JSON") >= 0 ) {
                    return FileType.qlog_normal;
                }
            }
            else {
                return FileType.qlog_normal; // default for "qlog_format" is "JSON"
            }
        }
        // .netlog file
        else if ( firstFewCharacters.indexOf("activeFieldTrialGroups") >= 0 ){
            return FileType.netlog;
        }
        // packet capture file from tshark
        else if ( firstFewCharacters.indexOf("_source") >= 0 && firstFewCharacters.indexOf("layers") >= 0 ) {
            return FileType.pcap_json;
        }
        // old style qlog files sometimes do not have qlog_version on top, be backwards compatible
        else if ( firstFewCharacters.indexOf("traces") >= 0         || firstFewCharacters.indexOf("event_fields") >= 0 || 
                  firstFewCharacters.indexOf("vantage_point") >= 0  || firstFewCharacters.indexOf("common_fields") >= 0 ) {
            return FileType.qlog_normal;
        }

        return FileType.unsupported;
    }

    // wrapper function mainly to provide a Promisified-interface
    protected LoadFirstFewCharacters( file:File ) : Promise<string> {
        
        let resolver:any = undefined;
        let rejecter:any = undefined;

        const output = new Promise<string>( (resolve, reject) => {
            resolver = resolve;
            rejecter = reject;
        });

        const identifier = new FileReader();

        const firstFewBytes = file.slice(0, 1024); // first 1000 bytes should contain qlog_version

        identifier.onload = (evt) => { 
            const firstFewCharacters = (evt!.target as any).result;

            resolver( firstFewCharacters );
        };

        identifier.onabort = (evt) => { 
            rejecter("File loading aborted: " + file.name + " : " + JSON.stringify(evt) );
        }

        identifier.onerror = (evt) => { 
            rejecter("File loading error: " + file.name + " : " + JSON.stringify(evt) );
        }

        identifier.readAsText(firstFewBytes);

        return output;
    }

    // wrapper function mainly to provide a Promisified-interface
    protected LoadFileAsText( file:File ) : Promise<string> {
        
        let resolver:any = undefined;
        let rejecter:any = undefined;

        const output = new Promise<string>( (resolve, reject) => {
            resolver = resolve;
            rejecter = reject;
        });
        
        const reader = new FileReader();

        reader.onload = (evt) => {
            resolver( (evt!.target as any).result );
        };

        reader.onabort = (evt) => { 
            rejecter("File loading aborted: " + file.name + " : " + JSON.stringify(evt) );
        };

        reader.onerror = (evt) => { 
            rejecter("File loading error: " + file.name + " : " + JSON.stringify(evt) );
        };

        reader.readAsText(file);

        return output;
    }
}
