import {VuexModule, Module, Mutation, Action} from 'vuex-module-decorators';
import { Module as Modx } from 'vuex';
import axios, {AxiosResponse} from "axios";
import QlogConnectionGroup from "@/data/ConnectionGroup";
import QlogConnection from '@/data/Connection';
import { QlogLoader, PreSpecEventParser } from '@/data/QlogLoader';
import { IQlogRawEvent } from '@/data/QlogEventParser';
import Vue from 'vue';
import TCPToQlog from '@/components/filemanager/pcapconverter/tcptoqlog';
import StreamingJSONParser from '@/components/filemanager/utils/StreamingJSONParser';
import FileLoader from '@/components/filemanager/data/FileLoader';
import NetlogToQlog from '@/components/filemanager/netlogconverter/netlogtoqlog';

@Module({name: 'connections'})
export default class ConnectionStore extends VuexModule {

    // WARNING : do not use an _ to prefix a variable, this doesn't play well with Vue(x) internals!
    protected grouplist:Array<QlogConnectionGroup> = new Array<QlogConnectionGroup>();
    protected outstandingRequests:number = 0;

    public constructor(moduler: Modx<ThisType<{}>, any>){
        super(moduler); 
    }

    get groups(): Array<QlogConnectionGroup> {
        return this.grouplist;
    }

    get outstandingRequestCount(): number {
        return this.outstandingRequests;
    }

    @Mutation
    public adjustOutstandingRequestCount(amount:number) {
        this.outstandingRequests += amount;
    }

    @Mutation
    public addGroup(group:QlogConnectionGroup) {
        console.log("ConnectionStore Mutation for adding group", group);
        this.grouplist.push(group);
    }

    @Mutation
    public deleteGroup(group:QlogConnectionGroup) {
        const index = this.grouplist.indexOf(group);

        if ( index !== -1 ) {
            this.grouplist.splice(index, 1);
        }
    }

    @Action 
    public removeGroup(group:QlogConnectionGroup) {
        this.context.commit( "deleteGroup", group );
    }

    @Action
    // TODO: move this away from here to its own location
    // We need to prepare ways to load QLOG files of various qlog versions and then map them to our internal structs
    // A way to do this is having converters, e.g., Draft17Loader, Draft18Loader etc. that get the fileContents 
    // and that then transform them to our internal classes
    // Downside: we need internal classes for everything...
    // However: if we just always use the latest versions or a single specified version from the @quictools/qlog-schema package,
    // we can just use that internally and convert the rest to that and update when needed
    // Potentially bigger problem: checking if json adheres to the TypeScript spec... 
    // this could be done with something like https://github.com/typestack/class-transformer
    // but then we would need to add additional annotations to the Schema classes... urgh
    public async addGroupFromQlogFile( { fileContentsJSON, fileInfo } : { fileContentsJSON:any, fileInfo:any } ){
        
        const group:QlogConnectionGroup | undefined = QlogLoader.fromJSON( fileContentsJSON );

        if ( group !== undefined ){
            group.filename = fileInfo.filename;
            group.URL = fileInfo.URL;
            group.URLshort = fileInfo.URLshort;
            this.context.commit( "addGroup", group );
        }
        else{
            console.error("ConnectionStore:addGroupFromQlogFile : Qlog file could not be parsed!", fileContentsJSON, fileInfo);

            Vue.notify({
                group: "default",
                title: "ERROR parsing qlog file " + fileInfo.filename,
                type: "error",
                duration: 6000,
                text: "File was successfully loaded but could not be parsed.<br/>Make sure you have a well-formed qlog file.<br/>View the devtools JavaScript console for more information.",
            });
        }
    }

    @Action({commit: 'addGroup'})
    public async DEBUG_LoadRandomFile(filename:string) {
        const testGroup = new QlogConnectionGroup();
        testGroup.description = filename;

        const connectionCount = Math.round(Math.random() * 5) + 1;
        for ( let i = 0; i < connectionCount; ++i ){
            const connectionTest = new QlogConnection(testGroup);
            connectionTest.title = "Connection " + i;

            const events:Array<Array<any>> = new Array<Array<any>>();

            const eventCount = Math.ceil(Math.random() * 3);
            for ( let j = 0; j < eventCount; ++j ){
                events.push( [j, "testcat", "Connection #" + i + " - Event #" + j, "dummytrigger" , { dummy: true }] );
            }

            connectionTest.setEventParser( new PreSpecEventParser() );
            connectionTest.setEvents( events );
        }

        return testGroup;
    }

