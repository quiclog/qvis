import Vue from "vue";
import Vuex from "vuex";

import ConnectionStore from "@/store/ConnectionStore"

Vue.use(Vuex);

export default new Vuex.Store({
    modules: {
        connections: ConnectionStore,
    },
});
