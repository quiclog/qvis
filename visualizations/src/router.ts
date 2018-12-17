import Vue from "vue";
import Router from "vue-router";
import MainMenu from "./views/MainMenu.vue";
import Timeline from "./views/Timeline.vue";
import SequenceDiagram from "./views/SequenceDiagram.vue";

Vue.use(Router);

const router = new Router({
  routes: [
    {
      path: "/",
      redirect: "/timeline",
    },
    {
      path: "/timeline",
      name: "timeline",
      components: {
        default: Timeline,
        menu: MainMenu,
      },
    },
    {
      path: "/sequence",
      name: "sequence",
      // route level code-splitting
      // this generates a separate chunk (about.[hash].js) for this route
      // which is lazy-loaded when the route is visited.
      // component: () => import(/* webpackChunkName: "about" */ './views/About.vue'),
      components: {
        default: SequenceDiagram,
        menu: MainMenu,
      },
    },
  ],
});

export default router;
