import QlogConnection from '@/data/Connection';
import * as d3 from 'd3';
import * as qlog from '@quictools/qlog-schema';
import CongestionGraphConfig from '../data/CongestionGraphConfig';
import { VantagePointType } from '@quictools/qlog-schema';
import { IQlogRawEvent, IQlogEventParser } from '@/data/QlogEventParser';
import { MainGraphState } from './MainGraphState';
import { RecoveryGraphState } from './RecoveryGraphState';
import { Selection } from 'd3';

export default class CongestionGraphD3Renderer {

    public containerID:string;
    public rendering:boolean = false;

    private config!:CongestionGraphConfig;
    private mainGraphState!: MainGraphState;
    private recoveryGraphState!: RecoveryGraphState;

    private mainGraphContainer?: Selection<HTMLDivElement, unknown, HTMLElement, any>;
    private recoveryGraphContainer?: Selection<HTMLDivElement, unknown, HTMLElement, any>;

    // Stored for quick referencing instead of needing to lookup every redraw
    private packetsSent!: Array<Array<any>>;
    private packetsReceived!: Array<Array<any>>;
    private metricUpdates!: Array<Array<any>>;

    private isInitialised: boolean = false;

    private previousMouseX: number | null = null; // mouse coordinates of mouse move for panning
    private previousMouseY: number | null = null;

    constructor(containerID:string){
        this.containerID = containerID;
    }

    public render(config:CongestionGraphConfig) {
        if ( this.rendering ) {
            return;
        }

        console.log("CongestionGraphRenderer:render", config);

        this.config = config;

        if (!this.isInitialised) {
            this.mainGraphState = new MainGraphState();
            this.recoveryGraphState = new RecoveryGraphState();
            this.init();
            this.isInitialised = true;
        }

        this.mainGraphState.reset();
        this.recoveryGraphState.reset();

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
        const currentPerspective = this.mainGraphState.useSentPerspective; // Save perspective as perspective will be changed during init
        this.parseQlog();

        this.initSentSide({}); // FIXME pass settings with minX and maxX if needed
        this.initReceivedSide({}); // FIXME pass settings with minX and maxX if needed

        this.mainGraphState.gxAxis!.call(this.mainGraphState.currentPerspective().xAxis!);
        this.mainGraphState.gyAxis!.call(this.mainGraphState.currentPerspective().yAxis!);
        this.mainGraphState.gyCongestionAxis!.call(this.mainGraphState.sent.yCongestionAxis!);
        this.recoveryGraphState.gxAxis!.call(this.recoveryGraphState.xAxis!);
        this.recoveryGraphState.gyAxis!.call(this.recoveryGraphState.yAxis!);

        const self = this;

        const onZoom = () => {
            self.onZoom();
        };

        const onPan = () => {
            self.onPan();
        }

        const onHover = () => {
            self.onHover();
        }

        const onPickerClick = () => {
            self.onPickerClick();
        }

        const onBrushXEnd = () => {
            self.onBrushXEnd();
        }

        const onBrush2dEnd = () => {
            self.onBrush2dEnd();
        }

        this.mainGraphState.mouseHandlerPanningSvg!.on("wheel", onZoom)
            .on("click", onPickerClick)
            .on("mousemove.pan", onPan)
            .on("mousemove.hover", onHover);

        this.mainGraphState.mouseHandlerPickSvg!.on("wheel", onZoom)
            .on("click", onPickerClick)
            .on("mousemove", onHover);

        this.mainGraphState.brushX = d3.brushX()
            .extent([[0, 0], [this.mainGraphState.innerWidth, this.mainGraphState.innerHeight]])
            .on("end", onBrushXEnd);

        this.mainGraphState.brushXElement = this.mainGraphState.mouseHandlerBrushXSvg!
            .append("g")
            .attr("class", "brush")
            .call(this.mainGraphState.brushX)
            .on("wheel", onZoom)
            .on("mousemove", onHover);

        this.mainGraphState.brush2d = d3.brush()
            .extent([[0, 0], [this.mainGraphState.innerWidth, this.mainGraphState.innerHeight]])
            .on("end", onBrush2dEnd);

        this.mainGraphState.brush2dElement = this.mainGraphState.mouseHandlerBrush2dSvg!
            .append("g")
            .attr("class", "brush")
            .call(this.mainGraphState.brush2d)
            .on("wheel", onZoom)
            .on("mousemove", onHover);

        // this.mainGraphState.selectionBrush = d3.brush()
        //     .extent([[0, 0], [this.mainGraphState.innerWidth, this.mainGraphState.innerHeight]])
        //     .on("end", onSelection);

        // this.mainGraphState.mouseHandlerSelectionSvg!
        //     .append("g")
        //     .attr("class", "brush")
        //     .call(this.mainGraphState.selectionBrush)
        //     .on("wheel", onZoom)
        //     .on("mousemove", onHover);

        this.setPerspective(currentPerspective, false); // Only shows elements that need to be shown

        this.mainGraphContainer!.style("display", "block");
        this.recoveryGraphContainer!.style("display", "block");

        return true;
    }

    // Redraw canvas
    private async renderParts(){
        // document.getElementById(this.containerID)!.innerHTML = "Hello world";
        this.redrawCanvas(this.mainGraphState.currentPerspective().rangeX[0], this.mainGraphState.currentPerspective().rangeX[1], this.mainGraphState.currentPerspective().rangeY[0], this.mainGraphState.currentPerspective().rangeY[1])
    }

