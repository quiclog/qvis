import QlogConnection from '@/data/Connection';
import * as d3 from 'd3';
import * as qlog from '@quictools/qlog-schema';
import SequenceDiagramConfig from '../data/SequenceDiagramConfig';
import { VantagePointType } from '@quictools/qlog-schema';
import { IQlogRawEvent } from '@/data/QlogEventParser';

interface VerticalRange {
    svgGroup:HTMLOrSVGElement | undefined,
    rendered: boolean,
    yMin: number
};

interface ExtentInfo {
    rangeIndex: number,
    start: number,
    stop: number
};


interface CoordinateTracker {
    timestamp: number,
    y: number
}

interface Interval {
    yMin: number,
    yMax: number,
    timeSkipped: number
}

enum arrowTargetProperty {
    left = "leftTarget",
    right = "rightTarget",
};

export default class SequenceDiagramD3Renderer {

    public containerID:string;
    public svgID:string;
    public rendering:boolean = false;

    private svg!:d3.Selection<d3.BaseType, unknown, HTMLElement, any>;

    private selectedTraces!:Array<QlogConnection>;
    private traces!:Array<QlogConnection>;

    private scrollHandler:((e:any) => void) | undefined = undefined;

    
    private renderedRanges!:Array<VerticalRange>;
    private rangeHeight!:number;
    private shortenedIntervals:Array<Interval> = new Array<Interval>();

    private dimensions:any = {};
    
    private bandWidth:number = 0; // width of an individual vertical trace timeline on screen

    private frameTypeToColorLUT:Map<string, Array<string>> = new Map<string, Array<string>>();

    constructor(containerID:string, svgID:string){
        this.containerID = containerID;
        this.svgID = svgID;
    }
   
    public render(traces:Array<QlogConnection>) {
        if ( this.rendering ) {
            return;
        }

        console.log("SequenceDiagramRenderer:render", traces);

        this.selectedTraces = traces;
        this.rendering = true;

        // To make things performant enough, we don't render the full diagram at once
        // We always render just parts of it at the same time
        // this.setup prepares everything, calculates coordinates and relations between events etc.
        // this.renderPartialExtents can then be called on scroll updates. It figures out which part of the SVG is visible and makes sure that part of the diagram is drawn.
        const canContinue:boolean = this.setup(traces);

        if ( !canContinue ) {
            this.rendering = false;

            return;
        }

        this.renderPartialExtents().then( () => {
            this.rendering = false;
        });
    }

