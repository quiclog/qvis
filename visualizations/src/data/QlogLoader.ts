import QlogConnectionGroup from '@/data/ConnectionGroup';


import * as qlog from '@quictools/qlog-schema'; 
import * as qlogPreSpec from '@quictools/qlog-schema/draft-16/QLog'; 
import { QUtil } from '@quictools/qlog-schema/util'; 
import QlogConnection from '@/data/Connection';
import { IQlogEventParser, IQlogRawEvent } from '@/data/QlogEventParser';


export class QlogLoader {

    public static fromJSON(json:any) : QlogConnectionGroup | undefined {

        if ( json && json.qlog_version ){
            const version = json.qlog_version;
            if ( version === "0.1" ){
                return QlogLoader.fromPreSpec(json);
            }
            else if ( version === "draft-00" ){
                return QlogLoader.fromDraft00(json);
            }
            else {
                return undefined;
            }
        }
        else {
            return undefined;
        }

    }

    protected static fromDraft00(json:any) : QlogConnectionGroup {
        const group = new QlogConnectionGroup();

        return group;
    }

    protected static fromPreSpec(json:any) : QlogConnectionGroup {
        
        const fileContents:qlogPreSpec.IQLog = json as qlogPreSpec.IQLog;

        console.log("QlogLoader:fromPreSpec : ", fileContents, fileContents.connections);

        // QLog00 toplevel structure contains a list of connections
        // most files currently just contain a single connection, but the idea is to allow bundling connections on a single file
        // for example 1 log for the server and 1 for the client and 1 for the network, all contained in 1 file
        // This is why we call it a ConnectionGroup here, instead of QlogFile or something 
        const group = new QlogConnectionGroup();
        group.description = fileContents.description || "";

        for ( const jsonconnection of fileContents.connections ){

            const connection = new QlogConnection(group);

            // metadata can be just a string, so use that
            // OR it can be a full object, in which case we want just the description here 
            let description = "";
            if ( jsonconnection.metadata ){
                if ( typeof jsonconnection.metadata === "string" ){
                    description = jsonconnection.metadata;
                }
                else if ( jsonconnection.metadata.description ){ // can be empty object {}
                    description = jsonconnection.metadata.description;
                }
            }

            if ( jsonconnection.vantagepoint ){
                connection.vantagePoint = {} as qlog.IVantagePoint;
                if ( jsonconnection.vantagepoint === "SERVER" ){
                    connection.vantagePoint.type = qlog.VantagePointType.server;
                }
                else if ( jsonconnection.vantagepoint === "CLIENT" ){
                    connection.vantagePoint.type = qlog.VantagePointType.client;
                }
                else if ( jsonconnection.vantagepoint === "NETWORK" ){
                    connection.vantagePoint.type = qlog.VantagePointType.network;
                    connection.vantagePoint.flow = qlog.VantagePointType.client;
                }
            }
            
            connection.title = jsonconnection.vantagepoint + " : " + description;
            connection.description = description;

            /*
            const wrap = QUtil.WrapEvent(null);

            for ( const jsonevt of jsonconnection.events ){
                wrap.evt = jsonevt;

                const evt2:QlogEvent = new QlogEvent();
                evt2.time       = wrap.time;
                evt2.category   = wrap.category; 
                evt2.name       = wrap.type;
                evt2.trigger    = wrap.trigger;
                evt2.data       = wrap.data;

                connection.AddEvent(evt2);
            }
            */
            connection.SetEvents( jsonconnection.events as any );

            connection.SetEventParser( new PreSpecEventParser() );
        }

        return group;
    }
}

// tslint:disable max-classes-per-file
export class PreSpecEventParser implements IQlogEventParser {

    private currentEvent:IQlogRawEvent|undefined;

    public get time():number {
        return (this.currentEvent as IQlogRawEvent)[0];
    }
    public get category():string {
        return (this.currentEvent as IQlogRawEvent)[1];
    }
    public get name():string {
        return (this.currentEvent as IQlogRawEvent)[2];
    }
    public get trigger():string {
        return (this.currentEvent as IQlogRawEvent)[3];
    }
    public get data():any|undefined {
        return (this.currentEvent as IQlogRawEvent)[4];
    }

    public init( trace:QlogConnection ) {
        this.currentEvent = undefined;
    }

    public load( evt:IQlogRawEvent ) : IQlogEventParser {
        this.currentEvent = evt;

        return this;
    } 
}
