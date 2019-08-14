import {VuexModule, Module, Mutation, Action} from 'vuex-module-decorators';
import { Module as Modx } from 'vuex';
import axios from 'axios';
import QlogConnectionGroup from "@/data/ConnectionGroup";
import QlogConnection from '@/data/Connection';
import { QlogLoader, PreSpecEventParser } from '@/data/QlogLoader';
import { IQlogRawEvent } from '@/data/QlogEventParser';

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
            alert("Qlog file could not be loaded! " + filename);
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
    public async loadFilesFromServer(parameters:any){

        console.log("ConnectionStore:LoadFilesFromServer ", parameters);

        if ( Object.keys(parameters).length === 0 ){
            // empty parameter, nothing to be fetched
            console.error("ConnectionSTore:LoadFilesFromSErver : no parameters passed, doing nothing. ", parameters);
            
            return;
        }

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

                const fileContents:any = JSON.parse(apireturns.data.qlog); /*= {
                    qlog_version: "0xff00001",
                    connections: [],
                };*/
                const filename = "Loaded via URL parameters";

                this.context.dispatch('addGroupFromQlogFile', {fileContents, filename});
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
        output.title = "None";

        this.grouplist.push( dummyGroup ); 

        return output;
    }
}