    // runs once before each render. Used to bootstrap everything.
    protected setup(tracesInput:Array<QlogConnection>):boolean {

        // 0. make sure the containers exist
        // 1. make sure we have at least 2 traces to draw (sequence diagram doesn't make much sense with just one)
        // 2. calculate the y coordinates for each event on the timelines. This can be done once and stored for future use
        // 3. setup the SVG container and draw things like timelines
        // 4. prepare data structures to keep scrolling state (what we've drawn already and what not yet)
        // 5. setup event listeners so we can update the rendering when needed

        // 0.
        if ( document.getElementById(this.containerID) === undefined ){
            console.error("SequenceDiagramD3Renderer:setup : container element not found, cannot render!", this.containerID);

            return false;
        }

        if ( document.getElementById(this.svgID) === undefined ){
            console.error("SequenceDiagramD3Renderer:setup : svg element not found, cannot render!", this.svgID);

            return false;
        }

        // 1.
        this.traces = new Array<QlogConnection>();
        // new array, because a) we might want to add a trace if there's only 1 and b) we might have invalid traces in there
        for (const trace of tracesInput) {
            if ( trace.getEvents().length > 0 ){
                this.traces.push( trace );
            }
        }

        if ( this.traces.length === 0 ){
            console.error("SequenceDiagramD3Renderer:setup : None of the selected traces have events in them, cannot render");

            return false;
        }

        // TODO: potentially do this outside? In SequenceDiagramRenderer? or maybe ConnectionConfigurator itself?
        this.ensureMoreThanOneTrace();

        for ( const trace of this.traces ){
            trace.setupLookupTable();
        }

        // 2. 
        this.dimensions = {
            margin: {
                top: 60,
                bottom: 100,
                left: 0,
                right: 0,
            },
            width: 0, // total width, including margins
            height: 0, // total height, including margin.top and margin.bottom

            pixelsPerMillisecond: 20,
            shortenIntervalsLongerThan: 120,
        };

        this.dimensions.height = this.calculateCoordinates( this.traces );
        this.calculateConnections();

        // TODO: verify traces are left-to-right : i.e., arrows do not go UP!

        // 3. 
        const container:HTMLElement = document.getElementById(this.containerID)!;

        this.svg = d3.select("body").select( "#" + this.svgID );
        this.svg.selectAll("*").remove();
       
        this.svg.attr("height", this.dimensions.height);
        // this is impacted by whether we have scrollbars or not, so we set height first before fetching this
        this.dimensions.width = container.clientWidth;
        this.svg.attr("width", this.dimensions.width);
        this.svg.attr("viewbox", `0 0 ${this.dimensions.width} ${this.dimensions.height}`);
        
        // draw the vertical timelines 
        // we have multiple timelines next to each other in horizontal "bands"
        this.bandWidth = (this.dimensions.width / this.traces.length);
        for ( let i = 0; i < this.traces.length; ++i ){
            const currentX =  this.bandWidth * i + (this.bandWidth * 0.5); // get center of the band

            this.svg.append('rect').attr("x", currentX - 1).attr("y", this.dimensions.margin.top).attr("width", 2).attr("height", this.dimensions.height).attr("fill", "black");

            
            let text = document.createElementNS("http://www.w3.org/2000/svg", "text");
            text.setAttribute('x', "" + currentX);
            text.setAttribute('y', "" + 20);
            text.setAttribute('dominant-baseline', "middle");
            text.setAttribute('text-anchor', "middle");
            text.textContent = "" + this.traces[i].parent.filename;
            (this.svg.node()! as HTMLElement).appendChild( text );
            


            let vantagePoint:VantagePointType | string = this.traces[i].vantagePoint.type;
            if ( vantagePoint === qlog.VantagePointType.network ){
                vantagePoint = "" + vantagePoint + " : from " + this.traces[i].vantagePoint.flow + "'s viewpoint";
            }

            text = document.createElementNS("http://www.w3.org/2000/svg", "text");
            text.setAttribute('x', "" + currentX);
            text.setAttribute('y', "" + 40);
            text.setAttribute('dominant-baseline', "middle");
            text.setAttribute('text-anchor', "middle");
            text.textContent = "" + vantagePoint;
            (this.svg.node()! as HTMLElement).appendChild( text );
        }

        for ( const interval of this.shortenedIntervals ){
            for ( let i = 0; i < this.traces.length; ++i ){
                let currentX =  this.bandWidth * i + (this.bandWidth * 0.5); // get center of the band
    
                // the outside of the trace
                // dashed array doesn't have a background color, so make sure we draw it ourselves
                this.svg.append('line') .attr("x1", currentX).attr("x2", currentX)
                                        .attr("y1", interval.yMin + this.dimensions.pixelsPerMillisecond).attr("y2", interval.yMax - this.dimensions.pixelsPerMillisecond)
                                        .attr("stroke", "white").attr("stroke-width", 4);
                this.svg.append('line') .attr("x1", currentX).attr("x2", currentX)
                                        .attr("y1", interval.yMin + this.dimensions.pixelsPerMillisecond).attr("y2", interval.yMax - this.dimensions.pixelsPerMillisecond)
                                        .attr("stroke", "black").attr("stroke-width", 4).attr("stroke-dasharray", 4);

                // in between the two traces
                if ( i !== this.traces.length - 1) {
                    currentX = this.bandWidth * (i + 1);
                    this.svg.append('line') .attr("x1", currentX).attr("x2", currentX)
                                            .attr("y1", interval.yMin + this.dimensions.pixelsPerMillisecond).attr("y2", interval.yMax - this.dimensions.pixelsPerMillisecond)
                                            .attr("stroke", "white").attr("stroke-width", 4);
                    this.svg.append('line') .attr("x1", currentX).attr("x2", currentX)
                                            .attr("y1", interval.yMin + this.dimensions.pixelsPerMillisecond).attr("y2", interval.yMax - this.dimensions.pixelsPerMillisecond)
                                            .attr("stroke", "black").attr("stroke-width", 4).attr("stroke-dasharray", 4);

                    
                    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
                    text.setAttribute('class', "timestamp");
                    text.setAttribute('x', "" + (currentX + (this.dimensions.pixelsPerMillisecond) ));
                    text.setAttribute('y', "" + (interval.yMin + (interval.yMax - interval.yMin) / 2));
                    text.setAttribute('dominant-baseline', "middle");
                    text.textContent = `${interval.timeSkipped}ms of inactivity`;
                    (this.svg.node()! as HTMLElement).appendChild( text );   
                }                                     

            }
        }

        // 4.

        // we want to keep track of which areas of the SVG we've drawn already (since we don't want to draw all at once and want to clear some afterwards)
        // we divide the entire SVG in vertical "ranges" that are 1 screen height large, then for example make sure there are always at least 3 or 4 of them drawn
        // In the scroll handler, we can use the rangeHeight to determine which of the ranges is currently "in view"
        // Here, we just prepare the range structs for later use
        this.rangeHeight = screen.height;
        this.renderedRanges = new Array<VerticalRange>();

        let currentRangeY = 0;
        let currentRangeIndex = 0;
        while ( currentRangeY < this.dimensions.height ){
            this.renderedRanges[currentRangeIndex] = {
                rendered: false,
                svgGroup: undefined,
                yMin: currentRangeY,
            }

            currentRangeY += this.rangeHeight;
            ++currentRangeIndex;
        }

        // 5.
        if ( this.scrollHandler !== undefined ){
            window.removeEventListener("scroll", this.scrollHandler);
            this.scrollHandler = undefined;
        }

        // scroll events are fired very quickly sometimes, don't want to try and render for each of them
        // we only fire on each 5th event but also add a timeout (typical "debounce"-alike) to make sure the final event gets used
        let scrollEventCount:number = 0;
        let scrollTimer:number | undefined = undefined;
        this.scrollHandler = (e) => {
           
           const execute = () => {
               scrollTimer = undefined;
               this.renderPartialExtents();
           };

           clearTimeout( scrollTimer );
           scrollTimer = setTimeout( execute, 250 ); // 250 ms

           ++scrollEventCount;
           if ( scrollEventCount % 5 === 0 ){ // 5 = magic number, from experimental experience in chrome, very scientific
               scrollEventCount = 0;
               clearTimeout( scrollTimer );
               execute();
           } 
       }

        window.addEventListener('scroll', this.scrollHandler);

        // TODO: also couple to window resize events? That should possibly trigger a full re-render, since the SVG can have changed width

        return true;
    }

    protected ensureMoreThanOneTrace() {

        if ( this.traces.length > 1 ){

            const originalCount = this.traces.length;

            // there can be several traces, but they might be the same, which we can't really handle
            // so: filter duplicates first
            this.traces = this.traces.filter((v,i) => this.traces.indexOf(v) === i); // keeps the first occurence, since indexOf always returns first index

            if ( this.traces.length !== originalCount ) {

                // Vue reactivity is a weird beast
                // setting this.selectedTraces = this.traces will NOT work, so we have to manually pop and push everything
                // TODO: simpler to just pass the config around... let's just do that, shall we? 
                while ( this.selectedTraces.length > 0 ) {
                    this.selectedTraces.pop();
                }

                for ( const trace of this.traces ){
                    this.selectedTraces.push( trace );
                }
                // this.selectedTraces = this.traces.slice(); // update selection UI
            }

            if ( this.traces.length  > 1 ) {
                return;
            }
        }

        if ( this.traces[0].parent.getConnections().length > 1 ){
            // traces.length is currently just 1, so we need to add its next sibling automatically as trace here 
            this.traces.push( this.traces[0].parent.getConnections()[1] );
            this.selectedTraces.push( this.traces[0].parent.getConnections()[1] );

            return;
        }

        // we cannot just visualize a single trace on a sequence diagram...
        // so we copy the trace and pretend like the copy is one from the other side
        const newTrace = this.traces[0].clone();
        newTrace.title = "Simulated, autogenerated trace : " + newTrace.title;
        newTrace.description = "Simulated, autogenerated trace : " + newTrace.description;

        // we have a single trace, we need to copy it so we can simulate client + server
        if ( this.traces[0].vantagePoint.type === qlog.VantagePointType.server || 
             this.traces[0].vantagePoint.flow === qlog.VantagePointType.server ){
            newTrace.vantagePoint.type = qlog.VantagePointType.client;
            newTrace.vantagePoint.flow = qlog.VantagePointType.unknown;
            this.traces.unshift( newTrace );
        }
        else if ( this.traces[0].vantagePoint.type === qlog.VantagePointType.client || 
                  this.traces[0].vantagePoint.flow === qlog.VantagePointType.client ){
            newTrace.vantagePoint.type = qlog.VantagePointType.server;
            newTrace.vantagePoint.flow = qlog.VantagePointType.unknown;
            this.traces.push( newTrace );
        }

        for ( const event of newTrace.getEvents() ){
            const type = newTrace.parseEvent(event).name;
            if ( type === qlog.TransportEventType.packet_sent ){
                newTrace.parseEvent(event).name = qlog.TransportEventType.packet_received;
            }
            if ( type === qlog.TransportEventType.packet_received ){
                newTrace.parseEvent(event).name = qlog.TransportEventType.packet_sent;
            }

            // TODO: are there other events that should be changed? probably some that should be filtered out? e.g., all non transport/H3-related things? 
        }

        // deal with weird Vue Reactivity, see above
        while ( this.selectedTraces.length > 0 ) {
            this.selectedTraces.pop();
        }
        for ( const trace of this.traces ){
            this.selectedTraces.push( trace );
        }
    }

