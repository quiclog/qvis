import QlogConnection from '@/data/Connection';

export interface IQlogEventParser {

    readonly time:number;
    readonly category:string;
             name:string; // name is not a readonly since we want to be able to change it when cloning traces (e.g., in sequenceDiagram)
    readonly trigger:string;
    readonly data:any|undefined;

    init( connection:QlogConnection) : void;
    load( evt:IQlogRawEvent ) : IQlogEventParser;
}

export type IQlogRawEvent = Array<any>;