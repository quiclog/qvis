<template>
    <div class="home">
        <HelloWorld msg="This is the timeline view"/>

        <b-alert variant="danger" dismissible show fade>
            Dismissible Alert!
        </b-alert>

        <div class="container">
            <div class="row">
                <div class="col-6">
                    big one
                </div>
                <div class="col-2 bg-primary">
                    small
                </div>
                <div class="col-4">
                    medium
                </div>
            </div>
        </div>

        <b-alert variant="success" dismissible show style="width: 500px;">
            <h4 class="alert-heading">Well done!</h4>
            <p>Aww yeah, you successfully read this important alert message. This example text is going to run a bit longer so that you can see how spacing within an alert works with this kind of content.</p>
            <hr>
            <p class="mb-0">Whenever you need to, be sure to use margin utilities to keep things nice and tidy.</p>
        </b-alert>

        <div class="alert alert-success alert-dismissible fade show" style="width: 500px;" role="alert">
            <h4 class="alert-heading">Well done!</h4>
            <p>Aww yeah, you successfully read this important alert message. This example text is going to run a bit longer so that you can see how spacing within an alert works with this kind of content.</p>
            <hr>
            <p class="mb-0">Whenever you need to, be sure to use margin utilities to keep things nice and tidy.</p>
        </div>

    </div>
</template> 

<script lang="ts">
    import { Component, Vue } from 'vue-property-decorator';
    import HelloWorld from '@/components/HelloWorld.vue'; // @ is an alias to /src

    @Component({
        components: {
            HelloWorld,
        },
    })

    export default class Timeline extends Vue {
    }
</script>