    // Y corresponds to coordinates for data sent/received in bytes
    // Y scale for congestion info and recovery info is static and can not be changed
    private redrawCanvas(minX: number, maxX: number, minY: number, maxY: number) {
        const currentPerspective = this.mainGraphState.currentPerspective();

        const rectWidth = 3;

        currentPerspective.xScale = d3.scaleLinear()
            .domain([minX, maxX])
            .range([0, this.mainGraphState.innerWidth]);

        currentPerspective.yScale = d3.scaleLinear()
            .domain([minY, maxY])
            .range([this.mainGraphState.innerHeight, 0]);

        this.mainGraphState.gxAxis!.call(currentPerspective.xAxis!.scale(currentPerspective.xScale));
        this.mainGraphState.gyAxis!.call(currentPerspective.yAxis!.scale(currentPerspective.yScale));

        this.mainGraphState.canvasContext!.clearRect(0, 0, this.mainGraphState.innerWidth, this.mainGraphState.innerHeight);

        if (this.mainGraphState.useSentPerspective) {
            this.recoveryGraphState.gxAxis!.call(currentPerspective.xAxis!.scale(currentPerspective.xScale));
            this.recoveryGraphState.canvasContext!.clearRect(0, 0, this.recoveryGraphState.innerWidth, this.recoveryGraphState.innerHeight);
        }

        currentPerspective.drawScaleX = this.xScalingFunction((currentPerspective.originalRangeX[1] - currentPerspective.originalRangeX[0]) / (maxX - minX));
        currentPerspective.drawScaleY = this.yScalingFunction((currentPerspective.originalRangeY[1] - currentPerspective.originalRangeY[0]) / (maxY - minY));

        const packetList = this.mainGraphState.useSentPerspective ? this.packetsSent : this.packetsReceived;

        for (const packet of packetList) {
            // Draw the packets and their corresponding ack and loss events
            const parsedPacket = this.config.connection!.parseEvent(packet);
            const extraData = ((packet as any) as IEventExtension).qvis.congestion;

            const height = currentPerspective.yScale(extraData.to) - currentPerspective.yScale(extraData.from);
            const x = currentPerspective.xScale(parsedPacket.time);
            const y = currentPerspective.yScale(extraData.to);
            // Only draw within bounds
            if (x + rectWidth >= 0 && x <= this.mainGraphState.innerWidth && y + height >= 0 && y <= this.mainGraphState.innerHeight) {
                this.drawRect(this.mainGraphState.canvasContext!, x, y, rectWidth, height, "#0000FF");
            }

            // Draw the packet's ACK, if it has one
            if (extraData.correspondingAck) {
                const parsedAck = this.config.connection!.parseEvent(extraData.correspondingAck);

                const ackX = currentPerspective.xScale(parsedAck.time);

                // Only draw within bounds
                if (ackX + rectWidth >= 0 && x <= this.mainGraphState.innerWidth && y + height >= 0 && y <= this.mainGraphState.innerHeight) {
                    this.drawRect(this.mainGraphState.canvasContext!, ackX, y, rectWidth, height, "#6B8E23");
                }
            }
            if (extraData.correspondingLoss) {
                const parsedLoss = this.config.connection!.parseEvent(extraData.correspondingLoss);

                const lossX = currentPerspective.xScale(parsedLoss.time);

                // Only draw within bounds
                if (lossX + rectWidth >= 0 && x <= this.mainGraphState.innerWidth && y + height >= 0 && y <= this.mainGraphState.innerHeight) {
                    this.drawRect(this.mainGraphState.canvasContext!, lossX, y, rectWidth, height, "#FF0000");
                }
            }
        }

        if (this.mainGraphState.useSentPerspective) {
            // Draw congestion and RTT info

            // Congestion
            if (this.mainGraphState.congestionGraphEnabled) {
                this.drawLines(this.mainGraphState.canvasContext!, this.mainGraphState.metricUpdateLines["bytes"].map((point) => {
                    return [ this.mainGraphState.sent.xScale!(point[0]), this.mainGraphState.sent.yCongestionScale!(point[1]) ];
                }), "#808000", undefined);

                this.drawLines(this.mainGraphState.canvasContext!, this.mainGraphState.metricUpdateLines["cwnd"].map((point) => {
                    return [ this.mainGraphState.sent.xScale!(point[0]), this.mainGraphState.sent.yCongestionScale!(point[1]) ];
                }), "#8A2BE2", undefined);
            }

            // RTT
            this.drawLines(this.recoveryGraphState.canvasContext!, this.mainGraphState.metricUpdateLines["minRTT"].map((point) => {
                return [ this.mainGraphState.sent.xScale!(point[0]), this.recoveryGraphState.yScale!(point[1]) ];
            }), "#C96480", undefined);

            this.drawLines(this.recoveryGraphState.canvasContext!, this.mainGraphState.metricUpdateLines["smoothedRTT"].map((point) => {
                return [ this.mainGraphState.sent.xScale!(point[0]), this.recoveryGraphState.yScale!(point[1]) ];
            }), "#8a554a", undefined);

            this.drawLines(this.recoveryGraphState.canvasContext!, this.mainGraphState.metricUpdateLines["lastRTT"].map((point) => {
                return [ this.mainGraphState.sent.xScale!(point[0]), this.recoveryGraphState.yScale!(point[1]) ];
            }), "#ff9900", undefined);
        }

        currentPerspective.rangeX = [minX, maxX];
        currentPerspective.rangeY = [minY, maxY];
    }

    private drawRect(canvasContext: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, color: string){
        canvasContext.beginPath();
        canvasContext.fillStyle = color;
        canvasContext.rect(x, y, width * this.mainGraphState.currentPerspective().drawScaleX, -height * this.mainGraphState.currentPerspective().drawScaleY);
        canvasContext.fill();
    }

    private drawLines(canvasContext: CanvasRenderingContext2D, pointList: Array<[number, number]>, color: string, tickDrawFunction: ((canvasContext: CanvasRenderingContext2D, x: number, y: number, color: string) => void) | undefined) {
        canvasContext.lineWidth = 1 * this.mainGraphState.currentPerspective().drawScaleX;
        if (pointList.length > 0) {
            canvasContext.beginPath();
            canvasContext.strokeStyle = color;
            const startX = pointList[0][0];
            const startY = pointList[0][1];
            canvasContext.moveTo(startX, startY);
            for (let i = 1; i < pointList.length; ++i) {
                const pointX = pointList[i][0];
                const pointY = pointList[i][1];
                canvasContext.lineTo(pointX, pointY);
            }
            canvasContext.stroke();
            for (let i = 1; i < pointList.length; ++i) {
                const pointX = pointList[i][0];
                const pointY = pointList[i][1];
                if (tickDrawFunction) {
                    tickDrawFunction(canvasContext, pointX, pointY, color);
                }
            }
        }
    }

    private setPerspective(useSentPerspective: boolean, redraw: boolean){
        this.mainGraphState.useSentPerspective = useSentPerspective;

        if (!this.mainGraphState.useSentPerspective) {
            this.mainGraphState.congestionAxisText!.style("display", "none");
            this.mainGraphState.gyCongestionAxis!.style("display", "none");
            this.recoveryGraphState.graphSvg!.style("display", "none");
            this.recoveryGraphState.canvas!.style("display", "none");
        } else {
            this.mainGraphState.congestionAxisText!.style("display", "block");
            this.mainGraphState.gyCongestionAxis!.style("display", "block");
            this.recoveryGraphState.graphSvg!.style("display", "block");
            this.recoveryGraphState.canvas!.style("display", "block");
        }

        if (redraw) {
            this.redrawCanvas(this.mainGraphState.currentPerspective().rangeX[0], this.mainGraphState.currentPerspective().rangeX[1], this.mainGraphState.currentPerspective().rangeY[0], this.mainGraphState.currentPerspective().rangeY[1])
        }
    }