    protected createPrivateNamespace(obj:any):void {
        if ( obj.qvis === undefined ) {
            Object.defineProperty(obj, "qvis", { enumerable: false, value: {} });
        }

        if ( obj.qvis.sequencediagram === undefined ) {
            obj.qvis.sequencediagram = {};
        }
    }

    protected calculateCoordinates(traces:Array<QlogConnection>):number {

        const pixelsPerMillisecond = this.dimensions.pixelsPerMillisecond;

        // we have n traces, each with their own timestamped events
        // we want to map these on a single conceptual sequence diagram, so that the same timestamps line up correctly on the y-axis, but still have a single vertical timeline per-trace
        // we also want to cut out long periods of inactivity and prevent overlaps (e.g., for many packets at the same timestamp)
        // To do this, we have to calculate the y-coordinates as we go, accumulting to prevent overlaps, skipping large idle periods and keeping things in-sync between traces
        // the simplest way to do this would be to merge all the traces into 1 big event log, ordered by timestamp
        // However, since the traces can get quite big, we don't want to do this, as it would use -a lot- of memory
        // So instead we perform a naive online k-way merge (so without actually moving to new memory) to process the events in their timestamp order
        // https://en.wikipedia.org/wiki/K-way_merge_algorithm
        const heads:Array<number> = new Array<number>( traces.length ).fill(0); // points to the current index of each trace we're looking at
        const trackers:Array< CoordinateTracker > = new Array<CoordinateTracker>();

        for ( const trace of traces ){
            const tracker:CoordinateTracker = {
                timestamp: 0,
                y: 0,
            }
            trackers.push( tracker );
        }

        let done = false;
        let doneCount = 0;

        let maxY = 0;

        let currentTimestampUnderConsideration:number = -1;
        let currentY:number = this.dimensions.margin.top;
        let inOverlapPreventionMode:boolean = false;
        let previousMinimumTrace:number = 0; // only needed for overlap prevention


        this.shortenedIntervals = new Array<Interval>();

        while ( !done ) {
            let currentMinimumTrace:number = -1;
            let currentMinimumTime:number = Number.MAX_VALUE;
            let currentMinimumEvent:any;

            for ( let t = 0; t < traces.length; ++t ){
                if ( heads[t] === -1 ) { // means that array has been processed completely
                    continue;
                }

                const evt = traces[t].getEvents()[ heads[t] ];
                const time = traces[t].parseEvent(evt).time;
                
                // < instead of <= so we always favor rendering a single trace as long as possible before switching to the next. 
                // Important for overlap prevention.
                if ( time < currentMinimumTime ){ 
                    currentMinimumTrace = t;
                    currentMinimumTime = time;
                    currentMinimumEvent = evt;
                }
            }

            // goals:
            // 1. prevent long stretches of empty vertical space : replace those with shorter parts
            //  -> need to detect when these happen and adjust accordingly
            //  -> because we look for the minimum across traces each time, this is easy: if there is too large a margin between the new and old, everything is shifted down
            // 2. prevent overlapping of events on the same timeline (can overlap horizontally in different timelines)
            //  -> need to both keep track of overlaps on the same timeline, and make sure all timelines shift down when one of them does 
            //  -> this is more involved and requires separate tracking structs per-timeline ("trackers")

            // need to keep a running total per-timeline: (lastTimestamp + lastActualY)
            //  -> currentTimestamp - lastTimestamp is then what we use for our logic
            //  -> lastActualY + (timestampDiff * pixelsPerMilliSecond) is then what we need
            //  -> if we then skip a range, we need to not just do timeStampDiff * pixelsPerMillisecond, but apply a scaling factor to that
            //  -> if we then have overlap prevention, we keep timestamp the same, update only lastActualY. 
            //          The moment we have a new timestamp, we make all lastActualY's the same (and also timestamps?)

            // we render in milliseconds, so the overlap is on millisecond resolution
            // however, the times are floats, so we need to round them
            const currentTimeBucket = Math.floor( currentMinimumTime );

            // 2. prevent overlaps
            // Example of what can happen:
            // | 105            | 105           |           | 105   
            // | 105            |               |           | 105   
            // | 105            |               |           | 105   
            // | 105            |               |           |       
            // | 105            |               |           |       
            // 4 timelines, of which 3 have events all at timeBucket 105
            // we cannot just render all the 105 events from trace 1, then those of 2, etc.
            // so in this case, we need to keep track when we started the overlaps (tracker.y)
            // then render all events of the 1st trace. When that's done, we render those of trace 2, etc.
            // setting currentY to the currentMinimumTrace's tracked Y ensures that we "reset" to the y where the overlaps began for each trace in turn
            // then, when timestamp > 105 starts, we exit this mode and just use the maximum of the tracked Y's as new currentY 
            // (in this case the one for the 1st trace)
            if ( currentTimeBucket === currentTimestampUnderConsideration ){

                // 2 options:
                //  1) either this is the first and we need to initiate the trackers
                //  2) or we're in a stretch of overlaps and need to continue;
                
                // 1)
                if ( !inOverlapPreventionMode ) {
                    inOverlapPreventionMode = true;


                    // problem: when we get here, it's basically the 2nd event in the same timebucket
                    // we've already drawn the 1st event at currentY
                    // so if we now set all tracks to currentY and then do + pixelsPerMillisecond on all (see below), the 1st track will be "one ahead" of the rest
                    // so, make sure the other lines "undo" that first increment here 
                    // NOTE: I'm sure there's a cleaner way of doing this, but it's not coming to monday-morning-me
                    for ( let t = 0; t < trackers.length; ++t ){
                        if ( t !== previousMinimumTrace ){
                            trackers[t].y = currentY - pixelsPerMillisecond;
                        }
                        else {
                            trackers[t].y = currentY;
                        }
                    }

                    // for (const tracker of trackers) {
                    //     tracker.y = currentY;
                    // }

                }

                // 2)
                // time remains the same, but we can have switched traces, so need to select the correct starting Y
                trackers[currentMinimumTrace].y += pixelsPerMillisecond;
                currentY = trackers[currentMinimumTrace].y;
            }
            else if ( inOverlapPreventionMode ){ 

                // we previously had overlaps, but now we're onto the next Timestamp bucket: need to update everyone + exit mode
                inOverlapPreventionMode = false;

                let maxTrackerY = 0;
                for (const tracker of trackers) {
                    if ( tracker.y > maxTrackerY ){
                        maxTrackerY = tracker.y;
                    }
                }

                currentY = maxTrackerY;
            }

            const timeDifference = (currentTimeBucket - currentTimestampUnderConsideration);

            // 1. check for longer stretches on inactivity and compress them
            // do this after 2., since otherwhise this offset can be overridden by exiting overlapPreventionMode
            if ( timeDifference * pixelsPerMillisecond > this.dimensions.shortenIntervalsLongerThan ) { // max space of 120 pixels allowed
                this.shortenedIntervals.push({
                    yMin: currentY,
                    yMax: currentY + this.dimensions.shortenIntervalsLongerThan,
                    timeSkipped: currentTimeBucket - currentTimestampUnderConsideration,
                });
                
                currentY += this.dimensions.shortenIntervalsLongerThan;
            }
            else {
                // this is the default behaviour, just render the next event directly relative to the previous one
                currentY += timeDifference * pixelsPerMillisecond;
            }

            

            this.createPrivateNamespace(currentMinimumEvent);
            (currentMinimumEvent as any).qvis.sequencediagram.y = currentY; // traces[currentMinimumTrace].parseEvent(currentMinimumEvent).time * pixelsPerMillisecond;

            // console.log("Next event was : ", (currentMinimumEvent as any).qvis.sequencediagram.y, currentMinimumTrace, currentMinimumValue);

            // prepare for next loop
            currentTimestampUnderConsideration = currentTimeBucket;
            previousMinimumTrace = currentMinimumTrace;

            heads[ currentMinimumTrace ] += 1;
            if ( heads[currentMinimumTrace] >= traces[currentMinimumTrace].getEvents().length ) {
                heads[ currentMinimumTrace ] = -1;
                ++doneCount;
            }

            done = doneCount === traces.length;

            maxY = currentY;
        }

        // let DEBUG_penultimateEvent = traces[0].getEvents()[ traces[0].getEvents().length - 1 ];
        // let DEBUG_lastEvent = DEBUG_penultimateEvent.slice();
        // this.createPrivateNamespace( DEBUG_lastEvent );
        // (DEBUG_lastEvent as any).qvis.sequencediagram.y = (DEBUG_penultimateEvent as any).qvis.sequencediagram.y + 1000;
        // traces[0].getEvents().push( DEBUG_lastEvent );
        // maxY += 1000;


        maxY += this.dimensions.margin.bottom; // give a bit of breathing room at the bottom of the diagram

        return maxY;
    }

