<template>
    <b-container id="MainMenu" fluid>
        <b-row>
            <b-col cols="1" md="auto">qvis</b-col>
            <b-col>
                <!--<router-link to="/debug">VUEDebug</router-link> |-->
                <router-link to="/files">Manage files</router-link> |
                <router-link to="/sequence">Sequence</router-link> |
                <router-link to="/congestion">Congestion</router-link>
            </b-col>
        </b-row>
    </b-container>
</template>

<style scoped>
    #MainMenu{
        width: 100%;
        background-color: black;
        color: white;
        text-align: center;
    }

    #MainMenu a {
        font-weight: bold;
        color: #ffffff;
    }

    #MainMenu a.router-link-exact-active {
        color: #42b983;
    }
</style>