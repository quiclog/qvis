<template>
    <b-container id="MainMenu" fluid>
        <!--
        <b-row>
            <b-col cols="1" md="auto">qvis</b-col>
            <b-col>
                <router-link to="/files">Manage files</router-link> |
                <router-link to="/sequence">Sequence</router-link> |
                <router-link to="/congestion">Congestion</router-link>
            </b-col>
        </b-row>
        -->
        <!-- <b-tabs
            active-nav-item-class="font-weight-bold text-uppercase text-danger"
            active-tab-class="font-weight-bold text-success"
            content-class="mt-3"
        >
            <b-tab title="First" active><router-link to="/files">Manage files</router-link></b-tab>
            <b-tab title="Second"><b-link to="/sequence">Sequence</b-link></b-tab>
            <b-tab title="Disabled" disabled><p>I'm a disabled tab!</p></b-tab>
        </b-tabs> -->
        <b-row>
            <b-col cols="1" md="auto" class="align-middle"><h3 style="width: 290px;">qvis</h3></b-col>
            <b-col>
                <b-nav tabs align="center">
                    <b-nav-item to="/files" class="files-link" :active="this.$route.fullPath.indexOf('/files') >= 0 || $route.fullPath === ''">
                        Manage files
                    </b-nav-item>
                    <b-nav-item to="/sequence" class="sequence-link" :active="$route.fullPath.indexOf('/sequence') >= 0">
                        Sequence
                    </b-nav-item>
                    <b-nav-item to="/congestion" class="congestion-link" :active="$route.fullPath.indexOf('/congestion') >= 0">
                        Congestion
                    </b-nav-item>
                    <b-nav-item to="/multiplexing" class="multiplexing-link" :active="$route.fullPath.indexOf('/multiplexing') >= 0">
                        Multiplexing
                    </b-nav-item>
                    <b-nav-item to="/stats" class="stats-link" :active="$route.fullPath.indexOf('/stats') >= 0">
                        qlog stats
                    </b-nav-item>
                </b-nav>
            </b-col>
            <b-col cols="1" md="auto">
                <b-button variant="success" href="https://github.com/quiclog/qvis/issues/new?template=feature_request.md&amp;title=Feature+request" target="_blank" style="margin-right: 5px;">Request feature</b-button>
                <b-button variant="danger"  href="https://github.com/quiclog/qvis/issues/new?template=bug-report-in-live-version.md&amp;title=Bug+in+live+version" target="_blank">Report issue</b-button>
            </b-col>
        </b-row>
    </b-container>
</template>

<style scoped>
    #MainMenu{
        width: 100%;
        background-color: black;
        color: white;
        padding-top: 5px;
        /*
        text-align: center;
        line-height: 1em;
        height: 25px;
        padding-top: 10px;
        */
    }

    #MainMenu .nav-tabs{
        border-bottom: none;
    }

    #MainMenu .nav-tabs .nav-item {
        margin-left: 3px;
    }

    #MainMenu .nav-tabs .nav-link {
        background-color: lightgrey;
        color: black;
        border-bottom: none;
    }

    /* using the bootstrapvue built-in "active-class" doesn't work due to precedence weirdness*/
    #MainMenu li.files-link a.active {
        color: black;
        font-weight: bold;
        background-color: #fff;
        border-bottom-color: #fff;
    }

    #MainMenu li.sequence-link a.active {
        color: black;
        font-weight: bold;
        background-color: #cce5ff;
        border-bottom-color: #cce5ff;
    }

    #MainMenu li.congestion-link a.active {
        color: black;
        font-weight: bold;
        background-color: #d4edda;
        border-bottom-color: #d4edda;
    }

    #MainMenu li.multiplexing-link a.active {
        color: black;
        font-weight: bold;
        background-color: #d1ecf1;
        border-bottom-color: #d1ecf1;
    }

    #MainMenu li.stats-link a.active {
        color: black;
        font-weight: bold;
        background-color: #fff3cd;
        border-bottom-color: #fff3cd;
    }

    /* #MainMenu a.router-link-exact-active {
        background-color: white;
        color: black;
    } */

</style>

<script lang="ts">
    import { getModule } from "vuex-module-decorators";
    import { Component, Vue } from "vue-property-decorator";
    import HelloWorld from "@/components/HelloWorld.vue";

    import ConnectionStore from "@/store/ConnectionStore";
    import ConnectionGroup from "@/data/ConnectionGroup";

    @Component({})
    export default class VUEDebug extends Vue {
        public mounted(){
            console.log( this.$route );
        }
    }

</script>