    protected calculateConnections() {
        // we want to draw arrows between PACKET_* events 
        // arrow starts from PACKET_SENT and goes to PACKET_RECEIVED
        // we do 2 passes: 1 from left to right (client to server), 1 from right to left (server to client)
        // because we can have intermediate network-traces, we need to take into account their individual perspectives
        // as such, we process in the two directions to be able to do that correctly

        const connectEventLists = (metadataTargetProperty:arrowTargetProperty, start:QlogConnection, startEvents:Array<IQlogRawEvent>, end:QlogConnection, endEvents:Array<IQlogRawEvent>) => {

            // start.parseEvent() looks up the eventparser using this.eventParser, which is a Vue ReactiveGetter, which is -slow-...
            // so, create our own references to the parsers here, which is faster
            const startParser = start.getEventParser();
            const endParser   = end.getEventParser();

            let DEBUG_packetLostCount = 0;

            // for each of the events in our starting trace, we need to see if we can find an accompanying event in the ending trace
            // however, the naive way of doing this is O(n * n), which turns out to be too slow for large traces
            // so, we're going to use some domain knowledge and heuristics to speed this up
            // We know all events are ordered by timestamp and that QUIC packet numbers are monotonically increasing
            // So when looking for the counterpart for packet 5000, we -probably- don't need to start all the way from the bottom, or go to packet 15000
            // We keep track of the previously found packet and look in 10% before and 10% after increments 
            // (if it's outside that, there is massive jitter anyway, and the use of this visualization is debatable)
            // this approach allowed us to go from 7s to < 600ms for a 3.5MB trace
            // TODO: speed up even more by skipping packet numbers that have a PACKET_LOST event

            let lastFoundTargetIndex:number = 0;
            const endEventsFraction:number = Math.min(1000, Math.max(200, Math.round(endEvents.length / 10))); // 10% each way, minimum of 200 events, max of 1000

            for ( const rawevt of startEvents ){
                const evt = startParser.load(rawevt).data as qlog.IEventPacketSent;
                const metadata = (rawevt as any).qvis.sequencediagram; 

                if ( !evt.header!.packet_number ){
                    console.error("SequenceDiagram:calculateConnections : event does not have the header.packet_number field, which is required", evt);
                    continue;
                }

                metadata[arrowTargetProperty.right] = undefined; // could be set from a previous processing, which might no longer be correct now (e.g., new trace in the middle)
                metadata[arrowTargetProperty.left]  = undefined;
                // evt.header!.packet_number = "DEBUG_FORCELOSS";

                const startCandidateIndex:number = Math.max( 0,                    lastFoundTargetIndex - endEventsFraction ); // go back 10% events, but not lower than 0
                const endCandidateIndex:number   = Math.min( endEvents.length - 1, lastFoundTargetIndex + endEventsFraction ); // go forward 10% events, but not beyond the array length


                for ( let c = startCandidateIndex; c <= endCandidateIndex; ++c ) {
                    // note : event can be either sent or received, but interfaces are the same, so doesn't matter atm
                    // TODO: define separate interface for this in the qlog schema!
                    const candidate = endParser.load( endEvents[c] ).data as qlog.IEventPacketReceived; 
                    
                    // need to check for .type as well to deal with different packet number spaces
                    if (candidate.type === evt.type && candidate.header!.packet_number === evt.header!.packet_number ){
                        metadata[metadataTargetProperty] = endEvents[c];
                        lastFoundTargetIndex = c;
                        break;
                    }
                }

                if ( metadata[metadataTargetProperty] === undefined ){
                    DEBUG_packetLostCount++;
                }
            }
        };

        const connectTraces = (metadataTargetProperty:arrowTargetProperty, start:QlogConnection, end:QlogConnection) => {

            let startPerspective = start.vantagePoint.type;
            let endPerspective = end.vantagePoint.type;

            if ( startPerspective === qlog.VantagePointType.network ){
                startPerspective = start.vantagePoint.flow as qlog.VantagePointType;
            }
            if ( endPerspective === qlog.VantagePointType.network ){
                endPerspective = end.vantagePoint.flow as qlog.VantagePointType;
            }

            const startEventType = qlog.TransportEventType.packet_sent;
            const endEventType = (startPerspective === endPerspective ) ? qlog.TransportEventType.packet_sent : qlog.TransportEventType.packet_received;

            const startEvents = start.lookup( qlog.EventCategory.transport, startEventType );
            const endEvents = end.lookup( qlog.EventCategory.transport, endEventType );

            if ( startEvents.length === 0 ) { 
                console.error("SequenceDiagram:calculateConnections : trace " + start.parent.filename + ":" + startPerspective + " did not have " + startEventType + " events, which are needed");
            }
            if ( endEvents.length === 0 ) { 
                console.error("SequenceDiagram:calculateConnections : trace " + end.parent.filename + ":" + endPerspective + " did not have " + endEventType + " events, which are needed");
            }

            connectEventLists( metadataTargetProperty, start, startEvents, end, endEvents );
        };

        // packets flowing from client to server (left to right)
        for ( let t = 0; t < this.traces.length - 1; ++t ){ // to -1, because rightmost is handled separately below
            const start = this.traces[t];
            const end   = this.traces[t + 1];

            connectTraces(arrowTargetProperty.right, start, end);
        }

        // packets flowing from server to client (right to left)
        for ( let t = this.traces.length - 1; t > 0; --t ) { // > 0 because leftmost was handled above
            const start = this.traces[t];
            const end   = this.traces[t - 1];

            connectTraces(arrowTargetProperty.left, start, end);

        }
    }