    // Called on first render only
    // Init elements that are used across multiple renders
    private init() {
        this.mainGraphState.eventBus = document.createElement("span");

        this.mainGraphState.packetInformationDiv = d3.select("#packetInfo");

        this.mainGraphContainer = d3.select("#" + this.containerID).append("div")
            .attr("id", "mainGraphContainer")
            .style("height", this.mainGraphState.outerHeight + "px")

        this.recoveryGraphContainer = d3.select("#" + this.containerID).append("div")
            .attr("id", "recoveryGraphContainer")
            .style("height", this.recoveryGraphState.outerHeight + "px");

        this.mainGraphState.graphSvg = this.mainGraphContainer
            .append('svg:svg')
            .attr('width', this.mainGraphState.outerWidth)
            .attr('height', this.mainGraphState.outerHeight)
            .style('position', "absolute")
            .append('g')
            .attr('transform', 'translate(' + this.mainGraphState.margins.left + ', ' + this.mainGraphState.margins.top + ')');

        this.mainGraphState.canvas = this.mainGraphContainer
            .append('canvas')
            .attr('width', this.mainGraphState.innerWidth)
            .attr('height', this.mainGraphState.innerHeight)
            .style('margin-left', this.mainGraphState.margins.left + "px")
            .style('margin-top', this.mainGraphState.margins.top + "px")
            .style('position', "absolute");

        this.mainGraphState.mouseHandlerPanningSvg = this.mainGraphContainer
            .append('svg:svg')
            .attr('width', this.mainGraphState.innerWidth)
            .attr('height', this.mainGraphState.innerHeight)
            .style('margin-left', this.mainGraphState.margins.left + "px")
            .style('margin-top', this.mainGraphState.margins.top + "px")
            .style('z-index', 1) // Enabled by default
            .style('position', "absolute");

        this.mainGraphState.mouseHandlerBrushXSvg = this.mainGraphContainer
            .append('svg:svg')
            .attr('width', this.mainGraphState.innerWidth)
            .attr('height', this.mainGraphState.innerHeight)
            .style('margin-left', this.mainGraphState.margins.left + "px")
            .style('margin-top', this.mainGraphState.margins.top + "px")
            .style('z-index', 0) // Disabled by default
            .style('position', "absolute");

        this.mainGraphState.mouseHandlerBrush2dSvg = this.mainGraphContainer
            .append('svg:svg')
            .attr('width', this.mainGraphState.innerWidth)
            .attr('height', this.mainGraphState.innerHeight)
            .style('margin-left', this.mainGraphState.margins.left + "px")
            .style('margin-top', this.mainGraphState.margins.top + "px")
            .style('z-index', 0) // Disabled by default
            .style('position', "absolute");

        this.mainGraphState.mouseHandlerSelectionSvg = this.mainGraphContainer
            .append('svg:svg')
            .attr('width', this.mainGraphState.innerWidth)
            .attr('height', this.mainGraphState.innerHeight)
            .style('margin-left', this.mainGraphState.margins.left + "px")
            .style('margin-top', this.mainGraphState.margins.top + "px")
            .style('z-index', 0) // Disabled by default
            .style('position', "absolute");

        this.mainGraphState.mouseHandlerPickSvg = this.mainGraphContainer
            .append('svg:svg')
            .attr('width', this.mainGraphState.innerWidth)
            .attr('height', this.mainGraphState.innerHeight)
            .style('margin-left', this.mainGraphState.margins.left + "px")
            .style('margin-top', this.mainGraphState.margins.top + "px")
            .style('z-index', 0) // Disabled by default
            .style('position', "absolute");

        this.recoveryGraphState.graphSvg = this.recoveryGraphContainer
            .append('svg:svg')
            .attr('width', this.recoveryGraphState.outerWidth)
            .attr('height', this.recoveryGraphState.outerHeight)
            .style('position', "absolute")
            .append('g')
            .attr('transform', 'translate(' + this.recoveryGraphState.margins.left + ', ' + this.recoveryGraphState.margins.top + ')');

        this.recoveryGraphState.canvas = this.recoveryGraphContainer
            .append('canvas')
            .attr('width', this.recoveryGraphState.innerWidth)
            .attr('height', this.recoveryGraphState.innerHeight)
            .style('margin-left', this.recoveryGraphState.margins.left + "px")
            .style('margin-top', this.recoveryGraphState.margins.top + "px")
            .style('position', "absolute");

        this.mainGraphState.canvasContext = this.mainGraphState.canvas.node()!.getContext('2d');
        this.recoveryGraphState.canvasContext = this.recoveryGraphState.canvas.node()!.getContext('2d');

        this.mainGraphState.gxAxis = this.mainGraphState.graphSvg!.append('g')
            .attr('transform', 'translate(0, ' + this.mainGraphState.innerHeight + ')')
            .attr("class", "grid");
            // .call(this.mainGraphState.currentPerspective().xAxis!);

        this.mainGraphState.gyAxis = this.mainGraphState.graphSvg!.append('g')
            .attr("class", "grid");
            // .call(this.mainGraphState.currentPerspective().yAxis!);

        this.mainGraphState.gyCongestionAxis = this.mainGraphState.graphSvg!.append('g')
            .attr("class", "nogrid");
            // .call(this.mainGraphState.sent.yCongestionAxis!);

        this.recoveryGraphState.gxAxis = this.recoveryGraphState.graphSvg!.append('g')
            .attr('transform', 'translate(0, ' + this.recoveryGraphState.innerHeight + ')')
            .attr("class", "grid");
            // .call(this.recoveryGraphState.xAxis!);

        this.recoveryGraphState.gyAxis = this.recoveryGraphState.graphSvg!.append('g')
            .attr("class", "grid");
            // .call(this.recoveryGraphState.yAxis!);

        // Packet axis
        this.mainGraphState.graphSvg!.append('text')
            .attr('x', '-' + (this.mainGraphState.innerHeight / 2))
            .attr('dy', '-3.5em')
            .attr('transform', 'rotate(-90)')
            .text('Data (bytes)');

        // X axis
        this.mainGraphState.graphSvg!.append('text')
            .attr('x', '' + (this.mainGraphState.innerWidth / 2))
            .attr('y', '' + (this.mainGraphState.innerHeight + 40))
            .text('Time (ms)');

        // Congestion axis
        this.mainGraphState.congestionAxisText = this.mainGraphState.graphSvg!.append('text')
            .attr('transform', 'translate(' + (this.mainGraphState.innerWidth + this.mainGraphState.margins.right / 2) + ', ' + this.mainGraphState.innerHeight / 2 + '), rotate(-90)')
            .text('Congestion info (bytes)');

        // Recovery x axis
        this.recoveryGraphState.graphSvg!.append('text')
            .attr('x', '' + (this.recoveryGraphState.innerWidth / 2))
            .attr('y', '' + (this.recoveryGraphState.innerHeight + 40))
            .text('Time (ms)');

        // Recovery y axis
        this.recoveryGraphState.graphSvg!.append('text')
            .attr('x', '-' + (this.recoveryGraphState.innerHeight / 2))
            .attr('dy', '-3.5em')
            .attr('transform', 'rotate(-90)')
            .text('RTT (ms)');
    }

    private initSentSide(settings: any){
        this.mainGraphState.useSentPerspective = true;

        const [minCongestionY, maxCongestionY, minRTT, maxRTT] = this.findMetricUpdateExtrema();
        const [localXMin, localXMax] = [settings.minX && settings.minX > 0 ? settings.minX : 0, settings.maxX && settings.maxX < this.mainGraphState.sent.originalRangeX[1] ? settings.maxX : this.mainGraphState.sent.originalRangeX[1]];
        const [localMinY, localMaxY] = this.findYExtrema(localXMin, localXMax);

        const scaledMaxCongestionY = maxCongestionY * 3; // Make the congestion graph take up only 1/3 of the vertical screen space

        this.mainGraphState.sent.xScale = d3.scaleLinear()
            .domain([localXMin, localXMax])
            .range([0, this.mainGraphState.innerWidth]);

        this.mainGraphState.sent.yScale = d3.scaleLinear()
            .domain([localMinY, localMaxY])
            .range([this.mainGraphState.innerHeight, 0]);

        this.mainGraphState.sent.yCongestionScale = d3.scaleLinear()
            .domain([0, scaledMaxCongestionY])
            .range([this.mainGraphState.innerHeight, 0])
            .nice();

        this.recoveryGraphState.yScale = d3.scaleLinear()
            .domain([0, maxRTT])
            .range([this.recoveryGraphState.innerHeight, 0]);

        this.mainGraphState.sent.xAxis = d3.axisBottom(this.mainGraphState.sent.xScale)
            .tickSize(-this.mainGraphState.innerHeight)
            .scale(this.mainGraphState.sent.xScale);

        this.mainGraphState.sent.yAxis = d3.axisLeft(this.mainGraphState.sent.yScale)
            .tickFormat( ( val ) => {
                const nr: number = val.valueOf !== undefined ? val.valueOf() : val as number;
                if (nr > 1000 || nr < -1000) {
                    // 12000 -> 12k
                    // 12010 -> 12010
                    if ( Math.round(nr) % 1000 === 0 ){
                        const k = Math.round(nr / 1000);

                        return k + "K";
                    } else {
                        return Math.round(nr).toString();
                    }
                } else {
                    return Math.round(nr).toString();
                }
            })
            .tickSize(-this.mainGraphState.innerWidth)
            .scale(this.mainGraphState.sent.yScale)

        this.mainGraphState.sent.yCongestionAxis = d3.axisRight(this.mainGraphState.sent.yCongestionScale)
            .tickFormat( ( val ) => {
                const nr: number = val.valueOf !== undefined ? val.valueOf() : val as number;
                if (nr > 1000 || nr < -1000) {
                    // 12000 -> 12k
                    // 12010 -> 12010
                    if (Math.round(nr) % 1000 === 0 ) {
                        const k = Math.round(nr / 1000);

                        return k + "K";
                    }
                    else{
                        return Math.round(nr).toString();
                    }
                }
                else {
                    return Math.round(nr).toString();
                }
            })
            .tickSize(this.mainGraphState.innerWidth)
            .scale(this.mainGraphState.sent.yCongestionScale)

        this.recoveryGraphState.xAxis = d3.axisBottom(this.mainGraphState.sent.xScale)
            .tickSize(-this.recoveryGraphState.innerHeight)
            .scale(this.mainGraphState.sent.xScale);

        this.recoveryGraphState.yAxis = d3.axisLeft(this.recoveryGraphState.yScale!)
            .tickSize(-this.recoveryGraphState.innerWidth)
            .scale(this.recoveryGraphState.yScale!);

        this.mainGraphState.sent.rangeX = [localXMin, localXMax];
        this.mainGraphState.sent.rangeY = [localMinY, localMaxY];
        this.mainGraphState.sent.congestionRangeY = this.mainGraphState.sent.originalCongestionRangeY;
        this.recoveryGraphState.rangeY = this.recoveryGraphState.originalRangeY;
    }

