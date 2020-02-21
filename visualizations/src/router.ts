import Vue from "vue";
import Router from "vue-router";
import MainMenu from "./views/MainMenu.vue";
import VUEDebug from "./views/VUEDebug.vue";
import FileManager from "./views/FileManager.vue";
import SequenceDiagram from "./views/SequenceDiagram.vue";
import PacketizationDiagram from "./views/PacketizationDiagram.vue";
import CongestionGraph from "./views/CongestionGraph.vue";
import MultiplexingGraph from "./views/MultiplexingGraph.vue";
import Statistics from "./views/Statistics.vue";

Vue.use(Router);

const router = new Router({
    routes: [
        {
            path: "/",
            redirect: "/files",
        },
        {
            path: "/debug",
            name: "VUEDebug",
            components: {
                default: VUEDebug,
                menu: MainMenu,
            },
        },
        {
            path: "/files",
            name: "FileManager",
            components: {
                default: FileManager,
                menu: MainMenu,
            },
        },
        {
            path: "/sequence",
            name: "sequence",
            // route level code-splitting
            // this generates a separate chunk (about.[hash].js) for this route
            // which is lazy-loaded when the route is visited.
            // component: () => import(/* webpackChunkName: "about" */ './views/About.vue'),
            components: {
                default: SequenceDiagram,
                menu: MainMenu,
            },
        },
        {
            path: "/congestion",
            name: "congestion",
            // route level code-splitting
            // this generates a separate chunk (about.[hash].js) for this route
            // which is lazy-loaded when the route is visited.
            // component: () => import(/* webpackChunkName: "about" */ './views/About.vue'),
            components: {
                default: CongestionGraph,
                menu: MainMenu,
            },
        },
        {
            path: "/multiplexing",
            name: "multiplexing",
            components: {
                default: MultiplexingGraph,
                menu: MainMenu,
            },
        },
        {
            path: "/packetization",
            name: "packetization",
            components: {
                default: PacketizationDiagram,
                menu: MainMenu,
            },
        },
        {
            path: "/stats",
            name: "Statistics",
            components: {
                default: Statistics,
                menu: MainMenu,
            },
        },
    ],
});

function hasQueryParams(route:any) {
    return !!Object.keys(route.query).length;
  }

// Vue does something weird with its processing of query parameters
// normally, we get an url like : mydomain.com/#/routename
// if we then do mydomain.com/#/routename?param1=test, everything works
// HOWEVER
// mydomain.com?param1=test will NOT work...
// this will redirect to  mydomain.com?param1=test#/timeline
// WHICH IS RETARDED, VUE
// anyway... if we are in this situation, manually copy the parameters over
// and use them in the redirect so stuff works
router.beforeEach((to, from, next) => {

    if ( window.location.search && Object.keys(to.query).length === 0 && from.path === "/" ){
        const params = new URLSearchParams(window.location.search);
        const query:any = {};
        for ( const entry of params.entries() ){
            query[ entry[0] ] = entry[1];
        }
        next({ name: to.name, query: query });
    }
    else {
        next();
    }
});

export default router;
