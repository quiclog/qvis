import QlogConnection from '@/data/Connection';
import * as d3 from 'd3';
import * as qlog from '@quictools/qlog-schema';
import CongestionGraphConfig from '../data/CongestionGraphConfig';
import { VantagePointType } from '@quictools/qlog-schema';
import { IQlogRawEvent } from '@/data/QlogEventParser';

export default class CongestionGraphD3Renderer {

    public containerID:string;
    public rendering:boolean = false;

    private config!:CongestionGraphConfig;

    constructor(containerID:string){
        this.containerID = containerID;
    }

    public render(config:CongestionGraphConfig) {
        if ( this.rendering ) {
            return;
        }

        console.log("CongestionGraphRenderer:render", config);

        this.config = config;
        this.rendering = true;

        const canContinue:boolean = this.setup();

        if ( !canContinue ) {
            this.rendering = false;

            return;
        }

        this.renderParts().then( () => {
            this.rendering = false;
        });

    }

    // runs once before each render. Used to bootstrap everything.
    protected setup():boolean {
        return true;
    }

    // Redraw canvas
    private async renderParts(){
        document.getElementById(this.containerID)!.innerHTML = "Hello world";
    }
}
