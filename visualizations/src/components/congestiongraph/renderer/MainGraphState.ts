import { ScaleLinear, Axis, Selection, BaseType, BrushBehavior } from "d3";

export class MainGraphState {
    /* Fields */
    public eventBus: HTMLSpanElement | null = null; // A dummy DOM element which is used to fire off custom events
    /*
        Events:
            - packetSelectionEvent
            - packetPickEvent
    */

    public outerWidth = window.innerWidth;
    public outerHeight = 600;
    public margins = {
        top: 20,
        bottom: 60,
        left: 70,
        right: 70,
    };
    public innerWidth: number;
    public innerHeight: number;

    public graphSvg: Selection<SVGGElement, unknown, HTMLElement, any> | null = null;
    public canvas: Selection<HTMLCanvasElement, unknown, HTMLElement, any> | null = null;
    public canvasContext: CanvasRenderingContext2D | null = null;
    public mouseHandlerPanningSvg: Selection<BaseType, unknown, HTMLElement, any> | null = null;
    public mouseHandlerBrushXSvg: Selection<BaseType, unknown, HTMLElement, any> | null = null;
    public mouseHandlerBrush2dSvg: Selection<BaseType, unknown, HTMLElement, any> | null = null;
    public mouseHandlerSelectionSvg: Selection<BaseType, unknown, HTMLElement, any> | null = null;
    public mouseHandlerPickSvg: Selection<BaseType, unknown, HTMLElement, any> | null = null;
    public mouseHandlerRulerSvg: Selection<BaseType, unknown, HTMLElement, any> | null = null;
    public brushX: BrushBehavior<unknown> | null = null;
    public brushXElement: Selection<SVGGElement, unknown, HTMLElement, any> | null = null;
    public brush2d: BrushBehavior<unknown> | null = null;
    public brush2dElement: Selection<SVGGElement, unknown, HTMLElement, any> | null = null;
    public selectionBrush: BrushBehavior<unknown> | null = null;
    public packetInformationDiv: Selection<BaseType, unknown, HTMLElement, any> | null = null;
    public congestionGraphEnabled = true;

    public useSentPerspective = true;

    public gxAxis: Selection<SVGGElement, unknown, HTMLElement, any> | null = null;
    public gyAxis: Selection<SVGGElement, unknown, HTMLElement, any> | null = null;
    public gyCongestionAxis: Selection<SVGGElement, unknown, HTMLElement, any> | null = null;

    public congestionAxisText: Selection<SVGTextElement, unknown, HTMLElement, any> | null = null;

    // Perspective in which packet_sent events play the main role
    public sent!: IPerspectiveInfo;

    // Perspective in which packet_received events play the main role
    // As recovery/congestion information is not available from this perspective, it is more limited than the 'sent' perspective
    public received!: IPerspectiveInfo;

    public metricUpdateLines!: {
        bytes: Array<[number, number]>,
        cwnd: Array<[number, number]>,
        minRTT: Array<[number, number]>,
        smoothedRTT: Array<[number, number]>,
        lastRTT: Array<[number, number]>,
    };

    public flowControlLines!: {
        application: Array<[number, number]>,
        stream: Array<[number, number]>,
    }

    /* Methods */
    public constructor() {
        this.innerWidth = this.outerWidth - this.margins.left - this.margins.right;
        this.innerHeight = this.outerHeight - this.margins.top - this.margins.bottom;
        this.reset();
    }

    public currentPerspective() {
        return this.useSentPerspective ? this.sent : this.received;
    };

    public reset() {
        this.sent = {
            xScale: null,
            yScale: null, // Used for packet_sent, packet_acked and packet_lost
            yCongestionScale: null, // Used for congestion window and bytes in flight
            xAxis: null,
            yAxis: null,
            yCongestionAxis: null,
            rangeX: [0, 0], // [minX, maxX]
            rangeY: [0, 0], // [minY, maxY]
            congestionRangeY: [0, 0], // [minY, maxY]
            originalRangeX: [0, 0], // [minX, maxX]
            originalRangeY: [0, 0], // [minY, maxY]
            originalCongestionRangeY: [0, 0], // [minY, maxY]

            drawScaleX: 1,
            drawScaleY: 1,
        };
        this.received = {
            xScale: null,
            yScale: null, // Used for packet_sent, packet_acked and packet_lost
            xAxis: null,
            yAxis: null,
            rangeX: [0, 0], // [minX, maxX]
            rangeY: [0, 0], // [minY, maxY]
            originalRangeX: [0, 0], // [minX, maxX]
            originalRangeY: [0, 0], // [minY, maxY]

            drawScaleX: 1,
            drawScaleY: 1,
        };
        this.metricUpdateLines = {
            bytes: new Array<[number, number]>(),
            cwnd: new Array<[number, number]>(),
            minRTT: new Array<[number, number]>(),
            smoothedRTT: new Array<[number, number]>(),
            lastRTT: new Array<[number, number]>(),
        };
        this.flowControlLines = {
            application: new Array<[number, number]>(),
            stream: new Array<[number, number]>(),
        }
    }
};

interface IPerspectiveInfo {
    xScale: ScaleLinear<number, number> | null;
    yScale: ScaleLinear<number, number> | null; // Used for packet_sent, packet_acked and packet_lost
    yCongestionScale?: ScaleLinear<number, number> | null; // Used for congestion window and bytes in flight
    xAxis: Axis<number | {valueOf(): number;}> | null;
    yAxis: Axis<number | {valueOf(): number;}> | null;
    yCongestionAxis?:Axis<number | {valueOf(): number;}> | null;
    rangeX: [number, number]; // [minX, maxX]
    rangeY: [number, number]; // [minY, maxY]
    congestionRangeY?: [number, number]; // [minY, maxY]
    originalRangeX: [number, number]; // [minX, maxX]
    originalRangeY: [number, number], // [minY, maxY]
    originalCongestionRangeY?: [number, number], // [minY, maxY]

    drawScaleX: number,
    drawScaleY: number,
}
