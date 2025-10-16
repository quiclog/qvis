<script lang="ts">
    import { store } from "@src/lib/store/ConnectionStore.svelte";
    import type { MouseEventHandler } from "svelte/elements";
    import { toast } from 'svelte-sonner';

    let urlToLoad:string = "";
    let secretsToLoad:string = "";

    let filesToUpload:Array<File> = new Array<File>();
    let secretsToUpload:File|null = null;

    // TODO: make dynamic:
    let uploadIsPcap:boolean = false;
    let urlIsPcap:boolean = false;
    let filesLoaded:boolean = false;


    function updateStore() {
        console.log("Updating store - loading random file");
        store.DEBUG_LoadRandomFile("RobinAddsStuff " + Math.random());
    }

    function loadExamples(e:MouseEvent) {
        let alreadyLoaded = false;

        for (const  group of store.groups ){
            if ( group.filename.indexOf("DEMO") === 0 ){
                alreadyLoaded = true;
                break;
            }
        }

        if ( alreadyLoaded ){

            console.log("FileManagerContainer:loadExamples: Example files already loaded, not loading again");

            toast.warning("Example files were already loaded, not loading again", 
                            { description: "Example files were already loaded, check for files with the 'DEMO_' prefix." } );

            // Vue.notify({
            //     group: "default",
            //     title: "Example files already loaded",
            //     type: "warn",
            //     text: "Example files were already loaded, check for files with the 'DEMO_' prefix.",
            // });

            return;
        }

        store.loadExamplesForDemo();
    }

