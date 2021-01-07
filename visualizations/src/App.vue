<template>
    <div id="app">
        <router-view name="menu"/>
        <router-view />
        <notifications group="default" position="bottom center" width="50%" />
    </div>
</template>

<style>
    html, body {
        height: 100%;
        padding: 0;
        margin: 0;
    }

    #app {
        font-family: 'Avenir', Helvetica, Arial, sans-serif;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        text-align: left;
        color: #2c3e50;
    }

    .vue-notification.warn, .vue-notification.error {
        color: black;
    }

    /* .vue-notification .end {
        background-color: #007bff;
        border-left-color: #003f83;
    } */

</style>


<script lang="ts">
    import { getModule } from "vuex-module-decorators";
    import { Component, Vue } from "vue-property-decorator";
    import HelloWorld from "@/components/HelloWorld.vue";

    import ConnectionStore from "@/store/ConnectionStore";
    import ConnectionGroup from "@/data/ConnectionGroup";

    @Component
    export default class App extends Vue {

        protected store:ConnectionStore = getModule(ConnectionStore, this.$store);

        protected created(){ 
            // this.store.loadFilesFromServer( this.$route.query );
        }

        protected mounted(){
            if ( Object.keys(this.$route.query).length > 0 ){
                this.store.loadFilesFromServer( this.$route.query );
            }
        }
    }
</script>
