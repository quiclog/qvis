import {VuexModule, Module, Mutation, Action} from 'vuex-module-decorators'
import { Module as Modx } from 'vuex'
import QlogConnectionGroup from "@/data/ConnectionGroup";
import QlogConnection from '@/data/Connection';
import QlogEvent from '@/data/Event';

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
