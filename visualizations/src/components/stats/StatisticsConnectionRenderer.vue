<template>
    <div>
        <h3>Trace {{index + 1}} info</h3>
        <b-table-simple fixed bordered small responsive id="toplevel">
            <colgroup><col width="20%"></colgroup>
            <b-tbody>
                <b-tr v-if="connection.title && connection.title > 0">
                    <b-td>Title</b-td>
                    <b-td>{{connection.title}}</b-td>
                </b-tr>
                <b-tr v-if="connection.description && connection.description.length > 0">
                    <b-td>Description</b-td>
                    <b-td>{{connection.description}}</b-td>
                </b-tr>
                <b-tr v-if="connection.vantagePoint">
                    <b-td>Vantage point</b-td>
                    <b-td>
                        <span v-if="connection.vantagePoint.name !== ''">{{connection.vantagePoint.name}}<br/></span>
                        <span v-if="connection.vantagePoint.type === qlogns.VantagePointType.network">{{connection.vantagePoint.type}} : with {{connection.vantagePoint.flow}} perspective</span>
                        <span v-else>{{connection.vantagePoint.type}}</span>
                    </b-td>
                </b-tr>
                <b-tr v-if="H3headersSummary !== undefined">
                    <b-td>H3 connection headers</b-td>
                    <b-td>
                        <div v-html="H3headersSummary" />
                    </b-td>
                </b-tr>
                <b-tr>
                    <b-td>Event count</b-td>
                    <b-td>{{connection.getEvents().length}}</b-td>
                </b-tr>

                <b-tr>
                    <b-td>Events</b-td>
                    <b-td>
                        <b-table-simple fixed small borderless responsive style="border-bottom: 0px;">
                        <colgroup><col width="20%"></colgroup>
                            <b-tbody>
                                <b-tr>
                                    <b-th>Category</b-th>
                                    <b-th>Event type</b-th>
                                    <b-th>Event count</b-th>
                                    <b-th>% of total occurence</b-th>
                                </b-tr>
                                
                                <template v-for="(catmap,index1) in connection.getLookupTable().entries()">
                                    <b-tr v-for="(evtmap,index2) in catmap[1]" :key="'evt_' + index1 + '_' + index2">
                                        <b-td v-if="index2 === 0" :rowspan="catmap[1].size">{{catmap[0]}}</b-td>
                                        <b-td>
                                            {{evtmap[0]}}
                                        </b-td>
                                        <b-td>
                                            {{evtmap[1].length}}
                                        </b-td>
                                        <b-td>
                                            <b-progress :value="evtmap[1].length" :max="connection.getEvents().length" :precision="2" show-progress></b-progress>
                                        </b-td>
                                    </b-tr>
                                </template>
                            </b-tbody>
                        </b-table-simple>
                    </b-td>
                </b-tr>

                <b-tr>
                    <b-td>Frame count</b-td>
                    <b-td>{{totalFrameCount}}</b-td>
                </b-tr>
                <b-tr>
                    <b-td>Frames</b-td>
                    <b-td>
                        <b-table-simple fixed small borderless responsive style="border-bottom: 0px;">
                        <colgroup><col width="20%"></colgroup>
                            <b-tbody>
                                <b-tr>
                                    <b-th></b-th> <!-- left empty on purpose to get horizontal alignment with the table above -->
                                    <b-th>Frame type</b-th>
                                    <b-th>Frame count</b-th>
                                    <b-th>% of total occurence</b-th>
                                </b-tr>
                                
                                <b-tr v-for="(framemap,index2) in frameLUT" :key="'frame_' + index2">
                                    <b-td>
                                    </b-td>
                                    <b-td>
                                        {{framemap[0]}}
                                    </b-td>
                                    <b-td>
                                        {{framemap[1]}}
                                    </b-td>
                                    <b-td>
                                        <b-progress :value="framemap[1]" show-progress :precision="2" :max="totalFrameCount"></b-progress>
                                    </b-td>
                                </b-tr>
                            </b-tbody>
                        </b-table-simple>
                    </b-td>
                </b-tr>

                <b-tr>
                    <b-td>Encryption level count</b-td>
                    <b-td>{{ Array.from(encryptionLUT.keys()).length }}</b-td>
                </b-tr>
                <b-tr>
                    <b-td>Encryption levels</b-td>
                    <b-td v-if="encryptionLUT.size > 0">
                        <b-table-simple fixed small borderless responsive style="border-bottom: 0px;">
                        <colgroup><col width="20%"></colgroup>
                            <b-tbody>
                                <b-tr>
                                    <b-th></b-th> <!-- left empty on purpose to get horizontal alignment with the table above -->
                                    <b-th>Encryption level</b-th>
                                    <b-th>Packet count</b-th>
                                    <b-th></b-th> <!-- left empty on purpose to get horizontal alignment with the table above -->
                                </b-tr>
                                
                                <b-tr v-for="(encmap,index1) in encryptionLUT" :key="'enc_' + index1">
                                    <b-td>
                                    </b-td>
                                    <b-td>
                                        {{encmap[0]}}
                                    </b-td>
                                    <b-td>
                                        {{encmap[1]}}
                                    </b-td>
                                    <b-td>
                                    </b-td>
                                </b-tr>
                            </b-tbody>
                        </b-table-simple>
                    </b-td>
                    <b-td v-else variant="danger">
                        None of the events in this trace had data.packet_type set!
                    </b-td>
                </b-tr>

            </b-tbody>
        </b-table-simple>
    </div>
