<template>
    <div>
        <div id="congestion-graph" style="width: 100%; border:5px solid red; min-height: 200px;">
        </div>
    </div>
</template>

<style>
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
        }

        public mounted(){
            // mainly for when we switch away, and then back to the congestionGraph
            if ( this.config && this.renderer ) {
                this.renderer.render( this.config );
            }
        }

        // Note: we could use .beforeUpdate or use an explicit event or a computed property as well
        // however, this feels more explicit
        @Watch('config', { immediate: true, deep: true })
        protected onConfigChanged(newConfig: CongestionGraphConfig, oldConfig: CongestionGraphConfig) {
            console.log("CongestionGraphRenderer:onConfigChanged : ", newConfig, oldConfig);

            if ( this.renderer ) {
                this.renderer.render( newConfig );
            }
        }

    }

</script>