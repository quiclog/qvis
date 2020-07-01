import QlogConnection from '@/data/Connection';

export enum TimeTrackingMethod {
    ABSOLUTE_TIME,
    RELATIVE_TIME,
    DELTA_TIME,
}

export interface IQlogEventParser {

    readonly relativeTime:number;
    readonly absoluteTime:number;
    readonly category:string;
             name:string; // name is not a readonly since we want to be able to change it when cloning traces (e.g., in sequenceDiagram)
    readonly data:any|undefined;

    readonly timeOffset:number;

    timeToMilliseconds(time: string | number): number;
    getAbsoluteStartTime(): number;

    init( connection:QlogConnection) : void;
    load( evt:IQlogRawEvent ) : IQlogEventParser;

    getTimeTrackingMethod() : TimeTrackingMethod;
    setReferenceTime(time:number) : void; // should not be needed normally
}

export type IQlogRawEvent = Array<any>;
