<template>
    <div class="home">
        <h1>Welcome to qvis v0.1, the QUIC and HTTP/3 visualization toolsuite!</h1>
        <p>To be able to visualize something, you need to load some data. We have several options for that:</p>

        <b-container id="FileManagerContainer" class="table-striped" fluid>
        <b-row class="fileOptionContainer">
            <b-col cols="1" md="auto"><h3>Option 1</h3></b-col>
            <b-col>
                <h3>Load a file by URL</h3>
                <div style="margin: 10px 0px;">
                    <form> 
                        <b-row>
                            <b-col>
                                <b-form-input                  v-model="urlToLoad" id="urlInput" type="text" placeholder="https://www.example.com/output.qlog"></b-form-input>
                                <p v-if="urlIsPcap" style="margin-top: 10px;">For .pcap files, you also need to specify a .keys file so it can be decrypted.</p>
                                <b-form-input v-if="urlIsPcap" v-model="secretsToLoad" id="secretsInput" type="text" placeholder="https://www.example.com/secrets.keys"></b-form-input>
                            </b-col>
                            <b-col cols="1" md="auto"> 
                                <b-button @click="loadURL()"  :disabled="this.urlToLoad === ''" variant="primary">Fetch</b-button>
                            </b-col>
                        </b-row>
                    </form>
                </div>
                <div>
                    <p style="margin-top: 5px;">
                        You can load .qlog, .netlog, .pcap (alongside separate .keys) and .pcapng (with embedded keys) files.<br/>
                        You can also load a .json file that lists several other files to be fetched (for the format, see <a href="https://github.com/quiclog/pcap2qlog#options">the pcap2qlog documentation</a>. Or try <a href="https://quic-tracker.info.ucl.ac.be/traces/20190820/list/quant.eggert.org:4433?.json">an example</a>).<br/><br/>
                        If you're looking for inspiration, <a href="https://quant.eggert.org/" target="_blank">quant</a> has public qlogs, as does <a href="https://quic.aiortc.org/logs" target="_blank">aioquic</a>.<br/>
                        <a href="https://quic-tracker.info.ucl.ac.be">QUIC Tracker</a> provides .pcap files for all its tests and has a convenient integration with qvis from its UI. <br/>
                        Many of the tests in the <a href="https://interop.seemann.io/">QUIC Interop Runner</a> also include .qlog and .pcap output.
                    </p>
                </div>
            </b-col>
        </b-row>
        <b-row class="fileOptionContainer">
            <b-col cols="1" md="auto"><h3>Option 2</h3></b-col>
            <b-col>
                <h3>Upload a file</h3>
                <div style="margin: 10px 0px;">
                    <form> 
                        <b-row>
                            <b-col>
                                <b-form-file
                                    id="fileUpload"
                                    multiple
                                    v-model="filesToUpload"
                                    :state="Boolean(filesToUpload.length > 0)"
                                    placeholder="Choose files or drop them here..."
                                    drop-placeholder="Drop files here..."
                                    accept=".qlog,.qlognd,.json,.netlog"
                                    class="text-nowrap text-truncate"
                                    ></b-form-file>

                                    <p v-if="uploadIsPcap" style="margin-top: 10px;">For .pcap files, you also need to upload a .keys file so it can be decrypted. We currently do not yet support decrypted pcaps or pcapng files with embedded keys.</p>
                                    
                                    <b-form-file
                                    id="secretsUpload"
                                    v-if="uploadIsPcap"
                                    v-model="secretsToUpload"
                                    :state="Boolean(secretsToUpload)"
                                    placeholder="Choose a .keys file or drop it here..."
                                    drop-placeholder="Drop .keys file here..."
                                    accept=".keys"
                                    ></b-form-file>
                            </b-col>
                            <b-col cols="1" md="auto"> 
                                <b-button @click="uploadFile()" :disabled="filesToUpload.length === 0" variant="primary">Import</b-button>
                            </b-col>
                        </b-row>
                    </form>
                </div>
                <div>
                    <p>
                        <!--Upload supports the same formats as Option 1. You can only upload a single file at a time.<br/>-->
                        Upload currently supports .qlog, .json, and <a href="https://www.chromium.org/for-testers/providing-network-details">.netlog</a> files. No data is transfered to the server.<br/>
                        Eventually we will also support .pcap, .pcapng and .qtr files.<br/>
                        <span style="font-size: 12px;">
                            Note: Chrome netlog must be explicitly given the .netlog extension before uploading to qvis.
                        </span>
                    </p>
                </div>
            </b-col>
        </b-row>

        <b-row class="fileOptionContainer">
            <b-col cols="1" md="auto"><h3>Option 3</h3></b-col>
            <b-col>
                <h3>Load some premade demo files</h3>
                <div style="margin: 10px 0px;">
                    <form> 
                        <b-button @click="loadExamples()" variant="primary">Load example .qlog files</b-button>
                    </form>
                </div>
                <div>
                    <p>
                        This will load a few example files that you can visualize to get an idea of what's possible.<br/>
                    </p>
                </div>
            </b-col>
        </b-row>

        <b-row class="fileOptionContainer">
            <b-col cols="1" md="auto"><h3>Option 4</h3></b-col>
            <b-col>
                <h3>Load a massive demo file</h3>
                <div style="margin: 10px 0px;">
                    <form> 
                        <b-button @click="loadMassiveExample()" variant="primary">Load 31MB .qlog file</b-button>
                    </form>
                </div>
                <div>
                    <p>
                        This will load a single qlog file representing a 100MB download. Use this to see how well qvis visualizations perform on larger traces.<br/>
                    </p>
                </div>
            </b-col>
        </b-row>

        <b-row class="fileOptionContainer">
            <b-col cols="1" md="auto"><h3>Option 5</h3></b-col>
            <b-col>
                <h3>Load a file by URL parameter</h3>
                <div style="margin: 10px 0px;">
                    <p>
                        You can pass files you want to load via URL parameters to the qvis page.<br/>
                        This method supports the same formats as Option 1.<br/><br/>

                        Format 1: <a href="https://qvis.edm.uhasselt.be/#?list=x.json">?list=x.json</a><br/>
                        Format 2: <a href="https://qvis.edm.uhasselt.be/#?file=x.qlog">?file=x.qlog</a><br/>
                        Format 3: <a href="https://qvis.edm.uhasselt.be/#?file=x.pcap&amp;secrets=x.keys">?file=x.pcap&amp;secrets=x.keys</a><br/>
                        Format 4: <a href="https://qvis.edm.uhasselt.be/#?file1=x.qlog&amp;file2=y.qlog&amp;file3=z.qlog">?file1=x.qlog&amp;file2=y.qlog&amp;file3=z.qlog</a><br/>
                        Format 5: <a href="https://qvis.edm.uhasselt.be/#?file1=x.qlog&amp;secrets1=x.keys&amp;file2=y.qlog&amp;secrets2=y.keys">?file1=x.qlog&amp;secrets1=x.keys&amp;file2=y.qlog&amp;secrets2=y.keys</a><br/>
                    </p>
                </div>
            </b-col>
        </b-row>

        <b-row v-if="filesLoaded" class="fileOptionContainer" style="padding: 50px 0;">
            <b-col>
                <b-row >
                    <b-col cols="1" md="auto"><h3>List of loaded files</h3></b-col>
                </b-row>
                <b-row>
                    <b-container id="loadedGroupsContainer">
                        <b-row v-for="(group, index) in allGroups" :key="'group_'+index" class="py-1">
                            <b-col class="text-left">
                                <span v-if="group.URL !== undefined && group.URL.length > 0">
                                    <a :href="group.URL">{{group.URLshort}}</a>
                                </span>
                                <span v-else>
                                    {{group.filename}}
                                </span>
                                <br />
                                <span style="font-size: 0.8em">{{group.getShorthand()}}</span>
                            </b-col>
                            
                            <b-col cols="2" class="text-center">
                                <b-button @click="removeGroup(group)" variant="danger">Remove</b-button>
                            </b-col>
                            <b-col cols="2" class="text-center">
                                <b-button @click="downloadGroup(group)" variant="info">Download</b-button>
                            </b-col>
                        </b-row>
                    </b-container>
                </b-row>
            </b-col>
        </b-row>

        </b-container>

    </div>
