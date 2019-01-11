import Vue from "vue";
import Vuex from "vuex";

import ConnectionStore from "@/store/ConnectionStore"
import ConfigurationStore from "@/store/ConfigurationStore"

Vue.use(Vuex);

export default new Vuex.Store({
    //strict: process.env.NODE_ENV !== 'production',
    modules: {
        connections: ConnectionStore,
        configurations: ConfigurationStore, 
    },
});