    protected async renderPartialExtents(){

        // About rendering performance:
        // - simply using d3 directly and creating all the svg shapes in 1 big loop is very slow for large files (>10s)
        //      - main bottlenecks are Major GCs (apparently .appendChild and .createElement creates tons of garbage...) but also "recalculate style" and "layout"
        //      - adding elements to an svg element that is already in the DOM tree is slower than adding them to a sepate svg element (via d3.create) but not much
        //      - adding elements in a time-sliced way (e.g., pause 100ms after every 2000 events) works, but we still see very high reflow/layout costs (>200ms per batch)
        //      - using documentFragment does nothing (very similar to adding to an SVG that's not in the DOM tree yet)
        // - doing svg elements without d3: is somewhat faster (say 8s -> 6s) and seems to induce less garbage collection: recommended
        // - doing canvas : just 1s to draw and render everything... there's really no competition

        // HOWEVER: canvas does not allow us to interact with individual elements directly and is not scalable
        // while both these problems can be solved, it would take much time. 
        // As such, we reserve the canvas method for visualizations that really -need- to draw that many objects at once (e.g., the congestion diagram)
        // For diagrams such as the sequence timelines, we will never be showing everything at once, so we can get by with drawing only the visible parts at a time
        // The following implementation only draws the current viewport + the ones above and below it (for smoother scrolling)
        // Next to this, it actively removes/un-renders old data. This is because on eof the main bottlenecks is the "recalculate style" and "layout" steps from the browser
        // These scale super-linearly with the amount of objects in the DOM (not just the newly added ones) so we need to keep the total amount down to remove that bottleneck

        // TODO: add a "save to SVG" option that -does- draw everything at once (at the cost of the user having to wait a while)


        // 1. determine which areas to render and which to un-render
        // 2. un-render the proper ranges
        // 3. render the proper ranges

        const svg = this.svg;

        // 1. 

        // want to calculate to the visible area of our svg
        // this turned out to be quite non-trivial... there is no default API for this
        // - would be easy of we're always filling the screen and our element is the only one: yMin = window.pageYOffset ( = basically scrollTop)
        // - however, our element is in some container, so we need to calculate how far down we are (offsetFromDocumentTop) and take that into account.
        //   -> this becomes interesting, because as we scroll, we scroll fully into view with our svg, 
        //      so that's why we use Math.max: as soon as the offset is negative, means we are fully into the viewport)
        // - then, calculating yMax, we need to again take into account that we don't always fill the entire screen: cannot just do yMin + window.innerHeight
        //   -> we use Math.max again: when svgRect.top becomes negative, we're screen filling, so we default to the full height
        const svgRect = (svg.node()! as Element).getBoundingClientRect();
        const offsetFromDocumentTop = svgRect.top - document.body.getBoundingClientRect().top;
        const yMin = Math.max(0, window.pageYOffset - offsetFromDocumentTop);
        const yMax = yMin + (window.innerHeight - Math.max(0, svgRect.top));

        // see if we need to render ranges at this time
        const currentRangeIndex = Math.floor(yMin / this.rangeHeight);
        const fromRange         = Math.max(0,                              currentRangeIndex - 1);
        const toRange           = Math.min(this.renderedRanges.length - 1, currentRangeIndex + 1);

        // we need to go from ranges to actual [yMin, yMax] "extents" that we can render
        const extentsToRender:Array< ExtentInfo > = new Array< ExtentInfo >();

        // TODO: do we really need ExtentInfo? why not just store the stop in the range and keep array of ranges?
        for ( let r = fromRange; r <= toRange; ++r ){
            if ( !this.renderedRanges[r].rendered ){
                extentsToRender.push( { rangeIndex: r, start: this.renderedRanges[r].yMin, stop: this.renderedRanges[r].yMin + this.rangeHeight - 1} ); // -1 to prevent overlap with next range
            }
        }

        // see if we need to un-render ranges at this time
        const rangeIndicesToRemove:Array< number > = new Array< number >();
        // first determine the lower indices
        let removeFrom:number = Math.max(0, fromRange - 500);
        let removeTo:number   = Math.max(0, fromRange - 2); // leave 1 extra buffer of rendered range
        if ( !(removeFrom === 0 && removeTo === 0) ){ // don't want to remove range 0 if it's the only one
            for ( let r = removeFrom; r <= removeTo; ++r ){
                if ( this.renderedRanges[r].rendered ){
                    rangeIndicesToRemove.push( r );
                }
            }
        }
        // then the higher indices (when scrolling back up)
        removeFrom  = Math.min(this.renderedRanges.length - 1, toRange + 2); // leave 1 extra buffer of rendered range
        removeTo    = Math.min(this.renderedRanges.length - 1, toRange + 500);
        if ( !(removeFrom === this.renderedRanges.length - 1 && removeTo === this.renderedRanges.length - 1) ){ // don't want to remove the last range if it's the only one
            for ( let r = removeFrom; r <= removeTo; ++r ){
                if ( this.renderedRanges[r].rendered ){
                    rangeIndicesToRemove.push( r );
                }
            }
        }

        // 2. 
        if ( rangeIndicesToRemove.length >= 1 ){
            // console.log("rangesToRemove", currentRangeIndex, rangeIndicesToRemove);

            // when rendering, we group all elements of a single range/extent together in 1 group (range.svgGroup)
            for ( const rangeIndex of rangeIndicesToRemove ) {
                const rangeSvgGroup = this.renderedRanges[rangeIndex].svgGroup;
                // console.log("Removing", rangeSvgGroup, (rangeSvgGroup as any).parentNode);

                (rangeSvgGroup as any).parentNode.removeChild( rangeSvgGroup );

                this.renderedRanges[rangeIndex].svgGroup = undefined;
                this.renderedRanges[rangeIndex].rendered = false;
            }
        }

        // nothing new to render, so we can stop
        // can happen e.g., if user only scrolls small area
        if ( extentsToRender.length === 0 ){
            return;
        }

        // 3.


        // console.log("Actual coordinates to render", extentsToRender);

        /*
        const svg = d3.create("svg").attr("id", this.svgID);
        svg.attr("xmlns", "http://www.w3.org/2000/svg")
            .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
            .attr("font-family", "Trebuchet MS");
        */

        const pixelsPerMillisecond = this.dimensions.pixelsPerMillisecond;

        const output = '';

        for ( const extent of extentsToRender ){

            const extentContainer = document.createElementNS("http://www.w3.org/2000/svg", "g");
            this.renderedRanges[extent.rangeIndex].svgGroup = extentContainer;
            this.renderedRanges[extent.rangeIndex].rendered = true;

            for ( let i = 0; i < this.traces.length; ++i ){
                const trace = this.traces[i];
                const currentX = this.bandWidth * i + (this.bandWidth * 0.5); // center of the horizontal band

                const events = trace.getEvents();
                
                let currentY = 0;
                let currentMetadata = undefined;
                for ( const rawEvt of events ){
                    const evt = trace.parseEvent(rawEvt);
                    currentMetadata = (rawEvt as any).qvis.sequencediagram;
                    currentY = currentMetadata.y;

                    if ( currentY < extent.start ) {
                        continue;
                    }

                    if ( currentY > extent.stop ) {
                        break;
                    }

                    // rect for each event on the vertical timelines
                    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
                    const rectSize = pixelsPerMillisecond * 0.6;
                    rect.setAttribute('x', "" + (currentX - rectSize / 2));
                    rect.setAttribute('y', "" + (currentY - rectSize / 2)); // x and y are top left, we want it to be middle
                    rect.setAttribute('width', ""  + (rectSize));
                    rect.setAttribute('height', "" + (rectSize));
                    rect.setAttribute('fill', 'green');
                    rect.onclick = (evt_in) => { alert("Clicked on " + JSON.stringify(rawEvt)); };
                    extentContainer.appendChild( rect );

                    // timestamp for each event next to the rects
                    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
                    text.setAttribute('class', "timestamp");
                    text.setAttribute('x', "" + (currentX - (pixelsPerMillisecond / 2) + ((i === 0) ? -pixelsPerMillisecond * 2 : pixelsPerMillisecond * 2)));
                    text.setAttribute('y', "" + (currentY));
                    text.setAttribute('dominant-baseline', "middle");
                    text.setAttribute('text-anchor', (i === 0) ? "end" : "start");
                    text.textContent = "" + evt.time.toFixed(2);
                    extentContainer.appendChild( text );

                    // TODO: now we're using left and right and client is always left, server always right
                    // could make this more flexible if each event would also store their x-coordinate, rather than only y

                    // full connecting arrows between events
                    let target:any|undefined = undefined;
                    let offsetMultiplier:number|undefined = undefined;
                    let directionText:string|undefined = undefined;
                    let directionColor:string|undefined = undefined;
                    if  (currentMetadata[ arrowTargetProperty.right ] ){
                        offsetMultiplier = 1;
                        target = (currentMetadata[ arrowTargetProperty.right ] as any).qvis.sequencediagram;
                        directionText = ">";
                        directionColor = "#0468cc"; // blue
                    }
                    else if ( currentMetadata[ arrowTargetProperty.left ] ){
                        offsetMultiplier = -1;
                        target = (currentMetadata[ arrowTargetProperty.left ] as any).qvis.sequencediagram;
                        directionText = "<";
                        directionColor = "#a80f3a"; // red
                    }

                    if ( offsetMultiplier ) { // if not, the current event does not have a connecting arrow
                        let targetX = currentX + ( offsetMultiplier * this.bandWidth ); // either move 1 band to the right or left, depending on arrow direction
                        targetX = targetX - (offsetMultiplier! * (pixelsPerMillisecond / 2)); // don't overlap with the event rect
                        
                        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
                        line.setAttribute('x1', "" + (currentX));
                        line.setAttribute('x2', "" + (targetX));
                        line.setAttribute('y1', "" + (currentY)); 
                        line.setAttribute('y2', "" + (target.y));
                        line.setAttribute('stroke-width', '2');
                        line.setAttribute('stroke', directionColor!);
                        extentContainer.appendChild( line );

                        // polyline expects a list of x,y coordinates
                        // we draw the arrow as normal (across the "x-axis" to the right: >), then rotate it along the connecting line

                        const arrowX = targetX; 
                        let points = "";
                        points +=  `${arrowX - 10},${target.y - 10}`; // top point
                        points += ` ${arrowX     },${target.y     }`; // center point
                        points += ` ${arrowX - 10},${target.y + 10}`; // bottom point

                        // https://stackoverflow.com/questions/2676719/calculating-the-angle-between-the-line-defined-by-two-points
                        const deltaY = currentY - target.y;
                        const deltaX = targetX  - currentX;
                        let angle = Math.atan2(deltaY, deltaX) * 180 / Math.PI; 
                        angle = -angle; // svg's rotate has the convention that clockwise rotations are positive angles, counterclockwise are negative. 

                        const arrow = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
                        arrow.setAttribute('points', points);
                        arrow.setAttribute('stroke-width', '4');
                        arrow.setAttribute('stroke', directionColor!);
                        arrow.setAttribute('fill', 'transparent');
                        arrow.setAttribute('transform', `rotate(${angle},${arrowX},${target.y})`);
                        extentContainer.appendChild( arrow );

                        // make the text 90% of the width of the arrow
                        const textWidth = Math.sqrt( Math.pow( targetX - currentX, 2) + Math.pow( target.y - currentY, 2) ) * 0.9;
                        const textHeight = pixelsPerMillisecond * 0.9; // bit smaller so we have some padding at least
                        let textAngle = angle;
                        // angle for the arrow can go to any value, for text we still want it to be readable (i.e., not upside down)
                        // value of 90 is basically further than -90 on the goniometric circle, aka upside down
                        // so if we go over that, compensate by swivveling to the other side
                        // dito for -90
                        if ( textAngle >= 90 ){
                            textAngle -= 180;
                        }
                        else if ( textAngle <= -90 ){
                            textAngle += 180;
                        }

                        const midwayX = (currentX + targetX ) / 2;
                        const midwayY = (currentY + target.y) / 2;

                        // getting different colored text spans next to each other in SVG requires -manual- positioning (yes, even though it's 2019)
                        // as such, we take the dirty route and use foreignObject so we can use the HTML layouting engine
                        const textForeign = document.createElementNS("http://www.w3.org/2000/svg", "foreignObject");
                        textForeign.setAttribute('x', "" + (midwayX));
                        textForeign.setAttribute('y', "" + (midwayY)); 
                        textForeign.setAttribute('width',  "" + textWidth);
                        textForeign.setAttribute('height', "" + textHeight); 
                        textForeign.style.overflow = "visible";
                        // order of the transformation is important here!
                        // we first rotate the top left corner of the text area around the midway point (which is also where it's positioned) so we get the correct rotation
                        // then we translate the entire rect within this rotated coordinate space (doing it the other way around would translate in worldspace, not what we want)
                        textForeign.setAttribute('transform', `rotate(${textAngle},${midwayX},${midwayY}) translate(${-textWidth / 2},${-textHeight - 3})`);  // 

                        const textContainer = document.createElementNS("http://www.w3.org/1999/xhtml", "div");
                        textContainer.style.width = "" + textWidth + "px";
                        textContainer.style.textAlign = "center";

                        if ( directionText === "<" ){
                            const smallArrowSize = Math.floor(textHeight * 0.30);
                            const directionSpan = document.createElement("span");
                            directionSpan.style.display = "inline-block";
                            directionSpan.style.borderTop = `${smallArrowSize}px solid transparent`;
                            directionSpan.style.borderBottom = `${smallArrowSize}px solid transparent`;
                            directionSpan.style.borderRight = `${smallArrowSize}px solid ${directionColor}`;
                            directionSpan.style.marginRight = "1px";
                            textContainer.appendChild(directionSpan);
                        }

                        const textSpanFront = document.createElement("span");
                        textSpanFront.textContent = "" + evt.data.type + " : " + evt.data.header.packet_number;
                        textSpanFront.style.color = "#383d41"; // dark grey
                        textSpanFront.style.backgroundColor = "#d6d8db"; // light grey
                        textSpanFront.style.paddingLeft = "5px";
                        textSpanFront.style.paddingRight = "5px";
                        textSpanFront.style.border = "1px white";
                        textSpanFront.style.borderStyle = "none solid";
                        textSpanFront.style.fontSize = "" + ( Math.floor(textHeight * 0.8) ) + "px";
                        textSpanFront.onclick = (evt_in) => { alert("Clicked on " + JSON.stringify(rawEvt)); };
                        textContainer.appendChild(textSpanFront);

                        for ( const frameRaw of evt.data.frames ) {
                            const frame = frameRaw as qlog.QuicFrame;

                            const textSpan = document.createElement("span");
                            const [bgColor, textColor] = this.frameTypeToColor( frame.frame_type );
                            textSpan.textContent = this.frameToShortString( frame );
                            textSpan.style.color = textColor;
                            textSpan.style.backgroundColor = bgColor;
                            textSpan.style.paddingLeft = "5px";
                            textSpan.style.paddingRight = "5px";
                            textSpan.style.border = "1px white";
                            textSpan.style.borderStyle = "none solid";
                            textSpan.style.fontSize = "" + ( Math.floor(textHeight * 0.8) ) + "px";
                            textSpan.onclick = (evt_in) => { alert("Clicked on " + JSON.stringify(rawEvt)); };
                            if ( directionText === ">" ) {
                                textContainer.prepend(textSpan);
                            }
                            else {
                                textContainer.appendChild(textSpan);
                            }
                        }

                        if ( directionText === ">" ){
                            const smallArrowSize = Math.floor(textHeight * 0.30);
                            const directionSpan = document.createElement("span");
                            directionSpan.style.display = "inline-block";
                            directionSpan.style.borderTop = `${smallArrowSize}px solid transparent`;
                            directionSpan.style.borderBottom = `${smallArrowSize}px solid transparent`;
                            directionSpan.style.borderLeft = `${smallArrowSize}px solid ${directionColor}`;
                            directionSpan.style.marginLeft = "1px";
                            textContainer.appendChild(directionSpan);
                        }


                        textForeign.appendChild( textContainer );
                        extentContainer.appendChild( textForeign );

                        // <g class="clickable" v-bind:transform="'translate(200,' + (y_coord - 5) + ') rotate(' + angle + ')'" v-if="clientsend">

                        // </g>


                        // centerpoint_text(){
                        //     // see ArrowInfo for how the text is translated. These values are based on x-translates of 200 and 450
                        //     // this is basically a LERP of the y-value across the line at the correct percentage 
                        //     if (this.clientsend)
                        //         return this.y_receive * 0.0714285; // starts at 200, which is 50 more than the start of 150. total x-range is 850 - 150 = 700. 50/700 = 0.0714285
                        //     else
                        //         return this.y_receive * 0.5714286;// starts at 450, 300 more than the start of 150:  400/700 = 0.5714286
                        // },



                    }

                    


                }
            }

            (svg.node()! as HTMLElement).appendChild( extentContainer );
        }
    
        // const DEBUG_renderedRanges = this.renderedRanges.filter( (range) => range.rendered );
        // console.log("Actually rendered ranges at this point: ", DEBUG_renderedRanges.length, DEBUG_renderedRanges);
    }