</template>

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
    #loadedGroupsContainer .row:nth-of-type(odd) {
        background-color: rgba(0,0,0,.05);
    }

    #loadedGroupsContainer .btn {
        margin-top: 5px;
    }

</style>

<script lang="ts">
    import { getModule } from "vuex-module-decorators";
    import { Component, Vue } from "vue-property-decorator";
    import ConnectionStore from "@/store/ConnectionStore";

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

            let filteredFilesToUpload: Array<File> = [];
            for ( const file of this.filesToUpload ){

                if ( file === null || (!file.name.endsWith(".qlog") && !file.name.endsWith(".json")) && !file.name.endsWith(".netlog") && !file.name.endsWith(".qlognd")) {
                    Vue.notify({
                        group: "default",
                        title: "Provide .qlog, .qlognd, .json, or .netlog file",
                        type: "error",
                        duration: 6000,
                        text: "Cannot accept " + file.name + "; we currently only support uploading .qlog, .qlognd, .json, or .netlog files. ",
                    });
                }
                else {
                    filteredFilesToUpload.push(file);
                }
            }

            for ( const file of filteredFilesToUpload ){

                const uploadFileName = file.name;
                Vue.notify({
                    group: "default",
                    title: "Loading uploaded file",
                    text: "Loading uploaded file " + uploadFileName + ".<br/>The file is not sent to a server.",
                });

                // const reader = new FileReader();

                // reader.onload = (evt) => {
                //     try{

                //         if ( file.name.endsWith(".qlog") ) {
                //             const contentsJSON = StreamingJSONParser.parseQlogText( (evt!.target as any).result );
                //             this.store.addGroupFromQlogFile({fileContentsJSON: contentsJSON, fileInfo:{ filename: uploadFileName }});
                //         }
                //         else if ( file.name.endsWith(".json") ) {
                //             const contentsJSON = StreamingJSONParser.parseJSONWithDeduplication( (evt!.target as any).result );

                //             const qlogJSON = TCPToQLOG.convert( contentsJSON );
                //             this.store.addGroupFromQlogFile({fileContentsJSON: qlogJSON, fileInfo:{ filename: uploadFileName }});
                //         } 
                //         else if (file.name.endsWith(".netlog")) {
                //             const contentsJSON = JSON.parse( (evt!.target as any).result );
                            
                //             const qlogJSON = NetlogToQLOG.convert( contentsJSON );
                //             this.store.addGroupFromQlogFile({fileContentsJSON: qlogJSON, fileInfo:{ filename: uploadFileName }});
                //         }
                //         else if (file.name.endsWith(".qlognd")) {
                //             // const contentsJSON = JSON.parse( (evt!.target as any).result );
                            
                //             // const qlogJSON = NetlogToQLOG.convert( contentsJSON );
                //             // this.store.addGroupFromQlogFile({fileContentsJSON: qlogJSON, fileInfo:{ filename: uploadFileName }});
                //             let countedEvents = 0;
                //             let events:any = [];
                            

                //             // const fileContents = new Response( (evt!.target as any).result );

                //             // ndjsonStream( fileContents ).then ( (jsonStream:any) => {

                //             // console.log( file );
                //             // console.log( Object.keys(file) );

                //             // ref: https://stackoverflow.com/questions/14438187/javascript-filereader-parsing-long-file-in-chunks
                //             // let blob = new Blob([(evt!.target as any).result]);
                //             // let resp = new Response(blob).body;
                //             let resp = new Response(file).body;


                //             let countTheStuff:any = () => {
                //                 countedEvents++;
                //             };

                //             let jsonStream = ndjsonStream( resp );
                //             console.log("NDSTREAM ", jsonStream);

                //             // ndstream.then ( (jsonStream:any) => {
                //                 const streamReader = jsonStream.getReader(); 
                //                 let read:any = undefined;

                //                 streamReader.read().then( read = ( result:any ) => {
                //                     if ( result.done ) {
                //                         let endTime = performance.now();
                //                         console.log("NDJSON ALL DONE!", endTime - startTime, countedEvents, events.length);
                //                         return;
                //                     }

                //                     countTheStuff();
                //                     console.log( result.value.length, result.value );

                //                     streamReader.read().then( read );
                //                 } );
                //             // });

                //             // const input = Readable.from( [(evt!.target as any).result] );

                //             // robin: need to switch to something that uses JS streams isntead of NodeJS streams because this ecosystem sucks
                //             // this seems to have potential: https://canjs.com/doc/can-ndjson-stream.html

                //             // let self = this;

                //             // input.on("end", function() {
                //             //     self.store.addGroupFromQlogFile({fileContentsJSON: {}, fileInfo:{ filename: uploadFileName }});

                //             //     console.log("Total events read: ", countedEvents, events.length );
                //             // });
                            
                //             // input.on("error", function(e:any) { 
                //             //     console.error("qlogFullToQlogND:validate : error during reading filecontents!", e);
                //             //     // resolver();
                //             // });
                            
                //             // input.pipe(ndjson.parse())
                //             // .on('data', function(obj:any) {
                //             //     ++countedEvents;
                //             //     // console.log( "COUNTED", countedEvents, obj );

                //             //     events.push( obj );
                //             // })

                //         }
                //         else { 
                //             throw new Error("unsupported file format : " + uploadFileName);
                //         }

                //         Vue.notify({
                //             group: "default",
                //             title: "Uploaded file",
                //             type: "success",
                //             text: "The uploaded file is now available for visualization " + uploadFileName + ".<br/>Use the menu above to switch views.",
                //         });
                //     }
                //     catch (e){
                        
                //         console.error("FileManagerContainer:uploadFile : ", e);
                //         Vue.notify({
                //             group: "default",
                //             title: "Error uploading file",
                //             type: "error",
                //             duration: 6000,
                //             text: "Something went wrong. " + uploadFileName + ". For more information, view the devtools console.",
                //         });
                //     }
                // };

                // let identifier = new FileReader();

                // let firstFewBytes = file.slice(0, 1024); // first 1000 bytes should contain qlog_version

                // identifier.onload = (evt) => { 
                //     let firstFewCharacters = (evt!.target as any).result;

                //     console.log("FIRST FEW CHARACTERS ARE: ", firstFewCharacters, firstFewCharacters.indexOf("qlog_version") >= 0 ); 

                //     reader.readAsText(file);
                // };

                // identifier.readAsText(firstFewBytes);

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


            // // https://serversideup.net/uploading-files-vuejs-axios/
            // const formData = new FormData();
            // formData.append("file", this.fileToUpload!);
            // formData.append("secrets", this.secretsToUpload!);

            // console.log( formData);
            
            // axios.post( '/loadfiles',
            //     formData,
            //     {
            //         headers: {
            //             'Content-Type': 'multipart/form-data'
            //         }
            //     }
            // ).then(function(){
            // console.log('SUCCESS!!');
            // })
            // .catch(function(){
            // console.log('FAILURE!!');
            // });

        }

        public loadExamples(){
            let alreadyLoaded = false;
            for (const  group of this.store.groups ){
                if ( group.filename.indexOf("DEMO") === 0 ){
                    alreadyLoaded = true;
                    break;
                }
            }

            if ( alreadyLoaded ){

                Vue.notify({
                    group: "default",
                    title: "Example files already loaded",
                    type: "warn",
                    text: "Example files were already loaded, check for files with the 'DEMO_' prefix.",
                });

                return;
            }

            this.store.loadExamplesForDemo();
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
</script>
