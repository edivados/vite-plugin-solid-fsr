import { MetaProvider, Title } from "@solidjs/meta";
import { Router } from "@solidjs/router";
import { Suspense, onMount } from "solid-js";
import routes from "vite-plugin-solid-fsr/vinxi/routes";
import "./app.css";

export default function App() {
  onMount(() => {
    routes[0]["$component"].import().then(m => console.log(m));
  })
  return (
    <Router
      root={props => (
        <MetaProvider>
          <Title>SolidStart - Basic</Title>
          <a href="/">Index</a>
          <a href="/about">About</a>
          <Suspense>{props.children}</Suspense>
          <pre>
            {JSON.stringify(routes, null, 2)}
          </pre>
        </MetaProvider>
      )}
    >
    </Router>
  );
}
