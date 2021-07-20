<template>
    <div>
        <!-- <div>ManualRTT: {{config.manualRTT}}</div>
        <div>Scale: {{config.scale}}</div> -->

        <div id="sequence-diagram" style="width: 100%; border:5px solid #cce5ff; min-height: 200px;">
            <svg id="sequence-diagram-svg">
                
            </svg>
        </div>
        <b-modal id="event-modal" hide-footer title="Event detail">
            <div v-if="this.eventLink !== null">
                <a :href="this.eventLink" target="_blank">Direct link to this event</a><br/>
                <hr>
            </div>
            <pre class="d-block">{{ eventDetail }}</pre>
            <!-- TODO: make this configurable: not all extra data will be recovery-metric related down the line! -->
            <p style="font-weight: bold;" v-if="this.eventDetailExtra !== null">Value of all recovery metrics at this point:</p>
            <pre v-if="this.eventDetailExtra !== null" class="d-block">{{ eventDetailExtra }}</pre>
            <b-button class="mt-3" block @click="hideEventModal">Close</b-button>
        </b-modal>
    </div>
</template> 

<style>
    #sequence-diagram-svg text.timestamp {
        font-size: 11px;
    }
</style> 

<script lang="ts">
    import { Component, Vue, Prop, Watch } from "vue-property-decorator";
    import SequenceDiagramConfig from "./data/SequenceDiagramConfig";
    import { SequenceDiagramD3Renderer, EventPointer } from "./renderer/SequenceDiagramD3Renderer";
    import SequenceDiagramCanvasRenderer from "./renderer/SequenceDiagramCanvasRenderer";

    @Component
    export default class SequenceDiagramRenderer extends Vue {
        @Prop()
        public config!: SequenceDiagramConfig;

        public eventDetail: string = '';
        public eventDetailExtra: string|null = null; // not undefined, because that would make this propery un-reactive
        public eventLink: string|null = null;

        protected focusOnNext:EventPointer|null = null;

        protected get connections(){
            return this.config.connections;
        }

        protected renderer: SequenceDiagramD3Renderer | undefined = undefined;

        public created(){
            this.renderer = new SequenceDiagramD3Renderer("sequence-diagram", "sequence-diagram-svg", this.showEventModal);
            // this.renderer = new SequenceDiagramCanvasRenderer("sequence-diagram");

            const queryParameters = this.$route.query; // TODO: move this to a Helper if other visualizations start using this

            if ( queryParameters.focusOnConnection && queryParameters.focusOnEvent ) {
                this.focusOnNext = { connectionIndex: parseInt(queryParameters.focusOnConnection as string, 10), eventIndex: parseInt(queryParameters.focusOnEvent as string, 10) };
            }
            else if ( queryParameters.focusOnPN ) {
                
                let connectionIndex = 0;
                if ( queryParameters.focusOnConnection ) {
                    connectionIndex = parseInt(queryParameters.focusOnConnection as string, 10);
                }

                this.focusOnNext = { connectionIndex: connectionIndex, packetNumber: parseInt(queryParameters.focusOnPN as string, 10) };
            }
        }

        public mounted(){
            // mainly for when we switch away, and then back to the sequenceDiagram
            if ( this.config && this.renderer && this.config.connections.length > 0 ) {
                this.renderer.render( this.config.connections, this.config.timeResolution );
            }
        }

        protected hideEventModal() {
            this.$bvModal.hide("event-modal");
        }

        protected showEventModal(event: any, extra: any) {

            this.eventDetail = JSON.stringify(event, null, 2);
            if ( extra !== undefined ) {
                this.eventDetailExtra = JSON.stringify( extra, null , 2);
            }
            else {
                this.eventDetailExtra = null;
            }

            // const metadata = (event as any);
            let eventNr = undefined;
            if ( event.qvis && event.qvis.sequencediagram && event.qvis.sequencediagram.focusInfo ) {
                const focusInfo:EventPointer = event.qvis.sequencediagram.focusInfo as EventPointer;
                eventNr = focusInfo.eventIndex;
                
                const traces = this.renderer!.getTraces();

                const URLs:Array<string> = [];

                for ( const ctrace of traces ) {
                    if ( ctrace.connection && ctrace.connection.parent && ctrace.connection.parent.URL ) {
                        if ( URLs.indexOf(ctrace.connection.parent.URL) < 0 ) {
                            URLs.push( ctrace.connection.parent.URL );
                        }
                    }
                }

                const trace = traces[ focusInfo.connectionIndex ];
                if ( trace && URLs.length > 0 ) {

                    let fileLinks = "";
                    if ( URLs.length === 1 ) {
                        fileLinks = "file=" + URLs[0];
                    }
                    else {
                        for ( let i = 0; i < URLs.length; ++i ) {
                            fileLinks += "file" + (i + 1) + "=" + URLs[i];
                            if ( i !== URLs.length - 1 ) {
                                fileLinks += "&";
                            }
                        }
                    }

                    if ( trace.connection && trace.connection.parent && trace.connection.parent.URL ) {
                        this.eventLink = "https://qvis.quictools.info?#/sequence?" + fileLinks + "&focusOnConnection=" + focusInfo.connectionIndex + "&focusOnEvent=" + focusInfo.eventIndex;
                    }
                    else {
                        this.eventLink = null;
                    }
                }
                else {
                    this.eventLink = null;
                    console.error("SequenceDiagramRenderer:showEventModal : trying to focus on trace, but doesn't exist: ", focusInfo, traces );
                }
            }
            else {
                this.eventLink = null;
            }

            if ( eventNr !== undefined ) {
                this.eventDetail = "Event nr: " + eventNr + "\n" + this.eventDetail;
            }
            
            this.$bvModal.show("event-modal");
        }

        // Note: we could use .beforeUpdate or use an explicit event or a computed property as well
        // however, this feels more explicit
        @Watch('config', { immediate: true, deep: true })
        protected async onConfigChanged(newConfig: SequenceDiagramConfig, oldConfig: SequenceDiagramConfig) {
            console.log("SequenceDiagramRenderer:onConfigChanged : ", newConfig, oldConfig);

            if ( this.renderer ) {

                // Because of the Vue reactivity, we come into this function multiple times but we just want to do the first
                // so the .rendering var helps deal with that
                // TODO: fix this OR bring this logic into this component, rather than on the renderer
                if ( !this.renderer.rendering ){

                    if ( newConfig.connections && newConfig.connections[0].connection.getEvents().length > 10000 ){
                        Vue.notify({
                            group: "default",
                            title: "Trace might take long to render",
                            type: "warn",
                            text: "Some large traces can take a long time to render. Please be patient.",
                        });

                        // give time to show the warning
                        await new Promise( (resolve) => setTimeout(resolve, 200));
                    }

                    this.renderer.render( newConfig.connections, newConfig.timeResolution, this.focusOnNext ).then( (rendered) => {
                        
                        this.focusOnNext = null; // don't want to keep focusing on the same thing if we've changed selection
                        
                        if ( !rendered ) {
                            Vue.notify({
                                group: "default",
                                title: "Trace could not be rendered",
                                type: "error",
                                text: "This trace could not be rendered. There could be an error or a previous file was still rendering.<br/>See the JavaScript devtools for more information.",
                            });
                        }
                    });
                }
            }
        }

    } 

</script>