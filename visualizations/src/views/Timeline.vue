<template>
    <div class="home">
        <HelloWorld msg="This is the timeline view"/>

        <b-button @click="AddRandomConnection()">Add new random ConnectionGroup</b-button> | 
        <b-button @click="DeleteFirstConnection()">Delete First</b-button> | 
        <b-button @click="ChangeEventName()">Change Name</b-button> | 
        <b-button @click="RemoveEvent()">RemoveEvent</b-button>

        <div v-for="connectionGroup in groups" v-bind:key="connectionGroup.description">
            {{ connectionGroup.description }}
        </div>
        <div v-for="(connection, index) in connections" :key="index">
            <div v-for="(event, index) in connection.GetEvents()" :key="index">
                - Event: {{ event.name }}
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
    export default class Timeline extends Vue {

        protected store:ConnectionStore = getModule(ConnectionStore, this.$store);

        get groups() {
            return this.store.groups;
        }

        get connections() {
            if ( this.store.groups.length > 0 ) {
                return this.store.groups[ this.store.groups.length - 1 ].GetConnections();
            }
            else {
                return undefined;
            }
        }

        protected AddRandomConnection() {
            const filename:string = "RandomConnectionGroup " + Math.round(Math.random() * 100);
            this.store.DEBUG_LoadRandomFile( filename ).then((cgroup:ConnectionGroup) => {
                console.log("ConnectionGroup added. This is called AFTER the mutation has been committed to the store!", cgroup);
            });
        }

        protected DeleteFirstConnection() {
            this.store.DeleteGroup( this.groups[0] );
        }

        protected ChangeEventName() { 
            this.connections![0].GetEvents()[0].name = "Event was changed";
        }

        protected RemoveEvent() {
            const events = this.connections![0].GetEvents();
            events.splice( events.length - 1, 1 );
        }
    } 
</script>
