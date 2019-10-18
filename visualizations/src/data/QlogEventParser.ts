import QlogConnection from '@/data/Connection';

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
}

export type IQlogRawEvent = Array<any>;