/*
    import { getModule } from "vuex-module-decorators";
    import { Component, Vue } from "vue-property-decorator";
    import ConnectionStore from "@/store/ConnectionStore";

    import * as qlog02 from "@/data/QlogSchema02";
    import TCPToQLOG from "./pcapconverter/tcptoqlog";
    import NetlogToQLOG from "./netlogconverter/netlogtoqlog";
    import FileLoader, { FileResult } from "./data/FileLoader";

    import StreamingJSONParser from "./utils/StreamingJSONParser";
    import QlogConnectionGroup from '../../data/ConnectionGroup';
    import { QlogSchemaConverter } from '../../data/QlogSchemaConverter';

    @Component({})
    export default class FileManagerContainer extends Vue {

        protected store:ConnectionStore = getModule(ConnectionStore, this.$store);

        protected urlToLoad:string = "";
        protected secretsToLoad:string = "";

        protected filesToUpload:Array<File> = new Array<File>();
        protected secretsToUpload:File|null = null;

        public loadURL(){

            if ( this.urlIsPcap && this.secretsToLoad === "" ){
                Vue.notify({
                    group: "default",
                    title: "Provide .keys file",
                    type: "error",
                    duration: 6000,
                    text: "You're linking to a .pcap without also providing a .keys file. This is currently not supported.",
                });

                return;
            }

            const params:any = {};
            if ( this.urlToLoad.endsWith(".json") ){
                params.list = this.urlToLoad;
            }
            else {
                params.file = this.urlToLoad;
            };

            if ( this.secretsToLoad !== "" ){
                params.secrets = this.secretsToLoad;
            }

            this.store.loadFilesFromServer( params );
        }

        public uploadFile(){

            if ( this.uploadIsPcap && this.secretsToUpload === null ){
                Vue.notify({
                    group: "default",
                    title: "Provide .keys file",
                    type: "error",
                    duration: 6000,
                    text: "You're uploading a .pcap without also providing a .keys file. This is currently not supported.",
                });

                return;
            }

            for ( const file of this.filesToUpload ){

                if ( file === null || (!file.name.endsWith(".qlog") && !file.name.endsWith(".sqlog") && !file.name.endsWith(".json")) && !file.name.endsWith(".netlog") && !file.name.endsWith(".qlognd")) {
                    Vue.notify({
                        group: "default",
                        title: "Provide .qlog/.sqlog file",
                        type: "error",
                        duration: 6000,
                        text: "We currently only support uploading .qlog/.sqlog files. " + file.name,
                    });
                
                    return;
                }
            }

            for ( const file of this.filesToUpload ){

                const uploadFileName = file.name;
                Vue.notify({
                    group: "default",
                    title: "Loading uploaded file",
                    text: "Loading uploaded file " + uploadFileName + ".<br/>The file is not sent to a server.",
                });

                FileLoader.Load( file, file.name ).then( (result:FileResult) => {
                    
                    this.store.addGroupFromQlogFile({fileContentsJSON: result.qlogJSON, fileInfo:{ filename: uploadFileName }});

                    Vue.notify({
                        group: "default",
                        title: "Uploaded file",
                        type: "success",
                        text: "The uploaded file is now available for visualization " + uploadFileName + ".<br/>Use the menu above to switch views.",
                    });
                })
                .catch( (reason:any) => {
                    console.error("FileManagerContainer:uploadFile : ", reason);

                    Vue.notify({
                        group: "default",
                        title: "Error uploading file",
                        type: "error",
                        duration: 6000,
                        text: "Something went wrong. " + uploadFileName + ". For more information, view the devtools console.",
                    });
                });
            }
        }

        

        public loadMassiveExample(){
            let alreadyLoaded = false;
            for (const  group of this.store.groups ){
                if ( group.filename.indexOf("MASSIVE_DEMO_mvfst_large") >= 0 ){
                    alreadyLoaded = true;
                    break;
                }
            }

            if ( alreadyLoaded ){

                Vue.notify({
                    group: "default",
                    title: "Example file already loaded",
                    type: "warn",
                    text: "Example file was already loaded, it is called 'MASSIVE_DEMO_mvfst_large'.",
                });

                return;
            }

            this.store.loadQlogDirectlyFromURL( { url : "standalone_data/draft-00/mvfst_large.qlog", filename: "MASSIVE_DEMO_mvfst_large.qlog (31MB)"} );
        }

        public removeGroup(group:QlogConnectionGroup) {
            console.log("FileManagerContainer:removeGroup : removing group ", group);

            this.store.removeGroup( group );
        }

        public downloadGroup(group:QlogConnectionGroup) {
            console.log("FileManagerContainer:downloadGroup : downloading internal qlog representation of group ", group);

            const internalQlog = QlogSchemaConverter.Convert01to02( group );

            const DEBUGfilter = false;
            if ( DEBUGfilter ) {
                for ( const connection of internalQlog.traces ) {
                    const newEvents = (connection as qlog02.ITrace).events.filter( (evt) => (
                        evt.name === qlog02.EventCategory.transport + ":" + qlog02.TransportEventType.packet_sent ||
                        evt.name === qlog02.EventCategory.transport + ":" + qlog02.TransportEventType.packet_received ||
                        evt.name === qlog02.EventCategory.transport + ":" + qlog02.TransportEventType.parameters_set ||
                        evt.name === qlog02.EventCategory.http + ":" + qlog02.HTTP3EventType.frame_created ||
                        evt.name === qlog02.EventCategory.http + qlog02.HTTP3EventType.frame_parsed ||
                        evt.name!.indexOf("session_ticket_used") >= 0
                    ));

                    (connection as qlog02.ITrace).events = newEvents;
                }
            }

            let filename = "" + group.filename;
            if ( group.URL && group.URL.length > 0 ) {
                filename = group.URL.substr( group.URL.lastIndexOf("/") );
            }

            if ( filename.length === 0 ) {
                filename = "trace";
            }

            if ( !filename.endsWith(".qlog") ) {
                filename += ".qlog";
            }

            const link = document.createElement('a');
            link.href = window.URL.createObjectURL( new Blob([JSON.stringify(internalQlog, null, 2)], {type : 'application/json'}) );
            link.download = filename;

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }

        protected get urlIsPcap(){
            return this.urlToLoad.indexOf(".pcap") >= 0 && this.urlToLoad.indexOf(".pcapng") < 0;
        }

        protected get uploadIsPcap(){
            return false; // this.fileToUpload !== null && this.fileToUpload.name.indexOf(".pcap") >= 0;
        }

        protected get filesLoaded() {
            return this.store.groups.length > 0;
        }

        protected get allGroups() {
            return this.store.groups;
        }
    }
    */
</script>

