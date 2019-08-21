import ConnectionGroup from "@/data/ConnectionGroup";

export default class StatisticsConfig {
    // PROPERTIES MUST BE INITIALISED
    // OTHERWISE VUE DOES NOT MAKE THEM REACTIVE
    // !!!!!

    public group:ConnectionGroup | undefined = undefined; 
}