    private initReceivedSide(settings: any){
        this.mainGraphState.useSentPerspective = false;

        const [globalXMin, globalXMax] = this.mainGraphState.sent.originalRangeX
        const [localXMin, localXMax] = [settings.minX && settings.minX > globalXMin ? settings.minX : globalXMin, settings.maxX && settings.maxX < globalXMax ? settings.maxX : globalXMax];
        const [globalMinY, globalMaxY] = this.mainGraphState.sent.originalRangeY;
        const [localMinY, localMaxY] = this.mainGraphState.sent.originalRangeY; // TODO change!

        this.mainGraphState.received.xScale = d3.scaleLinear()
            .domain([localXMin, localXMax])
            .range([0, this.mainGraphState.innerWidth]);

        this.mainGraphState.received.yScale = d3.scaleLinear()
            .domain([localMinY, localMaxY])
            .range([this.mainGraphState.innerHeight, 0]);

        this.mainGraphState.received.xAxis = d3.axisBottom(this.mainGraphState.received.xScale)
            .tickSize(-this.mainGraphState.innerHeight)
            .scale(this.mainGraphState.received.xScale);

        this.mainGraphState.received.yAxis = d3.axisLeft(this.mainGraphState.received.yScale)
            .tickFormat( ( val ) => {
                const nr: number = val.valueOf !== undefined ? val.valueOf() : val as number;
                if (nr > 1000 || nr < -1000) {
                    // 12000 -> 12k
                    // 12010 -> 12010
                    if ( Math.round(nr) % 1000 === 0 ){
                        const k = Math.round(nr / 1000);

                        return k + "K";
                    } else {
                        return Math.round(nr).toString();
                    }
                } else {
                    return Math.round(nr).toString();
                }
            })
            .tickSize(-this.mainGraphState.innerWidth)
            .scale(this.mainGraphState.received.yScale)

        this.mainGraphState.received.rangeX = [localXMin, localXMax];
        this.mainGraphState.received.rangeY = [localMinY, localMaxY];
    }

