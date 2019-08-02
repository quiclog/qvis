import QlogConnection from '@/data/Connection';

export interface IQlogEventParser {

    readonly time:number;
    readonly category:string;
    readonly name:string;
    readonly trigger:string;
    readonly data:any|undefined;

    init( connection:QlogConnection) : void;
    load( evt:IQlogRawEvent ) : IQlogEventParser;
}

export type IQlogRawEvent = Array<any>;