    protected frameTypeToColor( frameType:qlog.QUICFrameTypeName ) : Array<string>{

        if ( this.frameTypeToColorLUT.size === 0 ){

            this.frameTypeToColorLUT.set( qlog.QUICFrameTypeName.ack,       ["#03ad25", "#FFFFFF"] ); // green
            this.frameTypeToColorLUT.set( qlog.QUICFrameTypeName.stream,    ["#0468cc", "#FFFFFF"] ); // blue
            this.frameTypeToColorLUT.set( qlog.QUICFrameTypeName.crypto,    ["#0468cc", "#FFFFFF"] ); // blue

            this.frameTypeToColorLUT.set( qlog.QUICFrameTypeName.padding,   ["#ff69b4", "#FFFFFF"] ); // pink

            this.frameTypeToColorLUT.set( qlog.QUICFrameTypeName.connection_close,  ["#a80f3a", "#FFFFFF"] ); // dark red
            this.frameTypeToColorLUT.set( qlog.QUICFrameTypeName.reset_stream,      ["#a80f3a", "#FFFFFF"] ); // dark red
            this.frameTypeToColorLUT.set( qlog.QUICFrameTypeName.application_close, ["#a80f3a", "#FFFFFF"] ); // dark red
            this.frameTypeToColorLUT.set( qlog.QUICFrameTypeName.stop_sending,      ["#a80f3a", "#FFFFFF"] ); // dark red

            this.frameTypeToColorLUT.set( qlog.QUICFrameTypeName.new_connection_id,      ["#068484", "#FFFFFF"] ); // dark green
            this.frameTypeToColorLUT.set( qlog.QUICFrameTypeName.retire_connection_id,   ["#068484", "#FFFFFF"] ); // dark green


            this.frameTypeToColorLUT.set( qlog.QUICFrameTypeName.ping,              ["#d6dd02", "#FFFFFF"] ); // ugly yellow
            this.frameTypeToColorLUT.set( qlog.QUICFrameTypeName.path_challenge,    ["#d6dd02", "#FFFFFF"] ); // ugly yellow
            this.frameTypeToColorLUT.set( qlog.QUICFrameTypeName.path_response,     ["#d6dd02", "#FFFFFF"] ); // ugly yellow

            this.frameTypeToColorLUT.set( qlog.QUICFrameTypeName.max_data,              ["#5f0984", "#FFFFFF"] ); // dark purple
            this.frameTypeToColorLUT.set( qlog.QUICFrameTypeName.max_stream_data,       ["#5f0984", "#FFFFFF"] ); // dark purple
            this.frameTypeToColorLUT.set( qlog.QUICFrameTypeName.max_streams,           ["#5f0984", "#FFFFFF"] ); // dark purple
            this.frameTypeToColorLUT.set( qlog.QUICFrameTypeName.data_blocked,          ["#5f0984", "#FFFFFF"] ); // dark purple
            this.frameTypeToColorLUT.set( qlog.QUICFrameTypeName.streams_blocked,       ["#5f0984", "#FFFFFF"] ); // dark purple
            this.frameTypeToColorLUT.set( qlog.QUICFrameTypeName.stream_data_blocked,   ["#5f0984", "#FFFFFF"] ); // dark purple
        }

        if ( this.frameTypeToColorLUT.has( frameType ) ){
            return this.frameTypeToColorLUT.get( frameType )!;
        }
        else {
            return ["#FF0000", "#FFFFFF"];
        }
    }

    protected frameToShortString( frame:qlog.QuicFrame ){
        let output = "";
        switch ( frame.frame_type ){
            case qlog.QUICFrameTypeName.ack:
                output = frame.frame_type + " ";
                const ranges = frame.acked_ranges;
                for ( let r = 0; r < ranges.length; ++r  ){
                    if ( ranges[r][0] !== ranges[r][1] ){
                        output += ranges[r][0] + "-" + ranges[r][1];
                    }
                    else{
                        output += ranges[r][0];
                    }
                    if ( r < ranges.length - 1 ){
                        output += ","
                    }
                }

                return "" + output;
                break;

            case qlog.QUICFrameTypeName.stream:
                return frame.frame_type + " " + frame.id + ((frame.fin) ? " FIN" : "");
                break;


            case qlog.QUICFrameTypeName.connection_close:
                output = frame.frame_type + " ";
                if (frame.error_code === qlog.TransportError.no_error || frame.error_code === qlog.ApplicationError.http_no_error || frame.error_code === 0) {
                    output += ": clean";
                }
                else{
                    output += frame.error_code + " : " + frame.reason;
                }
                
                return output;
                break;

            default:
                return frame.frame_type;
                break;
        }
    }

}


