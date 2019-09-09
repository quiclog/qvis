import QlogConnection from '@/data/Connection';

export interface IQlogEventParser {

    readonly time:number;
    readonly category:string;
             name:string; // name is not a readonly since we want to be able to change it when cloning traces (e.g., in sequenceDiagram)
    readonly trigger:string;
    readonly data:any|undefined;

    readonly timeOffset:number;

    timeToMilliseconds(time: string | number): number;

    init( connection:QlogConnection) : void;
    load( evt:IQlogRawEvent ) : IQlogEventParser;

    timeWithCustomOffset( offset:number ):number;
}

export type IQlogRawEvent = Array<any>;
