import {VuexModule, Module, Mutation, Action} from 'vuex-module-decorators';
import { Module as Modx } from 'vuex';
import axios from 'axios';
import QlogConnectionGroup from "@/data/ConnectionGroup";
import QlogConnection from '@/data/Connection';
import QlogEvent from '@/data/Event';

import * as qlog from '@quictools/qlog-schema'; 
// import * as qlog from '@quictools/qlog-schema/dist/draft-16/QLog'; 
import { QUtil } from '@quictools/qlog-schema/util'; 
// import * as qlog from '/home/rmarx/WORK/QUICLOG/qlog-schema/trunk/TypeScript' 
// import { QUtil } from '/home/rmarx/WORK/QUICLOG/qlog-schema/trunk/TypeScript/util'; 

@Module({name: 'connections'})
export default class ConnectionStore extends VuexModule {

    protected grouplist:Array<QlogConnectionGroup> = new Array<QlogConnectionGroup>();
    protected dummyConnection!:QlogConnection;

    public constructor(moduler: Modx<ThisType<{}>, any>){
        super(moduler); 
        this.dummyConnection = this.createDummyConnection(); 
    }

    get groups(): Array<QlogConnectionGroup> {
        return this.grouplist;
    }

    @Mutation
    public AddGroup(group:QlogConnectionGroup) {
        console.log("ConnectionStore Mutation for adding group", group);
        this.grouplist.push(group);
    }

    @Mutation
    public DeleteGroup(group:QlogConnectionGroup) {
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
    public async AddGroupFromQlogFile( { fileContents, filename } : { fileContents:qlog.IQLog, filename:string } ){
        console.log("AddGroupFromQlogFile", fileContents, fileContents.connections);

        // QLog toplevel structure contains a list of connections
        // most files currently just contain a single connection, but the idea is to allow bundling connections on a single file
        // for example 1 log for the server and 1 for the client and 1 for the network, all contained in 1 file
        // This is why we call it a ConnectionGroup here, instead of QlogFile or something 
        const group = new QlogConnectionGroup();
        group.description = fileContents.description || "";
        group.title = filename;

        for ( const jsonconnection of fileContents.connections ){

            const connection = new QlogConnection(group);

            // metadata can be just a string, so use that
            // OR it can be a full object, in which case we want just the description here 
            let description = "";
            if ( jsonconnection.metadata ){
                if ( typeof jsonconnection.metadata === "string" ){
                    description = jsonconnection.metadata;
                }
                else if ( jsonconnection.metadata.description ){ // can be empty object {}
                    description = jsonconnection.metadata.description;
                }
            }
                
            connection.name = jsonconnection.vantagepoint + " : " + description;
            const wrap = QUtil.WrapEvent(null);

            for ( const jsonevt of jsonconnection.events ){
                wrap.evt = jsonevt;

                const evt2:QlogEvent = new QlogEvent();
                evt2.time       = wrap.time;
                evt2.category   = wrap.category; 
                evt2.name       = wrap.type;
                evt2.trigger    = wrap.trigger;
                evt2.data       = wrap.data;

                connection.AddEvent(evt2);
            }
        }

        this.context.commit( "AddGroup", group );
    }

    @Action({commit: 'AddGroup'})
    public async DEBUG_LoadRandomFile(filename:string) {
        const testGroup = new QlogConnectionGroup();
        testGroup.description = filename;

        const connectionCount = Math.round(Math.random() * 5) + 1;
        for ( let i = 0; i < connectionCount; ++i ){
            const connectionTest = new QlogConnection(testGroup);
            connectionTest.name = "Connection " + i;

            const eventCount = Math.ceil(Math.random() * 3);
            for ( let j = 0; j < eventCount; ++j ){
                const eventTest = new QlogEvent();
                eventTest.name = "Connection #" + i + " - Event #" + j;
                connectionTest.AddEvent( eventTest );
            }
        }

        return testGroup;
    }

    @Action
    public async LoadFilesFromServer(parameters:any){

        console.log("ConnectionStore:LoadFilesFromServer ", parameters);

        try{
            let url = '/loadfiles';
             // only for local debugging where we run the servers on different ports
            if ( window.location.toString().indexOf("localhost:8080") >= 0 ){
                url = "https://localhost/loadfiles";
            }

            // for documentation on the expected form of these parameters,
            // see https://github.com/quiclog/qvis-server/blob/master/src/controllers/FileFetchController.ts
            const apireturns:any = await axios.get(url, { params: parameters });

            if ( !apireturns.error && !apireturns.data.error && apireturns.data.qlog ){

                const fileContents:qlog.IQLog = JSON.parse(apireturns.data.qlog); /*= {
                    qlog_version: "0xff00001",
                    connections: [],
                };*/
                const filename = "Loaded via URL parameters";

                this.context.dispatch('AddGroupFromQlogFile', {fileContents, filename});
            }
            else{
                alert("ConnectionStore:LoadFilesFromServer : " + apireturns.error + " // " + apireturns.data.error + " // " + apireturns.data.qlog.connections);
            }
        }
        catch (e) {
            alert("ConnectionStore:LoadFilesFromServer : " + e);
        }
    }
    
    protected createDummyConnection() : QlogConnection{

        // We need a way to represent an empty connection in the UI
        // We can do this with a null-value but that requires us to check for NULL everywhere...
        // We chose the option of providing an empty dummy connection instead, that has no events and minimal other metadata

        const dummyGroup:QlogConnectionGroup = new QlogConnectionGroup();
        dummyGroup.description = "None";
        dummyGroup.title = "None";

        const output:QlogConnection = new QlogConnection(dummyGroup);
        output.name = "None";

        this.grouplist.push( dummyGroup ); 

        return output;
    }
}
