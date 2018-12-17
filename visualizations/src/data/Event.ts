export default class QlogEvent {

    public category:string = "";
    public name:string = "";
    public trigger:string = "";
    public triggerEvent?:Event = undefined;
    public data:any = undefined;

    // tslint:disable-next-line:no-empty
    public constructor() {
    }
}