    @Action
    public async loadFilesFromServer(queryParameters:any){

        console.log("ConnectionStore:LoadFilesFromServer ", queryParameters);

        if ( Object.keys(queryParameters).length === 0 ){
            // empty parameter, nothing to be fetched
            console.log("ConnectionSTore:LoadFilesFromServer : no URL query parameters present, doing nothing. ", queryParameters);

            return;
        }

        let urlToLoad = "";
        let fullURL = undefined;

        if (queryParameters.file){
            urlToLoad = queryParameters.file;
            fullURL = queryParameters.file;
        }
        else if ( queryParameters.list ){
            urlToLoad = queryParameters.list;
        }
        else if ( queryParameters.file1 ){
            // note: adding "etc." to the URL will cause the direct download below to fail.
            // this is intentional: we currently don't yet have support for loading multiple files directly in the browser
            // and have to fallback to the backend for this.
            // TODO: this is probably not the cleanest way of enforcing this... maybe set a bool or something instead? 
            urlToLoad = queryParameters.file1 + " etc.";
        }

        if ( urlToLoad === "" ){
            console.log("ConnectionSTore:LoadFilesFromServer : no file-loading URL query parameters present, doing nothing. ", queryParameters);
            
            return;
        }

        Vue.notify({
            group: "default",
            title: "Loading file(s) via URL",
            text: "Loading files via URL " + urlToLoad + ".<br/>The backend server downloads the files, possibly transforms them into qlog, then sends them back. This can take a while.",
        });


        // We want to deal with normal plaintext .qlog files, implicitly gzip or brotli encoded .qlog files (server sets Content-Encoding header, browser should decompress before it hits JS) 
        //      and explicitly encoded files (.qlog.br and .qlog.brotli and .qlog.gzip and .qlog.zip and .qlog.gz)
        // We also don't want to have to go to our backend server for every file if we don't have to (this is only needed if the server hosting .qlog does not set proper CORS headers)

        // flowchart:
        // 1. If it's a .qlog, try to download it from the server directly (works if CORS is setup correctly)
        //      - if plaintext: just works
        //      - if implicitly encoded with correct Content-Encoding header: works
        //      - if explicitly encoded with correct Content-Encoding header: works
        //      - if implicitly or explicitly encoded without Content-Encoding header: download works, but conversion to JSON fails, falling back to the backend server 
        // 2. If it gives an error (we don't know if it's CORS or not since the browser doesn't expose that), retry again via the backend server
        //      - server will fetch .qlog files, and process .json and .pcap/.keys files etc. via pcap2qlog
        //      - if it's a .qlog.br or .qlog.gz or .qlog.zip file, server will simply serve it with correct Content Encoding, triggering the browser's decompression
        //          - note: if it's an implicitly compressed file, the server will decompress it and send it full-sized over the wire atm... FIXME: should be fixed server-side, but we use wget for downloading, so need to dig deeper there

        let apireturns:any = null;
        let fileContents:any = null;

        try {
            this.context.commit("adjustOutstandingRequestCount", 1 );

            // 1. try direct download first
            if ( urlToLoad.indexOf(".qlog") >= 0 || urlToLoad.indexOf(".sqlog") >= 0 || urlToLoad.indexOf(".netlog") >= 0 || urlToLoad.indexOf(".json") >= 0 ) {
                apireturns = await fetch( urlToLoad );
                if ( apireturns.ok ) { // 200-299 status
                    const txt = await apireturns.text();

                    console.log("ConnectionStore:loadFilesFromServer: successfully loaded file directly: ", urlToLoad, apireturns, txt);

                    const fileResult = await FileLoader.Load( txt, urlToLoad );
                    if ( fileResult.error !== undefined ) {
                        throw fileResult.error;
                    }
                    else {
                        fileContents = fileResult.qlogJSON;
                    }
                }
                else {
                    // we get here for example if it was a 404 instead of CORS error 
                    
                    // TODO: handle this better. Now we have duplicated code here and when handling thrown exceptions
                    // maybe just throw an exception here as well and fallback to the catch()? 
                    this.context.commit('adjustOutstandingRequestCount', -1);

                    console.warn("ConnectionStore:loadFilesFromServer : tried to load qlog from remote server directly but got probable CORS error. Trying again via backend server.", queryParameters, apireturns);
                    apireturns = null;
                }
            }
        }
        catch (e) {
            this.context.commit('adjustOutstandingRequestCount', -1);
            apireturns = null;

            console.warn("ConnectionStore:loadFilesFromServer : tried to load qlog from remote server directly but got probable CORS error. Trying again via backend server.", queryParameters, e);
        }

        try{
            // 2. if it wasn't a .qlog file or we got a (probable) CORS error
            if ( apireturns === null ) {
                let url = '/loadfiles';
                 // only for local debugging where we run the servers on different ports
                if ( window.location.toString().indexOf("localhost:8080") >= 0 ){
                    url = "https://localhost/loadfiles";
                }
                else if (window.location.toString().indexOf(":8080") >= 0 ){
                    // local testing, but with online service
                    url = "https://qvis.quictools.info/loadfiles";
                }

                // url = "https://192.168.220.132:8089/loadfiles"; 
    
                this.context.commit("adjustOutstandingRequestCount", 1 );
    
                // for documentation on the expected form of these parameters,
                // see https://github.com/quiclog/qvis-server/blob/master/src/controllers/FileFetchController.ts
                apireturns = await axios.get(url, { params: queryParameters });
    
                this.context.commit("adjustOutstandingRequestCount", -1);

                if ( apireturns !== null ) {

                    if ( apireturns.qlog_version ) {
                        // directly downloaded qlog file
                        fileContents = StreamingJSONParser.parseQlogText(apireturns);
                    }
                    else if ( !apireturns.error && !apireturns.data.error && (apireturns.data.qlog || apireturns.data) ){
                        let qlogRoot = apireturns.data; // proxied directly downloaded qlog file (.data is from the response object)

                        if ( apireturns.data.qlog ) {
                            qlogRoot = apireturns.data.qlog; // pcap2qlog output has 1 more level of indirection 
                        }

                        if ( qlogRoot.constants && qlogRoot.events && urlToLoad.indexOf(".netlog") >= 0 ) {
                            // 100% sure trace is a netlog trace, already parsed for use, pass it to netlog interpreter directly
                            // needed becaue here qlogRoot is also typeof "object" which messes with other qlog-specific returns from the server
                            console.log("ConnectionStore:loadFilesFromServer: identified file as .netlog, transforming to .qlog", urlToLoad, qlogRoot);

                            fileContents = NetlogToQlog.convert( qlogRoot );
                        }
                        else {
                            if ( typeof qlogRoot === "object" ) {
                                fileContents = qlogRoot; // returned json has multiple fields, the actual qlog is inside the .qlog field
                            }
                            else {                 
                                const fileResult = await FileLoader.Load( qlogRoot, urlToLoad );

                                if ( fileResult.error !== undefined ) {
                                    throw fileResult.error;
                                }
                                else {
                                    fileContents = fileResult.qlogJSON;
                                }
                            }
                        }

                        if ( fileContents.traces && fileContents.traces.length > 0 && fileContents.traces[0].error_description ) {
                            throw Error("Trace had an error: " + JSON.stringify(fileContents));
                        }
                    }
                }
            }

            // 3. we actually got some content, can add it to the store! 
            if ( fileContents !==  null && fileContents.qlog_version !== undefined ) {
                        
                let urlToLoadShort = urlToLoad;
                if ( urlToLoadShort.length > 50 ){
                    urlToLoadShort = urlToLoadShort.substr(0, 25) + "..." + urlToLoadShort.substr( urlToLoadShort.length - 26, urlToLoadShort.length);
                }

                const filename = "Loaded via URL (" + urlToLoadShort + ")";

                const fileInfo:any = { filename: filename };
                if ( fullURL ) {
                    fileInfo.URL = fullURL;

                    if ( fullURL.length > 50 ) {
                        fileInfo.URLshort = fullURL.substr(0, 25) + "..." + fullURL.substr( fullURL.lastIndexOf("/"), fullURL.length );
                    }
                    else {
                        fileInfo.URLshort = fullURL;
                    }
                }

                this.context.dispatch('addGroupFromQlogFile', {fileContentsJSON: fileContents, fileInfo: fileInfo });

                Vue.notify({
                    group: "default",
                    title: "Loaded files via URL",
                    type: "success",
                    text: "The loaded files are now available for visualization " + urlToLoad + ".<br/>Use the menu above to switch views.",
                });
            }
            else{
                console.error("ConnectionStore:LoadFilesFromServer : ERROR : trace not added to qvis! : ", queryParameters, apireturns);

                Vue.notify({
                    group: "default",
                    title: "ERROR loading URL " + urlToLoad,
                    type: "error",
                    duration: 6000,
                    text: "File(s) could not be loaded from " + urlToLoad + ".<br/>View the devtools JavaScript console for more information.",
                });
            }
        }
        catch (e) {
            this.context.commit('adjustOutstandingRequestCount', -1);

            console.error("ConnectionStore:LoadFilesFromServer : ERROR : trace not added to qvis! : ", e, queryParameters);

            Vue.notify({
                group: "default",
                title: "ERROR loading URL " + urlToLoad,
                type: "error",
                duration: 6000,
                text: "File(s) could not be loaded from " + urlToLoad + ".<br/>View the devtools JavaScript console for more information.",
            });
        }
    }