</template>

<style scoped>
    #toplevel > tr[role="row"] td:first-of-type {
        text-align: right;
        font-weight: bold;
        padding-right: 10px;
    }
</style>

<script lang="ts">
    import { Component, Vue, Prop, Watch } from "vue-property-decorator";
    import StatisticsConfig from "./data/StatisticsConfig";
    import * as qlog from '@quictools/qlog-schema';
    import Connection from "@/data/Connection";

    @Component
    export default class StatisticsConnectionRenderer extends Vue {
        @Prop()
         // passing in connection allows us to set it externally as well (e.g., loading from config string, loading premade testcase)
        protected connection!:Connection;

        @Prop()
        protected index!:number;

        protected frameLookupTable:Map<string, number> = new Map<string, number>();
        protected encryptionLookupTable:Map<string, number> = new Map<string, number>(); 
        protected h3Headers:string|undefined = undefined;

        // vue.js caches computed props, so this is not done again each time, only when data actually changes, see beforeUpdate()
        protected get H3headersSummary() {
            this.connection.setupLookupTable();

            // TODO: FIXME: add proper qlog type definitions for h3 events
            const frameCreatedEvents = this.connection.lookup( "http", "frame_created" ); // sent
            const frameParsedEvents = this.connection.lookup( "http", "frame_parsed" ); // received

            let userAgent = undefined;
            let server = undefined;
            let authority = undefined;

            const frameEvents = [...frameCreatedEvents, ...frameParsedEvents];
            for ( const rawevt of frameEvents ){
                const evt = this.connection.parseEvent( rawevt ).data;

                if (evt.frame && evt.frame.fields ) {
                    for ( const field of evt.frame.fields ){
                        if (field.name === "server"){
                            server = field.value;
                        }
                        else if (field.name === "user-agent"){
                            userAgent = field.value;
                        }
                        else if (field.name === ":authority"){
                            authority = field.value;
                        }
                    }
                }
            }

            if ( userAgent !== undefined || server !== undefined || authority !== undefined ){
                this.h3Headers = "User Agent <i><u>" + (userAgent ? userAgent : "unknown") + "</u></i>" + 
                                 " connected to Server <i><u>" + (server ? server : "unknown") + "</u></i>" + 
                                 " at <i><u>" + (authority ? authority : "unknown authority") + "</u></i>";
            }
            
            return this.h3Headers;
        }

        protected get qlogns(){
            return qlog;
        }

        protected beforeUpdate() {
            console.log("DEBUG Clearing frameLUT");

            this.frameLookupTable = new Map<string, number>();
            this.encryptionLookupTable = new Map<string, number>(); 
            this.h3Headers = undefined;
        }

        protected get totalFrameCount() {
            let totalFrameCounter = 0;

            // Reactivity strikes again! If we keep the frameCounter in a var and update it in frameLUT, this leads to infinite update loops...
            const trace = this.connection;
            for ( const rawEvt of trace.getEvents() ){
                const evt = trace.parseEvent( rawEvt );
                if ( evt.data && evt.data.frames ){ // QUIC level, e.g., packet_sent
                    for ( const frame of evt.data.frames ){
                        ++totalFrameCounter;
                    }
                }

                if ( evt.data && evt.data.frame ){ // HTTP level, e.g., frame_created
                    ++totalFrameCounter;
                }
            }

            return totalFrameCounter;
        }

        protected get frameLUT() {

            const trace = this.connection;

            for ( const rawEvt of trace.getEvents() ){
                const evt = trace.parseEvent( rawEvt );
                if ( evt.data && evt.data.frames ){ // QUIC level, e.g., packet_sent
                    for ( const frame of evt.data.frames ){
                        const count = this.frameLookupTable.get( frame.frame_type ) || 0;
                        this.frameLookupTable.set( frame.frame_type, count + 1 );
                    }
                }

                if ( evt.data && evt.data.frame ){ // HTTP level, e.g., frame_created
                    const count = this.frameLookupTable.get( evt.data.frame.frame_type ) || 0;
                    this.frameLookupTable.set( evt.data.frame.frame_type, count + 1 );
                }
            }

            return this.frameLookupTable;
        }

        protected get encryptionLUT() {

            const trace = this.connection;
            for ( const rawEvt of trace.getEvents() ){
                const evt = trace.parseEvent( rawEvt );

                if ( evt.data && evt.data.packet_type ){
                    const count = this.encryptionLookupTable.get( evt.data.packet_type ) || 0;
                    this.encryptionLookupTable.set( evt.data.packet_type, count + 1 );
                }
            }

            return this.encryptionLookupTable;
        }
    }

</script>
