import { MainGraphState } from './MainGraphState';
import { Selection, Axis, ScaleLinear } from 'd3';

export class RecoveryGraphState {
    // Fields
    public outerWidth = window.innerWidth;
    public outerHeight = 300;
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

    // Scales/Axii/Range data
    public xAxis: Axis<number | {valueOf(): number;}> | null = null; // xScale is shared with main chart
    public gxAxis: Selection<SVGGElement, unknown, HTMLElement, any> | null = null; // Graphical element for the x axis

    public yScale: ScaleLinear<number, number> | null = null;
    public yAxis: Axis<number | {valueOf(): number;}> | null = null;
    public gyAxis: Selection<SVGGElement, unknown, HTMLElement, any> | null = null; // Graphical element for the y axis
    public originalRangeY: [number, number] = [0, 0]; // [minY, maxY]
    public rangeY: [number, number] = [0, 0]; // Current minY and maxY

    public zooming0RTTenabled:boolean = false;


    /* Methods */
    public constructor() {
        this.innerWidth = this.outerWidth - this.margins.left - this.margins.right;
        this.innerHeight = this.outerHeight - this.margins.top - this.margins.bottom;
    }

    public reset() {
        this.xAxis = null;
        this.yAxis = null;
        this.yScale = null;
        this.originalRangeY = [0, 0];
        this.rangeY = [0, 0];
    }
}