    private parseQlog() {
        const sent = {
            xMin: Infinity,
            xMax: 0,
            yMin: Infinity,
            yMax: 0,
            minCongestionY: Infinity,
            maxCongestionY: 0,
            minRTT: Infinity,
            maxRTT: 0,
        }
        const received = {
            xMin: Infinity,
            xMax: 0,
            yMin: Infinity,
            yMax: 0,
        }

        this.config.connection!.setupLookupTable();

        const packetsSent = this.config.connection!.lookup(qlog.EventCategory.transport, qlog.TransportEventType.packet_sent);
        const packetsReceived = this.config.connection!.lookup(qlog.EventCategory.transport, qlog.TransportEventType.packet_received);
        const packetsLost = this.config.connection!.lookup(qlog.EventCategory.recovery, qlog.RecoveryEventType.packet_lost);
        const metricUpdates = this.config.connection!.lookup(qlog.EventCategory.recovery, qlog.RecoveryEventType.metric_update);

        const packetSentList = [];
        const packetReceivedList = [];

        let totalSentByteCount = 0;
        let totalReceivedByteCount = 0;

        for (const packet of packetsSent) {
            const parsedPacket = this.config.connection!.parseEvent(packet)
            const data = parsedPacket.data;
            this.createPrivateNamespace(packet);

            if (!data.header.packet_size || data.header.packet_size === 0) {
                console.error("Packet had invalid size! Not counting!", packet);
                continue;
            }

            const packetOffsetStart = totalSentByteCount + 1;
            totalSentByteCount += data.header.packet_size;

            ((packet as any) as IEventExtension).qvis.congestion.from = packetOffsetStart;
            ((packet as any) as IEventExtension).qvis.congestion.to = totalSentByteCount;

            packetSentList[ parseInt( data.header.packet_number, 10 ) ] = packet; // Store temporarily so we can link the ACK to this packet later in packet.qviscongestion.correspondingAck

            // Update extrema
            sent.xMin = sent.xMin > parsedPacket.time ? parsedPacket.time : sent.xMin;
            sent.xMax = sent.xMax < parsedPacket.time ? parsedPacket.time : sent.xMax;
            sent.yMin = sent.yMin > packetOffsetStart ? packetOffsetStart : sent.yMin;
            sent.yMax = sent.yMax < totalSentByteCount ? totalSentByteCount : sent.yMax;
        }

        for (const packet of packetsReceived) {
            const parsedPacket = this.config.connection!.parseEvent(packet)
            const data = parsedPacket.data;
            this.createPrivateNamespace(packet);

            if (data.header.packet_size && data.header.packet_size !== 0) {
                const packetOffsetStart = totalReceivedByteCount + 1;
                totalReceivedByteCount += data.header.packet_size;

                ((packet as any) as IEventExtension).qvis.congestion.from = packetOffsetStart;
                ((packet as any) as IEventExtension).qvis.congestion.to = totalSentByteCount;

                packetReceivedList[ parseInt( data.header.packet_number, 10 ) ] = packet; // Store temporarily so we can link the ACK to this packet later in packet.qviscongestion.correspondingAck

                // Update extrema
                received.xMin = received.xMin > parsedPacket.time ? parsedPacket.time : received.xMin;
                received.xMax = received.xMax < parsedPacket.time ? parsedPacket.time : received.xMax;
                received.yMin = received.yMin > packetOffsetStart ? packetOffsetStart : received.yMin;
                received.yMax = received.yMax < totalSentByteCount ? totalSentByteCount : received.yMax;
            } else {
                console.error("Packet had invalid size! not counting!");
            }

            // Received ACKs
            if (!data.frames) {
                continue;
            }

            const ackFrames = [];
            for (const frame of data.frames) {
                if (frame.frame_type === qlog.QUICFrameTypeName.ack) {
                    ackFrames.push(frame);
                }
            }

            if (ackFrames.length === 0) {
                continue;
            }

            // now we have the ACK frames. These are composed of ACK blocks, each ACKing a range of packet numbers
            // we go over them all, look them up individually, and add them to packetAckedList
            for (const frame of ackFrames) {
                for (const range of frame.acked_ranges) {
                    const from = parseInt(range[0], 10);
                    const to = parseInt(range[1], 10); // up to and including

                    // ackedNr will be the ACKed packet number of one of our SENT packets here
                    for (let ackedNr = from; ackedNr <= to; ++ackedNr) {
                        // find the originally sent packet
                        const sentPacket = packetSentList[ ackedNr ];
                        if (!sentPacket){
                            console.error("Packet was ACKed that we didn't send... ignoring", ackedNr, frame, packet);
                            continue;
                        }

                        // packets can be acked multiple times across received ACKs (duplicate ACKs).
                        // This is quite normal in QUIC.
                        // We only want to show the FIRST time a packet was acked, so if the acked number already exists
                        // we do not overwrite it with a later timestamp
                        // TODO: MAYBE it's interesting to show duplicate acks as well, since this gives an indication of how long it took the peer to catch up
                        // e.g., if we have a long vertical line of acks, it means the peer might be sending too large ACK packets
                        if ( !((sentPacket as any) as IEventExtension).qvis.congestion.correspondingAck ) {
                            ((sentPacket as any) as IEventExtension).qvis.congestion.correspondingAck = packet;
                            ((packet as any) as IEventExtension).qvis.congestion.correspondingPacket = sentPacket;
                        }
                    }
                }
            }
        }

        // Loop over sent packets once more now that we have a list in which we can look up received packets
        for ( const packet of packetsSent ) {
            const parsedPacket = this.config.connection!.parseEvent(packet);
            const data = parsedPacket.data;

            // Sent ACKs
            if (!data.frames) {
                continue;
            }

            const ackFrames = [];
            for (const frame of data.frames) {
                if (frame.frame_type === qlog.QUICFrameTypeName.ack) {
                    ackFrames.push(frame);
                }
            }

            if (ackFrames.length === 0) {
                continue;
            }

            // now we have the ACK frames. These are composed of ACK blocks, each ACKing a range of packet numbers
            // we go over them all, look them up individually, and add them to packetAckedList
            for (const frame of ackFrames) {
                for (const range of frame.acked_ranges) {
                    const from = parseInt(range[0], 10);
                    const to = parseInt(range[1], 10); // up to and including

                    // ackedNr will be the ACKed packet number of one of our RECEIVED packets here
                    for (let ackedNr = from; ackedNr <= to; ++ackedNr) {
                        // find the originally received packet
                        const receivedPacket = packetReceivedList[ ackedNr ];
                        if (!receivedPacket) {
                            console.error("Packet was ACKed that we didn't receive... ignoring", ackedNr, frame, packet);
                            continue;
                        }

                        // packets can be acked multiple times across received ACKs (duplicate ACKs).
                        // This is quite normal in QUIC.
                        // We only want to show the FIRST time a packet was acked, so if the acked number already exists
                        // we do not overwrite it with a later timestamp
                        // TODO: MAYBE it's interesting to show duplicate acks as well, since this gives an indication of how long it took the peer to catch up
                        // e.g., if we have a long vertical line of acks, it means the peer might be sending too large ACK packets
                        if ( !((receivedPacket as any) as IEventExtension).qvis.congestion.correspondingAck ) {
                            ((receivedPacket as any) as IEventExtension).qvis.congestion.correspondingAck = packet;
                            ((packet as any) as IEventExtension).qvis.congestion.correspondingPacket = receivedPacket;
                        }
                    }
                }
            }
        }

        for (const packet of packetsLost) {
            const parsedPacket = this.config.connection!.parseEvent(packet);
            const data = parsedPacket.data;
            this.createPrivateNamespace(packet);

            if (!data.packet_number) {
                console.error("Packet was LOST that didn't contain a packet_number field...", packet);
                continue;
            }

            const lostPacketNumber = parseInt( data.packet_number, 10 );
            const sentPacket = packetSentList[ lostPacketNumber ];
            if (!sentPacket) {
                console.error("Packet was LOST that we didn't send... ignoring", lostPacketNumber, packet);
                continue;
            }

            ((sentPacket as any) as IEventExtension).qvis.congestion.correspondingLoss = packet;
            ((packet as any) as IEventExtension).qvis.congestion.correspondingPacket = sentPacket;
        }

        for (const update of metricUpdates) {
            const parsedUpdate = this.config.connection!.parseEvent(update);
            const data = parsedUpdate.data;

            if (data.bytes_in_flight) {
                const y = data.bytes_in_flight;
                sent.minCongestionY = sent.minCongestionY > y ? y : sent.minCongestionY;
                sent.maxCongestionY = sent.maxCongestionY < y ? y : sent.maxCongestionY;
                this.mainGraphState.metricUpdateLines.bytes.push([parsedUpdate.time, y]);
            }
            if (data.cwnd) {
                const y = data.cwnd;
                sent.minCongestionY = sent.minCongestionY > y ? y : sent.minCongestionY;
                sent.maxCongestionY = sent.maxCongestionY < y ? y : sent.maxCongestionY;
                this.mainGraphState.metricUpdateLines.cwnd.push([parsedUpdate.time, y]);
            }
            if (data.min_rtt) {
                const y = parsedUpdate.timeToMilliseconds(data.min_rtt);
                sent.minRTT = sent.minRTT > y ? y : sent.minRTT;
                sent.maxRTT = sent.maxRTT < y ? y : sent.maxRTT;
                this.mainGraphState.metricUpdateLines.minRTT.push([parsedUpdate.time, y]);
            }
            if (data.smoothed_rtt) {
                const y = parsedUpdate.timeToMilliseconds(data.smoothed_rtt);
                sent.minRTT = sent.minRTT > y ? y : sent.minRTT;
                sent.maxRTT = sent.maxRTT < y ? y : sent.maxRTT;
                this.mainGraphState.metricUpdateLines.smoothedRTT.push([parsedUpdate.time, y]);
            }
            if (data.latest_rtt) {
                const y = parsedUpdate.timeToMilliseconds(data.latest_rtt);
                sent.minRTT = sent.minRTT > y ? y : sent.minRTT;
                sent.maxRTT = sent.maxRTT < y ? y : sent.maxRTT;
                this.mainGraphState.metricUpdateLines.lastRTT.push([parsedUpdate.time, y]);
            }
        }

        this.packetsSent = packetsSent;
        this.packetsReceived = packetsReceived;
        this.metricUpdates = metricUpdates;

        this.mainGraphState.sent.originalRangeX = [0, sent.xMax];
        this.mainGraphState.sent.originalRangeY = [0, sent.yMax];
        this.mainGraphState.sent.originalCongestionRangeY = [0, sent.maxCongestionY];
        this.recoveryGraphState.originalRangeY = [0, sent.maxRTT];

        this.mainGraphState.received.originalRangeX = [0, received.xMax];
        this.mainGraphState.received.originalRangeY = [0, received.yMax];

        this.mainGraphState.metricUpdateLines.bytes = this.fixMetricUpdates(this.mainGraphState.metricUpdateLines.bytes);
        this.mainGraphState.metricUpdateLines.cwnd = this.fixMetricUpdates(this.mainGraphState.metricUpdateLines.cwnd);
        this.mainGraphState.metricUpdateLines.minRTT = this.fixMetricUpdates(this.mainGraphState.metricUpdateLines.minRTT);
        this.mainGraphState.metricUpdateLines.smoothedRTT = this.fixMetricUpdates(this.mainGraphState.metricUpdateLines.smoothedRTT);
        this.mainGraphState.metricUpdateLines.lastRTT = this.fixMetricUpdates(this.mainGraphState.metricUpdateLines.lastRTT);
    }

