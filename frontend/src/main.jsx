import React from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import App from "./App";
import { store } from "./store/store";
import { RoleProvider } from "./context/RoleContext";
import "./index.css";
const container = document.getElementById("root");
const root = createRoot(container);

root.render(
  <React.StrictMode>
    <Provider store={store}>
      <RoleProvider>
        <App />
      </RoleProvider>
    </Provider>
  </React.StrictMode>
);
