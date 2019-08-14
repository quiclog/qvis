import Connection from "@/data/Connection";

export default class CongestionGraphConfig {
    // PROPERTIES MUST BE INITIALISED
    // OTHERWISE VUE DOESNT MAKE THEM REACTIVE
    // !!!!!

    public connection:Connection | undefined = undefined;
}