    private onZoom() {
        d3.event.preventDefault();

        // Clear all ackarrows
        this.mainGraphState.graphSvg!.selectAll(".ackArrow").remove();

        const zoomFactor = d3.event.deltaY > 0 ? 1 / 1.5 : 1.5;

        const mouseX = this.mainGraphState.currentPerspective().xScale!.invert(d3.mouse(d3.event.currentTarget)[0]);
        // const mouseY = graphState.currentPerspective().yPacketScale.invert(d3.mouse(this)[1]);

        const leftX = this.mainGraphState.currentPerspective().rangeX[0];
        const rightX = this.mainGraphState.currentPerspective().rangeX[1];
        // const topY = graphState.currentPerspective().packetRangeY[0];
        // const bottomY = graphState.currentPerspective().packetRangeY[1];

        const zoomedLeftPortion = ((mouseX - leftX) / zoomFactor);
        const zoomedRightPortion = ((rightX - mouseX) / zoomFactor);
        // const zoomedTopPortion = ((mouseY - topY) / zoomFactor);
        // const zoomedBottomPortion = ((bottomY - mouseY) / zoomFactor);

        // Cap at full fit
        const newLeftX = mouseX - zoomedLeftPortion >= 0 ? mouseX - zoomedLeftPortion : 0;
        const newRightX = mouseX + zoomedRightPortion <= this.mainGraphState.currentPerspective().originalRangeX[1] ? mouseX + zoomedRightPortion : this.mainGraphState.currentPerspective().originalRangeX[1];
        // const newTopY = mouseY - zoomedTopPortion >= 0 ? mouseY - zoomedTopPortion : 0;
        // const newBottomY = mouseY + zoomedBottomPortion <= graphState.currentPerspective().originalPacketRangeY[1] ? mouseY + zoomedBottomPortion : graphState.currentPerspective().originalPacketRangeY[1];
        const [newTopY, newBottomY] = this.findYExtrema(newLeftX, newRightX);

        this.redrawCanvas(newLeftX, newRightX, newTopY, newBottomY);
    }

    private onPan() {
        if (d3.event.buttons & 1) { // Primary button pressed and moving
            const graphX = this.mainGraphState.currentPerspective().xScale!.invert(d3.mouse(d3.event.currentTarget)[0]);
            const graphY = this.mainGraphState.currentPerspective().yScale!.invert(d3.mouse(d3.event.currentTarget)[1]);

            // If not yet set, set them for next event
            if (this.previousMouseX === null || this.previousMouseY === null) {
                this.previousMouseX = graphX;
                this.previousMouseY = graphY;
                return;
            }

            const panAmountX = (this.mainGraphState.currentPerspective().rangeX[1] - this.mainGraphState.currentPerspective().rangeX[0]) / this.mainGraphState.innerWidth;
            const panAmountY = (this.mainGraphState.currentPerspective().rangeY[1] - this.mainGraphState.currentPerspective().rangeY[0]) / this.mainGraphState.innerHeight;

            let deltaX = d3.event.movementX * panAmountX * -1;// graphX - previousX;
            let deltaY = d3.event.movementY * panAmountY;// graphY - previousY;

            this.panCanvas(deltaX, deltaY);

            this.previousMouseX = graphX;
            this.previousMouseX = graphY;
        }
    }

    private onHover() {
        // Clear all ackarrows
        this.mainGraphState.graphSvg!.selectAll(".ackArrow").remove();

        if (d3.event.buttons !== 0) {
            this.mainGraphState.packetInformationDiv!.style("display", "none");
            return;
        }

        const svgHoverCoords = d3.mouse(d3.event.currentTarget);
        const graphCoords = [this.mainGraphState.currentPerspective().xScale!.invert(svgHoverCoords[0]), this.mainGraphState.currentPerspective().yScale!.invert(svgHoverCoords[1])];

        const pixelData = this.mainGraphState.canvasContext!.getImageData(svgHoverCoords[0], svgHoverCoords[1], 1, 1).data;
        const pixelColor = [ pixelData[0], pixelData[1], pixelData[2] ];

        // No event found
        if (pixelColor[0] === 0 && pixelColor[1] === 0 && pixelColor[2] === 0) {
            this.mainGraphState.packetInformationDiv!.style("display", "none");
            this.mainGraphState.packetInformationDiv!.select("#timestamp").text("");
            this.mainGraphState.packetInformationDiv!.select("#packetNr").text("");
            this.mainGraphState.packetInformationDiv!.select("#packetSize").text("");
            this.mainGraphState.packetInformationDiv!.select("#ackedFrom").text("");
            this.mainGraphState.packetInformationDiv!.select("#ackedTo").text("");
            this.mainGraphState.graphSvg!.selectAll(".ackArrow").remove();
            return;
        }

        const radius = (3 * this.mainGraphState.currentPerspective().drawScaleX) / 2;

        const packetList = this.mainGraphState.useSentPerspective ? this.packetsSent : this.packetsReceived;

        for (const packet of packetList) {
            // const parsedPacket = this.config.connection!.parseEvent(packet);
            // const extraDetails = ((packet as any) as IEventExtension).qvis.congestion;

            // // Match found based on y value
            // //  -> We now have the sent/received packet in which we can find the ack or lost if if necessary
            // //  -> We determine this based on colour
            // if (extraDetails.from <= graphCoords[1] && extraDetails.to >= graphCoords[1]) {
            //     // if (pixelColor[0] === 0 && pixelColor[1] === 0 && pixelColor[2] === 255 ) {
            //     //     // Sent packet
            //     //     this.mainGraphState.packetInformationDiv!.style("display", "block");
            //     //     this.mainGraphState.packetInformationDiv!.style("left", (svgHoverCoords[0] + this.mainGraphState.margins.left - 50 + 10) + "px");
            //     //     this.mainGraphState.packetInformationDiv!.style("top", (svgHoverCoords[1] + this.mainGraphState.margins.top + 10) + "px");
            //     //     this.mainGraphState.packetInformationDiv!.select("#timestamp").text("Timestamp: " + parsedPacket.time);
            //     //     this.mainGraphState.packetInformationDiv!.select("#packetNr").text("PacketNr: " + parsedPacket.data.header.packet_number);
            //     //     this.mainGraphState.packetInformationDiv!.select("#packetSize").text("PacketSize: " + parsedPacket.data.header.packet_size);
            //     //     return;
            //     // } else if (pixelColor[0] === 107 && pixelColor[1] === 142 && pixelColor[2] === 35 ) {
            //     //     // Ack packet
            //     // } else if (pixelColor[0] === 255 && pixelColor[1] === 0 && pixelColor[2] === 0 ) {
            //     //     // lost packet
            //     //     this.mainGraphState.packetInformationDiv!.style("display", "block");
            //     //     this.mainGraphState.packetInformationDiv!.style("left", (svgHoverCoords[0] + this.mainGraphState.margins.left - 50 + 10) + "px");
            //     //     this.mainGraphState.packetInformationDiv!.style("top", (svgHoverCoords[1] + this.mainGraphState.margins.top + 10) + "px");
            //     //     this.mainGraphState.packetInformationDiv!.select("#timestamp").text("Timestamp: " + packet.timestamp);
            //     //     this.mainGraphState.packetInformationDiv!.select("#packetNr").text("PacketNr: " + packet.details.header.packet_number);
            //     //     this.mainGraphState.packetInformationDiv!.select("#packetSize").text("PacketSize: " + packet.details.header.packet_size);
            //     //     return;
            //     // }
            //     if (pixelColor[0] === 0 && pixelColor[1] === 0 && pixelColor[2] === 255 ) {
            //         // Packet was of type 'packet_sent/packet_received' => display contents of current packet
            //         this.mainGraphState.packetInformationDiv!.style("display", "block");
            //         this.mainGraphState.packetInformationDiv!.style("left", (svgHoverCoords[0] + this.mainGraphState.margins.left - 50 + 10) + "px");
            //         this.mainGraphState.packetInformationDiv!.style("top", (svgHoverCoords[1] + this.mainGraphState.margins.top + 10) + "px");
            //         this.mainGraphState.packetInformationDiv!.select("#timestamp").text("Timestamp: " + parsedPacket.time);
            //         this.mainGraphState.packetInformationDiv!.select("#packetNr").text("PacketNr: " + parsedPacket.data.header.packet_number);
            //         this.mainGraphState.packetInformationDiv!.select("#packetSize").text("PacketSize: " + parsedPacket.data.header.packet_size);
            //         return;
            //     } else if (pixelColor[0] === 107 && pixelColor[1] === 142 && pixelColor[2] === 35 ) {
            //         const ackPacket = extraDetails.correspondingAck!;
            //         const parsedAckPacket = this.config.connection!.parseEvent(ackPacket);

            //         // Packet was of type 'ack' => extract the ack packet from the 'packet_sent/packet_received' packet
            //         this.mainGraphState.packetInformationDiv!.style("display", "block");
            //         this.mainGraphState.packetInformationDiv!.style("left", (svgHoverCoords[0] + this.mainGraphState.margins.left - 50 + 10) + "px");
            //         this.mainGraphState.packetInformationDiv!.style("top", (svgHoverCoords[1] + this.mainGraphState.margins.top + 10) + "px");
            //         this.mainGraphState.packetInformationDiv!.select("#timestamp").text("Timestamp: " + parsedAckPacket.time);
            //         this.mainGraphState.packetInformationDiv!.select("#ackedFrom").text("Acked from: " + extraDetails.from);
            //         this.mainGraphState.packetInformationDiv!.select("#ackedTo").text("Acked to: " + extraDetails.to);

            //         let packetX = this.mainGraphState.currentPerspective().xScale!(parsedAckPacket.time);
            //         packetX = packetX > 0 ? packetX : 0;
            //         // const yCenter = ((correspondingPacket.to - correspondingPacket.from) / 2) + correspondingPacket.from;
            //         // const packetY = graphState.currentPerspective().yPacketScale(yCenter);
            //         const topY = this.mainGraphState.currentPerspective().yScale!(extraDetails.from);
            //         const bottomY = this.mainGraphState.currentPerspective().yScale!(extraDetails.to);
            //         const height = (topY - bottomY) * this.mainGraphState.currentPerspective().drawScaleY;
            //         const width = this.mainGraphState.currentPerspective().xScale!(parsedAckPacket.time) - packetX + (3 * this.mainGraphState.currentPerspective().drawScaleX);

            //         this.mainGraphState.graphSvg!
            //             .append("rect")
            //             .attr("class", "ackArrow")
            //             .attr("x", packetX)
            //             .attr("width", width)
            //             .attr("y", bottomY)
            //             .attr("height", height)
            //             .attr("fill", "#fff")
            //             .attr("stroke-width", "2px")
            //             .attr("stroke", "#686868");

            //         return;
            //     } else if (pixelColor[0] === 255 && pixelColor[1] === 0 && pixelColor[2] === 0 ) {
            //             // lost packet
            //             this.mainGraphState.packetInformationDiv!.style("display", "block");
            //             this.mainGraphState.packetInformationDiv!.style("left", (svgHoverCoords[0] + this.mainGraphState.margins.left - 50 + 10) + "px");
            //             this.mainGraphState.packetInformationDiv!.style("top", (svgHoverCoords[1] + this.mainGraphState.margins.top + 10) + "px");
            //             this.mainGraphState.packetInformationDiv!.select("#timestamp").text("Timestamp: " + packet.timestamp);
            //             this.mainGraphState.packetInformationDiv!.select("#packetNr").text("PacketNr: " + packet.details.header.packet_number);
            //             this.mainGraphState.packetInformationDiv!.select("#packetSize").text("PacketSize: " + packet.details.header.packet_size);
            //             return;
            //     }
            // }
        }
    }