    // we put this here because we want to load Demo files outside of the FileManager as well (so we don't always have to switch when testing)
    @Action
    public loadExamplesForDemo() {
        // this.loadQlogDirectlyFromURL( { url : "standalone_data/draft-01/5stream_from_chrome.qlog", filename: "DEMO_5streams.qlog"} );
        // this.loadQlogDirectlyFromURL( { url : "standalone_data/draft-01/10paralllel_aioquic.qlog", filename: "DEMO_10stream_aioquic.qlog"} );
        // this.loadQlogDirectlyFromURL( { url : "standalone_data/draft-01/10paralllel_litespeed.qlog", filename: "DEMO_10stream_multiplexing.qlog (14.6MB)"} );

        this.loadQlogDirectlyFromURL( { url : "standalone_data/draft-01/new_cid.qlog", filename: "DEMO_new_cid.qlog (<1MB)"} );
        this.loadQlogDirectlyFromURL( { url : "standalone_data/draft-01/spin_bit.qlog", filename: "DEMO_spin_bit.qlog (<1MB)"} );
        this.loadQlogDirectlyFromURL( { url : "standalone_data/draft-01/parallel_10_50KB_f5.qlog", filename: "DEMO_10_parallel_streams.qlog (<1MB)"} );
        this.loadQlogDirectlyFromURL( { url : "standalone_data/draft-01/doublevantage_100ms.qlog", filename: "DEMO_double_vantagepoint.qlog (3.1MB)"} );
        this.loadQlogDirectlyFromURL( { url : "standalone_data/draft-00/quictrace_example_github.qlog", filename: "DEMO_quictrace_example.qlog (3.7MB)"} );

        // this.loadQlogDirectlyFromURL( { url : "standalone_data/tcp/cdninstagram-com_rachelbrosnahan.json", filename: "DEMO_instagram_rachelbrosnahan (4MB)"} );
        // this.loadQlogDirectlyFromURL( { url : "standalone_data/tcp/wikipedia_Playstation.json", filename: "DEMO_wikipedia_playstation (4MB)"} );
        // this.loadQlogDirectlyFromURL( { url : "standalone_data/tcp/instagram-com_uhasselt.json", filename: "DEMO_instagram_uhasselt (31MB)"} );
        // this.loadQlogDirectlyFromURL( { url : "standalone_data/tcp/output3.json", filename: "DEMO_paddingtest (4MB)"} );
        
        
    }

