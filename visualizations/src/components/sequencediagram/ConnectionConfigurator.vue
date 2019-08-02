<template>
    <b-col style="background-color: white; color: black; border: black 1px solid; max-width: 50%;">
        <b-container fluid>
            <div v-if="tooManyOptions">
                <!-- separate-select mode -->
                <!--<div>{{selectedGroup.filename}} - {{selectedGroup.description}}</div> -->
                <b-form-select v-model="selectedGroup" :options="groupOptions" @change="onGroupSelectionChanged" class="mb-3" />

                <!--<div>{{selectedConnection.events.length}} - {{selectedConnection.parent.description}}</div> -->
                <b-form-select v-model="selectedConnection" :options="connectionOptions" @change="onConnectionSelectionChanged" class="mb-3" />
            
                <b-button v-if="canBeRemoved" @click="removeMyself">&minus;</b-button> 
            </div>

            <div v-else>
                <!-- combined-select mode -->
                <div>{{selectedConnection.parent.filename}} ({{selectedConnection.parent.description}})</div>
                <b-row class="mb-3">
                    <b-col><b-form-select v-model="selectedConnection" :options="combinedOptions" @change="onConnectionSelectionChanged"  /></b-col>
                    <b-col v-if="canBeRemoved" cols="auto" class="px-0"><b-button @click="removeMyself">&minus;</b-button></b-col> 
                </b-row>
            </div>
        
        </b-container>
    </b-col>
</template> 

<script lang="ts">
    import { getModule } from "vuex-module-decorators";
    import { Component, Vue, Prop, Watch } from "vue-property-decorator";
    import SequenceDiagramConfig from "./data/SequenceDiagramConfig";

    import ConnectionGroup from "@/data/ConnectionGroup";
    import Connection from "@/data/Connection";
    import QlogConnection from '@/data/Connection';

    // ConnectionConfigurator is used to select a single connection for one vertical line in the SequenceDiagram
    // All the Renderer cares about is the Connection, but here for our selection we also need ConnectionGroup
    // So we pass in all possible ConnectionGroups (this.allGroups) and then allow the user to select the connection they want
    // We provide two modes: all in 1 select (when there aren't too many options) and 2 selects (1 for the group, then the connection)
    // This latter one is for when there are too many options and a single select would be too unwieldy
    @Component
    export default class ConnectionConfigurator extends Vue { 
        @Prop()
         // passing in connection allows us to set it externally as well (e.g., loading from config string, loading premade testcase)
        protected connection!:Connection;

        @Prop()
        protected allGroups!:Array<ConnectionGroup>; 

        @Prop({ default: true })
        protected canBeRemoved!:boolean;

        @Prop()
        protected onConnectionSelected!:(conn: QlogConnection) => void;

        @Prop()
        protected onRemoved!:() => void;

        protected selectedConnection:Connection = this.connection;
        protected selectedGroup:ConnectionGroup = this.connection.parent;

        // Firstly, when we change our selection from inside this component, we propagate it to our parent in onSelectionChanged
        // The parent then sets this.connection, but this.selectedGroup is not automatically co-updated
        // so, we manually do that here. 
        // Secondly, if we change the connection from outside, this.selectedConnection is not updated, so we do that here
        // TODO: this feels dirty... figure out a better way to do two-way binding of these vars between outside and inside 
        @Watch('connection', { immediate: false, deep: false })
        protected onConnectionChanged(newConnection: Connection, oldConnection: Connection) {
            console.log("ConnectionConfigurator:onConnectionChanged : setting selectedGroup : ", newConnection.title, oldConnection.title, newConnection, oldConnection);
            this.selectedGroup = newConnection.parent;
            if ( this.selectedConnection !== newConnection ) {
                this.selectedConnection = newConnection;
            }
        }

        protected get tooManyOptions(){
            // TODO: we can do this without creating the combinedOptions array with a for-loop
            // TODO: maybe allow passing as a prop? 
            return this.combinedOptions.length > 30; 
        }

        // <b-form-select> expects things to be in a certain format to render correctly 
        // used in separate-select mode
        protected get groupOptions(){
            const options:any = [];
            for ( const group of this.allGroups ) {
                options.push( { value: group, text: group.filename + " (" + group.description + ")" } );
            } 

            return options;
        }

        // used in separate-select mode
        protected get connectionOptions(){ 
            const options:any = [];
            for ( const connection of this.selectedGroup.GetConnections() ) {
                options.push( { value: connection, text: connection.title } );
            }

            return options;
        }

        // used in combined-select mode
        protected get combinedOptions(){ 
            const options:any = [];

            for ( const group of this.allGroups ) {
                options.push( { value: null, text: group.filename, disabled: true } );

                for ( const connection of group.GetConnections() ) {
                    options.push( { value: connection, text: "↳ " + (connection.vantagePoint ? connection.vantagePoint.type : "UNKNOWN") + " : " + connection.title } );
                }
            }

            return options;
        }

        // used in separate-select mode
        protected onGroupSelectionChanged(newlySelected:ConnectionGroup){
            // this.selectedGroup is the PREVIOUS selection for some reason 
            console.log("Selected a new group", this.selectedGroup, newlySelected);

            // auto-select the first connection in the list
            this.selectedConnection = newlySelected.GetConnections()[0];

            this.onConnectionSelectionChanged( this.selectedConnection );
        }

        // used in separate-select and combined-select mode
        protected onConnectionSelectionChanged(newlySelected:Connection){
            console.log("Selected a new connection", this.selectedConnection, newlySelected);
            this.onConnectionSelected( newlySelected );
        }

        protected removeMyself(){
            this.onRemoved();
        }
    } 

</script>