    private panCanvas(deltaX: number, deltaY: number){
        // Check if pan stays within boundaries
        // If not, set the delta to snap to boundary instead of passing it
        if (this.mainGraphState.currentPerspective().rangeX[0] + deltaX < 0) {
            deltaX = 0 - this.mainGraphState.currentPerspective().rangeX[0];
        } else if (this.mainGraphState.currentPerspective().rangeX[1] + deltaX > this.mainGraphState.currentPerspective().originalRangeX[1]) {
            deltaX = this.mainGraphState.currentPerspective().originalRangeX[1] - this.mainGraphState.currentPerspective().rangeX[1];
        }
        if (this.mainGraphState.currentPerspective().rangeY[0] + deltaY < 0) {
            deltaY = 0 - this.mainGraphState.currentPerspective().rangeY[0];
        } else if (this.mainGraphState.currentPerspective().rangeY[1] + deltaY > this.mainGraphState.currentPerspective().originalRangeY[1]) {
            deltaY = this.mainGraphState.currentPerspective().originalRangeY[1] - this.mainGraphState.currentPerspective().rangeY[1];
        }

        const newLeftX =  this.mainGraphState.currentPerspective().rangeX[0] + deltaX;
        const newRightX = this.mainGraphState.currentPerspective().rangeX[1] + deltaX;

        const newTopY = this.mainGraphState.currentPerspective().rangeY[0] + deltaY;
        const newBottomY =  this.mainGraphState.currentPerspective().rangeY[1] + deltaY;

        this.redrawCanvas(newLeftX, newRightX, newTopY, newBottomY);
    }

    private useBrushX(){
        this.mainGraphState.mouseHandlerBrush2dSvg!.style('z-index', 0);
        this.mainGraphState.mouseHandlerBrushXSvg!.style('z-index', 1);
        this.mainGraphState.mouseHandlerPanningSvg!.style('z-index', 0);
        this.mainGraphState.mouseHandlerSelectionSvg!.style('z-index', 0);
        this.mainGraphState.mouseHandlerPickSvg!.style('z-index', 0);
    }

    private useBrush2d(){
        this.mainGraphState.mouseHandlerBrush2dSvg!.style('z-index', 1);
        this.mainGraphState.mouseHandlerBrushXSvg!.style('z-index', 0);
        this.mainGraphState.mouseHandlerPanningSvg!.style('z-index', 0);
        this.mainGraphState.mouseHandlerSelectionSvg!.style('z-index', 0);
        this.mainGraphState.mouseHandlerPickSvg!.style('z-index', 0);
    }

    private usePanning(){
        this.mainGraphState.mouseHandlerBrush2dSvg!.style('z-index', 0);
        this.mainGraphState.mouseHandlerBrushXSvg!.style('z-index', 0);
        this.mainGraphState.mouseHandlerPanningSvg!.style('z-index', 1);
        this.mainGraphState.mouseHandlerSelectionSvg!.style('z-index', 0);
        this.mainGraphState.mouseHandlerPickSvg!.style('z-index', 0);
    }

    private useSelection(){
        this.mainGraphState.mouseHandlerBrush2dSvg!.style('z-index', 0);
        this.mainGraphState.mouseHandlerBrushXSvg!.style('z-index', 0);
        this.mainGraphState.mouseHandlerPanningSvg!.style('z-index', 0);
        this.mainGraphState.mouseHandlerSelectionSvg!.style('z-index', 1);
        this.mainGraphState.mouseHandlerPickSvg!.style('z-index', 0);
    }

