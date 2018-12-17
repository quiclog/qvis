import {VuexModule, Module, Mutation, Action} from 'vuex-module-decorators'
import QlogConnectionGroup from "@/data/ConnectionGroup";
import QlogConnection from '@/data/Connection';
import QlogEvent from '@/data/Event';

@Module({name: 'connections'})
export default class ConnectionStore extends VuexModule {

    public grouplist:Array<QlogConnectionGroup> = new Array<QlogConnectionGroup>();

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

        let connectionCount = Math.round(Math.random() * 5);
        for( let i = 0; i < connectionCount; ++i ){
            const connectionTest = new QlogConnection(testGroup);
            testGroup.AddConnection( connectionTest );

            let eventCount = Math.ceil(Math.random() * 3);
            for( let j = 0; j < eventCount; ++j ){
                const eventTest = new QlogEvent();
                eventTest.name = "Connection #" + i + " - Event #" + j;
                connectionTest.AddEvent( eventTest );
            }
        }

        return testGroup;
    }
    
}
