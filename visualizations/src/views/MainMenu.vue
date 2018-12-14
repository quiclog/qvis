<template>
  <div id="MainMenu">
    <p>This is the main menu V2</p>
      <router-link to="/timeline">Timeline</router-link> | 
      <router-link to="/sequence">Sequence</router-link>
  </div>
</template>

<style scoped>
    #MainMenu{
        width: 100%;
        background-color: black;
        color: white;
    }

    #MainMenu a {
        font-weight: bold;
        color: #ffffff;
    }

    #MainMenu a.router-link-exact-active {
        color: #42b983;
    }
</style> 