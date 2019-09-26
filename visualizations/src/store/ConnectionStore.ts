import {VuexModule, Module, Mutation, Action} from 'vuex-module-decorators';
import { Module as Modx } from 'vuex';
import axios, {AxiosResponse} from "axios";
import QlogConnectionGroup from "@/data/ConnectionGroup";
import QlogConnection from '@/data/Connection';
import { QlogLoader, PreSpecEventParser } from '@/data/QlogLoader';
import { IQlogRawEvent } from '@/data/QlogEventParser';
import Vue from 'vue';

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
    public async addGroupFromQlogFile( { fileContentsJSON, filename } : { fileContentsJSON:any, filename:string } ){
        
        const group:QlogConnectionGroup | undefined = QlogLoader.fromJSON( fileContentsJSON );

        if ( group !== undefined ){
            group.filename = filename;
            this.context.commit( "addGroup", group );
        }
        else{
            console.error("ConnectionStore:addGroupFromQlogFile : Qlog file could not be parsed!", fileContentsJSON, filename);

            Vue.notify({
                group: "default",
                title: "ERROR parsing qlog file " + filename,
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
        if (queryParameters.file){
            urlToLoad = queryParameters.file;
        }
        else if ( queryParameters.list ){
            urlToLoad = queryParameters.list;
        }
        else if ( queryParameters.file1 ){
            urlToLoad = queryParameters.file1 + " etc.";
        }

        Vue.notify({
            group: "default",
            title: "Loading file(s) via URL",
            text: "Loading files via URL " + urlToLoad + ".<br/>The backend server downloads the files, possibly transforms them into qlog, then sends them back. This can take a while.",
        });

        try{
            let url = '/loadfiles';
             // only for local debugging where we run the servers on different ports
            if ( window.location.toString().indexOf("localhost:8080") >= 0 ){
                url = "https://localhost/loadfiles";
            }
            else if (window.location.toString().indexOf(":8080") >= 0 ){
                // local testing, but with online service
                url = "https://quicvis.edm.uhasselt.be:8443/loadfiles";
            }

            this.context.commit("adjustOutstandingRequestCount", 1 );

            // for documentation on the expected form of these parameters,
            // see https://github.com/quiclog/qvis-server/blob/master/src/controllers/FileFetchController.ts
            const apireturns:any = await axios.get(url, { params: queryParameters });

            this.context.commit("adjustOutstandingRequestCount", -1);

            if ( !apireturns.error && !apireturns.data.error && apireturns.data.qlog ){

                let fileContents:any = {};
                if ( typeof apireturns.data.qlog === "object" ) {
                    fileContents = apireturns.data.qlog; // returned json has multiple fields, the actual qlog is inside the .qlog field
                }
                else {
                    fileContents = JSON.parse(apireturns.data.qlog);
                }
                
                let urlToLoadShort = urlToLoad;
                if ( urlToLoadShort.length > 50 ){
                    urlToLoadShort = urlToLoadShort.substr(0, 25) + "..." + urlToLoadShort.substr( urlToLoadShort.length - 26, urlToLoadShort.length);
                }

                const filename = "Loaded via URL (" + urlToLoadShort + ")";

                this.context.dispatch('addGroupFromQlogFile', {fileContentsJSON: fileContents, filename});

                Vue.notify({
                    group: "default",
                    title: "Loaded files via URL",
                    type: "success",
                    text: "The loaded files are now available for visualization " + urlToLoad + ".<br/>Use the menu above to switch views.",
                });
            }
            else{
                console.error("ConnectionStore:LoadFilesFromServer : ERROR : trace not added to qvis! : ", apireturns.error, apireturns.data.error, apireturns.data.qlog.connections);

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
        this.loadQlogDirectlyFromURL( { url : "standalone_data/draft-01/new_cid.qlog", filename: "DEMO_new_cid.qlog (<1MB)"} );
        this.loadQlogDirectlyFromURL( { url : "standalone_data/draft-01/spin_bit.qlog", filename: "DEMO_spin_bit.qlog (<1MB)"} );
        this.loadQlogDirectlyFromURL( { url : "standalone_data/draft-01/doublevantage_100ms.qlog", filename: "DEMO_double_vantagepoint.qlog (3.1MB)"} );
        this.loadQlogDirectlyFromURL( { url : "standalone_data/draft-00/quictrace_example_github.qlog", filename: "DEMO_quictrace_example.qlog (3.7MB)"} );
    }

    @Action
    public loadQlogDirectlyFromURL( { url, filename } : { url:any, filename:string } ) {

        Vue.notify({
            group: "default",
            title: "Loading qlog file directly",
            text: "Loading qlog file \"" + filename + "\" from URL " + url + ". Large files can take a while to load.",
        });

        this.context.commit("adjustOutstandingRequestCount", 1 );

        axios.get( url, {responseType: "json"} )
        .then( (res:AxiosResponse<any> ) => {

            this.context.commit("adjustOutstandingRequestCount", -1 );

            const fileContents:any = res.data;

            if ( fileContents && !fileContents.error && fileContents.qlog_version ){
                this.context.dispatch('addGroupFromQlogFile', {fileContentsJSON: fileContents, filename});

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
        .catch( (e) => {
            this.context.commit("adjustOutstandingRequestCount", -1 );
            
            Vue.notify({
                group: "default",
                title: "ERROR loading " + filename,
                type: "error",
                duration: 6000,
                text: "This file could not be loaded from " + url + ".<br/>View the devtools JavaScript console for more information. " + e,
            });
        })
    }
}
