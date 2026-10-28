import { Route, Router, Switch } from "wouter";
import Gallery from "@/pages/gallery";
import FlowerShop from "@/pages/flower-shop";
import NotFound from "@/pages/not-found";

function App() {
  return (
    <Router base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
      <Switch>
        <Route path="/" component={FlowerShop} />
        <Route path="/flowers" component={FlowerShop} />
        <Route path="/beads" component={Gallery} />
        <Route component={NotFound} />
      </Switch>
    </Router>
  );
}

export default App;
