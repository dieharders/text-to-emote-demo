import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { PoseGallery } from "./components/PoseGallery";

// `?gallery` shows every pose side by side, for reviewing the pixel art.
const gallery = new URLSearchParams(location.search).has("gallery");

createRoot(document.getElementById("root")!).render(<StrictMode>{gallery ? <PoseGallery /> : <App />}</StrictMode>);