    private usePicker(){
        this.mainGraphState.mouseHandlerBrush2dSvg!.style('z-index', 0);
        this.mainGraphState.mouseHandlerBrushXSvg!.style('z-index', 0);
        this.mainGraphState.mouseHandlerPanningSvg!.style('z-index', 0);
        this.mainGraphState.mouseHandlerSelectionSvg!.style('z-index', 0);
        this.mainGraphState.mouseHandlerPickSvg!.style('z-index', 1);
    }

    private togglePerspective(){
        this.setPerspective(this.mainGraphState.useSentPerspective ? false : true, true);
    }

    private onBrushXEnd(){
        const selection = d3.event.selection;

        // Convert screen-space coordinates to graph coords
        const dragStartX = this.mainGraphState.currentPerspective().xScale!.invert(selection[0]);
        const dragStopX = this.mainGraphState.currentPerspective().xScale!.invert(selection[1]);

        // New dimensions
        const [minX, maxX] = dragStartX < dragStopX ? [dragStartX, dragStopX] : [dragStopX, dragStartX];
        const [minY, maxY] = this.findYExtrema(minX, maxX);

        this.redrawCanvas(minX, maxX, minY, maxY);

        this.mainGraphState.brushX!.move(this.mainGraphState.brushXElement!, null); // Clear brush highlight
        this.usePanning(); // Switch back to panning mode
    }

    private onBrush2dEnd(){
        const selection = d3.event.selection;

        // Convert screen-space coordinates to graph coords
        const dragStartX = this.mainGraphState.currentPerspective().xScale!.invert(selection[0][0]);
        const dragStopX = this.mainGraphState.currentPerspective().xScale!.invert(selection[1][0]);
        const dragStartY = this.mainGraphState.currentPerspective().yScale!.invert(selection[0][1]);
        const dragStopY = this.mainGraphState.currentPerspective().yScale!.invert(selection[1][1]);

        // New dimensions
        const [minX, maxX] = dragStartX < dragStopX ? [dragStartX, dragStopX] : [dragStopX, dragStartX];
        const [minY, maxY] = dragStartY < dragStopY ? [dragStartY, dragStopY] : [dragStopY, dragStartY];

        this.redrawCanvas(minX, maxX, minY, maxY);

        this.mainGraphState.brush2d!.move(this.mainGraphState.brush2dElement!, null); // Clear brush highlight
        this.usePanning(); // Switch back to panning mode
    }

    private onPickerClick(){
        const svgClickCoords = d3.mouse(d3.event.currentTarget);
        const graphCoords = [this.mainGraphState.currentPerspective().xScale!.invert(svgClickCoords[0]), this.mainGraphState.currentPerspective().yScale!.invert(svgClickCoords[1])];

        const pixelData = this.mainGraphState.canvasContext!.getImageData(svgClickCoords[0], svgClickCoords[1], 1, 1).data;
        const pixelColor = [ pixelData[0], pixelData[1], pixelData[2] ];

        this.mainGraphState.eventBus!.dispatchEvent(new CustomEvent('packetPickEvent', {
            detail: {
                x: graphCoords[0],
                y: graphCoords[1],
                pixelColor: pixelColor,
            },
        }));
    }

    private xScalingFunction(x: number): number {
        return (1 / (1 + Math.exp(-(x - 2) ))) + 1.2;
    }

    private yScalingFunction(y: number): number {
        return (1 / y) + 1;
    }

    // Searches for the min and max Y values (data sent/received) in a range
    private findYExtrema(minX: number, maxX: number): [number, number] {
        let min = Infinity;
        let max = 0;

        const packetList = this.mainGraphState.useSentPerspective ? this.packetsSent : this.packetsReceived;

        for (const packet of packetList) {
            const parsedPacket = this.config.connection!.parseEvent(packet);
            const extraData = ((packet as any) as IEventExtension).qvis.congestion;

            if (minX <= parsedPacket.time && parsedPacket.time <= maxX) {
                min = min > extraData.to ? extraData.to : min;
                max = max < extraData.to ? extraData.to : max;
            }
        }

        return [min, max];
    }

    // [minCongestionY, maxCongestionY, minRTT, maxRTT];
    private findMetricUpdateExtrema(range?: [number, number]): [number, number, number, number] {
        let minCongestionY = 0;
        let maxCongestionY = 0;
        let minRTT = 0;
        let maxRTT = 0;

        const minX = range !== undefined ? range[0] : this.mainGraphState.currentPerspective().originalRangeX[0];
        const maxX = range !== undefined ? range[1] : this.mainGraphState.currentPerspective().originalRangeX[1];

        const metricUpdates = this.metricUpdates;

        for (const update of metricUpdates) {
            const parsedUpdate = this.config.connection!.parseEvent(update);
            const data = parsedUpdate.data;

            if (data.bytes_in_flight && minX <= parsedUpdate.time && parsedUpdate.time <= maxX) {
                const y = data.bytes_in_flight;
                minCongestionY = minCongestionY > y ? y : minCongestionY;
                maxCongestionY = maxCongestionY < y ? y : maxCongestionY;
            }
            if (data.cwnd && minX <= parsedUpdate.time && parsedUpdate.time <= maxX) {
                const y = data.cwnd;
                minCongestionY = minCongestionY > y ? y : minCongestionY;
                maxCongestionY = maxCongestionY < y ? y : maxCongestionY;
            }
            if (data.min_rtt && minX <= parsedUpdate.time && parsedUpdate.time <= maxX) {
                const y = parsedUpdate.timeToMilliseconds(data.min_rtt);
                minRTT = minRTT > y ? y : minRTT;
                maxRTT = maxRTT < y ? y : maxRTT;
            }
            if (data.smoothed_rtt && minX <= parsedUpdate.time && parsedUpdate.time <= maxX) {
                const y = parsedUpdate.timeToMilliseconds(data.smoothed_rtt);
                minRTT = minRTT > y ? y : minRTT;
                maxRTT = maxRTT < y ? y : maxRTT;
            }
            if (data.latest_rtt && minX <= parsedUpdate.time && parsedUpdate.time <= maxX) {
                const y = parsedUpdate.timeToMilliseconds(data.latest_rtt);
                minRTT = minRTT > y ? y : minRTT;
                maxRTT = maxRTT < y ? y : maxRTT;
            }
        }

        return [minCongestionY, maxCongestionY, minRTT, maxRTT];
    }

    private createPrivateNamespace(obj: any): void {
        if (obj.qvis === undefined) {
            Object.defineProperty(obj, "qvis", { enumerable: false, value: {} });
        }

        if (obj.qvis.congestion === undefined ) {
            obj.qvis.congestion = {};
        }
    }

    private fixMetricUpdates(originalUpdates: Array<[number, number]>) {
        const output: Array<[number, number]> = [];

        if( originalUpdates.length == 0 )
            return output;

        let lastValue = 0;
        for( let point of originalUpdates ){
            if( originalUpdates.length > 0 )
                output.push( [point[0], lastValue] );

            output.push( point );
            lastValue = point[1];
        }
        // the final point should go all the way to the right
        output.push( [ this.mainGraphState.currentPerspective().originalRangeX[1] + 1,  output[ output.length - 1 ][1] ] );
        //output[0][0] = 0; // let's it start at the 0-point of the x-axis

        return output;
    }
}

interface IEventExtension {
    qvis: {
        congestion: {
            from: number,
            to: number,
            correspondingPacket?: Array<any>, // Pointer to the packet the loss or ack refers to
            correspondingAck?: Array<any>, // Pointer to the ack event
            correspondingLoss?: Array<any>, // Pointer to the loss event
        },
    },
}
