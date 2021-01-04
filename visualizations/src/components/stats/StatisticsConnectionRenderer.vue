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
                        None of the events in this trace had data.header.packet_type set!
                    </b-td>
                </b-tr>
                <b-tr>
                    <b-td>Connection-level Flow Control evolution<br/>(MAX_DATA, initial_max_data)<br/><br/>
                        Read as: viewpoint allows the other side to send this much data on the entire connection (all streams combined)
                    </b-td>
                    <b-td v-if="encryptionLUT.size > 0">
                        <b-table-simple fixed small borderless responsive style="border-bottom: 0px;">
                        <colgroup><col width="20%"></colgroup>
                            <b-tbody>
                                <b-tr>
                                    <b-th></b-th> <!-- left empty on purpose to get horizontal alignment with the table above -->
                                    <b-th>Viewpoint</b-th>
                                    <b-th>Evolution (bytes)</b-th>
                                    <b-th></b-th> <!-- left empty on purpose to get horizontal alignment with the table above -->
                                </b-tr>
                                
                                <b-tr>
                                    <b-td>
                                    </b-td>
                                    <b-td>
                                        Local ({{connection.vantagePoint.type}})
                                    </b-td>
                                    <b-td>
                                        <p v-for="(item,index3) in connectionDataFCLocal" :key="'fcc_' + index3">
                                            {{item}}
                                        </p>
                                    </b-td>
                                    <b-td>
                                    </b-td>
                                </b-tr>
                                <b-tr>
                                    <b-td>
                                    </b-td>
                                    <b-td>
                                        Remote ({{connection.vantagePoint.type === qlogns.VantagePointType.client ? "server" : "client"}})
                                    </b-td>
                                    <b-td>
                                        <p v-for="(item,index4) in connectionDataFCRemote" :key="'fcc_' + index4">
                                            {{item}}
                                        </p>
                                    </b-td>
                                    <b-td>
                                    </b-td>
                                </b-tr>
                                
                            </b-tbody>
                        </b-table-simple>
                    </b-td>
                    <b-td v-else variant="danger">
                        None of the events in this trace had data.header.packet_type set!
                    </b-td>
                </b-tr>



                <b-tr>
                    <b-td>Stream-level Flow Control evolution<br/>(MAX_STREAM_DATA, initial_max_stream_data_*)<br/><br/>
                        Read as: viewpoint allows the other side to send this much data on each individual stream
                    </b-td>
                    <b-td v-if="streamDataFCRemote.size > 0">
                        <b-table-simple fixed small borderless responsive style="border-bottom: 0px;">
                        <colgroup><col width="20%"></colgroup>
                            <b-tbody>

                                <b-tr>
                                    <b-th></b-th> <!-- left empty on purpose to get horizontal alignment with the table above -->
                                    <b-th>Local Streams ({{connection.vantagePoint.type}})</b-th>
                                    <b-th>Evolution</b-th>
                                    <b-th></b-th> <!-- left empty on purpose to get horizontal alignment with the table above -->
                                </b-tr>
                                
                                <b-tr v-for="(item,index6) in streamDataFCLocal" :key="'fcsl_' + index6">
                                    <b-td>
                                    </b-td>
                                    <b-td>
                                        {{item[0]}}
                                    </b-td>
                                    <b-td>
                                        <p v-for="(fcLimit,index66) in item[1]" :key="'fcsl2_' + index66">
                                            {{fcLimit}}
                                        </p>
                                    </b-td>
                                    <b-td>
                                    </b-td>
                                </b-tr>


                                <b-tr>
                                    <b-th></b-th> <!-- left empty on purpose to get horizontal alignment with the table above -->
                                    <b-th>Remote Streams ({{connection.vantagePoint.type === qlogns.VantagePointType.client ? "server" : "client"}})</b-th>
                                    <b-th>Evolution</b-th>
                                    <b-th></b-th> <!-- left empty on purpose to get horizontal alignment with the table above -->
                                </b-tr>
                                
                                <b-tr v-for="(item,index5) in streamDataFCRemote" :key="'fcsr_' + index5">
                                    <b-td>
                                    </b-td>
                                    <b-td>
                                        {{item[0]}}
                                    </b-td>
                                    <b-td>
                                        <p v-for="(fcLimit,index55) in item[1]" :key="'fcsr2_' + index55">
                                            {{fcLimit}}
                                        </p>
                                    </b-td>
                                    <b-td>
                                    </b-td>
                                </b-tr>

                            </b-tbody>
                        </b-table-simple>
                    </b-td>
                    <b-td v-else variant="danger">
                        No stream level flow control limits set
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
    import * as qlog from '@/data/QlogSchema';
    import Connection from "@/data/Connection";

    interface FCData {
        connectionDataFCListTimes:Array<number>, // for debugging
        connectionDataFCList:Array<number>,
        streamDataFCListTimes:Map<string, Array<number>>, // for debugging
        streamDataFCList:Map<string, Array<number>>,
        streamsUniFCList:Array<number>,
        streamsBidiFCList:Array<number>,
    }

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

        // These are all from the remote's perspective
        protected flowControlRemote:FCData = {
            connectionDataFCList: new Array<number>(),
            connectionDataFCListTimes: new Array<number>(),
            streamDataFCList: new Map<string, Array<number>>(),
            streamDataFCListTimes: new Map<string, Array<number>>(),
            streamsUniFCList: new Array<number>(),
            streamsBidiFCList: new Array<number>(),
        }

        protected flowControlLocal:FCData = {
            connectionDataFCList: new Array<number>(),
            connectionDataFCListTimes: new Array<number>(),
            streamDataFCList: new Map<string, Array<number>>(),
            streamDataFCListTimes: new Map<string, Array<number>>(),
            streamsUniFCList: new Array<number>(),
            streamsBidiFCList: new Array<number>(),
        }



        // vue.js caches computed props, so this is not done again each time, only when data actually changes, see beforeUpdate()
        protected get H3headersSummary() {
            this.connection.setupLookupTable();

            // TODO: FIXME: add proper qlog type definitions for h3 events
            const frameCreatedEvents = this.connection.lookup( qlog.EventCategory.http, qlog.HTTP3EventType.frame_created ); // sent
            const frameParsedEvents  = this.connection.lookup( qlog.EventCategory.http, qlog.HTTP3EventType.frame_parsed ); // received

            let userAgent = undefined;
            let server = undefined;
            let authority = undefined;

            const frameEvents = [...frameCreatedEvents, ...frameParsedEvents];
            for ( const rawevt of frameEvents ){
                const evt = this.connection.parseEvent( rawevt ).data;

                if ( !evt.frame ){
                    continue;
                }

                if ( evt.frame.headers !== undefined ) {
                    for ( const header of (evt.frame as qlog.IHeadersFrame).headers ){
                        if (header.name === "server"){
                            server = header.value;
                        }
                        else if (header.name === "user-agent"){
                            userAgent = header.value;
                        }
                        else if (header.name === ":authority"){
                            authority = header.value;
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
            // console.log("DEBUG Clearing frameLUT");

            this.frameLookupTable = new Map<string, number>();
            this.encryptionLookupTable = new Map<string, number>(); 
            this.h3Headers = undefined;

            this.flowControlRemote = {
                connectionDataFCList: new Array<number>(),
                connectionDataFCListTimes: new Array<number>(),
                streamDataFCList: new Map<string, Array<number>>(),
                streamDataFCListTimes: new Map<string, Array<number>>(),
                streamsUniFCList: new Array<number>(),
                streamsBidiFCList: new Array<number>(),
            }
            this.flowControlLocal = {
                connectionDataFCList: new Array<number>(),
                connectionDataFCListTimes: new Array<number>(),
                streamDataFCList: new Map<string, Array<number>>(),
                streamDataFCListTimes: new Map<string, Array<number>>(),
                streamsUniFCList: new Array<number>(),
                streamsBidiFCList: new Array<number>(),
            }
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

                if ( evt.data && evt.data.header && evt.data.header.packet_type ){
                    const count = this.encryptionLookupTable.get( evt.data.header.packet_type ) || 0;
                    this.encryptionLookupTable.set( evt.data.header.packet_type, count + 1 );
                }
            }

            return this.encryptionLookupTable;
        }

        protected fillConnectionDataFC(owner:string) {

            let fc;
            let packetEventType;
            if ( owner === "remote" ) {
                fc = this.flowControlRemote;
                packetEventType = qlog.TransportEventType.packet_received;
            }
            else { 
                fc = this.flowControlLocal;
                packetEventType = qlog.TransportEventType.packet_sent;
            }


            const trace = this.connection;
            for ( const rawEvt of trace.getEvents() ){
                const evt = trace.parseEvent( rawEvt );

                // 1. get the initial max from the transport parameters
                if ( evt.category === qlog.EventCategory.transport && evt.name === qlog.TransportEventType.parameters_set 
                     && evt.data && evt.data.owner === owner ) {
                         
                        fc.connectionDataFCListTimes.push( evt.relativeTime );
                        fc.connectionDataFCList.push ( parseInt( evt.data.initial_max_data, 10 ) );
                }

                // 2. get updates from MAX_DATA frames
                if ( evt.category === qlog.EventCategory.transport && evt.name === packetEventType
                    && evt.data && evt.data.frames ) {
                        for ( const frame of evt.data.frames ) {
                            if ( frame.frame_type === qlog.QUICFrameTypeName.max_data ) {
                                fc.connectionDataFCListTimes.push ( evt.relativeTime );
                                fc.connectionDataFCList.push ( parseInt( frame.maximum, 10 ) );
                            }
                        }
                }
            }
        }

        protected fillStreamDataFC(owner:string) {

            let fc;
            let packetEventType;
            if ( owner === "remote" ) {
                fc = this.flowControlRemote;
                packetEventType = qlog.TransportEventType.packet_received;
            }
            else { 
                fc = this.flowControlLocal;
                packetEventType = qlog.TransportEventType.packet_sent;
            }


            const trace = this.connection;
            for ( const rawEvt of trace.getEvents() ){
                const evt = trace.parseEvent( rawEvt );

                // 1. get the initial max from the transport parameters
                if ( evt.category === qlog.EventCategory.transport && evt.name === qlog.TransportEventType.parameters_set 
                     && evt.data && evt.data.owner === owner ) {

                        // TODO: add these as initial values to the individual streams as well
                        // however, that requires figuring out which streams are what type, and I'm too lazy for that at the moment
                        fc.streamDataFCList.set("bidi_local",  [ parseInt( evt.data.initial_max_stream_data_bidi_local, 10 )])
                        fc.streamDataFCList.set("bidi_remote", [ parseInt( evt.data.initial_max_stream_data_bidi_remote, 10 )] )
                        fc.streamDataFCList.set("uni_remote",  [ parseInt( evt.data.initial_max_stream_data_uni, 10 )] )


                        fc.streamDataFCListTimes.set( "bidi_local", [evt.relativeTime] );
                        fc.streamDataFCListTimes.set( "bidi_remote", [evt.relativeTime] );
                        fc.streamDataFCListTimes.set( "uni_remote", [evt.relativeTime] );
                }

                // 2. get updates from MAX_STREAM_DATA frames
                if ( evt.category === qlog.EventCategory.transport && evt.name === packetEventType
                    && evt.data && evt.data.frames ) {
                        for ( const frame of evt.data.frames ) {
                            if ( frame.frame_type === qlog.QUICFrameTypeName.max_stream_data ) {

                                const streamID = "" + frame.stream_id;

                                let streamFC = fc.streamDataFCList.get( streamID );
                                if ( !streamFC ) {
                                    streamFC = new Array<number>();
                                    fc.streamDataFCList.set( streamID, streamFC );
                                }

                                streamFC.push( parseInt( frame.maximum, 10 ) );

                                let times = fc.streamDataFCListTimes.get( streamID );
                                if ( !times ) {
                                    times = new Array<number>();
                                    fc.streamDataFCListTimes.set( streamID, times );
                                }

                                times.push( evt.relativeTime );
                            }
                        }
                }
            }
        }

        protected createStaggeredLines( timesInput:Array<number>, valsInput: Array<number> ) {

            let times = "";
            let vals = "";
            let prevVal = null;
            let prevTime = null;

            for ( let i = 0; i < timesInput.length; ++i ){
                const time = timesInput[i];
                const val = valsInput[i];

                if ( prevVal !== null ){
                    times += ( "" + time).replace(".",",") + ";";
                    vals += ( "" + prevVal).replace(".",",") + ";";
                }

                times += ( "" + time).replace(".",",") + ";";
                vals  += ( "" + val).replace(".",",") + ";";

                prevTime = time;
                prevVal = val;
            }

            times += ( "" + (prevTime! + 200)).replace(".",",") + ";";
            vals  += ( "" + prevVal).replace(".",",") + ";";

            return [ times, vals ];
        }

        protected get connectionDataFCRemote() {

            this.fillConnectionDataFC("remote");

            const staggeredResults = this.createStaggeredLines( this.flowControlRemote.connectionDataFCListTimes, this.flowControlRemote.connectionDataFCList );


            console.log("Connection-level FC TIMES for remote viewpoint of Trace " + this.index + ": ", staggeredResults[0]);
            // console.log("Connection-level FC TIMES for remote viewpoint of Trace " + this.index + ": ",    this.flowControlRemote.connectionDataFCListTimes.join(";"));
            console.log("Connection-level FC for remote viewpoint of Trace " + this.index + ": ",         staggeredResults[1]);
            // console.log("Connection-level FC for remote viewpoint of Trace " + this.index + ": ",          this.flowControlRemote.connectionDataFCList.join(";"));

            return this.flowControlRemote.connectionDataFCList;
        }

        protected get connectionDataFCLocal() {

            this.fillConnectionDataFC("local");

            const staggeredResults = this.createStaggeredLines( this.flowControlLocal.connectionDataFCListTimes, this.flowControlLocal.connectionDataFCList );

            console.log("Connection-level FC TIMES for local viewpoint of Trace " + this.index + ": ", staggeredResults[0] );
            // console.log("Connection-level FC TIMES for local viewpoint of Trace " + this.index + ": ", this.flowControlLocal.connectionDataFCListTimes.join(";"));
            console.log("Connection-level FC for local viewpoint of Trace " + this.index + ": ",       staggeredResults[1] );
            // console.log("Connection-level FC for local viewpoint of Trace " + this.index + ": ",       this.flowControlLocal.connectionDataFCList.join(";"));

            return this.flowControlLocal.connectionDataFCList;
        }

        protected get streamDataFCRemote() {
            this.fillStreamDataFC("remote");

            for ( const entry of this.flowControlRemote.streamDataFCList.entries() ) {

                const staggeredResults = this.createStaggeredLines( this.flowControlRemote.streamDataFCListTimes.get(entry[0])!, entry[1] );

                console.log("Stream-level FC TIMES for remote viewpoint of Trace " + this.index + ", stream " + entry[0] + ": ", staggeredResults[0]);
                // console.log("Stream-level FC TIMES for remote viewpoint of Trace " + this.index + ", stream " + entry[0] + ": ", this.flowControlRemote.streamDataFCListTimes.get(entry[0])!.join(","));
                console.log("Stream-level FC for remote viewpoint of Trace " + this.index + ", stream " + entry[0] + ": ", staggeredResults[1]);
                // console.log("Stream-level FC for remote viewpoint of Trace " + this.index + ", stream " + entry[0] + ": ", entry[1].join(","));
            }

            return this.flowControlRemote.streamDataFCList;
        }

        protected get streamDataFCLocal() {
            this.fillStreamDataFC("local");

            for ( const entry of this.flowControlLocal.streamDataFCList.entries() ) {

                const staggeredResults = this.createStaggeredLines( this.flowControlLocal.streamDataFCListTimes.get(entry[0])!, entry[1] );

                console.log("Stream-level FC TIMES for local viewpoint of Trace " + this.index + ", stream " + entry[0] + ": ", staggeredResults[0]);
                // console.log("Stream-level FC TIMES for local viewpoint of Trace " + this.index + ", stream " + entry[0] + ": ", this.flowControlLocal.streamDataFCListTimes.get(entry[0])!.join(","));
                console.log("Stream-level FC for local viewpoint of Trace " + this.index + ", stream " + entry[0] + ": ", staggeredResults[1]);
                // console.log("Stream-level FC for local viewpoint of Trace " + this.index + ", stream " + entry[0] + ": ", entry[1].join(","));
            }

            return this.flowControlLocal.streamDataFCList;
        }

        // TODO: FIXME: not doing the MAX_STREAMS stuff yet because we didn't need it for our research + 
        // most of that info should be in the transport parameters either way (unless for very long-running conns or constrained hardware)



    }

</script>
