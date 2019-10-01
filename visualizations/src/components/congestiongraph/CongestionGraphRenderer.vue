<template>
    <div>
        <div id="congestion-graph" style="width: 100%; border:5px solid #d4edda; min-height: 200px; position: relative;">
            <div id="legendPackets" style="padding: 5px; border: 1px solid black; background-color: white; position: absolute; top: 10px; left: 80px; z-index: 100;" @mouseenter="hideLegend" @mouseleave="showLegend">
                    
                <p style="padding: 0; margin: 10px 0;"> 
                    <span style="width: 12px; height: 8px; background-color: blue; display: inline-block; margin-right: 1px; vertical-align: middle;"></span> 
                    : Data sent (includes retransmits)
                </p>
                <p style="padding: 0; margin: 10px 0;"> 
                    <span style="width: 12px; height: 8px; background-color: #6B8E23; display: inline-block; margin-right: 1px; vertical-align: middle;"></span> 
                    : Data acknowledged
                </p>
                <p style="padding: 0; margin: 10px 0;"> 
                    <span style="width: 12px; height: 8px; background-color: red; display: inline-block; margin-right: 1px; vertical-align: middle;"></span> 
                    : Data lost
                </p>

                <p style="padding: 0; margin: 10px 0;"> 
                    <span style="width: 12px; height: 8px; background-color: #a80f3a; display: inline-block; margin-right: 1px; vertical-align: middle;"></span> 
                    : Connection flow control limit
                </p>

                <p style="padding: 0; margin: 10px 0;"> 
                    <span style="width: 12px; height: 8px; background-color: #ff69b4; display: inline-block; margin-right: 1px; vertical-align: middle;"></span> 
                    : Sum of stream flow control limits
                </p>
            </div>

            <div id="legendMetrics" style="padding: 5px; border: 1px solid black; background-color: white; position: absolute; top: 440px; right: 50px; z-index: 100;" @mouseenter="hideLegend" @mouseleave="showLegend">
            
                <p style="padding: 0; margin: 10px 0;"> 
                    <span style="width: 12px; height: 8px; background-color: #8A2BE2; display: inline-block; margin-right: 1px; vertical-align: middle;"></span> 
                    : Congestion window
                </p>
                <p style="padding: 0; margin: 10px 0;"> 
                    <span style="width: 12px; height: 8px; background-color: #808000; display: inline-block; margin-right: 1px; vertical-align: middle;"></span> 
                    : Bytes in flight
                </p>

            </div>


            <div id="legendRTT" style="padding: 5px; border: 1px solid black; background-color: white; position: absolute; top: 795px; right: 50px; z-index: 100;" @mouseenter="hideLegend" @mouseleave="showLegend">
                
                <p style="padding: 0; margin: 3px 15px; display: inline;"> 
                    <span style="width: 32px; height: 8px; background-color: #C96480; display: inline-block; margin-right: 1px; vertical-align: middle;"></span>
                    : Min RTT
                </p>
                
                <p style="padding: 0; margin: 3px 15px; display: inline;"> 
                    <span style="width: 32px; height: 8px; background-color: #ff9900; display: inline-block; margin-right: 1px; vertical-align: middle;"></span>
                    : Latest RTT
                </p>
                <p style="padding: 0; margin: 3px 15px; display: inline;"> 
                    <span style="width: 32px; height: 8px; background-color: #8a554a; display: inline-block; margin-right: 1px; vertical-align: middle;"></span>
                    : Smoothed RTT
                </p>
            </div>

        </div>

        
    </div>
</template>

<style>
    .grid line {
        stroke: #ddd;
    }

    .nogrid line {
        stroke: #ffffff;
    }

    .hiddenLegend {
        opacity: 0.3;
    }

</style>

<script lang="ts">
    import { Component, Vue, Prop, Watch } from "vue-property-decorator";
    import CongestionGraphConfig from "./data/CongestionGraphConfig";
    import CongestionGraphD3Renderer from "./renderer/CongestionGraphD3Renderer";

    @Component
    export default class CongestionGraphRenderer extends Vue {
        @Prop()
        public config!: CongestionGraphConfig;

        protected get connection(){
            return this.config.connection;
        }

        protected renderer: CongestionGraphD3Renderer | undefined = undefined;

        public created(){
            this.renderer = new CongestionGraphD3Renderer("congestion-graph");
            this.config.renderer = this.renderer;
        }

        public mounted(){
            // mainly for when we switch away, and then back to the congestionGraph
            if ( this.config && this.renderer && this.config.connection !== undefined ) {
                this.renderer.render( this.config );
            }
        }

        protected hideLegend(evt:any) {
            evt.target.classList.add("hiddenLegend");
        }

        protected showLegend(evt:any) {
            evt.target.classList.remove("hiddenLegend");
        }

        // Note: we could use .beforeUpdate or use an explicit event or a computed property as well
        // however, this feels more explicit
        @Watch('config', { immediate: true, deep: true })
        protected onConfigChanged(newConfig: CongestionGraphConfig, oldConfig: CongestionGraphConfig) {
            console.log("CongestionGraphRenderer:onConfigChanged : ", newConfig, oldConfig);

            if ( this.renderer && newConfig.connection !== undefined ) {
                this.renderer.render( newConfig );
            }
        }

    }

</script>
