import Vue from "vue";
import BootstrapVue from "bootstrap-vue";
import App from "./App.vue";
import router from "./router";
import store from "./store";

import "bootstrap/dist/css/bootstrap.css";
import "bootstrap-vue/dist/bootstrap-vue.css";

import { getModule } from "vuex-module-decorators";
import ConnectionStore from "@/store/ConnectionStore";
import { IQLog } from '@quictools/qlog-schema';

const standaloneFiles:Array<string> = [
    "draft-00/example_github.qlog.js",
    "draft-01/new_cid.qlog.js",
    "draft-01/spin_bit.qlog.js",
    "prespec/ngtcp2_pcap1.qlog.js",
    /*
    "prespec/quictracker_handshake_v6_quicker_20181219.qlog.js",
    "prespec/ngtcp2_multistreams_server_noloss.qlog.js",
    "prespec/ngtcp2_multistreams_server_10ploss.qlog.js",
    "prespec/ngtcp2_multistreams_server_losscomparison.qlog.js",
    */
];
  
const connectionStore = getModule(ConnectionStore, store);

for ( const filepath of standaloneFiles ){

    const scriptelement = document.createElement('script');

    console.log("Loading ", filepath ); 

    scriptelement.onload = () => {
        // the standalone file has a single variable in it, named after the file, so we can get the contents
        // e.g., var dupli_pkts_cl_ngtcp2 = {...}
        // since it's a 'var' and not 'let', we can access it via the window[]
        // prespec/ngtcp2_pcap1.qlog.js -> ngtcp2_pcap1
        let varname = filepath.substr(filepath.indexOf("/") + 1);
        varname = varname.substr(0, varname.indexOf("."));

        // @ts-ignore 
        const file = window[varname];
        // @ts-ignore 
        window[varname] = "loaded"; // make sure it can be gc'ed if necessary

        connectionStore.AddGroupFromQlogFile(  {fileContentsJSON: file, filename: varname} ).then( () => {
            console.log("Loaded ", varname, file );
        }); 
    };

    scriptelement.onerror = (err) => {
        console.error("Loading error ", filepath, err);
    };

    scriptelement.onabort = () => {
        console.error("Loading aborted ", filepath);
    };

    scriptelement.src = "standalone_data/" + filepath;
    document.head.appendChild(scriptelement); 
}
  
Vue.config.productionTip = false;
Vue.use(BootstrapVue);

new Vue({
    router,
    store,
    render: (h) => h(App),
}).$mount("#app");
