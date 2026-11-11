// Two figures in one React app, each with its own theme, then one unmounted.
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { Figure } from "../../src/react/Figure.tsx";
import lru from "../../examples/lru/scene.ts";
import retries from "../../examples/retries/scene.ts";

function App() {
  const [both, setBoth] = useState(true);
  (window as unknown as { __unmountSecond: () => void }).__unmountSecond = () => setBoth(false);
  return (
    <main>
      <h1 id="host-heading">Host page</h1>
      <Figure scene={lru} theme="light" />
      {both && <Figure scene={retries} theme="dark" />}
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
