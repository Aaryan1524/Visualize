// Figures in one React app, each with its own theme, then one unmounted.
// With window.__plant === "page", a fourth figure is mounted in page mode,
// which takes over the URL and a global: the check must then fail.
import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Figure } from "../../src/react/Figure.tsx";
import { mount } from "../../src/render/player.ts";
import lru from "../../examples/lru/scene.ts";
import retries from "../../examples/retries/scene.ts";
import attention from "../../examples/attention/scene.ts";

function PageModeFigure() {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const p = mount(host.current!, lru, { page: true });
    p.seekStep(3);
    return () => p.destroy();
  }, []);
  return <div ref={host} />;
}

function App() {
  const [both, setBoth] = useState(true);
  (window as unknown as { __unmountSecond: () => void }).__unmountSecond = () => setBoth(false);
  const plant = (window as unknown as { __plant?: string }).__plant;
  return (
    <main>
      <h1 id="host-heading">Host page</h1>
      <Figure scene={lru} theme="light" />
      {both && <Figure scene={retries} theme="dark" />}
      <Figure scene={attention} theme="light" />
      {plant === "page" && <PageModeFigure />}
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