    @Action
    public loadQlogDirectlyFromURL( { url, filename } : { url:any, filename:string } ) {

        Vue.notify({
            group: "default",
            title: "Loading qlog file directly",
            text: "Loading qlog file \"" + filename + "\" from URL " + url + ". Large files can take a while to load.",
        });

        this.context.commit("adjustOutstandingRequestCount", 1 );

        axios.get( url, {responseType: "text", transformResponse: undefined} ) // transformResponse needed because responseType 'text' doesn't prevent them from parsing JSON...
        .then( (res:AxiosResponse<any> ) => {

            this.context.commit("adjustOutstandingRequestCount", -1 );

            const fileContentsRaw:any = res.data;

            let fileContents:any = StreamingJSONParser.parseQlogText( fileContentsRaw );

            if ( fileContents && !fileContents.error && !fileContents.error_description && fileContents.qlog_version ){
                this.context.dispatch('addGroupFromQlogFile', {fileContentsJSON: fileContents, fileInfo: { filename:filename }});

                Vue.notify({
                    group: "default",
                    title: "Loaded " + filename,
                    type: "success",
                    text: "This file is now available for visualization, use the menu above to switch views.",
                });
            }
            else if ( fileContents.length > 0 && fileContents[0]._source ){
                // pcap .json loaded

                // was already parsed, but potentially the file had duplicate keys that we missed with normal JSON.parse
                // this is because wireshark's default JSON output has duplicate keys and even tshark output with --no-duplicate-keys has bugs
                // so we have to deal with this manually here
                fileContents = StreamingJSONParser.parseJSONWithDeduplication( fileContentsRaw );

                const convertedContents = TCPToQlog.convert( fileContents );
                this.context.dispatch('addGroupFromQlogFile', {fileContentsJSON: convertedContents, fileInfo: {filename: filename}});

                Vue.notify({
                    group: "default",
                    title: "Loaded " + filename,
                    type: "success",
                    text: "This file is now available for visualization, use the menu above to switch views.",
                });

            }
            else{
                console.error("FileManagerContainer:loadDirectlyFromURL: error downloading file : ", url, res);
                
                Vue.notify({
                    group: "default",
                    title: "ERROR loading " + filename,
                    type: "error",
                    duration: 6000,
                    text: "This file could not be loaded from " + url + ".<br/>View the devtools JavaScript console for more information.",
                });
            }
        })  
        // .catch( (e) => {
        //     this.context.commit("adjustOutstandingRequestCount", -1 );
            
        //     Vue.notify({
        //         group: "default",
        //         title: "ERROR loading " + filename,
        //         type: "error",
        //         duration: 6000,
        //         text: "This file could not be loaded from " + url + ".<br/>View the devtools JavaScript console for more information. " + e,
        //     });
        // })
    }
}
