<template>
    <div class="home">
        <h1>Welcome to qvis, the QUIC and HTTP/3 visualization toolsuite!</h1>
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
                                <p v-if="urlIsPcap" style="margin-top: 10px;">For .pcap files, you also need to specify a .keys file so it can be decrypted. We currently do not yet support decrypted pcaps or pcapng files with embedded keys.</p>
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
                        You can load .qlog, .pcap and .pcapng files.<br/>
                        You can also load a .json file that lists several other files to be fetched (for the format, see <a href="https://github.com/quiclog/pcap2qlog#options">the pcap2qlog documentation</a>).<br/><br/>
                        If you're looking for inspiration, <a href="https://quant.eggert.org/">quant</a> has public qlogs, as does <a href="http://fb.mvfst.net:8080/">mvfst</a>.<br/>
                        <a href="https://quic-tracker.info.ucl.ac.be">QUIC Tracker</a> provides .pcap files for all its tests and has a convenient integration with qvis from its UI.
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
                                    v-model="fileToUpload"
                                    :state="Boolean(fileToUpload)"
                                    placeholder="Choose a file or drop it here..."
                                    drop-placeholder="Drop file here..."
                                    accept=".qlog"
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
                                <b-button @click="uploadFile()" :disabled="fileToUpload === null" variant="primary">Upload</b-button>
                            </b-col>
                        </b-row>
                    </form>
                </div>
                <div>
                    <p>
                        <!--Upload supports the same formats as Option 1. You can only upload a single file at a time.<br/>-->
                        Upload currently only supports .qlog files directly. No data is transfered to the server.<br/>
                        Eventually we will also support .json, .pcap, .pcapng and .qtr files.<br/>
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

                        Format 1: <a href="https://quicvis.edm.uhasselt.be/#?list=x.json">?list=x.json</a><br/>
                        Format 2: <a href="https://quicvis.edm.uhasselt.be/#?file=x.qlog">?file=x.qlog</a><br/>
                        Format 3: <a href="https://quicvis.edm.uhasselt.be/#?file=x.pcap&amp;secrets=x.keys">?file=x.pcap&amp;secrets=x.keys</a><br/>
                        Format 4: <a href="https://quicvis.edm.uhasselt.be/#?file1=x.qlog&amp;file2=y.qlog&amp;file3=z.qlog">?file1=x.qlog&amp;file2=y.qlog&amp;file3=z.qlog</a><br/>
                        Format 5: <a href="https://quicvis.edm.uhasselt.be/#?file1=x.qlog&amp;secrets1=x.keys&amp;file2=y.qlog&amp;secrets2=y.keys">?file1=x.qlog&amp;secrets1=x.keys&amp;file2=y.qlog&amp;secrets2=y.keys</a><br/>
                    </p>
                </div>
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

    /* #FileManagerContainer :nth-child(even){
        background-color: #dcdcdc;
    }
    #FileManagerContainer :nth-child(odd){
        background-color: #aaaaaa;
    } */

</style>

<script lang="ts">
    import { getModule } from "vuex-module-decorators";
    import { Component, Vue } from "vue-property-decorator";

    import ConnectionStore from "@/store/ConnectionStore";


    @Component({})
    export default class FileManagerContainer extends Vue {

        protected store:ConnectionStore = getModule(ConnectionStore, this.$store);

        protected urlToLoad:string = "";
        protected secretsToLoad:string = "";

        protected fileToUpload:File|null = null;
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

            if ( this.fileToUpload === null || !this.fileToUpload.name.endsWith(".qlog") ){
                Vue.notify({
                    group: "default",
                    title: "Provide .qlog file",
                    type: "error",
                    duration: 6000,
                    text: "We currently only support uploading .qlog files.",
                });

                return;
            }

            const uploadFileName = this.fileToUpload.name;
            Vue.notify({
                group: "default",
                title: "Loading uploaded file",
                text: "Loading uploaded file " + uploadFileName + ".<br/>The file is not sent to a server.",
            });

            const reader = new FileReader();

            reader.onload = (evt) => {
                const contentsJSON = JSON.parse( (evt!.target as any).result );
                this.store.addGroupFromQlogFile({fileContentsJSON: contentsJSON, filename: uploadFileName});

                Vue.notify({
                    group: "default",
                    title: "Uploaded file",
                    type: "success",
                    text: "The uploaded file is now available for visualization " + uploadFileName + ".<br/>Use the menu above to switch views.",
                });
            };
            
            reader.readAsText(this.fileToUpload);


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

        protected get urlIsPcap(){
            return this.urlToLoad.indexOf(".pcap") >= 0;
        }

        protected get uploadIsPcap(){
            return false; // this.fileToUpload !== null && this.fileToUpload.name.indexOf(".pcap") >= 0;
        }
    }
</script>
