<template>
    <div class="home">
        <HelloWorld msg="This is the VUE debugger to test reactive data coupling"/>

        <b-button @click="AddRandomConnection()">Add new random ConnectionGroup</b-button> | 
        <b-button @click="DeleteFirstConnection()">Delete First</b-button> | 
        <b-button @click="ChangeConnectionName()">Change Connection Name</b-button> | 
        <b-button @click="ChangeEventName()">Change Event Name</b-button> | 
        <b-button @click="RemoveEvent()">RemoveEvent</b-button>

        <div v-for="connectionGroup in groups" v-bind:key="connectionGroup.description">
            {{ connectionGroup.description }}
        </div>
        <div v-for="(connection, index) in connections" :key="index">
            <div v-for="(event, index) in connection.getEvents()" :key="index">
                - Event: ROBIN : {{ connection.title }} : {{ connection.parseEvent(event).name }}
            </div>
        </div>

    </div>
</template> 

<script lang="ts">
    import { getModule } from "vuex-module-decorators";
    import { Component, Vue } from "vue-property-decorator";
    import HelloWorld from "@/components/HelloWorld.vue";

    import ConnectionStore from "@/store/ConnectionStore";
    import ConnectionGroup from "@/data/ConnectionGroup";

    @Component({
        components: {
            HelloWorld,
        },
    })
    export default class VUEDebug extends Vue {

        protected store:ConnectionStore = getModule(ConnectionStore, this.$store);

        get groups() {
            return this.store.groups;
        }

        get connections() {
            if ( this.store.groups.length > 0 ) {
                return this.store.groups[ this.store.groups.length - 1 ].getConnections();
            }
            else {
                return undefined;
            }
        }

        protected created(){
            // TODO: only here for debug reasons obviously
            if ( this.store.groups.length <= 1 ){
                this.AddRandomConnection();
                this.AddRandomConnection();
                this.AddRandomConnection();
            }
        }

        protected AddRandomConnection() {
            const filename:string = "RandomConnectionGroup " + Math.round(Math.random() * 100);
            this.store.DEBUG_LoadRandomFile( filename ).then((cgroup:ConnectionGroup) => {
                console.log("ConnectionGroup added. This is called AFTER the mutation has been committed to the store!", cgroup);
            });
        }

        protected DeleteFirstConnection() {
            this.store.deleteGroup( this.groups[0] );
        }

        protected ChangeEventName() { 
            this.connections![0].getEvents()[0][2] = "Event was changed";
            console.log("Event name was changed, but SHOULD NOT reflect in UI since events are no longer reactive!", this.connections![0]);
        }

        protected ChangeConnectionName() { 
            this.connections![0].title = "Connection name was changed";
            console.log("Connection name was changed", this.connections![0]);
        }

        protected RemoveEvent() {
            const events = this.connections![0].getEvents();
            events.splice( events.length - 1, 1 );
        }
    } 
</script>