<div class="home">
    <h1>Welcome to qvis v0.1, the QUIC and HTTP/3 visualization toolsuite!</h1>
    <p>To be able to visualize something, you need to load some data. We have several options for that:</p>

    <div id="FileManagerContainer" class="container-fluid table-striped">
    <div class="row fileOptionContainer">
        <div class="col-1 col-md-auto"><h3>Option 1</h3></div>
        <div class="col">
            <h3>Load a file by URL</h3>
            <div style="margin: 10px 0px;">
                <form> 
                    <div class="row">
                        <div class="col">
                            <b-form-input v-model="urlToLoad" id="urlInput" type="text" placeholder="https://www.example.com/output.qlog"></b-form-input>
                            {#if urlIsPcap}
                            <p style="margin-top: 10px;">For .pcap files, you also need to specify a .keys file so it can be decrypted.</p>
                            {/if}
                            <b-form-input v-if="urlIsPcap" v-model="secretsToLoad" id="secretsInput" type="text" placeholder="https://www.example.com/secrets.keys"></b-form-input>
                        </div>
                        <div class="col-1 col-md-auto"> 
                            <!-- <b-button @click="loadURL()"  :disabled="this.urlToLoad === ''" variant="primary">Fetch</b-button> -->
                        </div>
                    </div>
                </form>
            </div>
            <div>
                <p style="margin-top: 5px;">
                    You can load .qlog, .sqlog, .netlog, .pcap (alongside separate .keys) and .pcapng (with embedded keys) files.<br/>
                    You can also load a .json file that lists several other files to be fetched (for the format, see <a href="https://github.com/quiclog/pcap2qlog#options">the pcap2qlog documentation</a>. Or try <a href="https://quic-tracker.info.ucl.ac.be/traces/20190820/list/quant.eggert.org:4433?.json">an example</a>).<br/><br/>
                    If you're looking for inspiration, <a href="https://quant.eggert.org/" target="_blank">quant</a> has public qlogs, as does <a href="https://quic.aiortc.org/logs" target="_blank">aioquic</a>.<br/>
                    <a href="https://quic-tracker.info.ucl.ac.be">QUIC Tracker</a> provides .pcap files for all its tests and has a convenient integration with qvis from its UI. <br/>
                    Many of the tests in the <a href="https://interop.seemann.io/">QUIC Interop Runner</a> also include .qlog and .pcap output.
                </p>
            </div>
        </div>
    </div>

    <div class="row fileOptionContainer">
        <div class="col-1 col-md-auto"><h3>Option 2</h3></div>
        <div class="col">
            <h3>Upload a file</h3>
            <div style="margin: 10px 0px;">
                <form> 
                    <div class="row">
                        <div class="col">
                            <!-- <b-form-file
                                id="fileUpload"
                                multiple
                                v-model="filesToUpload"
                                :state="Boolean(filesToUpload.length > 0)"
                                placeholder="Choose files or drop them here..."
                                drop-placeholder="Drop files here..."
                                accept=".qlog,.sqlog,.json,.netlog"
                                class="text-nowrap text-truncate"
                                ></b-form-file>
                                
                                {#if uploadIsPcap}
                                    <p style="margin-top: 10px;">For .pcap files, you also need to upload a .keys file so it can be decrypted. We currently do not yet support decrypted pcaps or pcapng files with embedded keys.</p>
                                    
                                    <b-form-file
                                    id="secretsUpload"
                                    v-if="uploadIsPcap"
                                    v-model="secretsToUpload"
                                    :state="Boolean(secretsToUpload)"
                                    placeholder="Choose a .keys file or drop it here..."
                                    drop-placeholder="Drop .keys file here..."
                                    accept=".keys"
                                    ></b-form-file>
                                {/if}
                                 -->
                        </div>
                        <div class="col-1 col-md-auto"> 
                            <!-- <b-button @click="uploadFile()" :disabled="filesToUpload.length === 0" variant="primary">Import</b-button> -->
                        </div>
                    </div>
                </form>
            </div>
            <div>
                <p>
                    <!-- Upload supports the same formats as Option 1. You can only upload a single file at a time.<br/> -->
                    Upload currently supports .qlog, .sqlog, .json, and <a href="https://www.chromium.org/for-testers/providing-network-details">.netlog</a> files. No data is transfered to the server.<br/>
                    Eventually we will also support .pcap, .pcapng and .qtr files.<br/>
                    <span style="font-size: 12px;">
                        Note: Chrome netlog must be explicitly given the .netlog extension before uploading to qvis.
                    </span>
                </p>
            </div>
        </div>
    </div>

    <div class="row fileOptionContainer">
        <div class="col-1 col-md-auto"><h3>Option 3</h3></div>
        <div class="col">
            <h3>Load some premade demo files</h3>
            <div style="margin: 10px 0px;">
                <form> 
                    <button type="button" class="btn btn-primary" on:click|preventDefault={loadExamples}>Load example .qlog files</button>
                </form>
            </div>
            <div>
                <p>
                    This will load a few example files that you can visualize to get an idea of what's possible.<br/>
                </p>
            </div>
        </div>
    </div>

    <div class="row fileOptionContainer">
        <div class="col-1 col-md-auto"><h3>Option 4</h3></div>
        <div class="col">
            <h3>Load a massive demo file</h3>
            <div style="margin: 10px 0px;">
                <form> 
                    <!-- <b-button @click="loadMassiveExample()" variant="primary">Load 31MB .qlog file</b-button> -->
                </form>
            </div>
            <div>
                <p>
                    This will load a single qlog file representing a 100MB download. Use this to see how well qvis visualizations perform on larger traces.<br/>
                </p>
            </div>
        </div>
    </div>

    <div class="row fileOptionContainer">
        <div class="col-1 col-md-auto"><h3>Option 5</h3></div>
        <div class="col">
            <h3>Load a file by URL parameter</h3>
            <div style="margin: 10px 0px;">
                <p>
                    You can pass files you want to load via URL parameters to the qvis page.<br/>
                    This method supports the same formats as Option 1.<br/><br/>

                    Format 1: <a href="https://qvis.quictools.info/#?list=x.json">?list=x.json</a><br/>
                    Format 2: <a href="https://qvis.quictools.info/#?file=x.qlog">?file=x.qlog</a><br/>
                    Format 3: <a href="https://qvis.quictools.info/#?file=x.pcap&amp;secrets=x.keys">?file=x.pcap&amp;secrets=x.keys</a><br/>
                    Format 4: <a href="https://qvis.quictools.info/#?file1=x.qlog&amp;file2=y.qlog&amp;file3=z.qlog">?file1=x.qlog&amp;file2=y.qlog&amp;file3=z.qlog</a><br/>
                    Format 5: <a href="https://qvis.quictools.info/#?file1=x.qlog&amp;secrets1=x.keys&amp;file2=y.qlog&amp;secrets2=y.keys">?file1=x.qlog&amp;secrets1=x.keys&amp;file2=y.qlog&amp;secrets2=y.keys</a><br/>
                </p>
            </div>
        </div>
    </div>

    {#if filesLoaded}
    <div class="row fileOptionContainer" style="padding: 50px 0;">
    <div class="col">
        <div class="row">
            <div class="col-1 col-md-auto"><h3>List of loaded files</h3></div>
        </div>
        <div class="row">
            <div class="container" id="loadedGroupsContainer">
                <!-- <div class="row py-1" v-for="(group, index) in allGroups" :key="'group_'+index">
                    <div class="col text-left">
                        <span v-if="group.URL !== undefined && group.URL.length > 0">
                            <a :href="group.URL">{{group.URLshort}}</a>
                        </span>
                        <span v-else>
                            {{group.filename}}
                        </span>
                        <br />
                        <span style="font-size: 0.8em">{{group.getShorthand()}}</span>
                    </div>
                    
                    <div class="col-2 text-center">
                        <b-button @click="removeGroup(group)" variant="danger">Remove</b-button>
                    </div>
                    <div class="col-2 text-center">
                        <b-button @click="downloadGroup(group)" variant="info">Download</b-button>
                    </div>
                </div> -->
            </div>
        </div>
    </div>
    </div>
    {/if}

</div>
</div>

<style scoped>
    .home {
        width: 100%;
        text-align: center;
        margin-top: 20px;
    }

    #FileManagerContainer {
        width: 50%;
        max-width: 1000px;
        min-width: 500px;
    }

    .fileOptionContainer {
        padding: 10px;
        text-align: left;
    }

    .fileOptionContainer:nth-of-type(odd) {
        background-color: rgba(0,0,0,.05);
    }

    /* #loadedGroupsContainer :nth-child(even){
        background-color: #dcdcdc;
    } */
    /* #loadedGroupsContainer .row:nth-of-type(odd) {
        background-color: rgba(0,0,0,.05);
    }

    #loadedGroupsContainer .btn {
        margin-top: 5px;
    } */

</style>
